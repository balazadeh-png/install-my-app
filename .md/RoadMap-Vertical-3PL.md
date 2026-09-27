# RoadMap — Vertical 3PL (EasyERP)

## Objetivo

Extender EasyERP con una vertical funcional para empresas 3PL (bodegaje y transporte para terceros), reutilizando el núcleo ya construido y agregando los cuatro dominios definidos en la arquitectura: **Cumplimiento → Operación → Comercial → Inteligencia**.

## Supuestos y dependencias

- Se construye **como vertical de EasyERP**, no como producto paralelo. Se reutiliza el modelo real ya construido: `entities` (multiempresa), `warehouses`/`stock_ledger_entries` (Sprint 5), `parties` (terceros — el mismo directorio sirve para clientes 3PL, sin duplicar el concepto).
- Stack real confirmado en el repo: React 19 + TanStack Start + Supabase, patrón `createServerFn` + RLS vía `user_has_company_access()`.
- Repo: `install-my-app`, carpeta `.md/`. Numeración de sprints continua — el último existente es el 15 (`sprint-15-integracion-apipyme-sii-v2.md`), así que esta vertical arranca en el **Sprint 16**.

> ⚠️ **Corrección importante tras revisar el repo real:** asumí que "el motor DTE ya conectado a ApiPyme" se podía heredar. Es incorrecto — ApiPyme (Sprint 15) solo **lee** datos ya emitidos desde el SII para los Libros Legales; no emite facturas ni guías. La decisión de emisor DTE (comprar vs. construir, sección 3.6 del `RoadMap.md` original) **sigue sin resolverse en los 15 sprints existentes** y es, con el plazo del 1 de noviembre, más urgente que cualquier sprint de esta vertical. Ver el Sprint 16 para el detalle.

- Cada sprint tiene su propio archivo `sprint-NN-descripcion.md` (minúsculas, guiones), generado a medida que se avanza — no todos de una vez.

---

## Fase 1 — Cumplimiento

| # | Sprint | Alcance |
|---|---|---|
| 16 | Modelo de datos 3PL + Guía de Despacho (Res. 154) | `parties.is_3pl_client`, `party_warehouses`, `party_id` en `stock_ledger_entries`, tabla `dispatch_notes` — mecánica interna, sin emisión DTE real (ver dependencia crítica) |
| 17 | Comercio exterior — SICEX | Conexión a SICEX, gestión de DUS, certificados fito/zoosanitarios cuando aplique |
| 18 | Libros heredados + validación de cumplimiento | Conexión de Libro de Ventas (ApiPyme), F29/F22 y declaraciones juradas al nuevo módulo; pruebas end-to-end contra ambiente de certificación SII |

## Fase 2 — Operación

| # | Sprint | Alcance |
|---|---|---|
| 19 | WMS — recepción y ubicación | Recepción con control de calidad, ubicación/slotting por bodega, usando `party_id` del Sprint 16 |
| 20 | WMS — picking, packing y trazabilidad | Picking, packing, cross-docking, trazabilidad por lote/serie |
| 21 | TMS — rutas y flota | Planificación de rutas, gestión de flota propia y de terceros |
| 22 | TMS — tracking y couriers | Tracking GPS en tiempo real, integración con couriers externos (Blue Express, Chilexpress, etc.) |
| 23 | OMS — pedidos multicanal | Pedidos multicanal, integración con e-commerce de los clientes del 3PL, enrutamiento automático a bodega |

## Fase 3 — Comercial

| # | Sprint | Alcance |
|---|---|---|
| 24 | Portal cliente | Vista de inventario en tiempo real (RLS por `party_id`), estado de pedidos/guías, descarga de documentos |
| 25 | Contratos y tarifarios | Configuración de tarifas por pallet/m², por unidad de picking, por km, recargos |
| 26 | Facturación de servicios | Reutiliza `sales_invoices`/`post_sales_invoice` (Sprint 6) facturando al mismo `party_id` marcado como cliente 3PL — recurrente, conciliación automática, notas de crédito/débito |

## Fase 4 — Inteligencia

| # | Sprint | Alcance |
|---|---|---|
| 27 | BI/KPIs operacionales | OTIF por cliente, SLA y alertas, costo por unidad procesada, ocupación de bodega |
| 28 | BI/KPIs comerciales | Rentabilidad por cliente (margen real vs. tarifa cobrada), dashboard ejecutivo |

---

## Estado de los prompts

Los 13 sprints (16–28) tienen su archivo de especificación en `.md/`. La **Fase 1 (Cumplimiento: Sprints 16, 17 y 18)** se encuentra completamente implementada y validada (septiembre 2026), con certificación de no-contaminación contable en `.md/PRODUCCION-3PL.md`.

| # | Archivo | Depende de | Estado |
|---|---|---|:---:|
| 16 | sprint-16-modelo-datos-3pl-guia-despacho-res154.md | — | ✅ Implementado |
| 17 | sprint-17-sicex-comercio-exterior.md | 16 | ✅ Implementado |
| 18 | sprint-18-libros-validacion-cumplimiento.md | 15, 16, 17 | ✅ Validado (`PRODUCCION-3PL.md`) |
| 19 | sprint-19-wms-recepcion-ubicacion.md | 16 | ✅ Implementado |
| 20 | sprint-20-wms-picking-packing-trazabilidad.md | 19 | ⏳ Siguiente (WMS) |
| 21 | sprint-21-tms-rutas-flota.md | 16 | Pendiente |
| 22 | sprint-22-tms-tracking-couriers.md | 21 | Pendiente |
| 23 | sprint-23-oms-pedidos-multicanal.md | 16, 20 |
| 24 | sprint-24-portal-cliente.md | 16 |
| 25 | sprint-25-contratos-tarifarios.md | 16 |
| 26 | sprint-26-facturacion-servicios.md | 6, 25 |
| 27 | sprint-27-bi-kpis-operacionales.md | 16, 19, 20, 21 |
| 28 | sprint-28-bi-kpis-comerciales.md | 26, 27 |

Dependencias externas que ningún sprint resuelve por sí solo (siguen abiertas, cada una marcada en su archivo): emisor DTE (16/26), habilitación SICEX (17), integración específica de couriers/GPS (22), integración específica de canal de e-commerce (23).
