# Registro de Cambios y Mejoras (Changelog)

Todos los cambios notables, nuevas funcionalidades y mejoras en el proyecto se registran en este documento.

---

## [Habilitación Completa de Módulos y Navegación] - 2026-08-21

### Añadido
* **Componente de Navegación Global** ([`src/components/layout/AppHeader.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/components/layout/AppHeader.tsx)):
  * Barra superior con selector rápido de módulos desplegable, indicador de perfil de usuario, moneda base NIO y botón de cierre de sesión.
* **Módulo de Contabilidad** ([`src/routes/_authenticated/accounting.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/accounting.tsx)):
  * Catálogo de cuentas con vista jerárquica y modal de creación.
  * Libro Diario / Partidas del Libro Mayor (`gl_entries`) con sumatorias automáticas de débitos y créditos.
* **Módulo de Ventas & Clientes** ([`src/routes/_authenticated/sales.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/sales.tsx)):
  * Directorio de clientes con RUC, datos comerciales y contactos asociados.
* **Módulo de Compras & Proveedores** ([`src/routes/_authenticated/purchases.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/purchases.tsx)):
  * Directorio de suplidores y proveedores con gestión de contactos.
* **Módulo de Inventario & Bodegas** ([`src/routes/_authenticated/inventory.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/inventory.tsx)):
  * Catálogo de artículos/servicios (valoración FIFO), bodegas y unidades de medida.
* **Módulo de Bancos & Tesorería** ([`src/routes/_authenticated/cash.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/cash.tsx)):
  * Registro y consulta de tipos de cambio oficiales USD $\rightarrow$ NIO y libros auxiliares.
* **Módulo de Reportes Financieros** ([`src/routes/_authenticated/reports.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/reports.tsx)):
  * Balanza de Comprobación en tiempo real.
  * Balance General clasificado (Activos, Pasivos, Patrimonio).
  * Estado de Resultados (P&L) con cálculo automático de utilidad neta.
* **Módulo de Configuración General** ([`src/routes/_authenticated/setup.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/setup.tsx)):
  * Empresas/Entidades, Años Fiscales, Series de Numeración y Roles de Seguridad.
* **Documentación Técnica de Módulos**:
  * Creado [`/.md/MODULOS.md`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/.md/MODULOS.md) con la especificación funcional completa.

### Modificado
* [`src/routes/_authenticated/dashboard.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dashboard.tsx): Los botones de cada tarjeta de módulo ahora enlazan a sus rutas dedicadas.
* [`src/routes/_authenticated/route.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/route.tsx): Envuelve todas las páginas protegidas con `AppHeader`.
* [`src/routeTree.gen.ts`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routeTree.gen.ts): Árbol de rutas regenerado con los 7 módulos activos.

---

## [Idempotencia de Migraciones SQL] - 2026-08-21

### Corregido
* **Migración SQL Principal** ([`supabase/migrations/20260822021226_91856159-64ce-464a-a355-238e576ed740.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260822021226_91856159-64ce-464a-a355-238e576ed740.sql)):
  * Se corrigió el error `42710: type "app_role" already exists` envolviendo la creación del tipo ENUM en un bloque `DO $$ BEGIN IF NOT EXISTS ... END $$;`.
  * Se convirtieron todas las creaciones de tablas a `CREATE TABLE IF NOT EXISTS`.
  * Se implementó el patrón `DROP POLICY IF EXISTS ...; CREATE POLICY ...` en todas las políticas RLS.
  * Se agregaron cláusulas `ON CONFLICT (...) DO NOTHING` en los inserts de datos semilla.

---

## [Inicialización] - 2026-08-21

### Añadido
* Estructuración del directorio de documentación `/.md/`.
* Documento de arquitectura general en [`/.md/ARQUITECTURA.md`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/.md/ARQUITECTURA.md).
* Análisis completo del repositorio, dependencias, rutas, componentes UI y esquema de base de datos Supabase.
