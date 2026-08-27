# Sprint 15 (revisado) — Integración SII vía ApiPyme (Registro de Ventas y Compras)

**Fase:** Post Fase 2 — Integración externa
**Depende de:** Sprint 11 (Libros Contables SII)
**Reemplaza a:** la primera versión de este archivo — corregido contra la documentación real de ApiPyme que compartiste (`APIPYME.docx`), no contra lo que su sitio público dejaba inferir.

## Qué cambió respecto a la v1

- El manejo del código 202 ya no es una suposición: existe `GET /api/v1/extracciones/{task_id}/` (estados `PENDING/RUNNING/SUCCESS/FAILED`) **y** un mecanismo de webhook que avisa solo cuando la extracción termina — mejor que hacer polling.
- Se agrega paginación real (`page`/`page_size`, hasta 5.000 por página) — sin esto, un cliente con más de 1.000 documentos al mes habría perdido datos silenciosamente.
- Las boletas electrónicas llegan como agregado dentro de la respuesta de ventas (el SII no da detalle documento a documento) — necesitan su propia tabla, no encajan en `sii_synced_documents`.
- Nombres de campo corregidos a los reales: `doc_number` (no `folio`), `rut_receiver`/`receiver_name` en ventas vs. `rut_issuer`/`issuer_name` en compras, `actualizado_en`, `exempt_amount`.
- La cuota diaria se descuenta por versión de dato (`actualizado_en` distinto), no por llamada — repetir contra datos ya cacheados es gratis, así que la UI puede ser menos tímida que lo que sugerí antes.

Todo lo demás del diseño original (dónde vive el token, cómo se relaciona con la Conciliación RCV del Sprint 11) se mantiene igual.

## ⚠️ Nota de seguridad (sin cambios — sigue siendo lo más importante)

El token de ApiPyme da acceso de lectura al RCV, F29 y honorarios completos de una empresa.
- Nunca legible desde el cliente/navegador, ni para un admin.
- Vive en una tabla **sin ninguna política RLS de SELECT para `authenticated`** — solo se lee/escribe server-side con la service role key, mismo patrón que `assignAdminIfFirst` en `auth.functions.ts`.
- El secret del webhook (para validar que la notificación viene realmente de ApiPyme) se guarda como variable de entorno/secreto del proyecto, no en una tabla — es uno solo para toda la cuenta de ApiPyme, no por empresa.

## Alcance incluido

- `sii_api_connections`: token de ApiPyme por empresa (server-side only).
- `sii_synced_documents`: documentos de ventas/compras, con paginación completa.
- `sii_boletas_summary`: el agregado de boletas electrónicas por período (viene embebido en la respuesta de ventas).
- `sii_sync_jobs`: seguimiento de extracciones vía `task_id`, alimentado tanto por el webhook como por consulta manual a `/extracciones/{task_id}/`.
- Un endpoint HTTP propio (webhook receiver) que ApiPyme llama cuando termina una extracción.
- Función de servidor `syncSiiDocuments` con paginación real y manejo correcto de 202.
- Botón "Verificar conexión" (usa `GET /api/v1/empresa/`) además de "Sincronizar desde SII".

## Fuera de alcance (por ahora — pero la misma conexión ya los habilita)

- F29 (`/api/v1/f29/{period}/`) y Resumen (`/api/v1/resumen/{period}/`) — encajarían directo como fuente de datos del Sprint 12, en vez de (o además de) tu cálculo interno de IVA. Vale la pena evaluarlo cuando llegues a ese sprint.
- Honorarios (`/api/v1/honorarios/{year}/`) — conecta directo con la DJ 1879 del Sprint 13.
- Indicadores (`/api/v1/indicadores/`) — UF/Dólar/Euro/UTM/IPC automáticos, candidato natural para alimentar `exchange_rates` del Sprint 3 en vez de carga manual.
- Comparativa de períodos — analítica, no crítico ahora.

## Cambios de esquema (sketch SQL)

