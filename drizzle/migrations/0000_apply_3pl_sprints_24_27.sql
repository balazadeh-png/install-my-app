-- Sprint 24: Portal
CREATE TABLE IF NOT EXISTS public.party_portal_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  party_id uuid REFERENCES public.parties(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, party_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.party_portal_users TO authenticated;
GRANT ALL ON public.party_portal_users TO service_role;
CREATE INDEX IF NOT EXISTS idx_party_portal_users_user ON public.party_portal_users(user_id);
CREATE INDEX IF NOT EXISTS idx_party_portal_users_party ON public.party_portal_users(party_id);

CREATE OR REPLACE FUNCTION public.user_has_party_access(check_party_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.party_portal_users WHERE user_id = auth.uid() AND party_id = check_party_id);
$$;
REVOKE EXECUTE ON FUNCTION public.user_has_party_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_party_access(uuid) TO authenticated, service_role;

ALTER TABLE public.party_portal_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "portal_users_read_own" ON public.party_portal_users FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "staff_manage_party_portal_users" ON public.party_portal_users FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.parties p WHERE p.id = party_portal_users.party_id
      AND public.user_has_company_access(auth.uid(), p.entity_id)
      AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'sales') OR public.has_role(auth.uid(),'inventory') OR public.has_role(auth.uid(),'accountant'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.parties p WHERE p.id = party_portal_users.party_id
      AND public.user_has_company_access(auth.uid(), p.entity_id)
      AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'sales') OR public.has_role(auth.uid(),'inventory'))));

DROP POLICY IF EXISTS "portal_read_own_dispatch_notes" ON public.dispatch_notes;
CREATE POLICY "portal_read_own_dispatch_notes" ON public.dispatch_notes FOR SELECT TO authenticated USING (public.user_has_party_access(party_id));
DROP POLICY IF EXISTS "portal_read_own_dispatch_note_lines" ON public.dispatch_note_lines;
CREATE POLICY "portal_read_own_dispatch_note_lines" ON public.dispatch_note_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dispatch_notes dn WHERE dn.id = dispatch_note_lines.dispatch_note_id AND public.user_has_party_access(dn.party_id)));
DROP POLICY IF EXISTS "portal_read_own_stock_ledger" ON public.stock_ledger_entries;
CREATE POLICY "portal_read_own_stock_ledger" ON public.stock_ledger_entries FOR SELECT TO authenticated USING (public.user_has_party_access(party_id));
DROP POLICY IF EXISTS "portal_read_own_party" ON public.parties;
CREATE POLICY "portal_read_own_party" ON public.parties FOR SELECT TO authenticated USING (public.user_has_party_access(id));
DROP POLICY IF EXISTS "portal_read_items" ON public.items;
CREATE POLICY "portal_read_items" ON public.items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.party_portal_users ppu JOIN public.parties p ON p.id = ppu.party_id WHERE ppu.user_id = auth.uid() AND p.entity_id = items.entity_id));
DROP POLICY IF EXISTS "portal_read_warehouses" ON public.warehouses;
CREATE POLICY "portal_read_warehouses" ON public.warehouses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.party_portal_users ppu JOIN public.party_warehouses pw ON pw.party_id = ppu.party_id WHERE ppu.user_id = auth.uid() AND pw.warehouse_id = warehouses.id));
DROP POLICY IF EXISTS "portal_read_warehouse_locations" ON public.warehouse_locations;
CREATE POLICY "portal_read_warehouse_locations" ON public.warehouse_locations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.party_portal_users ppu JOIN public.party_warehouses pw ON pw.party_id = ppu.party_id WHERE ppu.user_id = auth.uid() AND pw.warehouse_id = warehouse_locations.warehouse_id));
DROP POLICY IF EXISTS "portal_read_own_sales_orders" ON public.sales_orders;
CREATE POLICY "portal_read_own_sales_orders" ON public.sales_orders FOR SELECT TO authenticated USING (public.user_has_party_access(party_id));
DROP POLICY IF EXISTS "portal_read_own_sales_order_lines" ON public.sales_order_lines;
CREATE POLICY "portal_read_own_sales_order_lines" ON public.sales_order_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales_orders so WHERE so.id = sales_order_lines.sales_order_id AND public.user_has_party_access(so.party_id)));

ALTER VIEW public.stock_balances SET (security_invoker = true);

