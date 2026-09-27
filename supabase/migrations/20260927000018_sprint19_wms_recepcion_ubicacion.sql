-- Migration: Sprint 19 - WMS: Recepción y Ubicación (Slotting / Racks / Pasillos)
-- Extensión para Vertical 3PL: Sub-ubicaciones por bodega, control de lotes y calidad en recepciones

-- 1. Tabla warehouse_locations (Sub-ubicaciones dentro de bodegas: pasillo, rack, nivel, posición)
CREATE TABLE IF NOT EXISTS public.warehouse_locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE CASCADE NOT NULL,
    code text NOT NULL,
    name text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (warehouse_id, code)
);

CREATE INDEX IF NOT EXISTS ix_wh_loc_entity ON public.warehouse_locations(entity_id);
CREATE INDEX IF NOT EXISTS ix_wh_loc_warehouse ON public.warehouse_locations(warehouse_id);
CREATE INDEX IF NOT EXISTS ix_wh_loc_code ON public.warehouse_locations(code);

-- RLS warehouse_locations
ALTER TABLE public.warehouse_locations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouse_locations TO authenticated;
GRANT ALL ON public.warehouse_locations TO service_role;

DROP POLICY IF EXISTS "read_warehouse_locations" ON public.warehouse_locations;
CREATE POLICY "read_warehouse_locations" ON public.warehouse_locations FOR SELECT TO authenticated
USING (public.user_has_company_access(auth.uid(), entity_id));

DROP POLICY IF EXISTS "write_warehouse_locations" ON public.warehouse_locations;
CREATE POLICY "write_warehouse_locations" ON public.warehouse_locations FOR ALL TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

-- 2. Extensión de stock_ledger_entries con location_id, lot_number y qc_notes
ALTER TABLE public.stock_ledger_entries ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.warehouse_locations(id) ON DELETE SET NULL;
ALTER TABLE public.stock_ledger_entries ADD COLUMN IF NOT EXISTS lot_number text;
ALTER TABLE public.stock_ledger_entries ADD COLUMN IF NOT EXISTS qc_notes text;

CREATE INDEX IF NOT EXISTS ix_sle_location ON public.stock_ledger_entries(location_id);
CREATE INDEX IF NOT EXISTS ix_sle_lot ON public.stock_ledger_entries(lot_number);

-- 3. Redefinir la vista stock_balances incluyendo ubicación (location_id, location_code, location_name)
DROP VIEW IF EXISTS public.stock_balances CASCADE;

CREATE VIEW public.stock_balances AS
SELECT 
    s.entity_id,
    s.item_id,
    s.warehouse_id,
    s.location_id,
    s.party_id,
    loc.code AS location_code,
    loc.name AS location_name,
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
LEFT JOIN public.warehouse_locations loc ON loc.id = s.location_id
LEFT JOIN public.parties p ON p.id = s.party_id
GROUP BY s.entity_id, s.item_id, s.warehouse_id, s.location_id, loc.code, loc.name, s.party_id, p.name, p.tax_id, i.code, i.name, w.code, w.name;

ALTER VIEW public.stock_balances SET (security_invoker = true);
GRANT SELECT ON public.stock_balances TO authenticated, service_role;
