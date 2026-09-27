# Registro de Cambios y Mejoras (Changelog) - EasyERP

Todos los cambios notables, nuevas funcionalidades y mejoras en el proyecto se registran en este documento.

## [Sprint 22: TMS — Tracking de Paradas y Couriers Externos] - 2026-09-27

### Añadido
* **Migración SQL de Tracking de Entregas y Couriers** ([`supabase/migrations/20260927000021_sprint22_tms_tracking_couriers.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260927000021_sprint22_tms_tracking_couriers.sql)):
  * Enum `stop_delivery_status`: estados de cumplimiento por parada (`pendiente`, `en_ruta`, `entregado`, `no_entregado`).
  * Columnas en `route_stops`:
    * `delivery_status`: estado de cumplimiento por parada (`DEFAULT 'pendiente' NOT NULL`).
    * `arrived_at`: marca temporal de entrega/arribo efectivo.
    * `lat` y `lng`: coordenadas geográficas decimales (`numeric(9,6)`).
    * `received_by`: nombre o RUT de quien recepciona la mercadería.
    * `delivery_notes`: observaciones u justificación de no entrega.
    * Índice `idx_route_stops_delivery_status` para consultas de tracking.
  * Columnas en `dispatch_notes`:
    * `courier_name`: nombre de la empresa de encomienda externa (ej. Chilexpress, Blue Express, Starken).
    * `courier_tracking_number`: código de seguimiento o número de orden de transporte (OT).
    * `courier_status`: estado reportado por el courier.
    * Índice `idx_dispatch_notes_courier_tracking`.
* **Seguimiento de Entregas en Hoja de Ruta ([`dispatch.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dispatch.tsx))**:
  * Badges visuales de estado por parada: `Pendiente`, `En Ruta`, `Entregado` y `No Entregado`.
  * Acciones operativas directas por parada:
    * Botón "Marcar Entregado": abre modal contextual de entrega.
    * Botón "En Ruta": actualización rápida de estado.
    * Botón "No Entregado": captura motivo de rechazo o ausencia del destinatario.
    * Botón "Reabrir Parada": para correcciones operativas.
  * Modal interactivo "Actualizar Estado de Entrega":
    * Captura de receptor (`received_by`) con validación de campo requerido para entregas exitosas.
    * Botón de geolocalización GPS integrada (`navigator.geolocation.getCurrentPosition`) que captura latitud y longitud desde el navegador sin interrumpir el flujo si el permiso es denegado o no hay señal GPS.
    * Visualización de coordenadas capturadas con enlace directo a Google Maps (`https://www.google.com/maps?q=lat,lng`).
* **Soporte de Couriers Externos en Guías de Despacho ([`dispatch.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dispatch.tsx))**:
  * Sección "Transporte vía Courier Externo (Opcional)" en el formulario de Nueva Guía.
  * Captura de empresa courier, número de tracking y estado inicial, desacoplado de vehículos y rutas internas.
  * Visualización de badges de courier y tracking en la tabla general de guías registradas.
* **Tipos TypeScript ([`types.ts`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/integrations/supabase/types.ts))**:
  * Tipado de `stop_delivery_status` en Enums y Constants.
  * Tipado de nuevas columnas en `route_stops` y `dispatch_notes`.

---

## [Sprint 21: TMS — Rutas de Reparto y Gestión de Flota Propia] - 2026-09-27

### Añadido
* **Migración SQL de TMS Rutas y Flota Propia** ([`supabase/migrations/20260927000020_sprint21_tms_rutas_flota.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260927000020_sprint21_tms_rutas_flota.sql)):
  * Tabla `vehicles`: registro de camiones y utilitarios propios (`plate` en mayúsculas, `vehicle_type`, `capacity_kg`, `capacity_m3`, `active`), restricción de unicidad por empresa `(entity_id, plate)` y políticas RLS multiempresa.
  * Enum `route_status`: estados operacionales de ruta (`planificada`, `en_curso`, `finalizada`, `cancelada`).
  * Tabla `routes`: planificación de hojas de ruta (`route_date`, `vehicle_id` nullable para flota propia o transporte tercerizado, `driver_name`, `status`, `name`, `notes`, `entity_id`) y RLS multiempresa.
  * Tabla `route_stops`: asignación y secuenciación de entregas (`route_id` ON DELETE CASCADE, `dispatch_note_id`, `stop_order`, `notes`), restricción de unicidad `(route_id, dispatch_note_id)` y RLS validado contra `routes.entity_id`.