```sql
CREATE TABLE IF NOT EXISTS public.sii_api_connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL UNIQUE,
    provider text NOT NULL DEFAULT 'apipyme',
    company_token text NOT NULL,
    active boolean DEFAULT true,
    last_synced_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.sii_api_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_client_access" ON public.sii_api_connections
FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE TYPE public.sii_document_type AS ENUM ('venta', 'compra');

CREATE TABLE IF NOT EXISTS public.sii_synced_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) NOT NULL,
    document_type public.sii_document_type NOT NULL,
    period text NOT NULL,               -- YYYYMM
    sii_doc_type text,                  -- doc_type de ApiPyme: '33' Factura, '34' Exenta, '56' ND, '60'/'61' NC...
    folio text,                         -- doc_number de ApiPyme
    issue_date date,
    party_tax_id text,                  -- rut_receiver (ventas) / rut_issuer (compras)
    party_name text,                    -- receiver_name (ventas) / issuer_name (compras)
    net_amount numeric(20,4),
    tax_amount numeric(20,4),
    exempt_amount numeric(20,4),
    total_amount numeric(20,4),
    raw_payload jsonb NOT NULL,
    extracted_at timestamptz,           -- extracted_at del documento (ApiPyme)
    synced_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (entity_id, document_type, period, sii_doc_type, folio, party_tax_id)
);

-- Boletas electrónicas: agregado del período, sin detalle documento a documento (así lo entrega el SII)
CREATE TABLE IF NOT EXISTS public.sii_boletas_summary (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) NOT NULL,
    period text NOT NULL,
    cantidad_documentos integer,
    monto_neto numeric(20,4),
    monto_exento numeric(20,4),
    monto_iva numeric(20,4),
    monto_total numeric(20,4),
    extracted_at timestamptz,
    synced_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (entity_id, period)
);

CREATE TYPE public.sii_sync_status AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');

CREATE TABLE IF NOT EXISTS public.sii_sync_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) NOT NULL,
    module text NOT NULL,               -- 'ventas' | 'compras' | 'f29' | 'honorarios' (igual que ApiPyme los nombra)
    period text NOT NULL,
    apipyme_task_id text UNIQUE,
    status public.sii_sync_status DEFAULT 'PENDING',
    rows_extracted integer,
    error_message text,
    requested_at timestamptz DEFAULT now() NOT NULL,
    completed_at timestamptz
);
```

## Función de servidor (con paginación real)

```typescript
// sii-sync.functions.ts
async function fetchAllPages(module: "ventas" | "compras", period: string, token: string) {
  let page = 1;
  let documentos: any[] = [];
  let boletas: any = null;
  let actualizadoEn: string | null = null;

  while (true) {
    const res = await fetch(
      `https://apipyme.cl/api/v1/${module}/${period}/?page=${page}&page_size=5000`,
      { headers: { "X-Company-Token": token } }
    );

    if (res.status === 202) {
      const { task_id } = await res.json();
      return { pending: true, task_id };
    }
    if (res.status === 401) throw new Error("Token ApiPyme inválido o empresa inactiva.");
    if (res.status === 403) throw new Error(`Sin licencia activa para el módulo "${module}".`);
    if (res.status === 429) throw new Error("Límite diario de consultas ApiPyme alcanzado para esta empresa.");
    if (res.status !== 200) throw new Error(`ApiPyme respondió ${res.status} para ${module}/${period}`);

    const body = await res.json();
    documentos = documentos.concat(body.data);
    actualizadoEn = body.actualizado_en;
    if (module === "ventas" && body.boletas) boletas = body.boletas;

    if (!body.pagination.tiene_siguiente) break;
    page++;
  }

  return { pending: false, documentos, boletas, actualizadoEn };
}

