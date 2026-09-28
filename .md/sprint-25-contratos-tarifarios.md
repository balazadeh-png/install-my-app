# Sprint 25 — Contratos y Tarifarios

**Fase:** 3 — Vertical 3PL / Comercial
**Depende de:** Sprint 16
**Bloquea a:** Sprint 26 (factura de servicios lee estos tarifarios)

## Objetivo

Definir cuánto se le cobra a cada cliente 3PL por almacenaje, picking y transporte, para que el Sprint 26 pueda facturar automáticamente en vez de a mano.

## Alcance incluido

- `service_contracts`: un contrato activo por cliente (frecuencia de facturación).
- `service_rate_lines`: las tarifas del contrato — por pallet/m² almacenado, por unidad pickeada, por km recorrido, o un recargo fijo (combustible, feriado).
- `dispatch_notes.distance_km`: campo manual para poder tarifar transporte por km (hoy no existe ningún cálculo de distancia real en el sistema — se ingresa a mano al cerrar la guía).
- Pantalla "Contratos" dentro de Clientes 3PL: alta de tarifas por cliente.

## Cambios de esquema (sketch SQL)

```sql
CREATE TYPE public.billing_frequency AS ENUM ('mensual', 'quincenal');
CREATE TYPE public.service_rate_type AS ENUM ('storage_pallet', 'storage_m2', 'picking_unit', 'transport_km', 'recargo_fijo');

CREATE TABLE IF NOT EXISTS public.service_contracts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) NOT NULL,
    party_id uuid REFERENCES public.parties(id) NOT NULL,
    billing_frequency public.billing_frequency NOT NULL DEFAULT 'mensual',
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.service_rate_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id uuid REFERENCES public.service_contracts(id) ON DELETE CASCADE NOT NULL,
    rate_type public.service_rate_type NOT NULL,
    unit_price numeric(20,4) NOT NULL,
    description text,
    created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.dispatch_notes ADD COLUMN IF NOT EXISTS distance_km numeric(10,2);
```

## Criterios de aceptación

- [x] Se puede crear un contrato activo por cliente 3PL con su frecuencia de facturación.
- [x] Se pueden agregar múltiples líneas de tarifa al contrato (ej. almacenaje por pallet + picking por unidad).
- [x] Al cerrar una guía de despacho, se puede ingresar la distancia recorrida.

---

## Prompt listo para pegar en Lovable

```
Voy a agregar contratos y tarifarios por cliente 3PL, base para facturar servicios en el siguiente sprint.

1. Crea los enums billing_frequency ('mensual','quincenal') y service_rate_type ('storage_pallet','storage_m2','picking_unit','transport_km','recargo_fijo').

2. Crea service_contracts (entity_id, party_id NOT NULL, billing_frequency default 'mensual', active default true, created_at).

3. Crea service_rate_lines (contract_id FK on delete cascade, rate_type NOT NULL, unit_price numeric(20,4) NOT NULL, description, created_at).

4. Agrega distance_km numeric(10,2) a dispatch_notes (nullable) y muéstralo como campo opcional en el formulario de nueva guía (dispatch.tsx).

5. Agrega una sección "Contrato" dentro de la pestaña Clientes 3PL: al seleccionar un cliente marcado como 3PL, muestra (o permite crear) su contrato activo, y una tabla editable de líneas de tarifa (tipo, precio unitario, descripción).

Aplica RLS multiempresa normal a service_contracts y service_rate_lines. Documenta en .md/CHANGELOG.md y actualiza .md/ARQUITECTURA.md y .md/MODULOS.md.
```
