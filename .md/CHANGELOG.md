# Registro de Cambios y Mejoras (Changelog) - EasyERP

Todos los cambios notables, nuevas funcionalidades y mejoras en el proyecto se registran en este documento.

---

## [Sprint 14: Reorganización del Dashboard por Grupos Temáticos] - 2026-08-25

### Añadido
* **Migración SQL de Organización del Dashboard** ([`supabase/migrations/20260825000013_sprint14_organizacion_dashboard.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000013_sprint14_organizacion_dashboard.sql)):
  * Nuevas columnas en `modules`: `group_name`, `group_sort_order` y `sort_order`.
  * Asignación jerárquica y ordenada de los 13 módulos del sistema en 4 grupos oficiales:
    1. **Finanzas**: Contabilidad (`accounting`), Bancos/Tesorería (`cash`), Activos Fijos (`assets`), Reportes (`reports`).
    2. **Operaciones**: Compras (`purchases`), Ventas (`sales`), Inventario (`inventory`), Producción (`production`), Punto de Venta (`pos`).
    3. **Impuestos**: Declaraciones Juradas SII (`declaraciones_juradas`), Libros Legales SII (`sii_books`), Impuestos F29/F22 (`taxes`).
    4. **Configuración**: Configuración (`setup`), preparado para futuros módulos de auditoría y permisos granulares.
* **Backend y Función del Servidor ([`auth.functions.ts`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/lib/auth.functions.ts))**:
  * Actualización de `getModules()` para ordenar en el backend por `group_sort_order ASC`, `sort_order ASC` y `label ASC`.
* **Frontend ([`dashboard.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dashboard.tsx))**:
  * Reemplazo de la lista plana alfabética por **Secciones Temáticas** con encabezados, íconos temáticos distintivos y badges de cantidad de módulos operativos.

---

## [Sprint 13: Declaraciones Juradas SII (DDJJ)] - 2026-08-25

### Añadido
* **Migración SQL del Motor de Declaraciones Juradas** ([`supabase/migrations/20260825000012_sprint13_declaraciones_juradas.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000012_sprint13_declaraciones_juradas.sql)):
  * Enum `dj_generation_status` (`draft`, `reviewed`, `filed`).
  * Tabla `dj_definitions`, `dj_field_mappings`, `dj_generations`.
  * Semilla inicial con **DJ 1879** (Honorarios), **DJ 1887** (Sueldos) y **DJ 1947** (Pro Pyme Transparente).
* Módulo interactivo en `declaraciones-juradas.tsx`.

---

## [Sprint 12: Declaración de Impuestos SII - F29 y F22] - 2026-08-25

### Añadido
* **Migración SQL de Declaraciones de Impuestos** ([`supabase/migrations/20260825000011_sprint12_impuestos_f29_f22.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000011_sprint12_impuestos_f29_f22.sql)).
* Módulo en `taxes.tsx`.

---

## [Sprint 11: Libros Legales SII y Conciliación RCV] - 2026-08-25

### Añadido
* **Migración SQL de Libros Legales SII** ([`supabase/migrations/20260825000010_sprint11_libros_sii.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000010_sprint11_libros_sii.sql)).
* Módulo en `sii-books.tsx`.

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
