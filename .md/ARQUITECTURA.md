# Arquitectura del Sistema - EasyERP

## 1. Visión y Alcance
Sistema ERP integral para contabilidad y gestión administrativa enfocado en empresas en Chile bajo normativa contable IFRS / IFRS Pymes. Soporta operación multiempresa con aislamiento estricto de datos (RLS), motor de comprobantes contables con partida doble estricta e inmutabilidad, soporte **multimoneda a nivel de cuenta** (cuentas en USD, EUR, etc. coexistiendo con la moneda funcional base CLP), **dimensiones analíticas jerárquicas (Centros de Costo y Sucursales/Unidades)**, **inventario multibodega con valorización por capas FIFO reales**, **ciclo transaccional de facturación de ventas y compras con posteo automático a contabilidad e inventario**, **terminal de Punto de Venta (POS) con boletas y arqueo de caja**, **motor extensible de Declaraciones Juradas del SII (DJ 1879, DJ 1887, DJ 1947, etc.)**, **motor tributario para Formulario 29 (IVA/PPM mensual) y Formulario 22 (Renta anual)**, **generación de libros contables oficiales para el SII (Diario, Mayor, Balance 8 Columnas) y conciliación contra el Registro de Compras y Ventas (RCV)**, **cierre formal de períodos mensuales y revalorización cambiaria automática**, **módulo de activos fijos con depreciación mensual automática y bajas**, **módulo de producción simple con recetas BOM y costeo real de materiales**, identificación tributaria mediante **RUT** y control de cuentas por cobrar y pagar.

## 2. Stack Tecnológico
* **Frontend & SSR**: React 19, TanStack Start, TanStack Router (file-based routing), TanStack Query.
* **Estilos**: Tailwind CSS v4 con variables semánticas en OKLCH, shadcn/ui y Lucide Icons.
* **Backend**: Server Functions en TanStack Start, middleware de validación y autenticación.
* **Base de Datos & Auth**: Supabase (PostgreSQL), políticas de Row Level Security (RLS), funciones `SECURITY DEFINER` (`public.has_role()`, `public.user_has_company_access()`, `public.post_journal_entry()`, `public.reverse_journal_entry()`, `public.get_exchange_rate()`, `public.create_warehouse_transfer()`, `public.post_sales_invoice()`, `public.post_purchase_invoice()`, `public.run_exchange_revaluation()`, `public.close_accounting_period()`, `public.run_monthly_depreciation()`, `public.dispose_fixed_asset()`, `public.complete_production_order()`, `public.create_pos_sale()`, `public.close_pos_session()`, `public.get_sii_book_data()`, `public.reconcile_rcv_batch()`, `public.calculate_f29()`, `public.calculate_f22()`, `public.update_tax_run_status()`, `public.generate_dj()`, `public.update_dj_status()`).

## 3. Modelo de Datos
* **Seguridad & Roles Multiempresa**:
  * `company_users`: Asignación de usuario $\leftrightarrow$ empresa $\leftrightarrow$ rol en esa empresa (`user_id`, `entity_id`, `role`, `is_default`).
  * `profiles`: Datos de usuario con `active_entity_id` (empresa activa) y zona horaria `America/Santiago`.
  * `user_has_company_access(_user_id, _entity_id)`: Función de seguridad para evaluar pertenencia y permisos en RLS.
  * `app_role` (`admin`, `accountant`, `sales`, `purchasing`, `inventory`, `viewer`).
* **Configuración Contable & Dimensiones Analíticas**:
  * `entities`: Empresas con `base_currency_code`, `ppm_rate`, `tax_regime`, RUT y razón social.
  * `company_default_accounts`: Mapeo de cuentas contables predeterminadas por empresa.
  * `cost_centers`: Centros de costo jerárquicos (`parent_id`, `is_group`) aislados por `entity_id`.
  * `business_units`: Unidades de negocio / sucursales jerárquicas (`parent_id`, `is_group`) aislados por `entity_id`.
  * `currencies`: Monedas disponibles (`CLP`, `USD`, etc.).
  * `exchange_rates`: Tasas oficiales (USD/CLP - Dólar Observado) con búsqueda y validación estricta por fecha.
