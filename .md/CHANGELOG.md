# Registro de Cambios y Mejoras (Changelog) - EasyERP

Todos los cambios notables, nuevas funcionalidades y mejoras en el proyecto se registran en este documento.

---

## [Sprint 16: Modelo de datos 3PL + Guía de Despacho (Res. 154)] - 2026-09-26

### Añadido
* `parties.is_3pl_client`, tabla `party_warehouses`, `stock_ledger_entries.party_id`, vista `stock_balances` con `party_id`.
* Enums `dispatch_transfer_type` y `dispatch_status`; tablas `dispatch_notes` y `dispatch_note_lines` con RLS multiempresa.
* Pantalla **Guías de Despacho 3PL** (`dispatch.tsx`): alta de guías en borrador y gestión de clientes 3PL con selector multi-bodega.
* Filtro/columna de propietario (propio / cliente 3PL) en "Saldos por Bodega".
* Sin botón de emisión al SII: pendiente de la decisión de emisor DTE.

---

## [Sprint 15: Integración SII vía ApiPyme (Registro de Ventas, Compras y Boletas)] - 2026-08-27

### Añadido
* **Migración SQL de Conexión y Sincronización ApiPyme** ([`supabase/migrations/20260825000014_sprint15_integracion_apipyme.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000014_sprint15_integracion_apipyme.sql)):
  * `sii_api_connections`: almacenamiento seguro del token `X-Company-Token` con política RLS restrictiva `no_client_access` (`USING (false)`), gestionado exclusivamente desde el backend con Service Role Key.
  * Enum `sii_document_type` (`venta`, `compra`) y enum `sii_sync_status` (`PENDING`, `RUNNING`, `SUCCESS`, `FAILED`).
  * `sii_synced_documents`: tabla para almacenar facturas (33), exentas (34), notas de débito (56) y notas de crédito (61) descargadas del SII, con índice único por `(entity_id, document_type, period, sii_doc_type, folio, party_tax_id)`.
  * `sii_boletas_summary`: tabla para el agregado oficial de boletas electrónicas por período (`cantidad_documentos`, `monto_neto`, `monto_exento`, `monto_iva`, `monto_total`).
  * `sii_sync_jobs`: trazabilidad de tareas de extracción asíncronas y webhooks con `apipyme_task_id`.
* **Funciones de Servidor Seguras ([`sii-sync.functions.ts`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/lib/sii-sync.functions.ts))**:
  * `verifyApiPymeToken`: validación en vivo contra `GET https://apipyme.cl/api/v1/empresa/` retornando razón social, RUT y estado de licencia antes de guardar.
  * `saveApiPymeConnection`: persistencia server-side aislada del token.
  * `getApiPymeConnectionStatus`: consulta de estado de conexión sin exponer el token al navegador.
  * `fetchAllPages`: paginación completa en lotes de hasta 5.000 documentos con soporte de código HTTP 202 (asíncrono).
  * `syncSiiDocuments`: función de sincronización para usuarios con validación de acceso multiempresa.
* **Webhook Receiver Oficial ([`src/routes/api/webhooks/apipyme.ts`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/api/webhooks/apipyme.ts))**:
  * Endpoint HTTP POST `/api/webhooks/apipyme` para recibir notificaciones automáticas de extracción de ApiPyme con validación del header `X-Webhook-Secret`.
* **Interfaz de Configuración ([`setup.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/setup.tsx))**:
  * Pestaña "Conexión SII (ApiPyme)" con verificación interactiva del token, datos de empresa autorizada en el SII y guardado seguro.
* **Módulo de Libros Legales SII ([`sii-books.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/sii-books.tsx))**:
  * Modal y botón de "Sincronizar desde SII (ApiPyme)" por período fiscal (`YYYYMM`).
  * Visualización del **Resumen Oficial de Boletas Electrónicas (`sii_boletas_summary`)** en el Libro de Ventas.
  * Panel de historial de extracciones con estados (`PENDING`, `RUNNING`, `SUCCESS`, `FAILED`).

---

## [Sprint 14: Reorganización del Dashboard por Grupos Temáticos] - 2026-08-25

### Añadido
* **Migración SQL de Organización del Dashboard** ([`supabase/migrations/20260825000013_sprint14_organizacion_dashboard.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000013_sprint14_organizacion_dashboard.sql)).
* Reorganización en 4 grupos temáticos: Finanzas, Operaciones, Impuestos y Configuración.

---

## [Sprint 13: Declaraciones Juradas SII (DDJJ)] - 2026-08-25

### Añadido
* **Migración SQL del Motor de Declaraciones Juradas** ([`supabase/migrations/20260825000012_sprint13_declaraciones_juradas.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000012_sprint13_declaraciones_juradas.sql)).
* Módulo interactivo en `declaraciones-juradas.tsx`.

---

## [Sprint 12: Declaración de Impuestos SII - F29 y F22] - 2026-08-25

### Añadido
* **Migración SQL de Declaraciones de Impuestos** ([`supabase/migrations/20260825000011_sprint12_impuestos_f29_f22.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000011_sprint12_impuestos_f29_f22.sql)).
* Módulo en `taxes.tsx`.

---

## [Sprint 11: Libros Legales SII y Conciliación RCV] - 2026-08-25

### Añadido
* **Migración SQL de Libros Legales SII** ([`supabase/migrations/20260825000010_sprint11_libros_sii.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000010_sprint11_libros_sii.sql)).
* Módulo en `sii-books.tsx`.

---

## [Sprint 10: Ventas POS, Boletas y Arqueo de Caja] - 2026-08-25

### Añadido
* **Migración SQL del Punto de Venta POS** ([`supabase/migrations/20260825000009_sprint10_ventas_pos.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000009_sprint10_ventas_pos.sql)).
* Módulo en `pos.tsx`.

---

## [Sprint 9: Módulo de Producción Simple & Lista de Materiales (BOM)] - 2026-08-25

### Añadido
* **Migración SQL de Producción y Recetas BOM** ([`supabase/migrations/20260825000008_sprint09_produccion_bom.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000008_sprint09_produccion_bom.sql)).
* Módulo en `production.tsx`.

---

## [Sprint 8: Activos Fijos y Depreciación Mensual Automática] - 2026-08-25

### Añadido
* **Migración SQL de Activos Fijos** ([`supabase/migrations/20260825000007_sprint08_activos_fijos.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000007_sprint08_activos_fijos.sql)).
* Módulo en `assets.tsx`.

---

## [Sprint 7: Cierre de Período y Revalorización Cambiaria Multimoneda] - 2026-08-25

### Añadido
* **Migración SQL de Cierre y Revalorización** ([`supabase/migrations/20260825000006_sprint07_cierre_revalorizacion.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000006_sprint07_cierre_revalorizacion.sql)).

---

## [Sprint 6: Ciclo Transaccional de Ventas y Compras] - 2026-08-25

### Añadido
* **Migración SQL Transaccional** ([`supabase/migrations/20260825000005_sprint06_ventas_compras_transaccional.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000005_sprint06_ventas_compras_transaccional.sql)).

---

## [Sprint 5: Multibodega Real, Movimientos de Stock y Kardex FIFO] - 2026-08-25

### Añadido
* **Migración SQL del Motor de Inventario** ([`supabase/migrations/20260825000004_sprint05_multibodega_kardex_fifo.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000004_sprint05_multibodega_kardex_fifo.sql)).

---

## [Sprint 4: Centros de Costo y Unidades/Sucursales] - 2026-08-25

### Añadido
* **Migración SQL de Dimensiones Analíticas** ([`supabase/migrations/20260825000003_sprint04_centros_costo_unidades.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000003_sprint04_centros_costo_unidades.sql)).

---

## [Sprint 3: Multimoneda a Nivel de Cuenta y Comprobantes] - 2026-08-25

### Añadido
* **Migración SQL Multimoneda** ([`supabase/migrations/20260825000002_sprint03_multimoneda_cuentas.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000002_sprint03_multimoneda_cuentas.sql)).

---

## [Sprint 2: Motor Contable de Partida Doble e Inmutabilidad] - 2026-08-25

### Añadido
* **Migración SQL del Motor Contable** ([`supabase/migrations/20260825000001_sprint02_motor_partida_doble.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000001_sprint02_motor_partida_doble.sql)).

---

## [Sprint 1: Multiempresa Real y Seguridad RLS] - 2026-08-25

### Añadido
* **Migración SQL Multiempresa** ([`supabase/migrations/20260825000000_sprint01_multiempresa_rls.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260825000000_sprint01_multiempresa_rls.sql)).
