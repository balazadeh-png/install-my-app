# Registro de Cambios y Mejoras (Changelog) - EasyERP

Todos los cambios notables, nuevas funcionalidades y mejoras en el proyecto se registran en este documento.

---

## [Sprint 10: Ventas POS, Boletas y Arqueo de Caja] - 2026-08-25

### Añadido
* **Migración SQL del Punto de Venta POS** ([`supabase/migrations/20260825000009_sprint10_ventas_pos.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000009_sprint10_ventas_pos.sql)):
  * Enums `pos_session_status` (`open`, `closed`) y `pos_payment_method` (`efectivo`, `tarjeta_debito`, `tarjeta_credito`, `transferencia`, `otro`).
  * Tabla `pos_sessions` para la apertura, cierre y arqueo de turnos de caja con control de diferencias de efectivo.
  * Columna `pos_session_id` en `sales_invoices` para vincular boletas y facturas emitidas en el mostrador a la sesión del cajero.
  * Tabla `pos_sale_payment_lines` para soportar pagos mixtos por venta (ej. parte en efectivo y parte en tarjeta).
  * Función `public.create_pos_sale()`: Emite la boleta, genera el desglose de pagos y dispara el posteo contable e inventario en tiempo real.
  * Función `public.close_pos_session()`: Realiza el arqueo comparando el efectivo contado físicamente contra el esperado ($ \text{Apertura} + \text{Ventas Efectivo} $).
  * Registro del módulo `pos` en la tabla `modules`.
* **Interfaz de Usuario (UI) en [`pos.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/pos.tsx)**:
  * Pantalla de **Apertura de Caja** con selector de bodega asignada y fondo inicial en gaveta.
  * Terminal de **Venta Rápida POS**: Búsqueda ágil de productos, carrito dinámico con cálculo de IVA (19%) y selector de cliente.
  * Modal de **Cobro & Medios de Pago Mixtos** con cálculo automático de vuelto en efectivo y validación de cuadre total.
  * Modal de **Arqueo y Cierre de Caja** con visualización instantánea de diferencias.
  * Pestaña de **Historial de Turnos de Caja**.
  * Integración en el menú superior ([`AppHeader.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/components/layout/AppHeader.tsx)) y en el Dashboard ([`dashboard.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dashboard.tsx)).

---

## [Sprint 9: Módulo de Producción Simple & Lista de Materiales (BOM)] - 2026-08-25

### Añadido
* **Migración SQL de Producción y Recetas BOM** ([`supabase/migrations/20260825000008_sprint09_produccion_bom.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000008_sprint09_produccion_bom.sql)).
* Módulo en `production.tsx`.

---

## [Sprint 8: Activos Fijos y Depreciación Mensual Automática] - 2026-08-25

### Añadido
* **Migración SQL de Activos Fijos** ([`supabase/migrations/20260825000007_sprint08_activos_fijos.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000007_sprint08_activos_fijos.sql)).
* Módulo en `assets.tsx`.

---

## [Sprint 7: Cierre de Período y Revalorización Cambiaria Multimoneda] - 2026-08-25

### Añadido
* **Migración SQL de Cierre y Revalorización** ([`supabase/migrations/20260825000006_sprint07_cierre_revalorizacion.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000006_sprint07_cierre_revalorizacion.sql)).

---

## [Sprint 6: Ciclo Transaccional de Ventas y Compras] - 2026-08-25

### Añadido
* **Migración SQL Transaccional** ([`supabase/migrations/20260825000005_sprint06_ventas_compras_transaccional.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000005_sprint06_ventas_compras_transaccional.sql)).

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
