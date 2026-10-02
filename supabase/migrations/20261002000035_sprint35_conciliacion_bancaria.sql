-- ============================================================================
-- Sprint 35: Módulo de Conciliación Bancaria Inteligente y Tesorería Avanzada
-- EasyERP (Norma Chilena / CLP / Multimoneda)
-- ============================================================================

-- 1. Tabla de Cuentas Bancarias de la Empresa (bank_accounts)
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    account_id uuid REFERENCES public.accounts(id) ON DELETE RESTRICT NOT NULL, -- Cuenta Contable (ej. 1102 Banco)
    bank_name text NOT NULL,                                                    -- ej. 'Banco de Chile', 'Banco Santander'
    account_number text NOT NULL,                                               -- ej. '00-12345678-01'
    account_type text NOT NULL DEFAULT 'corriente',                             -- 'corriente', 'vista', 'ahorro'
    currency_code text REFERENCES public.currencies(code) NOT NULL DEFAULT 'CLP',
    initial_balance numeric(20,4) NOT NULL DEFAULT 0,
    current_balance numeric(20,4) NOT NULL DEFAULT 0,
    api_provider text NOT NULL DEFAULT 'none',                                  -- 'none', 'fintoc', 'floid', 'sandbox_api'
    api_account_id text,
    api_last_sync timestamptz,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT uq_bank_account_num UNIQUE (entity_id, bank_name, account_number)
);

CREATE INDEX IF NOT EXISTS ix_bank_accounts_entity ON public.bank_accounts(entity_id);
CREATE INDEX IF NOT EXISTS ix_bank_accounts_acc ON public.bank_accounts(account_id);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_bank_accounts" ON public.bank_accounts;
CREATE POLICY "read_bank_accounts" ON public.bank_accounts
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "write_bank_accounts" ON public.bank_accounts;
CREATE POLICY "write_bank_accounts" ON public.bank_accounts
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.bank_accounts TO authenticated, service_role;


-- 2. Tabla de Cartolas Bancarias / Corridas de Conciliación (bank_statements)
CREATE TABLE IF NOT EXISTS public.bank_statements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE CASCADE NOT NULL,
    statement_date date NOT NULL DEFAULT CURRENT_DATE,
    period_start date NOT NULL,
    period_end date NOT NULL,
    initial_balance numeric(20,4) NOT NULL DEFAULT 0,
    final_balance numeric(20,4) NOT NULL DEFAULT 0,
    total_credits numeric(20,4) NOT NULL DEFAULT 0,   -- Total Abonos
    total_debits numeric(20,4) NOT NULL DEFAULT 0,    -- Total Cargos
    source text NOT NULL DEFAULT 'excel',             -- 'excel', 'csv', 'pdf', 'api_fintoc', 'sandbox_api', 'manual'
    file_name text,
    total_movements int NOT NULL DEFAULT 0,
    reconciled_movements int NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'in_progress',       -- 'in_progress', 'reconciled', 'closed'
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_bank_statements_entity ON public.bank_statements(entity_id);
CREATE INDEX IF NOT EXISTS ix_bank_statements_ba ON public.bank_statements(bank_account_id);
CREATE INDEX IF NOT EXISTS ix_bank_statements_period ON public.bank_statements(period_start, period_end);

ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_bank_statements" ON public.bank_statements;
CREATE POLICY "read_bank_statements" ON public.bank_statements
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "write_bank_statements" ON public.bank_statements;
CREATE POLICY "write_bank_statements" ON public.bank_statements
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.bank_statements TO authenticated, service_role;


-- 3. Tabla de Movimientos Detalle de la Cartola (bank_statement_lines)
CREATE TABLE IF NOT EXISTS public.bank_statement_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_id uuid REFERENCES public.bank_statements(id) ON DELETE CASCADE NOT NULL,
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE CASCADE NOT NULL,
    line_number int NOT NULL,
    movement_date date NOT NULL,
    description text NOT NULL,                       -- Glosa bancaria completa
    reference_number text,                           -- N° Transacción / Cheque / TEF
    debit_amount numeric(20,4) NOT NULL DEFAULT 0,   -- Cargo / Salida de dinero
    credit_amount numeric(20,4) NOT NULL DEFAULT 0,  -- Abono / Entrada de dinero
    balance numeric(20,4) NOT NULL DEFAULT 0,        -- Saldo de cartola
    reconciliation_status text NOT NULL DEFAULT 'unreconciled', -- 'unreconciled', 'matched', 'reconciled', 'ignored'
    matched_operation_type text,                     -- 'sale_invoice', 'purchase_invoice', 'journal_entry', 'bank_expense'
    matched_invoice_id uuid,                         -- FK a sales_invoices o purchase_invoices
    matched_journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    payment_id uuid REFERENCES public.invoice_payments(id) ON DELETE SET NULL,
    match_confidence numeric(5,2) NOT NULL DEFAULT 0, -- 0.00 a 100.00
    match_reason text,                               -- Detalle explicativo del match heurístico
    reconciled_at timestamptz,
    reconciled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_bsl_statement ON public.bank_statement_lines(statement_id);
