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

## 3. Punto de Venta (POS) & Boletas ([`/pos`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/pos.tsx))
* **Turnos y Arqueo de Caja (`pos_sessions`, `close_pos_session`)**:
  * Apertura de turno con bodega asignada y fondo inicial de sencillo en gaveta.
  * Cierre de turno con arqueo de caja: cálculo automático del efectivo esperado ($ \text{Fondo Inicial} + \text{Ventas Efectivo} $), ingreso del efectivo contado físicamente y detección en vivo de sobrantes o faltantes.
* **Terminal de Venta Rápida de Mostrador**:
  * Búsqueda ágil de artículos, visualización de precios y disponibilidad.
  * Carrito de venta con discriminación de IVA 19% y emisión de boletas correlativas (`BOL-000001`).
* **Medios de Pago Mixtos (`pos_sale_payment_lines`, `create_pos_sale`)**:
  * Cobro dividido en múltiples medios: Efectivo, Tarjeta Débito (Redcompra), Tarjeta Crédito, Transferencias.
  * Cálculo de vuelto en efectivo y posteo automático e instantáneo tanto al Libro Mayor como al inventario FIFO de la bodega.

---

## 4. Declaraciones Juradas SII — DDJJ ([`/declaraciones-juradas`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/declaraciones-juradas.tsx))
* **Motor Extensible de Declaraciones Juradas (`dj_definitions`, `dj_field_mappings`, `dj_generations`)**:
  * Catálogo dinámico de formularios oficiales: **DJ 1879** (Honorarios), **DJ 1887** (Sueldos y Retenciones 2da Categoría), **DJ 1947** (Renta Atribuida / Pro Pyme Transparente 14 D8).
  * Posibilidad de crear y registrar nuevas definiciones de DJ con esquemas de campos personalizados (`field_schema`) sin modificar código.
  * **Mapeo por Empresa**: Asignación flexible de qué cuenta del plan contable alimenta cada casilla oficial.
  * **Generación Automática & Exportación CSV**: Extracción anual de saldos y partidas con exportación para carga en el SII.

---

## 5. Declaración de Impuestos SII — F29 / F22 ([`/taxes`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/taxes.tsx))
* **Formulario 29 (F29 Mensual - IVA y PPM)**:
  * Cálculo automático de IVA Débito Fiscal 19% (ventas y boletas) y Crédito Fiscal 19% (compras).
  * Arrastre y aplicación automática del Remanente de Crédito Fiscal del mes anterior.
  * Cálculo del Pago Provisional Mensual (**PPM Obligatorio**) según la tasa configurada de la empresa.
  * Liquidación del total a pagar o nuevo remanente.
* **Formulario 22 (F22 Anual - Renta e Impuesto de Primera Categoría)**:
  * Determinación de la Renta Líquida Imponible (RLI) a partir de ingresos, costos y gastos.
  * Aplicación de tasas según el régimen tributario de la empresa (14A General, 14 D3 Pro Pyme General, 14 D8 Transparente).
  * Rebaja de los PPMs pagados durante los 12 meses para determinar el saldo a pagar o a devolución.

---

## 6. Libros Legales SII & Conciliación RCV ([`/sii-books`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/sii-books.tsx))
* **Generación de Libros Contables Oficiales**:
  * **Libro Diario Legal**: Cronología de comprobantes, cuentas, glosas y partidas balanceadas.
  * **Libro Mayor Legal**: Movimientos débitos, créditos y saldos acumulados por cuenta.
  * **Balance Tributario de 8 Columnas**: Sumas del Mayor (Débito/Crédito), Saldos (Deudor/Acreedor), Inventario (Activo/Pasivo) y Resultados (Pérdida/Ganancia).
  * **Libro de Ventas y Libro de Compras**: Detalle de documentos DTE, RUT contraparte, Razón Social, Monto Neto, IVA 19% y Total.
  * Exportación instantánea a formato **CSV / Excel**.
* **Cruce & Conciliación con el Registro de Compras y Ventas (RCV)**:
  * Herramienta de cruce contra el informe oficial del portal SII (`reconcile_rcv_batch`).

---

## 7. Compras, Facturas de Proveedores & Cuentas por Pagar ([`/purchases`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/purchases.tsx))
* **Ciclo Transaccional de Compras (`purchase_invoices`, `purchase_invoice_lines`)**:
  * Registro de facturas de proveedores con discriminación de **IVA Crédito Fiscal (19%)**.
  * Soporte para compra de mercaderías (con SKU e ingreso a bodega) y gastos generales directos.
