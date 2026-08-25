-- ============================================================================
-- Sprint 13: Motor Extensible de Declaraciones Juradas SII (DJ 1879, 1887, 1947)
-- ============================================================================

-- 1. Enum para Estado de Declaración Jurada
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dj_generation_status') THEN
        CREATE TYPE public.dj_generation_status AS ENUM ('draft', 'reviewed', 'filed');
    END IF;
END $$;

-- 2. Tabla dj_definitions (Catálogo Configurable de Declaraciones Juradas)
CREATE TABLE IF NOT EXISTS public.dj_definitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dj_code text NOT NULL UNIQUE, -- ej. '1879', '1887', '1947'
    name text NOT NULL,
    periodicity text NOT NULL DEFAULT 'anual',
    field_schema jsonb NOT NULL DEFAULT '[]', -- Array de { key, label, description, type }
    active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.dj_definitions ENABLE ROW LEVEL SECURITY;

-- 3. Tabla dj_field_mappings (Mapeo de Campos a Cuentas Contables por Empresa)
CREATE TABLE IF NOT EXISTS public.dj_field_mappings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    dj_definition_id uuid REFERENCES public.dj_definitions(id) ON DELETE CASCADE NOT NULL,
    field_key text NOT NULL, -- Clave definida en field_schema
    source_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
    description text,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (entity_id, dj_definition_id, field_key)
);

CREATE INDEX IF NOT EXISTS ix_dj_map_entity ON public.dj_field_mappings(entity_id);
CREATE INDEX IF NOT EXISTS ix_dj_map_def ON public.dj_field_mappings(dj_definition_id);

ALTER TABLE public.dj_field_mappings ENABLE ROW LEVEL SECURITY;

-- 4. Tabla dj_generations (Liquidaciones Generadas de DJ por Año Tributario)
CREATE TABLE IF NOT EXISTS public.dj_generations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT NOT NULL,
    dj_definition_id uuid REFERENCES public.dj_definitions(id) ON DELETE RESTRICT NOT NULL,
    tax_year integer NOT NULL,
    generated_values jsonb NOT NULL DEFAULT '{}',
    status public.dj_generation_status DEFAULT 'draft' NOT NULL,
    reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    filed_at timestamptz,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (entity_id, dj_definition_id, tax_year)
);

CREATE INDEX IF NOT EXISTS ix_dj_gen_entity ON public.dj_generations(entity_id);
CREATE INDEX IF NOT EXISTS ix_dj_gen_year ON public.dj_generations(tax_year);

ALTER TABLE public.dj_generations ENABLE ROW LEVEL SECURITY;

