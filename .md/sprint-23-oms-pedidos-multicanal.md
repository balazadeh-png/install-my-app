# Sprint 23 — OMS: Pedidos Multicanal

**Fase:** 2 — Vertical 3PL / Operación
**Depende de:** Sprint 16, Sprint 20 (picking genera la salida real)
**Bloquea a:** ninguno directo — cierra la Fase 2

## Objetivo

Recibir pedidos de los canales de venta de cada cliente 3PL (su propio e-commerce) y convertirlos en una guía de despacho lista para picking, sin que el 3PL tenga que digitarlos a mano.

## ⚠️ Dependencia externa: cada canal es una integración distinta

Shopify, VTEX y Mercado Libre no comparten formato ni autenticación — conectar cada uno requiere las credenciales de API *del cliente 3PL*, no las tuyas. Este sprint deja un **receptor genérico de webhooks** (cualquier canal que pueda mandar un POST con esta forma ya funciona) y dos formas manuales de carga (formulario y CSV) para no depender de que el primer cliente ya tenga su integración lista.

## Alcance incluido

- `sales_orders` / `sales_order_lines`: pedido entrante, con `channel` (texto libre: 'shopify', 'vtex', 'manual', 'csv', etc.) y `external_order_id` para evitar duplicados.
- Endpoint público (`createServerFn` sin auth de usuario, protegido por un token simple por cliente) que recibe el webhook y crea el pedido.
- Acción "Convertir a guía de despacho": toma un `sales_order` en estado `pendiente` y crea automáticamente una `dispatch_notes` + `dispatch_note_lines` (Sprint 16) con el mismo cliente y bodega asignada, dejando el pedido en `procesado`.

## Cambios de esquema (sketch SQL)

```sql
CREATE TYPE public.order_status AS ENUM ('pendiente', 'procesado', 'cancelado');

CREATE TABLE IF NOT EXISTS public.sales_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) NOT NULL,
    party_id uuid REFERENCES public.parties(id) NOT NULL,
    channel text NOT NULL,
    external_order_id text,
    destination_address text,
    status public.order_status NOT NULL DEFAULT 'pendiente',
    dispatch_note_id uuid REFERENCES public.dispatch_notes(id),
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (party_id, channel, external_order_id)
);

CREATE TABLE IF NOT EXISTS public.sales_order_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_order_id uuid REFERENCES public.sales_orders(id) ON DELETE CASCADE NOT NULL,
    item_id uuid REFERENCES public.items(id),
    external_sku text,
    qty numeric(20,4) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.party_webhook_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id uuid REFERENCES public.parties(id) ON DELETE CASCADE NOT NULL,
    token text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now() NOT NULL
);
```

## Criterios de aceptación

- [x] Se puede generar un token por cliente 3PL y recibir un pedido vía POST a un endpoint público autenticado con ese token.
- [x] Se puede cargar un pedido a mano (formulario) o por CSV, para clientes sin integración todavía.
- [x] "Convertir a guía de despacho" genera correctamente la `dispatch_notes`/`dispatch_note_lines` con los datos del pedido y lo marca `procesado`.
- [x] Un `external_order_id` repetido para el mismo cliente y canal no crea un pedido duplicado.

---

## Prompt listo para pegar en Lovable

```
Voy a agregar recepción de pedidos multicanal para clientes 3PL, con un receptor genérico de webhooks (no una integración específica de ninguna plataforma) más carga manual/CSV.

1. Crea el enum order_status ('pendiente','procesado','cancelado').

2. Crea sales_orders (entity_id, party_id NOT NULL, channel text NOT NULL, external_order_id text, destination_address text, status default 'pendiente', dispatch_note_id FK nullable a dispatch_notes, created_at, único por party_id+channel+external_order_id).

3. Crea sales_order_lines (sales_order_id FK on delete cascade, item_id FK nullable a items, external_sku text, qty NOT NULL).

4. Crea party_webhook_tokens (party_id FK on delete cascade, token text unique NOT NULL, created_at).

5. Crea un createServerFn tipo webhook (sin requireSupabaseAuth, ya que lo llama un sistema externo) que recibe { token, external_order_id, destination_address, lines: [{external_sku, qty}] }, busca el party_id por el token en party_webhook_tokens, hace upsert del pedido y sus líneas. Documenta la URL resultante y el formato esperado en un comentario en el archivo.

6. En dispatch.tsx (o una pantalla nueva "Pedidos"), agrega: lista de sales_orders con su estado, formulario de carga manual, importador simple de CSV (columnas: external_order_id, destination_address, sku, qty), y un botón "Convertir a guía de despacho" que crea la dispatch_notes/dispatch_note_lines correspondiente y marca el pedido 'procesado'.

7. En Clientes 3PL (pestaña existente), agrega un botón "Generar token de integración" que crea una fila en party_webhook_tokens y muestra el token una sola vez.

Aplica RLS multiempresa normal a sales_orders, sales_order_lines y party_webhook_tokens — excepto el server function del webhook, que valida por token en vez de sesión de usuario. Documenta en .md/CHANGELOG.md y actualiza .md/ARQUITECTURA.md y .md/MODULOS.md.
```
