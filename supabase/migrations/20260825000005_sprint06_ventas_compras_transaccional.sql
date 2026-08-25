-- ============================================================================
-- Sprint 6: Ciclo Transaccional de Ventas y Compras — EasyERP (Norma Chilena)
-- ============================================================================

-- 1. Tabla de Cuentas Contables Predeterminadas por Empresa
CREATE TABLE IF NOT EXISTS public.company_default_accounts (
    entity_id uuid PRIMARY KEY REFERENCES public.entities(id) ON DELETE CASCADE,
    receivable_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
    payable_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
    sales_income_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
    purchase_expense_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
    cogs_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
    inventory_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
    output_tax_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL, -- IVA Débito Fiscal (19%)
    input_tax_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,  -- IVA Crédito Fiscal (19%)
    realized_exchange_gain_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
    realized_exchange_loss_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.company_default_accounts ENABLE ROW LEVEL SECURITY;

-- 2. Enum para estado de facturas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
        CREATE TYPE public.invoice_status AS ENUM ('draft', 'confirmed', 'partially_paid', 'paid', 'cancelled');
    END IF;
END $$;

-- 3. Tablas de Facturación de Venta (Sales Invoices)
CREATE TABLE IF NOT EXISTS public.sales_invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT NOT NULL,
    party_id uuid REFERENCES public.parties(id) ON DELETE RESTRICT NOT NULL,
    warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
    cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
    business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL,
    currency_code text REFERENCES public.currencies(code) NOT NULL DEFAULT 'CLP',
    exchange_rate numeric(20,9) DEFAULT 1.0 NOT NULL,
    invoice_number text,
    issue_date date NOT NULL,
    due_date date,
    subtotal_amount numeric(20,4) DEFAULT 0 NOT NULL,
    tax_amount numeric(20,4) DEFAULT 0 NOT NULL,
    total_amount numeric(20,4) DEFAULT 0 NOT NULL,
    status public.invoice_status NOT NULL DEFAULT 'draft',
    journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    memo text,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_si_entity ON public.sales_invoices(entity_id);
CREATE INDEX IF NOT EXISTS ix_si_party ON public.sales_invoices(party_id);
CREATE INDEX IF NOT EXISTS ix_si_status ON public.sales_invoices(status);

ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.sales_invoice_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_invoice_id uuid REFERENCES public.sales_invoices(id) ON DELETE CASCADE NOT NULL,
    item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
    warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
    description text NOT NULL,
    qty numeric(20,4) NOT NULL DEFAULT 1,
    unit_price numeric(20,4) NOT NULL DEFAULT 0,
    tax_rate numeric(6,3) DEFAULT 19.0 NOT NULL,
    line_total numeric(20,4) NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_sil_invoice ON public.sales_invoice_lines(sales_invoice_id);

ALTER TABLE public.sales_invoice_lines ENABLE ROW LEVEL SECURITY;

-- 4. Tablas de Facturación de Compra (Purchase Invoices)
CREATE TABLE IF NOT EXISTS public.purchase_invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT NOT NULL,
    party_id uuid REFERENCES public.parties(id) ON DELETE RESTRICT NOT NULL,
    warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
    cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
    business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL,
    currency_code text REFERENCES public.currencies(code) NOT NULL DEFAULT 'CLP',
    exchange_rate numeric(20,9) DEFAULT 1.0 NOT NULL,
    invoice_number text,
    issue_date date NOT NULL,
    due_date date,
    subtotal_amount numeric(20,4) DEFAULT 0 NOT NULL,
    tax_amount numeric(20,4) DEFAULT 0 NOT NULL,
    total_amount numeric(20,4) DEFAULT 0 NOT NULL,
    status public.invoice_status NOT NULL DEFAULT 'draft',
    journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    memo text,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_pi_entity ON public.purchase_invoices(entity_id);
CREATE INDEX IF NOT EXISTS ix_pi_party ON public.purchase_invoices(party_id);
CREATE INDEX IF NOT EXISTS ix_pi_status ON public.purchase_invoices(status);

ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.purchase_invoice_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_invoice_id uuid REFERENCES public.purchase_invoices(id) ON DELETE CASCADE NOT NULL,
    item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
    warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
    description text NOT NULL,
    qty numeric(20,4) NOT NULL DEFAULT 1,
    unit_price numeric(20,4) NOT NULL DEFAULT 0,
    tax_rate numeric(6,3) DEFAULT 19.0 NOT NULL,
    line_total numeric(20,4) NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_pil_invoice ON public.purchase_invoice_lines(purchase_invoice_id);

ALTER TABLE public.purchase_invoice_lines ENABLE ROW LEVEL SECURITY;

-- 5. Tabla de Cobranzas y Pagos (Invoice Payments)
CREATE TABLE IF NOT EXISTS public.invoice_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT NOT NULL,
    sales_invoice_id uuid REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
    purchase_invoice_id uuid REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
    amount numeric(20,4) NOT NULL,
    currency_code text REFERENCES public.currencies(code) NOT NULL DEFAULT 'CLP',
    payment_date date NOT NULL,
    bank_account_id uuid REFERENCES public.accounts(id) ON DELETE RESTRICT NOT NULL,
    journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    memo text,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT ck_one_invoice_type CHECK (
      (sales_invoice_id IS NOT NULL AND purchase_invoice_id IS NULL) OR
      (sales_invoice_id IS NULL AND purchase_invoice_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS ix_ip_entity ON public.invoice_payments(entity_id);
CREATE INDEX IF NOT EXISTS ix_ip_si ON public.invoice_payments(sales_invoice_id);
CREATE INDEX IF NOT EXISTS ix_ip_pi ON public.invoice_payments(purchase_invoice_id);

ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

-- 6. Vistas de Saldos y Cuentas por Cobrar / Pagar
CREATE OR REPLACE VIEW public.sales_invoice_balances AS
SELECT 
    si.id, 
    si.entity_id, 
    si.party_id,
    p.name AS party_name,
    p.tax_id AS party_tax_id,
    si.invoice_number,
    si.issue_date,
    si.due_date,
    si.currency_code,
    si.status,
    si.total_amount,
    COALESCE(SUM(ip.amount), 0) AS paid_amount,
    (si.total_amount - COALESCE(SUM(ip.amount), 0)) AS balance_due
FROM public.sales_invoices si
JOIN public.parties p ON p.id = si.party_id
LEFT JOIN public.invoice_payments ip ON ip.sales_invoice_id = si.id
GROUP BY si.id, si.entity_id, si.party_id, p.name, p.tax_id, si.invoice_number, si.issue_date, si.due_date, si.currency_code, si.status, si.total_amount;

CREATE OR REPLACE VIEW public.purchase_invoice_balances AS
SELECT 
    pi.id, 
    pi.entity_id, 
    pi.party_id,
    p.name AS party_name,
    p.tax_id AS party_tax_id,
    pi.invoice_number,
    pi.issue_date,
    pi.due_date,
    pi.currency_code,
    pi.status,
    pi.total_amount,
    COALESCE(SUM(ip.amount), 0) AS paid_amount,
    (pi.total_amount - COALESCE(SUM(ip.amount), 0)) AS balance_due
FROM public.purchase_invoices pi
JOIN public.parties p ON p.id = pi.party_id
LEFT JOIN public.invoice_payments ip ON ip.purchase_invoice_id = pi.id
GROUP BY pi.id, pi.entity_id, pi.party_id, p.name, p.tax_id, pi.invoice_number, pi.issue_date, pi.due_date, pi.currency_code, pi.status, pi.total_amount;

-- 7. Función Transaccional: Postear Factura de Venta
CREATE OR REPLACE FUNCTION public.post_sales_invoice(_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_inv RECORD;
    v_defaults RECORD;
    v_base_curr text;
    v_subtotal numeric(20,4) := 0;
    v_tax numeric(20,4) := 0;
    v_total numeric(20,4) := 0;
    v_line RECORD;
    v_je_id uuid;
    v_je_num text;
    v_line_no int := 1;
    v_item RECORD;
    v_cogs_total numeric(20,4) := 0;
    v_sle_id uuid;
    v_sle_rate numeric(20,4);
BEGIN
    SELECT * INTO v_inv FROM public.sales_invoices WHERE id = _invoice_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Factura de venta no encontrada.';
    END IF;

    IF v_inv.status <> 'draft' THEN
        RAISE EXCEPTION 'Solo se pueden confirmar y postear facturas en estado borrador.';
    END IF;

    -- Obtener cuentas contables predeterminadas
    SELECT * INTO v_defaults FROM public.company_default_accounts WHERE entity_id = v_inv.entity_id;
    IF NOT FOUND OR v_defaults.receivable_account_id IS NULL OR v_defaults.sales_income_account_id IS NULL OR v_defaults.output_tax_account_id IS NULL THEN
        RAISE EXCEPTION 'Configure las cuentas predeterminadas de la empresa (CxC Clientes, Ingreso por Ventas e IVA Débito) en Configuración antes de postear facturas.';
    END IF;

    SELECT base_currency_code INTO v_base_curr FROM public.entities WHERE id = v_inv.entity_id;
    v_base_curr := COALESCE(v_base_curr, 'CLP');

    -- Calcular totales desde líneas
    FOR v_line IN SELECT * FROM public.sales_invoice_lines WHERE sales_invoice_id = _invoice_id LOOP
        v_subtotal := v_subtotal + (v_line.qty * v_line.unit_price);
        v_tax := v_tax + ROUND((v_line.qty * v_line.unit_price) * (v_line.tax_rate / 100.0), 4);
    END LOOP;

    v_total := v_subtotal + v_tax;

    IF v_total <= 0 THEN
        RAISE EXCEPTION 'La factura debe tener al menos una línea con monto mayor a cero.';
    END IF;

    -- Asignar correlativo oficial si no tiene
    IF v_inv.invoice_number IS NULL OR v_inv.invoice_number = '' THEN
        v_inv.invoice_number := public.get_next_entry_number(v_inv.entity_id, 'FVE-');
    END IF;

    -- 1. Crear Cabecera del Comprobante Contable
    INSERT INTO public.journal_entries (
        entity_id,
        posting_date,
        voucher_type,
        memo,
        status,
        created_by
    ) VALUES (
        v_inv.entity_id,
        v_inv.issue_date,
        'Factura de Venta',
        COALESCE(v_inv.memo, 'Factura de Venta ' || v_inv.invoice_number),
        'draft',
        auth.uid()
    ) RETURNING id INTO v_je_id;

    -- 2. Línea Débito: Clientes / CxC por el Total
    INSERT INTO public.journal_entry_lines (
        journal_entry_id,
        line_no,
        account_id,
        party_id,
        cost_center_id,
        business_unit_id,
        currency_code,
        exchange_rate,
        debit_account_currency,
        credit_account_currency,
        debit,
        credit,
        memo
    ) VALUES (
        v_je_id,
        v_line_no,
        v_defaults.receivable_account_id,
        v_inv.party_id,
        v_inv.cost_center_id,
        v_inv.business_unit_id,
        v_inv.currency_code,
        v_inv.exchange_rate,
        v_total,
        0,
        CASE WHEN v_inv.currency_code = v_base_curr THEN v_total ELSE ROUND(v_total * v_inv.exchange_rate) END,
        0,
        'CxC Factura ' || v_inv.invoice_number
    );
    v_line_no := v_line_no + 1;

    -- 3. Línea Crédito: Ingresos por Venta (Subtotal)
    INSERT INTO public.journal_entry_lines (
        journal_entry_id,
        line_no,
        account_id,
        party_id,
        cost_center_id,
        business_unit_id,
        currency_code,
        exchange_rate,
        debit_account_currency,
        credit_account_currency,
        debit,
        credit,
        memo
    ) VALUES (
        v_je_id,
        v_line_no,
        v_defaults.sales_income_account_id,
        v_inv.party_id,
        v_inv.cost_center_id,
        v_inv.business_unit_id,
        v_inv.currency_code,
        v_inv.exchange_rate,
        0,
        v_subtotal,
        0,
        CASE WHEN v_inv.currency_code = v_base_curr THEN v_subtotal ELSE ROUND(v_subtotal * v_inv.exchange_rate) END,
        'Ingreso por Ventas ' || v_inv.invoice_number
    );
    v_line_no := v_line_no + 1;

    -- 4. Línea Crédito: IVA Débito Fiscal (si aplica impuesto)
    IF v_tax > 0 THEN
        INSERT INTO public.journal_entry_lines (
            journal_entry_id,
            line_no,
            account_id,
            party_id,
            cost_center_id,
            business_unit_id,
            currency_code,
            exchange_rate,
            debit_account_currency,
            credit_account_currency,
            debit,
            credit,
            memo
        ) VALUES (
            v_je_id,
            v_line_no,
            v_defaults.output_tax_account_id,
            v_inv.party_id,
            v_inv.cost_center_id,
            v_inv.business_unit_id,
            v_inv.currency_code,
            v_inv.exchange_rate,
            0,
            v_tax,
            0,
            CASE WHEN v_inv.currency_code = v_base_curr THEN v_tax ELSE ROUND(v_tax * v_inv.exchange_rate) END,
            'IVA Débito Fiscal 19% ' || v_inv.invoice_number
        );
        v_line_no := v_line_no + 1;
    END IF;

    -- 5. Movimiento de Inventario y Costo de Venta (FIFO) para artículos de stock
    FOR v_line IN SELECT * FROM public.sales_invoice_lines WHERE sales_invoice_id = _invoice_id LOOP
        IF v_line.item_id IS NOT NULL THEN
            SELECT * INTO v_item FROM public.items WHERE id = v_line.item_id;
            IF v_item.is_stock_item THEN
                IF v_inv.warehouse_id IS NULL AND v_line.warehouse_id IS NULL THEN
                    RAISE EXCEPTION 'La venta de artículos stockables (% - %) requiere especificar una bodega.', v_item.code, v_item.name;
                END IF;

                -- Insertar salida en stock_ledger_entries (trigger calculará valuation_rate FIFO)
                INSERT INTO public.stock_ledger_entries (
                    entity_id,
                    item_id,
                    warehouse_id,
                    movement_type,
                    qty_change,
                    valuation_rate,
                    voucher_type,
                    voucher_id,
                    memo,
                    posting_date,
                    created_by
                ) VALUES (
                    v_inv.entity_id,
                    v_line.item_id,
                    COALESCE(v_line.warehouse_id, v_inv.warehouse_id),
                    'issue',
                    -v_line.qty,
                    0,
                    'Factura de Venta',
                    _invoice_id,
                    'Venta ' || v_inv.invoice_number || ' - ' || v_item.name,
                    v_inv.issue_date,
                    auth.uid()
                ) RETURNING id, valuation_rate INTO v_sle_id, v_sle_rate;

                v_cogs_total := v_cogs_total + (v_line.qty * v_sle_rate);
            END IF;
        END IF;
    END LOOP;

    -- 6. Si hubo salida de inventario, postear par Costo de Ventas / Inventario
    IF v_cogs_total > 0 THEN
        IF v_defaults.cogs_account_id IS NULL OR v_defaults.inventory_account_id IS NULL THEN
            RAISE EXCEPTION 'Configure las cuentas de Costo de Ventas e Inventario para poder facturar artículos de stock.';
        END IF;

        -- Débito Costo de Ventas
        INSERT INTO public.journal_entry_lines (
            journal_entry_id,
            line_no,
            account_id,
            party_id,
            cost_center_id,
            business_unit_id,
            currency_code,
            exchange_rate,
            debit_account_currency,
            credit_account_currency,
            debit,
            credit,
            memo
        ) VALUES (
            v_je_id,
            v_line_no,
            v_defaults.cogs_account_id,
            v_inv.party_id,
            v_inv.cost_center_id,
            v_inv.business_unit_id,
            v_base_curr,
            1.0,
            v_cogs_total,
            0,
            v_cogs_total,
            0,
            'Costo de Venta FIFO Factura ' || v_inv.invoice_number
        );
        v_line_no := v_line_no + 1;

        -- Crédito Inventario
        INSERT INTO public.journal_entry_lines (
            journal_entry_id,
            line_no,
            account_id,
            party_id,
            cost_center_id,
            business_unit_id,
            currency_code,
            exchange_rate,
            debit_account_currency,
            credit_account_currency,
            debit,
            credit,
            memo
        ) VALUES (
            v_je_id,
            v_line_no,
            v_defaults.inventory_account_id,
            v_inv.party_id,
            v_inv.cost_center_id,
            v_inv.business_unit_id,
            v_base_curr,
            1.0,
            0,
            v_cogs_total,
            0,
            v_cogs_total,
            'Descargo de Inventario Factura ' || v_inv.invoice_number
        );
    END IF;

    -- 7. Postear Comprobante Contable oficial
    PERFORM public.post_journal_entry(v_je_id);

    -- 8. Actualizar Factura
    UPDATE public.sales_invoices SET
        invoice_number = v_inv.invoice_number,
        subtotal_amount = v_subtotal,
        tax_amount = v_tax,
        total_amount = v_total,
        status = 'confirmed',
        journal_entry_id = v_je_id
    WHERE id = _invoice_id;

    RETURN json_build_object(
        'success', true,
        'invoice_id', _invoice_id,
        'invoice_number', v_inv.invoice_number,
        'journal_entry_id', v_je_id,
        'total_amount', v_total,
        'cogs_total', v_cogs_total
    )::jsonb;
END;
$$;

-- 8. Función Transaccional: Postear Factura de Compra
CREATE OR REPLACE FUNCTION public.post_purchase_invoice(_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_inv RECORD;
    v_defaults RECORD;
    v_base_curr text;
    v_subtotal numeric(20,4) := 0;
    v_tax numeric(20,4) := 0;
    v_total numeric(20,4) := 0;
    v_line RECORD;
    v_je_id uuid;
    v_line_no int := 1;
    v_item RECORD;
    v_inv_asset_total numeric(20,4) := 0;
    v_expense_total numeric(20,4) := 0;
BEGIN
    SELECT * INTO v_inv FROM public.purchase_invoices WHERE id = _invoice_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Factura de compra no encontrada.';
    END IF;

    IF v_inv.status <> 'draft' THEN
        RAISE EXCEPTION 'Solo se pueden confirmar facturas en estado borrador.';
    END IF;

    -- Obtener cuentas contables predeterminadas
    SELECT * INTO v_defaults FROM public.company_default_accounts WHERE entity_id = v_inv.entity_id;
    IF NOT FOUND OR v_defaults.payable_account_id IS NULL OR v_defaults.input_tax_account_id IS NULL THEN
        RAISE EXCEPTION 'Configure las cuentas predeterminadas de la empresa (CxP Proveedores e IVA Crédito) en Configuración.';
    END IF;

    SELECT base_currency_code INTO v_base_curr FROM public.entities WHERE id = v_inv.entity_id;
    v_base_curr := COALESCE(v_base_curr, 'CLP');

    -- Calcular totales desde líneas
    FOR v_line IN SELECT * FROM public.purchase_invoice_lines WHERE purchase_invoice_id = _invoice_id LOOP
        v_subtotal := v_subtotal + (v_line.qty * v_line.unit_price);
        v_tax := v_tax + ROUND((v_line.qty * v_line.unit_price) * (v_line.tax_rate / 100.0), 4);
    END LOOP;

    v_total := v_subtotal + v_tax;

    IF v_total <= 0 THEN
        RAISE EXCEPTION 'La factura de compra debe tener al menos una línea con monto mayor a cero.';
    END IF;

    IF v_inv.invoice_number IS NULL OR v_inv.invoice_number = '' THEN
        v_inv.invoice_number := public.get_next_entry_number(v_inv.entity_id, 'FCP-');
    END IF;

    -- 1. Crear Cabecera del Comprobante Contable
    INSERT INTO public.journal_entries (
        entity_id,
        posting_date,
        voucher_type,
        memo,
        status,
        created_by
    ) VALUES (
        v_inv.entity_id,
        v_inv.issue_date,
        'Factura de Compra',
        COALESCE(v_inv.memo, 'Factura de Compra ' || v_inv.invoice_number),
        'draft',
        auth.uid()
    ) RETURNING id INTO v_je_id;

    -- 2. Clasificar líneas de compra (Inventario vs Gasto)
    FOR v_line IN SELECT * FROM public.purchase_invoice_lines WHERE purchase_invoice_id = _invoice_id LOOP
        IF v_line.item_id IS NOT NULL THEN
            SELECT * INTO v_item FROM public.items WHERE id = v_line.item_id;
            IF v_item.is_stock_item THEN
                IF v_inv.warehouse_id IS NULL AND v_line.warehouse_id IS NULL THEN
                    RAISE EXCEPTION 'La compra de artículos stockables (% - %) requiere especificar una bodega.', v_item.code, v_item.name;
                END IF;

                -- Entrada en stock_ledger_entries (creará capa FIFO automáticamente)
                INSERT INTO public.stock_ledger_entries (
                    entity_id,
                    item_id,
                    warehouse_id,
                    movement_type,
                    qty_change,
                    valuation_rate,
                    voucher_type,
                    voucher_id,
                    memo,
                    posting_date,
                    created_by
                ) VALUES (
                    v_inv.entity_id,
                    v_line.item_id,
                    COALESCE(v_line.warehouse_id, v_inv.warehouse_id),
                    'receipt',
                    v_line.qty,
                    CASE WHEN v_inv.currency_code = v_base_curr THEN v_line.unit_price ELSE ROUND(v_line.unit_price * v_inv.exchange_rate, 4) END,
                    'Factura de Compra',
                    _invoice_id,
                    'Compra ' || v_inv.invoice_number || ' - ' || v_item.name,
                    v_inv.issue_date,
                    auth.uid()
                );

                v_inv_asset_total := v_inv_asset_total + (v_line.qty * v_line.unit_price);
            ELSE
                v_expense_total := v_expense_total + (v_line.qty * v_line.unit_price);
            END IF;
        ELSE
            v_expense_total := v_expense_total + (v_line.qty * v_line.unit_price);
        END IF;
    END LOOP;

    -- 3. Débito a Inventario (si hubo ítems de stock)
    IF v_inv_asset_total > 0 THEN
        IF v_defaults.inventory_account_id IS NULL THEN
            RAISE EXCEPTION 'Configure la cuenta de Inventario en Configuración para compras de stock.';
        END IF;

        INSERT INTO public.journal_entry_lines (
            journal_entry_id,
            line_no,
            account_id,
            party_id,
            cost_center_id,
            business_unit_id,
            currency_code,
            exchange_rate,
            debit_account_currency,
            credit_account_currency,
            debit,
            credit,
            memo
        ) VALUES (
            v_je_id,
            v_line_no,
            v_defaults.inventory_account_id,
            v_inv.party_id,
            v_inv.cost_center_id,
            v_inv.business_unit_id,
            v_inv.currency_code,
            v_inv.exchange_rate,
            v_inv_asset_total,
            0,
            CASE WHEN v_inv.currency_code = v_base_curr THEN v_inv_asset_total ELSE ROUND(v_inv_asset_total * v_inv.exchange_rate) END,
            0,
            'Ingreso de Inventario Factura ' || v_inv.invoice_number
        );
        v_line_no := v_line_no + 1;
    END IF;

    -- 4. Débito a Gastos / Costos (si hubo compras de servicios o consumibles)
    IF v_expense_total > 0 THEN
        IF v_defaults.purchase_expense_account_id IS NULL THEN
            RAISE EXCEPTION 'Configure la cuenta de Gastos de Compras en Configuración.';
        END IF;

        INSERT INTO public.journal_entry_lines (
            journal_entry_id,
            line_no,
            account_id,
            party_id,
            cost_center_id,
            business_unit_id,
            currency_code,
            exchange_rate,
            debit_account_currency,
            credit_account_currency,
            debit,
            credit,
            memo
        ) VALUES (
            v_je_id,
            v_line_no,
            v_defaults.purchase_expense_account_id,
            v_inv.party_id,
            v_inv.cost_center_id,
            v_inv.business_unit_id,
            v_inv.currency_code,
            v_inv.exchange_rate,
            v_expense_total,
            0,
            CASE WHEN v_inv.currency_code = v_base_curr THEN v_expense_total ELSE ROUND(v_expense_total * v_inv.exchange_rate) END,
            0,
            'Gasto de Compra Factura ' || v_inv.invoice_number
        );
        v_line_no := v_line_no + 1;
    END IF;

    -- 5. Débito a IVA Crédito Fiscal 19%
    IF v_tax > 0 THEN
        INSERT INTO public.journal_entry_lines (
            journal_entry_id,
            line_no,
            account_id,
            party_id,
            cost_center_id,
            business_unit_id,
            currency_code,
            exchange_rate,
            debit_account_currency,
            credit_account_currency,
            debit,
            credit,
            memo
        ) VALUES (
            v_je_id,
            v_line_no,
            v_defaults.input_tax_account_id,
            v_inv.party_id,
            v_inv.cost_center_id,
            v_inv.business_unit_id,
            v_inv.currency_code,
            v_inv.exchange_rate,
            v_tax,
            0,
            CASE WHEN v_inv.currency_code = v_base_curr THEN v_tax ELSE ROUND(v_tax * v_inv.exchange_rate) END,
            0,
            'IVA Crédito Fiscal 19% Factura ' || v_inv.invoice_number
        );
        v_line_no := v_line_no + 1;
    END IF;

    -- 6. Crédito a Proveedores / CxP por el Total
    INSERT INTO public.journal_entry_lines (
        journal_entry_id,
        line_no,
        account_id,
        party_id,
        cost_center_id,
        business_unit_id,
        currency_code,
        exchange_rate,
        debit_account_currency,
        credit_account_currency,
        debit,
        credit,
        memo
    ) VALUES (
        v_je_id,
        v_line_no,
        v_defaults.payable_account_id,
        v_inv.party_id,
        v_inv.cost_center_id,
        v_inv.business_unit_id,
        v_inv.currency_code,
        v_inv.exchange_rate,
        0,
        v_total,
        0,
        CASE WHEN v_inv.currency_code = v_base_curr THEN v_total ELSE ROUND(v_total * v_inv.exchange_rate) END,
        'CxP Factura Proveedor ' || v_inv.invoice_number
    );

    -- 7. Postear Comprobante
    PERFORM public.post_journal_entry(v_je_id);

    -- 8. Actualizar Factura
    UPDATE public.purchase_invoices SET
        invoice_number = v_inv.invoice_number,
        subtotal_amount = v_subtotal,
        tax_amount = v_tax,
        total_amount = v_total,
        status = 'confirmed',
        journal_entry_id = v_je_id
    WHERE id = _invoice_id;

    RETURN json_build_object(
        'success', true,
        'invoice_id', _invoice_id,
        'invoice_number', v_inv.invoice_number,
        'journal_entry_id', v_je_id,
        'total_amount', v_total
    )::jsonb;
END;
$$;

-- 9. Políticas RLS
CREATE POLICY "read_company_default_accounts" ON public.company_default_accounts
FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_company_default_accounts" ON public.company_default_accounts
FOR ALL TO authenticated USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

CREATE POLICY "read_sales_invoices" ON public.sales_invoices
FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_sales_invoices" ON public.sales_invoices
FOR ALL TO authenticated USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

CREATE POLICY "read_sales_invoice_lines" ON public.sales_invoice_lines
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.sales_invoices s WHERE s.id = sales_invoice_id AND public.user_has_company_access(auth.uid(), s.entity_id))
);

CREATE POLICY "write_sales_invoice_lines" ON public.sales_invoice_lines
FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.sales_invoices s 
    WHERE s.id = sales_invoice_id 
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'accountant'))
    AND public.user_has_company_access(auth.uid(), s.entity_id)
  )
);

CREATE POLICY "read_purchase_invoices" ON public.purchase_invoices
FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_purchase_invoices" ON public.purchase_invoices
FOR ALL TO authenticated USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'purchasing') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

CREATE POLICY "read_purchase_invoice_lines" ON public.purchase_invoice_lines
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.purchase_invoices p WHERE p.id = purchase_invoice_id AND public.user_has_company_access(auth.uid(), p.entity_id))
);

CREATE POLICY "write_purchase_invoice_lines" ON public.purchase_invoice_lines
FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.purchase_invoices p 
    WHERE p.id = purchase_invoice_id 
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'purchasing') OR public.has_role(auth.uid(), 'accountant'))
    AND public.user_has_company_access(auth.uid(), p.entity_id)
  )
);

CREATE POLICY "read_invoice_payments" ON public.invoice_payments
FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_invoice_payments" ON public.invoice_payments
FOR ALL TO authenticated USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);
