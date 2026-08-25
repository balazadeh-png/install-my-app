-- ============================================================================
-- Sprint 5: Multibodega Real, Movimientos de Stock y Kardex FIFO — EasyERP
-- ============================================================================

-- 1. Enum para tipos de movimiento de inventario
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_movement_type') THEN
        CREATE TYPE public.stock_movement_type AS ENUM ('receipt', 'issue', 'transfer_out', 'transfer_in', 'adjustment');
    END IF;
END $$;

-- 2. Tabla stock_ledger_entries (Libro Mayor de Inventario / Movimientos)
CREATE TABLE IF NOT EXISTS public.stock_ledger_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT NOT NULL,
    item_id uuid REFERENCES public.items(id) ON DELETE RESTRICT NOT NULL,
    warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE RESTRICT NOT NULL,
    movement_type public.stock_movement_type NOT NULL,
    qty_change numeric(20,4) NOT NULL, -- Positivo en entradas, negativo en salidas
    valuation_rate numeric(20,4) NOT NULL DEFAULT 0, -- Costo unitario (CLP)
    voucher_type text DEFAULT 'Manual',
    voucher_id uuid,
    transfer_pair_id uuid, -- Enlace atómico entre transfer_out y transfer_in
    memo text,
    posting_date date NOT NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_sle_entity ON public.stock_ledger_entries(entity_id);
CREATE INDEX IF NOT EXISTS ix_sle_item ON public.stock_ledger_entries(item_id);
CREATE INDEX IF NOT EXISTS ix_sle_warehouse ON public.stock_ledger_entries(warehouse_id);
CREATE INDEX IF NOT EXISTS ix_sle_date ON public.stock_ledger_entries(posting_date);
CREATE INDEX IF NOT EXISTS ix_sle_transfer ON public.stock_ledger_entries(transfer_pair_id);

ALTER TABLE public.stock_ledger_entries ENABLE ROW LEVEL SECURITY;

-- 3. Tabla stock_valuation_layers (Capas FIFO de Valorización)
CREATE TABLE IF NOT EXISTS public.stock_valuation_layers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id uuid REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
    warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE CASCADE NOT NULL,
    stock_ledger_entry_id uuid REFERENCES public.stock_ledger_entries(id) ON DELETE CASCADE NOT NULL,
    qty_remaining numeric(20,4) NOT NULL,
    rate numeric(20,4) NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_svl_item_warehouse ON public.stock_valuation_layers(item_id, warehouse_id);
CREATE INDEX IF NOT EXISTS ix_svl_remaining ON public.stock_valuation_layers(qty_remaining);

ALTER TABLE public.stock_valuation_layers ENABLE ROW LEVEL SECURITY;

-- 4. Vista stock_balances (Saldos y Valorización en Tiempo Real por Bodega)
CREATE OR REPLACE VIEW public.stock_balances AS
SELECT 
    s.entity_id,
    s.item_id,
    s.warehouse_id,
    i.code AS item_code,
    i.name AS item_name,
    w.code AS warehouse_code,
    w.name AS warehouse_name,
    COALESCE(SUM(s.qty_change), 0) AS qty_on_hand,
    COALESCE(SUM(s.qty_change * s.valuation_rate), 0) AS value_on_hand,
    CASE 
        WHEN COALESCE(SUM(s.qty_change), 0) > 0 
        THEN ROUND(COALESCE(SUM(s.qty_change * s.valuation_rate), 0) / SUM(s.qty_change), 4)
        ELSE 0 
    END AS avg_rate
FROM public.stock_ledger_entries s
JOIN public.items i ON i.id = s.item_id
JOIN public.warehouses w ON w.id = s.warehouse_id
GROUP BY s.entity_id, s.item_id, s.warehouse_id, i.code, i.name, w.code, w.name;

-- 5. Trigger FIFO: Consumir capas más antiguas y calcular costo real antes de la salida
CREATE OR REPLACE FUNCTION public.consume_fifo_layers()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_remaining numeric(20,4);
    v_layer RECORD;
    v_consumed numeric(20,4);
    v_total_cost numeric(20,4) := 0;
    v_total_qty numeric(20,4) := 0;
BEGIN
    v_remaining := ABS(NEW.qty_change);

    FOR v_layer IN
        SELECT id, qty_remaining, rate 
        FROM public.stock_valuation_layers
        WHERE item_id = NEW.item_id 
          AND warehouse_id = NEW.warehouse_id 
          AND qty_remaining > 0
        ORDER BY created_at ASC
        FOR UPDATE
    LOOP
        EXIT WHEN v_remaining <= 0;
        
        v_consumed := LEAST(v_layer.qty_remaining, v_remaining);
        
        UPDATE public.stock_valuation_layers 
        SET qty_remaining = qty_remaining - v_consumed 
        WHERE id = v_layer.id;
        
        v_total_cost := v_total_cost + (v_consumed * v_layer.rate);
        v_total_qty := v_total_qty + v_consumed;
        v_remaining := v_remaining - v_consumed;
    END LOOP;

    IF v_remaining > 0 THEN
        RAISE EXCEPTION 'Stock insuficiente en la bodega seleccionada. Faltan % unidades para completar la salida.', v_remaining;
    END IF;

    NEW.valuation_rate := ROUND(v_total_cost / NULLIF(v_total_qty, 0), 4);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consume_fifo_layers ON public.stock_ledger_entries;
