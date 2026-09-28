-- ==============================================================================
-- Migration: 20260928000031_sprint31_ai_driven_stock_forecast.sql
-- Description: Sprint 31 - AI-Driven Predictive Analytics & Automated Stock-Out Alerts
--   1. Vistas de compatibilidad: kardex_movements y order_items
--   2. Tabla client_alerts con RLS segregado por empresa y cliente
--   3. Función PL/pgSQL get_inventory_stockout_forecast(company_id, party_id)
--   4. Función PL/pgSQL check_and_create_stockout_alerts(company_id, party_id)
--   5. Funciones auxiliares para marcar alertas como leídas
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Vistas de Compatibilidad: kardex_movements y order_items
-- ------------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.kardex_movements AS
SELECT
  sle.id,
  sle.entity_id AS company_id,
  sle.entity_id,
  sle.party_id,
  sle.warehouse_id,
  sle.location_id,
  sle.item_id,
  sle.movement_type,
  sle.qty_change,
  sle.valuation_rate,
  ROUND(sle.qty_change * sle.valuation_rate, 2) AS total_value,
  sle.voucher_type,
  sle.voucher_id,
  sle.memo,
  sle.posting_date,
  sle.created_at
FROM public.stock_ledger_entries sle;

CREATE OR REPLACE VIEW public.order_items AS
SELECT
  sol.id,
  sol.sales_order_id,
  so.entity_id AS company_id,
  so.entity_id,
  so.party_id,
  sol.item_id,
  sol.external_sku,
  sol.qty,
  so.channel,
  so.external_order_id,
  so.status AS order_status,
  so.created_at::date AS order_date,
  so.created_at
FROM public.sales_order_lines sol
JOIN public.sales_orders so ON so.id = sol.sales_order_id;

