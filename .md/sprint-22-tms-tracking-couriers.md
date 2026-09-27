# Sprint 22 — TMS: Tracking y Couriers Externos

**Fase:** 2 — Vertical 3PL / Operación
**Depende de:** Sprint 21 (`routes`, `route_stops`)
**Bloquea a:** ninguno directo

## Objetivo

Registrar el avance de una ruta (estados de entrega por parada) y dejar el gancho para conectar couriers externos (Blue Express, Chilexpress, 99minutos, etc.) cuando se decida cuáles integrar.

## ⚠️ Dos decisiones externas, no solo una

1. **GPS en tiempo real**: requiere una app móvil para el conductor o un dispositivo GPS en el vehículo — no es solo una tabla. Este sprint deja un MVP más simple: el conductor actualiza el estado de cada parada desde el navegador de su teléfono (sin app nativa), capturando la geolocalización del navegador en ese momento como aproximación — no es tracking continuo, es un punto en el tiempo por evento.
2. **Couriers externos**: cada courier tiene su propia API y credenciales — Blue Express, Chilexpress y 99minutos no comparten formato. Este sprint deja el modelo genérico (`courier_name`, `courier_tracking_number`, `courier_status`) sin conectar ninguna API real todavía; se conecta courier por courier cuando se decida cuáles usar.

## Alcance incluido

- `route_stops`: agregar estado de entrega (enum), hora real de llegada, geolocalización capturada (lat/lng, nullable), firma o nombre de quien recibió (texto).
- `dispatch_notes`: agregar campos opcionales de courier externo (`courier_name`, `courier_tracking_number`, `courier_status`) para cuando el transporte no es flota propia.
- Vista simple de tracking (para uso interno, no portal de cliente todavía — eso es Sprint 24): estado de cada parada de una ruta en curso.

## Cambios de esquema (sketch SQL)

```sql
CREATE TYPE public.stop_delivery_status AS ENUM ('pendiente', 'en_ruta', 'entregado', 'no_entregado');

ALTER TABLE public.route_stops ADD COLUMN IF NOT EXISTS delivery_status public.stop_delivery_status NOT NULL DEFAULT 'pendiente';
ALTER TABLE public.route_stops ADD COLUMN IF NOT EXISTS arrived_at timestamptz;
ALTER TABLE public.route_stops ADD COLUMN IF NOT EXISTS lat numeric(9,6);
ALTER TABLE public.route_stops ADD COLUMN IF NOT EXISTS lng numeric(9,6);
ALTER TABLE public.route_stops ADD COLUMN IF NOT EXISTS received_by text;

ALTER TABLE public.dispatch_notes ADD COLUMN IF NOT EXISTS courier_name text;
ALTER TABLE public.dispatch_notes ADD COLUMN IF NOT EXISTS courier_tracking_number text;
ALTER TABLE public.dispatch_notes ADD COLUMN IF NOT EXISTS courier_status text;
```

## Criterios de aceptación

- [ ] Desde el detalle de una ruta en curso, se puede marcar cada parada como entregada/no entregada, capturando hora y (si el navegador lo permite) geolocalización.
- [ ] Una guía transportada por courier externo puede guardar su número de seguimiento y estado, sin necesidad de tener una ruta/vehículo propio asociado.
- [ ] Nada de esto llama a ninguna API externa real todavía.

---

## Prompt listo para pegar en Lovable

```
Voy a agregar seguimiento de entregas por parada y el gancho para couriers externos, sin conectar ninguna API real todavía.

1. Crea el enum stop_delivery_status ('pendiente','en_ruta','entregado','no_entregado').

2. Agrega a route_stops: delivery_status default 'pendiente', arrived_at timestamptz, lat numeric(9,6), lng numeric(9,6), received_by text.

3. Agrega a dispatch_notes: courier_name text, courier_tracking_number text, courier_status text (todos nullable, para cuando el transporte no es flota propia).

4. En la pantalla de detalle de una ruta (Sprint 21), agrega por cada parada un botón "Marcar entregado" / "No entregado" que pide nombre de quien recibió, y captura navigator.geolocation.getCurrentPosition si el usuario lo permite (con manejo de error si lo rechaza — no bloquear el flujo si no hay permiso de ubicación).

5. En el formulario de nueva guía (dispatch.tsx), si el tipo de transporte no usa flota propia, muestra campos opcionales de courier (nombre, número de seguimiento).

Documenta en .md/CHANGELOG.md y actualiza .md/ARQUITECTURA.md y .md/MODULOS.md.
```
