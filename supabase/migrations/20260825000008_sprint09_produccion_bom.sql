-- ============================================================================
-- Sprint 9: Módulo de Producción Simple & Lista de Materiales (BOM) — EasyERP
-- ============================================================================

-- 1. Tablas de Lista de Materiales / Fórmulas (BOM - Bill of Materials)
CREATE TABLE IF NOT EXISTS public.bill_of_materials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT NOT NULL,
    name text NOT NULL,
    item_id uuid REFERENCES public.items(id) ON DELETE RESTRICT NOT NULL, -- Producto terminado
    output_qty numeric(20,4) NOT NULL DEFAULT 1,                        -- Rendimiento base de la receta
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_bom_entity ON public.bill_of_materials(entity_id);
CREATE INDEX IF NOT EXISTS ix_bom_item ON public.bill_of_materials(item_id);

ALTER TABLE public.bill_of_materials ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.bom_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id uuid REFERENCES public.bill_of_materials(id) ON DELETE CASCADE NOT NULL,
    component_item_id uuid REFERENCES public.items(id) ON DELETE RESTRICT NOT NULL, -- Insumo / Materia prima
    qty_required numeric(20,4) NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_bom_lines_bom ON public.bom_lines(bom_id);

ALTER TABLE public.bom_lines ENABLE ROW LEVEL SECURITY;

-- 2. Estado de Órdenes de Producción
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'production_order_status') THEN
        CREATE TYPE public.production_order_status AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');
    END IF;
END $$;

-- 3. Tabla de Órdenes de Producción
CREATE TABLE IF NOT EXISTS public.production_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT NOT NULL,
    order_number text NOT NULL,
    bom_id uuid REFERENCES public.bill_of_materials(id) ON DELETE RESTRICT NOT NULL,
    item_id uuid REFERENCES public.items(id) ON DELETE RESTRICT NOT NULL,
    qty_planned numeric(20,4) NOT NULL,
    qty_produced numeric(20,4) DEFAULT 0 NOT NULL,
    source_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE RESTRICT NOT NULL,
    target_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE RESTRICT NOT NULL,
    cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
    business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL,
    status public.production_order_status DEFAULT 'planned' NOT NULL,
    planned_date date NOT NULL,
    completed_date date,
    total_cost numeric(20,4),
    unit_cost numeric(20,4),
    notes text,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT uq_prod_order_num UNIQUE (entity_id, order_number)
);

CREATE INDEX IF NOT EXISTS ix_po_entity ON public.production_orders(entity_id);
CREATE INDEX IF NOT EXISTS ix_po_status ON public.production_orders(status);

ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;

