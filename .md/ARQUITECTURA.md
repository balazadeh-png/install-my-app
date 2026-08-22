# Arquitectura del Sistema - Cacao Accounting

## 1. Visión y Alcance
Sistema ERP para contabilidad y gestión administrativa enfocado en empresas de Nicaragua y la región centroamericana. Soporta operación multimoneda (NIO / USD), catálogo de cuentas jerárquico, libros contables, asientos por partida doble y control de inventario con método FIFO.

## 2. Stack Tecnológico
* **Frontend & SSR**: React 19, TanStack Start, TanStack Router (file-based routing), TanStack Query.
* **Estilos**: Tailwind CSS v4 con variables semánticas en OKLCH, shadcn/ui y Lucide Icons.
* **Backend**: Server Functions en TanStack Start, middleware de validación y autenticación.
* **Base de Datos & Auth**: Supabase (PostgreSQL), políticas de Row Level Security (RLS) y función `public.has_role()`.

## 3. Modelo de Datos
* **Seguridad & Roles**: `app_role` (`admin`, `accountant`, `sales`, `purchasing`, `inventory`, `viewer`), `user_roles`, `profiles`, `roles`, `role_modules`.
* **Configuración Contable**: `entities`, `currencies`, `exchange_rates`, `books`, `fiscal_years`, `accounting_periods`.
* **Libro Mayor & Cuentas**: `accounts` (jerárquico con `parent_id`), `gl_entries` (asientos de débito/crédito con trazabilidad y reversión), `naming_series`.
* **Terceros**: `party_groups`, `parties`, `contacts`, `addresses`.
* **Inventario**: `uom`, `item_categories`, `items`, `warehouses`.
