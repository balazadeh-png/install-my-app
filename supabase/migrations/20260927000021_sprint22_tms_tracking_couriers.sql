-- ============================================================================
-- SPRINT 22: TMS — Tracking y Couriers Externos
-- Objetivo:
-- 1. Registrar el avance de entregas por parada (stop_delivery_status: pendiente, en_ruta, entregado, no_entregado).
-- 2. Capturar marca temporal (arrived_at), geolocalización aproximada (lat, lng), receptor (received_by) y notas de entrega (delivery_notes).
-- 3. Habilitar modelo genérico de couriers externos en guías de despacho (courier_name, courier_tracking_number, courier_status).
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stop_delivery_status') THEN
    CREATE TYPE public.stop_delivery_status AS ENUM ('pendiente', 'en_ruta', 'entregado', 'no_entregado');
  END IF;
END $$;

-- 1. Extensión de paradas de ruta (route_stops)
ALTER TABLE public.route_stops 
  ADD COLUMN IF NOT EXISTS delivery_status public.stop_delivery_status NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS lat numeric(9,6),
  ADD COLUMN IF NOT EXISTS lng numeric(9,6),
  ADD COLUMN IF NOT EXISTS received_by text,
  ADD COLUMN IF NOT EXISTS delivery_notes text;

CREATE INDEX IF NOT EXISTS idx_route_stops_delivery_status ON public.route_stops(delivery_status);

-- 2. Extensión de guías de despacho para transporte vía courier externo (dispatch_notes)
ALTER TABLE public.dispatch_notes 
  ADD COLUMN IF NOT EXISTS courier_name text,
  ADD COLUMN IF NOT EXISTS courier_tracking_number text,
  ADD COLUMN IF NOT EXISTS courier_status text;

CREATE INDEX IF NOT EXISTS idx_dispatch_notes_courier_tracking ON public.dispatch_notes(courier_tracking_number);
