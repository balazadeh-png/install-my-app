# Sprint 1 — Multiempresa Real y Seguridad RLS

**Fase:** 1 — Fundación
**Depende de:** nada (es el punto de partida)
**Bloquea a:** todos los sprints siguientes

## Objetivo

Convertir `entities` de un catálogo decorativo a un aislamiento de datos real: cada usuario solo debe poder leer y escribir datos de las empresas a las que está asignado, y toda la aplicación debe operar siempre "dentro" de una empresa activa.

## Por qué (brecha que resuelve)

Hoy, todas las políticas RLS de tablas de negocio son del tipo `USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))` — sin ningún filtro por `entity_id`. Cualquier contador ve y edita las cuentas, asientos y terceros de **todas** las empresas al mismo tiempo. Tampoco existe una tabla que diga "el usuario X pertenece a la empresa Y", ni un selector de empresa en la interfaz. Construir cualquier otro módulo sobre esto significaría heredar el mismo agujero de seguridad en cada tabla nueva.

## Alcance incluido

- Tabla `company_users` (usuario ↔ empresa ↔ rol en esa empresa).
- Función `public.user_has_company_access(_user_id uuid, _entity_id uuid)`.
- `entities.currency` (texto libre) → `entities.base_currency_code` (FK real a `currencies.code`).
- Reescritura de las políticas RLS de: `accounts`, `books`, `fiscal_years`, `accounting_periods`, `gl_entries`, `parties`, `contacts`, `addresses`, `items`, `warehouses`, `naming_series` — agregando el filtro de empresa además del filtro de rol.
- Columna `profiles.active_entity_id` + selector de empresa activa en `AppHeader.tsx`.
- Toda query/mutación existente en `accounting.tsx`, `setup.tsx`, `sales.tsx`, `purchases.tsx`, `inventory.tsx`, `cash.tsx` debe filtrar por `active_entity_id` al leer, y estampar `entity_id` al insertar.
- Migración de backfill: filas existentes con `entity_id IS NULL` se asignan a una empresa por defecto (crear una si no existe ninguna).

## Fuera de alcance (para sprints futuros)

- El contenido de los asientos en sí (eso es el Sprint 2).
- Reportes consolidados multiempresa (fuera de alcance de Fase 1, ver sección de riesgos del RoadMap).

## Cambios de esquema (sketch SQL, ajustar a convenciones idempotentes ya usadas en el proyecto)

```sql
-- 1) Vínculo usuario-empresa
CREATE TABLE IF NOT EXISTS public.company_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    role public.app_role NOT NULL,
    is_default boolean DEFAULT false,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (user_id, entity_id)
);

ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_company_links"
ON public.company_users FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins_manage_company_links"
ON public.company_users FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) Función de acceso por empresa (mismo patrón que has_role)
CREATE OR REPLACE FUNCTION public.user_has_company_access(_user_id uuid, _entity_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_users
    WHERE user_id = _user_id AND entity_id = _entity_id
  ) OR public.has_role(_user_id, 'admin')
$$;

REVOKE ALL ON FUNCTION public.user_has_company_access(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_company_access(uuid, uuid) TO authenticated;

-- 3) Empresa activa en el perfil
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_entity_id uuid REFERENCES public.entities(id);

-- 4) Ejemplo de política re-escrita (repetir el patrón por cada tabla listada arriba)
DROP POLICY IF EXISTS "write_accounts" ON public.accounts;
CREATE POLICY "write_accounts" ON public.accounts FOR ALL TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

-- 5) Índices para que la política anterior no sea lenta
CREATE INDEX IF NOT EXISTS ix_company_users_user_entity ON public.company_users(user_id, entity_id);
```

> Nota: `gl_entries.entity_id` puede ser `NULL` hoy. Antes de aplicar el paso 4 sobre `gl_entries`, correr un `UPDATE` de backfill que asigne la empresa por defecto a las filas huérfanas.

## Cambios de UI/backend esperados

