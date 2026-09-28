# Especificación y Funcionalidad de Módulos - EasyERP (Norma Chilena / CLP)

Este documento describe en detalle cada uno de los módulos operativos integrados en el sistema ERP **EasyERP** adaptado para Chile.

---

## 1. Contabilidad & Multimoneda ([`/accounting`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/accounting.tsx))
* **Catálogo Multimoneda & Reglas Analíticas**:
  * Estructura jerárquica con código numérico (ej. `1.1.01.001`), nombre y tipo de cuenta (`Asset`, `Liability`, `Equity`, `Income`, `Expense`, `Cost of Goods Sold`).
  * Asignación de moneda propia por cuenta (`currency_code`), permitiendo cuentas en USD o divisas extranjeras conviviendo con la moneda base CLP.
  * Reglas de obligatoriedad de imputación analítica: `requires_cost_center` y `requires_business_unit` para forzar la selección de Centro de Costo y Sucursal en cuentas de resultado.
* **Motor de Comprobantes por Partida Doble & Conversión Automática**:
  * Formulario de comprobantes contables con cabecera y tabla de $N$ líneas contables.
  * Imputación analítica por línea: selector de **Centro de Costo** (`cost_center_id`) y **Sucursal / Unidad** (`business_unit_id`).
  * Validación en tiempo real del cuadre de partida doble ($\sum \text{Débitos} = \sum \text{Créditos}$) y asignación de correlativo atómico (`ASI-000001`).
  * **Inmutabilidad estricta y Reversión**: Los comprobantes posteados no admiten modificación directa; se anulan mediante contra-asientos invertidos (`reversal_of`).
  * **Protección de Períodos Cerrados**: Bloqueo automático de posteo para cualquier fecha perteneciente a un período mensual cerrado.

---

## 2. Ventas, Facturación & Cuentas por Cobrar ([`/sales`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/sales.tsx))
* **Ciclo de Facturación Transaccional (`sales_invoices`, `sales_invoice_lines`)**:
  * Emisión de facturas de venta con cálculo automático de **IVA Débito Fiscal (19%)** e importes totales.
  * Selector de cliente, bodega de despacho, centro de costo, sucursal, moneda (CLP, USD) y tasa de cambio.
* **Posteo Automático Integral (`post_sales_invoice`)**:
  * Genera el asiento contable balanceado: Débito a CxC Clientes (`receivable_account_id`), Crédito a Ingresos (`sales_income_account_id`) y Crédito a IVA Débito Fiscal (`output_tax_account_id`).
  * Descuenta de forma automática las existencias de la bodega seleccionada en `stock_ledger_entries` y postea el costo de venta FIFO real (`cogs_account_id` vs `inventory_account_id`).
* **Cobranzas y Antigüedad de Saldos (`invoice_payments`, `sales_invoice_balances`)**:
  * Registro de cobranzas parciales o totales asociadas a la factura y a la cuenta de tesorería/banco correspondiente.
  * Reporte de saldos de clientes y cuentas por cobrar en tiempo real.

---

## 3. Punto de Venta (POS) & Boletas ([`/pos`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/pos.tsx))
* **Turnos y Arqueo de Caja (`pos_sessions`, `close_pos_session`)**:
  * Apertura de turno con bodega asignada y fondo inicial de sencillo en gaveta.
  * Cierre de turno con arqueo de caja: cálculo automático del efectivo esperado ($ \text{Fondo Inicial} + \text{Ventas Efectivo} $), ingreso del efectivo contado físicamente y detección en vivo de sobrantes o faltantes.
* **Terminal de Venta Rápida de Mostrador**:
  * Búsqueda ágil de artículos, visualización de precios y disponibilidad.
  * Carrito de venta con discriminación de IVA 19% y emisión de boletas correlativas (`BOL-000001`).
* **Medios de Pago Mixtos (`pos_sale_payment_lines`, `create_pos_sale`)**:
  * Cobro dividido en múltiples medios: Efectivo, Tarjeta Débito (Redcompra), Tarjeta Crédito, Transferencias.
  * Cálculo de vuelto en efectivo y posteo automático e instantáneo tanto al Libro Mayor como al inventario FIFO de la bodega.

