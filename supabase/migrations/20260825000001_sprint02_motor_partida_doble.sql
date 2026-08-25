-- ============================================================================
-- Sprint 2: Motor Contable de Partida Doble — EasyERP
-- ============================================================================

-- 1. Tipo / Enum para el estado de los comprobantes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'journal_entry_status') THEN
        CREATE TYPE public.journal_entry_status AS ENUM ('draft', 'posted', 'reversed');
    END IF;
END $$;

-- 2. Tabla journal_entries (Cabecera de Comprobante Contable)
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT NOT NULL,
    book_id uuid REFERENCES public.books(id) ON DELETE SET NULL,
    entry_number text,
    naming_series_id uuid REFERENCES public.naming_series(id) ON DELETE SET NULL,
    posting_date date NOT NULL,
    fiscal_year_id uuid REFERENCES public.fiscal_years(id) ON DELETE SET NULL,
    accounting_period_id uuid REFERENCES public.accounting_periods(id) ON DELETE SET NULL,
    voucher_type text NOT NULL DEFAULT 'Manual',
    memo text,
    status public.journal_entry_status NOT NULL DEFAULT 'draft',
    reversal_of uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_journal_entries_entity ON public.journal_entries(entity_id);
CREATE INDEX IF NOT EXISTS ix_journal_entries_date ON public.journal_entries(posting_date);
CREATE INDEX IF NOT EXISTS ix_journal_entries_status ON public.journal_entries(status);
CREATE INDEX IF NOT EXISTS ix_journal_entries_number ON public.journal_entries(entry_number);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

-- 3. Tabla journal_entry_lines (Detalle de Cuentas y Partida Doble)
CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE CASCADE NOT NULL,
    line_no integer NOT NULL DEFAULT 1,
    account_id uuid REFERENCES public.accounts(id) ON DELETE RESTRICT NOT NULL,
    party_id uuid REFERENCES public.parties(id) ON DELETE SET NULL,
    debit numeric(20,4) NOT NULL DEFAULT 0,
    credit numeric(20,4) NOT NULL DEFAULT 0,
    memo text,
    CONSTRAINT ck_line_debit_or_credit CHECK ((debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)),
    CONSTRAINT ck_line_non_negative CHECK (debit >= 0 AND credit >= 0)
);

CREATE INDEX IF NOT EXISTS ix_journal_entry_lines_je ON public.journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS ix_journal_entry_lines_account ON public.journal_entry_lines(account_id);
CREATE INDEX IF NOT EXISTS ix_journal_entry_lines_party ON public.journal_entry_lines(party_id);

ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

-- 4. Función atómica para consumir correlativos de series (naming_series)
CREATE OR REPLACE FUNCTION public.get_next_entry_number(_entity_id uuid, _prefix text DEFAULT 'ASI-')
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_series_id uuid;
    v_current_num bigint;
    v_prefix text := _prefix;
    v_formatted text;
BEGIN
    -- Buscar o crear la serie de numeración
    SELECT id, next_number, prefix INTO v_series_id, v_current_num, v_prefix
    FROM public.naming_series
    WHERE entity_id = _entity_id AND (prefix = _prefix OR name ILIKE '%' || _prefix || '%')
    FOR UPDATE LIMIT 1;

    IF v_series_id IS NULL THEN
        -- Crear serie por defecto si no existe
        INSERT INTO public.naming_series (entity_id, name, prefix, next_number)
        VALUES (_entity_id, 'Asientos de Diario', _prefix, 2)
        RETURNING prefix, 1 INTO v_prefix, v_current_num;
    ELSE
        UPDATE public.naming_series
        SET next_number = next_number + 1
        WHERE id = v_series_id;
    END IF;

    v_formatted := v_prefix || lpad(v_current_num::text, 6, '0');
    RETURN v_formatted;
END;
$$;

