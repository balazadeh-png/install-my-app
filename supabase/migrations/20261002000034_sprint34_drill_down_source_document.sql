-- ============================================================================
-- Sprint 34: Trazabilidad y Drill-down de Documento Origen para Asientos Contables
-- EasyERP
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_journal_entry_source_document(
    _journal_entry_id uuid,
    _entity_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_je record;
    v_lines jsonb;
    v_si record;
    v_si_lines jsonb;
    v_pi record;
    v_pi_lines jsonb;
    v_pay record;
    v_fade record;
    v_res jsonb;
BEGIN
    -- 1. Obtener la cabecera del asiento contable
    SELECT 
        j.id,
        j.entity_id,
        j.entry_number,
        j.posting_date,
        j.voucher_type,
        j.memo,
        j.status,
        j.reversal_of,
        j.created_at,
        b.name AS book_name
    INTO v_je
    FROM public.journal_entries j
    LEFT JOIN public.books b ON b.id = j.book_id
    WHERE j.id = _journal_entry_id
      AND j.entity_id = _entity_id;

    IF v_je.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Comprobante no encontrado');
    END IF;

    -- Obtener las líneas del comprobante
    SELECT json_agg(l_row) INTO v_lines
    FROM (
        SELECT 
            l.id,
            l.line_no,
            l.account_id,
            a.code AS account_code,
            a.name AS account_name,
            l.party_id,
            p.name AS party_name,
            p.tax_id AS party_tax_id,
            l.cost_center_id,
            cc.name AS cost_center_name,
            cc.code AS cost_center_code,
            l.business_unit_id,
            bu.name AS business_unit_name,
            bu.code AS business_unit_code,
            l.currency_code,
            l.exchange_rate,
            l.debit,
            l.credit,
            l.memo
        FROM public.journal_entry_lines l
        JOIN public.accounts a ON a.id = l.account_id
        LEFT JOIN public.parties p ON p.id = l.party_id
        LEFT JOIN public.cost_centers cc ON cc.id = l.cost_center_id
        LEFT JOIN public.business_units bu ON bu.id = l.business_unit_id
        WHERE l.journal_entry_id = _journal_entry_id
        ORDER BY l.line_no ASC
    ) l_row;

    -- 2. Verificar si proviene de una Factura de Venta
    SELECT 
        si.id,
        si.invoice_number,
        si.issue_date,
        si.due_date,
        si.subtotal_amount,
        si.tax_amount,
        si.total_amount,
        si.currency_code,
        si.status,
        si.memo,
        p.name AS customer_name,
        p.tax_id AS customer_tax_id,
        w.name AS warehouse_name,
        cc.name AS cost_center_name
    INTO v_si
    FROM public.sales_invoices si
    JOIN public.parties p ON p.id = si.party_id
    LEFT JOIN public.warehouses w ON w.id = si.warehouse_id
    LEFT JOIN public.cost_centers cc ON cc.id = si.cost_center_id
    WHERE si.journal_entry_id = _journal_entry_id
      AND si.entity_id = _entity_id
    LIMIT 1;

    IF v_si.id IS NOT NULL THEN
        -- Líneas de la factura de venta
        SELECT json_agg(sil_row) INTO v_si_lines
        FROM (
            SELECT 
                sil.id,
                sil.description,
                sil.qty,
                sil.unit_price,
                sil.tax_rate,
                sil.line_total,
                i.code AS item_code,
                i.name AS item_name
            FROM public.sales_invoice_lines sil
            LEFT JOIN public.items i ON i.id = sil.item_id
            WHERE sil.sales_invoice_id = v_si.id
            ORDER BY sil.id ASC
        ) sil_row;

        RETURN jsonb_build_object(
            'success', true,
            'source_type', 'sales_invoice',
            'title', 'Factura Electrónica de Venta',
            'journal_entry', to_jsonb(v_je) || jsonb_build_object('lines', COALESCE(v_lines, '[]'::jsonb)),
            'document', to_jsonb(v_si) || jsonb_build_object('lines', COALESCE(v_si_lines, '[]'::jsonb))
        );
    END IF;

    -- 3. Verificar si proviene de una Factura de Compra
    SELECT 
        pi.id,
        pi.invoice_number,
        pi.issue_date,
        pi.due_date,
        pi.subtotal_amount,
        pi.tax_amount,
        pi.total_amount,
        pi.currency_code,
        pi.status,
        pi.memo,
        p.name AS supplier_name,
        p.tax_id AS supplier_tax_id,
        w.name AS warehouse_name,
        cc.name AS cost_center_name
    INTO v_pi
    FROM public.purchase_invoices pi
    JOIN public.parties p ON p.id = pi.party_id
    LEFT JOIN public.warehouses w ON w.id = pi.warehouse_id
    LEFT JOIN public.cost_centers cc ON cc.id = pi.cost_center_id
    WHERE pi.journal_entry_id = _journal_entry_id
      AND pi.entity_id = _entity_id
    LIMIT 1;

    IF v_pi.id IS NOT NULL THEN
        -- Líneas de la factura de compra
        SELECT json_agg(pil_row) INTO v_pi_lines
        FROM (
            SELECT 
                pil.id,
                pil.description,
                pil.qty,
                pil.unit_price,
                pil.tax_rate,
                pil.line_total,
                i.code AS item_code,
                i.name AS item_name
            FROM public.purchase_invoice_lines pil
            LEFT JOIN public.items i ON i.id = pil.item_id
            WHERE pil.purchase_invoice_id = v_pi.id
            ORDER BY pil.id ASC
        ) pil_row;

        RETURN jsonb_build_object(
            'success', true,
            'source_type', 'purchase_invoice',
            'title', 'Factura de Compra / Proveedor',
            'journal_entry', to_jsonb(v_je) || jsonb_build_object('lines', COALESCE(v_lines, '[]'::jsonb)),
            'document', to_jsonb(v_pi) || jsonb_build_object('lines', COALESCE(v_pi_lines, '[]'::jsonb))
        );
    END IF;

    -- 4. Verificar si proviene de un Pago / Cobranza (invoice_payments)
    SELECT 
        ip.id,
        ip.amount,
        ip.currency_code,
        ip.payment_date,
        ip.memo,
        ba.code AS bank_account_code,
        ba.name AS bank_account_name,
        si.invoice_number AS sales_invoice_number,
        sip.name AS customer_name,
        sip.tax_id AS customer_tax_id,
        pi.invoice_number AS purchase_invoice_number,
        pip.name AS supplier_name,
        pip.tax_id AS supplier_tax_id,
        CASE 
            WHEN ip.sales_invoice_id IS NOT NULL THEN 'Cobranza de Cliente'
            ELSE 'Pago a Proveedor'
        END AS payment_flow
    INTO v_pay
    FROM public.invoice_payments ip
    LEFT JOIN public.accounts ba ON ba.id = ip.bank_account_id
    LEFT JOIN public.sales_invoices si ON si.id = ip.sales_invoice_id
    LEFT JOIN public.parties sip ON sip.id = si.party_id
    LEFT JOIN public.purchase_invoices pi ON pi.id = ip.purchase_invoice_id
    LEFT JOIN public.parties pip ON pip.id = pi.party_id
    WHERE ip.journal_entry_id = _journal_entry_id
      AND ip.entity_id = _entity_id
    LIMIT 1;

    IF v_pay.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'source_type', 'invoice_payment',
            'title', v_pay.payment_flow,
            'journal_entry', to_jsonb(v_je) || jsonb_build_object('lines', COALESCE(v_lines, '[]'::jsonb)),
            'document', to_jsonb(v_pay)
        );
    END IF;

    -- 5. Verificar si proviene de Depreciación de Activo Fijo
    SELECT 
        fade.id,
        fade.period_date,
        fade.amount,
        fa.asset_code,
        fa.name AS asset_name,
        fa.acquisition_date,
        fa.acquisition_value,
        fa.depreciation_method,
        fa.useful_life_months,
        fa.accumulated_depreciation
    INTO v_fade
    FROM public.fixed_asset_depreciation_entries fade
    JOIN public.fixed_assets fa ON fa.id = fade.fixed_asset_id
    WHERE fade.journal_entry_id = _journal_entry_id
      AND fa.entity_id = _entity_id
    LIMIT 1;

    IF v_fade.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'source_type', 'depreciation',
            'title', 'Cuota de Depreciación Activo Fijo',
            'journal_entry', to_jsonb(v_je) || jsonb_build_object('lines', COALESCE(v_lines, '[]'::jsonb)),
            'document', to_jsonb(v_fade)
        );
    END IF;

    -- 6. Por defecto: Asiento de Diario / Comprobante Manual / Ajuste / Apertura
    RETURN jsonb_build_object(
        'success', true,
        'source_type', 'journal_voucher',
        'title', COALESCE(v_je.voucher_type, 'Comprobante Contable de Diario'),
        'journal_entry', to_jsonb(v_je) || jsonb_build_object('lines', COALESCE(v_lines, '[]'::jsonb)),
        'document', to_jsonb(v_je)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_journal_entry_source_document(uuid, uuid) TO authenticated, service_role;

-- 2. Actualizar get_sii_book_data para incluir journal_entry_id y party en Libro Mayor y Libro Diario
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
                j.id AS journal_entry_id,
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
                p.name AS party_name,
                p.tax_id AS party_tax_id,
                l.memo AS line_memo
            FROM public.journal_entries j
            JOIN public.journal_entry_lines l ON l.journal_entry_id = j.id
            JOIN public.accounts a ON a.id = l.account_id
            LEFT JOIN public.parties p ON p.id = l.party_id
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
                a.id AS account_id,
                a.code AS account_code,
                a.name AS account_name,
                a.account_type,
                j.id AS journal_entry_id,
                j.posting_date,
                j.entry_number,
                j.voucher_type,
                COALESCE(l.memo, j.memo) AS description,
                p.name AS party_name,
                p.tax_id AS party_tax_id,
                l.debit,
                l.credit
            FROM public.journal_entries j
            JOIN public.journal_entry_lines l ON l.journal_entry_id = j.id
            JOIN public.accounts a ON a.id = l.account_id
            LEFT JOIN public.parties p ON p.id = l.party_id
            WHERE j.entity_id = _entity_id
              AND j.status = 'posted'
              AND j.posting_date >= _start_date
              AND j.posting_date <= _end_date
            ORDER BY a.code ASC, j.posting_date ASC, j.entry_number ASC, l.line_no ASC
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
                account_id,
                account_code,
                account_name,
                account_type,
                total_debit,
                total_credit,
                CASE WHEN total_debit >= total_credit THEN (total_debit - total_credit) ELSE 0 END AS saldo_deudor,
                CASE WHEN total_credit > total_debit THEN (total_credit - total_debit) ELSE 0 END AS saldo_acreedor,
                CASE WHEN account_type = 'Asset' THEN (total_debit - total_credit) ELSE 0 END AS inventario_activo,
                CASE WHEN account_type IN ('Liability', 'Equity') THEN (total_credit - total_debit) ELSE 0 END AS inventario_pasivo,
                CASE WHEN account_type IN ('Expense', 'Cost of Goods Sold') THEN (total_debit - total_credit) ELSE 0 END AS resultado_perdida,
                CASE WHEN account_type = 'Income' THEN (total_credit - total_debit) ELSE 0 END AS resultado_ganancia
            FROM raw_balances
            ORDER BY account_code ASC
        ) t;

    ELSIF _book_type = 'libro_ventas' THEN
        SELECT json_agg(t) INTO v_result
        FROM (
            SELECT 
                si.id AS invoice_id,
                si.journal_entry_id,
                si.issue_date,
                si.invoice_number,
                '33 Factura Electrónica' AS doc_type_name,
                p.tax_id AS customer_rut,
                p.name AS customer_name,
                si.subtotal_amount AS monto_neto,
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
                pi.id AS invoice_id,
                pi.journal_entry_id,
                pi.issue_date,
                pi.invoice_number,
                '33 Factura Electrónica Proveedor' AS doc_type_name,
                p.tax_id AS supplier_rut,
                p.name AS supplier_name,
                pi.subtotal_amount AS monto_neto,
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

GRANT EXECUTE ON FUNCTION public.get_sii_book_data(uuid, sii_book_type, date, date) TO authenticated, service_role;

