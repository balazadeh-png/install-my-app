-- ============================================================================
-- Sprint 4: Centros de Costo y Unidades/Sucursales — EasyERP
-- ============================================================================

-- 1. Tabla business_units (Unidades de Negocio / Sucursales)
CREATE TABLE IF NOT EXISTS public.business_units (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    parent_id uuid REFERENCES public.business_units(id) ON DELETE RESTRICT,
    is_group boolean DEFAULT false,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (entity_id, code)
);

CREATE INDEX IF NOT EXISTS ix_business_units_entity ON public.business_units(entity_id);
CREATE INDEX IF NOT EXISTS ix_business_units_parent ON public.business_units(parent_id);

ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_business_units" ON public.business_units;
CREATE POLICY "read_business_units" 
ON public.business_units FOR SELECT 
TO authenticated
USING (public.user_has_company_access(auth.uid(), entity_id));

DROP POLICY IF EXISTS "write_business_units" ON public.business_units;
CREATE POLICY "write_business_units" 
ON public.business_units FOR ALL 
TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

-- 2. Tabla cost_centers (Centros de Costo)
CREATE TABLE IF NOT EXISTS public.cost_centers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    parent_id uuid REFERENCES public.cost_centers(id) ON DELETE RESTRICT,
    is_group boolean DEFAULT false,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (entity_id, code)
);

CREATE INDEX IF NOT EXISTS ix_cost_centers_entity ON public.cost_centers(entity_id);
CREATE INDEX IF NOT EXISTS ix_cost_centers_parent ON public.cost_centers(parent_id);

ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_cost_centers" ON public.cost_centers;
CREATE POLICY "read_cost_centers" 
ON public.cost_centers FOR SELECT 
TO authenticated
USING (public.user_has_company_access(auth.uid(), entity_id));

DROP POLICY IF EXISTS "write_cost_centers" ON public.cost_centers;
CREATE POLICY "write_cost_centers" 
ON public.cost_centers FOR ALL 
TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

-- 3. Columnas analíticas en journal_entry_lines
ALTER TABLE public.journal_entry_lines
ADD COLUMN IF NOT EXISTS cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_journal_entry_lines_cc ON public.journal_entry_lines(cost_center_id);
CREATE INDEX IF NOT EXISTS ix_journal_entry_lines_bu ON public.journal_entry_lines(business_unit_id);

-- 4. Columnas en accounts para obligatoriedad de dimensiones
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS requires_cost_center boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_business_unit boolean DEFAULT false;

-- 5. Trigger de validación de dimensiones analíticas
CREATE OR REPLACE FUNCTION public.validate_line_dimensions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_acc record;
    v_cc record;
    v_bu record;
BEGIN
    SELECT code, name, requires_cost_center, requires_business_unit 
    INTO v_acc
    FROM public.accounts 
    WHERE id = NEW.account_id;

    IF v_acc IS NOT NULL THEN
        -- Validación de Centro de Costo
        IF v_acc.requires_cost_center AND NEW.cost_center_id IS NULL THEN
            RAISE EXCEPTION 'La cuenta % (%) exige Centro de Costo obligatorio.', v_acc.code, v_acc.name;
        END IF;

        -- Validación de Unidad / Sucursal
        IF v_acc.requires_business_unit AND NEW.business_unit_id IS NULL THEN
            RAISE EXCEPTION 'La cuenta % (%) exige Unidad/Sucursal obligatoria.', v_acc.code, v_acc.name;
        END IF;
    END IF;

    -- Validar que no se asienten líneas a un Centro de Costo agrupador
    IF NEW.cost_center_id IS NOT NULL THEN
        SELECT is_group, name INTO v_cc FROM public.cost_centers WHERE id = NEW.cost_center_id;
        IF v_cc.is_group THEN
            RAISE EXCEPTION 'No se pueden imputar movimientos al Centro de Costo agrupador %.', v_cc.name;
        END IF;
    END IF;

    -- Validar que no se asienten líneas a una Unidad agrupador
    IF NEW.business_unit_id IS NOT NULL THEN
        SELECT is_group, name INTO v_bu FROM public.business_units WHERE id = NEW.business_unit_id;
        IF v_bu.is_group THEN
            RAISE EXCEPTION 'No se pueden imputar movimientos a la Unidad/Sucursal agrupador %.', v_bu.name;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_line_dimensions ON public.journal_entry_lines;
CREATE TRIGGER trg_validate_line_dimensions
BEFORE INSERT OR UPDATE ON public.journal_entry_lines
FOR EACH ROW EXECUTE FUNCTION public.validate_line_dimensions();

-- 6. Semillero por defecto para empresas existentes (si no tienen creados)
DO $$
DECLARE
    v_ent record;
BEGIN
    FOR v_ent IN SELECT id FROM public.entities LOOP
        -- Sucursal por defecto
        IF NOT EXISTS (SELECT 1 FROM public.business_units WHERE entity_id = v_ent.id) THEN
            INSERT INTO public.business_units (entity_id, code, name, is_group, active)
            VALUES (v_ent.id, 'SUC-01', 'Casa Matriz - Santiago', false, true);
        END IF;

        -- Centros de costo por defecto
        IF NOT EXISTS (SELECT 1 FROM public.cost_centers WHERE entity_id = v_ent.id) THEN
            INSERT INTO public.cost_centers (entity_id, code, name, is_group, active)
            VALUES 
                (v_ent.id, 'CC-ADM', 'Administración y Finanzas', false, true),
                (v_ent.id, 'CC-VTA', 'Comercial y Ventas', false, true),
                (v_ent.id, 'CC-OPS', 'Operaciones y Logística', false, true);
        END IF;
    END LOOP;
END $$;