---

## 4. Declaraciones Juradas SII — DDJJ ([`/declaraciones-juradas`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/declaraciones-juradas.tsx))
* **Motor Extensible de Declaraciones Juradas (`dj_definitions`, `dj_field_mappings`, `dj_generations`)**:
  * Catálogo dinámico de formularios oficiales: **DJ 1879** (Honorarios), **DJ 1887** (Sueldos y Retenciones 2da Categoría), **DJ 1947** (Renta Atribuida / Pro Pyme Transparente 14 D8).
  * Posibilidad de crear y registrar nuevas definiciones de DJ con esquemas de campos personalizados (`field_schema`) sin modificar código.
  * **Mapeo por Empresa**: Asignación flexible de qué cuenta del plan contable alimenta cada casilla oficial.
  * **Generación Automática & Exportación CSV**: Extracción anual de saldos y partidas con exportación para carga en el SII.

---

## 5. Declaración de Impuestos SII — F29 / F22 ([`/taxes`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/taxes.tsx))
* **Formulario 29 (F29 Mensual - IVA y PPM)**:
  * Cálculo automático de IVA Débito Fiscal 19% (ventas y boletas) y Crédito Fiscal 19% (compras).
  * Arrastre y aplicación automática del Remanente de Crédito Fiscal del mes anterior.
  * Cálculo del Pago Provisional Mensual (**PPM Obligatorio**) según la tasa configurada de la empresa.
  * Liquidación del total a pagar o nuevo remanente.
* **Formulario 22 (F22 Anual - Renta e Impuesto de Primera Categoría)**:
  * Determinación de la Renta Líquida Imponible (RLI) a partir de ingresos, costos y gastos.
  * Aplicación de tasas según el régimen tributario de la empresa (14A General, 14 D3 Pro Pyme General, 14 D8 Transparente).
  * Rebaja de los PPMs pagados durante los 12 meses para determinar el saldo a pagar o a devolución.

---

## 6. Libros Legales SII & Conciliación RCV ([`/sii-books`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/sii-books.tsx))
* **Generación de Libros Contables Oficiales**:
  * **Libro Diario Legal**: Cronología de comprobantes, cuentas, glosas y partidas balanceadas.
  * **Libro Mayor Legal**: Movimientos débitos, créditos y saldos acumulados por cuenta.
  * **Balance Tributario de 8 Columnas**: Sumas del Mayor (Débito/Crédito), Saldos (Deudor/Acreedor), Inventario (Activo/Pasivo) y Resultados (Pérdida/Ganancia).
  * **Libro de Ventas y Libro de Compras**: Detalle de documentos DTE, RUT contraparte, Razón Social, Monto Neto, IVA 19% y Total.
  * Exportación instantánea a formato **CSV / Excel**.
* **Cruce & Conciliación con el Registro de Compras y Ventas (RCV)**:
  * Herramienta de cruce contra el informe oficial del portal SII (`reconcile_rcv_batch`).

---

## 7. Compras, Facturas de Proveedores & Cuentas por Pagar ([`/purchases`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/purchases.tsx))
* **Ciclo Transaccional de Compras (`purchase_invoices`, `purchase_invoice_lines`)**:
  * Registro de facturas de proveedores con discriminación de **IVA Crédito Fiscal (19%)**.
  * Soporte para compra de mercaderías (con SKU e ingreso a bodega) y gastos generales directos.
* **Posteo Automático Integral (`post_purchase_invoice`)**:
  * Genera el asiento contable: Crédito a Proveedores (`payable_account_id`), Débito a IVA Crédito Fiscal (`input_tax_account_id`) y Débito a Inventario (`inventory_account_id`) o Gasto (`purchase_expense_account_id`).
  * Para ítems de stock, ingresa el movimiento en `stock_ledger_entries` y crea la nueva capa de valorización FIFO en `stock_valuation_layers`.
* **Pagos a Proveedores (`invoice_payments`, `purchase_invoice_balances`)**:
  * Control de pagos y saldos adeudados por proveedor en tiempo real.

---

