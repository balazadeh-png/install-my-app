# Registro de Cambios y Mejoras (Changelog)

Todos los cambios notables, nuevas funcionalidades y mejoras en el proyecto se registran en este documento.

---

## [Idempotencia de Migraciones SQL] - 2026-08-21

### Corregido
* **Migración SQL Principal** ([`supabase/migrations/20260822021226_91856159-64ce-464a-a355-238e576ed740.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260822021226_91856159-64ce-464a-a355-238e576ed740.sql)):
  * Se corrigió el error `42710: type "app_role" already exists` envolviendo la creación del tipo ENUM en un bloque `DO $$ BEGIN IF NOT EXISTS ... END $$;`.
  * Se convirtieron todas las creaciones de tablas a `CREATE TABLE IF NOT EXISTS`.
  * Se implementó el patrón `DROP POLICY IF EXISTS ...; CREATE POLICY ...` en todas las políticas RLS para evitar conflictos de políticas preexistentes.
  * Se agregaron cláusulas `ON CONFLICT (...) DO NOTHING` en todos los inserts de datos semilla (`modules`, `roles`, `currencies`, `uom`, `party_groups`, `item_categories`).

---

## [Inicialización] - 2026-08-21

### Añadido
* Estructuración del directorio de documentación `/.md/`.
* Documento de arquitectura general en [`/.md/ARQUITECTURA.md`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/.md/ARQUITECTURA.md).
* Análisis completo del repositorio, dependencias, rutas, componentes UI y esquema de base de datos Supabase.
