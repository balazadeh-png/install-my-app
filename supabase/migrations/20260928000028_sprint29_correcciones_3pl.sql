-- ==============================================================================
-- SPRINT 29: Correcciones Post-Revisión de la Vertical 3PL
-- Endurecimiento de Seguridad, RLS Portal, Webhook Idempotente SHA-256
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- D1. Políticas RLS en party_portal_users
-- Un usuario del portal sólo lee sus propias vinculaciones (user_id = auth.uid()).
-- La gestión (crear/modificar/eliminar) está reservada al personal interno de la empresa
-- (roles admin, sales, inventory) con acceso a la empresa (entity_id) del cliente.
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "portal_users_read_own" ON public.party_portal_users;
DROP POLICY IF EXISTS "party_portal_users_read_own" ON public.party_portal_users;
CREATE POLICY "party_portal_users_read_own" ON public.party_portal_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "staff_manage_party_portal_users" ON public.party_portal_users;
DROP POLICY IF EXISTS "party_portal_users_staff_all" ON public.party_portal_users;
CREATE POLICY "party_portal_users_staff_all" ON public.party_portal_users
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parties p
      WHERE p.id = party_portal_users.party_id
        AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'inventory'))
        AND public.user_has_company_access(auth.uid(), p.entity_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.parties p
      WHERE p.id = party_portal_users.party_id
        AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'inventory'))
        AND public.user_has_company_access(auth.uid(), p.entity_id)
    )
  );

-- ------------------------------------------------------------------------------
-- D2. RPC get_party_portal_users(p_party_id uuid)
-- SECURITY DEFINER con verificación estricta de permisos de staff.
-- Revocado a PUBLIC y anon.
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_party_portal_users(uuid);

CREATE OR REPLACE FUNCTION public.get_party_portal_users(p_party_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity uuid;
BEGIN
  SELECT p.entity_id INTO v_entity FROM public.parties p WHERE p.id = p_party_id;
  IF v_entity IS NULL
     OR NOT public.user_has_company_access(auth.uid(), v_entity)
     OR NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'inventory'))
  THEN
    RAISE EXCEPTION 'Sin permiso' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT ppu.id, ppu.user_id, u.email::text, ppu.created_at
    FROM public.party_portal_users ppu
    JOIN auth.users u ON u.id = ppu.user_id
    WHERE ppu.party_id = p_party_id
    ORDER BY ppu.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_party_portal_users(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_party_portal_users(uuid) TO authenticated;

-- ------------------------------------------------------------------------------
-- D3 & D4. Políticas RLS del Portal Cliente (Aislamiento Multi-Inquilino)
-- Catálogo de ítems: el cliente solo ve ítems con movimientos o guías de su cuenta.
-- Entities: el cliente solo ve la empresa que custodia su carga.
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "portal_read_items" ON public.items;
CREATE POLICY "portal_read_items" ON public.items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.party_portal_users ppu
      WHERE ppu.user_id = auth.uid()
        AND (
          EXISTS (
            SELECT 1 FROM public.stock_ledger_entries sle
            WHERE sle.party_id = ppu.party_id AND sle.item_id = items.id
          )
          OR EXISTS (
            SELECT 1 FROM public.dispatch_notes dn
            JOIN public.dispatch_note_lines dnl ON dnl.dispatch_note_id = dn.id
            WHERE dn.party_id = ppu.party_id AND dnl.item_id = items.id
          )
          OR EXISTS (
            SELECT 1 FROM public.sales_orders so
            JOIN public.sales_order_lines sol ON sol.sales_order_id = so.id
            WHERE so.party_id = ppu.party_id AND sol.item_id = items.id
          )
        )
    )
  );

DROP POLICY IF EXISTS "portal_read_own_entity" ON public.entities;
CREATE POLICY "portal_read_own_entity" ON public.entities
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.party_portal_users ppu
      JOIN public.parties p ON p.id = ppu.party_id
      WHERE ppu.user_id = auth.uid() AND p.entity_id = entities.id
    )
  );

-- ------------------------------------------------------------------------------
-- E3. Tokens de Integración: Migración a Hash SHA-256 y Prefijo
-- El texto plano nunca se conserva en disco.
-- ------------------------------------------------------------------------------

ALTER TABLE public.party_webhook_tokens
  ADD COLUMN IF NOT EXISTS token_hash text,
  ADD COLUMN IF NOT EXISTS token_prefix text,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

-- Migrar tokens existentes a hash SHA-256
UPDATE public.party_webhook_tokens
SET token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex'),
    token_prefix = left(token, 12)
WHERE token_hash IS NULL AND token IS NOT NULL;

-- Permitir NULL en token para eliminar el texto plano
ALTER TABLE public.party_webhook_tokens ALTER COLUMN token DROP NOT NULL;
UPDATE public.party_webhook_tokens SET token = NULL WHERE token_hash IS NOT NULL;
ALTER TABLE public.party_webhook_tokens ALTER COLUMN token_hash SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_party_webhook_tokens_hash ON public.party_webhook_tokens(token_hash);
DROP INDEX IF EXISTS public.idx_party_webhook_tokens_token;