* **Motor Contable de Partida Doble & Multimoneda**:
  * `accounts`: Plan de cuentas jerárquico con `currency_code` y reglas analíticas (`requires_cost_center`, `requires_business_unit`).
  * `journal_entries`: Cabecera de comprobante con inmutabilidad y soporte de reversión.
  * `journal_entry_lines`: Detalle de partidas con moneda, tipo de cambio, CC, Sucursal, `skip_currency_resolution` y montos funcionales.
  * `post_journal_entry()`: Valida partida doble, valida que la fecha no pertenezca a un período cerrado y postea.
* **Declaraciones Juradas SII (DDJJ)**:
  * `dj_definitions`: Catálogo extensible con esquema de campos jsonb (`field_schema`).
  * `dj_field_mappings`: Mapeo de cada casilla oficial a una cuenta del plan contable por empresa.
  * `dj_generations`: Liquidaciones anuales con flujo `draft` $\rightarrow$ `reviewed` $\rightarrow$ `filed`.
  * `generate_dj()` y `update_dj_status()`.
* **Declaración de Impuestos SII (F29 / F22)**:
  * `tax_calculation_runs`: Liquidaciones estructuradas con estados `draft` $\rightarrow$ `reviewed` $\rightarrow$ `filed`.
  * `tax_adjustments`: Agregados y deducciones para la RLI del F22.
  * `calculate_f29()` y `calculate_f22()`.
* **Libros Legales SII & Conciliación RCV**:
  * `sii_book_exports`, `rcv_reconciliation_runs` y `rcv_reconciliation_items`.
  * `get_sii_book_data()` y `reconcile_rcv_batch()`.
* **Punto de Venta (POS) & Medios de Pago Mixtos**:
  * `pos_sessions`, `pos_sale_payment_lines`, `create_pos_sale()`, `close_pos_session()`.
* **Producción Simple & Fórmulas (BOM)**:
  * `bill_of_materials` y `bom_lines`, `production_orders` y `complete_production_order()`.
* **Activos Fijos & Depreciación**:
  * `fixed_assets`, `fixed_asset_depreciation_entries`, `run_monthly_depreciation()`, `dispose_fixed_asset()`.
* **Cierre de Período & Revalorización Cambiaria**:
  * `accounting_periods`, `exchange_revaluations`, `run_exchange_revaluation()`, `close_accounting_period()`.
* **Facturación Transaccional & Cobranzas / Pagos**:
  * `sales_invoices` / `sales_invoice_lines` y `purchase_invoices` / `purchase_invoice_lines`.
  * `post_sales_invoice()` y `post_purchase_invoice()`.
  * `invoice_payments`, `sales_invoice_balances` y `purchase_invoice_balances`.
* **Inventario, Motor FIFO Multibodega & Segregación 3PL**:
  * `items`, `warehouses`, `stock_ledger_entries` (con `party_id` para inventario propio vs. mercadería en custodia de terceros), `stock_valuation_layers`, `stock_balances` (vista segregada por cliente 3PL).
  * Triggers `trg_consume_fifo_layers` y `trg_create_fifo_layer`.
  * Función `create_warehouse_transfer()`.
* **Terceros & Clientes 3PL**:
  * `parties` (con RUT, `entity_id` y bandera `is_3pl_client`), `party_warehouses` (asignación de bodegas autorizadas por cliente 3PL), `contacts`, `addresses`.
* **Vertical 3PL — Guías de Despacho (Res. Ex. N° 154 SII)**:
  * `dispatch_notes`: Cabecera de Guía de Despacho con requisitos normativos del SII (transportista, RUT, patente, georreferenciación origen/destino, fechas y horas de salida/llegada, tipo de traslado y estado `draft`).
  * `dispatch_note_lines`: Detalle de carga física por ítem (cantidad, unidad de medida, peso en kg, volumen en m³, valor unitario).
  * Políticas de Row Level Security (RLS) multiempresa vinculadas a `user_has_company_access(auth.uid(), entity_id)`.
