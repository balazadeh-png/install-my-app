# Sprint 4 — Centros de Costo y Unidades/Sucursales

**Fase:** 1 — Fundación
**Depende de:** Sprint 1 (multiempresa), Sprint 2 (partida doble)
**Bloquea a:** Sprint 5 (multibodega, si quieres asociar bodega↔unidad), reportes por sucursal

## Objetivo

Agregar dos dimensiones analíticas jerárquicas — **Unidades/Sucursales** y **Centros de Costo** — por empresa, disponibles en cada línea de asiento y en los reportes.

## Por qué (brecha que resuelve)

Hoy no existe ninguna forma de imputar un asiento a una sucursal o a un centro de costo — ni la tabla, ni el campo, ni el reporte. Esto es exactamente tu pedido de *"manejar centros de costos para llevar el control por Unidades o sucursales"*.

Una decisión de diseño que vale la pena explicar: modelo **Unidad/Sucursal** y **Centro de Costo** como dos dimensiones separadas (no una sola), porque en la práctica un centro de costo (ej. "Marketing") suele cruzar varias sucursales, y una sucursal puede tener varios centros de costo. Es el mismo patrón que usa SAP y el que ya tienes validado en tu propio Cacao Accounting (`Unit` y `CostCenter` son clases distintas ahí). Si en tu operación real ambos conceptos siempre coinciden 1 a 1, simplemente los usas como si fueran uno solo — pero tener la flexibilidad no cuesta nada ahora y evita un rediseño después.

## Alcance incluido

- Tablas `business_units` y `cost_centers`, ambas jerárquicas (`parent_id`) y por empresa.
- `journal_entry_lines` gana `cost_center_id` y `business_unit_id` (opcionales).
- `accounts` gana `requires_cost_center` / `requires_business_unit` (booleanos) — para exigir la dimensión en cuentas de resultado sin obligarla en cuentas de balance.
- Pantallas de mantenimiento de ambas jerarquías.
- Selectores de ambas dimensiones en el formulario de comprobante.
- Filtro y agrupación por ambas dimensiones en los reportes existentes.

## Fuera de alcance

- Presupuesto por centro de costo (posible extensión futura, no se construye ahora).

## Cambios de esquema (sketch SQL)

```sql
CREATE TABLE IF NOT EXISTS public.business_units (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    parent_id uuid REFERENCES public.business_units(id),
    is_group boolean DEFAULT false,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (entity_id, code)
);

CREATE TABLE IF NOT EXISTS public.cost_centers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    parent_id uuid REFERENCES public.cost_centers(id),
    is_group boolean DEFAULT false,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (entity_id, code)
);

ALTER TABLE public.journal_entry_lines
  ADD COLUMN IF NOT EXISTS cost_center_id uuid REFERENCES public.cost_centers(id),
  ADD COLUMN IF NOT EXISTS business_unit_id uuid REFERENCES public.business_units(id);

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS requires_cost_center boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_business_unit boolean DEFAULT false;

CREATE OR REPLACE FUNCTION public.validate_line_dimensions()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_requires_cc boolean; v_requires_bu boolean;
BEGIN
  SELECT requires_cost_center, requires_business_unit INTO v_requires_cc, v_requires_bu
  FROM public.accounts WHERE id = NEW.account_id;

  IF v_requires_cc AND NEW.cost_center_id IS NULL THEN
    RAISE EXCEPTION 'La cuenta exige centro de costo';
  END IF;
  IF v_requires_bu AND NEW.business_unit_id IS NULL THEN
    RAISE EXCEPTION 'La cuenta exige unidad/sucursal';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_line_dimensions
BEFORE INSERT ON public.journal_entry_lines
FOR EACH ROW EXECUTE FUNCTION public.validate_line_dimensions();

-- RLS: mismo patrón multiempresa del Sprint 1, para ambas tablas
ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_business_units" ON public.business_units FOR SELECT TO authenticated
USING (public.user_has_company_access(auth.uid(), entity_id));
CREATE POLICY "write_business_units" ON public.business_units FOR ALL TO authenticated
USING ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'accountant')) AND public.user_has_company_access(auth.uid(), entity_id))
WITH CHECK ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'accountant')) AND public.user_has_company_access(auth.uid(), entity_id));
-- Repetir el mismo par de políticas (lectura + escritura) para cost_centers.
```