CREATE OR REPLACE FUNCTION public.assign_party_portal_user(p_party_id uuid, p_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid; v_entity_id uuid;
BEGIN
  SELECT entity_id INTO v_entity_id FROM public.parties WHERE id = p_party_id;
  IF v_entity_id IS NULL OR NOT public.user_has_company_access(auth.uid(), v_entity_id) THEN
    RAISE EXCEPTION 'No autorizado para gestionar usuarios de este cliente 3PL';
  END IF;
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(trim(p_email));
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró ningún usuario registrado con el correo "%". El cliente debe crear su cuenta primero.', p_email;
  END IF;
  INSERT INTO public.party_portal_users (user_id, party_id) VALUES (v_user_id, p_party_id) ON CONFLICT (user_id, party_id) DO NOTHING;
  RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'party_id', p_party_id, 'email', p_email);
END; $$;

CREATE OR REPLACE FUNCTION public.get_party_portal_users(p_party_id uuid)
RETURNS TABLE (id uuid, user_id uuid, party_id uuid, email text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_entity_id uuid;
BEGIN
  SELECT p.entity_id INTO v_entity_id FROM public.parties p WHERE p.id = p_party_id;
  IF v_entity_id IS NULL OR NOT public.user_has_company_access(auth.uid(), v_entity_id) THEN
    RAISE EXCEPTION 'No autorizado para ver usuarios de este cliente';
  END IF;
  RETURN QUERY SELECT ppu.id, ppu.user_id, ppu.party_id, u.email::text, ppu.created_at
  FROM public.party_portal_users ppu JOIN auth.users u ON u.id = ppu.user_id
  WHERE ppu.party_id = p_party_id ORDER BY ppu.created_at DESC;
END; $$;
REVOKE EXECUTE ON FUNCTION public.assign_party_portal_user(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_party_portal_users(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_party_portal_user(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_party_portal_users(uuid) TO authenticated, service_role;

-- Sprint 25: Contracts
DO $$ BEGIN CREATE TYPE public.billing_frequency AS ENUM ('mensual', 'quincenal'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.service_rate_type AS ENUM ('storage_pallet', 'storage_m2', 'picking_unit', 'transport_km', 'recargo_fijo'); EXCEPTION WHEN duplicate_object THEN null; END $$;

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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_contracts TO authenticated;
GRANT ALL ON public.service_contracts TO service_role;
CREATE INDEX IF NOT EXISTS idx_service_contracts_entity_id ON public.service_contracts(entity_id);
CREATE INDEX IF NOT EXISTS idx_service_contracts_party_id ON public.service_contracts(party_id);

CREATE TABLE IF NOT EXISTS public.service_rate_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES public.service_contracts(id) ON DELETE CASCADE NOT NULL,
  rate_type public.service_rate_type NOT NULL,
  unit_price numeric(20,4) NOT NULL,
  description text,
  created_at timestamptz DEFAULT now() NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_rate_lines TO authenticated;
GRANT ALL ON public.service_rate_lines TO service_role;
CREATE INDEX IF NOT EXISTS idx_service_rate_lines_contract_id ON public.service_rate_lines(contract_id);

ALTER TABLE public.dispatch_notes ADD COLUMN IF NOT EXISTS distance_km numeric(10,2);

ALTER TABLE public.service_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_rate_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_contracts_company_access" ON public.service_contracts FOR ALL TO authenticated
  USING (public.user_has_company_access(auth.uid(), entity_id))
  WITH CHECK (public.user_has_company_access(auth.uid(), entity_id));
CREATE POLICY "service_rate_lines_company_access" ON public.service_rate_lines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.service_contracts sc WHERE sc.id = service_rate_lines.contract_id AND public.user_has_company_access(auth.uid(), sc.entity_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.service_contracts sc WHERE sc.id = service_rate_lines.contract_id AND public.user_has_company_access(auth.uid(), sc.entity_id)));

-- Sprint 26
ALTER TABLE public.sales_invoices ADD COLUMN IF NOT EXISTS adjustment_of_invoice_id uuid REFERENCES public.sales_invoices(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sales_invoices_adjustment_of_invoice_id ON public.sales_invoices(adjustment_of_invoice_id);

-- Sprint 27
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS capacity_m3 numeric(20,2);
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_cost_inputs TO authenticated;
GRANT ALL ON public.operational_cost_inputs TO service_role;
CREATE INDEX IF NOT EXISTS idx_operational_cost_inputs_entity_period ON public.operational_cost_inputs(entity_id, period_start, period_end);
ALTER TABLE public.operational_cost_inputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operational_cost_inputs_company_access" ON public.operational_cost_inputs FOR ALL TO authenticated
  USING (public.user_has_company_access(auth.uid(), entity_id))
  WITH CHECK (public.user_has_company_access(auth.uid(), entity_id));