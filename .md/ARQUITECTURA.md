# Arquitectura del Sistema - EasyERP

## 1. Visión y Alcance
Sistema ERP integral para contabilidad y gestión administrativa enfocado en empresas en Chile bajo normativa contable IFRS / IFRS Pymes. Soporta operación multiempresa con aislamiento estricto de datos (RLS), motor de comprobantes contables con partida doble estricta e inmutabilidad, soporte **multimoneda a nivel de cuenta** (cuentas en USD, EUR, etc. coexistiendo con la moneda funcional base CLP), **dimensiones analíticas jerárquicas (Centros de Costo y Sucursales/Unidades)**, **inventario multibodega con valorización por capas FIFO reales**, **ciclo transaccional de facturación de ventas y compras con posteo automático a contabilidad e inventario**, **terminal de Punto de Venta (POS) con boletas y arqueo de caja**, **motor extensible de Declaraciones Juradas del SII (DJ 1879, DJ 1887, DJ 1947, etc.)**, **motor tributario para Formulario 29 (IVA/PPM mensual) y Formulario 22 (Renta anual)**, **generación de libros contables oficiales para el SII (Diario, Mayor, Balance 8 Columnas) y conciliación contra el Registro de Compras y Ventas (RCV)**, **cierre formal de períodos mensuales y revalorización cambiaria automática**, **módulo de activos fijos con depreciación mensual automática y bajas**, **módulo de producción simple con recetas BOM y costeo real de materiales**, identificación tributaria mediante **RUT** y control de cuentas por cobrar y pagar.

## 2. Stack Tecnológico
* **Frontend & SSR**: React 19, TanStack Start, TanStack Router (file-based routing), TanStack Query.
* **Estilos**: Tailwind CSS v4 con variables semánticas en OKLCH, shadcn/ui y Lucide Icons.
* **Backend**: Server Functions en TanStack Start, middleware de validación y autenticación.
* **Base de Datos & Auth**: Supabase (PostgreSQL), políticas de Row Level Security (RLS), funciones `SECURITY DEFINER` (`public.has_role()`, `public.user_has_company_access()`, `public.post_journal_entry()`, `public.reverse_journal_entry()`, `public.get_exchange_rate()`, `public.create_warehouse_transfer()`, `public.post_sales_invoice()`, `public.post_purchase_invoice()`, `public.run_exchange_revaluation()`, `public.close_accounting_period()`, `public.run_monthly_depreciation()`, `public.dispose_fixed_asset()`, `public.complete_production_order()`, `public.create_pos_sale()`, `public.close_pos_session()`, `public.get_sii_book_data()`, `public.reconcile_rcv_batch()`, `public.calculate_f29()`, `public.calculate_f22()`, `public.update_tax_run_status()`, `public.generate_dj()`, `public.update_dj_status()`).

## 3. Modelo de Datos
* **Seguridad & Roles Multiempresa**:
  * `company_users`: Asignación de usuario $\leftrightarrow$ empresa $\leftrightarrow$ rol en esa empresa (`user_id`, `entity_id`, `role`, `is_default`).
  * `profiles`: Datos de usuario con `active_entity_id` (empresa activa) y zona horaria `America/Santiago`.
  * `user_has_company_access(_user_id, _entity_id)`: Función de seguridad para evaluar pertenencia y permisos en RLS.
  * `app_role` (`admin`, `accountant`, `sales`, `purchasing`, `inventory`, `viewer`).
* **Configuración Contable & Dimensiones Analíticas**:
  * `entities`: Empresas con `base_currency_code`, `ppm_rate`, `tax_regime`, RUT y razón social.
  * `company_default_accounts`: Mapeo de cuentas contables predeterminadas por empresa.
  * `cost_centers`: Centros de costo jerárquicos (`parent_id`, `is_group`) aislados por `entity_id`.
  * `business_units`: Unidades de negocio / sucursales jerárquicas (`parent_id`, `is_group`) aislados por `entity_id`.
  * `currencies`: Monedas disponibles (`CLP`, `USD`, etc.).
  * `exchange_rates`: Tasas oficiales (USD/CLP - Dólar Observado) con búsqueda y validación estricta por fecha.
* **Motor Contable de Partida Doble & Multimoneda**:
  * `accounts`: Plan de cuentas jerárquico con `currency_code` y reglas analíticas (`requires_cost_center`, `requires_business_unit`).
  * `journal_entries`: Cabecera de comprobante con inmutabilidad y soporte de reversión.
  * `journal_entry_lines`: Detalle de partidas con moneda, tipo de cambio, CC, Sucursal, `skip_currency_resolution` y montos funcionales.
  * `post_journal_entry()`: Valida partida doble, valida que la fecha no pertenezca a un período cerrado y postea.
