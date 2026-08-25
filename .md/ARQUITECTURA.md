# Arquitectura del Sistema - EasyERP

## 1. Visión y Alcance
Sistema ERP para contabilidad y gestión administrativa enfocado en empresas en Chile bajo normativa contable IFRS / IFRS Pymes. Soporta operación multiempresa con aislamiento estricto de datos (RLS), motor de comprobantes contables con partida doble estricta e inmutabilidad, soporte **multimoneda a nivel de cuenta** (cuentas en USD, EUR, etc. coexistiendo con la moneda funcional base CLP), **dimensiones analíticas jerárquicas (Centros de Costo y Sucursales/Unidades)**, **inventario multibodega con valorización por capas FIFO reales**, **ciclo transaccional de facturación de ventas y compras con posteo automático a contabilidad e inventario**, **cierre formal de períodos mensuales y revalorización cambiaria automática**, **módulo de activos fijos con depreciación mensual automática y bajas**, **módulo de producción simple con recetas BOM y costeo real de materiales**, libros contables, identificación tributaria mediante **RUT** y control de cuentas por cobrar y pagar.

## 2. Stack Tecnológico
* **Frontend & SSR**: React 19, TanStack Start, TanStack Router (file-based routing), TanStack Query.
* **Estilos**: Tailwind CSS v4 con variables semánticas en OKLCH, shadcn/ui y Lucide Icons.
* **Backend**: Server Functions en TanStack Start, middleware de validación y autenticación.
* **Base de Datos & Auth**: Supabase (PostgreSQL), políticas de Row Level Security (RLS), funciones `SECURITY DEFINER` (`public.has_role()`, `public.user_has_company_access()`, `public.post_journal_entry()`, `public.reverse_journal_entry()`, `public.get_exchange_rate()`, `public.create_warehouse_transfer()`, `public.post_sales_invoice()`, `public.post_purchase_invoice()`, `public.run_exchange_revaluation()`, `public.close_accounting_period()`, `public.run_monthly_depreciation()`, `public.dispose_fixed_asset()`, `public.complete_production_order()`).

## 3. Modelo de Datos
* **Seguridad & Roles Multiempresa**:
  * `company_users`: Asignación de usuario $\leftrightarrow$ empresa $\leftrightarrow$ rol en esa empresa (`user_id`, `entity_id`, `role`, `is_default`).
  * `profiles`: Datos de usuario con `active_entity_id` (empresa activa) y zona horaria `America/Santiago`.
  * `user_has_company_access(_user_id, _entity_id)`: Función de seguridad para evaluar pertenencia y permisos en RLS.
  * `app_role` (`admin`, `accountant`, `sales`, `purchasing`, `inventory`, `viewer`).
* **Configuración Contable & Dimensiones Analíticas**:
  * `entities`: Empresas con `base_currency_code` (FK a `currencies.code`), RUT y razón social.
  * `company_default_accounts`: Mapeo de cuentas contables predeterminadas por empresa.
  * `cost_centers`: Centros de costo jerárquicos (`parent_id`, `is_group`) aislados por `entity_id`.
  * `business_units`: Unidades de negocio / sucursales jerárquicas (`parent_id`, `is_group`) aisladas por `entity_id`.
  * `currencies`: Monedas disponibles (`CLP`, `USD`, etc.).
  * `exchange_rates`: Tasas oficiales (USD/CLP - Dólar Observado) con búsqueda y validación estricta por fecha.
* **Motor Contable de Partida Doble & Multimoneda**:
  * `accounts`: Plan de cuentas jerárquico con `currency_code` y reglas analíticas (`requires_cost_center`, `requires_business_unit`).
  * `journal_entries`: Cabecera de comprobante con inmutabilidad y soporte de reversión.
  * `journal_entry_lines`: Detalle de partidas con moneda, tipo de cambio, CC, Sucursal, `skip_currency_resolution` y montos funcionales.
  * `post_journal_entry()`: Valida partida doble, valida que la fecha no pertenezca a un período cerrado y postea.
* **Producción Simple & Fórmulas (BOM)**:
  * `bill_of_materials` y `bom_lines`: Fórmulas de fabricación que definen insumos requeridos y rendimiento de producto terminado.
  * `production_orders`: Órdenes de fabricación con bodegas de origen y destino.
  * `complete_production_order()`: Consume materiales vía FIFO, calcula el costo total consumido e ingresa el producto terminado con su costo unitario real.
* **Activos Fijos & Depreciación**:
  * `fixed_assets`: Ficha maestra de bienes de uso con vida útil en meses, método (Línea Recta / Acelerada), costo histórico y cuentas contables mapeadas.
  * `fixed_asset_depreciation_entries`: Registro único por activo y período mensual con su respectivo comprobante contable asociado.
  * `run_monthly_depreciation()` y `dispose_fixed_asset()`.
* **Cierre de Período & Revalorización Cambiaria**:
  * `accounting_periods`, `exchange_revaluations`, `run_exchange_revaluation()`, `close_accounting_period()`.
* **Facturación Transaccional & Cobranzas / Pagos**:
  * `sales_invoices` / `sales_invoice_lines` y `purchase_invoices` / `purchase_invoice_lines`.
  * `post_sales_invoice()` y `post_purchase_invoice()`.
  * `invoice_payments`, `sales_invoice_balances` y `purchase_invoice_balances`.
* **Inventario & Motor FIFO Multibodega**:
  * `items`, `warehouses`, `stock_ledger_entries`, `stock_valuation_layers`, `stock_balances`.
  * Triggers `trg_consume_fifo_layers` y `trg_create_fifo_layer`.
  * Función `create_warehouse_transfer()`.
* **Terceros**: `parties` (con RUT y `entity_id`), `contacts`, `addresses`.
