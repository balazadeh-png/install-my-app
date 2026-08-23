# Registro de Cambios y Mejoras (Changelog)

Todos los cambios notables, nuevas funcionalidades y mejoras en el proyecto se registran en este documento.

---

## [Adaptación Contable a Chile - Moneda CLP y RUT] - 2026-08-23

### Añadido / Modificado
* **Migración de Base de Datos** ([`supabase/migrations/20260823224000_update_currency_to_clp.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260823224000_update_currency_to_clp.sql)):
  * Se configuró **CLP (Peso Chileno)** como la moneda predeterminada del sistema (`is_default = true`, 0 decimales).
  * Se desmarcó NIO como moneda por defecto.
  * Se actualizó la zona horaria predeterminada de los perfiles de usuario a `America/Santiago`.
  * Se actualizaron las entidades y asientos contables existentes a `CLP`.
* **Interfaz de Usuario y Formateo**:
  * **Header & Dashboard**: Distintivo y tarjeta de moneda base actualizados a **CLP ($)**.
  * **Contabilidad & Reportes**: Formateo monetario localizado con `es-CL`, símbolo `$` y registro de asientos contables en `CLP`.
  * **Ventas & Compras**: Campos y tablas de identificación tributaria adaptados al formato **RUT chileno** (ej. `76.123.456-K`).
  * **Bancos & Tesorería**: Configuración de tasas de cambio para el par **USD / CLP (Dólar Observado)** con ejemplos de cuentas bancarias chilenas.
  * **Landing Page**: Adaptación de descripción para empresas en Chile bajo normativa IFRS.
* **Documentación**:
  * Actualizados [`/.md/ARQUITECTURA.md`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/.md/ARQUITECTURA.md) y [`/.md/MODULOS.md`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/.md/MODULOS.md) con los requerimientos chilenos.

---

## [Habilitación Completa de Módulos y Navegación] - 2026-08-21

### Añadido
* **Componente de Navegación Global** ([`src/components/layout/AppHeader.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/components/layout/AppHeader.tsx)):
  * Barra superior con selector rápido de módulos desplegable, indicador de perfil de usuario, moneda base y botón de cierre de sesión.
* **Módulos Operativos**:
  * Contabilidad (`/accounting`), Ventas (`/sales`), Compras (`/purchases`), Inventario (`/inventory`), Bancos (`/cash`), Reportes (`/reports`) y Configuración (`/setup`).

---

## [Idempotencia de Migraciones SQL] - 2026-08-21

### Corregido
* **Migración SQL Principal** ([`supabase/migrations/20260822021226_91856159-64ce-464a-a355-238e576ed740.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260822021226_91856159-64ce-464a-a355-238e576ed740.sql)):
  * Se corrigió el error `42710: type "app_role" already exists` y se blindó la idempotencia de tablas, políticas e inserciones.

---

## [Inicialización] - 2026-08-21

### Añadido
* Estructuración del directorio de documentación `/.md/`.
* Documento de arquitectura general en [`/.md/ARQUITECTURA.md`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/.md/ARQUITECTURA.md).