-- ------------------------------------------------------------------------------
-- E1 & E2. RPC ingest_oms_order: Idempotente, Atómica y con SKU Exacto
-- Valida token por hash SHA-256. Códigos de error: 28000 (token) y 22023 (payload).
-- Reintentos de órdenes procesadas devuelven ignored: true sin tocar datos.
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.ingest_oms_order(text, text, text, text, jsonb, text);

CREATE OR REPLACE FUNCTION public.ingest_oms_order(
  p_token text,
  p_channel text,
  p_external_order_id text,
  p_destination_address text,
  p_lines jsonb,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_token_id uuid;
  v_party_id uuid;
  v_entity_id uuid;
  v_channel text;
  v_ext text;
  v_order_id uuid;
  v_status public.order_status;
  v_line jsonb;
  v_sku text;
  v_qty numeric;
  v_item_id uuid;
BEGIN
  -- 1. Validar Token mediante hash SHA-256
  v_hash := encode(sha256(convert_to(COALESCE(p_token, ''), 'UTF8')), 'hex');

  SELECT pwt.id, pwt.party_id, p.entity_id
    INTO v_token_id, v_party_id, v_entity_id
  FROM public.party_webhook_tokens pwt
  JOIN public.parties p ON p.id = pwt.party_id
  WHERE pwt.token_hash = v_hash AND pwt.is_active = true;

  IF v_party_id IS NULL THEN
    RAISE EXCEPTION 'Token de integración inválido o inactivo' USING ERRCODE = '28000';
  END IF;

  -- 2. Validar payload obligatorio
  v_ext := NULLIF(trim(COALESCE(p_external_order_id, '')), '');
  IF v_ext IS NULL THEN
    RAISE EXCEPTION 'external_order_id es obligatorio' USING ERRCODE = '22023';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'El pedido debe incluir al menos una línea' USING ERRCODE = '22023';
  END IF;

  v_channel := COALESCE(NULLIF(trim(COALESCE(p_channel, '')), ''), 'webhook');

  -- 3. Idempotencia y transacción atómica sobre sales_orders
  INSERT INTO public.sales_orders (
    entity_id, party_id, channel, external_order_id, destination_address, status, notes
  )
  VALUES (
    v_entity_id, v_party_id, v_channel, v_ext,
    NULLIF(trim(COALESCE(p_destination_address, '')), ''), 'pendiente', p_notes
  )
  ON CONFLICT (party_id, channel, external_order_id) DO NOTHING
  RETURNING id INTO v_order_id;

  -- Si ya existía el pedido en el canal
  IF v_order_id IS NULL THEN
    SELECT so.id, so.status INTO v_order_id, v_status
    FROM public.sales_orders so
    WHERE so.party_id = v_party_id AND so.channel = v_channel AND so.external_order_id = v_ext
    FOR UPDATE;

    -- Si ya fue procesado o cancelado, ignorar reintento sin modificar nada
    IF v_status <> 'pendiente' THEN
      RETURN jsonb_build_object(
        'success', true,
        'ignored', true,
        'order_id', v_order_id,
        'external_order_id', v_ext,
        'status', v_status
      );
    END IF;

    -- Si aún está pendiente, actualizar cabecera y reemplazar líneas
    UPDATE public.sales_orders
       SET destination_address = COALESCE(NULLIF(trim(COALESCE(p_destination_address, '')), ''), destination_address),
           notes = COALESCE(p_notes, notes),
           updated_at = now()
     WHERE id = v_order_id;

    DELETE FROM public.sales_order_lines WHERE sales_order_id = v_order_id;
  END IF;

  -- 4. Procesar líneas con matching exacto de SKU (sin ILIKE ni búsquedas difusas)
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_sku := trim(COALESCE(v_line->>'external_sku', v_line->>'sku', ''));
    BEGIN
      v_qty := (v_line->>'qty')::numeric;
    EXCEPTION WHEN invalid_text_representation THEN
      v_qty := NULL;
    END;

    IF v_sku = '' OR v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Cada línea requiere sku y qty > 0 (línea recibida: %)', v_line USING ERRCODE = '22023';
    END IF;

    -- Coincidencia exacta insensible a mayúsculas sobre code o sku del catálogo
    SELECT i.id INTO v_item_id
    FROM public.items i
    WHERE i.entity_id = v_entity_id
      AND (lower(i.code) = lower(v_sku) OR lower(COALESCE(i.sku, '')) = lower(v_sku))
    ORDER BY (lower(i.code) = lower(v_sku)) DESC
    LIMIT 1;

    INSERT INTO public.sales_order_lines (sales_order_id, item_id, external_sku, qty)
    VALUES (v_order_id, v_item_id, v_sku, v_qty);
  END LOOP;

  -- 5. Actualizar última utilización del token
  UPDATE public.party_webhook_tokens SET last_used_at = now() WHERE id = v_token_id;

  RETURN jsonb_build_object(
    'success', true,
    'ignored', false,
    'order_id', v_order_id,
    'party_id', v_party_id,
    'channel', v_channel,
    'external_order_id', v_ext,
    'status', 'pendiente'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_oms_order(text, text, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingest_oms_order(text, text, text, text, jsonb, text) TO anon, authenticated, service_role;