* **Posteo Automático Integral (`post_purchase_invoice`)**:
  * Genera el asiento contable: Crédito a Proveedores (`payable_account_id`), Débito a IVA Crédito Fiscal (`input_tax_account_id`) y Débito a Inventario (`inventory_account_id`) o Gasto (`purchase_expense_account_id`).
  * Para ítems de stock, ingresa el movimiento en `stock_ledger_entries` y crea la nueva capa de valorización FIFO en `stock_valuation_layers`.
* **Pagos a Proveedores (`invoice_payments`, `purchase_invoice_balances`)**:
  * Control de pagos y saldos adeudados por proveedor en tiempo real.

---

## 8. Producción Simple & Recetas BOM ([`/production`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/production.tsx))
* **Lista de Materiales y Fórmulas (`bill_of_materials`, `bom_lines`)**:
  * Definición de recetas para productos terminados con rendimientos base e insumos/materias primas requeridas.
* **Órdenes de Producción Transaccionales (`production_orders`, `complete_production_order`)**:
  * Lanzamiento de órdenes especificando cantidad a fabricar, bodega de origen de materias primas y bodega destino del producto terminado.
  * Consumo automático de insumos en capas FIFO desde la bodega de origen y cálculo del costo real total acumulado.
  * Ingreso del producto terminado en la bodega destino valorizado exactamente al costo unitario real resultante ($ \text{Costo Total Consumido} / \text{Cantidad Producida} $).

---

## 9. Activos Fijos & Depreciación ([`/assets`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/assets.tsx))
* **Ficha Maestra de Activo Fijo (`fixed_assets`)**:
  * Registro de bienes de uso con costo histórico en CLP, valor residual, vida útil en meses, método de amortización, centro de costo y sucursal.
  * Mapeo de cuentas: Activo, Depreciación Acumulada y Gasto por Depreciación.
* **Depreciación Mensual Automática (`run_monthly_depreciation`, `fixed_asset_depreciation_entries`)**:
  * Métodos de cálculo: **Línea Recta** y **Acelerada (1/3 Vida Útil)** bajo normativa chilena SII.
  * Generación y posteo automático de los comprobantes de diario al Libro Mayor.
* **Bajas y Disposición de Activos (`dispose_fixed_asset`)**:
  * Reversión de depreciación acumulada, descargo de costo histórico y reconocimiento de Ganancia o Pérdida en Venta.

---

## 10. Inventario & Multibodega ([`/inventory`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/inventory.tsx))
* **Motor de Movimientos de Inventario (`stock_ledger_entries`)**:
  * Registro de entradas (`receipt`), salidas (`issue`), ajustes (`adjustment`) y traslados interbodega.
* **Capas de Valorización FIFO (`stock_valuation_layers`)**:
  * Creación y consumo de capas FIFO con bloqueo estricto de stocks negativos.
* **Traslados Atómicos (`create_warehouse_transfer`)**:
  * Traslado entre bodegas preservando el costo unitario de origen.
* **Saldos en Tiempo Real (`stock_balances`) & Kardex**:
  * Existencias físicas y valorización total por bodega e ítem.

---

## 11. Bancos & Tesorería ([`/cash`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/cash.tsx))
* **Tasas de Cambio Oficiales / Dólar Observado (`exchange_rates`)**:
  * Registro diario del tipo de cambio oficial USD $\rightarrow$ CLP.
* **Libros de Caja & Bancos (`books`)**:
  * Cajas chicas y cuentas bancarias.

---

## 12. Reportes Financieros & Analíticos ([`/reports`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/reports.tsx))
* **Filtros Analíticos**: Segmentación de reportes por Centro de Costo o Sucursal.
* **Balanza de Comprobación, Balance General y Estado de Resultados (P&L)**: Generados en tiempo real desde asientos y facturas.

---

## 13. Configuración General & Cierre de Período ([`/setup`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/setup.tsx))
* **Cuentas Contables Predeterminadas (`company_default_accounts`)**: Mapeo obligatorio de cuentas contables para CxC, CxP, Ventas, Compras, IVA (19%), COGS, Inventario y Diferencia de Cambio No Realizada.
* **Cierre de Períodos Contables (`accounting_periods`, `close_accounting_period`)**: Flujo de validación previa de borradores y cierre de mes que bloquea nuevos posteos.
* **Revalorización Cambiaria de Cierre (`exchange_revaluations`, `run_exchange_revaluation`)**: Ajuste automático del saldo en libros de cuentas en moneda extranjera (USD) contra la tasa de cierre del mes.
* **Empresas (`entities`)**, **Centros de Costo (`cost_centers`)**, **Sucursales (`business_units`)**, **Años Fiscales (`fiscal_years`)**, **Series (`naming_series`)** y **Roles (`roles`)**.
