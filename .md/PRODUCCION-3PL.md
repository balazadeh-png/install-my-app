# Validación de Cumplimiento & Guía de Puesta en Producción (3PL)

**Fase:** 1 — Vertical 3PL / Cumplimiento  
**Sprints cubiertos:** Sprint 15 (ApiPyme), Sprint 16 (Modelo 3PL & Res. 154), Sprint 17 (SICEX / Comex), Sprint 18 (Validación)  
**Fecha de Validación:** Septiembre 2026  
**Estado:** ✅ APROBADO TÉCNICAMENTE — Listo para iniciar Fase 2 (Operación / WMS / TMS)

---

## 1. Resumen Ejecutivo

El presente documento certifica la **validación técnica, segregación de datos y aislamiento contable** de las extensiones para operadores logísticos terceros (Vertical 3PL) desarrolladas sobre EasyERP.

Se ha confirmado que la incorporación de clientes 3PL en custodia (`parties.is_3pl_client`), la asignación de bodegas autorizadas (`party_warehouses`), las guías de despacho internas conforme a la **Resolución Exenta N° 154 del SII** (`dispatch_notes`), y los expedientes aduaneros de comercio exterior (`foreign_trade_operations` / `foreign_trade_certificates`):
1. **No contaminan** los Libros Contables Oficiales (Libro de Ventas, Compras, Diario, Mayor, Balance de 8 Columnas).
2. **No interfieren** con la sincronización tributaria de ApiPyme (`sii_synced_documents`) ni los cálculos de impuestos mensuales (F29).
3. **Mantienen estricto aislamiento multiempresa** mediante políticas de seguridad a nivel de fila (RLS) en Supabase con `user_has_company_access(auth.uid(), entity_id)`.
4. **Garantizan la cuadratura del inventario** mediante la vista `stock_balances` que agrupa y discrimina el stock propio (`party_id IS NULL`) del stock en custodia de terceros (`party_id IS NOT NULL`).

---

## 2. Checklist de QA Manual (Criterios de Aceptación)

| Ítem | Prueba de Validación | Criterio de Éxito | Estado |
|---|---|---|:---:|
| **QA-01** | Creación de clientes 3PL en distintas bodegas | Clientes marcados con `is_3pl_client = true` en `/setup` se vinculan atómicamente a bodegas autorizadas en `party_warehouses`. | ✅ PASS |
| **QA-02** | Recepciones e inventario cruzado | Registros en `stock_ledger_entries` con `party_id` de cliente se reflejan en `/inventory` bajo "Saldos por Bodega", mostrando propietario y RUT sin mezclar stocks. | ✅ PASS |
| **QA-03** | Emisión de Guía de Despacho (Res. 154) | Guía creada en `/dispatch` captura transportista, RUT, patente, direcciones origen/destino georreferenciadas, fechas exactas y queda en estado `draft`. | ✅ PASS |
| **QA-04** | No-contaminación del Libro de Ventas (ApiPyme) | La guía de despacho emitida en estado `draft` **NO aparece** en `/sii-books` (Libro de Ventas) ni en `sii_synced_documents` porque no es una venta comercial ni un DTE timbrado. | ✅ PASS |
| **QA-05** | Auditoría de Políticas RLS en Supabase | Verificado que `dispatch_notes`, `dispatch_note_lines`, `party_warehouses`, `foreign_trade_operations` y `foreign_trade_certificates` tienen RLS activo basado en `entity_id` y roles autorizados. | ✅ PASS |
| **QA-06** | Cuadratura de saldos de inventario | El saldo de `stock_balances` filtrado por cliente 3PL cuadra exactamente con la sumatoria de `qty_change` de `stock_ledger_entries` para 3 casos de prueba. | ✅ PASS |

---

## 3. Demostración Técnica de Aislamiento y Segregación

### 3.1. Convivencia y No-Contaminación: Guías 3PL vs. Libro de Ventas (ApiPyme)
* **Libro de Ventas y RCV (Sprint 15)**:
  * El módulo contable/tributario consulta la tabla `sii_synced_documents` mediante la función RPC `get_sii_book_data` y queries directas filtradas por `document_type = 'venta'`.
  * Los documentos que alimentan este libro provienen exclusivamente de:
    1. Facturas y notas emitidas mediante `sales_invoices` (cuando son contabilizadas mediante `post_sales_invoice` que genera asientos contables en `gl_entries`).
    2. Documentos oficiales timbrados ante el SII descargados asíncronamente desde la API de ApiPyme (`sii_sync_jobs`).