* **Vertical 3PL — Comercio Exterior (SICEX / Aduanas)**:
  * `foreign_trade_operations`: Carpeta aduanera vinculada a cliente 3PL (`party_id`), tipo (`exportacion`, `importacion`), país, N° DUS/DIN (`dus_number`), booking/BL (`booking_number`), estado aduanero (`ft_customs_status`: `pendiente`, `tramitando`, `autorizado`, `rechazado`) y vínculo opcional con `dispatch_notes`.
  * `foreign_trade_certificates`: Repositorio aduanero de certificados asociados a la operación (fitosanitarios SAG, zoosanitarios SAG/SERNAPESCA, certificados de origen SOFOFA/Cámara de Comercio, ISP) con número, emisor y fecha de vigencia (`valid_until`).
  * Políticas de Row Level Security (RLS) multiempresa con `user_has_company_access(auth.uid(), entity_id)` y roles autorizados.
* **Vertical 3PL — WMS: Recepción y Ubicación (Slotting / Racks / Pasillos)**:
  * `warehouse_locations`: Catálogo granular de sub-ubicaciones dentro de cada bodega (`warehouse_id`, `code` único por bodega, `name`, `entity_id`, `is_active`) con políticas RLS multiempresa.
  * Extensión en `stock_ledger_entries`:
    * `location_id`: Clave foránea opcional a `warehouse_locations(id)` para slotting de mercaderías.
    * `lot_number`: Trazabilidad por número de lote/partida en los movimientos de inventario.
    * `qc_notes`: Registro de control de calidad e inspección técnica al momento de la recepción.
  * Vista `stock_balances`: Agrupación y consulta de saldos consolidados por ítem, bodega, cliente 3PL propietario y ubicación física (`location_id`, `location_code`, `location_name`), con `security_invoker = true`.
* **Vertical 3PL — WMS: Picking, Packing y Trazabilidad de Lotes**:
  * Extensión en `dispatch_note_lines`:
    * `location_id`: Sub-ubicación física de bodega de donde se retira el producto (`warehouse_locations(id)`).
    * `lot_number`: Número de lote asignado al retiro.
    * `picked` / `picked_at`: Avance operativo de picking con inserción automática y sincrónica de salida en `stock_ledger_entries` (`movement_type = 'issue'`, `qty_change = -qty`, `party_id` de la guía, `valuation_rate = 0` liquidada por FIFO en base de datos, `voucher_type = 'dispatch_note'`).
    * `packed` / `packed_at`: Avance operativo de embalaje/empaque, condicionado a la confirmación previa del picking.
  * Indicador "Lista para despacho": Certificación física cuando todas las líneas de la guía están embaladas, manteniendo el estado documental `draft` hasta la emisión fiscal oficial del DTE.
  * Trazabilidad 360° por lote: Búsqueda centralizada que audita todas las salidas en guías de despacho asociadas a un lote y su trazabilidad histórica de ingresos y controles de calidad en Kardex.
* **Vertical 3PL — TMS: Rutas de Reparto y Gestión de Flota Propia**:
  * `vehicles`: Registro de flota de transporte propia (`entity_id`, `plate` único por empresa, `vehicle_type`, `capacity_kg`, `capacity_m3`, `active`) para control de tara y cubicaje volumétrico. Las operaciones con transporte tercerizado no requieren vehículo y continúan usando `carrier_name`/`carrier_tax_id` en la guía.
  * Enum `route_status`: Estados de ciclo de vida de la ruta (`planificada`, `en_curso`, `finalizada`, `cancelada`).
  * `routes`: Planificación de recorridos de entrega (`entity_id`, `route_date`, `vehicle_id` opcional, `driver_name`, `status`, `name`, `notes`).
  * `route_stops`: Secuenciación y asignación de guías de despacho (`route_id`, `dispatch_note_id`, `stop_order`, `notes`), con restricción de unicidad `(route_id, dispatch_note_id)` y eliminación en cascada al suprimir la ruta.
* **Vertical 3PL — TMS: Tracking de Paradas y Couriers Externos**:
  * Enum `stop_delivery_status`: Estados de cumplimiento por parada (`pendiente`, `en_ruta`, `entregado`, `no_entregado`).
  * Extensión en `route_stops`:
    * `delivery_status`: Estado operacional de la visita.
    * `arrived_at`: Marca temporal de arribo / entrega efectiva.
    * `lat` y `lng`: Coordenadas geográficas aproximadas capturadas mediante `navigator.geolocation` del navegador móvil/escritorio sin requerir hardware GPS dedicado ni app nativa.
    * `received_by`: Nombre o RUT de quien recepciona físicamente la mercadería en destino.
    * `delivery_notes`: Justificación o motivo de rechazo en caso de entrega fallida.
  * Extensión en `dispatch_notes` para Couriers Externos:
    * `courier_name`, `courier_tracking_number`, `courier_status`: Modelo de datos genérico para couriers tercerizados (Chilexpress, Blue Express, Starken, 99minutos, etc.) desacoplado de rutas propias.
