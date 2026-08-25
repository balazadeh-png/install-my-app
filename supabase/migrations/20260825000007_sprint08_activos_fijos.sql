-- ============================================================================
-- Sprint 8: Activos Fijos y Depreciación Mensual Automática — EasyERP
-- ============================================================================

-- 1. Enums para Métodos de Depreciación y Estados de Activo Fijo
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'depreciation_method') THEN
        CREATE TYPE public.depreciation_method AS ENUM ('linea_recta', 'acelerada');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_status') THEN
        CREATE TYPE public.asset_status AS ENUM ('active', 'fully_depreciated', 'disposed');
    END IF;
END $$;

-- 2. Tabla fixed_assets (Ficha Maestra de Activo Fijo)
CREATE TABLE IF NOT EXISTS public.fixed_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT NOT NULL,
    cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
    business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL,
    asset_code text NOT NULL,
    name text NOT NULL,
    acquisition_date date NOT NULL,
    acquisition_value numeric(20,4) NOT NULL,
    currency_code text REFERENCES public.currencies(code) NOT NULL DEFAULT 'CLP',
    residual_value numeric(20,4) DEFAULT 0 NOT NULL,
    useful_life_months integer NOT NULL,
    depreciation_method public.depreciation_method DEFAULT 'linea_recta' NOT NULL,
    accumulated_depreciation numeric(20,4) DEFAULT 0 NOT NULL,
    asset_account_id uuid REFERENCES public.accounts(id) ON DELETE RESTRICT NOT NULL,
    accumulated_depreciation_account_id uuid REFERENCES public.accounts(id) ON DELETE RESTRICT NOT NULL,
    depreciation_expense_account_id uuid REFERENCES public.accounts(id) ON DELETE RESTRICT NOT NULL,
    status public.asset_status DEFAULT 'active' NOT NULL,
    disposal_date date,
    disposal_value numeric(20,4),
    disposal_journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    memo text,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT uq_asset_entity_code UNIQUE (entity_id, asset_code)
);

CREATE INDEX IF NOT EXISTS ix_fa_entity ON public.fixed_assets(entity_id);
CREATE INDEX IF NOT EXISTS ix_fa_status ON public.fixed_assets(status);

ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;

-- 3. Tabla fixed_asset_depreciation_entries (Corridas y Cuotas Mensuales)
CREATE TABLE IF NOT EXISTS public.fixed_asset_depreciation_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fixed_asset_id uuid REFERENCES public.fixed_assets(id) ON DELETE CASCADE NOT NULL,
    period_date date NOT NULL,
    amount numeric(20,4) NOT NULL,
    journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT uq_asset_period UNIQUE (fixed_asset_id, period_date)
);

CREATE INDEX IF NOT EXISTS ix_fade_asset ON public.fixed_asset_depreciation_entries(fixed_asset_id);
CREATE INDEX IF NOT EXISTS ix_fade_period ON public.fixed_asset_depreciation_entries(period_date);

ALTER TABLE public.fixed_asset_depreciation_entries ENABLE ROW LEVEL SECURITY;

