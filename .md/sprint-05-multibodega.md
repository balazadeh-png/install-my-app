# Sprint 5 — Multibodega Real

**Fase:** 1 — Fundación
**Depende de:** Sprint 1 (multiempresa)
**Bloquea a:** Sprint 6 (ventas/compras — descuenta y costea inventario), Sprint 9 (Producción)

## Objetivo

Construir el motor de inventario real que hoy falta: movimientos por bodega, traslados entre bodegas, saldo en tiempo real y valorización FIFO efectiva (no solo declarada).

## Por qué (brecha que resuelve)

`warehouses` existe como catálogo por empresa, pero no hay ninguna tabla de movimientos, ni saldo, ni traslados. `items.valuation_method` dice que el método es FIFO, pero no hay ningún motor que efectivamente calcule un costo FIFO — es solo un campo descriptivo hoy. Sin esto, "multibodegas" es una lista vacía de nombres, no un control real de inventario.

## Alcance incluido

- `stock_ledger_entries`: un movimiento inmutable por transacción (entrada, salida, traslado, ajuste).
- `stock_valuation_layers`: las capas FIFO reales — de dónde sale el costo cuando hay una salida.
- Vista `stock_balances`: saldo (cantidad y valor) por ítem y bodega, derivado de los movimientos.
- Traslados entre bodegas como un par entrada/salida que comparte un identificador, preservando el costo FIFO al cruzar de bodega.
- Pantalla de movimientos de inventario + kardex por ítem + reporte de saldo por bodega.

## Fuera de alcance

- La integración automática con ventas/compras (que un movimiento de salida se dispare solo al facturar) llega en el Sprint 6. Acá se construye el motor en sí mismo, dejando `voucher_type`/`voucher_id` listos para que el Sprint 6 los use.

## Cambios de esquema (sketch SQL)

```sql
CREATE TYPE public.stock_movement_type AS ENUM ('receipt', 'issue', 'transfer_out', 'transfer_in', 'adjustment');

CREATE TABLE IF NOT EXISTS public.stock_ledger_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT NOT NULL,
    item_id uuid REFERENCES public.items(id) ON DELETE RESTRICT NOT NULL,
    warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE RESTRICT NOT NULL,
    movement_type public.stock_movement_type NOT NULL,
    qty_change numeric(20,4) NOT NULL,       -- positivo en entradas, negativo en salidas
    valuation_rate numeric(20,4) NOT NULL,   -- costo unitario (informado en entradas; recalculado en salidas)
    voucher_type text,
    voucher_id uuid,
    transfer_pair_id uuid,                   -- enlaza transfer_out con su transfer_in
    posting_date date NOT NULL,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.stock_valuation_layers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id uuid REFERENCES public.items(id) NOT NULL,
    warehouse_id uuid REFERENCES public.warehouses(id) NOT NULL,
    stock_ledger_entry_id uuid REFERENCES public.stock_ledger_entries(id) NOT NULL,
    qty_remaining numeric(20,4) NOT NULL,
    rate numeric(20,4) NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE VIEW public.stock_balances AS
SELECT item_id, warehouse_id,
       SUM(qty_change) AS qty_on_hand,
       SUM(qty_change * valuation_rate) AS value_on_hand
FROM public.stock_ledger_entries
GROUP BY item_id, warehouse_id;

-- Consumo FIFO: se ejecuta ANTES del insert para recalcular el costo real de la salida
CREATE OR REPLACE FUNCTION public.consume_fifo_layers()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_remaining numeric(20,4);
  v_layer RECORD;
  v_consumed numeric(20,4);
  v_total_cost numeric(20,4) := 0;
  v_total_qty numeric(20,4) := 0;
BEGIN
  v_remaining := ABS(NEW.qty_change);
  FOR v_layer IN
    SELECT * FROM public.stock_valuation_layers
    WHERE item_id = NEW.item_id AND warehouse_id = NEW.warehouse_id AND qty_remaining > 0
    ORDER BY created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_consumed := LEAST(v_layer.qty_remaining, v_remaining);
    UPDATE public.stock_valuation_layers SET qty_remaining = qty_remaining - v_consumed WHERE id = v_layer.id;
    v_total_cost := v_total_cost + v_consumed * v_layer.rate;
    v_total_qty := v_total_qty + v_consumed;
    v_remaining := v_remaining - v_consumed;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Stock insuficiente para cubrir esta salida (faltan % unidades)', v_remaining;
  END IF;

  NEW.valuation_rate := ROUND(v_total_cost / NULLIF(v_total_qty, 0), 4);
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_consume_fifo_layers
BEFORE INSERT ON public.stock_ledger_entries
FOR EACH ROW WHEN (NEW.qty_change < 0)
EXECUTE FUNCTION public.consume_fifo_layers();

-- Creación de capa: se ejecuta DESPUÉS del insert (recién ahí existe la fila padre para el FK)
CREATE OR REPLACE FUNCTION public.create_fifo_layer()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.stock_valuation_layers (item_id, warehouse_id, stock_ledger_entry_id, qty_remaining, rate)
  VALUES (NEW.item_id, NEW.warehouse_id, NEW.id, NEW.qty_change, NEW.valuation_rate);
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_create_fifo_layer
AFTER INSERT ON public.stock_ledger_entries
FOR EACH ROW WHEN (NEW.qty_change > 0)
EXECUTE FUNCTION public.create_fifo_layer();
```

