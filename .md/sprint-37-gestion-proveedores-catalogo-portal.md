# Sprint 37 — Gestión de Proveedores, Catálogo y Portal

**Fase:** EasyERP core / Operaciones
**Depende de:** Sprint 6 (`parties` clasificación 'supplier'), Sprint 29 (`party_portal_users`/`user_has_party_access`, ya endurecido)
**Bloquea a:** Sprint 38 (la Orden de Compra selecciona ítems desde este catálogo)

> ⚠️ **Nota de numeración:** pedías Sprint 32, pero el repo ya tiene un Sprint 32 (gestión de usuarios y roles) y llega hasta el 36 (`search_pending_invoices`, 2 oct). Este queda como **Sprint 37**, y la Orden de Compra como **38**, para no chocar con lo que ya está corrido.

## Objetivo

Que cada proveedor (`parties` con `classification = 'supplier'`) tenga su propio catálogo de productos/servicios, cargable a mano o por Excel, visible y editable por el proveedor mismo desde un portal — reutilizando el acceso de portal que ya existe (Sprint 24/29), no uno nuevo. Y que, si el proveedor requiere contrato, el PDF quede guardado con historial de versiones.

## Decisión de diseño: catálogo separado, no el `items` interno

El catálogo de un proveedor no es el mismo catálogo que usas para tu propio inventario (`items`, Sprint 5): dos proveedores pueden ofrecer el mismo producto con SKU y precio distintos, y no todo lo que un proveedor ofrece se vuelve necesariamente un ítem que vas a stockear. Por eso `supplier_catalog_items` es una tabla propia, con un campo opcional `linked_item_id` para cuando sí corresponde mapearlo a tu ítem interno (útil para el Sprint 38 y cualquier futuro match de inventario).

## Decisión de diseño: portal reutilizado, no uno nuevo

El mecanismo de portal (`party_portal_users`, `user_has_party_access`, ruta `_portal/`) ya existe para clientes 3PL y ya quedó endurecido en el Sprint 29 — no le es exclusivo. Un proveedor es, en el mismo sentido, un tercero externo que solo debe ver lo suyo. La diferencia real frente al portal 3PL: ahí el cliente solo leía; aquí el proveedor **escribe** su propio catálogo, así que las políticas de `supplier_catalog_items` para portal son de lectura y escritura, no solo lectura.

## Alcance incluido

- `parties.requires_contract`: sí/no, por proveedor.
- `supplier_catalog_items`: catálogo por proveedor (SKU del proveedor, nombre, descripción, tipo producto/servicio, precio, moneda, unidad de medida, `linked_item_id` opcional).
- Carga manual (formulario) y carga masiva por Excel (mismo patrón de lectura de archivo ya usado en `cash.tsx`), con reporte de filas aceptadas/rechazadas antes de confirmar — nunca una carga silenciosa.
- `supplier_contracts`: historial de versiones del contrato (PDF), con quién lo subió y notas (ej. "Anexo renovación 2027").
- Bucket de Storage `supplier-contracts` (privado), con la ruta `{entity_id}/{party_id}/{archivo}` como convención — es el primer uso de Storage en el proyecto, así que las políticas quedan documentadas explícitamente en vez de asumir un patrón existente.
- Portal: el proveedor ve y edita su propio catálogo (alta, edición, no borrado — un ítem se desactiva, no se elimina, para no romper órdenes de compra ya emitidas con ese ítem), y ve (no edita) sus contratos y versiones.
- Registra el módulo como `'suppliers'` en `company_modules` (Sprint 33), siguiendo el patrón ya establecido para que se pueda activar/desactivar por empresa.

## Fuera de alcance

- Flujo de aprobación de cambios del proveedor (hoy lo que edita el proveedor queda vigente de inmediato — si se necesita revisión antes de publicar, es un sprint aparte).
- Borrado de ítems del catálogo (se desactivan).

## Cambios de esquema (sketch SQL)

```sql
ALTER TABLE public.parties ADD COLUMN IF NOT EXISTS requires_contract boolean DEFAULT false;

DO $$ BEGIN
  CREATE TYPE public.catalog_item_type AS ENUM ('producto', 'servicio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.supplier_catalog_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    party_id uuid REFERENCES public.parties(id) ON DELETE CASCADE NOT NULL,
    supplier_sku text NOT NULL,
    name text NOT NULL,
    description text,
    item_type public.catalog_item_type NOT NULL DEFAULT 'producto',
    unit_price numeric(20,4) NOT NULL DEFAULT 0,
    currency_code text REFERENCES public.currencies(code) NOT NULL DEFAULT 'CLP',
    uom text,
    linked_item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (party_id, supplier_sku)
);

CREATE TABLE IF NOT EXISTS public.supplier_contracts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    party_id uuid REFERENCES public.parties(id) ON DELETE CASCADE NOT NULL,
    version_number integer NOT NULL,
    file_path text NOT NULL,
    file_name text NOT NULL,
    notes text,
    is_current boolean DEFAULT true NOT NULL,
    uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (party_id, version_number)
);

-- Bucket privado (primer uso de Storage en el proyecto)
INSERT INTO storage.buckets (id, name, public)
VALUES ('supplier-contracts', 'supplier-contracts', false)
ON CONFLICT (id) DO NOTHING;

-- Staff interno: lectura/escritura por empresa, solo admin/purchasing
DROP POLICY IF EXISTS "staff_read_supplier_contracts" ON storage.objects;
CREATE POLICY "staff_read_supplier_contracts" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'supplier-contracts'
       AND public.user_has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid));

DROP POLICY IF EXISTS "staff_write_supplier_contracts" ON storage.objects;
CREATE POLICY "staff_write_supplier_contracts" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'supplier-contracts'
            AND public.user_has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
            AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'purchasing')));

-- Portal proveedor: solo puede LEER su propio contrato (no sube el PDF, eso lo gestiona el staff)
DROP POLICY IF EXISTS "portal_read_own_contract" ON storage.objects;
CREATE POLICY "portal_read_own_contract" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'supplier-contracts'
       AND public.user_has_party_access(((storage.foldername(name))[2])::uuid));

-- RLS de las tablas nuevas: staff normal + portal con escritura en el catálogo, solo lectura en contratos
DROP POLICY IF EXISTS "portal_manage_own_catalog" ON public.supplier_catalog_items;
CREATE POLICY "portal_manage_own_catalog" ON public.supplier_catalog_items FOR ALL TO authenticated
USING (public.user_has_party_access(party_id))
WITH CHECK (public.user_has_party_access(party_id));

DROP POLICY IF EXISTS "portal_read_own_contracts" ON public.supplier_contracts;
CREATE POLICY "portal_read_own_contracts" ON public.supplier_contracts FOR SELECT TO authenticated
USING (public.user_has_party_access(party_id));
```

