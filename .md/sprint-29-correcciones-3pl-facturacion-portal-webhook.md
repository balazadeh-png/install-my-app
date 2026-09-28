# Sprint 29 — Correcciones post-revisión de la vertical 3PL

**Fase:** 4 — Vertical 3PL / Endurecimiento (correcciones sobre los Sprints 16–28)
**Depende de:** Sprints 16–28 (implementados)
**Bloquea a:** Sprint 30 (medición de almacenaje por bodega) y cualquier facturación a un cliente real

## Objetivo

Corregir lo que apareció al revisar el código real de los Sprints 16–28 contra sus especificaciones, antes de operar con clientes reales. Este sprint **no agrega funcionalidad nueva**.

## Hallazgos que corrige

| # | Hallazgo | Dónde | Severidad |
|---|---|---|---|
| A | La facturación lee la columna `balance`, que no existe (`stock_balances` expone `qty_on_hand`); no revisa el error, así que el almacenaje se factura en $0 sin avisar. Además estimaba pallets como unidades ÷ 50 y m² como unidades ÷ 25 — constantes inventadas — y leía el saldo de hoy en vez del saldo al cierre del período | `src/lib/billing3pl.functions.ts` | Alta |
| B | El dashboard 3PL usa la misma columna inexistente, y estima ocupación con "1 pallet = 50 unidades ≈ 1,5 m³" | `src/routes/_authenticated/dashboard-3pl.tsx` | Alta |
| C | Los Sprints 24–28 no tienen archivo de migración: las tablas y políticas existen solo en la base viva | `supabase/migrations/` | Media |
| D | Las políticas RLS del portal (Sprint 24) no se pueden verificar desde el repo; la RPC `get_party_portal_users` expone emails de `auth.users` | base viva | Alta (hasta verificar) |
| E | El webhook de pedidos reescribe líneas y dirección de un pedido ya convertido en guía cuando el canal reintenta el envío; los tokens quedan en texto plano y los leen los roles accountant y sales; el SKU se busca con `ILIKE` (los `%` y `_` actúan como comodines) sobre todo el catálogo | `ingest_oms_order`, `src/lib/oms.functions.ts`, `party_webhook_tokens` | Media |

## Reglas para este sprint (y los siguientes)

1. Todo cambio de esquema queda en un archivo `supabase/migrations/<AAAAMMDD><contador>_sprintNN_*.sql`, **idempotente** (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS` antes de `CREATE POLICY`). No se aplica SQL directo a la base sin dejar el archivo.
2. El contador es correlativo: el último archivo existente termina en `000022`. Las reconstrucciones de los Sprints 24–28 usan `000023` a `000027` y este sprint `000028`. Verifica el último número real antes de nombrar.
3. Ningún dato faltante se reemplaza por un número inventado: se muestra "sin dato" o se pide ingresarlo.

## Paso 0 — Auditoría de la base viva (la corre Kiu en el SQL Editor de Supabase, ~5 minutos)

Pega el resultado completo de cada consulta. Sirve para escribir las migraciones de reconstrucción (Bloque C) y para revisar el RLS del portal (Bloque D). No contiene datos de clientes, solo definiciones.

```sql
-- A) ¿RLS activo en cada tabla?
SELECT c.relname AS tabla, c.relrowsecurity AS rls_activo
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname IN ('party_portal_users','service_contracts','service_rate_lines','operational_cost_inputs',
    'dispatch_notes','dispatch_note_lines','stock_ledger_entries','sales_orders','sales_order_lines',
    'party_webhook_tokens','party_warehouses','parties','entities','items','warehouses','warehouse_locations')
ORDER BY 1;

-- B) Políticas (expresiones USING / WITH CHECK)
SELECT tablename, policyname, permissive, cmd, roles, qual AS using_expr, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('party_portal_users','service_contracts','service_rate_lines','operational_cost_inputs',
    'dispatch_notes','dispatch_note_lines','stock_ledger_entries','sales_orders','sales_order_lines',
    'party_webhook_tokens','party_warehouses','parties','entities','items','warehouses','warehouse_locations')