* **Módulo de Flota Propia en Frontend ([`dispatch.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dispatch.tsx))**:
  * Pestaña "Flota Propia" con tabla de vehículos registrados, patente, carrocería, capacidades de peso/volumen y badge de disponibilidad.
  * Modal para registrar o editar vehículos con validación de patente y switch de activación rápida.
* **Módulo de Rutas TMS en Frontend ([`dispatch.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dispatch.tsx))**:
  * Pestaña "Rutas TMS" con tarjetas de métricas en tiempo real (Rutas Planificadas, En Curso, Finalizadas y Total Vehículos Activos).
  * Modal interactivo "Planificar Ruta de Reparto":
    * Selección de fecha, nombre de ruta, conductor y vehículo de flota propia (o transporte tercerizado).
    * Cálculo y medidores dinámicos de peso total (`kg`) y cubicaje (`m³`) de la carga asignada con barras de porcentaje y advertencias visuales de sobrecarga.
    * Secuenciación de paradas con botones Arriba (`moveStopUp`), Abajo (`moveStopDown`) y Eliminar.
    * Catálogo de guías disponibles para agregar con un clic.
  * Modal de Hoja de Ruta TMS:
    * Visualización detallada de paradas ordenadas (#1, #2, #3...) con dirección, cliente 3PL, líneas, estado de picking y packing.
    * Acciones de control de ciclo de vida de la ruta ("Iniciar Ruta", "Finalizar Ruta", "Cancelar Ruta", "Reabrir").
    * **Garantía de Independencia de Ciclos de Vida**: El cambio de estado de la ruta no altera los estados documentales de las guías de despacho individuales.
* **Tipos TypeScript ([`types.ts`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/integrations/supabase/types.ts))**:
  * Tipado de `vehicles`, `routes`, `route_stops` y enum `route_status`.

---

## [Sprint 20: WMS — Picking, Packing y Trazabilidad de Lotes] - 2026-09-27

### Añadido
* **Migración SQL de Picking, Packing y Trazabilidad** ([`supabase/migrations/20260927000019_sprint20_wms_picking_packing_trazabilidad.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260927000019_sprint20_wms_picking_packing_trazabilidad.sql)):
  * Nuevas columnas en `dispatch_note_lines`:
    * `location_id`: sub-ubicación física de bodega desde donde se retira el ítem (`warehouse_locations(id)` ON DELETE SET NULL).
    * `lot_number`: número de lote registrado para la partida específica pickeada.
    * `picked`: indicador booleano de avance físico de picking (`DEFAULT false NOT NULL`).
    * `packed`: indicador booleano de avance físico de embalaje (`DEFAULT false NOT NULL`).
    * `picked_at`: marca temporal de confirmación del picking.
    * `packed_at`: marca temporal de confirmación del embalaje.
  * Índices dedicados en `(location_id)`, `(lot_number)`, `(picked)` y `(packed)` para búsquedas de alta concurrencia y consultas de auditoría de trazabilidad.
* **Ciclo Operativo de Picking con Salida Automática de Inventario ([`dispatch.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dispatch.tsx))**:
  * Botón "Detalle & Picking" por cada guía de despacho registrada:
    * Modal completo de detalle con información del transporte, origen, destino, cliente 3PL y bodega.
    * Contadores de progreso en tiempo real de Picking (`X/Total`) y Packing (`X/Total`).
    * Botón "Pickear" por línea que despliega el formulario contextual:
      * Selección de la sub-ubicación física filtrada por la bodega de la guía.
      * Ingreso del número de lote.
      * Confirmación de picking que marca `picked = true` e inserta automáticamente una salida de inventario (`stock_ledger_entries`, `movement_type = 'issue'`, `valuation_rate = 0` calculada por FIFO en base de datos, `voucher_type = 'dispatch_note'`, `voucher_id = guide.id`), cerrando la brecha entre la guía documental y el stock real en custodia.
* **Flujo de Packing y Estado "Lista para Despacho" ([`dispatch.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dispatch.tsx))**:
  * Checkbox interactivo "Empacada" por línea en el modal de detalle, condicionado a que la línea esté previamente pickeada (`picked = true`).
  * Al completar el 100% de las líneas empacadas:
    * Se activa el badge visual "Lista para despacho" (`CheckCircle2`).
    * Se despliega un banner de confirmación física indicando que el pedido puede cargarse al camión asignado (el estado DTE tributario se preserva en `draft` para no contaminar libros hasta la emisión oficial).
* **Pestaña de Trazabilidad 360° por Lote ([`dispatch.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dispatch.tsx))**:
  * Buscador interactivo por número de lote.
  * Reporte dual consolidado:
    1. **Salidas en Guías de Despacho**: número de guía, cliente 3PL, ítem, cantidad despachada, ubicación física de picking, fecha de salida, destino, transportista y estado de packing.
    2. **Historial Kardex del Lote**: trazabilidad de entradas (recepciones), notas de control de calidad (QC), ajustes y salidas previas registradas para el lote consultado.
* **Tipos TypeScript ([`types.ts`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/integrations/supabase/types.ts))**:
  * Tipado de `dispatch_notes`, `dispatch_note_lines` (con `location_id`, `lot_number`, `picked`, `packed`, etc.), `warehouse_locations`, `foreign_trade_operations` y `party_warehouses`.

---

## [Sprint 19: WMS — Recepción y Ubicación por Pasillo/Rack/Posición] - 2026-09-27

### Añadido
* **Migración SQL de Ubicaciones WMS (Slotting) y Control de Lotes/Calidad** ([`supabase/migrations/20260927000018_sprint19_wms_recepcion_ubicacion.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260927000018_sprint19_wms_recepcion_ubicacion.sql)):
  * `warehouse_locations`: sub-ubicaciones físicas dentro de una bodega (`warehouse_id`, `code`, `name`, `entity_id`, `is_active`) con clave única compuesta `(warehouse_id, code)` y RLS multiempresa.
  * Extensión en `stock_ledger_entries`:
    * `location_id`: clave foránea opcional a `warehouse_locations(id)`.
    * `lot_number`: número de lote para trazabilidad básica de partida.
    * `qc_notes`: observaciones y checklist de control de calidad al momento del ingreso.
  * Redefinición de la vista `stock_balances` (`security_invoker = true`):
    * Incorporación de `location_id`, `location_code` y `location_name` en `SELECT` y `GROUP BY`, permitiendo consultar saldos consolidados por ubicación física además de por bodega y cliente 3PL.
* **Pestaña "Recepción WMS" en Operaciones 3PL ([`dispatch.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dispatch.tsx))**:
  * Formulario completo para registrar recepciones físicas de mercadería en custodia:
    * Selector de cliente 3PL y bodega autorizada (`party_warehouses`).
    * Selector de ubicación física con botón modal rápido "+ Nueva Ubicación" para crear pasillo/rack sin salir del flujo.
    * Selector de artículo, cantidad y valorización unitaria para generación automática de la capa FIFO.
    * Captura de N° de Lote opcional y observaciones de Control de Calidad (QC).
  * Tarjetas KPI en tiempo real: Total Recepciones WMS, Unidades Recibidas en Custodia, Ubicaciones Activas Registradas y Bodegas de Acopio.
  * Panel histórico de recepciones recientes con badges de cliente, bodega, ubicación (`MapPin`), lote y notas de inspección técnica.
* **Filtro y Columna de Ubicación en Inventario ([`inventory.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/inventory.tsx))**:
  * Pestaña "Saldos por Bodega":
    * Nuevo filtro interactivo por "Ubicación WMS" contextualizado a la bodega seleccionada.
    * Nueva columna "Ubicación (WMS)" con badges visuales por código de rack/pasillo.
  * Modal "Registrar Movimiento":
    * Selector opcional de ubicación WMS filtrado por la bodega destino.
    * Campos opcionales de N° de Lote y Control de Calidad (QC) en entradas de inventario.
  * Pestaña "Kardex de Movimientos": visualización de ubicación física y lote en cada movimiento registrado.
* **Tipos TypeScript ([`types.ts`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/integrations/supabase/types.ts))**:
  * Definición tipada de la tabla `warehouse_locations`, extensión de `stock_ledger_entries` y vista `stock_balances`.

---

## [Sprint 18: Libros Heredados y Validación de Cumplimiento 3PL] - 2026-09-27

### Añadido & Validado
* **Documento de Validación y Puesta en Producción ([`PRODUCCION-3PL.md`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/.md/PRODUCCION-3PL.md))**:
  * Certificación de **no-contaminación contable**: comprobado que las guías de despacho internas (`dispatch_notes`, estado `draft`) no se insertan en el Libro de Ventas (`sii_synced_documents`) ni en los asientos contables de partida doble (`gl_entries`), manteniendo intacta la conciliación RCV y F29 provista por ApiPyme (Sprint 15).
  * Validación matemática y lógica de **cuadratura de inventario (`stock_balances`)**: comprobado que la agrupación por `party_id` segrega con precisión el stock propio (`party_id IS NULL`) del inventario en custodia de terceros (`party_id IS NOT NULL`), cuadrando exactamente con el acumulado de `qty_change` de `stock_ledger_entries`.
  * **Auditoría de Políticas RLS**: verificación de que `party_warehouses`, `dispatch_notes`, `dispatch_note_lines`, `foreign_trade_operations` y `foreign_trade_certificates` aplican Row Level Security estricto con `user_has_company_access(auth.uid(), entity_id)`.
  * **Registro explícito de bloqueantes de negocio pre-operación**:
    1. **Motor Emisor DTE (Sprint 16/26)**: Selección e integración de proveedor para timbrado CAF y generación de DTE Tipo 52 exigido por Res. Ex. N° 154 SII a contar del 1 de noviembre de 2026.
    2. **Habilitación SICEX (Sprint 17)**: Gestión de certificado digital y credenciales ante el Servicio Nacional de Aduanas para consumo de API y webhooks en vivo.
  * **Cierre oficial de la Fase 1 (Cumplimiento)** y autorización para avanzar a la Fase 2 (Operación: WMS / TMS).

---

## [Sprint 17: Comercio Exterior (SICEX)] - 2026-09-27

### Añadido
* **Migración SQL de Comercio Exterior y Certificados Sanitarios** ([`supabase/migrations/20260927000017_sprint17_sicex_comercio_exterior.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260927000017_sprint17_sicex_comercio_exterior.sql)):
  * Enums de comercio exterior: `ft_operation_type` (`exportacion`, `importacion`) y `ft_customs_status` (`pendiente`, `tramitando`, `autorizado`, `rechazado`).
  * `foreign_trade_operations`: registro de expedientes aduaneros para clientes 3PL (`entity_id`, `party_id`, `operation_type`, `country_code`, `dus_number`, `booking_number`, `customs_status` con valor predeterminado `'pendiente'`, notas y vínculo opcional con `dispatch_notes`).
  * `foreign_trade_certificates`: repositorio de certificados fitosanitarios (SAG), zoosanitarios (SAG/SERNAPESCA), de origen (SOFOFA/Cámara de Comercio), registros sanitarios (ISP) u otros, con número, emisor y fecha de vigencia (`valid_until`), asociados en cascada a la operación.
  * Políticas de seguridad RLS multiempresa en ambas tablas aplicando `public.user_has_company_access(auth.uid(), entity_id)` y roles autorizados (`admin`, `inventory`, `sales`, `accountant`).
* **Pestaña de Comercio Exterior (SICEX) en el Módulo Logístico ([`dispatch.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dispatch.tsx))**:
  * Pestaña interactiva "Comercio Exterior (SICEX)" junto a "Guías de Despacho (Res. 154)".
  * Formulario modal para registrar operaciones Comex vinculadas a clientes 3PL, país de destino/origen, N° DUS / DIN, BL/Booking y guía de despacho opcional, con opción de adjuntar certificado inicial.
  * Modal dedicado de gestión de certificados aduaneros: visualización de vigencias (Vigente / Vencido), formulario para adjuntar nuevos certificados fito/zoo/origen y eliminación.
  * Modal de inspección detallada del expediente de comercio exterior con control manual del estado aduanero interno.
  * Tarjetas KPI Comex: Total Operaciones (con desglose Export vs. Import), Pendientes SICEX, Total Certificados Registrados y Operaciones con Guía Vinculada.
  * Filtros por cliente 3PL, tipo de operación (Exportación/Importación) y estado aduanero (Pendiente, Tramitando, Autorizado, Rechazado).
  * Banner normativo aclarando que las operaciones se mantienen en estado interno `pendiente` a la espera de la habilitación del certificado digital y usuario en el portal SICEX por parte del Servicio Nacional de Aduanas.
* **Tipos TypeScript ([`types.ts`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/integrations/supabase/types.ts))**:
  * Definición tipada de `foreign_trade_operations`, `foreign_trade_certificates` y los enums `ft_operation_type` y `ft_customs_status`.

---

## [Sprint 16: Vertical 3PL — Modelo de Datos y Guía de Despacho (Res. Ex. N° 154 SII)] - 2026-09-26

### Añadido
* **Migración SQL de Soporte 3PL y Guías de Despacho** ([`supabase/migrations/20260926000016_sprint16_modelo_datos_3pl_guia_despacho.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260926000016_sprint16_modelo_datos_3pl_guia_despacho.sql)):
  * `parties.is_3pl_client` (boolean default false) con índice parcial para marcar clientes terceros de bodegaje/3PL sin duplicar el directorio de entidades.
  * `party_warehouses`: asignación explícita de bodega(s) de la empresa para cada cliente 3PL (`party_id`, `warehouse_id`, `entity_id`) con aislamiento RLS multiempresa.
  * Segregación de inventario en custodia: columna nullable `party_id` en `stock_ledger_entries` (`null` = inventario propio, `not null` = custodia del cliente 3PL).
  * Redefinición de la vista `stock_balances` (`SECURITY INVOKER = true`) incorporando `party_id`, `party_name` y `party_tax_id` tanto en `SELECT` como en `GROUP BY`.
  * Enums de transporte y despacho: `dispatch_transfer_type` (`venta`, `traslado_interno`, `consignacion`, `exportacion`, `otro`) y `dispatch_status` (`draft`, `issued`, `cancelled`).
  * `dispatch_notes`: cabecera de Guía de Despacho con los campos obligatorios de la Resolución Exenta N° 154 del SII (vigente 1 de noviembre de 2026):
    * Identificación del transportista: nombre/razón social (`carrier_name`) y RUT (`carrier_tax_id`).
    * Identificación vehicular: patente (`vehicle_plate`).
    * Georreferenciación de ruta: dirección exacta de origen (`origin_address`) y destino (`destination_address`).
    * Horarios exactos: fecha y hora de salida (`departure_at`) y llegada estimada (`arrival_at`).
    * Folio de despacho (`dispatch_number`, borrador referencial hasta integración DTE) y estado (`draft`).
  * `dispatch_note_lines`: detalle métrico por ítem despachado (`item_id`, `qty`, `uom`, `weight_kg`, `volume_m3`, `unit_value`).
  * Políticas de seguridad RLS en `party_warehouses`, `dispatch_notes` y `dispatch_note_lines` aplicando `user_has_company_access(auth.uid(), entity_id)` y roles (`admin`, `inventory`, `sales`, `accountant`).
* **Módulo y Pantalla de Guías de Despacho ([`dispatch.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dispatch.tsx))**:
  * Formulario integral para emitir guías en estado `draft` con selector de cliente 3PL (filtrado a `is_3pl_client = true`), bodega de origen autorizada (`party_warehouses`), transportista, patente, tipo de traslado y líneas de carga con cálculo de peso y volumen total.
  * Tarjetas KPI en tiempo real: Total Guías 3PL, Clientes Activos, Peso Total (kg) y Volumen Total (m³).
  * Modal de inspección y visualización detallada del documento.
  * Banner normativo informativo sobre la Resolución Exenta N° 154 del SII.
* **Gestión de Clientes 3PL en Configuración ([`setup.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/setup.tsx))**:
  * Nueva pestaña "Terceros & 3PL" para gestionar clientes y proveedores.
  * Modal con toggle interactivo "¿Es Cliente 3PL?" y selector multi-bodega que persiste de forma atómica en `party_warehouses`.
  * Filtros por clasificación y cliente 3PL.
* **Segregación de Stock 3PL en Inventario ([`inventory.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/inventory.tsx))**:
  * Pestaña "Saldos por Bodega": nuevo filtro por propietario (Todos, Propio Empresa, o cliente 3PL específico).
  * Nueva columna "Propietario / Cliente 3PL" con badges diferenciados para mercadería en custodia vs. stock propio.
  * Modal de registro de movimientos: selector opcional de "Propietario / Cliente 3PL" para asignar `party_id` a las entradas/salidas de inventario.
* **Navegación Global ([`AppHeader.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/components/layout/AppHeader.tsx))**:
  * Integración del módulo "Guías de Despacho (3PL)" con icono `Truck` en la barra de navegación y menú de módulos.
* **Tipos TypeScript ([`types.ts`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/integrations/supabase/types.ts))**:
  * Actualización de tipos para `dispatch_notes`, `dispatch_note_lines`, `party_warehouses`, `parties.is_3pl_client`, `stock_ledger_entries.party_id`, `stock_balances` y enums correspondientes.

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
