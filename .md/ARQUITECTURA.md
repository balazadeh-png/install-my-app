# Arquitectura del Sistema - EasyERP

## 1. Visión y Alcance
Sistema ERP para contabilidad y gestión administrativa enfocado en empresas en Chile bajo normativa contable IFRS / IFRS Pymes. Soporta operación multiempresa con aislamiento estricto de datos (RLS), moneda base **Peso Chileno (CLP)** y multimoneda (USD / Dólar Observado), catálogo de cuentas jerárquico, libros contables, asientos por partida doble, identificación tributaria mediante **RUT** y control de inventario con método FIFO.

## 2. Stack Tecnológico
* **Frontend & SSR**: React 19, TanStack Start, TanStack Router (file-based routing), TanStack Query.
* **Estilos**: Tailwind CSS v4 con variables semánticas en OKLCH, shadcn/ui y Lucide Icons.
* **Backend**: Server Functions en TanStack Start, middleware de validación y autenticación.
* **Base de Datos & Auth**: Supabase (PostgreSQL), políticas de Row Level Security (RLS), función `public.has_role()` y función `public.user_has_company_access()`.

## 3. Modelo de Datos
* **Seguridad & Roles Multiempresa**:
  * `company_users`: Asignación de usuario $\leftrightarrow$ empresa $\leftrightarrow$ rol en esa empresa (`user_id`, `entity_id`, `role`, `is_default`).
  * `profiles`: Datos de usuario con `active_entity_id` (empresa activa) y zona horaria `America/Santiago`.
  * `user_has_company_access(_user_id, _entity_id)`: Función `SECURITY DEFINER` para evaluar pertenencia y permisos en RLS.
  * `app_role` (`admin`, `accountant`, `sales`, `purchasing`, `inventory`, `viewer`).
* **Configuración Contable**:
  * `entities`: Empresas con `base_currency_code` (FK a `currencies.code`), RUT y razón social.
  * `currencies`: Monedas disponibles (`CLP` con 0 decimales, `USD` con 2 decimales).
  * `exchange_rates`: Tasas oficiales (USD/CLP - Dólar Observado).
  * `books`, `fiscal_years`, `accounting_periods`: Estructuras filtradas por `entity_id`.
* **Libro Mayor & Cuentas**:
  * `accounts`: Plan de cuentas jerárquico (`parent_id`) por `entity_id`.
  * `gl_entries`: Asientos de débito/crédito vinculados a `entity_id`.
  * `naming_series`: Correlativos automáticos por `entity_id`.
* **Terceros**: `party_groups`, `parties` (con RUT y `entity_id`), `contacts`, `addresses`.
* **Inventario**: `uom`, `item_categories`, `items` (con `entity_id`), `warehouses` (con `entity_id`).