* **Vertical 3PL — OMS: Pedidos Multicanal y Webhooks de Integración**:
  * Enum `order_status`: Estados de gestión de órdenes de venta (`pendiente`, `procesado`, `cancelado`).
  * `sales_orders`: Registro multicanal de pedidos (`entity_id`, `party_id` del cliente 3PL, `channel` libre: shopify, vtex, mercadolibre, manual, csv, `external_order_id`, `destination_address`, `status`, `dispatch_note_id`, `notes`), con restricción de unicidad anti-duplicados `UNIQUE (party_id, channel, external_order_id)`.
  * `sales_order_lines`: Desglose de productos del pedido (`sales_order_id` en cascada, `item_id` nullable para ítems del catálogo interno, `external_sku`, `qty`).
  * `party_webhook_tokens`: Generación y revocación de tokens secretos por cliente 3PL (`party_id`, `token` único, `name`, `is_active`) para autenticar receptores externos sin requerir sesión interactiva.
  * Ingestion Engine:
    * Función SQL `ingest_oms_order` (`SECURITY DEFINER`): Resolución automática de SKU contra catálogo de ítems de la empresa y upsert atómico de pedido y líneas.
    * Server Function `ingestOmsOrderFn` (`@tanstack/react-start`) y endpoint directo HTTP POST `/api/webhooks/oms` protegido exclusivamente por token de cliente 3PL.
  * Acción operativa "Convertir a Guía de Despacho": Generación automática de `dispatch_notes` + `dispatch_note_lines` en estado `draft` (bodega asignada al cliente vía `party_warehouses`), vinculando el `dispatch_note_id` y actualizando la orden a `procesado` para inicio inmediato de picking y packing en bodega.
* **Vertical 3PL — Portal Cliente y Segregación RLS**:
  * `party_portal_users`: Tabla de vinculación entre cuentas de usuario (`auth.users`) y clientes 3PL (`parties`). Un cliente 3PL puede tener múltiples usuarios autorizados, aislados por completo de `company_users`.
  * Función `public.user_has_party_access(check_party_id uuid)` (`SECURITY DEFINER STABLE`): Evalúa si el usuario autenticado tiene permiso sobre el `party_id` consultado.
  * Políticas de Row Level Security (RLS) aditivas: Permiten a los usuarios del portal realizar consultas `SELECT` únicamente sobre su propio `party_id` en `dispatch_notes`, `dispatch_note_lines`, `stock_ledger_entries`, `parties`, `items`, `warehouses`, `warehouse_locations`, `sales_orders` y `sales_order_lines`, sin alterar ni interferir con las políticas de staff interno de la empresa.
  * Configuración `security_invoker = true` en la vista `stock_balances`: Garantiza que el motor de vistas de PostgreSQL evalúe las políticas RLS del usuario que invoca la consulta sobre `stock_ledger_entries`, impidiendo la fuga de saldos entre clientes.
  * Grupo de rutas independiente `src/routes/_portal/`: Layout dedicado con autenticación Supabase, sin dependencia de empresas internas ni `company_users`, selector multi-cliente y visor de saldos, guías de despacho, pedidos OMS y comprobante imprimible con advertencia explícita de validez operativa interna (no sustituto de DTE fiscal).
* **Vertical 3PL — Contratos y Tarifarios**:
  * Enums `billing_frequency` (`mensual`, `quincenal`) y `service_rate_type` (`storage_pallet`, `storage_m2`, `picking_unit`, `transport_km`, `recargo_fijo`).
  * `service_contracts`: Contrato marco por cliente 3PL (`entity_id`, `party_id`, `billing_frequency`, `active`, `notes`), con unicidad `UNIQUE (entity_id, party_id)` y RLS multiempresa.
  * `service_rate_lines`: Matriz de precios unitarios por servicio pactado (`contract_id`, `rate_type`, `unit_price`, `description`), base para el cálculo automático de liquidaciones y facturación en el Sprint 26.
  * Extensión `distance_km` en `dispatch_notes`: Registro métrico de distancia recorrida en kilómetros para la valorización de traslados bajo el concepto `transport_km`.
