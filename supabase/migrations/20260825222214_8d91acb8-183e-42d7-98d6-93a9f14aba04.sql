-- 1) Remove blanket "any authenticated user can manage" policies (USING true / WITH CHECK true)
DROP POLICY IF EXISTS "Authenticated users can manage accounts" ON public.accounts;
DROP POLICY IF EXISTS "Authenticated users can manage addresses" ON public.addresses;
DROP POLICY IF EXISTS "Authenticated users can manage accounting periods" ON public.accounting_periods;
DROP POLICY IF EXISTS "Authenticated users can manage books" ON public.books;
DROP POLICY IF EXISTS "Authenticated users can manage contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated users can manage currencies" ON public.currencies;
DROP POLICY IF EXISTS "Authenticated users can manage entities" ON public.entities;
DROP POLICY IF EXISTS "Authenticated users can manage exchange rates" ON public.exchange_rates;
DROP POLICY IF EXISTS "Authenticated users can manage fiscal years" ON public.fiscal_years;
DROP POLICY IF EXISTS "Authenticated users can manage gl entries" ON public.gl_entries;
DROP POLICY IF EXISTS "Authenticated users can manage item categories" ON public.item_categories;
DROP POLICY IF EXISTS "Authenticated users can manage items" ON public.items;
DROP POLICY IF EXISTS "Authenticated users can manage naming series" ON public.naming_series;
DROP POLICY IF EXISTS "Authenticated users can manage parties" ON public.parties;
DROP POLICY IF EXISTS "Authenticated users can manage party groups" ON public.party_groups;
DROP POLICY IF EXISTS "Authenticated users can manage uom" ON public.uom;
DROP POLICY IF EXISTS "Authenticated users can manage warehouses" ON public.warehouses;

-- 2) Revoke anonymous EXECUTE on SECURITY DEFINER functions (keep authenticated + service_role)
REVOKE EXECUTE ON FUNCTION public.calculate_f22(uuid, date, date) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.calculate_f29(uuid, date, date) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.close_accounting_period(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.close_pos_session(uuid, numeric) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_production_order(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_pos_sale(uuid, uuid, jsonb, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_warehouse_transfer(uuid, uuid, uuid, uuid, numeric, date, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dispose_fixed_asset(uuid, date, numeric, uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_dj(uuid, uuid, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_exchange_rate(text, text, date) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_next_entry_number(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_sii_book_data(uuid, sii_book_type, date, date) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.post_journal_entry(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.post_purchase_invoice(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.post_sales_invoice(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reconcile_rcv_batch(uuid, date, date, text, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reverse_journal_entry(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.run_exchange_revaluation(uuid, date) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.run_monthly_depreciation(uuid, date) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_dj_status(uuid, dj_generation_status) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_tax_run_status(uuid, tax_calculation_status, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_has_company_access(uuid, uuid) FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.calculate_f22(uuid, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculate_f29(uuid, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.close_accounting_period(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.close_pos_session(uuid, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_production_order(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_pos_sale(uuid, uuid, jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_warehouse_transfer(uuid, uuid, uuid, uuid, numeric, date, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dispose_fixed_asset(uuid, date, numeric, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_dj(uuid, uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_exchange_rate(text, text, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_next_entry_number(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_sii_book_data(uuid, sii_book_type, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_journal_entry(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_purchase_invoice(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_sales_invoice(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_rcv_batch(uuid, date, date, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reverse_journal_entry(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.run_exchange_revaluation(uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.run_monthly_depreciation(uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_dj_status(uuid, dj_generation_status) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_tax_run_status(uuid, tax_calculation_status, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_company_access(uuid, uuid) TO authenticated, service_role;

-- 3) Fix mutable search_path on trigger functions
ALTER FUNCTION public.consume_fifo_layers() SET search_path = public;
ALTER FUNCTION public.create_fifo_layer() SET search_path = public;
ALTER FUNCTION public.resolve_line_currency_amounts() SET search_path = public;
ALTER FUNCTION public.trg_enforce_journal_immutability() SET search_path = public;
ALTER FUNCTION public.validate_line_dimensions() SET search_path = public;

-- 4) Convert SECURITY DEFINER views to SECURITY INVOKER
ALTER VIEW public.stock_balances SET (security_invoker = true);
ALTER VIEW public.sales_invoice_balances SET (security_invoker = true);
ALTER VIEW public.purchase_invoice_balances SET (security_invoker = true);