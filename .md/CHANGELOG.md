# Registro de Cambios y Mejoras (Changelog) - EasyERP

Todos los cambios notables, nuevas funcionalidades y mejoras en el proyecto se registran en este documento.

---

## [Sprint 6: Ciclo Transaccional de Ventas y Compras] - 2026-08-25

### Añadido
* **Migración SQL Transaccional** ([`supabase/migrations/20260825000005_sprint06_ventas_compras_transaccional.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000005_sprint06_ventas_compras_transaccional.sql)):
  * Tabla `company_default_accounts` para asociar las cuentas contables maestras por empresa (CxC, CxP, Ventas, Compras, IVA Débito 19%, IVA Crédito 19%, Costo de Ventas, Inventario).
  * Tablas `sales_invoices` y `sales_invoice_lines` para la emisión de facturas de venta.
  * Tablas `purchase_invoices` y `purchase_invoice_lines` para el registro de facturas de proveedores.
  * Tabla `invoice_payments` para registrar cobros y desembolsos aplicados a facturas.
  * Vistas `sales_invoice_balances` y `purchase_invoice_balances` para el control de saldos adeudados y carteras de cobranza/pagos.
  * Función `public.post_sales_invoice()`: Postea automáticamente el comprobante contable oficial balanceado (CxC, Ingresos, IVA Débito), rebaja el inventario de la bodega y genera las líneas de Costo de Venta contra Inventario valorizadas con capas FIFO reales.
  * Función `public.post_purchase_invoice()`: Postea el comprobante (CxP, IVA Crédito, Gastos/Inventario) e ingresa existencias creando las nuevas capas FIFO.
* **Interfaz de Usuario (UI)**:
  * Pestaña "Cuentas Predeterminadas" en [`setup.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/setup.tsx).
  * Módulo de Facturación de Ventas en [`sales.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/sales.tsx) con emisión de facturas, cálculo de IVA (19%), confirmación/posteo y registro de cobranzas.
  * Módulo de Facturación de Compras en [`purchases.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/purchases.tsx) con registro de compras, discriminación de IVA Crédito Fiscal, ingreso de existencias y pagos a proveedores.

---

## [Sprint 5: Multibodega Real, Movimientos de Stock y Kardex FIFO] - 2026-08-25

### Añadido
* **Migración SQL del Motor de Inventario** ([`supabase/migrations/20260825000004_sprint05_multibodega_kardex_fifo.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000004_sprint05_multibodega_kardex_fifo.sql)):
  * Enum `stock_movement_type` (`receipt`, `issue`, `transfer_out`, `transfer_in`, `adjustment`).
  * Tablas `stock_ledger_entries` y `stock_valuation_layers`.
  * Vista reactiva `stock_balances` (saldos y valorización promedio por bodega).
  * Triggers `trg_consume_fifo_layers` y `trg_create_fifo_layer`.
  * Función `public.create_warehouse_transfer()` para traslados interbodega atómicos.
* **Interfaz de Usuario (UI) en [`inventory.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/inventory.tsx)**:
  * Pestañas de Saldos por Bodega, Kardex FIFO, Catálogo de Artículos y Bodegas.
  * Modales para registrar movimientos y traslados.

---

## [Sprint 4: Centros de Costo y Unidades/Sucursales] - 2026-08-25

### Añadido
* **Migración SQL de Dimensiones Analíticas** ([`supabase/migrations/20260825000003_sprint04_centros_costo_unidades.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000003_sprint04_centros_costo_unidades.sql)).
* Pestañas dedicadas en `setup.tsx`, `accounting.tsx` y filtros analíticos en `reports.tsx`.

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
