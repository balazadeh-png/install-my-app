-- ============================================================================
-- Sprint 3: Multimoneda a Nivel de Cuenta y Comprobantes — EasyERP
-- ============================================================================

-- 1. Columna currency_code en accounts (moneda propia de la cuenta)
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS currency_code text REFERENCES public.currencies(code) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_accounts_currency ON public.accounts(currency_code);

-- 2. Columnas multimoneda en journal_entry_lines
ALTER TABLE public.journal_entry_lines
ADD COLUMN IF NOT EXISTS currency_code text REFERENCES public.currencies(code) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS exchange_rate numeric(20,9) DEFAULT 1,
ADD COLUMN IF NOT EXISTS debit_account_currency numeric(20,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_account_currency numeric(20,4) DEFAULT 0;

-- 3. Función get_exchange_rate con validación de fecha exacta
CREATE OR REPLACE FUNCTION public.get_exchange_rate(_origin text, _destination text, _date date)
RETURNS numeric(20,9)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_rate numeric(20,9);
BEGIN
    IF _origin IS NULL OR _destination IS NULL OR _origin = _destination THEN
        RETURN 1.0;
    END IF;

    -- Buscar tasa directa exacta
    SELECT rate INTO v_rate 
    FROM public.exchange_rates
    WHERE origin = _origin AND destination = _destination AND date = _date;

    IF v_rate IS NOT NULL AND v_rate > 0 THEN
        RETURN v_rate;
    END IF;

    -- Buscar tasa inversa si existe
    SELECT (1.0 / rate) INTO v_rate 
    FROM public.exchange_rates
    WHERE origin = _destination AND destination = _origin AND date = _date AND rate > 0;

    IF v_rate IS NOT NULL THEN
        RETURN v_rate;
    END IF;

    RAISE EXCEPTION 'No existe tasa de cambio % -> % para la fecha %. Registre la tasa oficial antes de continuar.', _origin, _destination, _date;
END;
$$;

REVOKE ALL ON FUNCTION public.get_exchange_rate(text, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_exchange_rate(text, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_exchange_rate(text, text, date) TO service_role;

-- 4. Trigger para resolver moneda de cuenta y calcular montos en moneda funcional
CREATE OR REPLACE FUNCTION public.resolve_line_currency_amounts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_entity_currency text;
    v_account_currency text;
    v_posting_date date;
BEGIN
    -- Obtener la moneda funcional de la empresa y la fecha del comprobante
    SELECT COALESCE(e.base_currency_code, 'CLP'), je.posting_date 
    INTO v_entity_currency, v_posting_date
    FROM public.journal_entries je 
    JOIN public.entities e ON e.id = je.entity_id
    WHERE je.id = NEW.journal_entry_id;

    IF v_entity_currency IS NULL THEN
        v_entity_currency := 'CLP';
    END IF;

    -- Obtener la moneda de la cuenta contable
    SELECT COALESCE(currency_code, v_entity_currency) 
    INTO v_account_currency
    FROM public.accounts 
    WHERE id = NEW.account_id;

    IF v_account_currency IS NULL THEN
        v_account_currency := v_entity_currency;
    END IF;

    NEW.currency_code := v_account_currency;

    -- Si los montos en moneda de cuenta vienen vacíos pero vienen debit/credit, inicializarlos
    IF (NEW.debit_account_currency IS NULL OR NEW.debit_account_currency = 0) AND NEW.debit > 0 THEN
        NEW.debit_account_currency := NEW.debit;
    ELSE
        NEW.debit_account_currency := COALESCE(NEW.debit_account_currency, 0);
    END IF;

    IF (NEW.credit_account_currency IS NULL OR NEW.credit_account_currency = 0) AND NEW.credit > 0 THEN
        NEW.credit_account_currency := NEW.credit;
    ELSE
        NEW.credit_account_currency := COALESCE(NEW.credit_account_currency, 0);
    END IF;

    -- Si la moneda es la misma que la funcional de la empresa
    IF v_account_currency = v_entity_currency THEN
        NEW.exchange_rate := 1.0;
        NEW.debit := NEW.debit_account_currency;
        NEW.credit := NEW.credit_account_currency;
    ELSE
        -- Si no se proveyó una tasa de cambio positiva, obtenerla de exchange_rates para esa fecha
        IF NEW.exchange_rate IS NULL OR NEW.exchange_rate <= 0 THEN
            NEW.exchange_rate := public.get_exchange_rate(v_account_currency, v_entity_currency, v_posting_date);
        END IF;

        NEW.debit := ROUND(NEW.debit_account_currency * NEW.exchange_rate, 4);
        NEW.credit := ROUND(NEW.credit_account_currency * NEW.exchange_rate, 4);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resolve_line_currency ON public.journal_entry_lines;
CREATE TRIGGER trg_resolve_line_currency
BEFORE INSERT OR UPDATE ON public.journal_entry_lines
FOR EACH ROW EXECUTE FUNCTION public.resolve_line_currency_amounts();
