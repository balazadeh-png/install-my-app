# Sprint 19 — WMS: Recepción y Ubicación

**Fase:** 2 — Vertical 3PL / Operación
**Depende de:** Sprint 16 (`party_id` en `stock_ledger_entries`, `party_warehouses`)
**Bloquea a:** Sprint 20 (picking/packing usa las mismas ubicaciones)

## Objetivo

Pantalla de recepción de mercadería de un cliente 3PL: registra el ingreso físico a una bodega y ubicación específica, generando un movimiento en `stock_ledger_entries` (reutiliza el motor del Sprint 5, `movement_type = 'receipt'`, ya existente — no se crea un tipo nuevo).

## Alcance incluido

- `warehouse_locations`: sub-ubicaciones (pasillo/rack/posición) dentro de una bodega — hoy `warehouses` (Sprint 5) es solo un catálogo plano, sin granularidad interna.
- `stock_ledger_entries.location_id` (nullable) y `.lot_number` (nullable, texto libre) para trazabilidad básica por lote — sin crear un módulo de lotes completo.
- Pantalla "Recepción": selector de cliente 3PL + bodega (filtrada a `party_warehouses`), ítem, cantidad, ubicación, lote (opcional), y una checklist simple de control de calidad (texto libre u observaciones) guardada en la propia entrada.

## Fuera de alcance

- Lectura de código de barras / integración con hardware de bodega (queda para una iteración posterior si se necesita).
- Gestión de lotes con vencimiento/FEFO — solo se guarda el número de lote como dato de trazabilidad, sin lógica de negocio sobre él todavía.

## Cambios de esquema (sketch SQL)

```sql
CREATE TABLE IF NOT EXISTS public.warehouse_locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE CASCADE NOT NULL,
    code text NOT NULL,
    name text,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (warehouse_id, code)
);

ALTER TABLE public.stock_ledger_entries ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.warehouse_locations(id);
ALTER TABLE public.stock_ledger_entries ADD COLUMN IF NOT EXISTS lot_number text;
ALTER TABLE public.stock_ledger_entries ADD COLUMN IF NOT EXISTS qc_notes text;
```

## Criterios de aceptación

- [ ] Se pueden crear ubicaciones dentro de una bodega existente.
- [ ] Una recepción genera un `stock_ledger_entries` con `movement_type='receipt'`, `party_id` del cliente, `location_id` y `lot_number` opcional.
- [ ] El saldo por ubicación es consultable (no solo por bodega/cliente como en el Sprint 16).

---

## Prompt listo para pegar en Lovable

```
Voy a agregar recepción de mercadería con ubicación dentro de la bodega, reutilizando el motor de stock_ledger_entries del Sprint 5 (movement_type='receipt' ya existe, no crees uno nuevo).

1. Crea warehouse_locations (warehouse_id FK on delete cascade, code, name, created_at, único por warehouse_id+code).

2. Agrega a stock_ledger_entries: location_id uuid references warehouse_locations(id), lot_number text, qc_notes text — todas nullable.

3. Crea una pantalla "Recepción" (puede ser una quinta pestaña en dispatch.tsx o ruta separada recepcion.tsx): selector de cliente 3PL, bodega (filtrada por party_warehouses del cliente elegido), ubicación (filtrada por esa bodega — si no hay ninguna, permite crear una rápida), ítem, cantidad, lote opcional, observaciones de control de calidad. Al guardar, inserta en stock_ledger_entries con movement_type='receipt', party_id, location_id, lot_number, qc_notes.

4. En "Saldos por Bodega" (Inventario, Sprint 16), agrega columna/filtro de ubicación junto al de propietario que ya existe.

Aplica RLS multiempresa normal a warehouse_locations. Documenta en .md/CHANGELOG.md y actualiza .md/ARQUITECTURA.md y .md/MODULOS.md.
```