* **Declaraciones Juradas SII (DDJJ)**:
  * `dj_definitions`: Catálogo extensible con esquema de campos jsonb (`field_schema`).
  * `dj_field_mappings`: Mapeo de cada casilla oficial a una cuenta del plan contable por empresa.
  * `dj_generations`: Liquidaciones anuales con flujo `draft` $\rightarrow$ `reviewed` $\rightarrow$ `filed`.
  * `generate_dj()` y `update_dj_status()`.
* **Declaración de Impuestos SII (F29 / F22)**:
  * `tax_calculation_runs`: Liquidaciones estructuradas con estados `draft` $\rightarrow$ `reviewed` $\rightarrow$ `filed`.
  * `tax_adjustments`: Agregados y deducciones para la RLI del F22.
  * `calculate_f29()` y `calculate_f22()`.
* **Libros Legales SII & Conciliación RCV**:
  * `sii_book_exports`, `rcv_reconciliation_runs` y `rcv_reconciliation_items`.
  * `get_sii_book_data()` y `reconcile_rcv_batch()`.
* **Punto de Venta (POS) & Medios de Pago Mixtos**:
  * `pos_sessions`, `pos_sale_payment_lines`, `create_pos_sale()`, `close_pos_session()`.
* **Producción Simple & Fórmulas (BOM)**:
  * `bill_of_materials` y `bom_lines`, `production_orders` y `complete_production_order()`.
* **Activos Fijos & Depreciación**:
  * `fixed_assets`, `fixed_asset_depreciation_entries`, `run_monthly_depreciation()`, `dispose_fixed_asset()`.
* **Cierre de Período & Revalorización Cambiaria**:
  * `accounting_periods`, `exchange_revaluations`, `run_exchange_revaluation()`, `close_accounting_period()`.
* **Facturación Transaccional & Cobranzas / Pagos**:
  * `sales_invoices` / `sales_invoice_lines` y `purchase_invoices` / `purchase_invoice_lines`.
  * `post_sales_invoice()` y `post_purchase_invoice()`.
  * `invoice_payments`, `sales_invoice_balances` y `purchase_invoice_balances`.
* **Inventario, Motor FIFO Multibodega & Segregación 3PL**:
  * `items`, `warehouses`, `stock_ledger_entries` (con `party_id` para inventario propio vs. mercadería en custodia de terceros), `stock_valuation_layers`, `stock_balances` (vista segregada por cliente 3PL).
  * Triggers `trg_consume_fifo_layers` y `trg_create_fifo_layer`.
  * Función `create_warehouse_transfer()`.
* **Terceros & Clientes 3PL**:
  * `parties` (con RUT, `entity_id` y bandera `is_3pl_client`), `party_warehouses` (asignación de bodegas autorizadas por cliente 3PL), `contacts`, `addresses`.
* **Vertical 3PL — Guías de Despacho (Res. Ex. N° 154 SII)**:
  * `dispatch_notes`: Cabecera de Guía de Despacho con requisitos normativos del SII (transportista, RUT, patente, georreferenciación origen/destino, fechas y horas de salida/llegada, tipo de traslado y estado `draft`).
  * `dispatch_note_lines`: Detalle de carga física por ítem (cantidad, unidad de medida, peso en kg, volumen en m³, valor unitario).
  * Políticas de Row Level Security (RLS) multiempresa vinculadas a `user_has_company_access(auth.uid(), entity_id)`.
* **Vertical 3PL — Comercio Exterior (SICEX / Aduanas)**:
  * `foreign_trade_operations`: Carpeta aduanera vinculada a cliente 3PL (`party_id`), tipo (`exportacion`, `importacion`), país, N° DUS/DIN (`dus_number`), booking/BL (`booking_number`), estado aduanero (`ft_customs_status`: `pendiente`, `tramitando`, `autorizado`, `rechazado`) y vínculo opcional con `dispatch_notes`.
  * `foreign_trade_certificates`: Repositorio aduanero de certificados asociados a la operación (fitosanitarios SAG, zoosanitarios SAG/SERNAPESCA, certificados de origen SOFOFA/Cámara de Comercio, ISP) con número, emisor y fecha de vigencia (`valid_until`).
  * Políticas de Row Level Security (RLS) multiempresa con `user_has_company_access(auth.uid(), entity_id)` y roles autorizados.
* **Vertical 3PL — WMS: Recepción y Ubicación (Slotting / Racks / Pasillos)**:
  * `warehouse_locations`: Catálogo granular de sub-ubicaciones dentro de cada bodega (`warehouse_id`, `code` único por bodega, `name`, `entity_id`, `is_active`) con políticas RLS multiempresa.
  * Extensión en `stock_ledger_entries`:
    * `location_id`: Clave foránea opcional a `warehouse_locations(id)` para slotting de mercaderías.
    * `lot_number`: Trazabilidad por número de lote/partida en los movimientos de inventario.
    * `qc_notes`: Registro de control de calidad e inspección técnica al momento de la recepción.
  * Vista `stock_balances`: Agrupación y consulta de saldos consolidados por ítem, bodega, cliente 3PL propietario y ubicación física (`location_id`, `location_code`, `location_name`), con `security_invoker = true`.


