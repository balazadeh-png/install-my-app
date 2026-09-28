-- ============================================================================
-- SPRINT 24: Portal Cliente 3PL
-- Objetivo:
-- 1. Tabla party_portal_users para vincular usuarios de Supabase Auth con clientes 3PL (parties).
-- 2. Función user_has_party_access(check_party_id uuid).
-- 3. Políticas RLS adicionales de SELECT para clientes del portal en dispatch_notes,
--    dispatch_note_lines, stock_ledger_entries, items, warehouses, parties, etc.
-- 4. Garantizar security_invoker = true en vista stock_balances.
-- 5. Funciones auxiliares para asignar y consultar usuarios del portal por correo.
-- ============================================================================

-- 1. Tabla de Usuarios del Portal por Cliente 3PL
CREATE TABLE IF NOT EXISTS public.party_portal_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  party_id uuid REFERENCES public.parties(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, party_id)
);

CREATE INDEX IF NOT EXISTS idx_party_portal_users_user ON public.party_portal_users(user_id);
CREATE INDEX IF NOT EXISTS idx_party_portal_users_party ON public.party_portal_users(party_id);

-- 2. Función espejo user_has_party_access
CREATE OR REPLACE FUNCTION public.user_has_party_access(check_party_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.party_portal_users
    WHERE user_id = auth.uid() AND party_id = check_party_id
  );
$$;

-- 3. RLS en party_portal_users
ALTER TABLE public.party_portal_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_users_read_own" ON public.party_portal_users;
CREATE POLICY "portal_users_read_own" ON public.party_portal_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "staff_manage_party_portal_users" ON public.party_portal_users;
CREATE POLICY "staff_manage_party_portal_users" ON public.party_portal_users
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parties p
      WHERE p.id = party_portal_users.party_id
      AND public.user_has_company_access(auth.uid(), p.entity_id)
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'accountant'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.parties p
      WHERE p.id = party_portal_users.party_id
      AND public.user_has_company_access(auth.uid(), p.entity_id)
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'inventory'))
    )
  );

-- 4. Políticas adicionales para el Portal Cliente (conviven con las existentes de staff)

-- dispatch_notes: el cliente ve sus propias guías
DROP POLICY IF EXISTS "portal_read_own_dispatch_notes" ON public.dispatch_notes;
CREATE POLICY "portal_read_own_dispatch_notes" ON public.dispatch_notes
  FOR SELECT TO authenticated
  USING (public.user_has_party_access(party_id));

-- dispatch_note_lines: el cliente ve las líneas de sus guías
DROP POLICY IF EXISTS "portal_read_own_dispatch_note_lines" ON public.dispatch_note_lines;
CREATE POLICY "portal_read_own_dispatch_note_lines" ON public.dispatch_note_lines
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dispatch_notes dn
      WHERE dn.id = dispatch_note_lines.dispatch_note_id
      AND public.user_has_party_access(dn.party_id)
    )
  );

-- stock_ledger_entries: el cliente ve sus propios movimientos de custodia
DROP POLICY IF EXISTS "portal_read_own_stock_ledger" ON public.stock_ledger_entries;
CREATE POLICY "portal_read_own_stock_ledger" ON public.stock_ledger_entries
  FOR SELECT TO authenticated
  USING (public.user_has_party_access(party_id));

-- parties: el cliente puede consultar su propio registro de tercero
DROP POLICY IF EXISTS "portal_read_own_party" ON public.parties;
CREATE POLICY "portal_read_own_party" ON public.parties
  FOR SELECT TO authenticated
  USING (public.user_has_party_access(id));

-- items: el cliente puede leer los ítems del catálogo de la empresa que custodia su carga
DROP POLICY IF EXISTS "portal_read_items" ON public.items;
CREATE POLICY "portal_read_items" ON public.items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.party_portal_users ppu
      JOIN public.parties p ON p.id = ppu.party_id
      WHERE ppu.user_id = auth.uid() AND p.entity_id = items.entity_id
    )
  );