export const syncSiiDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    entity_id: z.string().uuid(),
    document_type: z.enum(["venta", "compra"]),
    period: z.string().regex(/^\d{6}$/),
  }).parse(data))
  .handler(async ({ context, data }) => {
    // 1) Verificar acceso a la empresa (user_has_company_access) con el cliente normal del usuario.
    // 2) Leer el token con el cliente de SERVICE ROLE (nunca con el cliente del usuario).
    const supabaseAdmin = /* createClient con SUPABASE_SERVICE_ROLE_KEY, igual que assignAdminIfFirst */;
    const { data: conn } = await supabaseAdmin
      .from("sii_api_connections").select("company_token")
      .eq("entity_id", data.entity_id).single();
    if (!conn) throw new Error("Esta empresa no tiene una conexión ApiPyme configurada.");

    const module = data.document_type === "venta" ? "ventas" : "compras";
    const result = await fetchAllPages(module, data.period, conn.company_token);

    if (result.pending) {
      // Registrar/actualizar sii_sync_jobs (entity_id, module, period, apipyme_task_id, status='PENDING')
      return { status: "pending", task_id: result.task_id };
    }

    // Upsert de result.documentos en sii_synced_documents (on conflict del UNIQUE de arriba),
    // mapeando doc_type→sii_doc_type, doc_number→folio, rut_receiver/rut_issuer→party_tax_id,
    // receiver_name/issuer_name→party_name, exempt_amount, extracted_at.
    // Si result.boletas existe, upsert en sii_boletas_summary (on conflict entity_id+period).
    // Actualizar sii_api_connections.last_synced_at con el cliente admin.
    return { status: "completed", count: result.documentos.length };
  });
```

## Webhook receiver (nuevo — reemplaza la necesidad de "adivinar" el polling)

Crea un endpoint HTTP propio (usa el mecanismo de rutas de API que tenga la versión actual de TanStack Start del proyecto — revísalo al implementar, no asumas la sintaxis) que ApiPyme llamará por POST cuando termine una extracción:

1. Valida el header `X-Webhook-Secret` contra un secreto guardado como variable de entorno del proyecto (uno solo, no por empresa).
2. Lee el payload: `{ event, module, rut, period, status, rows, task_id }`.
3. Busca la empresa cuyo `entities.tax_id` coincide con `rut` (normaliza formato de RUT antes de comparar — puntos/guion pueden venir distintos).
4. Actualiza `sii_sync_jobs` (buscando por `apipyme_task_id`): `status`, `rows_extracted = rows`, `completed_at = now()`.
5. Si `status = 'SUCCESS'`: llama a `syncSiiDocuments` internamente para ese `entity_id`/`document_type`/`period`, que ahora debería devolver 200 con los datos.
6. Responde 2xx en menos de 10 segundos (si tarda más, ApiPyme reintentará con backoff).

## Cambios de UI/backend esperados

- `setup.tsx`: sección para conectar ApiPyme por empresa — botón "Verificar conexión" que llama a `GET /api/v1/empresa/` con el token ingresado (muestra `business_name` y `is_active` antes de guardar, para confirmar que el token es válido).
- Pantalla "Libros Legales SII": botón "Sincronizar desde SII" llama a `syncSiiDocuments`; si vuelve `pending`, mostrar "Extracción en curso — se completará sola" (el webhook la resolverá) en vez de pedir que el usuario reintente a ciegas.
- El "Libro Ventas" debe incluir, además de la tabla de documentos (`sii_synced_documents`), el resumen de boletas (`sii_boletas_summary`) del mismo período como una fila/sección aparte, ya que no tiene el mismo nivel de detalle.
- Conciliación RCV: sin cambios respecto al Sprint 11, sigue cruzando `sii_synced_documents` contra `sales_invoices`/`purchase_invoices`.

## Criterios de aceptación

- [ ] Un período con más de 1.000 documentos se sincroniza completo (todas las páginas), no solo la primera.
- [ ] El token no es legible desde el cliente en ningún caso.
- [ ] Cuando ApiPyme responde 202, el webhook (no un reintento manual del usuario) es lo que eventualmente completa la sincronización.
- [ ] Las boletas del período aparecen como resumen agregado, no como intento fallido de desglose documento a documento.
- [ ] "Verificar conexión" confirma que un token es válido antes de guardarlo.

---

## Prompt listo para pegar en Lovable

```
Voy a corregir la integración ApiPyme del sprint anterior con el detalle real de su documentación (adjunto los puntos clave, ya no son una suposición).

