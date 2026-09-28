# Sprint 27 — BI/KPIs Operacionales

**Fase:** 4 — Vertical 3PL / Inteligencia
**Depende de:** Sprint 16, 19, 20, 21 (lee datos de todos los anteriores, no agrega tablas transaccionales nuevas)
**Bloquea a:** ninguno directo

## Objetivo

Dashboard operacional 3PL: OTIF, alertas de SLA, costo por unidad procesada y ocupación de bodega — todo de lectura, sin nuevas tablas de negocio.

## Cómo se calcula cada indicador (y sus simplificaciones)

- **OTIF** (On-Time In-Full): % de guías con `arrival_at` registrado dentro de las 24h de su `departure_at` planeada Y con todas sus líneas `packed=true` antes de esa salida. Es una aproximación razonable con los datos que ya existen — no hay un "compromiso de fecha" explícito separado de `departure_at` todavía; si más adelante se necesita, se agrega un campo `promised_at`.
- **Alertas de SLA**: guías en `draft` con más de N días desde su creación sin picking completo (N configurable, default 2 días).
- **Costo por unidad procesada**: requiere un costo operativo — hoy no existe ningún campo de costo de bodega en el sistema. Este sprint deja un input manual simple (costo operativo mensual total, ingresado a mano) dividido por unidades pickeadas en el mes — una aproximación, no un costeo por actividad real.
- **Ocupación de bodega**: `warehouses` no tiene capacidad definida — se agrega `capacity_m3` opcional; sin ese dato la bodega simplemente no muestra % de ocupación (evita inventar un número).

## Cambios de esquema (sketch SQL)

```sql
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS capacity_m3 numeric(20,2);

CREATE TABLE IF NOT EXISTS public.operational_cost_inputs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    total_cost numeric(20,2) NOT NULL,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL
);
```

## Criterios de aceptación

- [x] El dashboard muestra OTIF general y por cliente para un rango de fechas.
- [x] Muestra una lista de guías en alerta de SLA (draft hace más de N días).
- [x] Si se ingresa `capacity_m3` en al menos una bodega, muestra su % de ocupación; si no, lo omite sin romper la pantalla.
- [x] El costo por unidad es opcional y solo aparece si se cargó un `operational_cost_inputs` para el período consultado.

---

## Prompt listo para pegar en Lovable

```
Voy a agregar un dashboard de KPIs operacionales 3PL, de solo lectura sobre datos que ya existen.

1. Agrega capacity_m3 numeric(20,2) a warehouses (nullable).

2. Crea operational_cost_inputs (entity_id, period_start date, period_end date, total_cost numeric(20,2) NOT NULL, notes, created_at) — carga manual de costo operativo total de un período, para el cálculo de costo por unidad.

3. Crea una página nueva "Dashboard 3PL" (ruta dashboard-3pl.tsx, siguiendo el patrón visual de reports.tsx que ya existe) con:
   - Selector de rango de fechas.
   - OTIF general y por cliente: % de dispatch_notes cuyo arrival_at quedó dentro de 24h de departure_at Y todas sus dispatch_note_lines tienen packed=true.
   - Lista de "Guías en alerta": status='draft' con created_at hace más de 2 días (configurable con un input numérico en la pantalla) y no todas sus líneas picked=true.
   - Ocupación de bodega: para cada warehouse con capacity_m3 no nulo, suma qty_on_hand (o mejor, si hay un campo de volumen por ítem úsalo; si no, omite esta métrica y dilo con un mensaje en vez de inventar un número) contra su capacidad, como %. Bodegas sin capacity_m3 cargado simplemente no muestran este dato.
   - Costo por unidad: si existe un operational_cost_inputs que cubre el rango de fechas elegido, divide su total_cost por la suma de qty de dispatch_note_lines con picked=true en ese rango; si no existe ningún registro para ese rango, muestra un botón para cargarlo en vez de un número inventado.

Aplica RLS multiempresa normal a operational_cost_inputs. Documenta en .md/CHANGELOG.md y actualiza .md/ARQUITECTURA.md y .md/MODULOS.md.
```
