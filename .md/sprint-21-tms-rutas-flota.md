# Sprint 21 — TMS: Rutas y Flota

**Fase:** 2 — Vertical 3PL / Operación
**Depende de:** Sprint 16 (`dispatch_notes`)
**Bloquea a:** Sprint 22 (tracking se apoya en `routes`)

## Objetivo

Agrupar guías de despacho en rutas de reparto, con flota propia o de terceros asignada a cada una.

## Alcance incluido

- `vehicles`: flota propia (patente, tipo, capacidad) — para transporte propio; cuando el transporte es de terceros, `dispatch_notes.carrier_name`/`carrier_tax_id` (Sprint 16) ya alcanza y no requiere un `vehicle_id`.
- `routes`: una ruta de reparto (fecha, vehículo propio opcional, conductor).
- `route_stops`: orden de paradas — cada una referencia una `dispatch_notes`.

## Cambios de esquema (sketch SQL)

```sql
CREATE TABLE IF NOT EXISTS public.vehicles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) NOT NULL,
    plate text NOT NULL,
    vehicle_type text,
    capacity_kg numeric(20,2),
    capacity_m3 numeric(20,2),
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TYPE public.route_status AS ENUM ('planificada', 'en_curso', 'finalizada', 'cancelada');

CREATE TABLE IF NOT EXISTS public.routes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) NOT NULL,
    route_date date NOT NULL,
    vehicle_id uuid REFERENCES public.vehicles(id),
    driver_name text,
    status public.route_status NOT NULL DEFAULT 'planificada',
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.route_stops (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id uuid REFERENCES public.routes(id) ON DELETE CASCADE NOT NULL,
    dispatch_note_id uuid REFERENCES public.dispatch_notes(id) NOT NULL,
    stop_order integer NOT NULL,
    UNIQUE (route_id, dispatch_note_id)
);
```

## Criterios de aceptación

- [x] Se puede registrar un vehículo propio con capacidad.
- [x] Se puede crear una ruta para una fecha, asignarle vehículo/conductor, y ordenar dentro de ella un conjunto de guías de despacho existentes.
- [x] Cambiar el estado de la ruta (planificada → en curso → finalizada) no modifica el estado de las guías individuales — son cosas independientes.

---

## Prompt listo para pegar en Lovable

```
Voy a agregar planificación de rutas de reparto que agrupan guías de despacho existentes (Sprint 16), con flota propia opcional.

1. Crea vehicles (entity_id, plate, vehicle_type, capacity_kg, capacity_m3, active default true, created_at).

2. Crea el enum route_status ('planificada','en_curso','finalizada','cancelada').

3. Crea routes (entity_id, route_date date NOT NULL, vehicle_id FK nullable, driver_name, status default 'planificada', created_at).

4. Crea route_stops (route_id FK on delete cascade, dispatch_note_id FK a dispatch_notes NOT NULL, stop_order integer, único por route_id+dispatch_note_id).

5. Pantalla nueva "Rutas": lista de rutas por fecha con su estado; al crear/editar una ruta, selector de vehículo y conductor, y un panel para agregar guías existentes (que no estén ya en otra ruta activa) ordenándolas por drag-and-drop o por un campo numérico simple de orden.

Aplica RLS multiempresa normal a las tres tablas. Documenta en .md/CHANGELOG.md y actualiza .md/ARQUITECTURA.md y .md/MODULOS.md.
```