> Nota de diseño: el consumo (`BEFORE INSERT`) y la creación de capa (`AFTER INSERT`) están deliberadamente separados en dos triggers — si se intenta insertar en `stock_valuation_layers` referenciando `NEW.id` dentro de un trigger `BEFORE`, la fila padre todavía no existe y la foreign key falla. Mantén ese orden.

Para un **traslado entre bodegas**, no insertes ambas filas sueltas: crea una función `create_warehouse_transfer(item_id, from_warehouse, to_warehouse, qty, date)` que primero inserte el `transfer_out` (dejando que el trigger calcule el costo FIFO real), lea ese costo recién calculado, y recién ahí inserte el `transfer_in` en la bodega destino usando ese mismo costo — así el producto no "cambia de precio" solo por moverse de bodega.

## Cambios de UI/backend esperados

- Pantalla "Movimientos de Inventario": formulario por tipo de movimiento (entrada, salida, ajuste, traslado), con selector de ítem y bodega(s).
- "Kardex" por ítem: historial de movimientos con saldo corriente.
- Reporte "Saldo por Bodega": cantidad y valor por ítem, filtrable por bodega, usando la vista `stock_balances`.

## Criterios de aceptación

- [ ] Entrada de 100 unidades a $1.000 y luego salida de 40 unidades calcula el costo de esa salida como $1.000 c/u (consumiendo la capa correspondiente).
- [ ] Un traslado entre bodegas conserva el mismo costo unitario FIFO en la bodega destino.
- [ ] No se puede registrar una salida que deje el saldo de un ítem en negativo en una bodega.
- [ ] El saldo reportado por `stock_balances` siempre coincide con la suma de `qty_remaining` de las capas vigentes.

---

## Prompt listo para pegar en Lovable

```
Necesito un motor real de inventario multibodega — hoy `warehouses` es solo un catálogo, sin movimientos ni saldo.

1. Crea el enum `stock_movement_type` ('receipt', 'issue', 'transfer_out', 'transfer_in', 'adjustment').

2. Crea la tabla `stock_ledger_entries` (id, entity_id, item_id, warehouse_id, movement_type, qty_change numeric positivo/negativo, valuation_rate, voucher_type, voucher_id, transfer_pair_id, posting_date, created_by, created_at).

3. Crea la tabla `stock_valuation_layers` (id, item_id, warehouse_id, stock_ledger_entry_id, qty_remaining, rate, created_at) — son las capas FIFO.

4. Crea la vista `stock_balances` que sume `qty_change` y `qty_change * valuation_rate` agrupado por item_id y warehouse_id.

5. Crea un trigger BEFORE INSERT en `stock_ledger_entries` (solo cuando qty_change < 0) que consuma las capas de `stock_valuation_layers` más antiguas primero (ORDER BY created_at ASC, con FOR UPDATE para evitar condiciones de carrera), descontando `qty_remaining` de cada una hasta cubrir la cantidad de la salida, calcule el costo promedio ponderado real consumido, y lo asigne a `NEW.valuation_rate`. Si no hay stock suficiente, debe lanzar una excepción clara y no dejar registrar la salida.

6. Crea un segundo trigger AFTER INSERT en `stock_ledger_entries` (solo cuando qty_change > 0) que inserte una nueva fila en `stock_valuation_layers` con `qty_remaining = qty_change` y `rate = valuation_rate`. Es importante que sea AFTER y no BEFORE, porque necesita que la fila padre ya exista para la foreign key.

7. Crea una función `create_warehouse_transfer(_item_id uuid, _from_warehouse uuid, _to_warehouse uuid, _qty numeric, _entity_id uuid, _posting_date date)` que inserte primero el movimiento `transfer_out` en la bodega origen (dejando que el trigger calcule el costo FIFO real), lea el `valuation_rate` resultante de esa fila, y luego inserte el `transfer_in` en la bodega destino usando ese mismo costo — ambos movimientos deben compartir un `transfer_pair_id` común.

8. Crea una pantalla "Movimientos de Inventario" con un formulario por tipo de movimiento (entrada, salida, ajuste, traslado usando la función anterior), un "Kardex" por ítem que muestre el historial de movimientos con saldo corriente, y un reporte "Saldo por Bodega" basado en la vista `stock_balances`, filtrable por bodega y por ítem.

9. Aplica RLS multiempresa (mismo patrón `user_has_company_access`) a `stock_ledger_entries`.

Al terminar, documenta en `.md/CHANGELOG.md` y actualiza el módulo de Inventario en `.md/ARQUITECTURA.md` y `.md/MODULOS.md`.
```