1. Crea `sii_api_connections` (entity_id único, provider default 'apipyme', company_token, active, last_synced_at, created_at) con RLS `FOR ALL TO authenticated USING (false) WITH CHECK (false)` — sin acceso de cliente, todo pasa por una función de servidor con la service role key (mismo patrón que `assignAdminIfFirst`).

2. Crea el enum `sii_document_type` ('venta','compra') y `sii_synced_documents` (entity_id, document_type, period, sii_doc_type, folio, issue_date, party_tax_id, party_name, net_amount, tax_amount, exempt_amount, total_amount, raw_payload jsonb, extracted_at, synced_at), única por (entity_id, document_type, period, sii_doc_type, folio, party_tax_id).

3. Crea `sii_boletas_summary` (entity_id, period, cantidad_documentos, monto_neto, monto_exento, monto_iva, monto_total, extracted_at, synced_at), única por (entity_id, period) — es el agregado de boletas que viene embebido en la respuesta de ventas bajo la clave "boletas".

4. Crea el enum `sii_sync_status` ('PENDING','RUNNING','SUCCESS','FAILED') y `sii_sync_jobs` (entity_id, module text, period, apipyme_task_id único, status, rows_extracted, error_message, requested_at, completed_at).

5. Crea `sii-sync.functions.ts` con una función auxiliar `fetchAllPages(module, period, token)` que pagine `GET https://apipyme.cl/api/v1/{ventas|compras}/{period}/?page=N&page_size=5000` acumulando `data` hasta que `pagination.tiene_siguiente` sea false, capturando también `boletas` (solo en ventas) y `actualizado_en`. Debe manejar explícitamente: 202 (retorna {pending:true, task_id}), 401 ("Token ApiPyme inválido o empresa inactiva"), 403 ("Sin licencia activa para el módulo"), 429 ("Límite diario alcanzado"), y cualquier otro código como error genérico.

6. Crea la función de servidor `syncSiiDocuments` (createServerFn + requireSupabaseAuth, igual que el resto de auth.functions.ts): valida `user_has_company_access`, lee el token con el cliente de service role desde `sii_api_connections`, llama a `fetchAllPages`, y si no quedó pending hace upsert de los documentos en `sii_synced_documents` (mapeando doc_type→sii_doc_type, doc_number→folio, rut_receiver/rut_issuer→party_tax_id, receiver_name/issuer_name→party_name) y de boletas en `sii_boletas_summary` si vino. Si quedó pending, registra/actualiza sii_sync_jobs con el task_id y status 'PENDING'.

7. Crea un endpoint webhook (usa el mecanismo de rutas de API de la versión actual de TanStack Start del proyecto) que reciba POST de ApiPyme: valida el header X-Webhook-Secret contra una variable de entorno del proyecto, lee {event, module, rut, period, status, rows, task_id}, busca la empresa por entities.tax_id normalizado contra rut, actualiza sii_sync_jobs (buscando por apipyme_task_id) con status/rows_extracted/completed_at, y si status es 'SUCCESS' llama a syncSiiDocuments internamente para traer los datos ya listos. Debe responder 2xx en menos de 10 segundos.

8. En `setup.tsx`, la sección de conexión ApiPyme agrega un botón "Verificar conexión" que llama a GET https://apipyme.cl/api/v1/empresa/ con el token recién ingresado (antes de guardarlo) y muestra business_name + is_active para confirmar que es válido.

9. En la pantalla de Libros Legales SII, el botón "Sincronizar desde SII" debe mostrar "Extracción en curso — se completará sola" cuando la respuesta sea pending, y el Libro de Ventas debe mostrar el resumen de sii_boletas_summary del período como una sección aparte además de la tabla de documentos de sii_synced_documents.

Aplica RLS multiempresa normal (no la restrictiva) a sii_synced_documents, sii_boletas_summary y sii_sync_jobs. Al terminar, documenta en `.md/CHANGELOG.md` y actualiza `.md/ARQUITECTURA.md`.
```
