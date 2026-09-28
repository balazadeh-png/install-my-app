-- Sprint 25: Contratos y Tarifarios para Clientes 3PL
-- Permite definir contratos comerciales de servicios 3PL y su estructura tarifaria (almacenaje, picking, transporte, recargos).

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE public.billing_frequency AS ENUM ('mensual', 'quincenal');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.service_rate_type AS ENUM ('storage_pallet', 'storage_m2', 'picking_unit', 'transport_km', 'recargo_fijo');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Tabla service_contracts
CREATE TABLE IF NOT EXISTS public.service_contracts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    party_id uuid REFERENCES public.parties(id) ON DELETE CASCADE NOT NULL,
    billing_frequency public.billing_frequency NOT NULL DEFAULT 'mensual',
    active boolean NOT NULL DEFAULT true,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT service_contracts_entity_party_unique UNIQUE (entity_id, party_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_service_contracts_entity_id ON public.service_contracts(entity_id);
CREATE INDEX IF NOT EXISTS idx_service_contracts_party_id ON public.service_contracts(party_id);

-- 3. Tabla service_rate_lines
CREATE TABLE IF NOT EXISTS public.service_rate_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id uuid REFERENCES public.service_contracts(id) ON DELETE CASCADE NOT NULL,
    rate_type public.service_rate_type NOT NULL,
    unit_price numeric(20,4) NOT NULL,
    description text,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_service_rate_lines_contract_id ON public.service_rate_lines(contract_id);

-- 4. Extensión a dispatch_notes: distance_km
ALTER TABLE public.dispatch_notes ADD COLUMN IF NOT EXISTS distance_km numeric(10,2);

-- 5. Row Level Security (RLS)
ALTER TABLE public.service_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_rate_lines ENABLE ROW LEVEL SECURITY;

-- Políticas service_contracts
DROP POLICY IF EXISTS "Users can view service_contracts for their entities" ON public.service_contracts;
CREATE POLICY "Users can view service_contracts for their entities"
  ON public.service_contracts
  FOR SELECT
  TO authenticated
  USING (public.user_has_company_access(entity_id));

DROP POLICY IF EXISTS "Users can insert service_contracts for their entities" ON public.service_contracts;
CREATE POLICY "Users can insert service_contracts for their entities"
  ON public.service_contracts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.user_has_company_access(entity_id));

DROP POLICY IF EXISTS "Users can update service_contracts for their entities" ON public.service_contracts;
CREATE POLICY "Users can update service_contracts for their entities"
  ON public.service_contracts
  FOR UPDATE
  TO authenticated
  USING (public.user_has_company_access(entity_id))
  WITH CHECK (public.user_has_company_access(entity_id));

DROP POLICY IF EXISTS "Users can delete service_contracts for their entities" ON public.service_contracts;
CREATE POLICY "Users can delete service_contracts for their entities"
  ON public.service_contracts
  FOR DELETE
  TO authenticated
  USING (public.user_has_company_access(entity_id));

-- Políticas service_rate_lines
DROP POLICY IF EXISTS "Users can view service_rate_lines for their contracts" ON public.service_rate_lines;
CREATE POLICY "Users can view service_rate_lines for their contracts"
  ON public.service_rate_lines
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_contracts sc
      WHERE sc.id = service_rate_lines.contract_id
        AND public.user_has_company_access(sc.entity_id)
    )
  );

DROP POLICY IF EXISTS "Users can insert service_rate_lines for their contracts" ON public.service_rate_lines;
CREATE POLICY "Users can insert service_rate_lines for their contracts"
  ON public.service_rate_lines
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.service_contracts sc
      WHERE sc.id = service_rate_lines.contract_id
        AND public.user_has_company_access(sc.entity_id)
    )
  );

DROP POLICY IF EXISTS "Users can update service_rate_lines for their contracts" ON public.service_rate_lines;
CREATE POLICY "Users can update service_rate_lines for their contracts"
  ON public.service_rate_lines
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_contracts sc
      WHERE sc.id = service_rate_lines.contract_id
        AND public.user_has_company_access(sc.entity_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.service_contracts sc
      WHERE sc.id = service_rate_lines.contract_id
        AND public.user_has_company_access(sc.entity_id)
    )
  );

DROP POLICY IF EXISTS "Users can delete service_rate_lines for their contracts" ON public.service_rate_lines;
CREATE POLICY "Users can delete service_rate_lines for their contracts"
  ON public.service_rate_lines
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_contracts sc
      WHERE sc.id = service_rate_lines.contract_id
        AND public.user_has_company_access(sc.entity_id)
    )
  );

-- Comentarios explicativos
COMMENT ON TABLE public.service_contracts IS 'Contratos marco de servicios 3PL por cliente con frecuencia de facturación';
COMMENT ON TABLE public.service_rate_lines IS 'Líneas tarifarias asociadas a contratos 3PL (almacenaje, picking, transporte, recargos)';
COMMENT ON COLUMN public.dispatch_notes.distance_km IS 'Distancia recorrida en kilómetros para efectos de tarificación de transporte 3PL';