## Cambios de UI/backend esperados

- Nueva sección (dentro de `setup.tsx` o una ruta propia) para mantener ambas jerarquías: alta/edición/inactivación, con indentación visual según `parent_id` (no hay componente de árbol nativo en shadcn, una tabla indentada por nivel es suficiente).
- Formulario de comprobante (Sprint 2): dos selectores opcionales por línea — Centro de Costo y Unidad/Sucursal — que se vuelven obligatorios cuando la cuenta elegida tiene `requires_cost_center`/`requires_business_unit` en `true`.
- `reports.tsx`: agregar filtro y agrupación por ambas dimensiones en Estado de Resultados y Balance General.

## Criterios de aceptación

- [ ] Se pueden crear centros de costo y unidades jerárquicos (con relación padre-hijo) dentro de cada empresa.
- [ ] Marcar una cuenta de gasto como "exige centro de costo" impide postear una línea de esa cuenta sin elegirlo.
- [ ] El Estado de Resultados puede agruparse por sucursal y por centro de costo.
- [ ] Ambas jerarquías quedan aisladas por empresa (un usuario de la Empresa A no ve las de la Empresa B).

---

## Prompt listo para pegar en Lovable

```
Necesito agregar dos dimensiones analíticas al motor contable: Unidades/Sucursales y Centros de Costo, ambas jerárquicas y por empresa.

1. Crea la tabla `business_units` (id, entity_id, code, name, parent_id → business_units, is_group boolean, active boolean, created_at), única por (entity_id, code).

2. Crea la tabla `cost_centers` con la misma estructura (id, entity_id, code, name, parent_id → cost_centers, is_group, active, created_at), única por (entity_id, code).

3. Agrega `cost_center_id` y `business_unit_id` (ambos nullable, FK) a `journal_entry_lines`.

4. Agrega `requires_cost_center` y `requires_business_unit` (booleanos, default false) a `accounts`.

5. Crea un trigger BEFORE INSERT en `journal_entry_lines` que, si la cuenta de la línea tiene `requires_cost_center = true` y no se informó `cost_center_id`, rechace el insert con un mensaje claro (lo mismo para `requires_business_unit`/`business_unit_id`).

6. Habilita RLS en ambas tablas nuevas con el mismo patrón multiempresa que ya usamos en el resto del sistema: lectura si `user_has_company_access(auth.uid(), entity_id)`, escritura si además el usuario es admin o accountant.

7. Crea una pantalla de mantenimiento para ambas jerarquías (puede vivir dentro de `setup.tsx` como dos pestañas nuevas, o en una ruta propia `/setup/dimensiones`): listado indentado según `parent_id`, con alta, edición e inactivación. Permite marcar un registro como "grupo" (`is_group`) para que actúe solo como agrupador sin recibir movimientos directos.

8. En el formulario de comprobante (del Sprint 2), agrega dos selectores opcionales por línea: Centro de Costo y Unidad/Sucursal, filtrados por la empresa activa. Si la cuenta elegida exige alguna de las dos dimensiones, márcala como obligatoria en el formulario antes de intentar guardar (no esperes a que falle en el servidor).

9. En `reports.tsx`, agrega controles de filtro y agrupación por centro de costo y por unidad/sucursal en el Estado de Resultados y el Balance General.

Al terminar, documenta en `.md/CHANGELOG.md` y agrega ambas dimensiones a la sección correspondiente de `.md/ARQUITECTURA.md` y `.md/MODULOS.md`.
```
