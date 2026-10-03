-- ============================================================================
-- Sprint 38: Órdenes de Compra (PO)
-- ============================================================================

-- 1. Tipo enum po_status
DO $$ BEGIN
  CREATE TYPE public.po_status AS ENUM ('draft', 'sent', 'confirmed', 'cancelled', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tabla purchase_orders (Cabecera de Órdenes de Compra)
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT NOT NULL,
    party_id uuid REFERENCES public.parties(id) ON DELETE RESTRICT NOT NULL,
    po_number text NOT NULL,
    status public.po_status NOT NULL DEFAULT 'draft',
    issue_date date NOT NULL DEFAULT CURRENT_DATE,
    expected_date date,
    warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
    cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
    currency_code text REFERENCES public.currencies(code) NOT NULL DEFAULT 'CLP',
    exchange_rate numeric(20,9) DEFAULT 1.0 NOT NULL,
    observaciones text,
    subtotal_amount numeric(20,4) DEFAULT 0 NOT NULL,
    tax_amount numeric(20,4) DEFAULT 0 NOT NULL,
    total_amount numeric(20,4) DEFAULT 0 NOT NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (entity_id, po_number)
);

CREATE INDEX IF NOT EXISTS idx_po_entity_id ON public.purchase_orders(entity_id);
CREATE INDEX IF NOT EXISTS idx_po_party_id ON public.purchase_orders(party_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_issue_date ON public.purchase_orders(issue_date);

-- 3. Tabla purchase_order_lines (Líneas de la Orden de Compra)
CREATE TABLE IF NOT EXISTS public.purchase_order_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE CASCADE NOT NULL,
    catalog_item_id uuid REFERENCES public.supplier_catalog_items(id) ON DELETE SET NULL,
    item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
    description text NOT NULL,
    item_type public.catalog_item_type NOT NULL DEFAULT 'producto',
    qty numeric(20,4) NOT NULL DEFAULT 1,
    unit_price numeric(20,4) NOT NULL DEFAULT 0,
    tax_rate numeric(6,3) DEFAULT 19.0 NOT NULL,
    line_total numeric(20,4) NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_po_lines_po_id ON public.purchase_order_lines(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_lines_catalog_item ON public.purchase_order_lines(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_po_lines_item_id ON public.purchase_order_lines(item_id);

-- 4. Gancho para futuro 3-Way Match en facturas de compra
ALTER TABLE public.purchase_invoices
  ADD COLUMN IF NOT EXISTS purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_po_id ON public.purchase_invoices(purchase_order_id);

-- 5. Función create_purchase_order (creación atómica con numeración correlativa OC-)
CREATE OR REPLACE FUNCTION public.create_purchase_order(
  _entity_id uuid,
  _party_id uuid,
  _warehouse_id uuid,
  _cost_center_id uuid,
  _currency_code text,
  _exchange_rate numeric,
  _expected_date date,
  _observaciones text,
  _lines jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_po_id uuid;
  v_po_number text;
  v_line jsonb;
  v_qty numeric(20,4);
  v_price numeric(20,4);
  v_tax_rate numeric(6,3);
  v_subtotal numeric(20,4) := 0;
  v_tax numeric(20,4) := 0;
  v_line_total numeric(20,4);
  v_item_type public.catalog_item_type;
BEGIN
  -- Permisos
  IF NOT (public.user_has_company_access(auth.uid(), _entity_id)
          AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'purchasing'))) THEN
    RAISE EXCEPTION 'Sin permiso para crear órdenes de compra' USING ERRCODE = '42501';
  END IF;

  -- Validar que vengan líneas
  IF _lines IS NULL OR jsonb_array_length(_lines) = 0 THEN
    RAISE EXCEPTION 'La orden de compra debe tener al menos una línea' USING ERRCODE = '22023';
  END IF;

  -- Obtener número atómico con bloqueo FOR UPDATE
  v_po_number := public.get_next_entry_number(_entity_id, 'OC-');

  -- Insertar cabecera
  INSERT INTO public.purchase_orders (
    entity_id, party_id, po_number, status, issue_date, expected_date,
    warehouse_id, cost_center_id, currency_code, exchange_rate, observaciones, created_by
  )
  VALUES (
    _entity_id, _party_id, v_po_number, 'draft', CURRENT_DATE, _expected_date,
    _warehouse_id, _cost_center_id, COALESCE(_currency_code, 'CLP'),
    COALESCE(_exchange_rate, 1.0), _observaciones, auth.uid()
  )
  RETURNING id INTO v_po_id;

  -- Procesar e insertar líneas
  FOR v_line IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    v_qty := (v_line->>'qty')::numeric;
    v_price := (v_line->>'unit_price')::numeric;
    v_tax_rate := COALESCE((v_line->>'tax_rate')::numeric, 19.0);

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'La cantidad en cada línea debe ser mayor a 0' USING ERRCODE = '22023';
    END IF;

    IF v_price IS NULL OR v_price < 0 THEN
      RAISE EXCEPTION 'El precio unitario no puede ser negativo' USING ERRCODE = '22023';
    END IF;

    v_line_total := v_qty * v_price;
    v_subtotal := v_subtotal + v_line_total;
    v_tax := v_tax + (v_line_total * (v_tax_rate / 100));

    -- Evaluar enum item_type
    IF (v_line->>'item_type') = 'servicio' THEN
      v_item_type := 'servicio';
    ELSE
      v_item_type := 'producto';
    END IF;

    INSERT INTO public.purchase_order_lines (
      purchase_order_id,
      catalog_item_id,
      item_id,
      description,
      item_type,
      qty,
      unit_price,
      tax_rate,
      line_total
    )
    VALUES (
      v_po_id,
      NULLIF(v_line->>'catalog_item_id', '')::uuid,
      NULLIF(v_line->>'item_id', '')::uuid,
      COALESCE(NULLIF(TRIM(v_line->>'description'), ''), 'Línea de orden de compra'),
      v_item_type,
      v_qty,
      v_price,
      v_tax_rate,
      v_line_total
    );
  END LOOP;

  -- Actualizar totales en la cabecera
  UPDATE public.purchase_orders
     SET subtotal_amount = v_subtotal,
         tax_amount = v_tax,
         total_amount = v_subtotal + v_tax
   WHERE id = v_po_id;

  RETURN v_po_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_purchase_order(uuid, uuid, uuid, uuid, text, numeric, date, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_purchase_order(uuid, uuid, uuid, uuid, text, numeric, date, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_purchase_order(uuid, uuid, uuid, uuid, text, numeric, date, text, jsonb) TO service_role;

-- 6. RLS en purchase_orders y purchase_order_lines
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;

-- Staff interno: gestión de órdenes de compra de su empresa
DROP POLICY IF EXISTS "staff_manage_purchase_orders" ON public.purchase_orders;
CREATE POLICY "staff_manage_purchase_orders" ON public.purchase_orders FOR ALL TO authenticated
USING (public.user_has_company_access(auth.uid(), entity_id))
WITH CHECK (public.user_has_company_access(auth.uid(), entity_id));

-- Portal proveedor: consulta de sus órdenes de compra emitidas
DROP POLICY IF EXISTS "portal_read_own_purchase_orders" ON public.purchase_orders;
CREATE POLICY "portal_read_own_purchase_orders" ON public.purchase_orders FOR SELECT TO authenticated
USING (public.user_has_party_access(party_id));

-- Staff interno: líneas de órdenes de compra
DROP POLICY IF EXISTS "staff_manage_purchase_order_lines" ON public.purchase_order_lines;
CREATE POLICY "staff_manage_purchase_order_lines" ON public.purchase_order_lines FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.purchase_orders po
  WHERE po.id = purchase_order_id
    AND public.user_has_company_access(auth.uid(), po.entity_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.purchase_orders po
  WHERE po.id = purchase_order_id
    AND public.user_has_company_access(auth.uid(), po.entity_id)
));

-- Portal proveedor: lectura de líneas de sus órdenes
DROP POLICY IF EXISTS "portal_read_own_purchase_order_lines" ON public.purchase_order_lines;
CREATE POLICY "portal_read_own_purchase_order_lines" ON public.purchase_order_lines FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.purchase_orders po
  WHERE po.id = purchase_order_id
    AND public.user_has_party_access(po.party_id)
));
