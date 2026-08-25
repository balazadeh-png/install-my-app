-- ============================================================================
-- Sprint 10: Módulo de Ventas POS (Punto de Venta) y Arqueo de Caja — EasyERP
-- ============================================================================

-- 1. Enums para Estado de Turno de Caja y Medios de Pago
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pos_session_status') THEN
        CREATE TYPE public.pos_session_status AS ENUM ('open', 'closed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pos_payment_method') THEN
        CREATE TYPE public.pos_payment_method AS ENUM ('efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia', 'otro');
    END IF;
END $$;

-- 2. Tabla pos_sessions (Turnos y Arqueos de Caja)
CREATE TABLE IF NOT EXISTS public.pos_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT NOT NULL,
    warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE RESTRICT NOT NULL,
    business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL,
    opened_by uuid REFERENCES auth.users(id) NOT NULL,
    opening_amount numeric(20,4) NOT NULL DEFAULT 0,
    opened_at timestamptz DEFAULT now() NOT NULL,
    closing_amount numeric(20,4),
    closed_at timestamptz,
    expected_amount numeric(20,4),
    cash_difference numeric(20,4),
    status public.pos_session_status DEFAULT 'open' NOT NULL,
    notes text
);

CREATE INDEX IF NOT EXISTS ix_pos_sess_entity ON public.pos_sessions(entity_id);
CREATE INDEX IF NOT EXISTS ix_pos_sess_status ON public.pos_sessions(status);
CREATE INDEX IF NOT EXISTS ix_pos_sess_user ON public.pos_sessions(opened_by);

ALTER TABLE public.pos_sessions ENABLE ROW LEVEL SECURITY;

-- 3. Vincular Facturas / Boletas de Venta a la Sesión POS
ALTER TABLE public.sales_invoices 
  ADD COLUMN IF NOT EXISTS pos_session_id uuid REFERENCES public.pos_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_si_pos_sess ON public.sales_invoices(pos_session_id);

-- 4. Tabla pos_sale_payment_lines (Medios de Pago Mixtos por Venta)
CREATE TABLE IF NOT EXISTS public.pos_sale_payment_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_invoice_id uuid REFERENCES public.sales_invoices(id) ON DELETE CASCADE NOT NULL,
    payment_method public.pos_payment_method NOT NULL,
    amount numeric(20,4) NOT NULL,
    reference_number text,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_pos_pay_si ON public.pos_sale_payment_lines(sales_invoice_id);

ALTER TABLE public.pos_sale_payment_lines ENABLE ROW LEVEL SECURITY;