ORDER BY tablename, policyname;

-- C) Definición completa de las funciones clave
SELECT p.proname, p.prosecdef AS security_definer, pg_get_functiondef(p.oid) AS definicion
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('user_has_party_access','get_party_portal_users','ingest_oms_order','user_has_company_access');

-- D) ¿stock_balances usa security_invoker?
SELECT c.relname, c.reloptions
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'v' AND c.relname = 'stock_balances';

-- E) ¿Quién puede ejecutar las funciones?
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('user_has_party_access','get_party_portal_users','ingest_oms_order')
ORDER BY 1, 2;
```

## Bloque A — Facturación de servicios (`src/lib/billing3pl.functions.ts` y su pantalla en `dispatch.tsx`)

- Eliminar las constantes de estimación (unidades ÷ 50 para pallets, ÷ 25 para m²) y **toda lectura de `stock_balances`** en este archivo. Hasta el Sprint 30 la cantidad de almacenaje se ingresa manualmente.
- Revisar `error` en cada consulta a Supabase de este archivo; si falla, lanzar el error. Nunca tratar una consulta fallida como consumo 0.
- Los schemas de entrada (vista previa y generación) reciben un `storage_quantities` opcional: `{ storage_pallet?: number, storage_m2?: number }`, con valores ≥ 0.
- Para cada `service_rate_lines` de tipo `storage_pallet` o `storage_m2` con `unit_price > 0`: la cantidad sale de `storage_quantities`. Si falta, la vista previa devuelve `missing_inputs: ["storage_pallet"]` y la generación se rechaza con "Ingresa la cantidad almacenada de {tipo} del período".
- Descripción de la línea: `Almacenaje — {qty} pallets (cantidad ingresada manualmente)`.
- UI: si la vista previa trae `missing_inputs`, mostrar un campo numérico por cada uno ("Pallets almacenados en el período" / "m² almacenados en el período"), sin valor por defecto, y recalcular al escribir.
- Picking y transporte no cambian.

Esto es provisorio: en el Sprint 30 cada bodega calcula su cantidad según su método de medición, y el ingreso manual pasa a ser el método `manual`.

## Bloque B — Dashboard 3PL (`src/routes/_authenticated/dashboard-3pl.tsx`)

- En la consulta de saldos (~línea 210) cambiar `balance` por `qty_on_hand` (y su uso en ~línea 441). Tipar la respuesta con ese nombre.
- Ocupación (~líneas 432–446): eliminar "1 pallet = 50 unidades ≈ 1,5 m³". Mostrar las unidades reales almacenadas por bodega. El % de ocupación y "m³ disponibles" quedan en "—" con el texto "Requiere definir el método de medición de la bodega (Sprint 30)". Mantener la edición de `capacity_m3` y no borrar datos ya cargados.
- Revisar `error` en todas las consultas del dashboard: ninguna debe quedar en 0 silenciosamente.

## Bloque C — Migraciones faltantes (Sprints 24–28)

Con el resultado del Paso 0, crear un archivo por sprint con lo que **ya existe** en la base viva, idempotente:

| Sprint | Objetos a versionar |
|---|---|
| 24 | `party_portal_users` (+ RLS), función `user_has_party_access`, RPC `get_party_portal_users`, y todas las políticas de portal sobre las tablas que consulta el portal: `dispatch_notes`, `dispatch_note_lines`, `stock_ledger_entries`, `sales_orders`, `sales_order_lines`, `parties`, `entities` y las que resulten de la auditoría (`items`, `warehouses`, …) |
| 25 | enums `billing_frequency` y `service_rate_type`; tablas `service_contracts` y `service_rate_lines` (+ RLS); columna `dispatch_notes.distance_km` |
| 26 | columna `sales_invoices.adjustment_of_invoice_id` |
| 27 | columna `warehouses.capacity_m3`; tabla `operational_cost_inputs` (+ RLS) |
| 28 | sin esquema nuevo (confirmarlo) |

Criterio mínimo: cada archivo se puede correr dos veces sobre la base viva sin error.

## Bloque D — Portal cliente: verificación y endurecimiento (Sprint 24)

Con el Paso 0 a la vista, verificar y corregir:

- **D1. `party_portal_users`.** Un usuario de portal solo lee sus propias filas (`user_id = auth.uid()`). Solo el personal interno (rol admin, sales o inventory con `user_has_company_access` sobre la empresa del cliente) puede insertar, modificar o borrar. Nunca debe existir una política que deje a un usuario insertar su propio `user_id`, porque se daría acceso a cualquier cliente.
- **D2. `get_party_portal_users(p_party_id)`** devuelve emails de `auth.users`. Debe ser `SECURITY DEFINER` con `SET search_path = public`, validar primero que quien llama es personal interno de la empresa de ese cliente (mismo criterio de D1), lanzar excepción si no, y tener el `EXECUTE` revocado a `anon`.
- **D3. Políticas de lectura del portal.** Cada tabla que el portal consulta tiene SELECT restringido a `user_has_party_access(party_id)`, o a través de la fila padre en `dispatch_note_lines` y `sales_order_lines`. Para `items`, `warehouses` y `warehouse_locations`, que el portal trae por join para mostrar nombres, la política debe limitarse a los registros que aparecen en movimientos o guías del propio cliente: **nunca todo el catálogo de la empresa**, que contiene los ítems de los demás clientes. Si no se puede acotar así, quitar el join y mostrar solo códigos.
- **D4. `parties` y `entities`.** El portal lee solo la fila de su propio cliente y la de la empresa asociada. No puede ver otros clientes.
- **D5.** Quitar del encabezado del portal la etiqueta fija "Sesión Segura (RLS Cliente)" (afirma una garantía que el código no verifica) o reemplazarla por el nombre del cliente.

SQL de referencia para D1 y D2 (mismo patrón que las políticas del Sprint 23):

```sql
-- Las políticas permisivas se combinan con OR: hay que ELIMINAR las políticas de escritura antiguas
-- de party_portal_users (nombres en la auditoría), no solo agregar estas.
DROP POLICY IF EXISTS "party_portal_users_read_own" ON public.party_portal_users;
CREATE POLICY "party_portal_users_read_own" ON public.party_portal_users
FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "party_portal_users_staff_all" ON public.party_portal_users;
CREATE POLICY "party_portal_users_staff_all" ON public.party_portal_users
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.parties p
    WHERE p.id = party_portal_users.party_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'inventory'))
    AND public.user_has_company_access(auth.uid(), p.entity_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.parties p
    WHERE p.id = party_portal_users.party_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'inventory'))
    AND public.user_has_company_access(auth.uid(), p.entity_id)
  )
);

