-- Migration: Sprint 17 - Comercio Exterior (SICEX)
-- Extension para Vertical 3PL: Operaciones de Comercio Exterior y Certificados Sanitarios / de Origen

-- 1. Enums para Comercio Exterior
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ft_operation_type') THEN
        CREATE TYPE public.ft_operation_type AS ENUM ('exportacion', 'importacion');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ft_customs_status') THEN
        CREATE TYPE public.ft_customs_status AS ENUM ('pendiente', 'tramitando', 'autorizado', 'rechazado');
    END IF;
END $$;

-- 2. Tabla foreign_trade_operations (Operaciones de Comercio Exterior / SICEX)
CREATE TABLE IF NOT EXISTS public.foreign_trade_operations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    party_id uuid REFERENCES public.parties(id) ON DELETE RESTRICT NOT NULL,
    dispatch_note_id uuid REFERENCES public.dispatch_notes(id) ON DELETE SET NULL,
    operation_type public.ft_operation_type NOT NULL,
    country_code text,
    dus_number text,
    booking_number text,
    customs_status public.ft_customs_status NOT NULL DEFAULT 'pendiente',
    notes text,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_fto_entity ON public.foreign_trade_operations(entity_id);
CREATE INDEX IF NOT EXISTS ix_fto_party ON public.foreign_trade_operations(party_id);
CREATE INDEX IF NOT EXISTS ix_fto_dispatch_note ON public.foreign_trade_operations(dispatch_note_id);
CREATE INDEX IF NOT EXISTS ix_fto_status ON public.foreign_trade_operations(customs_status);
CREATE INDEX IF NOT EXISTS ix_fto_created_at ON public.foreign_trade_operations(created_at);

-- Función de actualización automática de updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger de updated_at para foreign_trade_operations
DROP TRIGGER IF EXISTS trg_fto_updated_at ON public.foreign_trade_operations;
CREATE TRIGGER trg_fto_updated_at
    BEFORE UPDATE ON public.foreign_trade_operations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();


-- RLS foreign_trade_operations
ALTER TABLE public.foreign_trade_operations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.foreign_trade_operations TO authenticated;
GRANT ALL ON public.foreign_trade_operations TO service_role;

DROP POLICY IF EXISTS "read_foreign_trade_operations" ON public.foreign_trade_operations;
CREATE POLICY "read_foreign_trade_operations" ON public.foreign_trade_operations FOR SELECT TO authenticated
USING (public.user_has_company_access(auth.uid(), entity_id));

DROP POLICY IF EXISTS "write_foreign_trade_operations" ON public.foreign_trade_operations;
CREATE POLICY "write_foreign_trade_operations" ON public.foreign_trade_operations FOR ALL TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

-- 3. Tabla foreign_trade_certificates (Certificados Sanitarios, Fito/Zoo, Origen, etc.)
CREATE TABLE IF NOT EXISTS public.foreign_trade_certificates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_id uuid REFERENCES public.foreign_trade_operations(id) ON DELETE CASCADE NOT NULL,
    certificate_type text NOT NULL,
    certificate_number text,
    issued_by text,
    valid_until date,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_ftc_operation ON public.foreign_trade_certificates(operation_id);
CREATE INDEX IF NOT EXISTS ix_ftc_valid_until ON public.foreign_trade_certificates(valid_until);

-- RLS foreign_trade_certificates
ALTER TABLE public.foreign_trade_certificates ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.foreign_trade_certificates TO authenticated;
GRANT ALL ON public.foreign_trade_certificates TO service_role;

DROP POLICY IF EXISTS "read_foreign_trade_certificates" ON public.foreign_trade_certificates;
CREATE POLICY "read_foreign_trade_certificates" ON public.foreign_trade_certificates FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.foreign_trade_operations fto
    WHERE fto.id = foreign_trade_certificates.operation_id
    AND public.user_has_company_access(auth.uid(), fto.entity_id)
  )
);

DROP POLICY IF EXISTS "write_foreign_trade_certificates" ON public.foreign_trade_certificates;
CREATE POLICY "write_foreign_trade_certificates" ON public.foreign_trade_certificates FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.foreign_trade_operations fto
    WHERE fto.id = foreign_trade_certificates.operation_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'accountant'))
    AND public.user_has_company_access(auth.uid(), fto.entity_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.foreign_trade_operations fto
    WHERE fto.id = foreign_trade_certificates.operation_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'accountant'))
    AND public.user_has_company_access(auth.uid(), fto.entity_id)
  )
);
