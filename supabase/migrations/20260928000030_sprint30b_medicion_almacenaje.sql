-- ==============================================================================
-- SPRINT 30b: Medición de Almacenaje Configurable por Bodega
-- Métodos de cubicaje/conteo sin factores inventados ni conversiones forzadas.
-- ==============================================================================

DO $$ BEGIN
  CREATE TYPE public.storage_measure_method AS ENUM
    ('manual','pallet_positions','units_per_pallet','area_m2','volume_m3','units');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.storage_measure_basis AS ENUM ('period_end','daily_average','daily_peak');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Columnas de configuración en bodegas (warehouses)
ALTER TABLE public.warehouses
  ADD COLUMN IF NOT EXISTS storage_measure_method public.storage_measure_method NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS storage_measure_basis public.storage_measure_basis NOT NULL DEFAULT 'period_end',
  ADD COLUMN IF NOT EXISTS default_units_per_pallet numeric(20,4) CHECK (default_units_per_pallet > 0),
  ADD COLUMN IF NOT EXISTS storage_capacity numeric(20,2) CHECK (storage_capacity >= 0);

-- Columnas en ubicaciones físicas (warehouse_locations)
ALTER TABLE public.warehouse_locations
  ADD COLUMN IF NOT EXISTS pallet_positions integer NOT NULL DEFAULT 1 CHECK (pallet_positions > 0),
  ADD COLUMN IF NOT EXISTS area_m2 numeric(20,4) CHECK (area_m2 >= 0);

-- Columnas en catálogo de artículos (items)
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS units_per_pallet numeric(20,4) CHECK (units_per_pallet > 0),
  ADD COLUMN IF NOT EXISTS unit_volume_m3 numeric(20,6) CHECK (unit_volume_m3 >= 0);

-- ------------------------------------------------------------------------------
-- 1. Saldo por ubicación e ítem a una fecha dada
-- SECURITY INVOKER: respeta el RLS del llamador (staff o portal cliente)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.stock_balance_at(uuid, uuid, date);