* **Vertical 3PL — Facturación de Servicios y Notas de Ajuste (Cierre Fase 3)**:
  * Reutilización de `sales_invoices` y `sales_invoice_lines` (Sprint 6): Las facturas de servicios logísticos no se almacenan en tablas separadas, garantizando una contabilidad unificada, emisión fiscal consolidada y posting contable estándar.
  * Columna `adjustment_of_invoice_id` en `sales_invoices`: Vinculación directa autorreferencial a la factura de venta original para modelar notas de crédito (descuentos, rebajas de tarifa) y notas de débito (cargos adicionales o consumos omitidos) sin crear entidades paralelas.
  * Server Function `generateServiceInvoiceFn` (`@tanstack/react-start`):
    * Medición de consumos reales del período (`period_start` a `period_end`):
      * `storage_pallet` / `storage_m2`: Saldos de custodia del cliente en `stock_balances`.
      * `picking_unit`: Sumatoria de unidades de líneas con `picked = true` en guías del período.
      * `transport_km`: Sumatoria de `distance_km` en guías del período.
      * `recargo_fijo`: Cargo unitario completo estipulado en el tarifario.
    * Control de duplicidad: Verificación de clave estructurada en `memo` (`Servicios 3PL [period_start al period_end]`) para evitar doble cobro.
    * Emisión de factura en estado borrador (`draft`) con cálculo de IVA del 19% y líneas de venta detalladas por concepto.
  * Pestaña "Facturación 3PL" en UI: Panel con selector de períodos, liquidación masiva en lote, resumen KPI, monitoreo de estado por contrato, historial con visor de conceptos e interfaz para emitir notas de ajuste asociadas.
* **Vertical 3PL — BI y KPIs Operacionales (Apertura Fase 4: Inteligencia)**:
  * Extensión en `warehouses`: Columna `capacity_m3 numeric(20,2)` para definir la capacidad volumétrica cúbica máxima instalada de cada bodega.
  * `operational_cost_inputs`: Tabla de captura manual de costos operativos globales de bodega (`entity_id`, `period_start`, `period_end`, `total_cost`, `notes`), habilitada con RLS multiempresa.
  * Métricas analíticas de solo lectura sobre el ecosistema transaccional 3PL:
    * **OTIF (On-Time In-Full)**: Índice porcentual de guías despachadas con `arrival_at` dentro de las 24 horas posteriores a `departure_at` y empaque total confirmado (`packed = true` en todas sus líneas).
    * **Monitoreo de SLA**: Filtro preventivo de guías en estado `draft` que exceden $N$ días sin confirmación de picking, desglosando avance de preparación y cliente responsable.
    * **Costo Operativo por Unidad**: Razón matemática entre el gasto operacional del período cargado en `operational_cost_inputs` y la sumatoria de unidades preparadas en `dispatch_note_lines.qty` (`picked = true`).
    * **Ocupación Volumétrica**: Contraste porcentual entre el volumen cúbico estimado en custodia (derivado de saldos en `stock_balances`) y los m³ máximos configurados en `warehouses.capacity_m3`.
  * Dashboard interactivo en `/dashboard-3pl`: Filtros de fecha, umbral de SLA dinámico, selector de clientes y bodegas, tablas analíticas y modales para parametrización de capacidades y costos.
