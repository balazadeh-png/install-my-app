# Registro de Cambios y Mejoras (Changelog) - EasyERP

Todos los cambios notables, nuevas funcionalidades y mejoras en el proyecto se registran en este documento.

---

## [Sprint 7: Cierre de Período y Revalorización Cambiaria Multimoneda] - 2026-08-25

### Añadido
* **Migración SQL de Cierre y Revalorización** ([`supabase/migrations/20260825000006_sprint07_cierre_revalorizacion.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000006_sprint07_cierre_revalorizacion.sql)):
  * Columnas `unrealized_exchange_gain_account_id` y `unrealized_exchange_loss_account_id` en `company_default_accounts`.
  * Enum `period_status` (`open`, `closed`) y columna `status` en `accounting_periods`.
  * Columna `skip_currency_resolution` en `journal_entry_lines` para permitir asientos de ajuste directo en moneda funcional sin re-conversión del trigger.
  * Tablas `exchange_revaluations` y `exchange_revaluation_items` para trazabilidad y auditoría cuenta por cuenta de cada corrida de ajuste cambiario.
  * Tabla `period_close_checks` para checklists de cierre de período.
  * Actualización de la función `public.post_journal_entry()` para rechazar cualquier intento de posteo con fecha dentro de un período contable cerrado.
  * Función `public.run_exchange_revaluation()`: Recorre cuentas en moneda extranjera, compara el saldo en libros contra la tasa de cierre a la fecha dada y postea automáticamente el comprobante de ajuste a Ganancia o Pérdida No Realizada.
  * Función `public.close_accounting_period()`: Valida la ausencia de comprobantes en borrador y cierra formalmente el período bloqueando futuros asientos.
* **Interfaz de Usuario (UI) en [`setup.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/setup.tsx)**:
  * Selectores de cuentas de Diferencia de Cambio No Realizada en "Cuentas Predeterminadas".
  * Sub-módulo en "Años & Cierre de Período" con listado de meses, estado (Abierto / Cerrado) y botón de cierre mensual.
  * Modal para ejecutar la **Revalorización Cambiaria** seleccionando la fecha de corte y visualizando los resultados del cálculo.

---

## [Sprint 6: Ciclo Transaccional de Ventas y Compras] - 2026-08-25

### Añadido
* **Migración SQL Transaccional** ([`supabase/migrations/20260825000005_sprint06_ventas_compras_transaccional.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000005_sprint06_ventas_compras_transaccional.sql)):
  * Tabla `company_default_accounts` para asociar las cuentas contables maestras por empresa.
  * Tablas `sales_invoices`, `sales_invoice_lines`, `purchase_invoices`, `purchase_invoice_lines` e `invoice_payments`.
  * Vistas `sales_invoice_balances` y `purchase_invoice_balances`.
  * Funciones `public.post_sales_invoice()` y `public.post_purchase_invoice()`.
* **Interfaz de Usuario (UI)**:
  * Módulo de Facturación de Ventas en [`sales.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/sales.tsx).
  * Módulo de Facturación de Compras en [`purchases.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/purchases.tsx).

---

## [Sprint 5: Multibodega Real, Movimientos de Stock y Kardex FIFO] - 2026-08-25

### Añadido
* **Migración SQL del Motor de Inventario** ([`supabase/migrations/20260825000004_sprint05_multibodega_kardex_fifo.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000004_sprint05_multibodega_kardex_fifo.sql)).

---

## [Sprint 4: Centros de Costo y Unidades/Sucursales] - 2026-08-25

### Añadido
* **Migración SQL de Dimensiones Analíticas** ([`supabase/migrations/20260825000003_sprint04_centros_costo_unidades.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000003_sprint04_centros_costo_unidades.sql)).

---

## [Sprint 3: Multimoneda a Nivel de Cuenta y Comprobantes] - 2026-08-25

### Añadido
* **Migración SQL Multimoneda** ([`supabase/migrations/20260825000002_sprint03_multimoneda_cuentas.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000002_sprint03_multimoneda_cuentas.sql)).

---

## [Sprint 2: Motor Contable de Partida Doble e Inmutabilidad] - 2026-08-25

### Añadido
* **Migración SQL del Motor Contable** ([`supabase/migrations/20260825000001_sprint02_motor_partida_doble.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000001_sprint02_motor_partida_doble.sql)).

---

## [Sprint 1: Multiempresa Real y Seguridad RLS] - 2026-08-25

### Añadido
* **Migración SQL Multiempresa** ([`supabase/migrations/20260825000000_sprint01_multiempresa_rls.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000000_sprint01_multiempresa_rls.sql)).
