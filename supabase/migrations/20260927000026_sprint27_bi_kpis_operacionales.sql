-- ==============================================================================
-- SPRINT 27: BI Y KPIS OPERACIONALES 3PL
-- Capacidad en m3 para bodegas, inputs de costos operativos y RLS
-- ==============================================================================

-- 1. Agregar capacidad volumétrica (m3) opcional a bodegas
ALTER TABLE public.warehouses 
ADD COLUMN IF NOT EXISTS capacity_m3 numeric(20,2);

COMMENT ON COLUMN public.warehouses.capacity_m3 IS 'Capacidad volumétrica máxima en metros cúbicos para control de ocupación 3PL.';

-- 2. Tabla de insumos de costos operativos de bodega para cálculo de costo por unidad procesada
CREATE TABLE IF NOT EXISTS public.operational_cost_inputs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    total_cost numeric(20,2) NOT NULL CHECK (total_cost >= 0),
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT operational_cost_inputs_period_check CHECK (period_end >= period_start)
);

-- Índices para optimización de consultas analíticas
CREATE INDEX IF NOT EXISTS idx_operational_cost_inputs_entity_period 
ON public.operational_cost_inputs(entity_id, period_start, period_end);

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.operational_cost_inputs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para personal de la empresa
DROP POLICY IF EXISTS "operational_cost_inputs_select" ON public.operational_cost_inputs;
CREATE POLICY "operational_cost_inputs_select"
ON public.operational_cost_inputs
FOR SELECT
TO authenticated
USING (public.user_has_company_access(entity_id));

DROP POLICY IF EXISTS "operational_cost_inputs_insert" ON public.operational_cost_inputs;
CREATE POLICY "operational_cost_inputs_insert"
ON public.operational_cost_inputs
FOR INSERT
TO authenticated
WITH CHECK (public.user_has_company_access(entity_id));

DROP POLICY IF EXISTS "operational_cost_inputs_update" ON public.operational_cost_inputs;
CREATE POLICY "operational_cost_inputs_update"
ON public.operational_cost_inputs
FOR UPDATE
TO authenticated
USING (public.user_has_company_access(entity_id))
WITH CHECK (public.user_has_company_access(entity_id));

DROP POLICY IF EXISTS "operational_cost_inputs_delete" ON public.operational_cost_inputs;
CREATE POLICY "operational_cost_inputs_delete"
ON public.operational_cost_inputs
FOR DELETE
TO authenticated
USING (public.user_has_company_access(entity_id));
