# Arquitectura del Sistema - EasyERP

## 1. Visión y Alcance
Sistema ERP para contabilidad y gestión administrativa enfocado en empresas en Chile bajo normativa contable IFRS / IFRS Pymes. Soporta operación multiempresa con aislamiento estricto de datos (RLS), motor de comprobantes contables con partida doble estricta e inmutabilidad, soporte **multimoneda a nivel de cuenta** (cuentas en USD, EUR, etc. coexistiendo con la moneda funcional base CLP), **dimensiones analíticas jerárquicas (Centros de Costo y Sucursales/Unidades)**, **inventario multibodega con valorización por capas FIFO reales**, libros contables, identificación tributaria mediante **RUT** y control de inventario.

## 2. Stack Tecnológico
* **Frontend & SSR**: React 19, TanStack Start, TanStack Router (file-based routing), TanStack Query.
* **Estilos**: Tailwind CSS v4 con variables semánticas en OKLCH, shadcn/ui y Lucide Icons.
* **Backend**: Server Functions en TanStack Start, middleware de validación y autenticación.
* **Base de Datos & Auth**: Supabase (PostgreSQL), políticas de Row Level Security (RLS), funciones `SECURITY DEFINER` (`public.has_role()`, `public.user_has_company_access()`, `public.post_journal_entry()`, `public.reverse_journal_entry()`, `public.get_exchange_rate()`, `public.create_warehouse_transfer()`).

## 3. Modelo de Datos
* **Seguridad & Roles Multiempresa**:
  * `company_users`: Asignación de usuario $\leftrightarrow$ empresa $\leftrightarrow$ rol en esa empresa (`user_id`, `entity_id`, `role`, `is_default`).
  * `profiles`: Datos de usuario con `active_entity_id` (empresa activa) y zona horaria `America/Santiago`.
  * `user_has_company_access(_user_id, _entity_id)`: Función de seguridad para evaluar pertenencia y permisos en RLS.
  * `app_role` (`admin`, `accountant`, `sales`, `purchasing`, `inventory`, `viewer`).
* **Configuración Contable & Dimensiones Analíticas**:
  * `entities`: Empresas con `base_currency_code` (FK a `currencies.code`), RUT y razón social.
  * `cost_centers`: Centros de costo jerárquicos (`parent_id`, `is_group`) aislados por `entity_id`.
  * `business_units`: Unidades de negocio / sucursales jerárquicas (`parent_id`, `is_group`) aisladas por `entity_id`.
  * `currencies`: Monedas disponibles (`CLP` con 0 decimales, `USD` con 2 decimales, etc.).
  * `exchange_rates`: Tasas oficiales (USD/CLP - Dólar Observado) con búsqueda y validación estricta por fecha en `get_exchange_rate()`.
  * `books`, `fiscal_years`, `accounting_periods`: Estructuras filtradas por `entity_id`.
* **Motor Contable de Partida Doble & Multimoneda**:
  * `accounts`: Plan de cuentas jerárquico (`parent_id`) con moneda propia `currency_code` y reglas analíticas (`requires_cost_center`, `requires_business_unit`).
  * `journal_entries`: Cabecera de comprobante (`entity_id`, `book_id`, `entry_number`, `posting_date`, `voucher_type`, `memo`, `status` ['draft', 'posted', 'reversed'], `reversal_of`, `created_by`).
  * `journal_entry_lines`: Detalle de partidas con moneda (`currency_code`), tipo de cambio (`exchange_rate`), Centro de Costo (`cost_center_id`), Sucursal (`business_unit_id`), montos en divisa y montos funcionales en moneda base calculados por `trg_resolve_line_currency` y validados por `trg_validate_line_dimensions`.
  * `post_journal_entry()`: Valida $\sum \text{Débito} = \sum \text{Crédito}$ en moneda funcional, asigna correlativo y postea.
  * `reverse_journal_entry()`: Anulación con contra-asiento invertido.
  * `trg_journal_entries_immutability`: Trigger que bloquea mutaciones sobre comprobantes en estado `posted`.
  * `naming_series`: Correlativos automáticos por `entity_id`.
* **Inventario & Motor FIFO Multibodega**:
  * `items`: Catálogo de productos y servicios con SKU, categoría, UOM y método de valorización.
  * `warehouses`: Catálogo de bodegas y almacenes por empresa.
  * `stock_ledger_entries`: Transacciones inmutables de inventario (`receipt`, `issue`, `transfer_out`, `transfer_in`, `adjustment`).
  * `stock_valuation_layers`: Capas de stock remanente por costo unitario de compra (`qty_remaining`, `rate`).
  * `consume_fifo_layers()`: Trigger `BEFORE INSERT` (para `qty_change < 0`) que consume capas por orden cronológico con bloqueo `FOR UPDATE`, asigna costo unitario promedio ponderado a la salida y rechaza transacciones con saldo insuficiente.
  * `create_fifo_layer()`: Trigger `AFTER INSERT` (para `qty_change > 0`) que registra la nueva capa valorizada.
  * `create_warehouse_transfer()`: Función atómica para traslados interbodega conservando el costo FIFO de origen.
  * `stock_balances`: Vista SQL reactiva de stock disponible y valorización total por ítem y bodega.
* **Terceros**: `party_groups`, `parties` (con RUT y `entity_id`), `contacts`, `addresses`.
