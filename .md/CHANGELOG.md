# Registro de Cambios y Mejoras (Changelog) - EasyERP

Todos los cambios notables, nuevas funcionalidades y mejoras en el proyecto se registran en este documento.

---

## [Sprint 11: Libros Legales SII y Conciliación RCV] - 2026-08-25

### Añadido
* **Migración SQL de Libros Legales SII** ([`supabase/migrations/20260825000010_sprint11_libros_sii.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000010_sprint11_libros_sii.sql)):
  * Enum `sii_book_type` (`libro_diario`, `libro_mayor`, `balance_tributario_8_columnas`, `libro_compras`, `libro_ventas`).
  * Tabla `sii_book_exports` para registrar y auditar exportaciones oficiales de libros contables.
  * Tablas `rcv_reconciliation_runs` y `rcv_reconciliation_items` para almacenar corridas de cruce contra el Registro de Compras y Ventas (RCV) del SII.
  * Función `public.get_sii_book_data()`: Genera dinámicamente las estructuras oficiales con sumas y saldos para el Balance Tributario de 8 Columnas, Libro Diario, Libro Mayor, Libro de Ventas y Libro de Compras.
  * Función `public.reconcile_rcv_batch()`: Procesa y contrasta documentos del RCV contra las facturas de EasyERP por N° folio y RUT, reportando calces exactos, diferencias de monto o faltantes.
  * Registro del módulo `sii_books` en la tabla `modules`.
* **Interfaz de Usuario (UI) en [`sii-books.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/sii-books.tsx)**:
  * Pestaña "Libros Contables Oficiales" con selector de libros, selector de fechas, visualización tabular formateada (incluyendo el Balance Tributario de 8 Columnas) y exportación a **CSV / Excel**.
  * Pestaña "Conciliación RCV": Herramienta de cruce con KPIs en vivo y tabla de auditoría con badges de estado (Coincide, Monto Discrepante, No Registrado).
  * Integración en el menú superior ([`AppHeader.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/components/layout/AppHeader.tsx)) y en el Dashboard ([`dashboard.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dashboard.tsx)).

---

## [Sprint 10: Ventas POS, Boletas y Arqueo de Caja] - 2026-08-25

### Añadido
* **Migración SQL del Punto de Venta POS** ([`supabase/migrations/20260825000009_sprint10_ventas_pos.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000009_sprint10_ventas_pos.sql)).
* Módulo en `pos.tsx`.

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
