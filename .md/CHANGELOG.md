# Registro de Cambios y Mejoras (Changelog) - EasyERP

Todos los cambios notables, nuevas funcionalidades y mejoras en el proyecto se registran en este documento.

---

## [Sprint 5: Multibodega Real, Movimientos de Stock y Kardex FIFO] - 2026-08-25

### Añadido
* **Migración SQL del Motor de Inventario** ([`supabase/migrations/20260825000004_sprint05_multibodega_kardex_fifo.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000004_sprint05_multibodega_kardex_fifo.sql)):
  * Enum `stock_movement_type` (`receipt`, `issue`, `transfer_out`, `transfer_in`, `adjustment`).
  * Tabla `stock_ledger_entries` para registrar todos los movimientos de stock inmutables con trazabilidad de costos.
  * Tabla `stock_valuation_layers` para el seguimiento de capas FIFO activas (`qty_remaining`, `rate`).
  * Vista `stock_balances` que consolida cantidad física disponible (`qty_on_hand`), valorización monetaria total (`value_on_hand`) y costo unitario promedio ponderado por bodega y producto.
  * Trigger `trg_consume_fifo_layers` (`BEFORE INSERT` en salidas) que consume capas cronológicamente con `FOR UPDATE`, calcula el costo ponderado real de la salida y bloquea stocks negativos.
  * Trigger `trg_create_fifo_layer` (`AFTER INSERT` en entradas) para registrar nuevas capas valorizadas.
  * Función `public.create_warehouse_transfer()` para traslados atómicos entre bodegas manteniendo intacto el costo unitario de origen en la bodega de destino.
  * Políticas de Row Level Security (RLS) multiempresa para inventario.
* **Interfaz de Usuario (UI) en [`inventory.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/inventory.tsx)**:
  * Pestaña "Saldos por Bodega": Vista de existencias y valorización total en `$ CLP` filtrable por bodega.
  * Pestaña "Kardex / Movimientos": Historial cronológico con badges por tipo de movimiento, cantidades y costo unitario FIFO.
  * Modal "Registrar Movimiento": Soporte para entradas por compra, salidas a consumo y ajustes.
  * Modal "Traslado entre Bodegas": Ejecución de traslados interbodega conservando el valor FIFO.

---

## [Sprint 4: Centros de Costo y Unidades/Sucursales] - 2026-08-25

### Añadido
* **Migración SQL de Dimensiones Analíticas** ([`supabase/migrations/20260825000003_sprint04_centros_costo_unidades.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000003_sprint04_centros_costo_unidades.sql)):
  * Tabla `cost_centers` para centros de costo jerárquicos (`parent_id`, `is_group`, `active`) por empresa con RLS.
  * Tabla `business_units` para unidades de negocio y sucursales jerárquicas (`parent_id`, `is_group`, `active`) por empresa con RLS.
  * Columnas `cost_center_id` y `business_unit_id` en `journal_entry_lines`.
  * Columnas `requires_cost_center` y `requires_business_unit` en `accounts`.
  * Trigger `trg_validate_line_dimensions` que valida a nivel de base de datos la obligatoriedad de centros de costo o sucursales antes de permitir el asiento y rechaza imputaciones a nodos agrupadores.
* **Interfaz de Usuario (UI)**:
  * Pestañas dedicadas en [`setup.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/setup.tsx) para crear, jerarquizar y administrar Centros de Costo y Sucursales.
  * Opciones en "Nueva Cuenta" de [`accounting.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/accounting.tsx) para exigir Centro de Costo o Sucursal en cuentas de resultado.
  * Formulario de comprobantes contables con selectores dinámicos de Centro de Costo y Sucursal por línea y validación visual preventiva.
  * Filtros analíticos interactivos en [`reports.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/reports.tsx) para recalcular en tiempo real el Balance General y el Estado de Resultados (P&L) por Centro de Costo o Sucursal.

---

## [Sprint 3: Multimoneda a Nivel de Cuenta y Comprobantes] - 2026-08-25

### Añadido
* **Migración SQL Multimoneda** ([`supabase/migrations/20260825000002_sprint03_multimoneda_cuentas.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000002_sprint03_multimoneda_cuentas.sql)):
  * Columna `currency_code` en `accounts` (FK a `currencies.code`) permitiendo que cuentas específicas operen en su propia moneda.
  * Columnas `currency_code`, `exchange_rate`, `debit_account_currency`, `credit_account_currency` en `journal_entry_lines`.
  * Función `public.get_exchange_rate(_origin, _destination, _date)` con validación de fecha exacta en `exchange_rates`.
  * Trigger `trg_resolve_line_currency` que resuelve la moneda de la cuenta y calcula automáticamente los montos funcionales en `debit` y `credit`.

---

## [Sprint 2: Motor Contable de Partida Doble e Inmutabilidad] - 2026-08-25

### Añadido
* **Migración SQL del Motor Contable** ([`supabase/migrations/20260825000001_sprint02_motor_partida_doble.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000001_sprint02_motor_partida_doble.sql)):
  * Enum `journal_entry_status` (`draft`, `posted`, `reversed`).
  * Tablas `journal_entries` y `journal_entry_lines`.
  * Función `public.get_next_entry_number()`, `public.post_journal_entry()` y `public.reverse_journal_entry()`.
  * Trigger de inmutabilidad `trg_journal_entries_immutability`.

---

## [Sprint 1: Multiempresa Real y Seguridad RLS] - 2026-08-25

### Añadido
* **Migración SQL Multiempresa** ([`supabase/migrations/20260825000000_sprint01_multiempresa_rls.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000000_sprint01_multiempresa_rls.sql)):
  * Tabla `company_users`, función `public.user_has_company_access(_user_id, _entity_id)`.
  * `base_currency_code` en `entities` y `active_entity_id` en `profiles`.
  * Políticas RLS reescritas para aislamiento estricto por `entity_id`.

---

## [Renombramiento a EasyERP] - 2026-08-23

### Modificado
* Se actualizó el nombre de la plataforma a **EasyERP** en toda la aplicación y documentación técnica.

---

## [Adaptación Contable a Chile - Moneda CLP y RUT] - 2026-08-23

### Añadido / Modificado
* **Moneda Base CLP** y zona horaria `America/Santiago`.
* Formateo monetario en `$ CLP` y soporte de identificación por **RUT**.
* Mapeo de Dólar Observado (USD $\rightarrow$ CLP).