## Criterios de aceptación

- [ ] Un proveedor marcado `requires_contract = true` sin ningún PDF cargado se ve señalado como pendiente en la lista de proveedores.
- [ ] Subir una nueva versión de contrato no borra la anterior; `is_current` solo es `true` en la última.
- [ ] Carga por Excel: un archivo con filas inválidas (SKU repetido, precio negativo) muestra cuáles filas fallan antes de confirmar nada — no hace un upsert parcial silencioso.
- [ ] Un usuario de portal del proveedor A puede crear/editar ítems de su propio catálogo, y **no puede** ver ni editar el catálogo del proveedor B (probar con dos sesiones, igual que en el Sprint 29).
- [ ] Un usuario de portal puede ver sus contratos pero no puede subir uno nuevo ni modificar `is_current`.
- [ ] El bucket `supplier-contracts` no es público — un PDF no es accesible sin sesión autenticada y permiso.

---

## Prompt listo para pegar en Lovable

```
Voy a agregar gestión de proveedores con catálogo y portal, reutilizando el mecanismo de portal (party_portal_users / user_has_party_access) que ya existe de los Sprints 24 y 29 — no crees un sistema de acceso nuevo.

1. Agrega requires_contract boolean default false a parties.

2. Crea el enum catalog_item_type ('producto','servicio') dentro de un bloque DO con EXCEPTION WHEN duplicate_object.

3. Crea supplier_catalog_items (entity_id, party_id FK a parties on delete cascade NOT NULL, supplier_sku NOT NULL, name NOT NULL, description, item_type default 'producto', unit_price numeric(20,4) default 0, currency_code FK a currencies default 'CLP', uom, linked_item_id FK nullable a items on delete set null, active default true, created_at, updated_at, único por party_id+supplier_sku).

4. Crea supplier_contracts (entity_id, party_id FK a parties on delete cascade NOT NULL, version_number integer NOT NULL, file_path text NOT NULL, file_name text NOT NULL, notes, is_current default true, uploaded_by FK a auth.users, created_at, único por party_id+version_number).

5. Crea el bucket privado 'supplier-contracts' (INSERT en storage.buckets con public=false, ON CONFLICT DO NOTHING). Agrega políticas en storage.objects: lectura y escritura para staff interno (admin o purchasing) con user_has_company_access sobre el primer segmento de la ruta como entity_id; lectura para el proveedor del portal con user_has_party_access sobre el segundo segmento de la ruta como party_id. La convención de ruta es {entity_id}/{party_id}/{archivo}.

6. Aplica RLS a ambas tablas: para staff interno el patrón multiempresa normal (user_has_company_access); para portal, en supplier_catalog_items una política FOR ALL con user_has_party_access(party_id) en USING y WITH CHECK (el proveedor puede leer, crear y editar su propio catálogo); en supplier_contracts una política FOR SELECT únicamente con user_has_party_access(party_id) (el proveedor solo lee, no sube contratos).

7. En purchases.tsx, dentro de la pestaña "suppliers" que ya existe, agrega: un toggle "Requiere contrato" por proveedor; si está activo, un listado de versiones de contrato con botón "Subir nueva versión" (sube a supplier-contracts con la ruta {entity_id}/{party_id}/{timestamp}-{nombre archivo}, inserta la fila en supplier_contracts con el siguiente version_number y marca is_current=true, bajando el is_current de la anterior); y una sección de catálogo del proveedor con tabla editable, botón de alta manual, y un botón "Cargar Excel" que lee un archivo con columnas supplier_sku, name, description, item_type, unit_price, uom (usa el mismo patrón de lectura de Excel que ya existe en cash.tsx), valida cada fila (SKU no vacío, precio >= 0, item_type válido), muestra un resumen de filas válidas/inválidas con el detalle del error, y solo al confirmar hace upsert con onConflict party_id,supplier_sku.

8. Dentro de _portal/ (la misma ruta del Sprint 24), agrega navegación condicional: si el party del usuario de portal tiene classification='supplier', muestra "Mi Catálogo" (tabla editable de supplier_catalog_items propios, con alta/edición igual que el staff pero sin poder ver otros proveedores) y "Mis Contratos" (lista de supplier_contracts propios con descarga del PDF, de solo lectura).

9. Registra el módulo en company_modules con module_name='suppliers' (patrón del Sprint 33, get_company_modules/set_company_modules_bulk), para que se pueda activar/desactivar por empresa igual que los demás módulos.

Documenta en .md/CHANGELOG.md y actualiza .md/ARQUITECTURA.md y .md/MODULOS.md.
```
