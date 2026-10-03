-- ============================================================================
-- Sprint 37: Gestión de Proveedores, Catálogo y Portal
-- ============================================================================

-- 1. Columna requires_contract en parties
ALTER TABLE public.parties ADD COLUMN IF NOT EXISTS requires_contract boolean DEFAULT false;

-- 2. Tipo enum catalog_item_type ('producto', 'servicio')
DO $$ BEGIN
  CREATE TYPE public.catalog_item_type AS ENUM ('producto', 'servicio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Tabla supplier_catalog_items (Catálogo propio por proveedor)
CREATE TABLE IF NOT EXISTS public.supplier_catalog_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    party_id uuid REFERENCES public.parties(id) ON DELETE CASCADE NOT NULL,
    supplier_sku text NOT NULL,
    name text NOT NULL,
    description text,
    item_type public.catalog_item_type NOT NULL DEFAULT 'producto',
    unit_price numeric(20,4) NOT NULL DEFAULT 0,
    currency_code text REFERENCES public.currencies(code) NOT NULL DEFAULT 'CLP',
    uom text,
    linked_item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (party_id, supplier_sku)
);

CREATE INDEX IF NOT EXISTS idx_supplier_catalog_party_id ON public.supplier_catalog_items(party_id);
CREATE INDEX IF NOT EXISTS idx_supplier_catalog_entity_id ON public.supplier_catalog_items(entity_id);
CREATE INDEX IF NOT EXISTS idx_supplier_catalog_active ON public.supplier_catalog_items(party_id, active);

-- 4. Tabla supplier_contracts (Historial de contratos y anexos en PDF)
CREATE TABLE IF NOT EXISTS public.supplier_contracts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    party_id uuid REFERENCES public.parties(id) ON DELETE CASCADE NOT NULL,
    version_number integer NOT NULL,
    file_path text NOT NULL,
    file_name text NOT NULL,
    notes text,
    is_current boolean DEFAULT true NOT NULL,
    uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (party_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_supplier_contracts_party_id ON public.supplier_contracts(party_id);
CREATE INDEX IF NOT EXISTS idx_supplier_contracts_entity_id ON public.supplier_contracts(entity_id);

-- 5. Bucket privado de Supabase Storage: 'supplier-contracts'
INSERT INTO storage.buckets (id, name, public)
VALUES ('supplier-contracts', 'supplier-contracts', false)
ON CONFLICT (id) DO NOTHING;

-- Staff interno: lectura y descarga de contratos por empresa
DROP POLICY IF EXISTS "staff_read_supplier_contracts" ON storage.objects;
CREATE POLICY "staff_read_supplier_contracts" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'supplier-contracts'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.user_has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- Staff interno: subida de PDFs de contratos (admin o purchasing)
DROP POLICY IF EXISTS "staff_write_supplier_contracts" ON storage.objects;
CREATE POLICY "staff_write_supplier_contracts" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'supplier-contracts'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.user_has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'purchasing'))
);

-- Portal proveedor: lectura y descarga de sus propios contratos PDF (solo lectura)
DROP POLICY IF EXISTS "portal_read_own_contract" ON storage.objects;
CREATE POLICY "portal_read_own_contract" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'supplier-contracts'
  AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.user_has_party_access(((storage.foldername(name))[2])::uuid)
);

-- 6. RLS en supplier_catalog_items y supplier_contracts
ALTER TABLE public.supplier_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_contracts ENABLE ROW LEVEL SECURITY;

-- Staff interno gestiona catálogo de su empresa
DROP POLICY IF EXISTS "staff_manage_supplier_catalog" ON public.supplier_catalog_items;
CREATE POLICY "staff_manage_supplier_catalog" ON public.supplier_catalog_items FOR ALL TO authenticated
USING (public.user_has_company_access(auth.uid(), entity_id))
WITH CHECK (public.user_has_company_access(auth.uid(), entity_id));

-- Proveedor en Portal gestiona su propio catálogo (lectura, inserción y actualización)
DROP POLICY IF EXISTS "portal_manage_own_catalog" ON public.supplier_catalog_items;
CREATE POLICY "portal_manage_own_catalog" ON public.supplier_catalog_items FOR ALL TO authenticated
USING (public.user_has_party_access(party_id))
WITH CHECK (public.user_has_party_access(party_id));

-- Staff interno gestiona contratos de su empresa
DROP POLICY IF EXISTS "staff_manage_supplier_contracts" ON public.supplier_contracts;
CREATE POLICY "staff_manage_supplier_contracts" ON public.supplier_contracts FOR ALL TO authenticated
USING (public.user_has_company_access(auth.uid(), entity_id))
WITH CHECK (public.user_has_company_access(auth.uid(), entity_id));

-- Proveedor en Portal solo lee sus contratos
DROP POLICY IF EXISTS "portal_read_own_contracts" ON public.supplier_contracts;
CREATE POLICY "portal_read_own_contracts" ON public.supplier_contracts FOR SELECT TO authenticated
USING (public.user_has_party_access(party_id));

-- 7. Registrar módulo suppliers en catálogo de módulos
INSERT INTO public.modules (name, label, group_name, group_sort_order, sort_order, active)
VALUES ('suppliers', 'Gestión de Proveedores', 'Operaciones', 2, 6, true)
ON CONFLICT (name) DO UPDATE 
SET label = EXCLUDED.label,
    group_name = EXCLUDED.group_name,
    group_sort_order = EXCLUDED.group_sort_order,
    sort_order = EXCLUDED.sort_order,
    active = true;
