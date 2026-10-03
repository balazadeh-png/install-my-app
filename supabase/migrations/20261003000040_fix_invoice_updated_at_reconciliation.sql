-- ============================================================================
-- Fix: Agregar columna updated_at a sales_invoices y purchase_invoices
-- Resuelve: column "updated_at" of relation "sales_invoices" does not exist
-- al ejecutar reconcile_and_post_bank_payment (Contabilizar Pago de Cartola)
-- ============================================================================

-- 1. Asegurar función update_updated_at_column si no existe
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Agregar columna updated_at a public.sales_invoices
ALTER TABLE public.sales_invoices 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now() NOT NULL;

DROP TRIGGER IF EXISTS trg_sales_invoices_updated_at ON public.sales_invoices;
CREATE TRIGGER trg_sales_invoices_updated_at
    BEFORE UPDATE ON public.sales_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Agregar columna updated_at a public.purchase_invoices
ALTER TABLE public.purchase_invoices 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now() NOT NULL;

DROP TRIGGER IF EXISTS trg_purchase_invoices_updated_at ON public.purchase_invoices;
CREATE TRIGGER trg_purchase_invoices_updated_at
    BEFORE UPDATE ON public.purchase_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Re-compilar la función reconcile_and_post_bank_payment para asegurar resolución limpia de columnas
CREATE OR REPLACE FUNCTION public.reconcile_and_post_bank_payment(
    _line_id uuid,
    _operation_type text,            -- 'sale_invoice', 'purchase_invoice', 'bank_expense'
    _invoice_id uuid DEFAULT NULL,
    _expense_account_id uuid DEFAULT NULL,
    _memo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_line public.bank_statement_lines%ROWTYPE;
    v_bank public.bank_accounts%ROWTYPE;
    v_defaults public.company_default_accounts%ROWTYPE;
    v_base_curr text;
    v_amount numeric;
    v_party_id uuid;
    v_invoice_num text;
    v_je_id uuid;
    v_je_number text;
    v_payment_id uuid;
    v_exp_acc_id uuid;
    v_pending_balance numeric;
BEGIN
    -- 1. Validar la línea de cartola
    SELECT * INTO v_line 
    FROM public.bank_statement_lines 
    WHERE id = _line_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Línea de cartola bancaria % no encontrada.', _line_id;
    END IF;

    IF v_line.reconciliation_status = 'reconciled' THEN
        RAISE EXCEPTION 'Esta línea bancaria ya se encuentra contabilizada y conciliada.';
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

        -- 3. Calcular saldo restante y si queda en 0, actualizar estado a 'paid'
        SELECT (si.total_amount - COALESCE(SUM(ip.amount), 0))
        INTO v_pending_balance
        FROM public.sales_invoices si
        LEFT JOIN public.invoice_payments ip ON ip.sales_invoice_id = si.id
        WHERE si.id = _invoice_id
        GROUP BY si.id, si.total_amount;

        IF COALESCE(v_pending_balance, 0) <= 0.01 THEN
            UPDATE public.sales_invoices 
            SET status = 'paid', updated_at = now()
            WHERE id = _invoice_id;
        ELSE
            UPDATE public.sales_invoices 
            SET updated_at = now()
            WHERE id = _invoice_id;
        END IF;

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
            'Pago Factura Compra ' || v_invoice_num
        );

        -- Línea 2: Crédito a Cuenta de Banco (Activo disminuye)
        INSERT INTO public.journal_entry_lines (
            journal_entry_id, line_no, account_id, party_id, debit, credit, memo
        ) VALUES (
            v_je_id, 2, v_bank.account_id, v_party_id, 0, v_amount,
            'Salida Bancaria ' || v_bank.bank_name || ' — ' || v_line.description
        );

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

        -- 3. Calcular saldo restante y si queda en 0, actualizar estado a 'paid'
        SELECT (pi.total_amount - COALESCE(SUM(ip.amount), 0))
        INTO v_pending_balance
        FROM public.purchase_invoices pi
        LEFT JOIN public.invoice_payments ip ON ip.purchase_invoice_id = pi.id
        WHERE pi.id = _invoice_id
        GROUP BY pi.id, pi.total_amount;

        IF COALESCE(v_pending_balance, 0) <= 0.01 THEN
            UPDATE public.purchase_invoices 
            SET status = 'paid', updated_at = now()
            WHERE id = _invoice_id;
        ELSE
            UPDATE public.purchase_invoices 
            SET updated_at = now()
            WHERE id = _invoice_id;
        END IF;

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

-- 5. Re-compilar unreconcile_bank_line
CREATE OR REPLACE FUNCTION public.unreconcile_bank_line(_line_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_line public.bank_statement_lines%ROWTYPE;
BEGIN
    SELECT * INTO v_line 
    FROM public.bank_statement_lines 
    WHERE id = _line_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Línea bancaria % no encontrada.', _line_id;
    END IF;

    IF v_line.reconciliation_status <> 'reconciled' THEN
        RAISE EXCEPTION 'La línea no está conciliada.';
    END IF;

    -- Eliminar registro de pago
    IF v_line.payment_id IS NOT NULL THEN
        DELETE FROM public.invoice_payments WHERE id = v_line.payment_id;
    END IF;

    -- Reversar comprobante contable si existe
    IF v_line.matched_journal_entry_id IS NOT NULL THEN
        BEGIN
            PERFORM public.reverse_journal_entry(v_line.matched_journal_entry_id);
        EXCEPTION WHEN OTHERS THEN
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
