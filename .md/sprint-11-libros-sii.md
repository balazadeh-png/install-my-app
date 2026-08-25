# Sprint 11 — Libros Contables SII

**Fase:** 2 — Módulos Ampliados
**Depende de:** Sprint 2 (partida doble — el Libro Diario/Mayor conceptual ya existe desde ahí), Sprint 6 (facturación, para conciliar contra el RCV)

## Objetivo

Exportar el Libro Diario, Libro Mayor y Libro de Inventario y Balances en el formato electrónico que exige el SII, y conciliar las facturas registradas en EasyERP contra el Registro de Compras y Ventas (RCV) oficial.

## Por qué

El "libro mayor" ya existe conceptualmente desde el Sprint 2 (`journal_entries` + `journal_entry_lines`) — lo que falta no es el dato, sino **el formato de exportación exigido** por el SII, y la **conciliación** contra el RCV. Sobre el RCV es importante ser preciso: hoy en Chile el Registro de Compras y Ventas lo administra directamente el SII, alimentado automáticamente por los DTE que se emiten y reciben — EasyERP no "genera" el RCV desde cero, su rol es traer/exportar los datos propios y cruzarlos contra lo que el SII ya tiene registrado, para detectar diferencias (documentos no declarados, montos que no calzan, etc.).

## ⚠️ Nota sobre precisión regulatoria

Los formatos exactos (XML/TXT, estructura de campos) del Libro Diario Electrónico, Libro Mayor Electrónico y Libro de Inventario y Balances están sujetos a las especificaciones vigentes del SII, que pueden variar. Lo que sigue es la arquitectura de datos necesaria — **valida el formato exacto de exportación contra la documentación SII vigente al momento de construir esto**, no contra este documento.

## Alcance incluido

- `sii_book_exports`: registro de cada exportación generada (tipo de libro, período, formato, archivo).
- `rcv_reconciliation_runs` / `rcv_reconciliation_items`: importar el RCV descargado del portal del SII (CSV/Excel) y cruzarlo contra las facturas de EasyERP del mismo período.

## Fuera de alcance

- Generar el RCV desde cero o enviarlo al SII — el RCV lo controla el SII, no EasyERP.
- Integración API directa con el SII para descargar el RCV automáticamente (se asume importación manual del archivo en este MVP; automatizar la descarga es una extensión posterior, y depende del proveedor DTE que elijas según la nota del Sprint 6).

## Cambios de esquema (sketch SQL)

```sql
CREATE TYPE public.sii_book_type AS ENUM ('libro_diario', 'libro_mayor', 'libro_inventario_balances');

CREATE TABLE IF NOT EXISTS public.sii_book_exports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) NOT NULL,
    book_type public.sii_book_type NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    file_format text NOT NULL,
    storage_path text,
    generated_by uuid REFERENCES auth.users(id),
    generated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rcv_reconciliation_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    imported_file_path text,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rcv_reconciliation_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rcv_reconciliation_run_id uuid REFERENCES public.rcv_reconciliation_runs(id) ON DELETE CASCADE NOT NULL,
    document_type text,
    document_number text,
    party_tax_id text,
    amount_in_easyerp numeric(20,4),
    amount_in_rcv numeric(20,4),
    matched boolean DEFAULT false,
    difference numeric(20,4)
);
```

## Cambios de UI/backend esperados

- Pantalla "Libros Contables SII": elegir empresa, tipo de libro y período, botón "Generar", historial de exportaciones con descarga.
- Pantalla "Conciliación RCV": importar el archivo del RCV descargado del portal SII, cruzar automáticamente por número/tipo de documento y RUT de contraparte contra las facturas registradas, mostrar coincidencias y diferencias lado a lado.

## Criterios de aceptación

- [ ] Se puede generar el archivo de un libro contable para un período específico, con los datos correctos extraídos de los comprobantes posteados de ese período.
- [ ] Importar un archivo RCV permite ver claramente qué documentos coinciden con EasyERP y cuáles presentan diferencias (monto, o documentos que existen en un lado y no en el otro).
- [ ] Ninguna diferencia detectada se "corrige" automáticamente — queda documentada para revisión humana.

---

## Prompt listo para pegar en Lovable

```
Necesito exportar los libros contables exigidos por el SII y conciliar contra el Registro de Compras y Ventas (RCV).

1. Crea el enum `sii_book_type` ('libro_diario','libro_mayor','libro_inventario_balances') y la tabla `sii_book_exports` (entity_id, book_type, period_start, period_end, file_format, storage_path, generated_by, generated_at).

2. Crea una función/edge function que, dado entity_id + book_type + rango de fechas, arme el archivo correspondiente a partir de `journal_entries`/`journal_entry_lines` posteados en ese rango. Estructura el código de forma modular (una función de armado de datos separada de la de formateo del archivo final) para poder ajustar el formato exacto de exportación después, cuando se valide contra la especificación SII vigente.

3. Crea `rcv_reconciliation_runs` (entity_id, period_start, period_end, imported_file_path, created_at) y `rcv_reconciliation_items` (rcv_reconciliation_run_id, document_type, document_number, party_tax_id, amount_in_easyerp, amount_in_rcv, matched, difference).

4. Crea un flujo de importación (CSV o Excel) del RCV descargado manualmente del portal del SII, que lo cruce contra las `sales_invoices`/`purchase_invoices` del mismo período por tipo+número de documento y RUT de la contraparte, calculando `matched` y `difference` por cada línea.

5. Crea una pantalla "Libros Contables SII": selector de empresa/tipo de libro/período, botón "Generar", historial de exportaciones con descarga del archivo.

6. Crea una pantalla "Conciliación RCV": botón para importar el archivo del RCV, y una tabla que muestre lado a lado los documentos de EasyERP vs. el RCV, resaltando diferencias.

Aplica RLS multiempresa. Al terminar, documenta en `.md/CHANGELOG.md` y agrega el módulo a `.md/MODULOS.md` y `.md/ARQUITECTURA.md`, dejando explícita la nota de que el formato de exportación debe validarse contra la normativa SII vigente antes de usarse con un cliente real.
```
