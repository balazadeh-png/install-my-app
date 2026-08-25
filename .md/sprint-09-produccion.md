# Sprint 9 — Producción

**Fase:** 2 — Módulos Ampliados
**Depende de:** Sprint 5 (multibodega — reutiliza el motor FIFO para consumir materiales y crear el producto terminado)

## Objetivo

Lista de materiales (BOM), órdenes de producción, y costeo del producto terminado a partir del consumo real de materiales.

## Por qué

Tampoco existe en EasyERP ni en Cacao Accounting — es un módulo nuevo. La buena noticia es que, si el Sprint 5 quedó bien construido, Producción es en gran parte una **capa de orquestación** sobre el motor de inventario que ya existe: consumir materiales es simplemente registrar salidas FIFO, y crear el producto terminado es registrar una entrada a un costo calculado.

## Alcance incluido (MVP — solo costeo de materiales)

- `bill_of_materials` / `bom_lines`: la "receta" de cada producto terminado.
- `production_orders`: la orden de producción (bodega de origen de materiales, bodega destino del producto terminado, cantidades).
- Función `complete_production_order(id)`: consume los materiales según la receta (escalada a la cantidad producida), calcula el costo real consumido (vía el motor FIFO del Sprint 5) y crea la entrada del producto terminado a ese costo.

**Este MVP solo costea materiales.** Mano de obra y costos indirectos de fabricación (CIF) quedan fuera de este sprint — es una extensión natural una vez que el flujo básico esté funcionando y probado, no algo que haya que resolver ahora.

## Fuera de alcance

- Mano de obra y CIF en el costeo.
- Planificación de requerimientos de materiales (MRP) / órdenes automáticas por demanda.

## Cambios de esquema (sketch SQL)

```sql
CREATE TABLE IF NOT EXISTS public.bill_of_materials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) NOT NULL,
    item_id uuid REFERENCES public.items(id) NOT NULL,     -- producto terminado
    output_qty numeric(20,4) NOT NULL DEFAULT 1,             -- cuántas unidades produce esta receta
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.bom_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id uuid REFERENCES public.bill_of_materials(id) ON DELETE CASCADE NOT NULL,
    component_item_id uuid REFERENCES public.items(id) NOT NULL,
    qty_required numeric(20,4) NOT NULL
);

CREATE TYPE public.production_order_status AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');

CREATE TABLE IF NOT EXISTS public.production_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) NOT NULL,
    bom_id uuid REFERENCES public.bill_of_materials(id) NOT NULL,
    item_id uuid REFERENCES public.items(id) NOT NULL,
    qty_planned numeric(20,4) NOT NULL,
    qty_produced numeric(20,4) DEFAULT 0,
    source_warehouse_id uuid REFERENCES public.warehouses(id) NOT NULL,
    target_warehouse_id uuid REFERENCES public.warehouses(id) NOT NULL,
    cost_center_id uuid REFERENCES public.cost_centers(id),
    business_unit_id uuid REFERENCES public.business_units(id),
    status public.production_order_status DEFAULT 'planned',
    planned_date date NOT NULL,
    completed_date date,
    total_cost numeric(20,4)
);
```

**Lógica de `complete_production_order(id)`:**
1. Leer las líneas del BOM y escalar `qty_required` por `qty_planned / output_qty`.
2. Por cada componente: insertar una salida (`issue`) en `stock_ledger_entries` desde `source_warehouse_id` — el trigger FIFO del Sprint 5 calcula el costo real consumido.
3. Sumar el costo total consumido de todos los componentes.
4. Insertar la entrada (`receipt`) del producto terminado en `target_warehouse_id`, con `valuation_rate = costo_total / qty_planned`.
5. Actualizar la orden: `status = 'completed'`, `qty_produced`, `total_cost`, `completed_date`.

## Cambios de UI/backend esperados

- Pantalla "Recetas (BOM)": alta de producto terminado + sus componentes y cantidades.
- Pantalla "Órdenes de Producción": crear orden (elige BOM, cantidad a producir, bodegas), botón "Completar Producción" que ejecuta `complete_production_order`.
- Vista del costo real resultante del producto terminado tras cada orden completada (para comparar contra el costo estándar esperado, si se quiere en una iteración futura).

## Criterios de aceptación

- [ ] Completar una orden de producción descuenta correctamente cada componente de la bodega de origen (respetando FIFO) y no permite completarla si falta stock de algún componente.
- [ ] El producto terminado ingresa a la bodega destino al costo real resultante de los materiales consumidos, no a un costo fijo o estimado.
- [ ] Escalar la cantidad a producir escala proporcionalmente el consumo de cada componente.

---

## Prompt listo para pegar en Lovable

```
Necesito un módulo de Producción básico (solo costeo de materiales, sin mano de obra ni CIF por ahora), que reutilice el motor de inventario FIFO ya existente.

1. Crea `bill_of_materials` (entity_id, item_id del producto terminado, output_qty, is_active, created_at) y `bom_lines` (bom_id, component_item_id, qty_required).

2. Crea el enum `production_order_status` ('planned','in_progress','completed','cancelled') y la tabla `production_orders` (entity_id, bom_id, item_id, qty_planned, qty_produced, source_warehouse_id, target_warehouse_id, cost_center_id, business_unit_id, status, planned_date, completed_date, total_cost).

3. Crea la función `complete_production_order(_order_id uuid)`: lee las líneas del BOM de la orden, escala `qty_required` por la proporción `qty_planned / output_qty` del BOM, inserta una salida (`issue`) en `stock_ledger_entries` por cada componente desde `source_warehouse_id` (dejando que el trigger FIFO ya existente calcule el costo real), suma el costo total consumido, e inserta la entrada (`receipt`) del producto terminado en `target_warehouse_id` con `valuation_rate` igual al costo total dividido por `qty_planned`. Actualiza la orden a 'completed' con `qty_produced` y `total_cost`. Si falta stock de algún componente, la función debe fallar con un mensaje claro (el trigger FIFO ya lo hace, solo asegúrate de no dejar la orden en un estado intermedio inconsistente).

4. Crea una pantalla "Recetas (BOM)" para dar de alta un producto terminado y sus componentes con cantidades.

5. Crea una pantalla "Órdenes de Producción": alta de orden (BOM, cantidad a producir, bodega origen/destino, centro de costo/unidad opcional), listado con estado, y un botón "Completar Producción" que llame a la función anterior.

Aplica RLS multiempresa. Al terminar, documenta en `.md/CHANGELOG.md` y agrega el módulo a `.md/MODULOS.md` y `.md/ARQUITECTURA.md`.
```
