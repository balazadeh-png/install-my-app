# Sprint 6 — Ciclo Transaccional de Ventas y Compras

**Fase:** 1 — Fundación
**Depende de:** Sprints 1-5 (multiempresa, partida doble, multimoneda, dimensiones, multibodega)
**Bloquea a:** Sprint 7 (cierre — necesita CxC/CxP reales para revalorizar), Sprint 10 (POS reutiliza este motor)

## Objetivo

Convertir Ventas y Compras de simples directorios de terceros en un ciclo transaccional real — factura → posteo automático al mayor → movimiento de inventario → cuenta por cobrar/pagar — respetando todo lo construido en los sprints anteriores (empresa, moneda de cuenta, centro de costo/unidad, FIFO por bodega).

## Por qué (brecha que resuelve)

Hoy `sales.tsx` y `purchases.tsx` solo administran `parties`/`contacts`. No existe ninguna tabla de cotización, orden o factura. Sin este nivel transaccional no hay forma de que el sistema genere automáticamente el asiento de "Cuentas por Cobrar en USD" que describías como caso de uso concreto (facturas de importación/exportación) — hoy eso solo podría hacerse a mano, línea por línea, sin ninguna garantía de que el inventario y el costo de venta queden correctamente reflejados.

## ⚠️ Dependencia crítica: Facturación Electrónica (DTE)

Este sprint construye la **mecánica interna** (tablas, cálculo, posteo automático). La **validez tributaria real** de una factura en Chile exige emitirla como DTE con folio autorizado por el SII (CAF) y firma electrónica. Antes de este sprint, define si vas a integrar un emisor DTE certificado ya existente (más rápido) o construir tu propio flujo de certificación ante el SII (ver sección 3.6 del RoadMap). El prompt de abajo deja el gancho (`invoice_number`, estructura de líneas e impuestos) listo para conectar cualquiera de los dos caminos, pero no emite DTE por sí solo.

## Alcance incluido

- `company_default_accounts`: las cuentas contables por defecto de cada empresa (CxC, CxP, ingreso, gasto, costo de venta, inventario, IVA débito/crédito, diferencia de cambio) — de aquí toma las cuentas la función de posteo automático.
- `sales_invoices` / `sales_invoice_lines` y `purchase_invoices` / `purchase_invoice_lines`.
- Función `post_sales_invoice(id)` / `post_purchase_invoice(id)`: genera el comprobante contable completo (cliente/proveedor, ingreso/gasto, IVA, costo de venta e inventario si el ítem es de stock) respetando moneda, centro de costo y unidad de la factura.
- `invoice_payments`: aplicación de pagos a una o varias facturas (para CxC/CxP real, no solo un estado binario "pagado/no pagado").
- Vista de saldos pendientes (aging) por tercero.

## Fuera de alcance

- Cotizaciones y órdenes previas a la factura (se puede agregar como extensión menor una vez que la factura funcione — no es bloqueante para tener un ERP operativo).
- Emisión real de DTE ante el SII (ver la dependencia crítica arriba).

## Cambios de esquema (sketch — este es el sprint más grande de la Fase 1; usa esto como guía de forma, no como migración final a pegar tal cual)