CREATE OR REPLACE FUNCTION public.stock_balance_at(
  p_entity_id uuid,
  p_party_id uuid,
  p_date date
)
RETURNS TABLE (
  warehouse_id uuid,
  location_id uuid,
  item_id uuid,
  qty numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT sle.warehouse_id, sle.location_id, sle.item_id, SUM(sle.qty_change) AS qty
  FROM public.stock_ledger_entries sle
  JOIN public.warehouses w ON w.id = sle.warehouse_id
  WHERE w.entity_id = p_entity_id
    AND sle.party_id = p_party_id
    AND sle.posting_date <= p_date
  GROUP BY sle.warehouse_id, sle.location_id, sle.item_id
  HAVING SUM(sle.qty_change) > 0;
$$;

-- ------------------------------------------------------------------------------
-- 2. Medida de almacenaje en un día específico según el método configurado
-- Retorna:
--   quantity: cantidad en la unidad natural del método
--   missing_data: conteo o volumen de inconsistencias que impiden medir correctamente
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.storage_measure_on(uuid, uuid, uuid, public.storage_measure_method, numeric, date);

CREATE OR REPLACE FUNCTION public.storage_measure_on(
  p_entity_id uuid,
  p_party_id uuid,
  p_warehouse_id uuid,
  p_method public.storage_measure_method,
  p_default_upp numeric,
  p_date date
)
RETURNS TABLE (quantity numeric, missing_data numeric)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH b AS (
    SELECT sb.location_id, sb.item_id, sb.qty
    FROM public.stock_balance_at(p_entity_id, p_party_id, p_date) sb
    WHERE sb.warehouse_id = p_warehouse_id
  ),
  occupied AS (
    SELECT l.id, l.pallet_positions, l.area_m2
    FROM public.warehouse_locations l
    WHERE l.id IN (
      SELECT b_sub.location_id
      FROM b b_sub
      WHERE b_sub.location_id IS NOT NULL
      GROUP BY b_sub.location_id
      HAVING SUM(b_sub.qty) > 0
    )
  )
  SELECT
    CASE p_method
      WHEN 'units' THEN COALESCE((SELECT SUM(b.qty) FROM b), 0)
      WHEN 'units_per_pallet' THEN COALESCE((
        SELECT SUM(CEIL(b.qty / COALESCE(i.units_per_pallet, p_default_upp)))
        FROM b
        JOIN public.items i ON i.id = b.item_id
        WHERE COALESCE(i.units_per_pallet, p_default_upp) IS NOT NULL
      ), 0)
      WHEN 'pallet_positions' THEN COALESCE((SELECT SUM(occupied.pallet_positions) FROM occupied), 0)
      WHEN 'area_m2' THEN COALESCE((SELECT SUM(occupied.area_m2) FROM occupied), 0)
      WHEN 'volume_m3' THEN COALESCE((
        SELECT SUM(b.qty * i.unit_volume_m3)
        FROM b
        JOIN public.items i ON i.id = b.item_id
        WHERE i.unit_volume_m3 IS NOT NULL
      ), 0)
      ELSE 0
    END AS quantity,
    CASE p_method
      WHEN 'units_per_pallet' THEN (
        SELECT COUNT(*)
        FROM b
        JOIN public.items i ON i.id = b.item_id
        WHERE COALESCE(i.units_per_pallet, p_default_upp) IS NULL
      )
      WHEN 'pallet_positions' THEN COALESCE((SELECT SUM(b.qty) FROM b WHERE b.location_id IS NULL), 0)
      WHEN 'area_m2' THEN COALESCE((SELECT SUM(b.qty) FROM b WHERE b.location_id IS NULL), 0)
                          + (SELECT COUNT(*) FROM occupied WHERE occupied.area_m2 IS NULL)
      WHEN 'volume_m3' THEN (
        SELECT COUNT(*)
        FROM b
        JOIN public.items i ON i.id = b.item_id
        WHERE i.unit_volume_m3 IS NULL
      )
      ELSE 0
    END AS missing_data;
$$;

-- ------------------------------------------------------------------------------
-- 3. Resultado de Almacenaje por Bodega para un Período Completo
-- Devuelve una fila por cada bodega vinculada al cliente 3PL.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_storage_usage(uuid, uuid, date, date);

CREATE OR REPLACE FUNCTION public.get_storage_usage(
  p_entity_id uuid,
  p_party_id uuid,
  p_period_start date,
  p_period_end date
)
RETURNS TABLE (
  warehouse_id uuid,
  warehouse_name text,
  method public.storage_measure_method,
  basis public.storage_measure_basis,
  quantity numeric,
  unit text,
  rate_type text,
  missing_data numeric
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  w record;
  d date;
  r record;
  v_from date;
  v_vals numeric[];
  v_missing numeric;
BEGIN
  FOR w IN
    SELECT wh.id AS wid,
           wh.name AS wname,
           wh.storage_measure_method AS m,
           wh.storage_measure_basis AS b,
           wh.default_units_per_pallet AS dup
    FROM public.warehouses wh
    WHERE wh.entity_id = p_entity_id
      AND (
        EXISTS (SELECT 1 FROM public.party_warehouses pw WHERE pw.warehouse_id = wh.id AND pw.party_id = p_party_id)
        OR EXISTS (SELECT 1 FROM public.stock_ledger_entries s WHERE s.warehouse_id = wh.id AND s.party_id = p_party_id)
      )
    ORDER BY wh.name
  LOOP
    IF w.m = 'manual' THEN
      RETURN QUERY SELECT
        w.wid,
        w.wname,
        w.m,
        w.b,
        NULL::numeric,
        'manual'::text,
        NULL::text,
        0::numeric;
      CONTINUE;
    END IF;

    v_vals := ARRAY[]::numeric[];
    v_missing := 0;
    v_from := CASE WHEN w.b = 'period_end' THEN p_period_end ELSE p_period_start END;

    FOR d IN SELECT gs::date FROM generate_series(v_from::timestamp, p_period_end::timestamp, interval '1 day') gs
    LOOP
      SELECT m2.quantity, m2.missing_data INTO r
      FROM public.storage_measure_on(p_entity_id, p_party_id, w.wid, w.m, w.dup, d) m2;
      v_vals := v_vals || COALESCE(r.quantity, 0);
      v_missing := GREATEST(v_missing, COALESCE(r.missing_data, 0));
    END LOOP;

    RETURN QUERY SELECT
      w.wid,
      w.wname,
      w.m,
      w.b,
      CASE w.b
        WHEN 'period_end'    THEN (CASE WHEN array_length(v_vals, 1) > 0 THEN v_vals[array_upper(v_vals, 1)] ELSE 0 END)
        WHEN 'daily_average' THEN (SELECT COALESCE(AVG(x), 0) FROM unnest(v_vals) x)
        WHEN 'daily_peak'    THEN (SELECT COALESCE(MAX(x), 0) FROM unnest(v_vals) x)
      END,
      CASE w.m
        WHEN 'pallet_positions' THEN 'pallets'
        WHEN 'units_per_pallet' THEN 'pallets'
        WHEN 'area_m2'          THEN 'm2'
        WHEN 'volume_m3'        THEN 'm3'
        WHEN 'units'            THEN 'unidades'
      END,
      CASE w.m
        WHEN 'pallet_positions' THEN 'storage_pallet'
        WHEN 'units_per_pallet' THEN 'storage_pallet'
        WHEN 'area_m2'          THEN 'storage_m2'
        WHEN 'volume_m3'        THEN 'storage_m3'
        WHEN 'units'            THEN 'storage_unit'
      END,
      v_missing;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.stock_balance_at(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_measure_on(uuid, uuid, uuid, public.storage_measure_method, numeric, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_storage_usage(uuid, uuid, date, date) TO authenticated;
