-- ============================================================================
-- Sprint 7: Cierre de Período y Revalorización Cambiaria Multimoneda — EasyERP
-- ============================================================================

-- 1. Agregar cuentas de diferencia de cambio no realizada
ALTER TABLE public.company_default_accounts
  ADD COLUMN IF NOT EXISTS unrealized_exchange_gain_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unrealized_exchange_loss_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;

-- 2. Estado de Período Contable
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'period_status') THEN
        CREATE TYPE public.period_status AS ENUM ('open', 'closed');
    END IF;
END $$;

ALTER TABLE public.accounting_periods 
  ADD COLUMN IF NOT EXISTS status public.period_status DEFAULT 'open' NOT NULL;

-- 3. Columna skip_currency_resolution en líneas de comprobante contable
ALTER TABLE public.journal_entry_lines
  ADD COLUMN IF NOT EXISTS skip_currency_resolution boolean DEFAULT false NOT NULL;

-- 4. Modificar trigger de multimoneda para respetar skip_currency_resolution
CREATE OR REPLACE FUNCTION public.resolve_line_currency_amounts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_acc_currency text;
    v_base_currency text;
    v_entity_id uuid;
    v_posting_date date;
    v_rate numeric(20,9);
BEGIN
    IF NEW.skip_currency_resolution IS TRUE THEN
        RETURN NEW;
    END IF;

    -- Obtener moneda de la cuenta
    SELECT currency_code INTO v_acc_currency FROM public.accounts WHERE id = NEW.account_id;

    -- Obtener entidad y fecha del comprobante
    SELECT entity_id, posting_date INTO v_entity_id, v_posting_date
    FROM public.journal_entries WHERE id = NEW.journal_entry_id;

    -- Obtener moneda base de la empresa
    SELECT base_currency_code INTO v_base_currency FROM public.entities WHERE id = v_entity_id;
    v_base_currency := COALESCE(v_base_currency, 'CLP');

    -- Si la cuenta no tiene moneda asignada, asume la moneda base
    NEW.currency_code := COALESCE(v_acc_currency, v_base_currency);

    IF NEW.currency_code = v_base_currency THEN
        NEW.exchange_rate := 1.0;
        NEW.debit := COALESCE(NEW.debit, NEW.debit_account_currency, 0);
        NEW.credit := COALESCE(NEW.credit, NEW.credit_account_currency, 0);
        NEW.debit_account_currency := NEW.debit;
        NEW.credit_account_currency := NEW.credit;
    ELSE
        -- Moneda extranjera: resolver tipo de cambio
        IF NEW.exchange_rate IS NULL OR NEW.exchange_rate <= 0 THEN
            NEW.exchange_rate := public.get_exchange_rate(NEW.currency_code, v_base_currency, v_posting_date);
        END IF;

        IF COALESCE(NEW.debit_account_currency, 0) > 0 THEN
            NEW.credit_account_currency := 0;
            NEW.credit := 0;
            NEW.debit := ROUND(NEW.debit_account_currency * NEW.exchange_rate);
        ELSIF COALESCE(NEW.credit_account_currency, 0) > 0 THEN
            NEW.debit_account_currency := 0;
            NEW.debit := 0;
            NEW.credit := ROUND(NEW.credit_account_currency * NEW.exchange_rate);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resolve_line_currency ON public.journal_entry_lines;
CREATE TRIGGER trg_resolve_line_currency
BEFORE INSERT OR UPDATE ON public.journal_entry_lines
FOR EACH ROW
WHEN (NEW.skip_currency_resolution IS NOT TRUE)
EXECUTE FUNCTION public.resolve_line_currency_amounts();

-- 5. Tablas para Revalorización de Diferencia de Cambio
CREATE TABLE IF NOT EXISTS public.exchange_revaluations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT NOT NULL,
    revaluation_date date NOT NULL,
    journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_er_entity ON public.exchange_revaluations(entity_id);
CREATE INDEX IF NOT EXISTS ix_er_date ON public.exchange_revaluations(revaluation_date);

ALTER TABLE public.exchange_revaluations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.exchange_revaluation_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    exchange_revaluation_id uuid REFERENCES public.exchange_revaluations(id) ON DELETE CASCADE NOT NULL,
    account_id uuid REFERENCES public.accounts(id) ON DELETE RESTRICT NOT NULL,
    balance_account_currency numeric(20,4) NOT NULL,
    book_balance numeric(20,4) NOT NULL,
    closing_rate numeric(20,9) NOT NULL,
    revalued_balance numeric(20,4) NOT NULL,
    adjustment_amount numeric(20,4) NOT NULL, -- En moneda base (CLP)
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_eri_rev ON public.exchange_revaluation_items(exchange_revaluation_id);