```sql
CREATE TABLE IF NOT EXISTS public.company_default_accounts (
    entity_id uuid PRIMARY KEY REFERENCES public.entities(id) ON DELETE CASCADE,
    receivable_account_id uuid REFERENCES public.accounts(id),
    payable_account_id uuid REFERENCES public.accounts(id),
    sales_income_account_id uuid REFERENCES public.accounts(id),
    purchase_expense_account_id uuid REFERENCES public.accounts(id),
    cogs_account_id uuid REFERENCES public.accounts(id),
    inventory_account_id uuid REFERENCES public.accounts(id),
    output_tax_account_id uuid REFERENCES public.accounts(id),  -- IVA Débito Fiscal
    input_tax_account_id uuid REFERENCES public.accounts(id),   -- IVA Crédito Fiscal
    realized_exchange_gain_account_id uuid REFERENCES public.accounts(id),
    realized_exchange_loss_account_id uuid REFERENCES public.accounts(id),
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TYPE public.invoice_status AS ENUM ('draft', 'confirmed', 'partially_paid', 'paid', 'cancelled');

CREATE TABLE IF NOT EXISTS public.sales_invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) NOT NULL,
    party_id uuid REFERENCES public.parties(id) NOT NULL,
    warehouse_id uuid REFERENCES public.warehouses(id),
    cost_center_id uuid REFERENCES public.cost_centers(id),
    business_unit_id uuid REFERENCES public.business_units(id),
    currency_code text REFERENCES public.currencies(code) NOT NULL,
    exchange_rate numeric(20,9) DEFAULT 1,
    invoice_number text,
    issue_date date NOT NULL,
    due_date date,
    subtotal_amount numeric(20,4),
    tax_amount numeric(20,4),
    total_amount numeric(20,4),
    status public.invoice_status NOT NULL DEFAULT 'draft',
    journal_entry_id uuid REFERENCES public.journal_entries(id),
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.sales_invoice_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_invoice_id uuid REFERENCES public.sales_invoices(id) ON DELETE CASCADE NOT NULL,
    item_id uuid REFERENCES public.items(id),
    warehouse_id uuid REFERENCES public.warehouses(id),
    description text,
    qty numeric(20,4) NOT NULL DEFAULT 1,
    unit_price numeric(20,4) NOT NULL,
    tax_rate numeric(6,3) DEFAULT 19,
    line_total numeric(20,4) GENERATED ALWAYS AS (qty * unit_price) STORED
);

-- purchase_invoices / purchase_invoice_lines: mismo patrón, usando payable_account_id / input_tax_account_id

CREATE TABLE IF NOT EXISTS public.invoice_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) NOT NULL,
    sales_invoice_id uuid REFERENCES public.sales_invoices(id),
    purchase_invoice_id uuid REFERENCES public.purchase_invoices(id),
    amount numeric(20,4) NOT NULL,
    currency_code text REFERENCES public.currencies(code) NOT NULL,
    payment_date date NOT NULL,
    bank_account_id uuid REFERENCES public.accounts(id) NOT NULL,
    journal_entry_id uuid REFERENCES public.journal_entries(id),
    CONSTRAINT ck_one_invoice_type CHECK (
      (sales_invoice_id IS NOT NULL AND purchase_invoice_id IS NULL) OR
      (sales_invoice_id IS NULL AND purchase_invoice_id IS NOT NULL)
    )
);

CREATE VIEW public.sales_invoice_balances AS
SELECT si.id, si.entity_id, si.party_id, si.total_amount,
       COALESCE(SUM(ip.amount), 0) AS paid,
       si.total_amount - COALESCE(SUM(ip.amount), 0) AS balance_due
FROM public.sales_invoices si
LEFT JOIN public.invoice_payments ip ON ip.sales_invoice_id = si.id
GROUP BY si.id;
```

**Lógica de `post_sales_invoice(id)`** (que Lovable debe construir e iterar con pruebas reales — es la función más delicada de todo el roadmap):
1. Sumar las líneas para obtener `subtotal_amount`, `tax_amount`, `total_amount` y guardarlos en la factura.
2. Crear la cabecera en `journal_entries` (borrador).
3. Línea débito al cliente por `total_amount`, en `receivable_account_id`, en la moneda de la factura, con el centro de costo/unidad de la factura — el trigger del Sprint 3 resuelve la conversión a moneda funcional.
4. Línea crédito a `sales_income_account_id` por el subtotal, y otra a `output_tax_account_id` por el IVA.
5. Por cada línea con `item_id` (ítem de stock): insertar la salida correspondiente en `stock_ledger_entries` (el trigger del Sprint 5 calcula el costo FIFO real) y agregar al mismo comprobante el par Costo de Venta (débito) / Inventario (crédito) usando ese costo.
6. Postear el comprobante (`post_journal_entry`) y marcar la factura como `confirmed`.

`post_purchase_invoice` es el espejo: crédito a proveedor, débito a gasto/inventario según corresponda, IVA crédito fiscal.

## Cambios de UI/backend esperados

- `setup.tsx`: pantalla para configurar `company_default_accounts` por empresa (obligatoria antes de poder facturar).
- `sales.tsx` / `purchases.tsx`: pasan de ser solo un directorio a incluir un módulo de facturación completo — alta de factura con líneas, selector de moneda/centro de costo/unidad, botón "Confirmar y Postear".
- Reporte de Cuentas por Cobrar / Cuentas por Pagar con antigüedad de saldos (usando `sales_invoice_balances` / su equivalente de compras).