-- 5. Función Transaccional: Cerrar Turno de Caja (Arqueo)
CREATE OR REPLACE FUNCTION public.close_pos_session(
    _session_id uuid,
    _counted_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_session RECORD;
    v_total_cash numeric(20,4) := 0;
    v_total_cards numeric(20,4) := 0;
    v_total_transfers numeric(20,4) := 0;
    v_total_other numeric(20,4) := 0;
    v_total_sales numeric(20,4) := 0;
    v_expected numeric(20,4) := 0;
    v_diff numeric(20,4) := 0;
    v_sales_count int := 0;
BEGIN
    SELECT * INTO v_session FROM public.pos_sessions WHERE id = _session_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sesión de caja no encontrada.';
    END IF;

    IF v_session.status = 'closed' THEN
        RAISE EXCEPTION 'La sesión de caja ya fue cerrada previamente.';
    END IF;

    -- Calcular totales por medio de pago
    SELECT 
        COALESCE(SUM(CASE WHEN pl.payment_method = 'efectivo' THEN pl.amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN pl.payment_method IN ('tarjeta_debito', 'tarjeta_credito') THEN pl.amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN pl.payment_method = 'transferencia' THEN pl.amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN pl.payment_method = 'otro' THEN pl.amount ELSE 0 END), 0),
        COALESCE(SUM(pl.amount), 0),
        COUNT(DISTINCT si.id)
    INTO v_total_cash, v_total_cards, v_total_transfers, v_total_other, v_total_sales, v_sales_count
    FROM public.sales_invoices si
    JOIN public.pos_sale_payment_lines pl ON pl.sales_invoice_id = si.id
    WHERE si.pos_session_id = _session_id
      AND si.status = 'posted';

    -- Efectivo esperado en gaveta = Apertura + Ventas en efectivo
    v_expected := v_session.opening_amount + v_total_cash;
    v_diff := _counted_amount - v_expected;

    UPDATE public.pos_sessions SET
        closing_amount = _counted_amount,
        expected_amount = v_expected,
        cash_difference = v_diff,
        closed_at = now(),
        status = 'closed'
    WHERE id = _session_id;

    RETURN json_build_object(
        'success', true,
        'session_id', _session_id,
        'opening_amount', v_session.opening_amount,
        'total_cash_sales', v_total_cash,
        'total_card_sales', v_total_cards,
        'total_transfer_sales', v_total_transfers,
        'total_sales', v_total_sales,
        'sales_count', v_sales_count,
        'expected_cash', v_expected,
        'counted_cash', _counted_amount,
        'cash_difference', v_diff
    )::jsonb;
END;
$$;

-- 6. Función Transaccional: Registrar Venta POS Completa
CREATE OR REPLACE FUNCTION public.create_pos_sale(
    _session_id uuid,
    _party_id uuid,
    _items jsonb, -- Array de { item_id, quantity, unit_price, is_exempt }
    _payments jsonb -- Array de { payment_method, amount, reference_number }
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_session RECORD;
    v_defaults RECORD;
    v_base_curr text;
    v_invoice_id uuid;
    v_invoice_number text;
    v_subtotal numeric(20,4) := 0;
    v_tax numeric(20,4) := 0;
    v_total numeric(20,4) := 0;
    v_payments_total numeric(20,4) := 0;
    v_item RECORD;
    v_pay RECORD;
    v_line_no int := 1;
    v_line_subtotal numeric(20,4);
    v_line_tax numeric(20,4);
    v_line_total numeric(20,4);
    v_post_res jsonb;
BEGIN
    SELECT * INTO v_session FROM public.pos_sessions WHERE id = _session_id;
    IF NOT FOUND OR v_session.status <> 'open' THEN
        RAISE EXCEPTION 'Se requiere una sesión de caja abierta para registrar ventas POS.';
    END IF;

    SELECT base_currency_code INTO v_base_curr FROM public.entities WHERE id = v_session.entity_id;
    v_base_curr := COALESCE(v_base_curr, 'CLP');

    -- Validar cuentas por defecto
    SELECT * INTO v_defaults FROM public.company_default_accounts WHERE entity_id = v_session.entity_id;
    IF NOT FOUND OR v_defaults.receivable_account_id IS NULL OR v_defaults.sales_income_account_id IS NULL OR v_defaults.output_tax_account_id IS NULL THEN
        RAISE EXCEPTION 'Configure las Cuentas Predeterminadas de Ventas e IVA en Configuración antes de operar el POS.';
    END IF;

    -- Calcular totales de los productos
    FOR v_item IN SELECT * FROM jsonb_to_recordset(_items) AS x(
        item_id uuid,
        quantity numeric,
        unit_price numeric,
        is_exempt boolean
    ) LOOP
        v_line_subtotal := ROUND(v_item.quantity * v_item.unit_price, 4);
        IF COALESCE(v_item.is_exempt, false) THEN
            v_line_tax := 0;
        ELSE
            v_line_tax := ROUND(v_line_subtotal * 0.19, 4);
        END IF;
        v_line_total := v_line_subtotal + v_line_tax;

        v_subtotal := v_subtotal + v_line_subtotal;
        v_tax := v_tax + v_line_tax;
        v_total := v_total + v_line_total;
    END LOOP;

    -- Validar que la suma de medios de pago coincida con el total
    FOR v_pay IN SELECT * FROM jsonb_to_recordset(_payments) AS p(
        payment_method public.pos_payment_method,
        amount numeric,
        reference_number text
    ) LOOP
        v_payments_total := v_payments_total + v_pay.amount;
    END LOOP;

    IF ABS(v_payments_total - v_total) > 0.01 THEN
        RAISE EXCEPTION 'El total de los medios de pago ($%) no coincide con el total de la venta ($%).', v_payments_total, v_total;
    END IF;

    -- Generar número correlativo de boleta
    v_invoice_number := public.get_next_entry_number(v_session.entity_id, 'BOL-');

    -- 1. Crear cabecera de la factura/boleta
    INSERT INTO public.sales_invoices (
        entity_id,
        party_id,
        warehouse_id,
        business_unit_id,
        pos_session_id,
        invoice_number,
        issue_date,
        due_date,
        currency_code,
        exchange_rate,
        subtotal,
        tax_amount,
        total_amount,
        receivable_account_id,
        sales_income_account_id,
        output_tax_account_id,
        status,
        created_by
    ) VALUES (
        v_session.entity_id,
        _party_id,
        v_session.warehouse_id,
        v_session.business_unit_id,
        _session_id,
        v_invoice_number,
        CURRENT_DATE,
        CURRENT_DATE,
        v_base_curr,
        1.0,
        v_subtotal,
        v_tax,
        v_total,
        v_defaults.receivable_account_id,
        v_defaults.sales_income_account_id,
        v_defaults.output_tax_account_id,
        'draft',
        auth.uid()
    ) RETURNING id INTO v_invoice_id;

    -- 2. Insertar líneas de la boleta
    FOR v_item IN SELECT * FROM jsonb_to_recordset(_items) AS x(
        item_id uuid,
        quantity numeric,
        unit_price numeric,
        is_exempt boolean
    ) LOOP
        v_line_subtotal := ROUND(v_item.quantity * v_item.unit_price, 4);
        IF COALESCE(v_item.is_exempt, false) THEN
            v_line_tax := 0;
        ELSE
            v_line_tax := ROUND(v_line_subtotal * 0.19, 4);
        END IF;
        v_line_total := v_line_subtotal + v_line_tax;

        INSERT INTO public.sales_invoice_lines (
            sales_invoice_id,
            line_no,
            item_id,
            description,
            quantity,
            unit_price,
            discount_percent,
            tax_rate,
            subtotal,
            tax_amount,
            total_amount
        ) VALUES (
            v_invoice_id,
            v_line_no,
            v_item.item_id,
            'Venta POS',
            v_item.quantity,
            v_item.unit_price,
            0,
            CASE WHEN COALESCE(v_item.is_exempt, false) THEN 0 ELSE 19.0 END,
            v_line_subtotal,
            v_line_tax,
            v_line_total
        );
        v_line_no := v_line_no + 1;
    END LOOP;

    -- 3. Insertar medios de pago
    FOR v_pay IN SELECT * FROM jsonb_to_recordset(_payments) AS p(
        payment_method public.pos_payment_method,
        amount numeric,
        reference_number text
    ) LOOP
        INSERT INTO public.pos_sale_payment_lines (
            sales_invoice_id,
            payment_method,
            amount,
            reference_number
        ) VALUES (
            v_invoice_id,
            v_pay.payment_method,
            v_pay.amount,
            v_pay.reference_number
        );
    END LOOP;

    -- 4. Postear la factura/boleta automáticamente (descuenta inventario FIFO y genera comprobante al mayor)
    v_post_res := public.post_sales_invoice(v_invoice_id);

    RETURN json_build_object(
        'success', true,
        'sales_invoice_id', v_invoice_id,
        'invoice_number', v_invoice_number,
        'total', v_total
    )::jsonb;
END;
$$;

-- 7. Políticas RLS
CREATE POLICY "read_pos_sessions" ON public.pos_sessions
FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_pos_sessions" ON public.pos_sessions
FOR ALL TO authenticated USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

CREATE POLICY "read_pos_sale_payment_lines" ON public.pos_sale_payment_lines
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.sales_invoices si 
    WHERE si.id = sales_invoice_id 
    AND public.user_has_company_access(auth.uid(), si.entity_id)
  )
);

CREATE POLICY "write_pos_sale_payment_lines" ON public.pos_sale_payment_lines
FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.sales_invoices si 
    WHERE si.id = sales_invoice_id 
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'accountant'))
    AND public.user_has_company_access(auth.uid(), si.entity_id)
  )
);

-- 8. Registrar Módulo en la tabla modules
INSERT INTO public.modules (name, label)
VALUES ('pos', 'Punto de Venta (POS)')
ON CONFLICT (name) DO UPDATE SET label = 'Punto de Venta (POS)', active = true;
