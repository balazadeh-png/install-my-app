-- ============================================================================
-- Sprint 12: Motor de Impuestos SII — Formulario 29 (F29) y Formulario 22 (F22)
-- ============================================================================

-- 1. Enums para Tipos de Formulario, Estados y Regímenes Tributarios
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tax_form_type') THEN
        CREATE TYPE public.tax_form_type AS ENUM ('f29', 'f22');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tax_calculation_status') THEN
        CREATE TYPE public.tax_calculation_status AS ENUM ('draft', 'reviewed', 'filed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tax_regime_type') THEN
        CREATE TYPE public.tax_regime_type AS ENUM (
            '14A_general',
            '14D3_pro_pyme_general',
            '14D8_pro_pyme_transparente',
            'renta_presunta'
        );
    END IF;
END $$;

-- 2. Agregar Tasa de PPM y Régimen Tributario a la tabla entities
ALTER TABLE public.entities
  ADD COLUMN IF NOT EXISTS ppm_rate numeric(6,3) DEFAULT 0.25 NOT NULL,
  ADD COLUMN IF NOT EXISTS tax_regime public.tax_regime_type DEFAULT '14D3_pro_pyme_general' NOT NULL;

-- 3. Tabla tax_calculation_runs (Borradores y Liquidaciones Tributarias)
CREATE TABLE IF NOT EXISTS public.tax_calculation_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT NOT NULL,
    form_type public.tax_form_type NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    calculated_values jsonb NOT NULL DEFAULT '{}',
    status public.tax_calculation_status DEFAULT 'draft' NOT NULL,
    reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    filed_at timestamptz,
    notes text,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_tcr_entity ON public.tax_calculation_runs(entity_id);
CREATE INDEX IF NOT EXISTS ix_tcr_type ON public.tax_calculation_runs(form_type);
CREATE INDEX IF NOT EXISTS ix_tcr_status ON public.tax_calculation_runs(status);

ALTER TABLE public.tax_calculation_runs ENABLE ROW LEVEL SECURITY;

-- 4. Tabla tax_adjustments (Agregados y Deducciones para RLI en F22)
CREATE TABLE IF NOT EXISTS public.tax_adjustments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT NOT NULL,
    tax_calculation_run_id uuid REFERENCES public.tax_calculation_runs(id) ON DELETE CASCADE,
    adjustment_type text NOT NULL, -- 'agregado' | 'deduccion'
    description text NOT NULL,
    amount numeric(20,4) NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_ta_run ON public.tax_adjustments(tax_calculation_run_id);

ALTER TABLE public.tax_adjustments ENABLE ROW LEVEL SECURITY;

