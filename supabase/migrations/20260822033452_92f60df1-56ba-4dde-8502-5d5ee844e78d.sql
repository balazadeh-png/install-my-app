-- Helper-free approach: replace permissive policies with role-scoped ones

-- 1) Core configuration / master data ------------------------------------
DROP POLICY IF EXISTS "Authenticated users can manage accounts" ON public.accounts;
DROP POLICY IF EXISTS "Authenticated users can manage entities" ON public.entities;
DROP POLICY IF EXISTS "Authenticated users can manage books" ON public.books;
DROP POLICY IF EXISTS "Authenticated users can manage fiscal years" ON public.fiscal_years;
DROP POLICY IF EXISTS "Authenticated users can manage accounting periods" ON public.accounting_periods;
DROP POLICY IF EXISTS "Authenticated users can manage currencies" ON public.currencies;
DROP POLICY IF EXISTS "Authenticated users can manage exchange rates" ON public.exchange_rates;
DROP POLICY IF EXISTS "Authenticated users can manage naming series" ON public.naming_series;
DROP POLICY IF EXISTS "Authenticated users can manage party groups" ON public.party_groups;
DROP POLICY IF EXISTS "Authenticated users can manage items" ON public.items;
DROP POLICY IF EXISTS "Authenticated users can manage item categories" ON public.item_categories;
DROP POLICY IF EXISTS "Authenticated users can manage uom" ON public.uom;
DROP POLICY IF EXISTS "Authenticated users can manage warehouses" ON public.warehouses;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['accounts','entities','books','fiscal_years','accounting_periods','currencies','exchange_rates','naming_series','party_groups'] LOOP
    EXECUTE format('CREATE POLICY "read_%1$s" ON public.%1$I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "write_%1$s" ON public.%1$I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''accountant'')) WITH CHECK (public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''accountant''))', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['items','item_categories','uom','warehouses'] LOOP
    EXECUTE format('CREATE POLICY "read_%1$s" ON public.%1$I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "write_%1$s" ON public.%1$I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''accountant'') OR public.has_role(auth.uid(), ''inventory'')) WITH CHECK (public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''accountant'') OR public.has_role(auth.uid(), ''inventory''))', t);
  END LOOP;
END $$;

-- 2) General ledger --------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can manage gl entries" ON public.gl_entries;

CREATE POLICY "gl_entries_read" ON public.gl_entries FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'accountant')
  OR public.has_role(auth.uid(), 'viewer')
);

CREATE POLICY "gl_entries_write" ON public.gl_entries FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

-- 3) Parties, contacts, addresses -----------------------------------------
DROP POLICY IF EXISTS "Authenticated users can manage parties" ON public.parties;
DROP POLICY IF EXISTS "Authenticated users can manage contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated users can manage addresses" ON public.addresses;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['parties','contacts','addresses'] LOOP
    EXECUTE format('CREATE POLICY "read_%1$s" ON public.%1$I FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''accountant'') OR public.has_role(auth.uid(), ''sales'') OR public.has_role(auth.uid(), ''purchasing'') OR public.has_role(auth.uid(), ''viewer''))', t);
    EXECUTE format('CREATE POLICY "write_%1$s" ON public.%1$I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''sales'') OR public.has_role(auth.uid(), ''purchasing'')) WITH CHECK (public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''sales'') OR public.has_role(auth.uid(), ''purchasing''))', t);
  END LOOP;
END $$;

-- 4) Roles / permission matrix --------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read roles" ON public.roles;
DROP POLICY IF EXISTS "Authenticated users can read role modules" ON public.role_modules;

CREATE POLICY "roles_read_admin" ON public.roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "role_modules_read_admin" ON public.role_modules FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));