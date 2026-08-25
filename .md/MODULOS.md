# Especificación y Funcionalidad de Módulos - EasyERP (Norma Chilena / CLP)

Este documento describe en detalle cada uno de los módulos operativos integrados en el sistema ERP **EasyERP** adaptado para Chile.

---

## 1. Contabilidad & Multimoneda ([`/accounting`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/accounting.tsx))
* **Catálogo Multimoneda & Reglas Analíticas**:
  * Estructura jerárquica con código numérico (ej. `1.1.01.001`), nombre y tipo de cuenta (`Asset`, `Liability`, `Equity`, `Income`, `Expense`, `Cost of Goods Sold`).
  * Asignación de moneda propia por cuenta (`currency_code`), permitiendo cuentas en USD o divisas extranjeras conviviendo con la moneda base CLP.
  * Reglas de obligatoriedad de imputación analítica: `requires_cost_center` y `requires_business_unit` para forzar la selección de Centro de Costo y Sucursal en cuentas de resultado.
* **Motor de Comprobantes por Partida Doble & Conversión Automática**:
  * Formulario de comprobantes contables con cabecera y tabla de $N$ líneas contables.
  * Imputación analítica por línea: selector de **Centro de Costo** (`cost_center_id`) y **Sucursal / Unidad** (`business_unit_id`).
  * Validación en tiempo real del cuadre de partida doble ($\sum \text{Débitos} = \sum \text{Créditos}$) y asignación de correlativo atómico (`ASI-000001`).
  * **Inmutabilidad estricta y Reversión**: Los comprobantes posteados no admiten modificación directa; se anulan mediante contra-asientos invertidos (`reversal_of`).
  * **Protección de Períodos Cerrados**: Bloqueo automático de posteo para cualquier fecha perteneciente a un período mensual cerrado.

---

## 2. Ventas, Facturación & Cuentas por Cobrar ([`/sales`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/sales.tsx))
* **Ciclo de Facturación Transaccional (`sales_invoices`, `sales_invoice_lines`)**:
  * Emisión de facturas de venta con cálculo automático de **IVA Débito Fiscal (19%)** e importes totales.
  * Selector de cliente, bodega de despacho, centro de costo, sucursal, moneda (CLP, USD) y tasa de cambio.
* **Posteo Automático Integral (`post_sales_invoice`)**:
  * Genera el asiento contable balanceado: Débito a CxC Clientes (`receivable_account_id`), Crédito a Ingresos (`sales_income_account_id`) y Crédito a IVA Débito Fiscal (`output_tax_account_id`).
  * Descuenta de forma automática las existencias de la bodega seleccionada en `stock_ledger_entries` y postea el costo de venta FIFO real (`cogs_account_id` vs `inventory_account_id`).
* **Cobranzas y Antigüedad de Saldos (`invoice_payments`, `sales_invoice_balances`)**:
  * Registro de cobranzas parciales o totales asociadas a la factura y a la cuenta de tesorería/banco correspondiente.
  * Reporte de saldos de clientes y cuentas por cobrar en tiempo real.

---

## 3. Compras, Facturas de Proveedores & Cuentas por Pagar ([`/purchases`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/purchases.tsx))
* **Ciclo Transaccional de Compras (`purchase_invoices`, `purchase_invoice_lines`)**:
  * Registro de facturas de proveedores con discriminación de **IVA Crédito Fiscal (19%)**.
  * Soporte para compra de mercaderías (con SKU e ingreso a bodega) y gastos generales directos.
* **Posteo Automático Integral (`post_purchase_invoice`)**:
  * Genera el asiento contable: Crédito a Proveedores (`payable_account_id`), Débito a IVA Crédito Fiscal (`input_tax_account_id`) y Débito a Inventario (`inventory_account_id`) o Gasto (`purchase_expense_account_id`).
  * Para ítems de stock, ingresa el movimiento en `stock_ledger_entries` y crea la nueva capa de valorización FIFO en `stock_valuation_layers`.
* **Pagos a Proveedores (`invoice_payments`, `purchase_invoice_balances`)**:
  * Control de pagos y saldos adeudados por proveedor en tiempo real.

---

## 4. Inventario & Multibodega ([`/inventory`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/inventory.tsx))
* **Motor de Movimientos de Inventario (`stock_ledger_entries`)**:
  * Registro de entradas (`receipt`), salidas (`issue`), ajustes (`adjustment`) y traslados interbodega.
* **Capas de Valorización FIFO (`stock_valuation_layers`)**:
  * Creación y consumo de capas FIFO con bloqueo estricto de stocks negativos.
* **Traslados Atómicos (`create_warehouse_transfer`)**:
  * Traslado entre bodegas preservando el costo unitario de origen.
* **Saldos en Tiempo Real (`stock_balances`) & Kardex**:
  * Existencias físicas y valorización total por bodega e ítem.

---

## 5. Bancos & Tesorería ([`/cash`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/cash.tsx))
* **Tasas de Cambio Oficiales / Dólar Observado (`exchange_rates`)**:
  * Registro diario del tipo de cambio oficial USD $\rightarrow$ CLP.
* **Libros de Caja & Bancos (`books`)**:
  * Cajas chicas y cuentas bancarias.

---

## 6. Reportes Financieros & Analíticos ([`/reports`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/reports.tsx))
* **Filtros Analíticos**: Segmentación de reportes por Centro de Costo o Sucursal.
* **Balanza de Comprobación, Balance General y Estado de Resultados (P&L)**: Generados en tiempo real desde asientos y facturas.

---

## 7. Configuración General & Cierre de Período ([`/setup`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/setup.tsx))
* **Cuentas Contables Predeterminadas (`company_default_accounts`)**: Mapeo obligatorio de cuentas contables para CxC, CxP, Ventas, Compras, IVA (19%), COGS, Inventario y Diferencia de Cambio No Realizada (Ganancia y Pérdida).
* **Cierre de Períodos Contables (`accounting_periods`, `close_accounting_period`)**: Flujo de validación previa de borradores y cierre de mes que bloquea nuevos posteos.
* **Revalorización Cambiaria de Cierre (`exchange_revaluations`, `run_exchange_revaluation`)**: Ajuste automático del saldo en libros de cuentas en moneda extranjera (USD) contra la tasa de cierre del mes.
* **Empresas (`entities`)**, **Centros de Costo (`cost_centers`)**, **Sucursales (`business_units`)**, **Años Fiscales (`fiscal_years`)**, **Series (`naming_series`)** y **Roles (`roles`)**.
