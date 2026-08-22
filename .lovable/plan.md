# Migrate Cacao Accounting into Lovable

## Current state

The repo `balazadeh-png/mybooks` is a full Python/Flask accounting ERP called **Cacao Accounting**.

- Stack: Flask, SQLAlchemy, Jinja2, Alembic, Alpine.js, Bootstrap, Chart.js
- Size: ~71,000 lines of Python, 21 Jinja templates, ~450 route handlers across modules
- Modules: accounting, banks/cash, purchases, sales, inventory, reports, imports, printing, portal, setup wizard, auth/RBAC, document flow, approvals, audit trail, fiscal/tax engine, multi-currency, multi-book, party management, warehouse
- Schema: a single 5,235-line `database/__init__.py` containing all SQLAlchemy models
- No bundled database records were found in the archive
- Env vars used: `CACAO_TEST`, `FLASK_ENV`, plus runtime `DATABASE_URL`, `SECRET_KEY`, `CACAO_USER`, `CACAO_PSWD`

Lovable projects run on TanStack Start (React/TypeScript) with a PostgreSQL backend. A direct "install" is not possible; this is a framework migration that must be rebuilt piece by piece.

## Migration approach

Rebuild the application in Lovable in phases. Each phase delivers a working preview and defers advanced modules to later phases.

### Phase 1 — Foundation and core shell

1. Set up Lovable Cloud for PostgreSQL, auth, and storage.
2. Recreate the core schema in Supabase migrations:
   - entities (companies)
   - currencies and exchange rates
   - users, roles, role access
   - chart of accounts
   - parties (customers/suppliers), contacts, addresses
   - items, item categories, warehouses, UOM
   - fiscal years, accounting periods, books
   - GL entries (the single source of truth)
   - naming series, external counters
3. Implement Supabase Auth with role-based access matching the source's `Roles`/`RolesAccess` model.
4. Build a landing page, login, and a dashboard shell with navigation to the main modules.
5. Seed minimal demo data so the preview is not empty.

### Phase 2 — Master data

1. CRUD for companies, currencies, exchange rates, chart of accounts.
2. CRUD for parties, contacts, addresses, party groups.
3. CRUD for items, categories, warehouses, UOM, batches.
4. Fiscal calendar and naming series setup.

### Phase 3 — Operational modules

1. Sales module (quotations, orders, deliveries, invoices, payments).
2. Purchasing module (quotations, orders, receipts, invoices, payments).
3. Inventory module (stock entries, reconciliations, valuation).
4. Banking/cash module (accounts, transactions, reconciliation).

### Phase 4 — Accounting and reporting

1. Journal entries, vouchers, recurring templates.
2. GL inquiry, trial balance, P&L, balance sheet.
3. Tax/fiscal engine integration.
4. Document flow, approvals, audit trail.

### Phase 5 — Advanced features

1. Mass imports.
2. Printing and document templates.
3. Customer/supplier portal.
4. Collaboration tasks, notifications, email.
5. Desktop mode detection and Docker packaging (if still needed).

## What will be preserved from the source

- Domain model and relationships (schema).
- User/role permission matrix.
- Document numbering and reversal logic.
- Multi-currency and multi-book concepts.
- Module boundaries (accounting, sales, purchasing, inventory, banks).

## What will be replaced

- Flask → TanStack Start.
- SQLAlchemy → Supabase/PostgreSQL via generated clients and server functions.
- Jinja2 templates → React components.
- Flask-Login sessions → Supabase Auth JWT sessions.
- Waitress WSGI → Lovable Cloud serverless runtime.
- Local SQLite default → Lovable Cloud PostgreSQL.

## Verification

- Build passes after each phase.
- Typecheck passes.
- Key routes render without runtime errors.
- Representative data flows (create a party, create an invoice, post GL) work in the preview.

## First deliverable

Phase 1: a working Lovable preview with Cloud enabled, core schema, auth, and a dashboard shell. Advanced ERP features will be listed as deferred capabilities in the migration ledger.