-- 4. Función Transaccional: Ejecutar Depreciación Mensual Automática
CREATE OR REPLACE FUNCTION public.run_monthly_depreciation(
    _entity_id uuid,
    _period_date date
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_base_curr text;
    v_asset RECORD;
    v_depreciable_base numeric(20,4);
    v_divisor numeric(20,4);
    v_quota numeric(20,4);
    v_remaining_depreciable numeric(20,4);
    v_je_id uuid;
    v_processed_count int := 0;
    v_total_depreciation numeric(20,4) := 0;
BEGIN
    SELECT base_currency_code INTO v_base_curr FROM public.entities WHERE id = _entity_id;
    v_base_curr := COALESCE(v_base_curr, 'CLP');

    FOR v_asset IN 
        SELECT * FROM public.fixed_assets 
        WHERE entity_id = _entity_id 
          AND status = 'active'
          AND acquisition_date <= _period_date
        FOR UPDATE
    LOOP
        -- Verificar si ya fue depreciado en ese período exacto
        IF NOT EXISTS (
            SELECT 1 FROM public.fixed_asset_depreciation_entries 
            WHERE fixed_asset_id = v_asset.id AND period_date = _period_date
        ) THEN
            v_depreciable_base := v_asset.acquisition_value - v_asset.residual_value;
            v_remaining_depreciable := v_depreciable_base - v_asset.accumulated_depreciation;

            IF v_remaining_depreciable > 0 THEN
                IF v_asset.depreciation_method = 'acelerada' THEN
                    v_divisor := GREATEST(1, FLOOR(v_asset.useful_life_months / 3.0));
                ELSE
                    v_divisor := GREATEST(1, v_asset.useful_life_months);
                END IF;

                v_quota := ROUND(v_depreciable_base / v_divisor);
                v_quota := LEAST(v_quota, v_remaining_depreciable);

                IF v_quota > 0 THEN
                    -- 1. Crear Cabecera del Asiento de Depreciación
                    INSERT INTO public.journal_entries (
                        entity_id,
                        posting_date,
                        voucher_type,
                        memo,
                        status,
                        created_by
                    ) VALUES (
                        _entity_id,
                        _period_date,
                        'Depreciación Activo Fijo',
                        'Depreciación mensual ' || v_asset.asset_code || ' - ' || v_asset.name || ' (' || _period_date || ')',
                        'draft',
                        auth.uid()
                    ) RETURNING id INTO v_je_id;

                    -- 2. Débito a Gasto por Depreciación
                    INSERT INTO public.journal_entry_lines (
                        journal_entry_id,
                        line_no,
                        account_id,
                        cost_center_id,
                        business_unit_id,
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
                        1,
                        v_asset.depreciation_expense_account_id,
                        v_asset.cost_center_id,
                        v_asset.business_unit_id,
                        v_base_curr,
                        1.0,
                        v_quota,
                        0,
                        v_quota,
                        0,
                        true,
                        'Gasto Depreciación ' || v_asset.name
                    );

                    -- 3. Crédito a Depreciación Acumulada
                    INSERT INTO public.journal_entry_lines (
                        journal_entry_id,
                        line_no,
                        account_id,
                        cost_center_id,
                        business_unit_id,
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
                        2,
                        v_asset.accumulated_depreciation_account_id,
                        v_asset.cost_center_id,
                        v_asset.business_unit_id,
                        v_base_curr,
                        1.0,
                        0,
                        v_quota,
                        0,
                        v_quota,
                        true,
                        'Depreciación Acumulada ' || v_asset.name
                    );

                    -- 4. Postear Asiento
                    PERFORM public.post_journal_entry(v_je_id);

                    -- 5. Registrar en tabla de detalle
                    INSERT INTO public.fixed_asset_depreciation_entries (
                        fixed_asset_id,
                        period_date,
                        amount,
                        journal_entry_id
                    ) VALUES (
                        v_asset.id,
                        _period_date,
                        v_quota,
                        v_je_id
                    );

                    -- 6. Actualizar Acumulado en el Activo
                    UPDATE public.fixed_assets
                    SET accumulated_depreciation = accumulated_depreciation + v_quota,
                        status = CASE 
                            WHEN (accumulated_depreciation + v_quota) >= v_depreciable_base THEN 'fully_depreciated'::public.asset_status 
                            ELSE 'active'::public.asset_status 
                        END
                    WHERE id = v_asset.id;

                    v_processed_count := v_processed_count + 1;
                    v_total_depreciation := v_total_depreciation + v_quota;
                END IF;
            END IF;
        END IF;
    END LOOP;

    RETURN json_build_object(
        'success', true,
        'assets_processed', v_processed_count,
        'total_depreciation', v_total_depreciation,
        'period_date', _period_date
    )::jsonb;
END;
$$;

-- 5. Función Transaccional: Dar de Baja / Disposición de Activo Fijo
CREATE OR REPLACE FUNCTION public.dispose_fixed_asset(
    _asset_id uuid,
    _disposal_date date,
    _disposal_value numeric,
    _gain_loss_account_id uuid,
    _bank_account_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_asset RECORD;
    v_base_curr text;
    v_nbv numeric(20,4);
    v_diff numeric(20,4);
    v_je_id uuid;
    v_line_no int := 1;
BEGIN
    SELECT * INTO v_asset FROM public.fixed_assets WHERE id = _asset_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Activo fijo no encontrado.';
    END IF;

    IF v_asset.status = 'disposed' THEN
        RAISE EXCEPTION 'El activo fijo ya fue dado de baja previamente.';
    END IF;

    SELECT base_currency_code INTO v_base_curr FROM public.entities WHERE id = v_asset.entity_id;
    v_base_curr := COALESCE(v_base_curr, 'CLP');

    -- Valor Libro Neto (Net Book Value)
    v_nbv := v_asset.acquisition_value - v_asset.accumulated_depreciation;
    v_diff := COALESCE(_disposal_value, 0) - v_nbv; -- Ganancia si > 0, Pérdida si < 0

    -- 1. Cabecera del comprobante de baja
    INSERT INTO public.journal_entries (
        entity_id,
        posting_date,
        voucher_type,
        memo,
        status,
        created_by
    ) VALUES (
        v_asset.entity_id,
        _disposal_date,
        'Baja de Activo Fijo',
        'Baja / Venta de Activo Fijo ' || v_asset.asset_code || ' - ' || v_asset.name,
        'draft',
        auth.uid()
    ) RETURNING id INTO v_je_id;

    -- 2. Débito a Depreciación Acumulada (para cancelar el saldo acumulado a la fecha)
    IF v_asset.accumulated_depreciation > 0 THEN
        INSERT INTO public.journal_entry_lines (
            journal_entry_id,
            line_no,
            account_id,
            cost_center_id,
            business_unit_id,
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
            v_asset.accumulated_depreciation_account_id,
            v_asset.cost_center_id,
            v_asset.business_unit_id,
            v_base_curr,
            1.0,
            v_asset.accumulated_depreciation,
            0,
            v_asset.accumulated_depreciation,
            0,
            true,
            'Cancelación Deprec. Acumulada Baja ' || v_asset.name
        );
        v_line_no := v_line_no + 1;
    END IF;

    -- 3. Si hubo valor de venta / rescate, Débito a Caja o Banco
    IF COALESCE(_disposal_value, 0) > 0 THEN
        IF _bank_account_id IS NULL THEN
            RAISE EXCEPTION 'Especifique la cuenta de banco/caja donde ingresó el valor de venta.';
        END IF;

        INSERT INTO public.journal_entry_lines (
            journal_entry_id,
            line_no,
            account_id,
            cost_center_id,
            business_unit_id,
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
            _bank_account_id,
            v_asset.cost_center_id,
            v_asset.business_unit_id,
            v_base_curr,
            1.0,
            _disposal_value,
            0,
            _disposal_value,
            0,
            true,
            'Ingreso por Venta de Activo Fijo ' || v_asset.name
        );
        v_line_no := v_line_no + 1;
    END IF;

    -- 4. Ajuste por Resultado (Ganancia o Pérdida en Disposición)
    IF v_diff < 0 THEN
        -- Pérdida en baja (Débito a cuenta de pérdida)
        INSERT INTO public.journal_entry_lines (
            journal_entry_id,
            line_no,
            account_id,
            cost_center_id,
            business_unit_id,
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
            _gain_loss_account_id,
            v_asset.cost_center_id,
            v_asset.business_unit_id,
            v_base_curr,
            1.0,
            ABS(v_diff),
            0,
            ABS(v_diff),
            0,
            true,
            'Pérdida en Disposición de Activo ' || v_asset.name
        );
        v_line_no := v_line_no + 1;
    ELSIF v_diff > 0 THEN
        -- Ganancia en venta (Crédito a cuenta de ganancia)
        INSERT INTO public.journal_entry_lines (
            journal_entry_id,
            line_no,
            account_id,
            cost_center_id,
            business_unit_id,
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
            _gain_loss_account_id,
            v_asset.cost_center_id,
            v_asset.business_unit_id,
            v_base_curr,
            1.0,
            0,
            v_diff,
            0,
            v_diff,
            true,
            'Utilidad en Venta de Activo ' || v_asset.name
        );
        v_line_no := v_line_no + 1;
    END IF;

    -- 5. Crédito al Activo Fijo (dar de baja el valor histórico de adquisición)
    INSERT INTO public.journal_entry_lines (
        journal_entry_id,
        line_no,
        account_id,
        cost_center_id,
        business_unit_id,
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
        v_asset.asset_account_id,
        v_asset.cost_center_id,
        v_asset.business_unit_id,
        v_base_curr,
        1.0,
        0,
        v_asset.acquisition_value,
        0,
        v_asset.acquisition_value,
        true,
        'Descargo Histórico Baja ' || v_asset.name
    );

    -- 6. Postear Asiento
    PERFORM public.post_journal_entry(v_je_id);

    -- 7. Actualizar Estado del Activo
    UPDATE public.fixed_assets SET
        status = 'disposed',
        disposal_date = _disposal_date,
        disposal_value = _disposal_value,
        disposal_journal_entry_id = v_je_id
    WHERE id = _asset_id;

    RETURN json_build_object(
        'success', true,
        'asset_id', _asset_id,
        'journal_entry_id', v_je_id,
        'net_book_value', v_nbv,
        'gain_loss', v_diff
    )::jsonb;
END;
$$;

-- 6. Políticas RLS
CREATE POLICY "read_fixed_assets" ON public.fixed_assets
FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_fixed_assets" ON public.fixed_assets
FOR ALL TO authenticated USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

CREATE POLICY "read_fixed_asset_depreciation_entries" ON public.fixed_asset_depreciation_entries
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.fixed_assets fa 
    WHERE fa.id = fixed_asset_id 
    AND public.user_has_company_access(auth.uid(), fa.entity_id)
  )
);

CREATE POLICY "write_fixed_asset_depreciation_entries" ON public.fixed_asset_depreciation_entries
FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.fixed_assets fa 
    WHERE fa.id = fixed_asset_id 
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
    AND public.user_has_company_access(auth.uid(), fa.entity_id)
  )
);

-- 7. Registrar Módulo en la tabla modules
INSERT INTO public.modules (name, label)
VALUES ('assets', 'Activos Fijos')
ON CONFLICT (name) DO UPDATE SET label = 'Activos Fijos', active = true;