## 8. Producción Simple & Recetas BOM ([`/production`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/production.tsx))
* **Lista de Materiales y Fórmulas (`bill_of_materials`, `bom_lines`)**:
  * Definición de recetas para productos terminados con rendimientos base e insumos/materias primas requeridas.
* **Órdenes de Producción Transaccionales (`production_orders`, `complete_production_order`)**:
  * Lanzamiento de órdenes especificando cantidad a fabricar, bodega de origen de materias primas y bodega destino del producto terminado.
  * Consumo automático de insumos en capas FIFO desde la bodega de origen y cálculo del costo real total acumulado.
  * Ingreso del producto terminado en la bodega destino valorizado exactamente al costo unitario real resultante ($ \text{Costo Total Consumido} / \text{Cantidad Producida} $).

---

## 9. Activos Fijos & Depreciación ([`/assets`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/assets.tsx))
* **Ficha Maestra de Activo Fijo (`fixed_assets`)**:
  * Registro de bienes de uso con costo histórico en CLP, valor residual, vida útil en meses, método de amortización, centro de costo y sucursal.
  * Mapeo de cuentas: Activo, Depreciación Acumulada y Gasto por Depreciación.
* **Depreciación Mensual Automática (`run_monthly_depreciation`, `fixed_asset_depreciation_entries`)**:
  * Métodos de cálculo: **Línea Recta** y **Acelerada (1/3 Vida Útil)** bajo normativa chilena SII.
  * Generación y posteo automático de los comprobantes de diario al Libro Mayor.
* **Bajas y Disposición de Activos (`dispose_fixed_asset`)**:
  * Reversión de depreciación acumulada, descargo de costo histórico y reconocimiento de Ganancia o Pérdida en Venta.

---

## 10. Inventario & Multibodega ([`/inventory`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/inventory.tsx))
* **Motor de Movimientos de Inventario (`stock_ledger_entries`)**:
  * Registro de entradas (`receipt`), salidas (`issue`), ajustes (`adjustment`) y traslados interbodega.
  * **Segregación 3PL**: Columna `party_id` nullable para diferenciar mercadería propia de la empresa (`null`) vs. inventario en custodia de clientes terceros 3PL (`not null`).
* **Capas de Valorización FIFO (`stock_valuation_layers`)**:
  * Creación y consumo de capas FIFO con bloqueo estricto de stocks negativos.
* **Traslados Atómicos (`create_warehouse_transfer`)**:
  * Traslado entre bodegas preservando el costo unitario de origen.
* **Saldos en Tiempo Real (`stock_balances`) & Kardex**:
  * Existencias físicas y valorización total por bodega, ítem y cliente 3PL.
  * Filtro interactivo por propietario: permite visualizar saldos consolidados, solo propios, o por cliente 3PL específico.

---

## 11. Bancos & Tesorería ([`/cash`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/cash.tsx))
* **Tasas de Cambio Oficiales / Dólar Observado (`exchange_rates`)**:
  * Registro diario del tipo de cambio oficial USD $\rightarrow$ CLP.
* **Libros de Caja & Bancos (`books`)**:
  * Cajas chicas y cuentas bancarias.

---

## 12. Reportes Financieros & Analíticos ([`/reports`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/reports.tsx))
* **Filtros Analíticos**: Segmentación de reportes por Centro de Costo o Sucursal.
* **Balanza de Comprobación, Balance General y Estado de Resultados (P&L)**: Generados en tiempo real desde asientos y facturas.

---

## 13. Configuración General & Cierre de Período ([`/setup`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/setup.tsx))
* **Directorio de Terceros & Clientes 3PL (`parties`, `party_warehouses`)**:
  * Gestión centralizada de clientes y proveedores.
  * Toggle "¿Cliente 3PL?" con selector multi-bodega para autorizar qué bodegas de la empresa alojan la carga del cliente.
* **Cuentas Contables Predeterminadas (`company_default_accounts`)**: Mapeo obligatorio de cuentas contables para CxC, CxP, Ventas, Compras, IVA (19%), COGS, Inventario y Diferencia de Cambio No Realizada.
* **Cierre de Períodos Contables (`accounting_periods`, `close_accounting_period`)**: Flujo de validación previa de borradores y cierre de mes que bloquea nuevos posteos.
* **Revalorización Cambiaria de Cierre (`exchange_revaluations`, `run_exchange_revaluation`)**: Ajuste automático del saldo en libros de cuentas en moneda extranjera (USD) contra la tasa de cierre del mes.
* **Empresas (`entities`)**, **Centros de Costo (`cost_centers`)**, **Sucursales (`business_units`)**, **Años Fiscales (`fiscal_years`)**, **Series (`naming_series`)** y **Roles (`roles`)**.