-- Conservar EXACTAMENTE las columnas de salida actuales (ver auditoría, consulta C).
-- Si cambia el tipo de retorno, hacer DROP FUNCTION antes de recrear.
CREATE OR REPLACE FUNCTION public.get_party_portal_users(p_party_id uuid)
RETURNS TABLE (id uuid, user_id uuid, email text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_entity uuid;
BEGIN
  SELECT p.entity_id INTO v_entity FROM public.parties p WHERE p.id = p_party_id;
  IF v_entity IS NULL
     OR NOT public.user_has_company_access(auth.uid(), v_entity)
     OR NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales') OR public.has_role(auth.uid(), 'inventory'))
  THEN
    RAISE EXCEPTION 'Sin permiso' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT ppu.id, ppu.user_id, u.email::text, ppu.created_at
    FROM public.party_portal_users ppu
    JOIN auth.users u ON u.id = ppu.user_id
    WHERE ppu.party_id = p_party_id;
END;
$$;
REVOKE ALL ON FUNCTION public.get_party_portal_users(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_party_portal_users(uuid) TO authenticated;
```

**Pruebas de aislamiento** (SQL Editor; reemplaza los UUID por los de dos clientes y usuarios de portal de prueba, A y B):

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub','<UUID_USUARIO_PORTAL_A>','role','authenticated')::text, true);
SELECT DISTINCT party_id FROM public.dispatch_notes;        -- solo el cliente A
SELECT DISTINCT party_id FROM public.stock_balances;        -- solo el cliente A
SELECT id FROM public.parties;                              -- solo el cliente A
SELECT id FROM public.items;                                -- solo ítems con movimientos del cliente A (o vacío)
SELECT * FROM public.party_webhook_tokens;                  -- vacío
INSERT INTO public.party_portal_users(user_id, party_id)
VALUES ('<UUID_USUARIO_PORTAL_A>', '<UUID_CLIENTE_B>');     -- debe FALLAR por RLS
SELECT * FROM public.get_party_portal_users('<UUID_CLIENTE_A>'); -- debe lanzar "Sin permiso"
ROLLBACK;
```

## Bloque E — Webhook de pedidos (Sprint 23)

- **E1. Reintentos.** Si el pedido ya existe y su `status` no es `pendiente`, `ingest_oms_order` no modifica nada y responde `ignored: true` con el estado real. Si está `pendiente`, actualiza dirección y notas y reemplaza las líneas. Además exige `external_order_id` (sin él no hay idempotencia) y al menos una línea; cada línea requiere `sku` y `qty > 0` (no se asume 1). Todo ocurre en una sola transacción: si una línea es inválida, no se guarda nada.
- **E2. SKU.** Coincidencia exacta, sin distinguir mayúsculas, contra `items.code` o `items.sku` de la empresa. No se busca por nombre ni con `ILIKE`. Una línea sin coincidencia queda con `item_id` NULL (ya soportado) y la pantalla de pedidos la marca "SKU sin mapear". Limitación conocida: `items` es un catálogo de toda la empresa, no por cliente (ver Fuera de alcance).
- **E3. Tokens.** Se guarda solo el hash SHA-256 (`token_hash`) y un prefijo visible (`token_prefix`). El token completo se muestra una sola vez al crearlo (el modal ya existe). Los tokens vigentes se migran a hash y se borra el texto plano; los que ya se entregaron a clientes siguen funcionando.
- **E4. Handler** (`src/lib/oms.functions.ts` y `src/routes/api/webhooks/oms.ts`). Una sola vía: la RPC. Eliminar el "fallback directo" (hoy ignora los errores de la RPC y hace un upsert no transaccional que saltaría las reglas de E1) y la validación previa con SELECT. Usar la clave publicable (anon): la RPC valida el token, no hace falta service role. Validar el body con zod. Respuestas: token inválido → 401; payload inválido → 400 con mensaje; reintento de pedido ya procesado → 200 con `ignored: true`; cualquier otro error → 500 con mensaje genérico (no devolver `err.message` interno).

## Migración de este sprint (sketch) — `<AAAAMMDD>000028_sprint29_correcciones_3pl.sql`

Además del SQL de D1 y D2 de arriba:

```sql
-- E3. Tokens: solo hash + prefijo (sha256 es función nativa de Postgres, no requiere extensión)
ALTER TABLE public.party_webhook_tokens
  ADD COLUMN IF NOT EXISTS token_hash text,
  ADD COLUMN IF NOT EXISTS token_prefix text,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

UPDATE public.party_webhook_tokens
SET token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex'),
    token_prefix = left(token, 12)
WHERE token_hash IS NULL AND token IS NOT NULL;

ALTER TABLE public.party_webhook_tokens ALTER COLUMN token DROP NOT NULL;
UPDATE public.party_webhook_tokens SET token = NULL WHERE token_hash IS NOT NULL;
ALTER TABLE public.party_webhook_tokens ALTER COLUMN token_hash SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_party_webhook_tokens_hash ON public.party_webhook_tokens(token_hash);
DROP INDEX IF EXISTS public.idx_party_webhook_tokens_token;

-- E1/E2. RPC idempotente, atómica y con SKU exacto (misma firma que la actual)
CREATE OR REPLACE FUNCTION public.ingest_oms_order(
  p_token text, p_channel text, p_external_order_id text, p_destination_address text,
  p_lines jsonb, p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hash text; v_token_id uuid; v_party_id uuid; v_entity_id uuid;
  v_channel text; v_ext text; v_order_id uuid; v_status public.order_status;
  v_line jsonb; v_sku text; v_qty numeric; v_item_id uuid;
BEGIN
  v_hash := encode(sha256(convert_to(COALESCE(p_token, ''), 'UTF8')), 'hex');

  SELECT pwt.id, pwt.party_id, p.entity_id
    INTO v_token_id, v_party_id, v_entity_id
  FROM public.party_webhook_tokens pwt
  JOIN public.parties p ON p.id = pwt.party_id
  WHERE pwt.token_hash = v_hash AND pwt.is_active = true;

  IF v_party_id IS NULL THEN
    RAISE EXCEPTION 'Token de integración inválido o inactivo' USING ERRCODE = '28000';
  END IF;

  v_ext := NULLIF(trim(COALESCE(p_external_order_id, '')), '');
  IF v_ext IS NULL THEN
    RAISE EXCEPTION 'external_order_id es obligatorio' USING ERRCODE = '22023';
  END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'El pedido debe incluir al menos una línea' USING ERRCODE = '22023';
  END IF;
  v_channel := COALESCE(NULLIF(trim(COALESCE(p_channel, '')), ''), 'webhook');

  INSERT INTO public.sales_orders (entity_id, party_id, channel, external_order_id, destination_address, status, notes)
  VALUES (v_entity_id, v_party_id, v_channel, v_ext,
          NULLIF(trim(COALESCE(p_destination_address, '')), ''), 'pendiente', p_notes)
  ON CONFLICT (party_id, channel, external_order_id) DO NOTHING
  RETURNING id INTO v_order_id;

  IF v_order_id IS NULL THEN
    SELECT so.id, so.status INTO v_order_id, v_status
    FROM public.sales_orders so
    WHERE so.party_id = v_party_id AND so.channel = v_channel AND so.external_order_id = v_ext
    FOR UPDATE;

    IF v_status <> 'pendiente' THEN
      RETURN jsonb_build_object('success', true, 'ignored', true, 'order_id', v_order_id,
                                'external_order_id', v_ext, 'status', v_status);
    END IF;

    UPDATE public.sales_orders
       SET destination_address = COALESCE(NULLIF(trim(COALESCE(p_destination_address, '')), ''), destination_address),
           notes = COALESCE(p_notes, notes),
           updated_at = now()
     WHERE id = v_order_id;
    DELETE FROM public.sales_order_lines WHERE sales_order_id = v_order_id;
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_sku := trim(COALESCE(v_line->>'external_sku', v_line->>'sku', ''));
    BEGIN
      v_qty := (v_line->>'qty')::numeric;
    EXCEPTION WHEN invalid_text_representation THEN
      v_qty := NULL;
    END;
    IF v_sku = '' OR v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Cada línea requiere sku y qty > 0 (línea recibida: %)', v_line USING ERRCODE = '22023';
    END IF;

    SELECT i.id INTO v_item_id
    FROM public.items i
    WHERE i.entity_id = v_entity_id
      AND (lower(i.code) = lower(v_sku) OR lower(COALESCE(i.sku, '')) = lower(v_sku))
    ORDER BY (lower(i.code) = lower(v_sku)) DESC
    LIMIT 1;

    INSERT INTO public.sales_order_lines (sales_order_id, item_id, external_sku, qty)
    VALUES (v_order_id, v_item_id, v_sku, v_qty);
  END LOOP;

  UPDATE public.party_webhook_tokens SET last_used_at = now() WHERE id = v_token_id;

  RETURN jsonb_build_object('success', true, 'ignored', false, 'order_id', v_order_id,
                            'party_id', v_party_id, 'channel', v_channel,
                            'external_order_id', v_ext, 'status', 'pendiente');
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_oms_order(text, text, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingest_oms_order(text, text, text, text, jsonb, text) TO anon, authenticated, service_role;
```

En la UI de tokens (`dispatch.tsx`, ~línea 2901): al crear, calcular el hash con `crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))` (hex en minúsculas), insertar `token_hash` y `token_prefix` (primeros 12 caracteres) sin el campo `token`, y mostrar el token completo solo en el modal de creación. En la lista, mostrar `token_prefix` + `••••••••`.

## Fuera de alcance

- Medición de pallets, m², m³ y unidades por bodega: Sprint 30.
- Catálogo `items` por cliente (dos clientes con el mismo SKU chocan): decisión pendiente. Propuesta: tabla `party_item_skus` (party_id, external_sku, item_id) en un Sprint 31.
- Emisor DTE, habilitación SICEX, integración de couriers/GPS y de canales de e-commerce: siguen abiertos, sin cambios.

## Criterios de aceptación

- [ ] Facturar un cliente con contrato de almacenaje y sin cantidad ingresada: la vista previa pide el dato y la generación se rechaza; con cantidad, la línea sale con la descripción "(cantidad ingresada manualmente)".
- [ ] Ninguna consulta a `stock_balances` selecciona `balance`; ninguna consulta de `billing3pl.functions.ts` ni del dashboard descarta su `error`.
- [ ] El dashboard no muestra pallets ni m³ estimados: muestra unidades reales y "—" en el % de ocupación.
- [ ] Existen archivos de migración para los Sprints 24–28 y para el 29; cada uno se puede correr dos veces sin error.
- [ ] Las pruebas de aislamiento del Bloque D pasan: A no ve filas de B en `dispatch_notes`, `stock_balances`, `parties` ni `items`; el INSERT en `party_portal_users` falla; `get_party_portal_users` lanza "Sin permiso" para un usuario de portal.
- [ ] Webhook: el mismo POST dos veces deja una sola orden; tras convertirla en guía, un reenvío devuelve `ignored: true` y no cambia sus líneas; una línea sin `qty` responde 400 y no crea el pedido; un token inválido responde 401; un SKU con `%` no resuelve ningún ítem.
- [ ] `party_webhook_tokens.token` es NULL en todas las filas, la UI muestra solo el prefijo, y los tokens ya entregados siguen funcionando.

---

## Prompt listo para pegar en Lovable

```
Voy a corregir problemas encontrados al revisar los Sprints 16–28. No agregues funcionalidad nueva. Reglas: (1) todo cambio de esquema va en un archivo de migración idempotente en supabase/migrations con el siguiente número correlativo — no apliques SQL directo sin dejar el archivo; (2) ningún dato faltante se reemplaza por un número inventado.

Pego abajo el resultado de la auditoría de la base viva (políticas, funciones, vista stock_balances, permisos). Úsalo para todo lo que diga "según la auditoría":
[PEGAR AQUÍ EL RESULTADO DEL PASO 0]

1. Facturación (src/lib/billing3pl.functions.ts): elimina las constantes de estimación (unidades ÷ 50 para pallets, ÷ 25 para m²) y toda lectura de stock_balances en ese archivo. Revisa el error de cada consulta y lánzalo si falla. Agrega storage_quantities opcional { storage_pallet?, storage_m2? } (números ≥ 0) al schema de entrada de la vista previa y de la generación. Para cada service_rate_lines de tipo storage_pallet o storage_m2 con unit_price > 0, la cantidad sale de storage_quantities; si falta, la vista previa devuelve missing_inputs y la generación se rechaza. Descripción de la línea: "Almacenaje — {qty} pallets (cantidad ingresada manualmente)". En la pantalla de facturación de dispatch.tsx muestra un campo numérico por cada missing_inputs, sin valor por defecto. Picking y transporte no cambian.

2. Dashboard 3PL (dashboard-3pl.tsx): cambia la columna balance por qty_on_hand en la consulta a stock_balances y en su uso. Elimina la aproximación "1 pallet = 50 unidades ≈ 1,5 m³": muestra las unidades reales almacenadas por bodega y deja el % de ocupación y "m³ disponibles" en "—" con el texto "Requiere definir el método de medición de la bodega (Sprint 30)". No borres los capacity_m3 ya cargados. Revisa que ninguna consulta del dashboard descarte su error.

3. Migraciones de reconstrucción: según la auditoría, crea un archivo idempotente por sprint (24: party_portal_users, user_has_party_access, get_party_portal_users y todas las políticas de portal; 25: enums billing_frequency y service_rate_type, service_contracts, service_rate_lines, dispatch_notes.distance_km; 26: sales_invoices.adjustment_of_invoice_id; 27: warehouses.capacity_m3 y operational_cost_inputs; 28: confirma que no hay esquema nuevo). Usa DROP POLICY IF EXISTS antes de cada CREATE POLICY.

4. Portal (Sprint 24), según la auditoría: (a) party_portal_users: SELECT propio (user_id = auth.uid()) y escritura solo para personal interno (admin/sales/inventory con user_has_company_access sobre la empresa del cliente) — ELIMINA cualquier política de escritura antigua permisiva, porque las permisivas se combinan con OR; (b) get_party_portal_users: SECURITY DEFINER, search_path = public, valida que quien llama es personal interno de esa empresa y lanza excepción si no, EXECUTE revocado a anon; conserva las columnas de salida actuales; (c) verifica que cada tabla que consulta el portal tenga SELECT restringido a user_has_party_access(party_id) o a la fila padre; para items, warehouses y warehouse_locations la política de portal debe limitarse a registros que aparecen en movimientos o guías del propio cliente, nunca todo el catálogo de la empresa (si no se puede, quita el join en el portal y muestra códigos); (d) parties y entities: el portal solo lee su propio cliente y su empresa; (e) quita del encabezado del portal la etiqueta fija "Sesión Segura (RLS Cliente)". Entrega el SQL de las pruebas de aislamiento con UUID como placeholders, para que las corra Kiu.

5. Webhook de pedidos: en la migración de este sprint reemplaza ingest_oms_order (misma firma) para que sea idempotente y atómica: exige external_order_id y al menos una línea; cada línea requiere sku y qty > 0; si el pedido existe y su status no es 'pendiente' no modifica nada y responde { success: true, ignored: true, status }; si está 'pendiente' actualiza dirección/notas y reemplaza líneas; SKU por coincidencia exacta sin distinguir mayúsculas contra items.code o items.sku (sin ILIKE ni búsqueda por nombre); token validado por hash SHA-256 (encode(sha256(convert_to(p_token,'UTF8')),'hex')); errores con ERRCODE 28000 (token) y 22023 (payload). Agrega a party_webhook_tokens token_hash (NOT NULL, único), token_prefix y last_used_at; migra los tokens existentes a hash, deja token en NULL y elimina el índice sobre token. REVOKE ALL a PUBLIC y GRANT EXECUTE a anon, authenticated y service_role.

6. Handler (src/lib/oms.functions.ts y src/routes/api/webhooks/oms.ts): una sola vía — llama solo a la RPC ingest_oms_order con la clave publicable (anon), sin service role. Elimina el fallback de upsert directo y la validación previa con SELECT. Valida el body con zod. Responde 401 si el error es 28000, 400 si es 22023 (con el mensaje), 200 con ignored: true para pedidos ya procesados y 500 con mensaje genérico para cualquier otro error.

7. UI de tokens (dispatch.tsx): al crear un token, calcula su SHA-256 en el navegador (crypto.subtle.digest, hex en minúsculas), inserta token_hash y token_prefix (primeros 12 caracteres) sin guardar el token, y muestra el token completo solo en el modal de creación. En la lista muestra token_prefix + "••••••••".

8. Pantalla de pedidos: marca "SKU sin mapear" las líneas con item_id nulo.

Documenta en .md/CHANGELOG.md y actualiza .md/ARQUITECTURA.md y .md/MODULOS.md.
```