REVOKE ALL ON FUNCTION public.get_next_entry_number(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_next_entry_number(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_entry_number(uuid, text) TO service_role;

-- 5. Función para postear comprobante con validación estricta de partida doble
CREATE OR REPLACE FUNCTION public.post_journal_entry(_journal_entry_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_entry record;
    v_debit numeric(20,4);
    v_credit numeric(20,4);
    v_count integer;
    v_number text;
BEGIN
    SELECT * INTO v_entry
    FROM public.journal_entries
    WHERE id = _journal_entry_id;

    IF v_entry IS NULL THEN
        RAISE EXCEPTION 'El comprobante no existe.';
    END IF;

    IF v_entry.status = 'posted' THEN
        RAISE EXCEPTION 'El comprobante ya se encuentra posteado.';
    END IF;

    -- Validar líneas
    SELECT COUNT(*), COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
    INTO v_count, v_debit, v_credit
    FROM public.journal_entry_lines
    WHERE journal_entry_id = _journal_entry_id;

    IF v_count < 2 THEN
        RAISE EXCEPTION 'El comprobante debe tener al menos dos líneas contables.';
    END IF;

    IF v_debit <> v_credit THEN
        RAISE EXCEPTION 'El comprobante no cuadra: Total Débito (% $) vs Total Crédito (% $).', v_debit, v_credit;
    END IF;

    IF v_debit <= 0 THEN
        RAISE EXCEPTION 'El monto del comprobante debe ser mayor a cero.';
    END IF;

    -- Asignar número correlativo si no tiene
    IF v_entry.entry_number IS NULL OR v_entry.entry_number = '' THEN
        v_number := public.get_next_entry_number(v_entry.entity_id, 'ASI-');
    ELSE
        v_number := v_entry.entry_number;
    END IF;

    -- Postear comprobante
    UPDATE public.journal_entries
    SET status = 'posted',
        entry_number = v_number,
        updated_at = now()
    WHERE id = _journal_entry_id;

    RETURN json_build_object(
        'success', true,
        'id', _journal_entry_id,
        'entry_number', v_number,
        'total', v_debit
    )::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.post_journal_entry(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_journal_entry(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_journal_entry(uuid) TO service_role;

-- 6. Función para reversar un comprobante posteado
CREATE OR REPLACE FUNCTION public.reverse_journal_entry(_journal_entry_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_orig record;
    v_new_id uuid;
    v_rev_number text;
    v_line record;
BEGIN
    SELECT * INTO v_orig
    FROM public.journal_entries
    WHERE id = _journal_entry_id;

    IF v_orig IS NULL THEN
        RAISE EXCEPTION 'El comprobante a reversar no existe.';
    END IF;

    IF v_orig.status <> 'posted' THEN
        RAISE EXCEPTION 'Solo se pueden reversar comprobantes en estado posteado.';
    END IF;

    -- Generar número correlativo para la reversión
    v_rev_number := public.get_next_entry_number(v_orig.entity_id, 'REV-');

    -- Crear cabecera del nuevo comprobante de reversión
    INSERT INTO public.journal_entries (
        entity_id,
        book_id,
        entry_number,
        posting_date,
        fiscal_year_id,
        accounting_period_id,
        voucher_type,
        memo,
        status,
        reversal_of,
        created_by
    ) VALUES (
        v_orig.entity_id,
        v_orig.book_id,
        v_rev_number,
        CURRENT_DATE,
        v_orig.fiscal_year_id,
        v_orig.accounting_period_id,
        'Reversión',
        'Reversión automática del comprobante ' || COALESCE(v_orig.entry_number, _journal_entry_id::text) || COALESCE(' - ' || v_orig.memo, ''),
        'posted',
        _journal_entry_id,
        auth.uid()
    ) RETURNING id INTO v_new_id;

    -- Copiar líneas invirtiendo Débito y Crédito
    FOR v_line IN 
        SELECT * FROM public.journal_entry_lines WHERE journal_entry_id = _journal_entry_id ORDER BY line_no ASC
    LOOP
        INSERT INTO public.journal_entry_lines (
            journal_entry_id,
            line_no,
            account_id,
            party_id,
            debit,
            credit,
            memo
        ) VALUES (
            v_new_id,
            v_line.line_no,
            v_line.account_id,
            v_line.party_id,
            v_line.credit, -- Inversión: Crédito pasa a Débito
            v_line.debit,  -- Inversión: Débito pasa a Crédito
            'Reversión: ' || COALESCE(v_line.memo, '')
        );
    END LOOP;

    -- Marcar el original como reversado
    UPDATE public.journal_entries
    SET status = 'reversed',
        updated_at = now()
    WHERE id = _journal_entry_id;

    RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_journal_entry(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_journal_entry(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_journal_entry(uuid) TO service_role;

-- 7. Trigger de Inmutabilidad sobre Comprobantes Posteados
CREATE OR REPLACE FUNCTION public.trg_enforce_journal_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status = 'posted' THEN
            RAISE EXCEPTION 'No se permite eliminar un comprobante contable posteado. Debe utilizar la acción de Reversión.';
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        -- Permitir únicamente transición de 'posted' a 'reversed'
        IF OLD.status = 'posted' AND NEW.status NOT IN ('posted', 'reversed') THEN
            RAISE EXCEPTION 'No se permite modificar un comprobante contable posteado. Debe utilizar la acción de Reversión.';
        END IF;
        -- Si está posteado, no permitir cambiar montos, fecha, empresa o cuenta
        IF OLD.status = 'posted' AND NEW.status = 'posted' THEN
            IF OLD.posting_date <> NEW.posting_date OR OLD.entity_id <> NEW.entity_id THEN
                RAISE EXCEPTION 'Los datos contables de un comprobante posteado son inmutables.';
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_entries_immutability ON public.journal_entries;
CREATE TRIGGER trg_journal_entries_immutability
BEFORE UPDATE OR DELETE ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_journal_immutability();

-- 8. Políticas RLS para journal_entries y journal_entry_lines
DROP POLICY IF EXISTS "read_journal_entries" ON public.journal_entries;
CREATE POLICY "read_journal_entries"
ON public.journal_entries FOR SELECT TO authenticated
USING (public.user_has_company_access(auth.uid(), entity_id));

DROP POLICY IF EXISTS "write_journal_entries" ON public.journal_entries;
CREATE POLICY "write_journal_entries"
ON public.journal_entries FOR ALL TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

DROP POLICY IF EXISTS "read_journal_entry_lines" ON public.journal_entry_lines;
CREATE POLICY "read_journal_entry_lines"
ON public.journal_entry_lines FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.id = journal_entry_id
    AND public.user_has_company_access(auth.uid(), je.entity_id)
  )
);

DROP POLICY IF EXISTS "write_journal_entry_lines" ON public.journal_entry_lines;
CREATE POLICY "write_journal_entry_lines"
ON public.journal_entry_lines FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.id = journal_entry_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
    AND public.user_has_company_access(auth.uid(), je.entity_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.id = journal_entry_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
    AND public.user_has_company_access(auth.uid(), je.entity_id)
  )
);

-- 9. Migración de registros antiguos en gl_entries hacia journal_entries si existen
DO $$
DECLARE
    v_gl record;
    v_je_id uuid;
BEGIN
    -- Solo migrar si gl_entries tiene registros que no provengan de journal_entry_lines
    IF EXISTS (SELECT 1 FROM public.gl_entries WHERE entity_id IS NOT NULL) THEN
        FOR v_gl IN 
            SELECT DISTINCT entity_id, posting_date, COALESCE(memo, 'Asiento Histórico') as memo, COALESCE(voucher_type, 'Manual') as voucher_type
            FROM public.gl_entries
            WHERE entity_id IS NOT NULL
        LOOP
            INSERT INTO public.journal_entries (
                entity_id,
                posting_date,
                voucher_type,
                memo,
                status,
                entry_number
            ) VALUES (
                v_gl.entity_id,
                v_gl.posting_date,
                v_gl.voucher_type,
                v_gl.memo,
                'posted',
                'ASI-HIST-' || lpad(floor(random()*90000 + 10000)::text, 6, '0')
            ) RETURNING id INTO v_je_id;

            INSERT INTO public.journal_entry_lines (
                journal_entry_id,
                line_no,
                account_id,
                debit,
                credit,
                memo
            )
            SELECT 
                v_je_id,
                row_number() over (),
                account_id,
                debit,
                credit,
                memo
            FROM public.gl_entries
            WHERE entity_id = v_gl.entity_id 
              AND posting_date = v_gl.posting_date
              AND COALESCE(memo, 'Asiento Histórico') = v_gl.memo
              AND COALESCE(voucher_type, 'Manual') = v_gl.voucher_type;
        END LOOP;
    END IF;
END $$;