---

## 14. Vertical 3PL — Guías de Despacho Res. 154 SII ([`/dispatch`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dispatch.tsx))
* **Cumplimiento Obligatorio Resolución Exenta N° 154 del SII** (vigente 1 de noviembre de 2026):
  * **Datos del Transportista**: Nombre o razón social (`carrier_name`) y RUT (`carrier_tax_id`).
  * **Datos del Vehículo**: Patente en formato oficial (`vehicle_plate`).
  * **Ruta de Despacho**: Direcciones exactas y georreferenciadas de origen (`origin_address`) y destino (`destination_address`).
  * **Tiempos de Traslado**: Fecha y hora exacta de salida (`departure_at`) y fecha/hora estimada de llegada (`arrival_at`).
  * **Detalle Métrico de Carga (`dispatch_note_lines`)**: Desglose por ítem con cantidad, unidad de medida (`uom`), peso neto/bruto en kilogramos (`weight_kg`), volumen en metros cúbicos (`volume_m3`) y valor unitario declarado (`unit_value`).
* **Estados de Documento**:
  * Emisión en estado `draft` (borrador interno) con aislamiento RLS multiempresa por `entity_id`.
  * Diseñado como gancho (`dispatch_number`) para integración futura con motor emisor DTE (folio CAF y firma digital).
* **Filtros y Métricas Operacionales**:
  * Búsqueda ágil por transportista, patente o cliente.
  * Tarjetas KPI en tiempo real: conteo de guías, clientes 3PL activos, peso y volumen total despachado.
  * Modal de inspección completa de la guía y sus líneas.

---

## 15. Vertical 3PL — Comercio Exterior (SICEX / Aduanas) ([`/dispatch`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dispatch.tsx))
* **Carpetas y Expedientes Aduaneros (`foreign_trade_operations`)**:
  * Registro de operaciones de exportación (salida de Chile / DUS) e importación (ingreso a Chile / DIN) para clientes 3PL.
  * Captura de país de origen/destino, N° DUS / DIN aduanero, conocimiento de embarque / Bill of Lading (BL) / Booking y notas operacionales.
  * Vinculación bidireccional opcional con Guías de Despacho de traslado local emitidas bajo Res. 154 SII.
  * Ciclo de estado aduanero (`ft_customs_status`): `pendiente`, `tramitando`, `autorizado`, `rechazado`.
  * Diseñado como gancho para conexión futura con la plataforma SICEX (Aduanas de Chile) una vez tramitadas las credenciales institucionales.
* **Gestión de Certificados Sanitarios y de Origen (`foreign_trade_certificates`)**:
  * Repositorio de certificados vinculados a la operación: Fitosanitarios (SAG), Zoosanitarios (SAG/SERNAPESCA), Certificados de Origen (SOFOFA / Cámara de Comercio), Registros de Uso y Consumo (ISP), Calidad y Libre Venta.
  * Registro de N° oficial de certificado, entidad emisora y fecha de vencimiento (`valid_until`) con alerta visual de vigencia.
* **Métricas y Control Operacional**:
  * Tarjetas KPI en tiempo real: Total Operaciones (desglose Export vs Import), Pendientes SICEX, Total Certificados y Despachos Vinculados.
  * Filtros por cliente 3PL, tipo de operación y estado aduanero.

---

## 16. Vertical 3PL — Validación de Cumplimiento & Puesta en Producción ([`PRODUCCION-3PL.md`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/.md/PRODUCCION-3PL.md))
* **Certificación de No-Contaminación Contable**:
  * Las guías de despacho (`dispatch_notes`) y movimientos en custodia (`stock_ledger_entries` con `party_id`) operan de forma 100% aislada de los libros oficiales (`sii_synced_documents`, `sales_invoices`, `gl_entries`), protegiendo la integridad del Libro de Ventas, Compras y cálculo de F29 (Sprint 15 / ApiPyme).
