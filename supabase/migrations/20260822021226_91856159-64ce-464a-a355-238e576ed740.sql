-- ============================================================================
-- Migración Principal Idempotente - EasyERP
-- ============================================================================

-- 1. Tipos / Enums
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'accountant', 'sales', 'purchasing', 'inventory', 'viewer');
    END IF;
END $$;

-- 2. Tabla user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role public.app_role NOT NULL,
    UNIQUE (user_id, role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- 3. Función has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
CREATE POLICY "Admins can manage user roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
CREATE POLICY "Users can read own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 4. Tabla profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name text UNIQUE NOT NULL,
    full_name text,
    email text UNIQUE,
    language text DEFAULT 'es',
    timezone text DEFAULT 'America/Santiago',
    active boolean DEFAULT true,
    company_id uuid,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 5. Tabla roles
CREATE TABLE IF NOT EXISTS public.roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    note text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage roles" ON public.roles;
CREATE POLICY "Admins can manage roles"
ON public.roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can read roles" ON public.roles;
CREATE POLICY "Authenticated users can read roles"
ON public.roles FOR SELECT
TO authenticated
USING (true);

-- 6. Tabla modules
CREATE TABLE IF NOT EXISTS public.modules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    label text NOT NULL,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.modules TO authenticated;
GRANT ALL ON public.modules TO service_role;

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage modules" ON public.modules;
CREATE POLICY "Admins can manage modules"
ON public.modules FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can read modules" ON public.modules;
CREATE POLICY "Authenticated users can read modules"
ON public.modules FOR SELECT
TO authenticated
USING (true);

-- 7. Tabla role_modules
CREATE TABLE IF NOT EXISTS public.role_modules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id uuid REFERENCES public.roles(id) ON DELETE CASCADE NOT NULL,
    module_id uuid REFERENCES public.modules(id) ON DELETE CASCADE NOT NULL,
    can_access boolean DEFAULT false,
    can_create boolean DEFAULT false,
    can_edit boolean DEFAULT false,
    can_delete boolean DEFAULT false,
    can_view boolean DEFAULT false,
    can_approve boolean DEFAULT false,
    can_report boolean DEFAULT false,
    can_import boolean DEFAULT false,
    can_setup boolean DEFAULT false,
    can_close boolean DEFAULT false,
    UNIQUE (role_id, module_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_modules TO authenticated;
GRANT ALL ON public.role_modules TO service_role;

ALTER TABLE public.role_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage role modules" ON public.role_modules;
CREATE POLICY "Admins can manage role modules"
ON public.role_modules FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can read role modules" ON public.role_modules;
CREATE POLICY "Authenticated users can read role modules"
ON public.role_modules FOR SELECT
TO authenticated
USING (true);

-- 8. Tabla entities
CREATE TABLE IF NOT EXISTS public.entities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,
    name text NOT NULL,
    tax_id text,
    currency text NOT NULL,
    default_book_id uuid,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entities TO authenticated;
GRANT ALL ON public.entities TO service_role;

ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage entities" ON public.entities;
CREATE POLICY "Authenticated users can manage entities"
ON public.entities FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 9. Tabla currencies
CREATE TABLE IF NOT EXISTS public.currencies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,
    name text NOT NULL,
    decimals integer DEFAULT 2,
    active boolean DEFAULT true,
    is_default boolean DEFAULT false,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.currencies TO authenticated;
GRANT ALL ON public.currencies TO service_role;

ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage currencies" ON public.currencies;
CREATE POLICY "Authenticated users can manage currencies"
ON public.currencies FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 10. Tabla exchange_rates
CREATE TABLE IF NOT EXISTS public.exchange_rates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    origin text NOT NULL,
    destination text NOT NULL,
    rate numeric(20,9) NOT NULL,
    date date NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (origin, destination, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exchange_rates TO authenticated;
GRANT ALL ON public.exchange_rates TO service_role;

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage exchange rates" ON public.exchange_rates;
CREATE POLICY "Authenticated users can manage exchange rates"
ON public.exchange_rates FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 11. Tabla books
CREATE TABLE IF NOT EXISTS public.books (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,
    name text NOT NULL,
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.books TO authenticated;
GRANT ALL ON public.books TO service_role;

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage books" ON public.books;
CREATE POLICY "Authenticated users can manage books"
ON public.books FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 12. Tabla fiscal_years
CREATE TABLE IF NOT EXISTS public.fiscal_years (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT,
    closed boolean DEFAULT false,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_years TO authenticated;
GRANT ALL ON public.fiscal_years TO service_role;

ALTER TABLE public.fiscal_years ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage fiscal years" ON public.fiscal_years;
CREATE POLICY "Authenticated users can manage fiscal years"
ON public.fiscal_years FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 13. Tabla accounting_periods
CREATE TABLE IF NOT EXISTS public.accounting_periods (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    fiscal_year_id uuid REFERENCES public.fiscal_years(id) ON DELETE RESTRICT,
    closed boolean DEFAULT false,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_periods TO authenticated;
GRANT ALL ON public.accounting_periods TO service_role;

ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage accounting periods" ON public.accounting_periods;
CREATE POLICY "Authenticated users can manage accounting periods"
ON public.accounting_periods FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 14. Tabla accounts
CREATE TABLE IF NOT EXISTS public.accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL,
    name text NOT NULL,
    account_type text NOT NULL,
    parent_id uuid REFERENCES public.accounts(id) ON DELETE RESTRICT,
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT,
    is_group boolean DEFAULT false,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (code, entity_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage accounts" ON public.accounts;
CREATE POLICY "Authenticated users can manage accounts"
ON public.accounts FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 15. Tabla party_groups
CREATE TABLE IF NOT EXISTS public.party_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    classification text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.party_groups TO authenticated;
GRANT ALL ON public.party_groups TO service_role;

ALTER TABLE public.party_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage party groups" ON public.party_groups;
CREATE POLICY "Authenticated users can manage party groups"
ON public.party_groups FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 16. Tabla parties
CREATE TABLE IF NOT EXISTS public.parties (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    commercial_name text,
    classification text NOT NULL,
    group_id uuid REFERENCES public.party_groups(id) ON DELETE RESTRICT,
    tax_id text,
    enabled boolean DEFAULT true,
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parties TO authenticated;
GRANT ALL ON public.parties TO service_role;

ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage parties" ON public.parties;
CREATE POLICY "Authenticated users can manage parties"
ON public.parties FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 17. Tabla contacts
CREATE TABLE IF NOT EXISTS public.contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id uuid REFERENCES public.parties(id) ON DELETE CASCADE NOT NULL,
    first_name text,
    last_name text,
    email text,
    phone text,
    is_primary boolean DEFAULT false,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage contacts" ON public.contacts;
CREATE POLICY "Authenticated users can manage contacts"
ON public.contacts FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 18. Tabla addresses
CREATE TABLE IF NOT EXISTS public.addresses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id uuid REFERENCES public.parties(id) ON DELETE CASCADE NOT NULL,
    address_line_1 text,
    address_line_2 text,
    city text,
    state text,
    country text,
    postal_code text,
    is_primary boolean DEFAULT false,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;
GRANT ALL ON public.addresses TO service_role;

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage addresses" ON public.addresses;
CREATE POLICY "Authenticated users can manage addresses"
ON public.addresses FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 19. Tabla uom
CREATE TABLE IF NOT EXISTS public.uom (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,
    name text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.uom TO authenticated;
GRANT ALL ON public.uom TO service_role;

ALTER TABLE public.uom ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage uom" ON public.uom;
CREATE POLICY "Authenticated users can manage uom"
ON public.uom FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 20. Tabla item_categories
CREATE TABLE IF NOT EXISTS public.item_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    parent_id uuid REFERENCES public.item_categories(id) ON DELETE RESTRICT,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_categories TO authenticated;
GRANT ALL ON public.item_categories TO service_role;

ALTER TABLE public.item_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage item categories" ON public.item_categories;
CREATE POLICY "Authenticated users can manage item categories"
ON public.item_categories FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 21. Tabla items
CREATE TABLE IF NOT EXISTS public.items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,
    name text NOT NULL,
    category_id uuid REFERENCES public.item_categories(id) ON DELETE RESTRICT,
    uom_id uuid REFERENCES public.uom(id) ON DELETE RESTRICT,
    is_stock_item boolean DEFAULT false,
    default_warehouse_id uuid,
    valuation_method text DEFAULT 'FIFO',
    active boolean DEFAULT true,
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT ALL ON public.items TO service_role;

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage items" ON public.items;
CREATE POLICY "Authenticated users can manage items"
ON public.items FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 22. Tabla warehouses
CREATE TABLE IF NOT EXISTS public.warehouses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,
    name text NOT NULL,
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO authenticated;
GRANT ALL ON public.warehouses TO service_role;

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage warehouses" ON public.warehouses;
CREATE POLICY "Authenticated users can manage warehouses"
ON public.warehouses FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 23. Tabla gl_entries
CREATE TABLE IF NOT EXISTS public.gl_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_number text,
    posting_date date NOT NULL,
    account_id uuid REFERENCES public.accounts(id) ON DELETE RESTRICT NOT NULL,
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT,
    book_id uuid REFERENCES public.books(id) ON DELETE RESTRICT,
    party_id uuid REFERENCES public.parties(id) ON DELETE RESTRICT,
    debit numeric(20,9) DEFAULT 0,
    credit numeric(20,9) DEFAULT 0,
    currency text,
    exchange_rate numeric(20,9) DEFAULT 1,
    memo text,
    voucher_type text,
    voucher_id uuid,
    is_reversal boolean DEFAULT false,
    reversal_of uuid,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gl_entries TO authenticated;
GRANT ALL ON public.gl_entries TO service_role;

ALTER TABLE public.gl_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage gl entries" ON public.gl_entries;
CREATE POLICY "Authenticated users can manage gl entries"
ON public.gl_entries FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 24. Tabla naming_series
CREATE TABLE IF NOT EXISTS public.naming_series (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    prefix text NOT NULL,
    next_number integer DEFAULT 1,
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.naming_series TO authenticated;
GRANT ALL ON public.naming_series TO service_role;

ALTER TABLE public.naming_series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage naming series" ON public.naming_series;
CREATE POLICY "Authenticated users can manage naming series"
ON public.naming_series FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 25. Carga de Semillas Iniciales (Idempotente)
INSERT INTO public.modules (name, label) VALUES
    ('accounting', 'Contabilidad'),
    ('cash', 'Bancos / Tesorería'),
    ('purchases', 'Compras'),
    ('sales', 'Ventas'),
    ('inventory', 'Inventario'),
    ('reports', 'Reportes'),
    ('setup', 'Configuración')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.roles (name, note) VALUES
    ('admin', 'Administrador del sistema'),
    ('accountant', 'Contador'),
    ('sales_user', 'Usuario de ventas'),
    ('purchasing_user', 'Usuario de compras'),
    ('inventory_user', 'Usuario de inventario'),
    ('viewer', 'Solo lectura')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.currencies (code, name, decimals, is_default) VALUES
    ('CLP', 'Peso Chileno', 0, true),
    ('USD', 'Dólar Estadounidense', 2, false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.uom (code, name) VALUES
    ('UNIDAD', 'Unidad'),
    ('KG', 'Kilogramo'),
    ('LT', 'Litro')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.party_groups (name, classification) VALUES
    ('Clientes Generales', 'customer'),
    ('Proveedores Generales', 'supplier')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.item_categories (name) VALUES
    ('Productos Terminados'),
    ('Materia Prima'),
    ('Servicios')
ON CONFLICT DO NOTHING;
