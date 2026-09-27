# Sprint 16 — Modelo de Datos 3PL y Guía de Despacho (Res. 154)

**Fase:** 3 — Vertical 3PL / Cumplimiento
**Depende de:** Sprint 1 (multiempresa/RLS), Sprint 5 (`stock_ledger_entries`, que este sprint extiende — no se crea un motor de inventario paralelo)
**Bloquea a:** Sprint 17 (SICEX), Sprint 19-20 (WMS — necesitan `party_id` en `stock_ledger_entries` para segregar por cliente)

## Objetivo

Permitir que una misma bodega aloje inventario de terceros (clientes 3PL) segregado por cliente, y crear la guía de despacho con todos los campos que exige la Resolución Exenta N°154 del SII, vigente desde el 1 de noviembre de 2026.

## Por qué (brecha que resuelve)

Hoy `parties` es solo el directorio de clientes/proveedores de la empresa, y `stock_ledger_entries` (Sprint 5) no distingue de quién es la mercadería — todo el stock de una bodega pertenece implícitamente a la empresa. Para operar como 3PL (bodegar y despachar mercadería de terceros, cobrando por el servicio) hace falta que un mismo `warehouse_id` pueda contener stock de varios `party_id` sin que se mezcle. Tampoco existe ninguna tabla de guía de despacho — es un documento nuevo para el proyecto.

## ⚠️ Dependencia crítica: sigue siendo la misma del Sprint 6 (Facturación Electrónica / DTE)

Este sprint construye la **mecánica interna**: segregación de inventario por cliente y una tabla de guía de despacho con todos los campos de la Res. 154. Pero la **validez tributaria real** ante el SII exige emitir la guía como DTE, con folio autorizado por CAF y firma electrónica, y que quede en el nuevo Registro de Guías de Despacho del SII.

Revisé los 15 sprints existentes: esa decisión (sección 3.6 del `RoadMap.md` — comprar un emisor DTE certificado como OpenFactura/Haulmer, Bsale, Nubox, Defontana, vs. construir el flujo de certificación propio) **sigue sin resolverse**. `sales_invoices.invoice_number` (Sprint 6) y ahora `dispatch_number` (este sprint) son ambos solo un campo de texto — un gancho, no un folio real.

Dado el plazo del 1 de noviembre, esta es, con franqueza, la decisión más urgente del proyecto ahora mismo — más que cualquier sprint. Sin un emisor DTE conectado, ninguna guía de despacho que construyamos aquí es legalmente válida el día 1, sin importar cuántos campos de la Res. 154 tenga la tabla.

## Alcance incluido

- `parties.is_3pl_client`: marca qué terceros son clientes 3PL (reutiliza el mismo directorio — el mismo `party_id` sirve después para facturarle el servicio de bodegaje en el Sprint 26, sin duplicar el concepto de "cliente").
- `party_warehouses`: en qué bodega(s) de la empresa tiene mercadería cada cliente 3PL.
- `stock_ledger_entries.party_id` (nullable): `null` = inventario propio de la empresa, no nulo = inventario en custodia de ese cliente. Redefine `stock_balances` para que segregue también por `party_id`.
- `dispatch_notes` / `dispatch_note_lines`: la guía de despacho, con los campos obligatorios de la Res. 154 (dirección exacta de origen/destino, nombre y RUT del transportista, patente, tipo de traslado, hora exacta de inicio y llegada, y por línea: cantidad, unidad, peso, volumen, valor unitario).

## Fuera de alcance

- Emisión real de DTE / folio CAF / firma electrónica / envío al Registro de Guías de Despacho del SII — misma dependencia crítica del Sprint 6, sigue sin resolver.
- Portal cliente con login para que el 3PL cliente vea su propio stock (Sprint 24) — el modelo de datos queda listo, RLS por `party_id` se activa recién ahí.
- WMS operativo: picking, packing, recepción (Sprint 19-20).
- SICEX / comercio exterior (Sprint 17).

## Cambios de esquema (sketch SQL)

```sql
-- 1. Reutiliza 'parties' — no se crea un directorio de clientes paralelo
ALTER TABLE public.parties ADD COLUMN IF NOT EXISTS is_3pl_client boolean DEFAULT false;

-- 2. En qué bodega(s) de la empresa opera cada cliente 3PL
CREATE TABLE IF NOT EXISTS public.party_warehouses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id uuid REFERENCES public.parties(id) ON DELETE CASCADE NOT NULL,
    warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (party_id, warehouse_id)
);

-- 3. Segregación del inventario existente (Sprint 5) por cliente
ALTER TABLE public.stock_ledger_entries ADD COLUMN IF NOT EXISTS party_id uuid REFERENCES public.parties(id);
-- null = inventario propio de la empresa; no nulo = mercadería en custodia de ese cliente 3PL

CREATE OR REPLACE VIEW public.stock_balances AS
SELECT item_id, warehouse_id, party_id,
       SUM(qty_change) AS qty_on_hand,
       SUM(qty_change * valuation_rate) AS value_on_hand
FROM public.stock_ledger_entries
GROUP BY item_id, warehouse_id, party_id;

-- 4. Guía de despacho (tabla nueva)
CREATE TYPE public.dispatch_transfer_type AS ENUM ('venta', 'traslado_interno', 'consignacion', 'exportacion', 'otro');
CREATE TYPE public.dispatch_status AS ENUM ('draft', 'issued', 'cancelled');

CREATE TABLE IF NOT EXISTS public.dispatch_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) NOT NULL,
    party_id uuid REFERENCES public.parties(id) NOT NULL,        -- cliente 3PL dueño de la carga
    warehouse_id uuid REFERENCES public.warehouses(id) NOT NULL,
    dispatch_number text,                                         -- gancho para folio DTE real — ver dependencia crítica
    transfer_type public.dispatch_transfer_type NOT NULL,
    origin_address text NOT NULL,
    destination_address text NOT NULL,
    carrier_name text NOT NULL,
    carrier_tax_id text NOT NULL,
    vehicle_plate text NOT NULL,
    departure_at timestamptz NOT NULL,
    arrival_at timestamptz,
    status public.dispatch_status NOT NULL DEFAULT 'draft',
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.dispatch_note_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_note_id uuid REFERENCES public.dispatch_notes(id) ON DELETE CASCADE NOT NULL,
    item_id uuid REFERENCES public.items(id) NOT NULL,
    qty numeric(20,4) NOT NULL,
    uom text,
    weight_kg numeric(20,4),
    volume_m3 numeric(20,4),
    unit_value numeric(20,4)
);
```

