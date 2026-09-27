# Sprint 24 — Portal Cliente

**Fase:** 3 — Vertical 3PL / Comercial
**Depende de:** Sprint 16 (`party_id` en `stock_ledger_entries`/`dispatch_notes`)
**Bloquea a:** ninguno directo

## Objetivo

Dar a cada cliente 3PL un acceso propio, separado del de tu personal interno, donde solo vea **su** inventario y **sus** guías — nunca las de otro cliente ni las tuyas propias.

## Por qué esto es distinto al resto de la app

Todo lo construido hasta ahora usa `company_users` + `user_has_company_access(entity_id)`: un usuario interno con acceso a la empresa completa. Un cliente 3PL **no es un usuario interno de tu empresa** — es un tercero externo que solo debe ver su propia porción. Meterlo dentro de `company_users` sería un error: le darías, sin querer, acceso a nivel de empresa. Por eso este sprint crea un mecanismo de acceso paralelo, no una extensión del que ya existe.

## Alcance incluido

- `party_portal_users`: qué usuario de Supabase Auth corresponde a qué cliente 3PL (`party_id`) — un cliente puede tener más de un usuario (ej. dos personas de su equipo).
- `user_has_party_access(party_id)`: función espejo de `user_has_company_access(entity_id)`, pero para clientes.
- Políticas RLS **adicionales** (no reemplazan las de staff interno) en `dispatch_notes` y `stock_ledger_entries`, que permiten `SELECT` cuando `user_has_party_access(party_id)` es verdadero.
- Ruta separada `src/routes/_portal/` (no `_authenticated/`) con su propio layout: si el usuario logueado no tiene fila en `party_portal_users`, no ve nada — no hereda por accidente ninguna vista pensada para staff interno.
- Dentro del portal: inventario propio (de `stock_balances`, filtrado a su `party_id`), listado de sus guías de despacho, descarga de la guía en PDF simple (sin folio DTE — sigue siendo un borrador interno, se lo puede aclarar en la UI).

## ⚠️ Detalle técnico a verificar al implementar

`stock_balances` es una **vista**. Por defecto en Postgres, una vista corre con los permisos de quien la creó, no de quien consulta — hay que confirmar que se crea (o se recrea) con `security_invoker = true` para que las políticas de `stock_ledger_entries` apliquen también al consultarla desde el portal. Si no, un cliente podría ver saldos de otros a través de la vista aunque la tabla base esté bien protegida.

## Cambios de esquema (sketch SQL)

```sql
CREATE TABLE IF NOT EXISTS public.party_portal_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    party_id uuid REFERENCES public.parties(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (user_id, party_id)
);
ALTER TABLE public.party_portal_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_has_party_access(check_party_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.party_portal_users
    WHERE user_id = auth.uid() AND party_id = check_party_id
  );
$$;

-- Políticas adicionales de solo lectura para el portal (conviven con las de staff interno, no las reemplazan)
CREATE POLICY "portal_read_own_dispatch_notes" ON public.dispatch_notes
  FOR SELECT TO authenticated USING (public.user_has_party_access(party_id));

CREATE POLICY "portal_read_own_stock_ledger" ON public.stock_ledger_entries
  FOR SELECT TO authenticated USING (public.user_has_party_access(party_id));

-- Recrear stock_balances con security_invoker=true si no lo tiene ya
ALTER VIEW public.stock_balances SET (security_invoker = true);
```

## Criterios de aceptación

- [ ] Un usuario sin fila en `party_portal_users` que entra a `/portal` no ve ningún dato — ni error confuso, un estado vacío claro.
- [ ] Un usuario de portal ve únicamente el inventario y las guías de su propio `party_id`, confirmado probando con dos clientes distintos en dos sesiones.
- [ ] El staff interno (vía `company_users`) sigue viendo todo normalmente — las políticas nuevas se suman, no reemplazan.
- [ ] `stock_balances` respeta la RLS de la tabla base al consultarse desde el portal.

---

## Prompt listo para pegar en Lovable

```
Voy a crear un portal separado para que cada cliente 3PL vea solo su propio inventario y guías, sin tocar el acceso que ya tiene el personal interno vía company_users.

1. Crea party_portal_users (user_id FK a auth.users on delete cascade, party_id FK a parties on delete cascade, created_at, único por user_id+party_id). Habilita RLS.

2. Crea la función user_has_party_access(check_party_id uuid) — SECURITY DEFINER, STABLE — que retorna true si existe una fila en party_portal_users para auth.uid() y ese party_id. Sigue el mismo patrón que user_has_company_access ya existente en el proyecto.

3. Agrega políticas NUEVAS (adicionales, no reemplaces las existentes) de SELECT en dispatch_notes y stock_ledger_entries usando user_has_party_access(party_id).

4. Verifica si stock_balances tiene security_invoker=true; si no, agrégalo con ALTER VIEW ... SET (security_invoker = true) para que la RLS de la tabla base se respete al consultar la vista.

5. Crea el grupo de rutas src/routes/_portal/ con su propio layout (_portal/route.tsx) que verifica sesión de Supabase Auth pero NO requiere company_users — solo que exista alguna fila en party_portal_users para el usuario logueado; si no existe ninguna, muestra un estado vacío ("No tienes acceso asignado a ningún cliente") en vez de redirigir a las rutas internas.

6. Dentro de _portal/, crea: una página de inventario (lee stock_balances filtrado a su party_id vía RLS, no hace falta filtrar en el cliente porque la política ya lo hace), y una página de guías de despacho (lee dispatch_notes + dispatch_note_lines de su party_id) con un botón "Descargar PDF" que genera un PDF simple de la guía marcando visiblemente que es un borrador interno, sin folio SII.

7. En "Clientes 3PL" (dispatch.tsx), agrega una forma de invitar/asociar un email de usuario existente de Supabase Auth a un party_id (inserta en party_portal_users).

Documenta en .md/CHANGELOG.md y actualiza .md/ARQUITECTURA.md y .md/MODULOS.md.
```