* **Vertical 3PL — BI y KPIs Comerciales (Cierre de Fase 4 y Roadmap 3PL)**:
  * Reutilización de entidades contables y operativas existentes: `sales_invoices` (ingresos reales), `dispatch_note_lines` (actividad de picking), `stock_balances` (saldos en custodia) y `operational_cost_inputs` (costos de gestión declarados). Sin requerir nuevas tablas ni alterar esquemas existentes.
  * Análisis de Rentabilidad por Cliente 3PL:
    * **Ingreso Real**: Suma de facturación neta de servicios logísticos emitida en el período (`sales_invoices.total_amount` con `status != 'cancelled'`).
    * **Asignación Proporcional de Costos**: Ponderación de la actividad física en bodega por cliente ($\text{unidades pickeadas} + 0.5 \times \text{saldos en custodia}$) sobre el total general, distribuyendo proporcionalmente el `total_cost` operacional cargado en `operational_cost_inputs`.
    * **Margen Estimado de Contribución**: Diferencia entre facturación neta y costo proporcional asignado, junto con su porcentaje sobre ventas.
    * **Rigor e Integridad Metodológica**: Presentación con advertencia explícita de "Costo/Margen Estimado" para gestión operativa interna, suprimiendo automáticamente cualquier cálculo de margen cuando no existan costos cargados en el período, impidiendo la generación de números ficticios.
    * **Visualización y Ordenamiento**: Tabla de rentabilidad con alternancia de ordenamiento (por mayor ingreso o por mayor margen), badges semánticos de rendimiento ("Rentable", "En Pérdida", "Facturado") y botón de acción directa para ingreso de costos.
* **Vertical 3PL — Correcciones Críticas, Integridad Criptográfica & Hardening (Sprint 29)**:
  * **Regla de la Verdad**: Eliminación definitiva de estimaciones arbitrarias (p. ej. unidades/50 para pallets o unidades/25 para m²) y corrección de campos en vistas (`qty_on_hand` en `stock_balances`). Los cálculos se sustentan exclusivamente en datos declarados o medidos.
  * **Seguridad de Tokens Webhook**: Migración de `party_webhook_tokens` hacia almacenamiento irreversible mediante resumen criptográfico SHA-256 (`token_hash`) y prefijo de 12 caracteres (`token_prefix`). El secreto en texto plano se muestra una única vez en interfaz al momento de su generación.
  * **Ingesta Atómica OMS**: Implementación de la función RPC con `SECURITY DEFINER` `ingest_oms_order`, que ejecuta en una única transacción de base de datos la validación del hash del token, el control de idempotencia `(party_id, channel, external_order_id)` y la coincidencia estricta de SKUs (`lower(code) = lower(external_sku)`) para la entidad dueña del catálogo.
  * **Hardening RLS en Portal Cliente**: Políticas de control de acceso en `party_portal_users` y función `get_party_portal_users` con `SECURITY DEFINER`. Aislamiento del catálogo de `items` para que los usuarios del portal solo puedan consultar artículos asociados a su inventario en custodia, movimientos o despachos.
* **Vertical 3PL — Medición Configurable de Almacenaje por Bodega (Sprint 30)**:
  * **Esquema de Medición de Bodegas**:
    * Enum `storage_measure_method`: `by_location` (suma de posiciones de pallet o m² de las ubicaciones ocupadas), `by_item_attributes` (suma de m³ o unidades/pallet calculadas según catálogo), `by_warehouse_default` (conversión por factor predeterminado de la bodega) y `manual` (requiere ingreso explícito de consumos).
    * Enum `storage_measure_basis`: Unidad física de cobro (`pallet`, `m2`, `m3`, `unit`).
    * Columnas en `warehouses`: `storage_measure_method`, `storage_measure_basis`, `default_units_per_pallet`, `storage_capacity`.
  * **Atributos Físicos en Entidades WMS**:
    * `warehouse_locations`: `pallet_positions integer` (default 1) y `area_m2 numeric(10,2)`.
    * `items`: `units_per_pallet integer` y `unit_volume_m3 numeric(10,4)`.
  * **Tipos de Tarifas Ampliados**: Incorporación de `storage_m3` y `storage_unit` en `service_rate_type`.
  * **Funciones PL/pgSQL Nativas de Medición**:
    * `stock_balance_at`: Reconstruye el saldo exacto de un producto/cliente/bodega a una fecha determinada desde `stock_ledger_entries`.
    * `storage_measure_on`: Evalúa y cuantifica la ocupación real a una fecha dada conforme al método configurado en la bodega.
    * `get_storage_usage`: Consolida el consumo de almacenamiento en un período de facturación para alimentar la liquidación de contratos 3PL.
  * **Previsualización de Facturación**: Server function `previewServiceBillingFn` que desglosa de manera transparente el cálculo de consumos de almacenaje, picking y transporte sin comprometer registros en `sales_invoices`.
