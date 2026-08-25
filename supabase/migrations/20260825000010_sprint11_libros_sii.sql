-- ============================================================================
-- Sprint 11: Libros Legales SII & Conciliación con Registro Compras y Ventas (RCV)
-- ============================================================================

-- 1. Enums para Libros Oficiales del SII
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sii_book_type') THEN
        CREATE TYPE public.sii_book_type AS ENUM (
            'libro_diario',
            'libro_mayor',
            'balance_tributario_8_columnas',
            'libro_compras',
            'libro_ventas'
        );
    END IF;
END $$;

-- 2. Tabla sii_book_exports (Historial de Exportaciones Legales Generadas)
CREATE TABLE IF NOT EXISTS public.sii_book_exports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT NOT NULL,
    book_type public.sii_book_type NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    file_format text NOT NULL DEFAULT 'csv',
    file_content text,
    record_count integer DEFAULT 0 NOT NULL,
    total_debit numeric(20,4) DEFAULT 0 NOT NULL,
    total_credit numeric(20,4) DEFAULT 0 NOT NULL,
    generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    generated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_sii_exp_entity ON public.sii_book_exports(entity_id);
CREATE INDEX IF NOT EXISTS ix_sii_exp_type ON public.sii_book_exports(book_type);

ALTER TABLE public.sii_book_exports ENABLE ROW LEVEL SECURITY;

-- 3. Tabla rcv_reconciliation_runs (Cabecera de Conciliación RCV)
CREATE TABLE IF NOT EXISTS public.rcv_reconciliation_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    file_name text,
    total_items integer DEFAULT 0 NOT NULL,
    matched_items integer DEFAULT 0 NOT NULL,
    unmatched_items integer DEFAULT 0 NOT NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_rcv_run_entity ON public.rcv_reconciliation_runs(entity_id);

ALTER TABLE public.rcv_reconciliation_runs ENABLE ROW LEVEL SECURITY;

-- 4. Tabla rcv_reconciliation_items (Detalle Línea por Línea de Conciliación)
CREATE TABLE IF NOT EXISTS public.rcv_reconciliation_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rcv_reconciliation_run_id uuid REFERENCES public.rcv_reconciliation_runs(id) ON DELETE CASCADE NOT NULL,
    operation_type text NOT NULL, -- 'VENTA' o 'COMPRA'
    document_type text NOT NULL, -- '33 Factura', '34 Exenta', '39 Boleta', etc.
    document_number text NOT NULL,
    party_tax_id text NOT NULL, -- RUT contraparte
    party_name text,
    issue_date date,
    amount_in_easyerp numeric(20,4),
    amount_in_rcv numeric(20,4),
    difference numeric(20,4),
    matched boolean DEFAULT false NOT NULL,
    status text DEFAULT 'matched' NOT NULL -- 'matched', 'amount_mismatch', 'missing_in_easyerp', 'missing_in_rcv'
);

CREATE INDEX IF NOT EXISTS ix_rcv_item_run ON public.rcv_reconciliation_items(rcv_reconciliation_run_id);

ALTER TABLE public.rcv_reconciliation_items ENABLE ROW LEVEL SECURITY;

