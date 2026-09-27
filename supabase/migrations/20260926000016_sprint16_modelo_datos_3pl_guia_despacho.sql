-- ============================================================================
-- Sprint 16: Modelo de Datos 3PL y Guía de Despacho (Res. Ex. N° 154 SII) — EasyERP
-- ============================================================================

-- 1. Reutilizar 'parties' para clientes 3PL (inventario en custodia de terceros)
ALTER TABLE public.parties ADD COLUMN IF NOT EXISTS is_3pl_client boolean DEFAULT false;
CREATE INDEX IF NOT EXISTS ix_parties_is_3pl_client ON public.parties(is_3pl_client) WHERE is_3pl_client = true;

-- 2. Tabla party_warehouses: qué bodega(s) de la empresa tiene asignadas cada cliente 3PL
CREATE TABLE IF NOT EXISTS public.party_warehouses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE,
    party_id uuid REFERENCES public.parties(id) ON DELETE CASCADE NOT NULL,
    warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (party_id, warehouse_id)
);

CREATE INDEX IF NOT EXISTS ix_pw_party ON public.party_warehouses(party_id);
CREATE INDEX IF NOT EXISTS ix_pw_warehouse ON public.party_warehouses(warehouse_id);
CREATE INDEX IF NOT EXISTS ix_pw_entity ON public.party_warehouses(entity_id);

ALTER TABLE public.party_warehouses ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.party_warehouses TO authenticated;
GRANT ALL ON public.party_warehouses TO service_role;

DROP POLICY IF EXISTS "read_party_warehouses" ON public.party_warehouses;
CREATE POLICY "read_party_warehouses" ON public.party_warehouses FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.parties p 
    WHERE p.id = party_warehouses.party_id AND public.user_has_company_access(auth.uid(), p.entity_id)
  )
);

DROP POLICY IF EXISTS "write_party_warehouses" ON public.party_warehouses;
CREATE POLICY "write_party_warehouses" ON public.party_warehouses FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.parties p 
    WHERE p.id = party_warehouses.party_id 
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'accountant'))
    AND public.user_has_company_access(auth.uid(), p.entity_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.parties p 
    WHERE p.id = party_warehouses.party_id 
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'accountant'))
    AND public.user_has_company_access(auth.uid(), p.entity_id)
  )
);

