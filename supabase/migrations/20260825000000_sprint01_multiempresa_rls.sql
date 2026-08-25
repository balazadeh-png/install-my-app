-- ============================================================================
-- Sprint 1: Multiempresa Real y Seguridad RLS — EasyERP
-- ============================================================================

-- 1. Tabla company_users (vínculo usuario <-> empresa <-> rol)
CREATE TABLE IF NOT EXISTS public.company_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    role public.app_role NOT NULL DEFAULT 'accountant',
    is_default boolean DEFAULT false,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (user_id, entity_id)
);

CREATE INDEX IF NOT EXISTS ix_company_users_user_entity ON public.company_users(user_id, entity_id);
CREATE INDEX IF NOT EXISTS ix_company_users_user_id ON public.company_users(user_id);
CREATE INDEX IF NOT EXISTS ix_company_users_entity_id ON public.company_users(entity_id);

ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_company_links" ON public.company_users;
CREATE POLICY "users_read_own_company_links"
ON public.company_users FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins_manage_company_links" ON public.company_users;
CREATE POLICY "admins_manage_company_links"
ON public.company_users FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Función de verificación de acceso por empresa (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.user_has_company_access(_user_id uuid, _entity_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_users
    WHERE user_id = _user_id AND entity_id = _entity_id
  ) OR public.has_role(_user_id, 'admin')
$$;

REVOKE ALL ON FUNCTION public.user_has_company_access(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_company_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_company_access(uuid, uuid) TO service_role;

-- 3. Migración de base_currency_code en entities
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS base_currency_code text REFERENCES public.currencies(code);

-- Migrar datos de currency existente si existe la columna
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'entities' AND column_name = 'currency'
    ) THEN
        UPDATE public.entities 
        SET base_currency_code = currency 
        WHERE base_currency_code IS NULL AND currency IS NOT NULL;
    END IF;
END $$;

UPDATE public.entities 
SET base_currency_code = 'CLP' 
WHERE base_currency_code IS NULL;

-- 4. Columna active_entity_id en profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_entity_id uuid REFERENCES public.entities(id) ON DELETE SET NULL;

-- 5. Backfill: Crear empresa por defecto si no existe ninguna
DO $$
DECLARE
    v_default_entity_id uuid;
    v_user record;
BEGIN
    SELECT id INTO v_default_entity_id FROM public.entities ORDER BY created_at ASC LIMIT 1;
    
    IF v_default_entity_id IS NULL THEN
        INSERT INTO public.entities (code, name, tax_id, base_currency_code, active)
        VALUES ('EMP-01', 'Empresa Principal SpA', '76.123.456-K', 'CLP', true)
        RETURNING id INTO v_default_entity_id;
    END IF;

    -- Asignar a todos los usuarios existentes acceso a la empresa por defecto
    FOR v_user IN SELECT id FROM auth.users LOOP
        INSERT INTO public.company_users (user_id, entity_id, role, is_default)
        VALUES (v_user.id, v_default_entity_id, 'admin', true)
        ON CONFLICT (user_id, entity_id) DO NOTHING;

        UPDATE public.profiles
        SET active_entity_id = v_default_entity_id
        WHERE id = v_user.id AND active_entity_id IS NULL;
    END LOOP;

    -- Backfill de registros con entity_id NULL a la empresa por defecto
    UPDATE public.accounts SET entity_id = v_default_entity_id WHERE entity_id IS NULL;
    UPDATE public.books SET entity_id = v_default_entity_id WHERE entity_id IS NULL;
    UPDATE public.fiscal_years SET entity_id = v_default_entity_id WHERE entity_id IS NULL;
    UPDATE public.accounting_periods SET entity_id = v_default_entity_id WHERE entity_id IS NULL;
    UPDATE public.gl_entries SET entity_id = v_default_entity_id WHERE entity_id IS NULL;
    UPDATE public.parties SET entity_id = v_default_entity_id WHERE entity_id IS NULL;
    UPDATE public.contacts SET entity_id = v_default_entity_id WHERE entity_id IS NULL;
    UPDATE public.addresses SET entity_id = v_default_entity_id WHERE entity_id IS NULL;
    UPDATE public.items SET entity_id = v_default_entity_id WHERE entity_id IS NULL;
    UPDATE public.warehouses SET entity_id = v_default_entity_id WHERE entity_id IS NULL;
    UPDATE public.naming_series SET entity_id = v_default_entity_id WHERE entity_id IS NULL;
END $$;

-- 6. Reescritura de Políticas RLS con Filtro por Empresa + Rol

-- Entities
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read assigned entities" ON public.entities;
CREATE POLICY "Users can read assigned entities"
ON public.entities FOR SELECT TO authenticated
USING (public.user_has_company_access(auth.uid(), id));

DROP POLICY IF EXISTS "Admins can manage entities" ON public.entities;
CREATE POLICY "Admins can manage entities"
ON public.entities FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Accounts
DROP POLICY IF EXISTS "accountants_read_accounts" ON public.accounts;
DROP POLICY IF EXISTS "accountants_write_accounts" ON public.accounts;
DROP POLICY IF EXISTS "read_accounts" ON public.accounts;
DROP POLICY IF EXISTS "write_accounts" ON public.accounts;

CREATE POLICY "read_accounts" ON public.accounts FOR SELECT TO authenticated
USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_accounts" ON public.accounts FOR ALL TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

-- GL Entries
DROP POLICY IF EXISTS "accountants_read_gl_entries" ON public.gl_entries;
DROP POLICY IF EXISTS "accountants_write_gl_entries" ON public.gl_entries;
DROP POLICY IF EXISTS "read_gl_entries" ON public.gl_entries;
DROP POLICY IF EXISTS "write_gl_entries" ON public.gl_entries;

CREATE POLICY "read_gl_entries" ON public.gl_entries FOR SELECT TO authenticated
USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_gl_entries" ON public.gl_entries FOR ALL TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

-- Books
DROP POLICY IF EXISTS "accountants_read_books" ON public.books;
DROP POLICY IF EXISTS "accountants_write_books" ON public.books;
DROP POLICY IF EXISTS "read_books" ON public.books;
DROP POLICY IF EXISTS "write_books" ON public.books;

CREATE POLICY "read_books" ON public.books FOR SELECT TO authenticated
USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_books" ON public.books FOR ALL TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

-- Fiscal Years & Periods
DROP POLICY IF EXISTS "accountants_read_fiscal_years" ON public.fiscal_years;
DROP POLICY IF EXISTS "accountants_write_fiscal_years" ON public.fiscal_years;
DROP POLICY IF EXISTS "read_fiscal_years" ON public.fiscal_years;
DROP POLICY IF EXISTS "write_fiscal_years" ON public.fiscal_years;

CREATE POLICY "read_fiscal_years" ON public.fiscal_years FOR SELECT TO authenticated
USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_fiscal_years" ON public.fiscal_years FOR ALL TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

DROP POLICY IF EXISTS "accountants_read_accounting_periods" ON public.accounting_periods;
DROP POLICY IF EXISTS "accountants_write_accounting_periods" ON public.accounting_periods;
DROP POLICY IF EXISTS "read_accounting_periods" ON public.accounting_periods;
DROP POLICY IF EXISTS "write_accounting_periods" ON public.accounting_periods;

CREATE POLICY "read_accounting_periods" ON public.accounting_periods FOR SELECT TO authenticated
USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_accounting_periods" ON public.accounting_periods FOR ALL TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

-- Parties, Contacts, Addresses
DROP POLICY IF EXISTS "sales_purchasing_read_parties" ON public.parties;
DROP POLICY IF EXISTS "sales_purchasing_write_parties" ON public.parties;
DROP POLICY IF EXISTS "read_parties" ON public.parties;
DROP POLICY IF EXISTS "write_parties" ON public.parties;

CREATE POLICY "read_parties" ON public.parties FOR SELECT TO authenticated
USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_parties" ON public.parties FOR ALL TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'purchasing') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'purchasing') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

DROP POLICY IF EXISTS "read_contacts" ON public.contacts;
DROP POLICY IF EXISTS "write_contacts" ON public.contacts;

CREATE POLICY "read_contacts" ON public.contacts FOR SELECT TO authenticated
USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_contacts" ON public.contacts FOR ALL TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'purchasing') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'purchasing') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

DROP POLICY IF EXISTS "read_addresses" ON public.addresses;
DROP POLICY IF EXISTS "write_addresses" ON public.addresses;

CREATE POLICY "read_addresses" ON public.addresses FOR SELECT TO authenticated
USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_addresses" ON public.addresses FOR ALL TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'purchasing') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'purchasing') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

-- Items
DROP POLICY IF EXISTS "inventory_read_items" ON public.items;
DROP POLICY IF EXISTS "inventory_write_items" ON public.items;
DROP POLICY IF EXISTS "read_items" ON public.items;
DROP POLICY IF EXISTS "write_items" ON public.items;

CREATE POLICY "read_items" ON public.items FOR SELECT TO authenticated
USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_items" ON public.items FOR ALL TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'purchasing'))
  AND public.user_has_company_access(auth.uid(), entity_id)
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

-- Warehouses
DROP POLICY IF EXISTS "inventory_read_warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "inventory_write_warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "read_warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "write_warehouses" ON public.warehouses;

CREATE POLICY "read_warehouses" ON public.warehouses FOR SELECT TO authenticated
USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_warehouses" ON public.warehouses FOR ALL TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

-- Naming Series
DROP POLICY IF EXISTS "read_naming_series" ON public.naming_series;
DROP POLICY IF EXISTS "write_naming_series" ON public.naming_series;

CREATE POLICY "read_naming_series" ON public.naming_series FOR SELECT TO authenticated
USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_naming_series" ON public.naming_series FOR ALL TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);