-- 4. Función Transaccional: Completar Orden de Producción
CREATE OR REPLACE FUNCTION public.complete_production_order(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_bom RECORD;
    v_line RECORD;
    v_scale_factor numeric(20,6);
    v_required_qty numeric(20,4);
    v_total_consumed_cost numeric(20,4) := 0;
    v_unit_finished_cost numeric(20,4) := 0;
    v_issue_id uuid;
    v_issue_cost numeric(20,4);
    v_receipt_id uuid;
BEGIN
    SELECT * INTO v_order FROM public.production_orders WHERE id = _order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Orden de producción no encontrada.';
    END IF;

    IF v_order.status = 'completed' THEN
        RAISE EXCEPTION 'La orden de producción ya se encuentra completada.';
    ELSIF v_order.status = 'cancelled' THEN
        RAISE EXCEPTION 'No se puede procesar una orden de producción cancelada.';
    END IF;

    SELECT * INTO v_bom FROM public.bill_of_materials WHERE id = v_order.bom_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Fórmula/Receta (BOM) no encontrada.';
    END IF;

    IF v_bom.output_qty <= 0 THEN
        RAISE EXCEPTION 'El rendimiento del BOM debe ser mayor a cero.';
    END IF;

    v_scale_factor := v_order.qty_planned / v_bom.output_qty;

    -- 1. Consumir materiales FIFO desde la bodega de origen
    FOR v_line IN SELECT * FROM public.bom_lines WHERE bom_id = v_bom.id LOOP
        v_required_qty := ROUND(v_line.qty_required * v_scale_factor, 4);

        IF v_required_qty > 0 THEN
            -- Insertar salida FIFO en stock_ledger_entries
            -- (El trigger trg_consume_fifo_layers valida stock suficiente y calcula total_value real)
            INSERT INTO public.stock_ledger_entries (
                entity_id,
                item_id,
                warehouse_id,
                movement_date,
                movement_type,
                quantity,
                reference_doc_type,
                reference_doc_id,
                notes,
                created_by
            ) VALUES (
                v_order.entity_id,
                v_line.component_item_id,
                v_order.source_warehouse_id,
                COALESCE(v_order.planned_date, CURRENT_DATE),
                'issue',
                v_required_qty,
                'production_order',
                v_order.id,
                'Consumo Producción OP: ' || v_order.order_number,
                auth.uid()
            ) RETURNING id, total_value INTO v_issue_id, v_issue_cost;

            v_total_consumed_cost := v_total_consumed_cost + COALESCE(v_issue_cost, 0);
        END IF;
    END LOOP;

    -- 2. Calcular costo unitario resultante del producto terminado
    IF v_order.qty_planned > 0 THEN
        v_unit_finished_cost := ROUND(v_total_consumed_cost / v_order.qty_planned, 4);
    ELSE
        v_unit_finished_cost := 0;
    END IF;

    -- 3. Ingresar el producto terminado a la bodega de destino valorizado al costo real
    INSERT INTO public.stock_ledger_entries (
        entity_id,
        item_id,
        warehouse_id,
        movement_date,
        movement_type,
        quantity,
        unit_cost,
        total_value,
        reference_doc_type,
        reference_doc_id,
        notes,
        created_by
    ) VALUES (
        v_order.entity_id,
        v_order.item_id,
        v_order.target_warehouse_id,
        COALESCE(v_order.planned_date, CURRENT_DATE),
        'receipt',
        v_order.qty_planned,
        v_unit_finished_cost,
        v_total_consumed_cost,
        'production_order',
        v_order.id,
        'Ingreso Producción Terminada OP: ' || v_order.order_number,
        auth.uid()
    ) RETURNING id INTO v_receipt_id;

    -- 4. Actualizar estado de la orden de producción
    UPDATE public.production_orders SET
        status = 'completed',
        qty_produced = v_order.qty_planned,
        total_cost = v_total_consumed_cost,
        unit_cost = v_unit_finished_cost,
        completed_date = CURRENT_DATE
    WHERE id = _order_id;

    RETURN json_build_object(
        'success', true,
        'order_id', _order_id,
        'qty_produced', v_order.qty_planned,
        'total_cost', v_total_consumed_cost,
        'unit_cost', v_unit_finished_cost
    )::jsonb;
END;
$$;

-- 5. Políticas RLS
CREATE POLICY "read_bill_of_materials" ON public.bill_of_materials
FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_bill_of_materials" ON public.bill_of_materials
FOR ALL TO authenticated USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

CREATE POLICY "read_bom_lines" ON public.bom_lines
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.bill_of_materials b 
    WHERE b.id = bom_id 
    AND public.user_has_company_access(auth.uid(), b.entity_id)
  )
);

CREATE POLICY "write_bom_lines" ON public.bom_lines
FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.bill_of_materials b 
    WHERE b.id = bom_id 
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'accountant'))
    AND public.user_has_company_access(auth.uid(), b.entity_id)
  )
);

CREATE POLICY "read_production_orders" ON public.production_orders
FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_production_orders" ON public.production_orders
FOR ALL TO authenticated USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

-- 6. Registrar Módulo en la tabla modules
INSERT INTO public.modules (name, label)
VALUES ('production', 'Producción')
ON CONFLICT (name) DO UPDATE SET label = 'Producción', active = true;