* **Guías de Despacho 3PL (Sprint 16)**:
  * Residen en la tabla dedicada `public.dispatch_notes` y sus líneas en `public.dispatch_note_lines`.
  * Tienen su propio enum `dispatch_status` (`draft`, `issued`, `cancelled`).
  * En esta fase, su creación **no genera asientos contables en `gl_entries`** ni inserta registros en `sales_invoices` o `sii_synced_documents`.
  * **Conclusión**: No existe ningún trigger, vista o relación que inserte las guías internas en el Libro de Ventas ni en el Formulario 29. Ambos subsistemas operan en total independencia.

### 3.2. Cuadratura Matemática de `stock_balances`
La vista `stock_balances` fue redefinida en el Sprint 16 con `security_invoker = true`:
```sql
SELECT 
    s.entity_id,
    s.item_id,
    s.warehouse_id,
    s.party_id,
    p.name AS party_name,
    p.tax_id AS party_tax_id,
    i.code AS item_code,
    i.name AS item_name,
    w.code AS warehouse_code,
    w.name AS warehouse_name,
    COALESCE(SUM(s.qty_change), 0) AS qty_on_hand,
    COALESCE(SUM(s.qty_change * s.valuation_rate), 0) AS value_on_hand,
    ...
FROM public.stock_ledger_entries s
JOIN public.items i ON i.id = s.item_id
JOIN public.warehouses w ON w.id = s.warehouse_id
LEFT JOIN public.parties p ON p.id = s.party_id
GROUP BY s.entity_id, s.item_id, s.warehouse_id, s.party_id, p.name, p.tax_id, i.code, i.name, w.code, w.name;
```

#### Casos de Prueba Verificados:
1. **Caso 1: Inventario Propio (Stock Compañía)**:
   * Entrada: 100 unidades del ítem `PROD-01` en Bodega Central con `party_id = NULL`.
   * Saldo `stock_balances` para `party_id IS NULL`: `qty_on_hand = 100`, `party_name = NULL`.
2. **Caso 2: Inventario Cliente 3PL "Agrícola del Valle SpA"**:
   * Entrada: 50 unidades del ítem `PROD-01` en Bodega Frío con `party_id = 'uuid-cliente-A'`.
   * Saldo `stock_balances` para `party_id = 'uuid-cliente-A'`: `qty_on_hand = 50`, `party_name = 'Agrícola del Valle SpA'`.
3. **Caso 3: Inventario Cliente 3PL "Exportadora del Sur Ltda"**:
   * Entrada: 30 unidades del ítem `PROD-01` en Bodega Frío con `party_id = 'uuid-cliente-B'`.
   * Saldo `stock_balances` para `party_id = 'uuid-cliente-B'`: `qty_on_hand = 30`, `party_name = 'Exportadora del Sur Ltda'`.
* **Resultado de Cuadratura**:
  * Total físico real en Bodega Frío = 80 unidades.
  * Agrupación por propietario: 50 (Cliente A) + 30 (Cliente B) = 80 unidades exactas.
  * Ningún cliente puede ver el inventario del otro gracias al filtrado y políticas RLS.

---

## 4. Matriz de Auditoría RLS (Row Level Security)

Se auditó en el esquema de PostgreSQL de Supabase que todas las tablas introducidas o modificadas en los Sprints 16 y 17 implementen aislamiento multiempresa:

| Tabla | RLS Habilitado | Política de Lectura (SELECT) | Política de Escritura (INSERT/UPDATE/DELETE) |
|---|:---:|---|---|
| `party_warehouses` | ✅ SÍ | `EXISTS (parties p WHERE p.id = party_id AND user_has_company_access(uid, p.entity_id))` | `EXISTS (parties p WHERE p.id = party_id AND has_role(...) AND user_has_company_access(uid, p.entity_id))` |
| `dispatch_notes` | ✅ SÍ | `user_has_company_access(auth.uid(), entity_id)` | `user_has_company_access(auth.uid(), entity_id) AND has_role(...)` |
| `dispatch_note_lines` | ✅ SÍ | `EXISTS (dispatch_notes dn WHERE dn.id = dispatch_note_id AND user_has_company_access(uid, dn.entity_id))` | `EXISTS (dispatch_notes dn WHERE dn.id = dispatch_note_id AND has_role(...) AND user_has_company_access(uid, dn.entity_id))` |
| `foreign_trade_operations` | ✅ SÍ | `user_has_company_access(auth.uid(), entity_id)` | `user_has_company_access(auth.uid(), entity_id) AND has_role(...)` |
| `foreign_trade_certificates`| ✅ SÍ | `EXISTS (foreign_trade_operations fto WHERE fto.id = operation_id AND user_has_company_access(uid, fto.entity_id))` | `EXISTS (foreign_trade_operations fto WHERE fto.id = operation_id AND has_role(...) AND user_has_company_access(uid, fto.entity_id))` |

---

## 5. Lista de Bloqueantes de Negocio Pendientes (Pre-requisitos Go-Live Real)

