# Sprint 10 — Ventas POS

**Fase:** 2 — Módulos Ampliados
**Depende de:** Sprint 6 (motor de facturación — POS lo reutiliza en vez de duplicarlo), Sprint 5 (multibodega)

## Objetivo

Punto de venta rápido con turnos de caja y arqueo, que reutiliza el motor de facturación del Sprint 6 en vez de construir un segundo camino de posteo contable paralelo.

## Por qué

No existe ningún módulo de caja/POS hoy. La clave de diseño acá es **no duplicar** la lógica de facturación: una venta POS es, en el fondo, una factura (boleta) con una interfaz de captura rápida y asociada a un turno de caja — así que se apoya en `sales_invoices` y `post_sales_invoice` del Sprint 6, agregando solo lo que es específico de operar una caja física: apertura, cierre, arqueo y medios de pago mixtos.

## Alcance incluido

- `pos_sessions`: turno de caja (apertura, cierre, usuario, bodega/sucursal, diferencia de arqueo).
- `sales_invoices` gana `pos_session_id` (nullable — una venta normal no lo lleva, una venta POS sí).
- `pos_sale_payment_lines`: permite que una venta se pague con más de un medio (parte efectivo, parte tarjeta).
- Función `close_pos_session(session_id, counted_amount)`: calcula el efectivo esperado y la diferencia contra lo contado físicamente.

## Fuera de alcance

- Emisión de boleta electrónica real ante el SII — depende de la misma decisión DTE marcada en el Sprint 6.
- Múltiples cajas físicas abiertas simultáneamente en la misma bodega con el mismo usuario (se asume 1 turno activo por usuario/bodega a la vez).

## Cambios de esquema (sketch SQL)

```sql
CREATE TYPE public.pos_session_status AS ENUM ('open', 'closed');
CREATE TYPE public.payment_method AS ENUM ('efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia', 'otro');

CREATE TABLE IF NOT EXISTS public.pos_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) NOT NULL,
    warehouse_id uuid REFERENCES public.warehouses(id) NOT NULL,
    business_unit_id uuid REFERENCES public.business_units(id),
    opened_by uuid REFERENCES auth.users(id) NOT NULL,
    opening_amount numeric(20,4) NOT NULL DEFAULT 0,
    opened_at timestamptz DEFAULT now() NOT NULL,
    closing_amount numeric(20,4),
    closed_at timestamptz,
    expected_amount numeric(20,4),
    cash_difference numeric(20,4),
    status public.pos_session_status DEFAULT 'open'
);

ALTER TABLE public.sales_invoices ADD COLUMN IF NOT EXISTS pos_session_id uuid REFERENCES public.pos_sessions(id);

CREATE TABLE IF NOT EXISTS public.pos_sale_payment_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_invoice_id uuid REFERENCES public.sales_invoices(id) NOT NULL,
    payment_method public.payment_method NOT NULL,
    amount numeric(20,4) NOT NULL
);
```

**Lógica de `close_pos_session(session_id, counted_amount)`:** suma `opening_amount` más el total de `pos_sale_payment_lines` con `payment_method = 'efectivo'` de las ventas asociadas a esa sesión → `expected_amount`; guarda `closing_amount = counted_amount`, `cash_difference = counted_amount - expected_amount`, y marca la sesión `closed`.

## Cambios de UI/backend esperados

- Pantalla "Punto de Venta": buscador rápido de ítems, carrito, selector de uno o más medios de pago, botón "Cobrar" que arma la `sales_invoice` (con `pos_session_id` de la sesión activa) y llama a `post_sales_invoice` del Sprint 6.
- Pantalla "Apertura de Caja" (monto inicial) y "Cierre de Caja" (ingreso del monto contado, muestra el esperado y la diferencia antes de confirmar el cierre).

## Criterios de aceptación

- [ ] No se puede vender por POS sin una sesión de caja abierta.
- [ ] Cada venta POS descuenta inventario y postea al mayor exactamente igual que una factura normal, solo que además queda asociada a la sesión de caja.
- [ ] Una venta puede pagarse con más de un medio de pago simultáneamente, y la suma debe coincidir con el total de la venta.
- [ ] Cerrar la caja muestra correctamente el efectivo esperado vs. el contado, y registra la diferencia.

---

## Prompt listo para pegar en Lovable

```
Necesito un módulo de Ventas POS que reutilice el motor de facturación ya construido (`sales_invoices` + `post_sales_invoice`) en vez de duplicar la lógica de posteo contable.

1. Crea los enums `pos_session_status` ('open','closed') y `payment_method` ('efectivo','tarjeta_debito','tarjeta_credito','transferencia','otro').

2. Crea `pos_sessions` (entity_id, warehouse_id, business_unit_id, opened_by, opening_amount, opened_at, closing_amount, closed_at, expected_amount, cash_difference, status).

3. Agrega la columna `pos_session_id` (nullable, FK a pos_sessions) a `sales_invoices`.

4. Crea `pos_sale_payment_lines` (sales_invoice_id, payment_method, amount) — permite que una venta se pague con más de un medio.

5. Crea la función `close_pos_session(_session_id uuid, _counted_amount numeric)`: calcula `expected_amount` como la suma de `opening_amount` más el total de `pos_sale_payment_lines` con método 'efectivo' de las ventas de esa sesión, guarda `closing_amount = _counted_amount`, calcula `cash_difference`, y marca la sesión como 'closed'. Debe fallar si la sesión ya estaba cerrada.

6. Crea una pantalla "Apertura de Caja" (elige bodega/sucursal, ingresa el monto inicial, crea la sesión) y "Cierre de Caja" (ingresa el monto contado, muestra el esperado y la diferencia antes de confirmar).

7. Crea una pantalla "Punto de Venta": requiere una sesión de caja abierta del usuario actual; permite buscar ítems y armarlos en un carrito, elegir uno o más medios de pago (validando que la suma de los pagos sea igual al total), y al confirmar crea la `sales_invoice` correspondiente con `pos_session_id` de la sesión activa, sus `pos_sale_payment_lines`, y llama a `post_sales_invoice` (del módulo de Ventas) para postear todo automáticamente al mayor y descontar inventario.

Aplica RLS multiempresa. Al terminar, documenta en `.md/CHANGELOG.md` y agrega el módulo a `.md/MODULOS.md` y `.md/ARQUITECTURA.md`.
```