* **Cuadratura y Segregación de Inventario**:
  * Vista `stock_balances` agrupada por `party_id` con `security_invoker = true`, discriminando stock de la compañía (`party_id IS NULL`) y de clientes en custodia (`party_id IS NOT NULL`).
* **Matriz de Auditoría RLS Multiempresa**:
  * Confirmación de políticas activas en `party_warehouses`, `dispatch_notes`, `dispatch_note_lines`, `foreign_trade_operations` y `foreign_trade_certificates`.
* **Bloqueantes de Negocio Registrados**:
  * Emisor DTE (timbrado CAF y firma de Guías Electrónicas Tipo 52 / Res. 154) y Habilitación de credenciales API en portal SICEX.
* **Cierre de Fase 1**: Habilitación formal para la Fase 2 (Operación WMS/TMS a partir del Sprint 19).

---

## 17. Vertical 3PL — WMS: Recepción y Ubicación (Slotting / Racks / Pasillos) ([`/dispatch`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dispatch.tsx))
* **Gestión de Ubicaciones Físicas (`warehouse_locations`)**:
  * Mapeo granular de la bodega en sub-ubicaciones con código único (`code`, ej. `A-01-01`, `RACK-B-N2`) y nombre referencial.
  * Aislamiento multiempresa mediante RLS por `entity_id` y relación directa con `warehouses`.
  * Modal interactivo "+ Nueva Ubicación" para aprovisionar posiciones sin interrumpir el proceso de recepción física.
* **Recepción en Custodia con Trazabilidad y Calidad (`stock_ledger_entries`)**:
  * Registro de ingresos con `movement_type = 'receipt'`, vinculados al cliente 3PL propietario (`party_id`), bodega autorizada (`party_warehouses`) y ubicación de guardado (`location_id`).
  * Captura de N° de Lote (`lot_number`) para trazabilidad de lote/partida y control de calidad (`qc_notes`) con observaciones técnicas al ingreso.
  * Generación automática de capas FIFO (`stock_valuation_layers`) para valorización de inventario.
* **Consulta y Filtrado Granular de Existencias ([`/inventory`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/inventory.tsx))**:
  * Vista `stock_balances` (`security_invoker = true`) enriquecida con `location_id`, `location_code` y `location_name`.
  * Filtro interactivo por ubicación WMS y visualización de badges por código de posición física en "Saldos por Bodega".
  * Integración en Kardex de movimientos mostrando la bodega, ubicación y lote asociado a cada operación.

---

## 18. Vertical 3PL — WMS: Picking, Packing y Trazabilidad de Lotes ([`/dispatch`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dispatch.tsx))
* **Ciclo Operativo de Picking con Descuento Automático de Inventario (`dispatch_note_lines`)**:
  * Botón interactivo "Detalle & Picking" por cada guía de despacho registrada.
  * Formulario de picking por línea: selección de sub-ubicación de retiro física (`warehouse_locations`) dentro de la bodega de la guía y especificación del número de lote (`lot_number`).
  * Confirmación de picking que marca la línea como `picked = true` (`picked_at = now()`) y emite en tiempo real la salida de stock en `stock_ledger_entries` (`movement_type = 'issue'`, `valuation_rate = 0` calculada por FIFO en base de datos, `party_id` del cliente 3PL, `voucher_type = 'dispatch_note'`, `voucher_id = guide.id`).
* **Flujo de Packing y Certificación de "Lista para Despacho"**:
  * Checkbox interactivo "Empacada" (`packed = true`, `packed_at = now()`) por línea, habilitado estrictamente una vez completado el picking.
  * Cuando el 100% de las líneas de una guía están empacadas, se activa el badge y banner "✓ Lista para despacho" indicando que la carga está embalada y lista para el transporte asignado (el DTE tributario se mantiene en `draft` para no alterar libros legales).