## Cambios de UI/backend esperados

- `setup.tsx` o `parties.tsx`: checkbox "Cliente 3PL" al editar un tercero, con selector de bodega(s) asignada(s) (`party_warehouses`).
- Pantalla nueva "Guías de Despacho": alta con selector de cliente 3PL, bodega, transportista/patente, tipo de traslado, líneas de ítems — guarda en estado `draft`.
- `stock_balances` / reporte "Saldo por Bodega" (Sprint 5): agregar columna/filtro por cliente, para no mostrar el inventario de todos los clientes mezclado en una sola cifra.

## Criterios de aceptación

- [ ] Un tercero existente se puede marcar como cliente 3PL y asociar a una o más bodegas.
- [ ] Un movimiento de `stock_ledger_entries` con `party_id` no se mezcla con el de otro cliente ni con el inventario propio de la empresa en `stock_balances`.
- [ ] Se puede crear una guía de despacho con todos los campos exigidos por la Res. 154.
- [ ] La guía queda en `draft` — no se marca `issued` hasta resolver la integración DTE real (fuera de este sprint).

---

## Prompt listo para pegar en Lovable

```
Voy a agregar soporte para operar como 3PL (bodegar y despachar mercadería de clientes) sobre lo que ya existe — reutilizando `parties` y `stock_ledger_entries`, no tablas paralelas.

1. Agrega la columna `is_3pl_client boolean default false` a `parties`.

2. Crea `party_warehouses` (id, party_id FK a parties on delete cascade, warehouse_id FK a warehouses on delete cascade, created_at, único por party_id+warehouse_id) — en qué bodega(s) tiene mercadería cada cliente 3PL.

3. Agrega `party_id uuid references public.parties(id)` (nullable) a `stock_ledger_entries` — null significa inventario propio de la empresa, no nulo significa mercadería en custodia de ese cliente.

4. Redefine la vista `stock_balances` (CREATE OR REPLACE) agregando `party_id` tanto al SELECT como al GROUP BY, junto a item_id y warehouse_id.

5. Crea los enums `dispatch_transfer_type` ('venta','traslado_interno','consignacion','exportacion','otro') y `dispatch_status` ('draft','issued','cancelled').

6. Crea `dispatch_notes` (entity_id, party_id NOT NULL, warehouse_id NOT NULL, dispatch_number text, transfer_type, origin_address NOT NULL, destination_address NOT NULL, carrier_name NOT NULL, carrier_tax_id NOT NULL, vehicle_plate NOT NULL, departure_at timestamptz NOT NULL, arrival_at timestamptz, status default 'draft', created_at).

7. Crea `dispatch_note_lines` (dispatch_note_id FK on delete cascade, item_id NOT NULL, qty NOT NULL, uom, weight_kg, volume_m3, unit_value).

8. En la edición de un tercero (parties.tsx o setup.tsx, según donde vivan hoy), agrega un checkbox "Cliente 3PL" que al activarse muestra un selector multi-bodega que escribe en party_warehouses.

9. Crea una pantalla nueva "Guías de Despacho": formulario con selector de cliente 3PL (solo parties con is_3pl_client=true), bodega (filtrada a las de party_warehouses para ese cliente), transportista, RUT transportista, patente, tipo de traslado, dirección origen/destino, hora de salida/llegada, y líneas de ítems (ítem, cantidad, unidad, peso, volumen, valor unitario). Guarda en estado 'draft' — no incluyas todavía ningún botón de "emitir" o "enviar al SII", eso depende de resolver primero la integración DTE (misma pendiente del Sprint 6).

10. En el reporte "Saldo por Bodega" que ya existe (Sprint 5), agrega un filtro/columna por cliente 3PL para que el saldo de cada cliente se vea separado del propio de la empresa y del de otros clientes.

Aplica RLS multiempresa normal (patrón `user_has_company_access`, mismo que el resto de tablas) a party_warehouses, dispatch_notes y dispatch_note_lines. Al terminar, documenta en `.md/CHANGELOG.md` y actualiza `.md/ARQUITECTURA.md` y `.md/MODULOS.md`.
```
