DROP POLICY IF EXISTS "Authenticated users can read roles" ON public.roles;
DROP POLICY IF EXISTS "Authenticated users can read role modules" ON public.role_modules;
DROP POLICY IF EXISTS "read_entities" ON public.entities;

DROP POLICY IF EXISTS "company_modules_read" ON public.company_modules;
CREATE POLICY "company_modules_read" ON public.company_modules FOR SELECT TO authenticated
USING (public.user_has_company_access(auth.uid(), entity_id));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bank_accounts','bank_statements','bank_statement_lines'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "read_%1$s" ON public.%1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "write_%1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "read_%1$s" ON public.%1$I FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), entity_id))', t);
    EXECUTE format('CREATE POLICY "write_%1$s" ON public.%1$I FOR ALL TO authenticated USING ((public.has_role(auth.uid(),''admin'') OR public.has_role(auth.uid(),''accountant'')) AND public.user_has_company_access(auth.uid(), entity_id)) WITH CHECK ((public.has_role(auth.uid(),''admin'') OR public.has_role(auth.uid(),''accountant'')) AND public.user_has_company_access(auth.uid(), entity_id))', t);
  END LOOP;
END $$;