-- 3. Segregación del inventario existente por cliente 3PL
-- null = inventario propio de la empresa; no nulo = mercadería en custodia de ese cliente 3PL
ALTER TABLE public.stock_ledger_entries ADD COLUMN IF NOT EXISTS party_id uuid REFERENCES public.parties(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS ix_sle_party ON public.stock_ledger_entries(party_id);

-- Redefinir la vista stock_balances incluyendo party_id y metadatos del cliente
DROP VIEW IF EXISTS public.stock_balances CASCADE;

CREATE VIEW public.stock_balances AS
SELECT 
    s.entity_id,
    s.item_id,
    s.warehouse_id,
    s.party_id,
    p.name AS party_name,
    p.tax_id AS party_tax_id,
    i.code AS item_code,
    i.name AS item_name,
    w.code AS warehouse_code,
    w.name AS warehouse_name,
    COALESCE(SUM(s.qty_change), 0) AS qty_on_hand,
    COALESCE(SUM(s.qty_change * s.valuation_rate), 0) AS value_on_hand,
    CASE 
        WHEN COALESCE(SUM(s.qty_change), 0) > 0 
        THEN ROUND(COALESCE(SUM(s.qty_change * s.valuation_rate), 0) / SUM(s.qty_change), 4)
        ELSE 0 
    END AS avg_rate
FROM public.stock_ledger_entries s
JOIN public.items i ON i.id = s.item_id
JOIN public.warehouses w ON w.id = s.warehouse_id
LEFT JOIN public.parties p ON p.id = s.party_id
GROUP BY s.entity_id, s.item_id, s.warehouse_id, s.party_id, p.name, p.tax_id, i.code, i.name, w.code, w.name;

ALTER VIEW public.stock_balances SET (security_invoker = true);
GRANT SELECT ON public.stock_balances TO authenticated, service_role;

-- 4. Tipos Enums para Guías de Despacho (Res. 154 SII)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispatch_transfer_type') THEN
        CREATE TYPE public.dispatch_transfer_type AS ENUM ('venta', 'traslado_interno', 'consignacion', 'exportacion', 'otro');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispatch_status') THEN
        CREATE TYPE public.dispatch_status AS ENUM ('draft', 'issued', 'cancelled');
    END IF;
END $$;

-- 5. Tabla dispatch_notes (Guías de Despacho con requisitos Res. 154 SII)
CREATE TABLE IF NOT EXISTS public.dispatch_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT NOT NULL,
    party_id uuid REFERENCES public.parties(id) ON DELETE RESTRICT NOT NULL, -- Cliente 3PL dueño de la carga
    warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE RESTRICT NOT NULL,
    dispatch_number text,                                                     -- Gancho para folio DTE oficial
    transfer_type public.dispatch_transfer_type NOT NULL,
    origin_address text NOT NULL,
    destination_address text NOT NULL,
    carrier_name text NOT NULL,
    carrier_tax_id text NOT NULL,
    vehicle_plate text NOT NULL,
    departure_at timestamptz NOT NULL,
    arrival_at timestamptz,
    status public.dispatch_status NOT NULL DEFAULT 'draft',
    notes text,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_dn_entity ON public.dispatch_notes(entity_id);
CREATE INDEX IF NOT EXISTS ix_dn_party ON public.dispatch_notes(party_id);
CREATE INDEX IF NOT EXISTS ix_dn_warehouse ON public.dispatch_notes(warehouse_id);
CREATE INDEX IF NOT EXISTS ix_dn_status ON public.dispatch_notes(status);
CREATE INDEX IF NOT EXISTS ix_dn_created_at ON public.dispatch_notes(created_at);

ALTER TABLE public.dispatch_notes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispatch_notes TO authenticated;
GRANT ALL ON public.dispatch_notes TO service_role;

DROP POLICY IF EXISTS "read_dispatch_notes" ON public.dispatch_notes;
CREATE POLICY "read_dispatch_notes" ON public.dispatch_notes FOR SELECT TO authenticated
USING (public.user_has_company_access(auth.uid(), entity_id));

DROP POLICY IF EXISTS "write_dispatch_notes" ON public.dispatch_notes;
CREATE POLICY "write_dispatch_notes" ON public.dispatch_notes FOR ALL TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

-- 6. Tabla dispatch_note_lines (Líneas de la Guía de Despacho)
CREATE TABLE IF NOT EXISTS public.dispatch_note_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_note_id uuid REFERENCES public.dispatch_notes(id) ON DELETE CASCADE NOT NULL,
    item_id uuid REFERENCES public.items(id) ON DELETE RESTRICT NOT NULL,
    qty numeric(20,4) NOT NULL,
    uom text,
    weight_kg numeric(20,4),
    volume_m3 numeric(20,4),
    unit_value numeric(20,4)
);

CREATE INDEX IF NOT EXISTS ix_dnl_note ON public.dispatch_note_lines(dispatch_note_id);
CREATE INDEX IF NOT EXISTS ix_dnl_item ON public.dispatch_note_lines(item_id);

ALTER TABLE public.dispatch_note_lines ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispatch_note_lines TO authenticated;
GRANT ALL ON public.dispatch_note_lines TO service_role;

DROP POLICY IF EXISTS "read_dispatch_note_lines" ON public.dispatch_note_lines;
CREATE POLICY "read_dispatch_note_lines" ON public.dispatch_note_lines FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.dispatch_notes dn
    WHERE dn.id = dispatch_note_lines.dispatch_note_id
    AND public.user_has_company_access(auth.uid(), dn.entity_id)
  )
);

DROP POLICY IF EXISTS "write_dispatch_note_lines" ON public.dispatch_note_lines;
CREATE POLICY "write_dispatch_note_lines" ON public.dispatch_note_lines FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.dispatch_notes dn
    WHERE dn.id = dispatch_note_lines.dispatch_note_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'accountant'))
    AND public.user_has_company_access(auth.uid(), dn.entity_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.dispatch_notes dn
    WHERE dn.id = dispatch_note_lines.dispatch_note_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'accountant'))
    AND public.user_has_company_access(auth.uid(), dn.entity_id)
  )
);
