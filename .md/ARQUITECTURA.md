# Arquitectura del Sistema - EasyERP

## 1. Visión y Alcance
Sistema ERP para contabilidad y gestión administrativa enfocado en empresas en Chile bajo normativa contable IFRS / IFRS Pymes. Soporta operación multiempresa con aislamiento estricto de datos (RLS), motor de comprobantes contables con partida doble estricta e inmutabilidad, moneda base **Peso Chileno (CLP)** y multimoneda (USD / Dólar Observado), catálogo de cuentas jerárquico, libros contables, identificación tributaria mediante **RUT** y control de inventario con método FIFO.

## 2. Stack Tecnológico
* **Frontend & SSR**: React 19, TanStack Start, TanStack Router (file-based routing), TanStack Query.
* **Estilos**: Tailwind CSS v4 con variables semánticas en OKLCH, shadcn/ui y Lucide Icons.
* **Backend**: Server Functions en TanStack Start, middleware de validación y autenticación.
* **Base de Datos & Auth**: Supabase (PostgreSQL), políticas de Row Level Security (RLS), funciones `SECURITY DEFINER` (`public.has_role()`, `public.user_has_company_access()`, `public.post_journal_entry()`, `public.reverse_journal_entry()`).

## 3. Modelo de Datos
* **Seguridad & Roles Multiempresa**:
  * `company_users`: Asignación de usuario $\leftrightarrow$ empresa $\leftrightarrow$ rol en esa empresa (`user_id`, `entity_id`, `role`, `is_default`).
  * `profiles`: Datos de usuario con `active_entity_id` (empresa activa) y zona horaria `America/Santiago`.
  * `user_has_company_access(_user_id, _entity_id)`: Función de seguridad para evaluar pertenencia y permisos en RLS.
  * `app_role` (`admin`, `accountant`, `sales`, `purchasing`, `inventory`, `viewer`).
* **Configuración Contable**:
  * `entities`: Empresas con `base_currency_code` (FK a `currencies.code`), RUT y razón social.
  * `currencies`: Monedas disponibles (`CLP` con 0 decimales, `USD` con 2 decimales).
  * `exchange_rates`: Tasas oficiales (USD/CLP - Dólar Observado).
  * `books`, `fiscal_years`, `accounting_periods`: Estructuras filtradas por `entity_id`.
* **Motor Contable de Partida Doble**:
  * `journal_entries`: Cabecera de comprobante (`entity_id`, `book_id`, `entry_number`, `posting_date`, `voucher_type`, `memo`, `status` ['draft', 'posted', 'reversed'], `reversal_of`, `created_by`).
  * `journal_entry_lines`: Detalle de partidas contables (`journal_entry_id`, `line_no`, `account_id`, `party_id`, `debit`, `credit`, `memo`) con validación `CHECK` de no negatividad y exclusividad débito/crédito.
  * `post_journal_entry()`: Valida $\sum \text{Débito} = \sum \text{Crédito}$, consume numeración correlativa atómica de `naming_series` y cambia estado a `posted`.
  * `reverse_journal_entry()`: Anulación de comprobantes posteados mediante creación automática de contra-asiento invertido.
  * `trg_journal_entries_immutability`: Trigger que bloquea `UPDATE` y `DELETE` sobre comprobantes en estado `posted`.
  * `accounts`: Plan de cuentas jerárquico (`parent_id`) por `entity_id`.
  * `naming_series`: Correlativos automáticos por `entity_id`.
* **Terceros**: `party_groups`, `parties` (con RUT y `entity_id`), `contacts`, `addresses`.
* **Inventario**: `uom`, `item_categories`, `items` (con `entity_id`), `warehouses` (con `entity_id`).
