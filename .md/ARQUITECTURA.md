# Arquitectura del Sistema - Cacao Accounting

## 1. Visión y Alcance
Sistema ERP para contabilidad y gestión administrativa enfocado en empresas en Chile bajo normativa contable IFRS / IFRS Pymes. Soporta operación en moneda base **Peso Chileno (CLP)** y multimoneda (USD / Dólar Observado), catálogo de cuentas jerárquico, libros contables, asientos por partida doble, identificación tributaria mediante **RUT** y control de inventario con método FIFO.

## 2. Stack Tecnológico
* **Frontend & SSR**: React 19, TanStack Start, TanStack Router (file-based routing), TanStack Query.
* **Estilos**: Tailwind CSS v4 con variables semánticas en OKLCH, shadcn/ui y Lucide Icons.
* **Backend**: Server Functions en TanStack Start, middleware de validación y autenticación.
* **Base de Datos & Auth**: Supabase (PostgreSQL), políticas de Row Level Security (RLS) y función `public.has_role()`.

## 3. Modelo de Datos
* **Seguridad & Roles**: `app_role` (`admin`, `accountant`, `sales`, `purchasing`, `inventory`, `viewer`), `user_roles`, `profiles` (zona horaria `America/Santiago`), `roles`, `role_modules`.
* **Configuración Contable**: `entities`, `currencies` (`CLP` por defecto con 0 decimales, `USD` con 2 decimales), `exchange_rates` (USD/CLP), `books`, `fiscal_years`, `accounting_periods`.
* **Libro Mayor & Cuentas**: `accounts` (jerárquico con `parent_id`), `gl_entries` (asientos de débito/crédito con trazabilidad y reversión en CLP), `naming_series`.
* **Terceros**: `party_groups`, `parties` (con RUT), `contacts`, `addresses`.
* **Inventario**: `uom`, `item_categories`, `items`, `warehouses`.
