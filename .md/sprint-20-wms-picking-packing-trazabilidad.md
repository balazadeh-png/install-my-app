# Sprint 20 — WMS: Picking, Packing y Trazabilidad

**Fase:** 2 — Vertical 3PL / Operación
**Depende de:** Sprint 19 (`warehouse_locations`, `lot_number`)
**Bloquea a:** Sprint 23 (OMS conecta pedidos con picking)

## Objetivo

Cerrar el ciclo físico de salida: picking (retirar de la ubicación), packing (marcar líneas de una guía como embaladas) y trazabilidad (poder responder "¿en qué guía salió este lote?"), conectando directamente con `dispatch_notes` del Sprint 16.

## Alcance incluido

- `dispatch_note_lines.location_id` y `.lot_number` (de dónde/qué lote se pickeó — mismo dato que ya existe en `stock_ledger_entries`, aquí queda registrado contra la guía).
- `dispatch_note_lines.picked` / `.packed` (booleanos) para trackear el avance físico de una guía en preparación.
- Al confirmar el picking de una línea, se genera automáticamente el `stock_ledger_entries` de salida (`movement_type='issue'`, mismo `party_id`, `location_id`, `lot_number`) — cierra el círculo entre "lo que dice la guía" y "lo que realmente salió de la bodega".
- Vista de trazabilidad: dado un `lot_number`, listar todas las guías de despacho donde salió.

## Cambios de esquema (sketch SQL)

```sql
ALTER TABLE public.dispatch_note_lines ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.warehouse_locations(id);
ALTER TABLE public.dispatch_note_lines ADD COLUMN IF NOT EXISTS lot_number text;
ALTER TABLE public.dispatch_note_lines ADD COLUMN IF NOT EXISTS picked boolean DEFAULT false;
ALTER TABLE public.dispatch_note_lines ADD COLUMN IF NOT EXISTS packed boolean DEFAULT false;
```

## Criterios de aceptación

- [ ] Desde una guía en `draft`, se puede marcar cada línea como "pickeada" indicando ubicación y lote — esto crea el `stock_ledger_entries` de salida correspondiente.
- [ ] Cuando todas las líneas de una guía están `packed`, la guía se puede marcar como lista para despacho (sigue en `status='draft'` a nivel de DTE — eso no cambia hasta el Sprint del emisor).
- [ ] Dado un número de lote, se puede ver en qué guía(s) salió y para qué cliente.

---

## Prompt listo para pegar en Lovable

```
Voy a cerrar el ciclo de picking/packing de las guías de despacho del Sprint 16, conectándolo con el inventario del Sprint 19.

1. Agrega a dispatch_note_lines: location_id uuid references warehouse_locations(id), lot_number text, picked boolean default false, packed boolean default false.

2. En la vista de detalle de una guía (dispatch.tsx, pestaña "Guías"), agrega un botón "Pickear" por línea que abre un formulario con ubicación (filtrada a la bodega de la guía) y lote — al confirmar, marca picked=true en esa línea E inserta un stock_ledger_entries con movement_type='issue', party_id de la guía, item_id, qty y location_id/lot_number de la línea.

3. Agrega un checkbox "Empacada" (packed) por línea, habilitado solo si picked=true.

4. Agrega una pantalla o sección "Trazabilidad": input de número de lote, muestra todas las dispatch_note_lines con ese lote junto al cliente y fecha de la guía.

Documenta en .md/CHANGELOG.md y actualiza .md/ARQUITECTURA.md y .md/MODULOS.md.
```