* **Módulo de Trazabilidad 360° por Lote**:
  * Búsqueda instantánea por código de lote (`lot_number`) en pestaña dedicada.
  * Panel dual consolidado:
    1. **Salidas en Guías de Despacho**: folio de guía, cliente 3PL, ítem, cantidad despachada, ubicación física de retiro, fecha de salida, destino, transportista y estado físico.
    2. **Historial Kardex del Lote**: trazabilidad histórica de recepciones, notas de inspección técnica de calidad (QC), ajustes y salidas previas registradas para el lote.
---

## 19. Vertical 3PL — TMS: Rutas de Reparto y Gestión de Flota Propia ([`/dispatch`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dispatch.tsx))
* **Gestión de Flota Propia (`vehicles`)**:
  * Registro de camiones, furgones y utilitarios de la empresa con patente (`plate`), carrocería (`vehicle_type`), capacidad de carga en kilogramos (`capacity_kg`), capacidad volumétrica en metros cúbicos (`capacity_m3`) y estado de disponibilidad (`active`).
  * Validación de unicidad de patente por empresa `(entity_id, plate)`.
  * Soporte para transporte propio o tercerizado: cuando el despacho se realiza con flota externa, no se requiere vincular un vehículo y se emplean los campos de transportista de la guía (`carrier_name`, `carrier_tax_id`).
* **Planificación y Secuenciación de Rutas (`routes` & `route_stops`)**:
  * Creación de hojas de ruta por fecha (`route_date`), nombre identificador, vehículo de flota propia opcional, conductor (`driver_name`) y observaciones operativas.
  * Secuenciación manual de paradas (`stop_order: 1, 2, 3...`) con botones interactivos Arriba / Abajo para ordenar las entregas desde la primera hasta la última.
  * Asignación dinámica de guías de despacho existentes, con control de asignación previa en otras rutas activas.
* **Control de Carga, Cubicaje y Alertas de Sobrecarga**:
  * Cálculo dinámico y en tiempo real del peso total (`kg`) y cubicaje (`m³`) acumulado por las líneas de las guías asignadas a la ruta.
  * Barras de utilización de capacidad del vehículo seleccionado con indicadores visuales y alertas explícitas si se supera el 100% de la capacidad de peso o volumen ("¡Sobrecarga de peso detectada!").
* **Ciclo de Vida de Rutas & Principio de Independencia Documental**:
  * Estados de ruta administrados vía enum `route_status` (`planificada` → `en_curso` → `finalizada` / `cancelada`).
  * Acciones rápidas de control de estado en modal de Hoja de Ruta ("Iniciar Ruta", "Finalizar Ruta", "Cancelar Ruta", "Reabrir como Planificada").
  * **Criterio de Aceptación Clave**: La transición de estados de la ruta es 100% independiente del estado de las guías de despacho individuales (`dispatch_notes.status`), preservando su estado tributario y operacional.

---

## 20. Vertical 3PL — TMS: Tracking de Paradas y Couriers Externos ([`/dispatch`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dispatch.tsx))
* **Seguimiento Operacional por Parada (`route_stops`)**:
  * Estados de cumplimiento por parada gestionados vía enum `stop_delivery_status` (`pendiente`, `en_ruta`, `entregado`, `no_entregado`).
  * Modal interactivo para registrar resultado de la visita en terreno con validación en tiempo real.
  * Captura de receptor: registro obligatorio del nombre o RUT de quien recibe la mercadería (`received_by`).
  * Registro de anomalías: captura obligatoria de motivos de no entrega (`delivery_notes`, ej. local cerrado, dirección errónea, rechazo de carga).
* **Captura de Geolocalización GPS Puntual**:
  * Obtención de coordenadas geográficas en el momento del evento (`lat`, `lng`) vía API estándar del navegador (`navigator.geolocation.getCurrentPosition`), permitiendo a choferes registrar la ubicación desde el navegador de su teléfono móvil sin requerir app nativa.
  * Tolerancia a fallos: si el usuario rechaza los permisos de ubicación o no hay cobertura GPS, el sistema no bloquea el flujo y registra la entrega sin coordenadas.
  * Visualización de ubicación en Hoja de Ruta con enlace directo para abrir el punto geográfico en Google Maps.
