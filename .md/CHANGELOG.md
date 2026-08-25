# Registro de Cambios y Mejoras (Changelog) - EasyERP

Todos los cambios notables, nuevas funcionalidades y mejoras en el proyecto se registran en este documento.

---

## [Sprint 4: Centros de Costo y Unidades/Sucursales] - 2026-08-25

### Añadido
* **Migración SQL de Dimensiones Analíticas** ([`supabase/migrations/20260825000003_sprint04_centros_costo_unidades.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000003_sprint04_centros_costo_unidades.sql)):
  * Tabla `cost_centers` para centros de costo jerárquicos (`parent_id`, `is_group`, `active`) por empresa con RLS.
  * Tabla `business_units` para unidades de negocio y sucursales jerárquicas (`parent_id`, `is_group`, `active`) por empresa con RLS.
  * Columnas `cost_center_id` y `business_unit_id` en `journal_entry_lines`.
  * Columnas `requires_cost_center` y `requires_business_unit` en `accounts`.
  * Trigger `trg_validate_line_dimensions` que valida a nivel de base de datos la obligatoriedad de centros de costo o sucursales antes de permitir el asiento y rechaza imputaciones a nodos agrupadores.
  * Semillero por defecto para empresas existentes con sucursal principal y centros de costo de administración, ventas y operaciones.
* **Interfaz de Usuario (UI)**:
  * Pestañas dedicadas en [`setup.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/setup.tsx) para crear, jerarquizar y administrar Centros de Costo y Sucursales.
  * Opciones en "Nueva Cuenta" de [`accounting.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/accounting.tsx) para exigir Centro de Costo o Sucursal en cuentas de resultado.
  * Formulario de comprobantes contables con selectores dinámicos de Centro de Costo y Sucursal por línea y validación visual preventiva.
  * Filtros analíticos interactivos en [`reports.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/reports.tsx) para recalcular en tiempo real el Balance General y el Estado de Resultados (P&L) por Centro de Costo o Sucursal.

---

## [Sprint 3: Multimoneda a Nivel de Cuenta y Comprobantes] - 2026-08-25

### Añadido
* **Migración SQL Multimoneda** ([`supabase/migrations/20260825000002_sprint03_multimoneda_cuentas.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000002_sprint03_multimoneda_cuentas.sql)):
  * Columna `currency_code` en `accounts` (FK a `currencies.code`) permitiendo que cuentas específicas (bancos en USD, cuentas por cobrar del exterior) operen en su propia moneda.
  * Columnas `currency_code`, `exchange_rate`, `debit_account_currency`, `credit_account_currency` en `journal_entry_lines`.
  * Función `public.get_exchange_rate(_origin, _destination, _date)` con validación de fecha exacta en `exchange_rates`.
  * Trigger `trg_resolve_line_currency` que resuelve la moneda de la cuenta y calcula automáticamente los montos funcionales en `debit` y `credit` multiplicados por la tasa del día.
* **Interfaz de Usuario (UI)**:
  * Selector de moneda opcional en el modal "Nueva Cuenta" de [`accounting.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/accounting.tsx).
  * Soporte multimoneda en el formulario de comprobante con cálculo de equivalentes en tiempo real y modal rápido de tasa de cambio.
  * Visualización de montos duales en la vista de comprobantes del Libro Diario.

---

## [Sprint 2: Motor Contable de Partida Doble e Inmutabilidad] - 2026-08-25

### Añadido
* **Migración SQL del Motor Contable** ([`supabase/migrations/20260825000001_sprint02_motor_partida_doble.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000001_sprint02_motor_partida_doble.sql)):
  * Enum `journal_entry_status` (`draft`, `posted`, `reversed`).
  * Tabla `journal_entries` para cabeceras de comprobantes y `journal_entry_lines` para detalle de partidas.
  * Función `public.get_next_entry_number()` que consume de forma atómica correlativos de `naming_series`.
  * Función `public.post_journal_entry()` con validación estricta de partida doble ($\sum \text{Débitos} = \sum \text{Créditos}$).
  * Función `public.reverse_journal_entry()` para anulación y creación automática de contra-asientos invertidos.
  * Trigger de inmutabilidad `trg_journal_entries_immutability`.
* **Interfaz de Usuario (UI)**:
  * Modal de comprobantes contables con $N$ líneas y validación visual de balance.
  * Vista de Libro Diario agrupada por comprobante con botón de reversión.
  * Reportes financieros consolidados desde comprobantes posteados.

---

## [Sprint 1: Multiempresa Real y Seguridad RLS] - 2026-08-25

### Añadido
* **Migración SQL Multiempresa** ([`supabase/migrations/20260825000000_sprint01_multiempresa_rls.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000000_sprint01_multiempresa_rls.sql)):
  * Tabla `company_users` para asociar usuarios a empresas con roles específicos.
  * Función de seguridad `public.user_has_company_access(_user_id, _entity_id)` (`SECURITY DEFINER`).
  * `base_currency_code` en `entities` y `active_entity_id` en `profiles`.
  * Políticas RLS reescritas para aislamiento estricto por `entity_id` en todas las tablas de negocio.
* **Capa de Estado y UI**:
  * `ActiveEntityContext` y selector dinámico de empresa en [`AppHeader.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/components/layout/AppHeader.tsx).
  * Filtrado estricto por `entity_id` en todas las pantallas.

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