-- warehouses: el cliente puede leer las bodegas autorizadas donde guarda mercadería
DROP POLICY IF EXISTS "portal_read_warehouses" ON public.warehouses;
CREATE POLICY "portal_read_warehouses" ON public.warehouses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.party_portal_users ppu
      JOIN public.parties p ON p.id = ppu.party_id
      JOIN public.party_warehouses pw ON pw.party_id = p.id
      WHERE ppu.user_id = auth.uid() AND pw.warehouse_id = warehouses.id
    )
  );

-- warehouse_locations: el cliente puede leer ubicaciones de sus bodegas asignadas
DROP POLICY IF EXISTS "portal_read_warehouse_locations" ON public.warehouse_locations;
CREATE POLICY "portal_read_warehouse_locations" ON public.warehouse_locations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.party_portal_users ppu
      JOIN public.parties p ON p.id = ppu.party_id
      JOIN public.party_warehouses pw ON pw.party_id = p.id
      WHERE ppu.user_id = auth.uid() AND pw.warehouse_id = warehouse_locations.warehouse_id
    )
  );

-- sales_orders: el cliente puede ver sus pedidos multicanal
DROP POLICY IF EXISTS "portal_read_own_sales_orders" ON public.sales_orders;
CREATE POLICY "portal_read_own_sales_orders" ON public.sales_orders
  FOR SELECT TO authenticated
  USING (public.user_has_party_access(party_id));

-- sales_order_lines: el cliente puede ver las líneas de sus pedidos
DROP POLICY IF EXISTS "portal_read_own_sales_order_lines" ON public.sales_order_lines;
CREATE POLICY "portal_read_own_sales_order_lines" ON public.sales_order_lines
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales_orders so
      WHERE so.id = sales_order_lines.sales_order_id
      AND public.user_has_party_access(so.party_id)
    )
  );

-- 5. Asegurar vista stock_balances con security_invoker = true
ALTER VIEW public.stock_balances SET (security_invoker = true);
GRANT SELECT ON public.stock_balances TO authenticated, service_role;

-- 6. Funciones auxiliares para gestión de usuarios del portal por parte de Staff
CREATE OR REPLACE FUNCTION public.assign_party_portal_user(p_party_id uuid, p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_entity_id uuid;
BEGIN
  -- Validar permisos de staff en la empresa asociada al cliente
  SELECT entity_id INTO v_entity_id FROM public.parties WHERE id = p_party_id;
  IF v_entity_id IS NULL OR NOT public.user_has_company_access(auth.uid(), v_entity_id) THEN
    RAISE EXCEPTION 'No autorizado para gestionar usuarios de este cliente 3PL';
  END IF;

  -- Buscar en auth.users por email
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(trim(p_email));
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró ningún usuario registrado en el sistema con el correo "%". El cliente debe crear su cuenta primero.', p_email;
  END IF;

  INSERT INTO public.party_portal_users (user_id, party_id)
  VALUES (v_user_id, p_party_id)
  ON CONFLICT (user_id, party_id) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'party_id', p_party_id,
    'email', p_email
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_party_portal_users(p_party_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  party_id uuid,
  email text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity_id uuid;
BEGIN
  SELECT entity_id INTO v_entity_id FROM public.parties WHERE parties.id = p_party_id;
  IF v_entity_id IS NULL OR NOT public.user_has_company_access(auth.uid(), v_entity_id) THEN
    RAISE EXCEPTION 'No autorizado para ver usuarios de este cliente';
  END IF;

  RETURN QUERY
  SELECT 
    ppu.id,
    ppu.user_id,
    ppu.party_id,
    u.email::text,
    ppu.created_at
  FROM public.party_portal_users ppu
  JOIN auth.users u ON u.id = ppu.user_id
  WHERE ppu.party_id = p_party_id
  ORDER BY ppu.created_at DESC;
END;
$$;