- `AppHeader.tsx`: selector desplegable de empresa activa (solo muestra empresas en `company_users` del usuario), que al cambiar actualiza `profiles.active_entity_id` y refresca todas las queries.
- `setup.tsx`: el diálogo "Nueva Empresa" deja de hardcodear `currency: "CLP"` — debe leer de `currencies` y dejar elegir. También necesita un flujo para asignar usuarios a la empresa recién creada (al menos el creador, como admin de esa empresa).
- Todas las queries de TanStack Query en `accounting.tsx`, `sales.tsx`, `purchases.tsx`, `inventory.tsx`, `cash.tsx` agregan `.eq("entity_id", activeEntityId)`; todas las mutaciones agregan `entity_id: activeEntityId` al insertar.

## Criterios de aceptación

- [ ] Un usuario asignado solo a la Empresa A no puede ver ni editar cuentas/asientos/terceros de la Empresa B, ni por UI ni llamando a la API de Supabase directamente con su JWT.
- [ ] Crear una empresa nueva permite elegir su moneda base desde el catálogo `currencies`, no queda fija en CLP.
- [ ] Cambiar la empresa activa en el header refresca todas las pantallas sin recargar la página.
- [ ] No quedan filas con `entity_id NULL` en ninguna tabla de negocio tras la migración de backfill.

---

## Prompt listo para pegar en Lovable

```
Necesito convertir EasyERP en un sistema realmente multiempresa. Hoy la tabla `entities` existe pero ninguna política RLS filtra por empresa, así que cualquier usuario ve y edita datos de todas las empresas.

Implementa lo siguiente:

1. Crea la tabla `company_users` (id, user_id → auth.users, entity_id → entities, role app_role, is_default boolean, created_at) con RLS: cada usuario solo puede leer sus propios vínculos, solo un admin puede gestionar vínculos de cualquier usuario.

2. Crea la función `public.user_has_company_access(_user_id uuid, _entity_id uuid)` como SECURITY DEFINER (mismo patrón que la función existente `public.has_role`), que retorne true si existe un vínculo en `company_users` o si el usuario es admin global.

3. Cambia `entities.currency` (hoy texto libre) por una columna `base_currency_code` con foreign key real a `currencies.code`. Antes de eliminar la columna vieja, migra los valores existentes.

4. Agrega la columna `active_entity_id` (uuid, FK a entities) a `profiles`.

5. Reescribe las políticas RLS de `accounts`, `books`, `fiscal_years`, `accounting_periods`, `gl_entries`, `parties`, `contacts`, `addresses`, `items`, `warehouses` y `naming_series` para que, además de la validación de rol que ya existe, exijan `public.user_has_company_access(auth.uid(), entity_id)`. Antes de aplicar esto sobre `gl_entries`, haz un backfill: cualquier fila con `entity_id NULL` en cualquiera de estas tablas debe asignarse a la primera empresa activa que exista (créala si no existe ninguna).

6. En `AppHeader.tsx`, agrega un selector de "empresa activa" que liste solo las empresas del `company_users` del usuario logueado, y que al cambiar actualice `profiles.active_entity_id` e invalide todas las queries de TanStack Query relacionadas con datos de negocio.

7. En `setup.tsx`, el diálogo "Nueva Empresa" debe dejar de fijar `currency: "CLP"` en el insert — reemplázalo por un `<Select>` poblado desde la tabla `currencies`. Al crear una empresa, inserta automáticamente un registro en `company_users` que vincule al usuario actual como admin de esa empresa.

8. En `accounting.tsx`, `sales.tsx`, `purchases.tsx`, `inventory.tsx` y `cash.tsx`, todas las queries de lectura deben filtrar por `entity_id = <empresa activa>` y todas las mutaciones de creación deben incluir `entity_id: <empresa activa>` en el insert. Si no hay empresa activa seleccionada, la pantalla debe mostrar un estado vacío pidiendo elegir o crear una empresa primero, en vez de romperse.

Al terminar, agrega una entrada en `.md/CHANGELOG.md` describiendo este cambio y actualiza `.md/ARQUITECTURA.md` en la sección de Configuración Contable para reflejar `company_users` y el nuevo flujo de empresa activa.
```