Para operar con clientes 3PL en **producción real** con timbrado tributario y despachos en carretera, se deben levantar los siguientes dos bloqueantes de negocio:

### 🔴 Bloqueante 1: Motor Emisor DTE (Sprint 16 & Sprint 26)
* **Descripción**:
  * La **Resolución Exenta N° 154 del SII** (de exigencia obligatoria a contar del **1 de noviembre de 2026**) estipula que las Guías de Despacho que trasladen mercaderías en territorio nacional deben ser electrónicas (DTE Tipo 52), portar el Timbre Electrónico del SII (TED), código de barras bidimensional (PDF417) y transmitirse al SII antes de que el vehículo inicie el traslado.
  * La integración actual de ApiPyme (Sprint 15) es exclusivamente de **lectura / descarga** de documentos emitidos desde el SII; no emite DTEs ni administra folios CAF.
* **Acción Requerida**:
  * Adoptar formalmente la decisión de arquitectura DTE (Sección 3.6 de `RoadMap.md`):
    * **Opción A (Recomendada - Comprar)**: Integrar API de emisión certificada (ej. LibreDTE, Facturacion.cl, OpenFactura o Haulmer) mediante webhooks y generación de DTE 52 / DTE 33.
    * **Opción B (Construir)**: Certificarse como emisor directo ante el SII, implementando servidor de firma digital XML, timbrado CAF y schema validation del SII.
* **Estado Actual en EasyERP**:
  * El sistema emite y gestiona las guías bajo la estructura exacta de la Res. 154 en estado `draft` (borrador referencial con folio interno), listo para acoplar la llamada al motor DTE en el hook de confirmación.

### 🔴 Bloqueante 2: Habilitación de Credenciales SICEX (Sprint 17)
* **Descripción**:
  * El Sistema Integrado de Comercio Exterior (SICEX) del Servicio Nacional de Aduanas permite la tramitación digital unificada ante Aduanas, SAG, SERNAPESCA y SOFOFA.
  * Para enviar electrónicamente el Documento Único de Salida (DUS) o Declaración de Ingreso (DIN), la empresa debe poseer firma electrónica avanzada (FEA) de tramitador o agente de aduanas acreditado y credenciales API en el portal SICEX.
* **Acción Requerida**:
  * Tramitar con el Servicio Nacional de Aduanas el alta en el ambiente de pruebas (QA) y producción de la API SICEX.
  * Configurar los tokens en Supabase Secrets o tabla de credenciales protegida server-side.
* **Estado Actual en EasyERP**:
  * El expediente Comex y los certificados sanitarios/origen se gestionan en estado interno `pendiente`/`tramitando`/`autorizado` con alertas de vigencia, listos para conectar los webhooks aduaneros oficiales.

---

## 6. Procedimiento de Puesta en Marcha (Go-Live Runbook)

Cuando se resuelvan los bloqueantes externos (DTE y SICEX), los pasos de configuración para habilitar a un cliente 3PL son:

1. **Creación del Tercero**:
   * Ir a `/setup` → Pestaña **"Terceros & 3PL"**.
   * Crear o editar el cliente ingresando RUT y Razón Social.
   * Activar el toggle **"¿Es Cliente 3PL?"** y seleccionar las bodegas de la empresa asignadas al cliente. Guardar cambios.
2. **Recepción Inicial de Carga**:
   * En `/inventory` → "Nuevo Movimiento", registrar tipo `receipt` seleccionando el cliente 3PL propietario en el selector **"Propietario 3PL"**.
   * La mercadería queda identificada en custodia en `stock_balances`.
3. **Emisión de Guía de Despacho (Res. 154)**:
   * Ir a `/dispatch` → Pestaña **"Nueva Guía (Res. 154)"**.
   * Seleccionar el cliente 3PL y bodega de origen (restringida a las autorizadas).
   * Ingresar Transportista, RUT, Patente, Direcciones y Horarios exactos.
   * Agregar ítems (con peso kg y volumen m³ calculados).
   * Emitir en estado `draft` (o transmitir al motor DTE una vez activo el Bloqueante 1).
4. **Vinculación con Comercio Exterior (si aplica)**:
   * En `/dispatch` → Pestaña **"Comercio Exterior"**, registrar expediente aduanero (DUS/DIN, Booking) y vincular la Guía de Despacho.
   * Adjuntar certificados fitosanitarios/zoosanitarios con sus respectivas fechas de vencimiento.

---

## 7. Dictamen Final del Sprint 18

> **Fase 1 (Cumplimiento) queda oficialmente cerrada.**
> 
> Los modelos de datos, validaciones de integridad, no-contaminación contable y políticas de seguridad RLS han sido satisfactoriamente verificados. Se autoriza el inicio de la **Fase 2: Operación (Sprint 19: WMS — Recepción y Ubicación por Pasillo/Rack)**.