-- 5. Función para Generar Datos de Libros Contables SII
CREATE OR REPLACE FUNCTION public.get_sii_book_data(
    _entity_id uuid,
    _book_type public.sii_book_type,
    _start_date date,
    _end_date date
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_result jsonb;
BEGIN
    IF _book_type = 'libro_diario' THEN
        SELECT json_agg(t) INTO v_result
        FROM (
            SELECT 
                j.posting_date,
                j.entry_number,
                j.voucher_type,
                j.memo AS header_memo,
                l.line_no,
                a.code AS account_code,
                a.name AS account_name,
                l.debit,
                l.credit,
                l.currency_code,
                l.exchange_rate,
                cc.name AS cost_center_name,
                bu.name AS business_unit_name,
                l.memo AS line_memo
            FROM public.journal_entries j
            JOIN public.journal_entry_lines l ON l.journal_entry_id = j.id
            JOIN public.accounts a ON a.id = l.account_id
            LEFT JOIN public.cost_centers cc ON cc.id = l.cost_center_id
            LEFT JOIN public.business_units bu ON bu.id = l.business_unit_id
            WHERE j.entity_id = _entity_id
              AND j.status = 'posted'
              AND j.posting_date >= _start_date
              AND j.posting_date <= _end_date
            ORDER BY j.posting_date ASC, j.entry_number ASC, l.line_no ASC
        ) t;

    ELSIF _book_type = 'libro_mayor' THEN
        SELECT json_agg(t) INTO v_result
        FROM (
            SELECT 
                a.code AS account_code,
                a.name AS account_name,
                a.account_type,
                j.posting_date,
                j.entry_number,
                j.voucher_type,
                COALESCE(l.memo, j.memo) AS description,
                l.debit,
                l.credit
            FROM public.journal_entries j
            JOIN public.journal_entry_lines l ON l.journal_entry_id = j.id
            JOIN public.accounts a ON a.id = l.account_id
            WHERE j.entity_id = _entity_id
              AND j.status = 'posted'
              AND j.posting_date >= _start_date
              AND j.posting_date <= _end_date
            ORDER BY a.code ASC, j.posting_date ASC, j.entry_number ASC
        ) t;

    ELSIF _book_type = 'balance_tributario_8_columnas' THEN
        SELECT json_agg(t) INTO v_result
        FROM (
            WITH raw_balances AS (
                SELECT 
                    a.id AS account_id,
                    a.code AS account_code,
                    a.name AS account_name,
                    a.account_type,
                    COALESCE(SUM(l.debit), 0) AS total_debit,
                    COALESCE(SUM(l.credit), 0) AS total_credit
                FROM public.accounts a
                LEFT JOIN public.journal_entry_lines l ON l.account_id = a.id
                LEFT JOIN public.journal_entries j ON j.id = l.journal_entry_id 
                     AND j.status = 'posted' 
                     AND j.posting_date >= _start_date 
                     AND j.posting_date <= _end_date
                WHERE a.entity_id = _entity_id
                  AND a.is_group = false
                GROUP BY a.id, a.code, a.name, a.account_type
                HAVING COALESCE(SUM(l.debit), 0) > 0 OR COALESCE(SUM(l.credit), 0) > 0
            )
            SELECT 
                account_code,
                account_name,
                account_type,
                -- 1 & 2: Sumas del Mayor
                total_debit,
                total_credit,
                -- 3 & 4: Saldos (Deudor / Acreedor)
                CASE WHEN total_debit >= total_credit THEN (total_debit - total_credit) ELSE 0 END AS saldo_deudor,
                CASE WHEN total_credit > total_debit THEN (total_credit - total_debit) ELSE 0 END AS saldo_acreedor,
                -- 5 & 6: Inventario (Activo / Pasivo)
                CASE WHEN account_type = 'Asset' THEN (total_debit - total_credit) ELSE 0 END AS inventario_activo,
                CASE WHEN account_type IN ('Liability', 'Equity') THEN (total_credit - total_debit) ELSE 0 END AS inventario_pasivo,
                -- 7 & 8: Resultados (Pérdida / Ganancia)
                CASE WHEN account_type IN ('Expense', 'Cost of Goods Sold') THEN (total_debit - total_credit) ELSE 0 END AS resultado_perdida,
                CASE WHEN account_type = 'Income' THEN (total_credit - total_debit) ELSE 0 END AS resultado_ganancia
            FROM raw_balances
            ORDER BY account_code ASC
        ) t;

    ELSIF _book_type = 'libro_ventas' THEN
        SELECT json_agg(t) INTO v_result
        FROM (
            SELECT 
                si.issue_date,
                si.invoice_number,
                '33 Factura Electrónica' AS doc_type_name,
                p.tax_id AS customer_rut,
                p.name AS customer_name,
                si.subtotal AS monto_neto,
                0 AS monto_exento,
                si.tax_amount AS iva_debito_19,
                si.total_amount AS monto_total,
                si.status
            FROM public.sales_invoices si
            JOIN public.parties p ON p.id = si.party_id
            WHERE si.entity_id = _entity_id
              AND si.status = 'posted'
              AND si.issue_date >= _start_date
              AND si.issue_date <= _end_date
            ORDER BY si.issue_date ASC, si.invoice_number ASC
        ) t;

    ELSIF _book_type = 'libro_compras' THEN
        SELECT json_agg(t) INTO v_result
        FROM (
            SELECT 
                pi.issue_date,
                pi.invoice_number,
                '33 Factura Electrónica Proveedor' AS doc_type_name,
                p.tax_id AS supplier_rut,
                p.name AS supplier_name,
                pi.subtotal AS monto_neto,
                0 AS monto_exento,
                pi.tax_amount AS iva_credito_19,
                pi.total_amount AS monto_total,
                pi.status
            FROM public.purchase_invoices pi
            JOIN public.parties p ON p.id = pi.party_id
            WHERE pi.entity_id = _entity_id
              AND pi.status = 'posted'
              AND pi.issue_date >= _start_date
              AND pi.issue_date <= _end_date
            ORDER BY pi.issue_date ASC, pi.invoice_number ASC
        ) t;
    END IF;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 6. Función Transaccional: Conciliación de RCV
CREATE OR REPLACE FUNCTION public.reconcile_rcv_batch(
    _entity_id uuid,
    _period_start date,
    _period_end date,
    _file_name text,
    _rcv_rows jsonb -- Array de { operation_type, doc_type, doc_number, rut, name, total_amount, date }
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_run_id uuid;
    v_row RECORD;
    v_erp_amount numeric(20,4);
    v_erp_found boolean;
    v_diff numeric(20,4);
    v_status text;
    v_matched boolean;
    v_matched_count int := 0;
    v_unmatched_count int := 0;
    v_total_count int := 0;
BEGIN
    -- 1. Crear cabecera de corrida de conciliación
    INSERT INTO public.rcv_reconciliation_runs (
        entity_id,
        period_start,
        period_end,
        file_name,
        created_by
    ) VALUES (
        _entity_id,
        _period_start,
        _period_end,
        _file_name,
        auth.uid()
    ) RETURNING id INTO v_run_id;

    -- 2. Procesar cada fila del archivo RCV
    FOR v_row IN SELECT * FROM jsonb_to_recordset(_rcv_rows) AS x(
        operation_type text,
        doc_type text,
        doc_number text,
        rut text,
        name text,
        total_amount numeric,
        issue_date date
    ) LOOP
        v_total_count := v_total_count + 1;
        v_erp_amount := NULL;
        v_erp_found := false;

        IF UPPER(v_row.operation_type) = 'VENTA' THEN
            SELECT si.total_amount INTO v_erp_amount
            FROM public.sales_invoices si
            JOIN public.parties p ON p.id = si.party_id
            WHERE si.entity_id = _entity_id
              AND (si.invoice_number ILIKE '%' || v_row.doc_number OR v_row.doc_number ILIKE '%' || si.invoice_number)
              AND REPLACE(REPLACE(p.tax_id, '.', ''), '-', '') = REPLACE(REPLACE(v_row.rut, '.', ''), '-', '')
            LIMIT 1;
        ELSE
            SELECT pi.total_amount INTO v_erp_amount
            FROM public.purchase_invoices pi
            JOIN public.parties p ON p.id = pi.party_id
            WHERE pi.entity_id = _entity_id
              AND (pi.invoice_number ILIKE '%' || v_row.doc_number OR v_row.doc_number ILIKE '%' || pi.invoice_number)
              AND REPLACE(REPLACE(p.tax_id, '.', ''), '-', '') = REPLACE(REPLACE(v_row.rut, '.', ''), '-', '')
            LIMIT 1;
        END IF;

        IF v_erp_amount IS NOT NULL THEN
            v_erp_found := true;
            v_diff := v_erp_amount - v_row.total_amount;
            IF ABS(v_diff) < 0.01 THEN
                v_matched := true;
                v_status := 'matched';
                v_matched_count := v_matched_count + 1;
            ELSE
                v_matched := false;
                v_status := 'amount_mismatch';
                v_unmatched_count := v_unmatched_count + 1;
            END IF;
        ELSE
            v_matched := false;
            v_status := 'missing_in_easyerp';
            v_diff := -v_row.total_amount;
            v_unmatched_count := v_unmatched_count + 1;
        END IF;

        INSERT INTO public.rcv_reconciliation_items (
            rcv_reconciliation_run_id,
            operation_type,
            document_type,
            document_number,
            party_tax_id,
            party_name,
            issue_date,
            amount_in_easyerp,
            amount_in_rcv,
            difference,
            matched,
            status
        ) VALUES (
            v_run_id,
            UPPER(v_row.operation_type),
            v_row.doc_type,
            v_row.doc_number,
            v_row.rut,
            v_row.name,
            v_row.issue_date,
            v_erp_amount,
            v_row.total_amount,
            v_diff,
            v_matched,
            v_status
        );
    END LOOP;

    -- 3. Actualizar contadores en la cabecera
    UPDATE public.rcv_reconciliation_runs SET
        total_items = v_total_count,
        matched_items = v_matched_count,
        unmatched_items = v_unmatched_count
    WHERE id = v_run_id;

    RETURN json_build_object(
        'success', true,
        'run_id', v_run_id,
        'total_items', v_total_count,
        'matched_items', v_matched_count,
        'unmatched_items', v_unmatched_count
    )::jsonb;
END;
$$;

-- 7. Políticas RLS
CREATE POLICY "read_sii_book_exports" ON public.sii_book_exports
FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_sii_book_exports" ON public.sii_book_exports
FOR ALL TO authenticated USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

CREATE POLICY "read_rcv_reconciliation_runs" ON public.rcv_reconciliation_runs
FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_rcv_reconciliation_runs" ON public.rcv_reconciliation_runs
FOR ALL TO authenticated USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

CREATE POLICY "read_rcv_reconciliation_items" ON public.rcv_reconciliation_items
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.rcv_reconciliation_runs r 
    WHERE r.id = rcv_reconciliation_run_id 
    AND public.user_has_company_access(auth.uid(), r.entity_id)
  )
);

CREATE POLICY "write_rcv_reconciliation_items" ON public.rcv_reconciliation_items
FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.rcv_reconciliation_runs r 
    WHERE r.id = rcv_reconciliation_run_id 
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
    AND public.user_has_company_access(auth.uid(), r.entity_id)
  )
);

-- 8. Registrar Módulo en la tabla modules
INSERT INTO public.modules (name, label)
VALUES ('sii_books', 'Libros Legales SII')
ON CONFLICT (name) DO UPDATE SET label = 'Libros Legales SII', active = true;