-- 5. Función Transaccional: Generar Declaración Jurada (generate_dj)
CREATE OR REPLACE FUNCTION public.generate_dj(
    _entity_id uuid,
    _dj_definition_id uuid,
    _tax_year integer
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_def RECORD;
    v_map RECORD;
    v_year_start date;
    v_year_end date;
    v_field_amount numeric(20,4);
    v_calculated_fields jsonb := '{}'::jsonb;
    v_gen_id uuid;
BEGIN
    SELECT * INTO v_def FROM public.dj_definitions WHERE id = _dj_definition_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Declaración Jurada no encontrada en el catálogo.';
    END IF;

    v_year_start := make_date(_tax_year, 1, 1);
    v_year_end := make_date(_tax_year, 12, 31);

    -- Recorrer los mapeos configurados para esta DJ y empresa
    FOR v_map IN 
        SELECT m.field_key, m.source_account_id, a.account_type
        FROM public.dj_field_mappings m
        LEFT JOIN public.accounts a ON a.id = m.source_account_id
        WHERE m.entity_id = _entity_id
          AND m.dj_definition_id = _dj_definition_id
    LOOP
        v_field_amount := 0;

        IF v_map.source_account_id IS NOT NULL THEN
            IF v_map.account_type IN ('Expense', 'Asset', 'Cost of Goods Sold') THEN
                SELECT COALESCE(SUM(l.debit - l.credit), 0) INTO v_field_amount
                FROM public.journal_entry_lines l
                JOIN public.journal_entries j ON j.id = l.journal_entry_id
                WHERE j.entity_id = _entity_id
                  AND j.status = 'posted'
                  AND j.posting_date >= v_year_start
                  AND j.posting_date <= v_year_end
                  AND l.account_id = v_map.source_account_id;
            ELSE
                SELECT COALESCE(SUM(l.credit - l.debit), 0) INTO v_field_amount
                FROM public.journal_entry_lines l
                JOIN public.journal_entries j ON j.id = l.journal_entry_id
                WHERE j.entity_id = _entity_id
                  AND j.status = 'posted'
                  AND j.posting_date >= v_year_start
                  AND j.posting_date <= v_year_end
                  AND l.account_id = v_map.source_account_id;
            END IF;
        END IF;

        v_calculated_fields := v_calculated_fields || jsonb_build_object(v_map.field_key, v_field_amount);
    END LOOP;

    -- Upsert en dj_generations
    INSERT INTO public.dj_generations (
        entity_id,
        dj_definition_id,
        tax_year,
        generated_values,
        status,
        created_by
    ) VALUES (
        _entity_id,
        _dj_definition_id,
        _tax_year,
        v_calculated_fields,
        'draft',
        auth.uid()
    )
    ON CONFLICT (entity_id, dj_definition_id, tax_year)
    DO UPDATE SET
        generated_values = v_calculated_fields,
        status = 'draft',
        created_at = now()
    RETURNING id INTO v_gen_id;

    RETURN json_build_object(
        'success', true,
        'generation_id', v_gen_id,
        'tax_year', _tax_year,
        'dj_code', v_def.dj_code,
        'generated_values', v_calculated_fields
    )::jsonb;
END;
$$;

-- 6. Función para Actualizar Estado de DJ
CREATE OR REPLACE FUNCTION public.update_dj_status(
    _generation_id uuid,
    _new_status public.dj_generation_status
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    UPDATE public.dj_generations SET
        status = _new_status,
        reviewed_by = CASE WHEN _new_status IN ('reviewed', 'filed') THEN auth.uid() ELSE reviewed_by END,
        reviewed_at = CASE WHEN _new_status = 'reviewed' THEN now() ELSE reviewed_at END,
        filed_at = CASE WHEN _new_status = 'filed' THEN now() ELSE filed_at END
    WHERE id = _generation_id;

    RETURN json_build_object('success', true, 'status', _new_status)::jsonb;
END;
$$;

-- 7. Políticas RLS
CREATE POLICY "read_dj_definitions" ON public.dj_definitions
FOR SELECT TO authenticated USING (true);

CREATE POLICY "write_dj_definitions" ON public.dj_definitions
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "read_dj_field_mappings" ON public.dj_field_mappings
FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_dj_field_mappings" ON public.dj_field_mappings
FOR ALL TO authenticated USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

CREATE POLICY "read_dj_generations" ON public.dj_generations
FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_dj_generations" ON public.dj_generations
FOR ALL TO authenticated USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

-- 8. Registrar Módulo en la tabla modules
INSERT INTO public.modules (name, label)
VALUES ('declaraciones_juradas', 'Declaraciones Juradas SII')
ON CONFLICT (name) DO UPDATE SET label = 'Declaraciones Juradas SII', active = true;

-- 9. Datos Iniciales: Semilla de Declaraciones Juradas Chilenas Típicas
INSERT INTO public.dj_definitions (dj_code, name, periodicity, field_schema)
VALUES 
(
    '1879',
    'Declaración Jurada 1879: Retenciones sobre Rentas Pagadas por Servicios Profesionales (Honorarios)',
    'anual',
    '[
        {"key": "monto_bruto_honorarios", "label": "Monto Bruto Total Honorarios Pagados", "description": "Suma de honorarios brutos pagados a prestadores de servicios en el año", "type": "currency"},
        {"key": "retencion_legal_honorarios", "label": "Retención Legal de Impuesto de 2da Categoría (13.75%/14.5%)", "description": "Retención tributaria enterada en arcas fiscales", "type": "currency"}
    ]'::jsonb
),
(
    '1887',
    'Declaración Jurada 1887: Rentas del Art. 42 N° 1 (Sueldos y Remuneraciones)',
    'anual',
    '[
        {"key": "monto_total_remuneraciones", "label": "Total Remuneraciones y Sueldos Imponibles", "description": "Rentas totales pagadas a trabajadores dependientes", "type": "currency"},
        {"key": "impuesto_unico_retenido", "label": "Impuesto Único de Segunda Categoría Retenido", "description": "Total retenido por concepto de IUSC", "type": "currency"},
        {"key": "leyes_sociales_prevision", "label": "Cotizaciones Previsionales y de Salud", "description": "Aportes previsionales y leyes sociales descontados", "type": "currency"}
    ]'::jsonb
),
(
    '1947',
    'Declaración Jurada 1947: Base Imponible y Renta Atribuida Régimen Pro Pyme Transparente (14 D8)',
    'anual',
    '[
        {"key": "base_imponible_a_distribuir", "label": "Base Imponible Neta a Asignar a los Propietarios", "description": "Resultado tributario atribuible a los socios de la Pyme", "type": "currency"},
        {"key": "ppm_pyme_distribuible", "label": "Crédito por PPM Pyme a Distribuir", "description": "Total de PPMs acumulados traspasables a los socios", "type": "currency"}
    ]'::jsonb
)
ON CONFLICT (dj_code) DO NOTHING;