-- 5. Función Transaccional: Calcular Formulario 29 (F29 Mensual)
CREATE OR REPLACE FUNCTION public.calculate_f29(
    _entity_id uuid,
    _period_start date,
    _period_end date
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_entity RECORD;
    v_defaults RECORD;
    v_debito_fiscal numeric(20,4) := 0;
    v_credito_fiscal numeric(20,4) := 0;
    v_ventas_netas numeric(20,4) := 0;
    v_compras_netas numeric(20,4) := 0;
    v_remanente_anterior numeric(20,4) := 0;
    v_credito_total numeric(20,4) := 0;
    v_iva_determinado numeric(20,4) := 0;
    v_nuevo_remanente numeric(20,4) := 0;
    v_ppm_tasa numeric(6,3);
    v_ppm_monto numeric(20,4) := 0;
    v_total_a_pagar numeric(20,4) := 0;
    v_calculated_payload jsonb;
    v_run_id uuid;
BEGIN
    SELECT * INTO v_entity FROM public.entities WHERE id = _entity_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Empresa no encontrada.';
    END IF;

    v_ppm_tasa := COALESCE(v_entity.ppm_rate, 0.25);

    SELECT * INTO v_defaults FROM public.company_default_accounts WHERE entity_id = _entity_id;
    IF NOT FOUND OR v_defaults.output_tax_account_id IS NULL OR v_defaults.input_tax_account_id IS NULL THEN
        RAISE EXCEPTION 'Configure las Cuentas de IVA Débito e IVA Crédito en Configuración antes de calcular el F29.';
    END IF;

    -- 1. Calcular IVA Débito Fiscal (Crédito en cuenta de IVA Débito)
    SELECT COALESCE(SUM(l.credit - l.debit), 0) INTO v_debito_fiscal
    FROM public.journal_entry_lines l
    JOIN public.journal_entries j ON j.id = l.journal_entry_id
    WHERE j.entity_id = _entity_id
      AND j.status = 'posted'
      AND j.posting_date >= _period_start
      AND j.posting_date <= _period_end
      AND l.account_id = v_defaults.output_tax_account_id;

    -- 2. Calcular IVA Crédito Fiscal (Débito en cuenta de IVA Crédito)
    SELECT COALESCE(SUM(l.debit - l.credit), 0) INTO v_credito_fiscal
    FROM public.journal_entry_lines l
    JOIN public.journal_entries j ON j.id = l.journal_entry_id
    WHERE j.entity_id = _entity_id
      AND j.status = 'posted'
      AND j.posting_date >= _period_start
      AND j.posting_date <= _period_end
      AND l.account_id = v_defaults.input_tax_account_id;

    -- 3. Calcular Base Imponible PPM (Ventas Netas en cuenta de Ingresos)
    IF v_defaults.sales_income_account_id IS NOT NULL THEN
        SELECT COALESCE(SUM(l.credit - l.debit), 0) INTO v_ventas_netas
        FROM public.journal_entry_lines l
        JOIN public.journal_entries j ON j.id = l.journal_entry_id
        WHERE j.entity_id = _entity_id
          AND j.status = 'posted'
          AND j.posting_date >= _period_start
          AND j.posting_date <= _period_end
          AND l.account_id = v_defaults.sales_income_account_id;
    END IF;

    -- 4. Buscar remanente del mes anterior si existe
    SELECT COALESCE((calculated_values->>'nuevo_remanente')::numeric, 0) INTO v_remanente_anterior
    FROM public.tax_calculation_runs
    WHERE entity_id = _entity_id
      AND form_type = 'f29'
      AND period_end < _period_start
    ORDER BY period_end DESC
    LIMIT 1;

    -- 5. Liquidación de IVA
    v_credito_total := v_credito_fiscal + v_remanente_anterior;

    IF v_debito_fiscal >= v_credito_total THEN
        v_iva_determinado := v_debito_fiscal - v_credito_total;
        v_nuevo_remanente := 0;
    ELSE
        v_iva_determinado := 0;
        v_nuevo_remanente := v_credito_total - v_debito_fiscal;
    END IF;

    -- 6. Cálculo de PPM
    v_ppm_monto := ROUND((v_ventas_netas * v_ppm_tasa) / 100.0);
    v_total_a_pagar := v_iva_determinado + v_ppm_monto;

    -- Armar JSON estructurado
    v_calculated_payload := json_build_object(
        'debito_fiscal_iva', v_debito_fiscal,
        'credito_fiscal_iva', v_credito_fiscal,
        'remanente_anterior', v_remanente_anterior,
        'credito_total', v_credito_total,
        'iva_determinado_a_pagar', v_iva_determinado,
        'nuevo_remanente_mes_siguiente', v_nuevo_remanente,
        'base_imponible_ventas_netas', v_ventas_netas,
        'tasa_ppm_porcentaje', v_ppm_tasa,
        'monto_ppm_determinado', v_ppm_monto,
        'total_a_pagar_f29', v_total_a_pagar
    )::jsonb;

    -- Insertar corrida
    INSERT INTO public.tax_calculation_runs (
        entity_id,
        form_type,
        period_start,
        period_end,
        calculated_values,
        status,
        created_by
    ) VALUES (
        _entity_id,
        'f29',
        _period_start,
        _period_end,
        v_calculated_payload,
        'draft',
        auth.uid()
    ) RETURNING id INTO v_run_id;

    RETURN json_build_object(
        'success', true,
        'run_id', v_run_id,
        'calculated_values', v_calculated_payload
    )::jsonb;
END;
$$;

-- 6. Función Transaccional: Calcular Borrador Formulario 22 (F22 Anual - Renta)
CREATE OR REPLACE FUNCTION public.calculate_f22(
    _entity_id uuid,
    _period_start date,
    _period_end date
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_entity RECORD;
    v_ingresos numeric(20,4) := 0;
    v_gastos numeric(20,4) := 0;
    v_costo_ventas numeric(20,4) := 0;
    v_resultado_financiero numeric(20,4) := 0;
    v_agregados numeric(20,4) := 0;
    v_deducciones numeric(20,4) := 0;
    v_rli numeric(20,4) := 0;
    v_tasa_impuesto numeric(6,3) := 25.0; -- Tasa general Pyme 14 D3 (25%) o 14A (27%)
    v_impuesto_primera_cat numeric(20,4) := 0;
    v_ppm_acumulado numeric(20,4) := 0;
    v_impuesto_liquido numeric(20,4) := 0;
    v_calculated_payload jsonb;
    v_run_id uuid;
BEGIN
    SELECT * INTO v_entity FROM public.entities WHERE id = _entity_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Empresa no encontrada.';
    END IF;

    IF v_entity.tax_regime = '14A_general' THEN
        v_tasa_impuesto := 27.0;
    ELSIF v_entity.tax_regime = '14D3_pro_pyme_general' THEN
        v_tasa_impuesto := 25.0; -- O transitoria 10%/12.5% según año fiscal
    ELSIF v_entity.tax_regime = '14D8_pro_pyme_transparente' THEN
        v_tasa_impuesto := 0.0; -- Exenta de 1ra categoría (tributan los socios)
    END IF;

    -- 1. Sumar Ingresos
    SELECT COALESCE(SUM(l.credit - l.debit), 0) INTO v_ingresos
    FROM public.journal_entry_lines l
    JOIN public.journal_entries j ON j.id = l.journal_entry_id
    JOIN public.accounts a ON a.id = l.account_id
    WHERE j.entity_id = _entity_id
      AND j.status = 'posted'
      AND j.posting_date >= _period_start
      AND j.posting_date <= _period_end
      AND a.account_type = 'Income';

    -- 2. Sumar Gastos
    SELECT COALESCE(SUM(l.debit - l.credit), 0) INTO v_gastos
    FROM public.journal_entry_lines l
    JOIN public.journal_entries j ON j.id = l.journal_entry_id
    JOIN public.accounts a ON a.id = l.account_id
    WHERE j.entity_id = _entity_id
      AND j.status = 'posted'
      AND j.posting_date >= _period_start
      AND j.posting_date <= _period_end
      AND a.account_type = 'Expense';

    -- 3. Sumar Costo de Ventas
    SELECT COALESCE(SUM(l.debit - l.credit), 0) INTO v_costo_ventas
    FROM public.journal_entry_lines l
    JOIN public.journal_entries j ON j.id = l.journal_entry_id
    JOIN public.accounts a ON a.id = l.account_id
    WHERE j.entity_id = _entity_id
      AND j.status = 'posted'
      AND j.posting_date >= _period_start
      AND j.posting_date <= _period_end
      AND a.account_type = 'Cost of Goods Sold';

    -- 4. Resultado Financiero antes de impuestos
    v_resultado_financiero := v_ingresos - (v_gastos + v_costo_ventas);

    -- 5. RLI Inicial (sin ajustes previos)
    v_rli := GREATEST(0, v_resultado_financiero);

    -- 6. Impuesto de Primera Categoría
    v_impuesto_primera_cat := ROUND((v_rli * v_tasa_impuesto) / 100.0);

    -- 7. Sumar PPM pagado durante el año desde los F29
    SELECT COALESCE(SUM((calculated_values->>'monto_ppm_determinado')::numeric), 0) INTO v_ppm_acumulado
    FROM public.tax_calculation_runs
    WHERE entity_id = _entity_id
      AND form_type = 'f29'
      AND period_start >= _period_start
      AND period_end <= _period_end;

    -- Impuesto Líquido a Pagar (o a Favor si PPM > Impuesto)
    v_impuesto_liquido := v_impuesto_primera_cat - v_ppm_acumulado;

    v_calculated_payload := json_build_object(
        'total_ingresos', v_ingresos,
        'total_gastos', v_gastos,
        'total_costo_ventas', v_costo_ventas,
        'resultado_financiero_neto', v_resultado_financiero,
        'agregados_tributarios', 0,
        'deducciones_tributarias', 0,
        'renta_liquida_imponible_rli', v_rli,
        'regimen_tributario', v_entity.tax_regime,
        'tasa_primera_categoria', v_tasa_impuesto,
        'impuesto_primera_categoria', v_impuesto_primera_cat,
        'ppm_acumulado_anual', v_ppm_acumulado,
        'resultado_final_f22', v_impuesto_liquido
    )::jsonb;

    INSERT INTO public.tax_calculation_runs (
        entity_id,
        form_type,
        period_start,
        period_end,
        calculated_values,
        status,
        created_by
    ) VALUES (
        _entity_id,
        'f22',
        _period_start,
        _period_end,
        v_calculated_payload,
        'draft',
        auth.uid()
    ) RETURNING id INTO v_run_id;

    RETURN json_build_object(
        'success', true,
        'run_id', v_run_id,
        'calculated_values', v_calculated_payload
    )::jsonb;
END;
$$;

-- 7. Función para Actualizar Estado de Declaración (Review / Filed)
CREATE OR REPLACE FUNCTION public.update_tax_run_status(
    _run_id uuid,
    _new_status public.tax_calculation_status,
    _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    UPDATE public.tax_calculation_runs SET
        status = _new_status,
        notes = COALESCE(_notes, notes),
        reviewed_by = CASE WHEN _new_status IN ('reviewed', 'filed') THEN auth.uid() ELSE reviewed_by END,
        reviewed_at = CASE WHEN _new_status = 'reviewed' THEN now() ELSE reviewed_at END,
        filed_at = CASE WHEN _new_status = 'filed' THEN now() ELSE filed_at END
    WHERE id = _run_id;

    RETURN json_build_object('success', true, 'status', _new_status)::jsonb;
END;
$$;

-- 8. Políticas RLS
CREATE POLICY "read_tax_calculation_runs" ON public.tax_calculation_runs
FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_tax_calculation_runs" ON public.tax_calculation_runs
FOR ALL TO authenticated USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

CREATE POLICY "read_tax_adjustments" ON public.tax_adjustments
FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_tax_adjustments" ON public.tax_adjustments
FOR ALL TO authenticated USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

-- 9. Registrar Módulo en la tabla modules
INSERT INTO public.modules (name, label)
VALUES ('taxes', 'Impuestos (F29 / F22)')
ON CONFLICT (name) DO UPDATE SET label = 'Impuestos (F29 / F22)', active = true;
