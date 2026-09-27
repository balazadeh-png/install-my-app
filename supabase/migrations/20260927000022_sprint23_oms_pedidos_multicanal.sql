-- ============================================================================
-- SPRINT 23: OMS — Pedidos Multicanal y Webhook de Integración
-- Objetivo:
-- 1. Tablas sales_orders y sales_order_lines para recibir pedidos de e-commerce (Shopify, VTEX, Mercado Libre, etc.).
-- 2. Restricción anti-duplicados por (party_id, channel, external_order_id).
-- 3. Tabla party_webhook_tokens para generar tokens por cliente 3PL.
-- 4. Función segura ingest_oms_order para ingestión directa mediante webhook por token.
-- 5. RLS multiempresa en todas las tablas.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE public.order_status AS ENUM ('pendiente', 'procesado', 'cancelado');
  END IF;
END $$;

-- 1. Tabla de Pedidos de Venta Multicanal (sales_orders)
CREATE TABLE IF NOT EXISTS public.sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES public.entities(id) NOT NULL,
  party_id uuid REFERENCES public.parties(id) ON DELETE CASCADE NOT NULL,
  channel text NOT NULL DEFAULT 'manual',
  external_order_id text,
  destination_address text,
  status public.order_status NOT NULL DEFAULT 'pendiente',
  dispatch_note_id uuid REFERENCES public.dispatch_notes(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (party_id, channel, external_order_id)
);

CREATE INDEX IF NOT EXISTS idx_sales_orders_entity ON public.sales_orders(entity_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_party ON public.sales_orders(party_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON public.sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_ext_id ON public.sales_orders(external_order_id);

-- 2. Tabla de Líneas de Pedido (sales_order_lines)
CREATE TABLE IF NOT EXISTS public.sales_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid REFERENCES public.sales_orders(id) ON DELETE CASCADE NOT NULL,
  item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
  external_sku text,
  qty numeric(20,4) NOT NULL CHECK (qty > 0)
);

CREATE INDEX IF NOT EXISTS idx_sales_order_lines_order ON public.sales_order_lines(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_lines_item ON public.sales_order_lines(item_id);

-- 3. Tabla de Tokens para Webhooks de Integración (party_webhook_tokens)
CREATE TABLE IF NOT EXISTS public.party_webhook_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid REFERENCES public.parties(id) ON DELETE CASCADE NOT NULL,
  token text NOT NULL UNIQUE,
  name text DEFAULT 'Webhook E-Commerce',
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_party_webhook_tokens_party ON public.party_webhook_tokens(party_id);
CREATE INDEX IF NOT EXISTS idx_party_webhook_tokens_token ON public.party_webhook_tokens(token);

-- 4. Políticas de Row Level Security (RLS)

-- sales_orders
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_orders_select_policy" ON public.sales_orders
FOR SELECT USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'viewer'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

CREATE POLICY "sales_orders_modify_policy" ON public.sales_orders
FOR ALL USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

-- sales_order_lines
ALTER TABLE public.sales_order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_order_lines_select_policy" ON public.sales_order_lines
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.sales_orders so
    WHERE so.id = sales_order_lines.sales_order_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'viewer'))
    AND public.user_has_company_access(auth.uid(), so.entity_id)
  )
);

CREATE POLICY "sales_order_lines_modify_policy" ON public.sales_order_lines
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.sales_orders so
    WHERE so.id = sales_order_lines.sales_order_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'accountant'))
    AND public.user_has_company_access(auth.uid(), so.entity_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sales_orders so
    WHERE so.id = sales_order_lines.sales_order_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'accountant'))
    AND public.user_has_company_access(auth.uid(), so.entity_id)
  )
);

-- party_webhook_tokens
ALTER TABLE public.party_webhook_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "party_webhook_tokens_select_policy" ON public.party_webhook_tokens
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.parties p
    WHERE p.id = party_webhook_tokens.party_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'accountant'))
    AND public.user_has_company_access(auth.uid(), p.entity_id)
  )
);

CREATE POLICY "party_webhook_tokens_modify_policy" ON public.party_webhook_tokens
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.parties p
    WHERE p.id = party_webhook_tokens.party_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'sales'))
    AND public.user_has_company_access(auth.uid(), p.entity_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.parties p
    WHERE p.id = party_webhook_tokens.party_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'sales'))
    AND public.user_has_company_access(auth.uid(), p.entity_id)
  )
);

-- 5. Función RPC / Webhook Ingestion Engine
-- Permite recibir pedidos desde el exterior de forma segura mediante token de cliente
CREATE OR REPLACE FUNCTION public.ingest_oms_order(
  p_token text,
  p_channel text,
  p_external_order_id text,
  p_destination_address text,
  p_lines jsonb,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_party_id uuid;
  v_entity_id uuid;
  v_order_id uuid;
  v_line jsonb;
  v_sku text;
  v_qty numeric;
  v_item_id uuid;
BEGIN
  -- Validar token
  SELECT pwt.party_id, p.entity_id
  INTO v_party_id, v_entity_id
  FROM public.party_webhook_tokens pwt
  JOIN public.parties p ON p.id = pwt.party_id
  WHERE pwt.token = p_token AND pwt.is_active = true;

  IF v_party_id IS NULL THEN
    RAISE EXCEPTION 'Token de integración inválido o inactivo';
  END IF;

  IF p_channel IS NULL OR trim(p_channel) = '' THEN
    p_channel := 'webhook';
  END IF;

  -- Upsert del pedido en sales_orders
  INSERT INTO public.sales_orders (
    entity_id,
    party_id,
    channel,
    external_order_id,
    destination_address,
    status,
    notes
  )
  VALUES (
    v_entity_id,
    v_party_id,
    trim(p_channel),
    trim(p_external_order_id),
    trim(p_destination_address),
    'pendiente',
    p_notes
  )
  ON CONFLICT (party_id, channel, external_order_id)
  DO UPDATE SET
    destination_address = EXCLUDED.destination_address,
    notes = COALESCE(EXCLUDED.notes, sales_orders.notes),
    updated_at = now()
  RETURNING id INTO v_order_id;

  -- Reemplazar líneas del pedido si se reenvía
  DELETE FROM public.sales_order_lines WHERE sales_order_id = v_order_id;

  -- Insertar cada línea resolviendo SKU contra catálogo de ítems de la empresa
  IF p_lines IS NOT NULL AND jsonb_array_length(p_lines) > 0 THEN
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
      v_sku := trim(COALESCE(v_line->>'external_sku', v_line->>'sku', ''));
      v_qty := COALESCE((v_line->>'qty')::numeric, 1);

      IF v_qty > 0 THEN
        -- Buscar ítem por código si existe
        v_item_id := NULL;
        IF v_sku <> '' THEN
          SELECT id INTO v_item_id
          FROM public.items
          WHERE entity_id = v_entity_id
          AND (code = v_sku OR name ILIKE v_sku)
          LIMIT 1;
        END IF;

        INSERT INTO public.sales_order_lines (
          sales_order_id,
          item_id,
          external_sku,
          qty
        ) VALUES (
          v_order_id,
          v_item_id,
          v_sku,
          v_qty
        );
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'party_id', v_party_id,
    'channel', p_channel,
    'external_order_id', p_external_order_id,
    'status', 'pendiente'
  );
END;
$$;

-- 6. Trigger updated_at para sales_orders
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sales_orders_updated_at') THEN
    CREATE TRIGGER trg_sales_orders_updated_at
      BEFORE UPDATE ON public.sales_orders
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
