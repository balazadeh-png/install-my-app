# Sprint 26 — Facturación de Servicios

**Fase:** 3 — Vertical 3PL / Comercial
**Depende de:** Sprint 6 (`sales_invoices`/`sales_invoice_lines`, se reutilizan tal cual), Sprint 25 (tarifarios)
**Bloquea a:** ninguno directo — cierra la Fase 3

## Objetivo

Generar automáticamente la factura mensual/quincenal de cada cliente 3PL, calculando su consumo real contra el tarifario del Sprint 25 y usando **las mismas tablas de facturación que ya existen desde el Sprint 6** — no se crea un sistema de facturación paralelo.

## Cómo se mide el consumo (simplificaciones a saber)

- **Almacenaje**: se usa el saldo de `stock_balances` al cierre del período (foto de fin de mes), no un promedio diario. Es más simple y suficiente para partir; si un cliente reclama porque tuvo mucho stock a mitad de mes y poco al cierre, ahí se evalúa pasar a promedio diario (requeriría guardar fotos diarias, que hoy no existen).
- **Picking**: se cuenta la cantidad (`qty`) de `dispatch_note_lines` con `picked=true` cuya guía cae dentro del período.
- **Transporte**: se suma `dispatch_notes.distance_km` de las guías del período.
- **Recargos fijos**: se cobran completos si el contrato los tiene, sin prorrateo.

## Alcance incluido

- `createServerFn` `generateServiceInvoice`: recibe `party_id` + rango de fechas, calcula el consumo por cada `rate_type` del contrato activo, y crea un `sales_invoices` (misma tabla del Sprint 6) con una `sales_invoice_lines` por concepto (ej. "Almacenaje — 42 pallets x $X", "Picking — 310 unidades x $Y").
- Pantalla "Facturación de Servicios": botón "Generar facturas del período" (corre la función para todos los clientes 3PL con contrato activo) + vista previa antes de confirmar.
- Notas de crédito/débito: se reutiliza `sales_invoices` con un nuevo campo `adjustment_of_invoice_id` que referencia la factura que corrige, en vez de crear un concepto de documento nuevo.

## ⚠️ Recordatorio breve, no nuevo

Esta factura queda igual de sujeta a la misma pendiente del Sprint 6/16: `invoice_number` sigue siendo un campo de texto, no un folio DTE real. Generarla automáticamente no resuelve esa decisión — solo automatiza el cálculo.

## Cambios de esquema (sketch SQL)

```sql
ALTER TABLE public.sales_invoices ADD COLUMN IF NOT EXISTS adjustment_of_invoice_id uuid REFERENCES public.sales_invoices(id);
```

## Criterios de aceptación

- [ ] Generar la factura de un cliente para un período produce un `sales_invoices` + líneas coherentes con su contrato y su consumo real de ese período.
- [ ] Correr "Generar facturas del período" no duplica facturas si se corre dos veces para el mismo cliente y rango de fechas (debe detectarlo y avisar, no crear una segunda).
- [ ] Se puede crear una nota de crédito/débito referenciando la factura original.

---

## Prompt listo para pegar en Lovable

```
Voy a automatizar la facturación de servicios 3PL reutilizando sales_invoices y sales_invoice_lines del Sprint 6 — no crees tablas de facturación nuevas.

1. Agrega adjustment_of_invoice_id uuid references sales_invoices(id) a sales_invoices (nullable) — para notas de crédito/débito que corrigen una factura anterior.

2. Crea un createServerFn generateServiceInvoice con middleware requireSupabaseAuth, que recibe { party_id, period_start, period_end }:
   - Busca el contrato activo (service_contracts) del party_id y sus service_rate_lines.
   - Para storage_pallet/storage_m2: lee stock_balances filtrado por ese party_id a la fecha period_end.
   - Para picking_unit: suma qty de dispatch_note_lines con picked=true cuyas guías (dispatch_notes) tengan departure_at entre period_start y period_end para ese party_id.
   - Para transport_km: suma distance_km de dispatch_notes de ese party_id en el rango.
   - Para recargo_fijo: cobra el unit_price completo si existe la línea.
   - Antes de crear, verifica que no exista ya una sales_invoices para ese party_id con memo indicando el mismo período (usa el campo memo para guardar algo como "Servicios 3PL {period_start}—{period_end}" y búscalo antes de insertar) — si ya existe, lanza un error en vez de duplicar.
   - Crea la sales_invoices (entity_id, party_id, currency_code de la entidad, issue_date=hoy, status='draft', memo con el período) y una sales_invoice_lines por cada concepto con consumo > 0 (description descriptivo, qty, unit_price, line_total calculado).

3. Pantalla "Facturación de Servicios" (puede ser una pestaña más en dispatch.tsx o ruta separada facturacion-3pl.tsx): selector de período, lista de clientes 3PL con contrato activo, botón "Generar facturas del período" que corre la función para cada uno y muestra un resumen antes/después de confirmar. Incluye un botón "Nota de crédito/débito" sobre una factura existente que crea una nueva sales_invoices con adjustment_of_invoice_id apuntando a la original.

Documenta en .md/CHANGELOG.md y actualiza .md/ARQUITECTURA.md y .md/MODULOS.md.
```