ALTER TABLE public.exchange_revaluation_items ENABLE ROW LEVEL SECURITY;

-- 6. Checklist de Cierre de Período
CREATE TABLE IF NOT EXISTS public.period_close_checks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    accounting_period_id uuid REFERENCES public.accounting_periods(id) ON DELETE CASCADE NOT NULL,
    check_name text NOT NULL,
    passed boolean DEFAULT false NOT NULL,
    checked_at timestamptz,
    checked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_pcc_period ON public.period_close_checks(accounting_period_id);

ALTER TABLE public.period_close_checks ENABLE ROW LEVEL SECURITY;

-- 7. Actualizar post_journal_entry para validar períodos cerrados
CREATE OR REPLACE FUNCTION public.post_journal_entry(_journal_entry_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_entry RECORD;
    v_total_debit numeric(20,4) := 0;
    v_total_credit numeric(20,4) := 0;
    v_line_count int := 0;
    v_closed_period RECORD;
BEGIN
    SELECT * INTO v_entry FROM public.journal_entries WHERE id = _journal_entry_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Comprobante contable no encontrado.';
    END IF;

    IF v_entry.status = 'posted' THEN
        RETURN json_build_object('success', true, 'status', 'already_posted', 'entry_number', v_entry.entry_number)::jsonb;
    END IF;

    -- Validar si la fecha del comprobante pertenece a un período cerrado
    SELECT * INTO v_closed_period FROM public.accounting_periods 
    WHERE entity_id = v_entry.entity_id 
      AND v_entry.posting_date >= start_date 
      AND v_entry.posting_date <= end_date 
      AND status = 'closed'
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'No se puede postear el comprobante: el período contable "%" (% al %) está cerrado.', 
            v_closed_period.name, v_closed_period.start_date, v_closed_period.end_date;
    END IF;

    -- Sumar débitos y créditos
    SELECT 
        COALESCE(SUM(debit), 0),
        COALESCE(SUM(credit), 0),
        COUNT(*)
    INTO v_total_debit, v_total_credit, v_line_count
    FROM public.journal_entry_lines
    WHERE journal_entry_id = _journal_entry_id;

    IF v_line_count < 2 THEN
        RAISE EXCEPTION 'El comprobante debe tener al menos dos líneas contables.';
    END IF;

    IF v_total_debit = 0 OR v_total_credit = 0 THEN
        RAISE EXCEPTION 'El comprobante no puede tener débitos o créditos en cero.';
    END IF;

    IF ABS(v_total_debit - v_total_credit) > 0.0001 THEN
        RAISE EXCEPTION 'Comprobante descuadrado: Total Débito (%) <> Total Crédito (%)', v_total_debit, v_total_credit;
    END IF;

    IF v_entry.entry_number IS NULL OR v_entry.entry_number = '' THEN
        v_entry.entry_number := public.get_next_entry_number(v_entry.entity_id, 'ASI-');
    END IF;

    UPDATE public.journal_entries
    SET status = 'posted',
        entry_number = v_entry.entry_number,
        updated_at = now()
    WHERE id = _journal_entry_id;

    RETURN json_build_object(
        'success', true,
        'journal_entry_id', _journal_entry_id,
        'entry_number', v_entry.entry_number,
        'total_amount', v_total_debit
    )::jsonb;
END;
$$;

-- 8. Función Transaccional: Revalorización Cambiaria al Cierre de Período
CREATE OR REPLACE FUNCTION public.run_exchange_revaluation(
    _entity_id uuid,
    _revaluation_date date
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_base_curr text;
    v_defaults RECORD;
    v_acc RECORD;
    v_foreign_balance numeric(20,4);
    v_book_balance numeric(20,4);
    v_closing_rate numeric(20,9);
    v_revalued_balance numeric(20,4);
    v_diff numeric(20,4);
    v_rev_id uuid;
    v_je_id uuid;
    v_line_no int := 1;
    v_items_count int := 0;
    v_total_gain numeric(20,4) := 0;
    v_total_loss numeric(20,4) := 0;
    v_post_res jsonb;
BEGIN
    SELECT base_currency_code INTO v_base_curr FROM public.entities WHERE id = _entity_id;
    v_base_curr := COALESCE(v_base_curr, 'CLP');

    SELECT * INTO v_defaults FROM public.company_default_accounts WHERE entity_id = _entity_id;
    IF NOT FOUND OR v_defaults.unrealized_exchange_gain_account_id IS NULL OR v_defaults.unrealized_exchange_loss_account_id IS NULL THEN
        RAISE EXCEPTION 'Configure las cuentas de Diferencia de Cambio No Realizada (Ganancia y Pérdida) en Configuración antes de ejecutar la revalorización.';
    END IF;

    -- Registrar corrida
    INSERT INTO public.exchange_revaluations (
        entity_id,
        revaluation_date,
        created_by
    ) VALUES (
        _entity_id,
        _revaluation_date,
        auth.uid()
    ) RETURNING id INTO v_rev_id;

    -- Crear cabecera de comprobante de ajuste
    INSERT INTO public.journal_entries (
        entity_id,
        posting_date,
        voucher_type,
        memo,
        status,
        created_by
    ) VALUES (
        _entity_id,
        _revaluation_date,
        'Revalorización Cambiaria',
        'Ajuste por Diferencia de Cambio no Realizada al ' || _revaluation_date,
        'draft',
        auth.uid()
    ) RETURNING id INTO v_je_id;

    -- Recorrer cuentas en moneda extranjera
    FOR v_acc IN 
        SELECT id, code, name, currency_code, account_type 
        FROM public.accounts 
        WHERE entity_id = _entity_id 
          AND currency_code IS NOT NULL 
          AND currency_code <> v_base_curr
          AND active = true
    LOOP
        -- Calcular saldo en divisa y saldo en libros (moneda funcional)
        SELECT 
            COALESCE(SUM(l.debit_account_currency - l.credit_account_currency), 0),
            COALESCE(SUM(l.debit - l.credit), 0)
        INTO v_foreign_balance, v_book_balance
        FROM public.journal_entry_lines l
        JOIN public.journal_entries j ON j.id = l.journal_entry_id
        WHERE l.account_id = v_acc.id
          AND j.status = 'posted'
          AND j.posting_date <= _revaluation_date;

        IF v_foreign_balance <> 0 THEN
            v_closing_rate := public.get_exchange_rate(v_acc.currency_code, v_base_curr, _revaluation_date);
            v_revalued_balance := ROUND(v_foreign_balance * v_closing_rate);
            v_diff := v_revalued_balance - v_book_balance;

            IF v_diff <> 0 THEN
                v_items_count := v_items_count + 1;

                -- Guardar detalle de auditoría
                INSERT INTO public.exchange_revaluation_items (
                    exchange_revaluation_id,
                    account_id,
                    balance_account_currency,
                    book_balance,
                    closing_rate,
                    revalued_balance,
                    adjustment_amount
                ) VALUES (
                    v_rev_id,
                    v_acc.id,
                    v_foreign_balance,
                    v_book_balance,
                    v_closing_rate,
                    v_revalued_balance,
                    v_diff
                );

                -- Si v_diff > 0 (subió el activo o bajó el pasivo => Ganancia / Débito a cuenta, Crédito a Ganancia)
                IF v_diff > 0 THEN
                    v_total_gain := v_total_gain + v_diff;

                    -- Débito a la cuenta revalorizada
                    INSERT INTO public.journal_entry_lines (
                        journal_entry_id,
                        line_no,
                        account_id,
                        currency_code,
                        exchange_rate,
                        debit_account_currency,
                        credit_account_currency,
                        debit,
                        credit,
                        skip_currency_resolution,
                        memo
                    ) VALUES (
                        v_je_id,
                        v_line_no,
                        v_acc.id,
                        v_base_curr,
                        1.0,
                        v_diff,
                        0,
                        v_diff,
                        0,
                        true,
                        'Ajuste por Revalorización USD a ' || _revaluation_date
                    );
                    v_line_no := v_line_no + 1;

                    -- Crédito a Ganancia no Realizada
                    INSERT INTO public.journal_entry_lines (
                        journal_entry_id,
                        line_no,
                        account_id,
                        currency_code,
                        exchange_rate,
                        debit_account_currency,
                        credit_account_currency,
                        debit,
                        credit,
                        skip_currency_resolution,
                        memo
                    ) VALUES (
                        v_je_id,
                        v_line_no,
                        v_defaults.unrealized_exchange_gain_account_id,
                        v_base_curr,
                        1.0,
                        0,
                        v_diff,
                        0,
                        v_diff,
                        true,
                        'Ganancia no Realizada Tipo de Cambio al ' || _revaluation_date
                    );
                    v_line_no := v_line_no + 1;
                ELSE
                    -- v_diff < 0 (Pérdida / Débito a Pérdida, Crédito a la cuenta)
                    v_total_loss := v_total_loss + ABS(v_diff);

                    -- Débito a Pérdida no Realizada
                    INSERT INTO public.journal_entry_lines (
                        journal_entry_id,
                        line_no,
                        account_id,
                        currency_code,
                        exchange_rate,
                        debit_account_currency,
                        credit_account_currency,
                        debit,
                        credit,
                        skip_currency_resolution,
                        memo
                    ) VALUES (
                        v_je_id,
                        v_line_no,
                        v_defaults.unrealized_exchange_loss_account_id,
                        v_base_curr,
                        1.0,
                        ABS(v_diff),
                        0,
                        ABS(v_diff),
                        0,
                        true,
                        'Pérdida no Realizada Tipo de Cambio al ' || _revaluation_date
                    );
                    v_line_no := v_line_no + 1;

                    -- Crédito a la cuenta revalorizada
                    INSERT INTO public.journal_entry_lines (
                        journal_entry_id,
                        line_no,
                        account_id,
                        currency_code,
                        exchange_rate,
                        debit_account_currency,
                        credit_account_currency,
                        debit,
                        credit,
                        skip_currency_resolution,
                        memo
                    ) VALUES (
                        v_je_id,
                        v_line_no,
                        v_acc.id,
                        v_base_curr,
                        1.0,
                        0,
                        ABS(v_diff),
                        0,
                        ABS(v_diff),
                        true,
                        'Ajuste por Revalorización USD a ' || _revaluation_date
                    );
                    v_line_no := v_line_no + 1;
                END IF;
            END IF;
        END IF;
    END LOOP;

    IF v_items_count > 0 THEN
        v_post_res := public.post_journal_entry(v_je_id);
        UPDATE public.exchange_revaluations SET journal_entry_id = v_je_id WHERE id = v_rev_id;
    ELSE
        -- Si no hubo diferencias, descartar cabecera vacía
        DELETE FROM public.journal_entries WHERE id = v_je_id;
    END IF;

    RETURN json_build_object(
        'success', true,
        'revaluation_id', v_rev_id,
        'items_revalued', v_items_count,
        'total_gain', v_total_gain,
        'total_loss', v_total_loss,
        'journal_entry_id', CASE WHEN v_items_count > 0 THEN v_je_id ELSE NULL END
    )::jsonb;
END;
$$;

-- 9. Función para Cerrar Período Contable
CREATE OR REPLACE FUNCTION public.close_accounting_period(_period_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_period RECORD;
    v_draft_count int;
BEGIN
    SELECT * INTO v_period FROM public.accounting_periods WHERE id = _period_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Período contable no encontrado.';
    END IF;

    IF v_period.status = 'closed' THEN
        RAISE EXCEPTION 'El período contable ya se encuentra cerrado.';
    END IF;

    -- Verificar comprobantes en borrador en ese rango de fechas
    SELECT COUNT(*) INTO v_draft_count
    FROM public.journal_entries
    WHERE entity_id = v_period.entity_id
      AND posting_date >= v_period.start_date
      AND posting_date <= v_period.end_date
      AND status = 'draft';

    IF v_draft_count > 0 THEN
        RAISE EXCEPTION 'Existen % comprobantes en estado borrador dentro de las fechas del período. Debe postearlos o eliminarlos antes del cierre.', v_draft_count;
    END IF;

    UPDATE public.accounting_periods
    SET status = 'closed',
        closed = true
    WHERE id = _period_id;

    RETURN json_build_object(
        'success', true,
        'period_id', _period_id,
        'status', 'closed'
    )::jsonb;
END;
$$;

-- 10. Políticas RLS
CREATE POLICY "read_exchange_revaluations" ON public.exchange_revaluations
FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_exchange_revaluations" ON public.exchange_revaluations
FOR ALL TO authenticated USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

CREATE POLICY "read_exchange_revaluation_items" ON public.exchange_revaluation_items
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.exchange_revaluations er 
    WHERE er.id = exchange_revaluation_id 
    AND public.user_has_company_access(auth.uid(), er.entity_id)
  )
);

CREATE POLICY "write_exchange_revaluation_items" ON public.exchange_revaluation_items
FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.exchange_revaluations er 
    WHERE er.id = exchange_revaluation_id 
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
    AND public.user_has_company_access(auth.uid(), er.entity_id)
  )
);

CREATE POLICY "read_period_close_checks" ON public.period_close_checks
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.accounting_periods ap 
    WHERE ap.id = accounting_period_id 
    AND public.user_has_company_access(auth.uid(), ap.entity_id)
  )
);

CREATE POLICY "write_period_close_checks" ON public.period_close_checks
FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.accounting_periods ap 
    WHERE ap.id = accounting_period_id 
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
    AND public.user_has_company_access(auth.uid(), ap.entity_id)
  )
);