## Criterios de aceptación

- [ ] Al confirmar una factura de venta se genera automáticamente un comprobante balanceado en el mayor, sin intervención manual.
- [ ] Una factura de venta en USD a un cliente extranjero genera la línea de CxC en USD, convertida correctamente a la moneda funcional de la empresa.
- [ ] Vender un ítem de stock descuenta la bodega indicada y postea el costo de venta real (FIFO), no un estimado.
- [ ] El reporte de CxC muestra el saldo pendiente real de cada factura tras aplicar los pagos registrados.

---

## Prompt listo para pegar en Lovable

```
Ventas y Compras hoy solo administran clientes/proveedores — no existen facturas. Necesito construir el ciclo completo, en dos etapas dentro de esta misma tarea:

ETAPA A — Esquema y configuración
1. Crea `company_default_accounts` (una fila por empresa) con las cuentas por defecto: receivable_account_id, payable_account_id, sales_income_account_id, purchase_expense_account_id, cogs_account_id, inventory_account_id, output_tax_account_id (IVA Débito), input_tax_account_id (IVA Crédito), realized_exchange_gain_account_id, realized_exchange_loss_account_id — todas FK a `accounts`.
2. Crea el enum `invoice_status` ('draft','confirmed','partially_paid','paid','cancelled').
3. Crea `sales_invoices` (entity_id, party_id, warehouse_id, cost_center_id, business_unit_id, currency_code, exchange_rate, invoice_number, issue_date, due_date, subtotal_amount, tax_amount, total_amount, status, journal_entry_id) y `sales_invoice_lines` (sales_invoice_id, item_id, warehouse_id, description, qty, unit_price, tax_rate default 19, line_total generado).
4. Crea el espejo para compras: `purchase_invoices` y `purchase_invoice_lines` (mismos campos, usando payable_account_id / input_tax_account_id).
5. Crea `invoice_payments` (entity_id, sales_invoice_id o purchase_invoice_id -exactamente uno de los dos-, amount, currency_code, payment_date, bank_account_id, journal_entry_id).
6. Crea la vista `sales_invoice_balances` (y su equivalente de compras) que reste los pagos aplicados del total de cada factura para mostrar el saldo pendiente.

ETAPA B — Posteo automático
7. Crea la función `post_sales_invoice(_invoice_id uuid)`: calcula subtotal/impuesto/total desde las líneas y los guarda en la factura; crea la cabecera del comprobante en `journal_entries`; agrega la línea de cliente (débito, cuenta = receivable_account_id de la empresa, en la moneda de la factura, con el centro de costo/unidad de la factura); agrega la línea de ingreso (crédito a sales_income_account_id) y de IVA débito (crédito a output_tax_account_id); para cada línea con item_id, inserta la salida correspondiente en stock_ledger_entries (ya existe el trigger que calcula el costo FIFO real) y agrega al mismo comprobante el costo de venta (débito a cogs_account_id) contra inventario (crédito a inventory_account_id) usando ese costo real; finalmente llama a post_journal_entry() y marca la factura como 'confirmed'.
8. Crea `post_purchase_invoice(_invoice_id uuid)` como el espejo: crédito a proveedor (payable_account_id), débito a gasto o inventario según si el ítem es de stock, e IVA crédito fiscal (input_tax_account_id).
9. En `setup.tsx`, agrega una pantalla para configurar `company_default_accounts` de la empresa activa (debe completarse antes de poder confirmar cualquier factura — valida esto y muestra un mensaje claro si falta).
10. En `sales.tsx`, agrega un módulo de facturación: alta de factura con selector de tercero, moneda, centro de costo/unidad y bodega, líneas de detalle (ítem, cantidad, precio, impuesto), y un botón "Confirmar y Postear" que llame a `post_sales_invoice`. Igual para `purchases.tsx` con `post_purchase_invoice`.
11. Agrega un reporte de Cuentas por Cobrar y Cuentas por Pagar con antigüedad de saldos, basado en las vistas de saldo pendiente.

Aplica RLS multiempresa a todas las tablas nuevas. Al terminar, documenta en `.md/CHANGELOG.md` y actualiza `.md/ARQUITECTURA.md` y `.md/MODULOS.md` con el nuevo ciclo de facturación.
```
