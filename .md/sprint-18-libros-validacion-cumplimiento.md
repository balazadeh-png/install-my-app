# Sprint 18 — Libros Heredados y Validación de Cumplimiento

**Fase:** 3 — Vertical 3PL / Cumplimiento
**Depende de:** Sprint 15 (ApiPyme), Sprint 16, Sprint 17
**Bloquea a:** cierre de Fase 1 — habilita empezar Operación (Sprint 19) con confianza

## Objetivo

Este no es un sprint de código nuevo — es un sprint de **validación**. Confirmar que los movimientos generados por `dispatch_notes` / `stock_ledger_entries` con `party_id` no rompen la conciliación del Libro de Ventas/Compras que ya trae ApiPyme (Sprint 15), y dejar un checklist claro de qué falta antes de operar en producción con clientes 3PL reales.

## Alcance incluido

- Documento nuevo `.md/PRODUCCION-3PL.md` con:
  - Checklist de QA manual (ver criterios de aceptación)
  - Lista explícita de bloqueantes de negocio pendientes: emisor DTE (Sprint 16), habilitación SICEX (Sprint 17)
  - Confirmación de que las políticas RLS de `dispatch_notes`, `dispatch_note_lines`, `party_warehouses` fueron verificadas manualmente (ya hecho — septiembre 2026)
- Sin tablas nuevas, sin UI nueva.

## Criterios de aceptación

- [x] Crear una guía de despacho de prueba y confirmar que no aparece en el Libro de Ventas de ApiPyme (porque no es una venta ni un DTE real) — es decir, que ambos módulos conviven sin contaminarse.
- [x] Confirmar que el saldo de `stock_balances` filtrado por cliente 3PL cuadra manualmente contra el detalle de `stock_ledger_entries` para 2-3 casos de prueba.
- [x] `.md/PRODUCCION-3PL.md` documentado y committeado.

---

## Checklist para correr manualmente (no requiere prompt de Lovable)

```
[x] Crear 2 clientes 3PL de prueba en distintas bodegas
[x] Registrar recepciones e inventario cruzado para ambos, confirmar que "Saldos por Bodega" los muestra separados
[x] Crear una guía de despacho de prueba para cada uno, confirmar que queda en 'draft'
[x] Revisar Libro de Ventas (Sprint 15 / ApiPyme) y confirmar que estas guías NO aparecen ahí (no son DTE)
[x] Confirmar en Supabase → Authentication → Policies que dispatch_notes, dispatch_note_lines y party_warehouses tienen RLS activo con expresión que referencia entity_id (no solo "authenticated")
[x] Escribir .md/PRODUCCION-3PL.md con el resultado de este checklist y la lista de bloqueantes pendientes (DTE, SICEX)
```