CREATE INDEX IF NOT EXISTS ix_bsl_entity ON public.bank_statement_lines(entity_id);
CREATE INDEX IF NOT EXISTS ix_bsl_ba ON public.bank_statement_lines(bank_account_id);
CREATE INDEX IF NOT EXISTS ix_bsl_status ON public.bank_statement_lines(reconciliation_status);
CREATE INDEX IF NOT EXISTS ix_bsl_payment ON public.bank_statement_lines(payment_id);
CREATE INDEX IF NOT EXISTS ix_bsl_invoice ON public.bank_statement_lines(matched_invoice_id);

ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_bank_statement_lines" ON public.bank_statement_lines;
CREATE POLICY "read_bank_statement_lines" ON public.bank_statement_lines
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "write_bank_statement_lines" ON public.bank_statement_lines;
CREATE POLICY "write_bank_statement_lines" ON public.bank_statement_lines
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.bank_statement_lines TO authenticated, service_role;


-- 4. Función de Ingesta y Auto-Matching Heurístico (import_bank_statement_batch)
CREATE OR REPLACE FUNCTION public.import_bank_statement_batch(
    _entity_id uuid,
    _bank_account_id uuid,
    _period_start date,
    _period_end date,
    _initial_balance numeric,
    _final_balance numeric,
    _source text,
    _file_name text,
    _lines jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_statement_id uuid;
    v_row RECORD;
    v_line_no int := 0;
    v_tot_credits numeric(20,4) := 0;
    v_tot_debits numeric(20,4) := 0;
    v_matched_count int := 0;
    v_tot_count int := 0;

    -- Heurísticas
    v_matched_status text;
    v_matched_type text;
    v_matched_inv_id uuid;
    v_matched_conf numeric(5,2);
    v_matched_reason text;
    
    -- Variables auxiliares para matching de Ventas
    v_si RECORD;
    -- Variables auxiliares para matching de Compras
    v_pi RECORD;
BEGIN
    -- 1. Crear Cabecera de la Cartola
    INSERT INTO public.bank_statements (
        entity_id,
        bank_account_id,
        period_start,
        period_end,
        initial_balance,
        final_balance,
        source,
        file_name,
        created_by
    ) VALUES (
        _entity_id,
        _bank_account_id,
        _period_start,
        _period_end,
        _initial_balance,
        _final_balance,
        COALESCE(_source, 'excel'),
        _file_name,
        auth.uid()
    ) RETURNING id INTO v_statement_id;

    -- 2. Procesar cada fila de la cartola e invocar heurística
    FOR v_row IN SELECT * FROM jsonb_to_recordset(_lines) AS x(
        movement_date date,
        description text,
        reference_number text,
        debit_amount numeric,
        credit_amount numeric,
        balance numeric
    ) LOOP
        v_line_no := v_line_no + 1;
        v_tot_count := v_tot_count + 1;
        v_tot_debits := v_tot_debits + COALESCE(v_row.debit_amount, 0);
        v_tot_credits := v_tot_credits + COALESCE(v_row.credit_amount, 0);

        v_matched_status := 'unreconciled';
        v_matched_type := NULL;
        v_matched_inv_id := NULL;
        v_matched_conf := 0;
        v_matched_reason := NULL;

        -- Heurística A: Si es Abono (> 0), buscar en Libro de Ventas (sales_invoices) pendientes
        IF COALESCE(v_row.credit_amount, 0) > 0 THEN
            -- A.1: Buscar coincidencia exacta por Monto y RUT o Folio en la descripción
            SELECT 
                sib.id, sib.invoice_number, sib.party_name, sib.party_tax_id, sib.balance_due
            INTO v_si
            FROM public.sales_invoice_balances sib
            WHERE sib.entity_id = _entity_id
              AND sib.balance_due > 0
              AND ABS(sib.balance_due - v_row.credit_amount) < 1.0
              AND (
                -- RUT en la glosa bancaria
                REPLACE(REPLACE(sib.party_tax_id, '.', ''), '-', '') <> '' AND
                REPLACE(REPLACE(UPPER(v_row.description), '.', ''), '-', '') ILIKE '%' || REPLACE(REPLACE(sib.party_tax_id, '.', ''), '-', '') || '%'
                -- O Folio de factura en la glosa
                OR (v_row.description ~* ('\y' || REPLACE(sib.invoice_number, '-', '') || '\y'))
              )
            LIMIT 1;

            IF v_si.id IS NOT NULL THEN
                v_matched_status := 'matched';
                v_matched_type := 'sale_invoice';
                v_matched_inv_id := v_si.id;
                v_matched_conf := 100.0;
                v_matched_reason := 'Coincidencia 100% (Monto exacto $' || ROUND(v_si.balance_due)::text || ' y datos de ' || v_si.party_name || ' / ' || v_si.invoice_number || ')';
                v_matched_count := v_matched_count + 1;
            ELSE
                -- A.2: Buscar coincidencia por Monto exacto y nombre de cliente
                SELECT 
                    sib.id, sib.invoice_number, sib.party_name, sib.balance_due
                INTO v_si
                FROM public.sales_invoice_balances sib
                WHERE sib.entity_id = _entity_id
                  AND sib.balance_due > 0
                  AND ABS(sib.balance_due - v_row.credit_amount) < 1.0
                  AND UPPER(v_row.description) ILIKE '%' || UPPER(SPLIT_PART(sib.party_name, ' ', 1)) || '%'
                LIMIT 1;

                IF v_si.id IS NOT NULL THEN
                    v_matched_status := 'matched';
                    v_matched_type := 'sale_invoice';
                    v_matched_inv_id := v_si.id;
                    v_matched_conf := 85.0;
                    v_matched_reason := 'Coincidencia 85% (Monto exacto $' || ROUND(v_si.balance_due)::text || ' y nombre de ' || v_si.party_name || ')';
                    v_matched_count := v_matched_count + 1;
                ELSE
                    -- A.3: Buscar si hay exactamente una sola factura pendiente con ese monto exacto
                    SELECT 
                        sib.id, sib.invoice_number, sib.party_name, sib.balance_due
                    INTO v_si
                    FROM public.sales_invoice_balances sib
                    WHERE sib.entity_id = _entity_id
                      AND sib.balance_due > 0
                      AND ABS(sib.balance_due - v_row.credit_amount) < 1.0
                    LIMIT 2;

                    -- Si solo hay una coincidencia de monto
                    IF FOUND THEN
                        v_matched_status := 'matched';
                        v_matched_type := 'sale_invoice';
                        v_matched_inv_id := v_si.id;
                        v_matched_conf := 70.0;
                        v_matched_reason := 'Sugerencia por monto único $' || ROUND(v_si.balance_due)::text || ' con Factura ' || v_si.invoice_number;
                        v_matched_count := v_matched_count + 1;
                    END IF;
                END IF;
            END IF;

        -- Heurística B: Si es Cargo (> 0), buscar en Libro de Compras (purchase_invoices) pendientes
        ELSIF COALESCE(v_row.debit_amount, 0) > 0 THEN
            -- B.1: Comprobar primero si es un Gasto Bancario común (Comisiones, Mantención, Timbres)
            IF v_row.description ~* '(COMISION|MANTENCION|IMPUESTO|TIMBRES|CARGO PAC|LINEA CREDITO|INTERES)' THEN
                v_matched_status := 'matched';
                v_matched_type := 'bank_expense';
                v_matched_conf := 95.0;
                v_matched_reason := 'Gasto Financiero / Comisión bancaria identificada';
                v_matched_count := v_matched_count + 1;
            ELSE
                -- B.2: Buscar coincidencia exacta por Monto y RUT / Folio Proveedor
                SELECT 
                    pib.id, pib.invoice_number, pib.party_name, pib.party_tax_id, pib.balance_due
                INTO v_pi
                FROM public.purchase_invoice_balances pib
                WHERE pib.entity_id = _entity_id
                  AND pib.balance_due > 0
                  AND ABS(pib.balance_due - v_row.debit_amount) < 1.0
                  AND (
                    REPLACE(REPLACE(pib.party_tax_id, '.', ''), '-', '') <> '' AND
                    REPLACE(REPLACE(UPPER(v_row.description), '.', ''), '-', '') ILIKE '%' || REPLACE(REPLACE(pib.party_tax_id, '.', ''), '-', '') || '%'
                    OR (v_row.description ~* ('\y' || REPLACE(pib.invoice_number, '-', '') || '\y'))
                  )
                LIMIT 1;

                IF v_pi.id IS NOT NULL THEN
                    v_matched_status := 'matched';
                    v_matched_type := 'purchase_invoice';
                    v_matched_inv_id := v_pi.id;
                    v_matched_conf := 100.0;
                    v_matched_reason := 'Coincidencia 100% (Monto exacto $' || ROUND(v_pi.balance_due)::text || ' y datos de ' || v_pi.party_name || ')';
                    v_matched_count := v_matched_count + 1;
                ELSE
                    -- B.3: Buscar por Monto y nombre de Proveedor
                    SELECT 
                        pib.id, pib.invoice_number, pib.party_name, pib.balance_due
                    INTO v_pi
                    FROM public.purchase_invoice_balances pib
                    WHERE pib.entity_id = _entity_id
                      AND pib.balance_due > 0
                      AND ABS(pib.balance_due - v_row.debit_amount) < 1.0
                      AND UPPER(v_row.description) ILIKE '%' || UPPER(SPLIT_PART(pib.party_name, ' ', 1)) || '%'
                    LIMIT 1;

                    IF v_pi.id IS NOT NULL THEN
                        v_matched_status := 'matched';
                        v_matched_type := 'purchase_invoice';
                        v_matched_inv_id := v_pi.id;
                        v_matched_conf := 85.0;
                        v_matched_reason := 'Coincidencia 85% (Monto exacto $' || ROUND(v_pi.balance_due)::text || ' y nombre de ' || v_pi.party_name || ')';
                        v_matched_count := v_matched_count + 1;
                    ELSE
                        -- B.4: Sugerencia por monto único
                        SELECT 
                            pib.id, pib.invoice_number, pib.party_name, pib.balance_due
                        INTO v_pi
                        FROM public.purchase_invoice_balances pib
                        WHERE pib.entity_id = _entity_id
                          AND pib.balance_due > 0
                          AND ABS(pib.balance_due - v_row.debit_amount) < 1.0
                        LIMIT 2;

                        IF FOUND THEN
                            v_matched_status := 'matched';
                            v_matched_type := 'purchase_invoice';
                            v_matched_inv_id := v_pi.id;
                            v_matched_conf := 70.0;
                            v_matched_reason := 'Sugerencia por monto único $' || ROUND(v_pi.balance_due)::text || ' con Factura Proveedor ' || v_pi.invoice_number;
                            v_matched_count := v_matched_count + 1;
                        END IF;
                    END IF;
                END IF;
            END IF;
        END IF;

        -- Insertar línea de la cartola con la sugerencia calculada
        INSERT INTO public.bank_statement_lines (
            statement_id,
            entity_id,
            bank_account_id,
            line_number,
            movement_date,
            description,
            reference_number,
            debit_amount,
            credit_amount,
            balance,
            reconciliation_status,
            matched_operation_type,
            matched_invoice_id,
            match_confidence,
            match_reason
        ) VALUES (
            v_statement_id,
            _entity_id,
            _bank_account_id,
            v_line_no,
            v_row.movement_date,
            TRIM(v_row.description),
            NULLIF(TRIM(v_row.reference_number), ''),
            COALESCE(v_row.debit_amount, 0),
            COALESCE(v_row.credit_amount, 0),
            COALESCE(v_row.balance, 0),
            v_matched_status,
            v_matched_type,
            v_matched_inv_id,
            v_matched_conf,
            v_matched_reason
        );
    END LOOP;

    -- 3. Actualizar totales de la cabecera
    UPDATE public.bank_statements SET
        total_credits = v_tot_credits,
        total_debits = v_tot_debits,
        total_movements = v_tot_count
    WHERE id = v_statement_id;

    RETURN jsonb_build_object(
        'success', true,
        'statement_id', v_statement_id,
        'total_movements', v_tot_count,
        'matched_movements', v_matched_count,
        'total_credits', v_tot_credits,
        'total_debits', v_tot_debits
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_bank_statement_batch(uuid, uuid, date, date, numeric, numeric, text, text, jsonb) TO authenticated, service_role;


-- 5. Función de Contabilización en 1 Solo Clic (reconcile_and_post_bank_payment)
CREATE OR REPLACE FUNCTION public.reconcile_and_post_bank_payment(
    _line_id uuid,
    _operation_type text,
    _invoice_id uuid DEFAULT NULL,
    _expense_account_id uuid DEFAULT NULL,
    _memo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_line RECORD;
    v_bank RECORD;
    v_defaults RECORD;
    v_base_curr text;
    v_amount numeric(20,4);
    v_je_id uuid;
    v_je_number text;
    v_payment_id uuid;
    v_party_id uuid;
    v_invoice_num text;
    v_exp_acc_id uuid;
BEGIN
    -- 1. Obtener la línea de la cartola
    SELECT * INTO v_line 
    FROM public.bank_statement_lines 
    WHERE id = _line_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Línea de cartola no encontrada.';
    END IF;

    IF v_line.reconciliation_status = 'reconciled' THEN
        RAISE EXCEPTION 'Esta línea ya fue contabilizada y conciliada previamente.';
    END IF;

    -- 2. Obtener la cuenta bancaria y cuenta contable asociada
    SELECT * INTO v_bank 
    FROM public.bank_accounts 
    WHERE id = v_line.bank_account_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cuenta bancaria asociada no encontrada.';
    END IF;

    -- 3. Cuentas predeterminadas de la empresa
    SELECT * INTO v_defaults 
    FROM public.company_default_accounts 
    WHERE entity_id = v_line.entity_id;

    SELECT base_currency_code INTO v_base_curr 
    FROM public.entities 
    WHERE id = v_line.entity_id;
    v_base_curr := COALESCE(v_base_curr, 'CLP');

    -- Determinar monto
    IF _operation_type = 'sale_invoice' THEN
        v_amount := v_line.credit_amount;
    ELSE
        v_amount := v_line.debit_amount;
    END IF;

    IF v_amount <= 0 THEN
        RAISE EXCEPTION 'El monto de la transacción debe ser mayor a cero.';
    END IF;

    -- =========================================================================
    -- CASO A: Cobranza de Factura de Venta (Abono Bancario)
    -- Asiento: Débito Banco / Crédito Clientes por Cobrar
    -- =========================================================================
    IF _operation_type = 'sale_invoice' THEN
        IF _invoice_id IS NULL THEN
            RAISE EXCEPTION 'Debe indicar la factura de venta a conciliar.';
        END IF;

        IF v_defaults.receivable_account_id IS NULL THEN
            RAISE EXCEPTION 'Configure la cuenta predeterminada de Clientes (CxC) en Configuración.';
        END IF;

        SELECT party_id, invoice_number INTO v_party_id, v_invoice_num 
        FROM public.sales_invoices 
        WHERE id = _invoice_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Factura de venta no encontrada.';
        END IF;

        -- 1. Crear Cabecera Comprobante de Ingreso
        v_je_number := public.get_next_entry_number(v_line.entity_id, 'ING-');
        
        INSERT INTO public.journal_entries (
            entity_id,
            entry_number,
            posting_date,
            voucher_type,
            memo,
            status,
            created_by
        ) VALUES (
            v_line.entity_id,
            v_je_number,
            v_line.movement_date,
            'Ingreso',
            COALESCE(_memo, 'Cobro Factura ' || v_invoice_num || ' — ' || v_line.description),
            'draft',
            auth.uid()
        ) RETURNING id INTO v_je_id;

        -- Línea 1: Débito a Cuenta de Banco (Activo aumenta)
        INSERT INTO public.journal_entry_lines (
            journal_entry_id, line_no, account_id, party_id, debit, credit, memo
        ) VALUES (
            v_je_id, 1, v_bank.account_id, v_party_id, v_amount, 0,
            'Ingreso Bancario ' || v_bank.bank_name || ' — ' || v_line.description
        );

        -- Línea 2: Crédito a Clientes CxC (Activo disminuye)
        INSERT INTO public.journal_entry_lines (
            journal_entry_id, line_no, account_id, party_id, debit, credit, memo
        ) VALUES (
            v_je_id, 2, v_defaults.receivable_account_id, v_party_id, 0, v_amount,
            'Pago Factura Venta ' || v_invoice_num
        );

        -- Postear comprobante oficialmente
        PERFORM public.post_journal_entry(v_je_id);

        -- 2. Crear Registro de Cobranza en invoice_payments
        INSERT INTO public.invoice_payments (
            entity_id,
            sales_invoice_id,
            amount,
            currency_code,
            payment_date,
            bank_account_id,
            journal_entry_id,
            memo,
            created_by
        ) VALUES (
            v_line.entity_id,
            _invoice_id,
            v_amount,
            v_bank.currency_code,
            v_line.movement_date,
            v_bank.account_id,
            v_je_id,
            COALESCE(_memo, 'Pago Cartola Bancaria ' || v_line.description),
            auth.uid()
        ) RETURNING id INTO v_payment_id;

        -- 3. Si la factura queda con saldo 0, actualizar estado a 'paid'
        UPDATE public.sales_invoices si
        SET status = 'paid', updated_at = now()
        WHERE si.id = _invoice_id
          AND (si.total_amount - (SELECT COALESCE(SUM(ip.amount), 0) FROM public.invoice_payments ip WHERE ip.sales_invoice_id = _invoice_id)) <= 0.01;

    -- =========================================================================
    -- CASO B: Pago de Factura de Compra (Cargo Bancario)
    -- Asiento: Débito Proveedores por Pagar / Crédito Banco
    -- =========================================================================
    ELSIF _operation_type = 'purchase_invoice' THEN
        IF _invoice_id IS NULL THEN
            RAISE EXCEPTION 'Debe indicar la factura de compra a conciliar.';
        END IF;

        IF v_defaults.payable_account_id IS NULL THEN
            RAISE EXCEPTION 'Configure la cuenta predeterminada de Proveedores (CxP) en Configuración.';
        END IF;

        SELECT party_id, invoice_number INTO v_party_id, v_invoice_num 
        FROM public.purchase_invoices 
        WHERE id = _invoice_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Factura de compra no encontrada.';
        END IF;

        -- 1. Crear Cabecera Comprobante de Egreso
        v_je_number := public.get_next_entry_number(v_line.entity_id, 'EGR-');

        INSERT INTO public.journal_entries (
            entity_id,
            entry_number,
            posting_date,
            voucher_type,
            memo,
            status,
            created_by
        ) VALUES (
            v_line.entity_id,
            v_je_number,
            v_line.movement_date,
            'Egreso',
            COALESCE(_memo, 'Pago Factura Compra ' || v_invoice_num || ' — ' || v_line.description),
            'draft',
            auth.uid()
        ) RETURNING id INTO v_je_id;

        -- Línea 1: Débito a Proveedores CxP (Pasivo disminuye)
        INSERT INTO public.journal_entry_lines (
            journal_entry_id, line_no, account_id, party_id, debit, credit, memo
        ) VALUES (
            v_je_id, 1, v_defaults.payable_account_id, v_party_id, v_amount, 0,
            'Pago Factura Proveedor ' || v_invoice_num
        );

        -- Línea 2: Crédito a Cuenta de Banco (Activo disminuye)
        INSERT INTO public.journal_entry_lines (
            journal_entry_id, line_no, account_id, party_id, debit, credit, memo
        ) VALUES (
            v_je_id, 2, v_bank.account_id, v_party_id, 0, v_amount,
            'Salida Bancaria ' || v_bank.bank_name || ' — ' || v_line.description
        );

        -- Postear comprobante oficialmente
        PERFORM public.post_journal_entry(v_je_id);

        -- 2. Crear Registro de Pago en invoice_payments
        INSERT INTO public.invoice_payments (
            entity_id,
            purchase_invoice_id,
            amount,
            currency_code,
            payment_date,
            bank_account_id,
            journal_entry_id,
            memo,
            created_by
        ) VALUES (
            v_line.entity_id,
            _invoice_id,
            v_amount,
            v_bank.currency_code,
            v_line.movement_date,
            v_bank.account_id,
            v_je_id,
            COALESCE(_memo, 'Pago Cartola Bancaria ' || v_line.description),
            auth.uid()
        ) RETURNING id INTO v_payment_id;

        -- 3. Si la factura queda con saldo 0, actualizar estado a 'paid'
        UPDATE public.purchase_invoices pi
        SET status = 'paid', updated_at = now()
        WHERE pi.id = _invoice_id
          AND (pi.total_amount - (SELECT COALESCE(SUM(ip.amount), 0) FROM public.invoice_payments ip WHERE ip.purchase_invoice_id = _invoice_id)) <= 0.01;

    -- =========================================================================
    -- CASO C: Gasto Financiero / Comisión Bancaria
    -- Asiento: Débito Gastos Financieros / Crédito Banco
    -- =========================================================================
    ELSIF _operation_type = 'bank_expense' THEN
        -- Buscar cuenta de gasto si no se especificó
        v_exp_acc_id := _expense_account_id;
        IF v_exp_acc_id IS NULL THEN
            SELECT id INTO v_exp_acc_id 
            FROM public.accounts 
            WHERE entity_id = v_line.entity_id 
              AND (code LIKE '5.2%' OR code LIKE '52%' OR name ILIKE '%comision%' OR name ILIKE '%gasto financiero%')
              AND is_group = false
            LIMIT 1;

            -- Si no hay específica, usar cualquier cuenta de resultado de gastos
            IF v_exp_acc_id IS NULL THEN
                SELECT id INTO v_exp_acc_id 
                FROM public.accounts 
                WHERE entity_id = v_line.entity_id 
                  AND account_type = 'Expense' 
                  AND is_group = false 
                LIMIT 1;
            END IF;
        END IF;

        IF v_exp_acc_id IS NULL THEN
            RAISE EXCEPTION 'No se encontró cuenta de Gastos Financieros en el plan de cuentas.';
        END IF;

        v_je_number := public.get_next_entry_number(v_line.entity_id, 'EGR-');

        INSERT INTO public.journal_entries (
            entity_id,
            entry_number,
            posting_date,
            voucher_type,
            memo,
            status,
            created_by
        ) VALUES (
            v_line.entity_id,
            v_je_number,
            v_line.movement_date,
            'Egreso',
            COALESCE(_memo, 'Comisión / Gasto Bancario — ' || v_line.description),
            'draft',
            auth.uid()
        ) RETURNING id INTO v_je_id;

        -- Línea 1: Débito Gasto Bancario
        INSERT INTO public.journal_entry_lines (
            journal_entry_id, line_no, account_id, debit, credit, memo
        ) VALUES (
            v_je_id, 1, v_exp_acc_id, v_amount, 0,
            'Gasto Financiero / Comisión — ' || v_line.description
        );

        -- Línea 2: Crédito Banco
        INSERT INTO public.journal_entry_lines (
            journal_entry_id, line_no, account_id, debit, credit, memo
        ) VALUES (
            v_je_id, 2, v_bank.account_id, 0, v_amount,
            'Salida por Comisión Bancaria — ' || v_bank.bank_name
        );

        PERFORM public.post_journal_entry(v_je_id);
    ELSE
        RAISE EXCEPTION 'Tipo de operación no soportado: %', _operation_type;
    END IF;

    -- =========================================================================
    -- 4. Actualizar la línea de la cartola como CONCILIADA
    -- =========================================================================
    UPDATE public.bank_statement_lines SET
        reconciliation_status = 'reconciled',
        matched_operation_type = _operation_type,
        matched_invoice_id = _invoice_id,
        matched_journal_entry_id = v_je_id,
        payment_id = v_payment_id,
        reconciled_at = now(),
        reconciled_by = auth.uid()
    WHERE id = _line_id;

    -- Actualizar contador en la cabecera
    UPDATE public.bank_statements SET
        reconciled_movements = reconciled_movements + 1,
        status = CASE 
            WHEN (reconciled_movements + 1) >= total_movements THEN 'reconciled' 
            ELSE 'in_progress' 
        END
    WHERE id = v_line.statement_id;

    RETURN jsonb_build_object(
        'success', true,
        'line_id', _line_id,
        'payment_id', v_payment_id,
        'journal_entry_id', v_je_id,
        'journal_entry_number', v_je_number,
        'amount', v_amount
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_and_post_bank_payment(uuid, text, uuid, uuid, text) TO authenticated, service_role;


-- 6. Función de Contabilización Masiva de Coincidencias al 100% (bulk_reconcile_matched_payments)
CREATE OR REPLACE FUNCTION public.bulk_reconcile_matched_payments(_statement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_line RECORD;
    v_reconciled_count int := 0;
    v_err_count int := 0;
BEGIN
    FOR v_line IN 
        SELECT id, matched_operation_type, matched_invoice_id 
        FROM public.bank_statement_lines 
        WHERE statement_id = _statement_id 
          AND reconciliation_status = 'matched' 
          AND match_confidence >= 80.0
          AND (
            (matched_operation_type IN ('sale_invoice', 'purchase_invoice') AND matched_invoice_id IS NOT NULL)
            OR (matched_operation_type = 'bank_expense')
          )
        ORDER BY line_number ASC
    LOOP
        BEGIN
            PERFORM public.reconcile_and_post_bank_payment(
                v_line.id,
                v_line.matched_operation_type,
                v_line.matched_invoice_id,
                NULL,
                NULL
            );
            v_reconciled_count := v_reconciled_count + 1;
        EXCEPTION WHEN OTHERS THEN
            v_err_count := v_err_count + 1;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'statement_id', _statement_id,
        'reconciled_count', v_reconciled_count,
        'failed_count', v_err_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_reconcile_matched_payments(uuid) TO authenticated, service_role;


-- 7. Función para Deshacer Conciliación de una Línea (unreconcile_bank_line)
CREATE OR REPLACE FUNCTION public.unreconcile_bank_line(_line_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_line RECORD;
BEGIN
    SELECT * INTO v_line 
    FROM public.bank_statement_lines 
    WHERE id = _line_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Línea de cartola no encontrada.';
    END IF;

    IF v_line.reconciliation_status <> 'reconciled' THEN
        RAISE EXCEPTION 'La línea no está conciliada.';
    END IF;

    -- Eliminar pago de invoice_payments si existe
    IF v_line.payment_id IS NOT NULL THEN
        DELETE FROM public.invoice_payments WHERE id = v_line.payment_id;
    END IF;

    -- Reversar comprobante contable si existe
    IF v_line.matched_journal_entry_id IS NOT NULL THEN
        BEGIN
            PERFORM public.reverse_journal_entry(v_line.matched_journal_entry_id);
        EXCEPTION WHEN OTHERS THEN
            -- Si no se puede reversar directamente, se actualiza la referencia
            NULL;
        END;
    END IF;

    -- Restaurar estado de la factura si fue pagada
    IF v_line.matched_operation_type = 'sale_invoice' AND v_line.matched_invoice_id IS NOT NULL THEN
        UPDATE public.sales_invoices SET status = 'confirmed', updated_at = now()
        WHERE id = v_line.matched_invoice_id AND status = 'paid';
    ELSIF v_line.matched_operation_type = 'purchase_invoice' AND v_line.matched_invoice_id IS NOT NULL THEN
        UPDATE public.purchase_invoices SET status = 'confirmed', updated_at = now()
        WHERE id = v_line.matched_invoice_id AND status = 'paid';
    END IF;

    -- Desmarcar línea
    UPDATE public.bank_statement_lines SET
        reconciliation_status = 'unreconciled',
        payment_id = NULL,
        matched_journal_entry_id = NULL,
        reconciled_at = NULL,
        reconciled_by = NULL
    WHERE id = _line_id;

    -- Reducir contador en cabecera
    UPDATE public.bank_statements SET
        reconciled_movements = GREATEST(0, reconciled_movements - 1),
        status = 'in_progress'
    WHERE id = v_line.statement_id;

    RETURN jsonb_build_object('success', true, 'line_id', _line_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.unreconcile_bank_line(uuid) TO authenticated, service_role;


-- 8. Función de Resumen de Cuadratura Bancaria (get_bank_reconciliation_summary)
CREATE OR REPLACE FUNCTION public.get_bank_reconciliation_summary(
    _entity_id uuid,
    _bank_account_id uuid,
    _statement_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_bank RECORD;
    v_stmt RECORD;
    v_ledger_balance numeric(20,4) := 0;
    v_statement_balance numeric(20,4) := 0;
    v_total_movs int := 0;
    v_reconciled_movs int := 0;
    v_matched_movs int := 0;
    v_pending_movs int := 0;
BEGIN
    -- 1. Obtener la cuenta bancaria
    SELECT * INTO v_bank FROM public.bank_accounts WHERE id = _bank_account_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Cuenta bancaria no encontrada');
    END IF;

    -- 2. Calcular Saldo del Libro Mayor para esta cuenta contable
    -- Saldo = Débitos - Créditos (Cuenta de Activo)
    SELECT COALESCE(SUM(l.debit - l.credit), 0) INTO v_ledger_balance
    FROM public.journal_entry_lines l
    JOIN public.journal_entries je ON je.id = l.journal_entry_id
    WHERE je.entity_id = _entity_id
      AND l.account_id = v_bank.account_id
      AND je.status = 'posted';

    -- 3. Obtener datos de la cartola activa
    IF _statement_id IS NOT NULL THEN
        SELECT * INTO v_stmt FROM public.bank_statements WHERE id = _statement_id;
    ELSE
        SELECT * INTO v_stmt 
        FROM public.bank_statements 
        WHERE bank_account_id = _bank_account_id 
        ORDER BY created_at DESC 
        LIMIT 1;
    END IF;

    IF v_stmt.id IS NOT NULL THEN
        v_statement_balance := v_stmt.final_balance;
        v_total_movs := v_stmt.total_movements;
        v_reconciled_movs := v_stmt.reconciled_movements;

        SELECT COUNT(*) INTO v_matched_movs 
        FROM public.bank_statement_lines 
        WHERE statement_id = v_stmt.id AND reconciliation_status = 'matched';

        v_pending_movs := v_total_movs - v_reconciled_movs;
    END IF;

    RETURN jsonb_build_object(
        'bank_account_id', v_bank.id,
        'bank_name', v_bank.bank_name,
        'account_number', v_bank.account_number,
        'currency_code', v_bank.currency_code,
        'statement_id', v_stmt.id,
        'statement_date', v_stmt.statement_date,
        'period_start', v_stmt.period_start,
        'period_end', v_stmt.period_end,
        'statement_balance', v_statement_balance,
        'ledger_balance', v_ledger_balance,
        'difference', (v_statement_balance - v_ledger_balance),
        'total_movements', v_total_movs,
        'reconciled_movements', v_reconciled_movs,
        'matched_movements', v_matched_movs,
        'pending_movements', v_pending_movs
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_bank_reconciliation_summary(uuid, uuid, uuid) TO authenticated, service_role;