CREATE TRIGGER trg_consume_fifo_layers
BEFORE INSERT ON public.stock_ledger_entries
FOR EACH ROW WHEN (NEW.qty_change < 0)
EXECUTE FUNCTION public.consume_fifo_layers();

-- 6. Trigger FIFO: Crear nueva capa de valorización tras una entrada de inventario
CREATE OR REPLACE FUNCTION public.create_fifo_layer()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.stock_valuation_layers (
        item_id, 
        warehouse_id, 
        stock_ledger_entry_id, 
        qty_remaining, 
        rate
    ) VALUES (
        NEW.item_id, 
        NEW.warehouse_id, 
        NEW.id, 
        NEW.qty_change, 
        NEW.valuation_rate
    );
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_fifo_layer ON public.stock_ledger_entries;
CREATE TRIGGER trg_create_fifo_layer
AFTER INSERT ON public.stock_ledger_entries
FOR EACH ROW WHEN (NEW.qty_change > 0)
EXECUTE FUNCTION public.create_fifo_layer();

-- 7. Función atómica para traslados entre bodegas conservando el costo FIFO
CREATE OR REPLACE FUNCTION public.create_warehouse_transfer(
    _entity_id uuid,
    _item_id uuid,
    _from_warehouse uuid,
    _to_warehouse uuid,
    _qty numeric,
    _posting_date date,
    _memo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_pair_id uuid := gen_random_uuid();
    v_out_id uuid;
    v_computed_rate numeric(20,4);
    v_in_id uuid;
BEGIN
    IF _from_warehouse = _to_warehouse THEN
        RAISE EXCEPTION 'La bodega de origen y la bodega de destino no pueden ser la misma.';
    END IF;

    IF _qty <= 0 THEN
        RAISE EXCEPTION 'La cantidad a trasladar debe ser mayor a cero.';
    END IF;

    -- 1. Insertar salida (transfer_out). El trigger trg_consume_fifo_layers consumirá las capas y calculará valuation_rate
    INSERT INTO public.stock_ledger_entries (
        entity_id,
        item_id,
        warehouse_id,
        movement_type,
        qty_change,
        valuation_rate,
        voucher_type,
        transfer_pair_id,
        memo,
        posting_date,
        created_by
    ) VALUES (
        _entity_id,
        _item_id,
        _from_warehouse,
        'transfer_out',
        -_qty,
        0, -- Se calculará automáticamente en el trigger
        'Traslado entre Bodegas',
        v_pair_id,
        COALESCE(_memo, 'Traslado hacia otra bodega'),
        _posting_date,
        auth.uid()
    ) RETURNING id, valuation_rate INTO v_out_id, v_computed_rate;

    -- 2. Insertar entrada (transfer_in) con el costo FIFO recién calculado
    INSERT INTO public.stock_ledger_entries (
        entity_id,
        item_id,
        warehouse_id,
        movement_type,
        qty_change,
        valuation_rate,
        voucher_type,
        transfer_pair_id,
        memo,
        posting_date,
        created_by
    ) VALUES (
        _entity_id,
        _item_id,
        _to_warehouse,
        'transfer_in',
        _qty,
        v_computed_rate,
        'Traslado entre Bodegas',
        v_pair_id,
        COALESCE(_memo, 'Recepción de traslado'),
        _posting_date,
        auth.uid()
    ) RETURNING id INTO v_in_id;

    RETURN json_build_object(
        'success', true,
        'transfer_pair_id', v_pair_id,
        'out_id', v_out_id,
        'in_id', v_in_id,
        'valuation_rate', v_computed_rate,
        'total_value', v_computed_rate * _qty
    )::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.create_warehouse_transfer(uuid, uuid, uuid, uuid, numeric, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_warehouse_transfer(uuid, uuid, uuid, uuid, numeric, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_warehouse_transfer(uuid, uuid, uuid, uuid, numeric, date, text) TO service_role;

-- 8. Políticas RLS para stock_ledger_entries y stock_valuation_layers
DROP POLICY IF EXISTS "read_stock_ledger_entries" ON public.stock_ledger_entries;
CREATE POLICY "read_stock_ledger_entries" 
ON public.stock_ledger_entries FOR SELECT 
TO authenticated
USING (public.user_has_company_access(auth.uid(), entity_id));

DROP POLICY IF EXISTS "write_stock_ledger_entries" ON public.stock_ledger_entries;
CREATE POLICY "write_stock_ledger_entries" 
ON public.stock_ledger_entries FOR ALL 
TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

DROP POLICY IF EXISTS "read_stock_valuation_layers" ON public.stock_valuation_layers;
CREATE POLICY "read_stock_valuation_layers" 
ON public.stock_valuation_layers FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.warehouses w 
    WHERE w.id = warehouse_id AND public.user_has_company_access(auth.uid(), w.entity_id)
  )
);

DROP POLICY IF EXISTS "write_stock_valuation_layers" ON public.stock_valuation_layers;
CREATE POLICY "write_stock_valuation_layers" 
ON public.stock_valuation_layers FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.warehouses w 
    WHERE w.id = warehouse_id 
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'accountant'))
    AND public.user_has_company_access(auth.uid(), w.entity_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.warehouses w 
    WHERE w.id = warehouse_id 
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'accountant'))
    AND public.user_has_company_access(auth.uid(), w.entity_id)
  )
);