-- ------------------------------------------------------------------------------
-- 2. Tabla client_alerts
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.client_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  party_id uuid REFERENCES public.parties(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.items(id) ON DELETE CASCADE,
  severity text NOT NULL CHECK (severity IN ('CRITICAL', 'WARNING', 'INFO', 'HEALTHY')),
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_client_alerts_company ON public.client_alerts(company_id);
CREATE INDEX IF NOT EXISTS ix_client_alerts_party ON public.client_alerts(party_id);
CREATE INDEX IF NOT EXISTS ix_client_alerts_item ON public.client_alerts(item_id);
CREATE INDEX IF NOT EXISTS ix_client_alerts_unread ON public.client_alerts(is_read) WHERE is_read = false;

ALTER TABLE public.client_alerts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para personal de la empresa (staff interno)
DROP POLICY IF EXISTS "staff_manage_client_alerts" ON public.client_alerts;
CREATE POLICY "staff_manage_client_alerts"
ON public.client_alerts FOR ALL
TO authenticated
USING (public.user_has_company_access(auth.uid(), company_id))
WITH CHECK (public.user_has_company_access(auth.uid(), company_id));

-- Políticas RLS para clientes del portal (aislamiento estricto por cliente)
DROP POLICY IF EXISTS "portal_read_client_alerts" ON public.client_alerts;
CREATE POLICY "portal_read_client_alerts"
ON public.client_alerts FOR SELECT
TO authenticated
USING (
  party_id IS NOT NULL 
  AND public.user_has_party_access(party_id)
);

DROP POLICY IF EXISTS "portal_update_client_alerts" ON public.client_alerts;
CREATE POLICY "portal_update_client_alerts"
ON public.client_alerts FOR UPDATE
TO authenticated
USING (
  party_id IS NOT NULL 
  AND public.user_has_party_access(party_id)
)
WITH CHECK (
  party_id IS NOT NULL 
  AND public.user_has_party_access(party_id)
);

-- ------------------------------------------------------------------------------
-- 3. Función PL/pgSQL get_inventory_stockout_forecast
-- Calcula el consumo diario de los últimos 30 días, proyecta días hasta agotarse,
-- y asigna nivel de riesgo (CRITICAL, WARNING, HEALTHY).
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_inventory_stockout_forecast(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_inventory_stockout_forecast(
  p_company_id uuid,
  p_party_id uuid DEFAULT NULL
)
RETURNS TABLE (
  item_id uuid,
  item_code text,
  item_name text,
  company_id uuid,
  party_id uuid,
  current_stock numeric,
  avg_daily_consumption numeric,
  days_to_stockout numeric,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validar permisos de acceso
  IF NOT (
    public.user_has_company_access(auth.uid(), p_company_id)
    OR (p_party_id IS NOT NULL AND public.user_has_party_access(p_party_id))
  ) THEN
    RAISE EXCEPTION 'No autorizado para consultar el pronóstico de inventario' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH consumption_30d AS (
    -- Consumo acumulado de salidas (qty_change < 0) en los últimos 30 días corridos
    SELECT
      sle.item_id,
      sle.party_id,
      ROUND(SUM(ABS(sle.qty_change)) / 30.0, 2) AS daily_rate
    FROM public.stock_ledger_entries sle
    JOIN public.warehouses w ON w.id = sle.warehouse_id
    WHERE w.entity_id = p_company_id
      AND (p_party_id IS NULL OR sle.party_id = p_party_id)
      AND sle.qty_change < 0
      AND sle.posting_date >= (CURRENT_DATE - INTERVAL '30 days')::date
    GROUP BY sle.item_id, sle.party_id
  ),
  current_inventory AS (
    -- Stock actual disponible en custodia
    SELECT
      sb.item_id,
      sb.party_id,
      SUM(COALESCE(sb.qty_on_hand, 0)) AS stock_on_hand
    FROM public.stock_balances sb
    JOIN public.warehouses w ON w.id = sb.warehouse_id
    WHERE w.entity_id = p_company_id
      AND (p_party_id IS NULL OR sb.party_id = p_party_id)
    GROUP BY sb.item_id, sb.party_id
  ),
  combined_data AS (
    -- Unir ítems con saldo o con movimientos recientes
    SELECT
      COALESCE(ci.item_id, c30.item_id) AS it_id,
      COALESCE(ci.party_id, c30.party_id, p_party_id) AS pt_id,
      COALESCE(ci.stock_on_hand, 0) AS stock_qty,
      COALESCE(c30.daily_rate, 0) AS burn_rate
    FROM current_inventory ci
    FULL OUTER JOIN consumption_30d c30
      ON ci.item_id = c30.item_id
     AND (ci.party_id IS NOT DISTINCT FROM c30.party_id)
  )
  SELECT
    i.id AS item_id,
    i.code AS item_code,
    i.name AS item_name,
    p_company_id AS company_id,
    cd.pt_id AS party_id,
    cd.stock_qty AS current_stock,
    cd.burn_rate AS avg_daily_consumption,
    CASE
      WHEN cd.stock_qty <= 0 THEN 0::numeric
      WHEN cd.burn_rate > 0 THEN ROUND(cd.stock_qty / cd.burn_rate, 1)
      ELSE 999::numeric -- Sin consumo reciente o stock abundante
    END AS days_to_stockout,
    CASE
      WHEN cd.stock_qty <= 0 OR (cd.burn_rate > 0 AND (cd.stock_qty / cd.burn_rate) <= 7) THEN 'CRITICAL'
      WHEN cd.burn_rate > 0 AND (cd.stock_qty / cd.burn_rate) <= 14 THEN 'WARNING'
      ELSE 'HEALTHY'
    END AS status
  FROM combined_data cd
  JOIN public.items i ON i.id = cd.it_id
  WHERE cd.pt_id IS NOT NULL -- asegurar asociación a cliente en modelo 3PL
  ORDER BY
    CASE
      WHEN cd.stock_qty <= 0 THEN 1
      WHEN cd.burn_rate > 0 AND (cd.stock_qty / cd.burn_rate) <= 7 THEN 2
      WHEN cd.burn_rate > 0 AND (cd.stock_qty / cd.burn_rate) <= 14 THEN 3
      ELSE 4
    END,
    CASE
      WHEN cd.burn_rate > 0 THEN cd.stock_qty / cd.burn_rate
      ELSE 999
    END ASC;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. Función PL/pgSQL check_and_create_stockout_alerts
-- Procesa el pronóstico, limpia alertas resueltas y crea/actualiza advertencias.
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.check_and_create_stockout_alerts(uuid, uuid);

CREATE OR REPLACE FUNCTION public.check_and_create_stockout_alerts(
  p_company_id uuid,
  p_party_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  v_critical_count integer := 0;
  v_warning_count integer := 0;
  v_resolved_count integer := 0;
  v_existing_alert_id uuid;
  v_alert_msg text;
BEGIN
  -- Validar permisos de acceso
  IF NOT (
    public.user_has_company_access(auth.uid(), p_company_id)
    OR (p_party_id IS NOT NULL AND public.user_has_party_access(p_party_id))
  ) THEN
    RAISE EXCEPTION 'No autorizado para ejecutar la generación de alertas' USING ERRCODE = '42501';
  END IF;

  FOR rec IN
    SELECT *
    FROM public.get_inventory_stockout_forecast(p_company_id, p_party_id)
  LOOP
    IF rec.status IN ('CRITICAL', 'WARNING') THEN
      -- Verificar si ya existe alerta activa para este ítem y cliente
      SELECT id INTO v_existing_alert_id
      FROM public.client_alerts
      WHERE company_id = p_company_id
        AND party_id = rec.party_id
        AND item_id = rec.item_id
        AND is_read = false
      LIMIT 1;

      IF rec.status = 'CRITICAL' THEN
        v_critical_count := v_critical_count + 1;
        IF rec.current_stock <= 0 THEN
          v_alert_msg := format('Stock Agotado: %s (%s). Inventario en 0 unidades con demanda activa. Reposición urgente requerida.', rec.item_name, rec.item_code);
        ELSE
          v_alert_msg := format('Stock Crítico: %s (%s). Quedan solo %s días de inventario (%s un. disponibles; consumo prom: %s un/día).', rec.item_name, rec.item_code, rec.days_to_stockout, rec.current_stock, rec.avg_daily_consumption);
        END IF;
      ELSE
        v_warning_count := v_warning_count + 1;
        v_alert_msg := format('Alerta Preventiva: %s (%s). Quedan %s días de inventario (%s un. disponibles; consumo prom: %s un/día).', rec.item_name, rec.item_code, rec.days_to_stockout, rec.current_stock, rec.avg_daily_consumption);
      END IF;

      IF v_existing_alert_id IS NOT NULL THEN
        -- Actualizar severidad y mensaje de la alerta existente si cambió
        UPDATE public.client_alerts
        SET
          severity = rec.status,
          message = v_alert_msg,
          updated_at = now()
        WHERE id = v_existing_alert_id;
      ELSE
        -- Insertar nueva alerta activa
        INSERT INTO public.client_alerts (
          company_id,
          party_id,
          item_id,
          severity,
          message,
          is_read
        ) VALUES (
          p_company_id,
          rec.party_id,
          rec.item_id,
          rec.status,
          v_alert_msg,
          false
        );
      END IF;

    ELSE
      -- El ítem está HEALTHY: resolver alertas activas previas
      UPDATE public.client_alerts
      SET
        is_read = true,
        updated_at = now()
      WHERE company_id = p_company_id
        AND party_id = rec.party_id
        AND item_id = rec.item_id
        AND is_read = false;

      IF FOUND THEN
        v_resolved_count := v_resolved_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'critical_alerts', v_critical_count,
    'warning_alerts', v_warning_count,
    'resolved_alerts', v_resolved_count
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. Funciones para Marcar Alertas como Leídas
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.mark_client_alert_read(uuid);

CREATE OR REPLACE FUNCTION public.mark_client_alert_read(p_alert_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_party_id uuid;
  v_company_id uuid;
BEGIN
  SELECT party_id, company_id INTO v_party_id, v_company_id
  FROM public.client_alerts
  WHERE id = p_alert_id;

  IF v_party_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT (
    public.user_has_company_access(auth.uid(), v_company_id)
    OR public.user_has_party_access(v_party_id)
  ) THEN
    RAISE EXCEPTION 'Sin permiso para modificar esta alerta' USING ERRCODE = '42501';
  END IF;

  UPDATE public.client_alerts
  SET is_read = true, updated_at = now()
  WHERE id = p_alert_id;

  RETURN true;
END;
$$;

DROP FUNCTION IF EXISTS public.mark_all_client_alerts_read(uuid);

CREATE OR REPLACE FUNCTION public.mark_all_client_alerts_read(p_party_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.user_has_party_access(p_party_id) THEN
    RAISE EXCEPTION 'Sin permiso para el cliente especificado' USING ERRCODE = '42501';
  END IF;

  UPDATE public.client_alerts
  SET is_read = true, updated_at = now()
  WHERE party_id = p_party_id AND is_read = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. Concesión de Permisos
-- ------------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.get_inventory_stockout_forecast(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_create_stockout_alerts(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_client_alert_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_client_alerts_read(uuid) TO authenticated;
