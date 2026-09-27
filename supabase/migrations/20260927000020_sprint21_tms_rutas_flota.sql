-- Migration: Sprint 21 - TMS: Rutas y Flota
-- Gestión de flota propia (vehículos y capacidades) y planificación de rutas de reparto agrupando guías de despacho

-- 1. Tabla vehicles (Flota propia)
CREATE TABLE IF NOT EXISTS public.vehicles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    plate text NOT NULL,
    vehicle_type text,
    capacity_kg numeric(20,2),
    capacity_m3 numeric(20,2),
    active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (entity_id, plate)
);

CREATE INDEX IF NOT EXISTS ix_vehicles_entity ON public.vehicles(entity_id);
CREATE INDEX IF NOT EXISTS ix_vehicles_plate ON public.vehicles(plate);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;

DROP POLICY IF EXISTS "read_vehicles" ON public.vehicles;
CREATE POLICY "read_vehicles" ON public.vehicles FOR SELECT TO authenticated
USING (public.user_has_company_access(auth.uid(), entity_id));

DROP POLICY IF EXISTS "write_vehicles" ON public.vehicles;
CREATE POLICY "write_vehicles" ON public.vehicles FOR ALL TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

-- 2. Enum route_status
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'route_status') THEN
        CREATE TYPE public.route_status AS ENUM ('planificada', 'en_curso', 'finalizada', 'cancelada');
    END IF;
END $$;

-- 3. Tabla routes (Rutas de reparto)
CREATE TABLE IF NOT EXISTS public.routes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    name text,
    route_date date NOT NULL,
    vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
    driver_name text,
    status public.route_status NOT NULL DEFAULT 'planificada',
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_routes_entity ON public.routes(entity_id);
CREATE INDEX IF NOT EXISTS ix_routes_date ON public.routes(route_date);
CREATE INDEX IF NOT EXISTS ix_routes_status ON public.routes(status);

ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.routes TO authenticated;
GRANT ALL ON public.routes TO service_role;

DROP POLICY IF EXISTS "read_routes" ON public.routes;
CREATE POLICY "read_routes" ON public.routes FOR SELECT TO authenticated
USING (public.user_has_company_access(auth.uid(), entity_id));

DROP POLICY IF EXISTS "write_routes" ON public.routes;
CREATE POLICY "write_routes" ON public.routes FOR ALL TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

-- 4. Tabla route_stops (Paradas de la ruta con guías asignadas y orden de entrega)
CREATE TABLE IF NOT EXISTS public.route_stops (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id uuid REFERENCES public.routes(id) ON DELETE CASCADE NOT NULL,
    dispatch_note_id uuid REFERENCES public.dispatch_notes(id) ON DELETE RESTRICT NOT NULL,
    stop_order integer NOT NULL,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (route_id, dispatch_note_id)
);

CREATE INDEX IF NOT EXISTS ix_route_stops_route ON public.route_stops(route_id);
CREATE INDEX IF NOT EXISTS ix_route_stops_note ON public.route_stops(dispatch_note_id);
CREATE INDEX IF NOT EXISTS ix_route_stops_order ON public.route_stops(route_id, stop_order);

ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_stops TO authenticated;
GRANT ALL ON public.route_stops TO service_role;

DROP POLICY IF EXISTS "read_route_stops" ON public.route_stops;
CREATE POLICY "read_route_stops" ON public.route_stops FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.routes r
    WHERE r.id = route_stops.route_id
    AND public.user_has_company_access(auth.uid(), r.entity_id)
  )
);

DROP POLICY IF EXISTS "write_route_stops" ON public.route_stops;
CREATE POLICY "write_route_stops" ON public.route_stops FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.routes r
    WHERE r.id = route_stops.route_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'accountant'))
    AND public.user_has_company_access(auth.uid(), r.entity_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.routes r
    WHERE r.id = route_stops.route_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'inventory') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'accountant'))
    AND public.user_has_company_access(auth.uid(), r.entity_id)
  )
);