* **Modelo Genérico de Couriers Externos (`dispatch_notes`)**:
  * Soporte en formulario de nueva guía para envíos tercerizados: campos opcionales para empresa courier (`courier_name`), número de seguimiento (`courier_tracking_number`) y estado reportado (`courier_status`).
  * Desacoplamiento total: la guía puede asignarse a un courier externo sin requerir un vehículo o ruta interna asignada.
  * Visualización de badges de courier y tracking en la tabla principal de guías de despacho.

---

## 21. Vertical 3PL — OMS: Pedidos Multicanal y Webhook de Integración ([`/dispatch`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dispatch.tsx))
* **Bandeja Centralizada de Pedidos Multicanal (`sales_orders` & `sales_order_lines`)**:
  * Recepción unificada de órdenes de venta para clientes 3PL desde plataformas de e-commerce (Shopify, VTEX, Mercado Libre), sistemas ERP, formularios manuales o importaciones CSV.
  * Restricción anti-duplicados a nivel de base de datos `UNIQUE (party_id, channel, external_order_id)`: garantiza idempotencia y previene la duplicación de órdenes ante reintentos de red de los webhooks de e-commerce.
  * Estados del ciclo de vida del pedido gestionados mediante enum `order_status` (`pendiente`, `procesado`, `cancelado`).
* **Receptor Genérico de Webhooks y API de Ingestión**:
  * Endpoint HTTP directo `POST /api/webhooks/oms` y TanStack Start Server Function `ingestOmsOrderFn` (`src/lib/oms.functions.ts`).
  * Autenticación externa por token secreto por cliente 3PL (`party_webhook_tokens`), sin requerir sesión interactiva de usuario.
  * Función PL/pgSQL `ingest_oms_order` (`SECURITY DEFINER`): valida el token activo, determina la empresa y el cliente 3PL, resuelve SKUs externos contra el catálogo maestro de ítems (`items`), y realiza upsert atómico de la orden y sus líneas.
* **Carga Alternativa Manual y Masiva (CSV)**:
  * Modal de creación manual de pedidos para clientes sin integración digital activa.
  * Importador masivo de archivos CSV / texto con columnas `external_order_id, destination_address, sku, qty`, agrupando automáticamente líneas por orden de venta.
* **Conversión Automatizada a Guía de Despacho (Picking Ready)**:
  * Botón interactivo "Convertir a Guía": toma un pedido en estado `pendiente`, identifica la bodega asignada al cliente (`party_warehouses`), y genera automáticamente una guía de despacho (`dispatch_notes`) con sus líneas (`dispatch_note_lines`) en estado `draft`.
  * Vincula el `dispatch_note_id` al pedido y actualiza su estado a `procesado`, dejando la mercadería lista para los flujos WMS de picking y packing sin digitación manual.
* **Generador de Tokens de Integración en Clientes 3PL**:
  * Botón "Generar token de integración" en la pestaña de Clientes 3PL: crea un token único `tok_3pl_...` y despliega un modal con instrucciones, endpoint de escucha y ejemplo listo para copiar en cURL / Postman.
  * Control de estado de tokens (activar / desactivar) y copia rápida al portapapeles.

---

## 22. Vertical 3PL — Portal Cliente y Segregación RLS ([`/portal`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_portal/portal.tsx))
* **Segregación Estricta entre Personal Interno y Clientes Externos (`party_portal_users`)**:
  * Acceso dedicado para clientes 3PL mediante cuentas de Supabase Auth asociadas a un `party_id` (`party_portal_users`), 100% aisladas del modelo `company_users` de personal interno de la empresa.
  * Función de seguridad `user_has_party_access(check_party_id uuid)` (`SECURITY DEFINER STABLE`) para evaluar de forma estricta los permisos de consulta del cliente logueado.
  * Políticas adicionales de Row Level Security (RLS) aditivas en `dispatch_notes`, `dispatch_note_lines`, `stock_ledger_entries`, `parties`, `items`, `warehouses`, `warehouse_locations`, `sales_orders` y `sales_order_lines`.
  * Forzado de `security_invoker = true` en la vista `stock_balances` para que cualquier consulta de saldos desde el portal aplique las políticas RLS sobre las tablas base subyacentes, imposibilitando la visualización de inventario ajeno.