* **Vertical 3PL — Analítica Predictiva y Alertas Automatizadas de Quiebre de Stock (Sprint 31)**:
  * **Vistas de Compatibilidad Kardex y Órdenes**:
    * `kardex_movements`: Vista estandarizada sobre `stock_ledger_entries` exponiendo `company_id`, `party_id`, `item_id`, `qty_change`, y fecha de imputación.
    * `order_items`: Vista unificada sobre `sales_order_lines` y `sales_orders` para análisis de demanda por cliente y canal.
  * **Tabla `client_alerts`**:
    * Persistencia de notificaciones multi-empresa con aislamiento estricto por `company_id` y `party_id`.
    * Estados de severidad tipados (`CRITICAL`, `WARNING`, `INFO`, `HEALTHY`) y bandera de lectura `is_read`.
    * Políticas RLS independientes para lectura/gestión de staff y lectura/descarte de clientes del portal.
  * **Motor Predictivo PL/pgSQL (`get_inventory_stockout_forecast`)**:
    * Reconstruye el consumo diario promedio (*burn rate*) a partir de las salidas del kardex (`qty_change < 0`) en los últimos 30 días móviles.
    * Proyecta el tiempo hasta agotamiento (`days_to_stockout = current_stock / avg_daily_consumption`).
    * Clasificación de riesgo semántica: `CRITICAL` (&le; 7 días o stock agotado), `WARNING` (8 a 14 días), `HEALTHY` (&gt; 14 días).
  * **Automatización y Resolución Proactiva (`check_and_create_stockout_alerts`)**:
    * Función que evalúa el estado proyectado de cada artículo: genera alertas nuevas para quiebres inminentes y resuelve automáticamente (`is_read = true`) las alertas de artículos cuyo stock fue reabastecido.
  * **Pipeline de Pronóstico en Python (`scripts/forecast_demand_trends.py`)**:
    * Procesamiento batch de tendencias con medias móviles semanales (7d / 14d) y soporte de ejecución programada vía CLI o cron.
  * **Componentes de Alerta y Portal Predictivo (`ClientStockoutAlerts.tsx` y `portal.tsx`)**:
    * Alertas flotantes críticas (`Alert variant="destructive"`) en el portal del cliente con descarte individual o masivo.
    * Pestaña analítica "Predicción AI" en el portal de clientes y pestaña "Quiebres AI" en el panel del operador 3PL (`dashboard-3pl.tsx`).
* **Gestión de Proveedores, Catálogo y Portal (Sprint 37)**:
  * **Catálogo Propio Desacoplado (`supplier_catalog_items`)**:
    * Separación conceptual estricta: los productos/servicios ofrecidos por un proveedor no contaminan el maestro interno de artículos (`items`), permitiendo que múltiples proveedores ofrezcan el mismo insumo con SKUs, descripciones y precios disímiles.
    * Enlace opcional `linked_item_id` hacia `items` para habilitar el matching futuro en inventario y facturación de compra.
    * Políticas de no-borrado: los ítems se desactivan (`active = false`), garantizando integridad referencial con órdenes históricas.
  * **Almacenamiento y Versionado de Contratos en PDF (`supplier_contracts`)**:
    * Primer uso de **Supabase Storage** con bucket privado `supplier-contracts`.
    * Convención de ruta `{entity_id}/{party_id}/{timestamp}-{nombre_archivo}` con políticas RLS basadas en `user_has_company_access` (staff interno, rol `admin` o `purchasing`) y `user_has_party_access` (portal de proveedores, solo lectura).
    * Registro de versiones inmutables con control de vigencia atómica (`is_current`).
  * **Portal de Proveedores sobre Infraestructura Existente**:
    * Reutilización de `party_portal_users` y `user_has_party_access` bajo la ruta unificada `_portal/`.
    * Detección por `parties.classification = 'supplier'`: el portal concede permisos de escritura (RLS `FOR ALL`) sobre `supplier_catalog_items` para que el proveedor administre su catálogo de forma autónoma, y modo solo lectura (RLS `FOR SELECT`) sobre `supplier_contracts`.



