# Sprint 28 — BI/KPIs Comerciales

**Fase:** 4 — Vertical 3PL / Inteligencia
**Depende de:** Sprint 26 (facturación de servicios), Sprint 27 (`operational_cost_inputs`)
**Bloquea a:** ninguno — cierra el roadmap de la vertical 3PL (Sprint 16→28)

## Objetivo

Rentabilidad por cliente: cuánto factura cada cliente 3PL contra una estimación de cuánto cuesta atenderlo, para saber cuáles clientes realmente convienen.

## Cómo se calcula (y su límite honesto)

- **Ingreso por cliente**: directo desde `sales_invoices` (Sprint 26) — suma de `total_amount` de facturas no canceladas de ese `party_id` en el período. Esto es un dato real y confiable.
- **Costo por cliente**: no existe un costeo por actividad real en el sistema (ver Sprint 27). Este sprint ofrece una **asignación proporcional simple**: toma el `operational_cost_inputs.total_cost` del período y lo reparte entre los clientes según su participación en unidades pickeadas + pallets/m² promedio almacenados — es una aproximación de gestión, no un costeo contable exacto. Se muestra explícitamente etiquetado como "estimado", para que nadie lo confunda con un número de costos certero.

## Alcance incluido

- Vista "Rentabilidad por Cliente" en el mismo dashboard del Sprint 27: ingreso real, costo estimado (si hay `operational_cost_inputs` cargado), margen resultante.
- Si no hay costo cargado para el período, se muestra solo el ingreso — nunca un margen inventado.

## Criterios de aceptación

- [ ] Para un período con facturas emitidas, se ve el ingreso real por cliente, ordenable de mayor a menor.
- [ ] Si hay `operational_cost_inputs` para ese período, se ve también el costo estimado y el margen, con una etiqueta visible de "estimado".
- [ ] Si no hay costo cargado, no se muestra ningún margen — solo el ingreso.

---

## Prompt listo para pegar en Lovable

```
Voy a agregar rentabilidad por cliente 3PL a Dashboard 3PL (Sprint 27), combinando datos reales de facturación con una asignación de costo estimada.

1. En Dashboard 3PL, agrega una sección "Rentabilidad por Cliente" para el mismo rango de fechas ya seleccionado:
   - Ingreso: suma de sales_invoices.total_amount por party_id donde status != 'cancelled' (o el nombre real del estado de cancelación en invoice_status) e issue_date dentro del rango.
   - Si existe un operational_cost_inputs para ese rango: calcula la participación de cada cliente como (unidades pickeadas del cliente + una ponderación simple del stock promedio que tuvo, si está disponible) sobre el total de todos los clientes, y reparte el total_cost proporcionalmente. Etiqueta esta columna claramente como "Costo estimado" (no "costo real").
   - Margen = ingreso - costo estimado, mostrado solo cuando hay costo cargado.
   - Si no hay operational_cost_inputs para el rango, muestra solo la columna de ingreso y un aviso de que falta cargar el costo del período para ver rentabilidad.
2. Ordena la tabla por ingreso descendente por defecto, con opción de ordenar por margen cuando esté disponible.

Documenta en .md/CHANGELOG.md y actualiza .md/ARQUITECTURA.md y .md/MODULOS.md. Este es el último sprint del roadmap de la vertical 3PL (16→28) — al terminar, actualiza también .md/RoadMap.md marcando la vertical como completa.
```