* **Layout y Experiencia Dedicada de Usuario (`_portal/route.tsx`)**:
  * Grupo de rutas aislado `src/routes/_portal/` que no hereda dashboards ni vistas internas de administración contable o financiera.
  * Verificación de sesión de autenticación sin requerir empresa activa en `company_users`.
  * Estado vacío explicativo e intuitivo en caso de que el usuario logueado no posea clientes 3PL asignados.
  * Selector multi-cliente para usuarios que administran más de una cuenta o razón social.
* **Portal de Autoservicio para Clientes 3PL (`_portal/portal.tsx`)**:
  * Tarjetas KPI de control: SKUs activos en custodia, unidades físicas en stock, total de guías de despacho y pedidos OMS recibidos.
  * **Pestaña "Mi Inventario en Custodia"**: Saldos en tiempo real extraídos de `stock_balances` con filtros por bodega y desglose de ubicación física (slotting WMS), número de lote y fecha de vencimiento.
  * **Pestaña "Guías de Despacho"**: Historial de traslados y entregas con buscador por número de guía o transportista, badges de estado y visor de líneas físicas.
  * **Pestaña "Mis Pedidos OMS"**: Visualización del avance operativo de pedidos multicanal recibidos por webhooks o carga masiva, con detalle de productos y enlace a la guía generada.
  * **Comprobante Imprimible de Guía de Despacho**: Modal con diseño limpio y apto para impresión (`window.print()`) que incluye advertencia legal obligatoria: `"DOCUMENTO INTERNO DE TRASLADO 3PL — BORRADOR OPERATIVO (NO VÁLIDO COMO DTE FISCAL SII)"`, permitiendo a los clientes respaldar sus movimientos físicos sin confusión con la emisión fiscal electrónica.
* **Administración de Accesos al Portal desde EasyERP Staff (`dispatch.tsx`)**:
  * Sección "Acceso al Portal Cliente (3PL)" en la ficha de cada cliente 3PL.
  * Vinculación de correos de usuarios registrados en el sistema mediante RPC seguro `assign_party_portal_user`.
  * Listado de usuarios autorizados con fecha de vinculación y acción para revocar o desvincular el acceso en tiempo real.

---

## 23. Vertical 3PL — Contratos y Tarifarios ([`/dispatch`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dispatch.tsx))
* **Contratos Marco de Servicios 3PL (`service_contracts`)**:
  * Definición de contratos comerciales por cliente 3PL vinculados a la empresa activa (`entity_id`, `party_id`), con restricción de unicidad para garantizar un único contrato rector por relación comercial.
  * Configuración de frecuencia de liquidación mediante enum `billing_frequency` (`mensual`, `quincenal`).
  * Control de estado (`active: true/false`) con posibilidad de pausar o reactivar contratos en cualquier momento sin perder el histórico de tarifas.
* **Matriz de Tarifas de Servicio (`service_rate_lines`)**:
  * Desglose granular de tarifas pactadas vinculadas al contrato, clasificadas por `service_rate_type`:
    1. **Almacenaje por Pallet (`storage_pallet`)**: Tarifa unitaria cobrada por posición pallet estándar al mes o quincena.
    2. **Almacenaje por m² (`storage_m2`)**: Tarifa por metro cuadrado de bodega ocupado.
    3. **Picking por Unidad (`picking_unit`)**: Tarifa variable por unidad física extraída y embalada en los procesos WMS.
    4. **Transporte por Km (`transport_km`)**: Tarifa variable por kilómetro recorrido en rutas TMS o traslados locales.
    5. **Recargo Fijo / Otros (`recargo_fijo`)**: Cargos fijos por administración, seguro de carga, recargo por combustible o despachos en días festivos.
  * Edición ágil: alta, visualización formateada en moneda nacional (CLP) y eliminación de conceptos tarifarios desde la misma ficha del cliente.
* **Captura y Tarificación de Kilómetros en Guías de Despacho (`dispatch_notes.distance_km`)**:
  * Registro de la distancia en kilómetros (`distance_km`) tanto en el formulario de emisión de guías como en el modal de detalle y picking de la guía.
  * Permite respaldar y auditar el cobro por kilómetro (`transport_km`) para su liquidación automatizada en el Sprint 26.

