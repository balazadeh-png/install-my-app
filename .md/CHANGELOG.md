# Registro de Cambios y Mejoras (Changelog) - EasyERP

Todos los cambios notables, nuevas funcionalidades y mejoras en el proyecto se registran en este documento.

## [Sprint 39: Dashboard Financiero (Finanzas) con Ratios IFRS, Flujo de Caja y Drill-Down Multinivel] - 2026-10-03

### Añadido
* **Migración SQL y Modelo Financiero Analítico** ([`20261003000039_sprint39_dashboard_financiero.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20261003000039_sprint39_dashboard_financiero.sql)):
  * Columna `is_current boolean DEFAULT NULL` en la tabla `public.accounts` e índice `idx_accounts_is_current` para clasificación formal de liquidez IFRS (Activo/Pasivo Corriente vs No Corriente).
  * Función RPC `get_account_balance_as_of(p_entity_id uuid, p_account_id uuid, p_as_of_date date)`: calcula el saldo contable acumulado respetando la naturaleza deudora/acreedora de la cuenta.
  * Función RPC `get_monthly_income_statement(p_entity_id uuid, p_start_date date, p_end_date date)`: serie mensual agregada con ingresos operacionales, costo de ventas (COGS), margen bruto, gastos operacionales (OPEX) y resultado neto.
  * Función RPC `get_monthly_cash_flow(p_entity_id uuid, p_start_date date, p_end_date date)`: serie mensual agregada de flujos de efectivo netos (cobros, pagos a proveedores/gastos y saldo neto) basada en líneas de diario de cuentas bancarias y de tesorería (`accounts.is_cash = true`).
  * Función RPC `get_account_type_breakdown(p_entity_id uuid, p_type text, p_start_date date, p_end_date date)`: desglose de cuentas individuales por categoría y rango mensual con monto neto y cálculo porcentual relativo.
  * Función RPC `get_days_inventory_outstanding(p_entity_id uuid, p_as_of_date date, p_period_days int DEFAULT 365)`: cálculo del Ratio DIO (Días de Rotación de Inventario = Saldo Inventario / COGS Diario) con métricas de stock y costo de ventas.
  * Función RPC `get_financial_dashboard_summary(p_entity_id uuid, p_as_of_date date)`: cálculo ejecutivo atómico de KPIs IFRS (Activo y Pasivo Corriente, Razón Corriente, Prueba Ácida, Deuda/Patrimonio, Margen Neto, Cuentas por Cobrar y por Pagar, Días DIO, y líneas bancarias pendientes de conciliación).
  * Registro del módulo `'financial_dashboard'` en el catálogo maestro `public.modules` ('Finanzas') y activación por defecto en `public.company_modules`.
* **Clasificación de Liquidez en Plan de Cuentas** ([`accounting.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/accounting.tsx)):
  * Selector en el formulario de creación de cuentas para definir `is_current` (Corriente / No Corriente) en cuentas de Activo y Pasivo.
  * Nueva columna interactiva "Clasificación Liquidez" en la tabla del catálogo de cuentas con selector reactivo para ajustar en línea la clasificación (`Corriente`, `No Corriente`, `Sin clasificar`) con actualización inmediata en base de datos (`updateAccountLiquidityMutation`).
* **Navegación y Vistas de Drill-Down Multinivel (Nivel 1, 2 y 3)**:
  * Diálogo modal [`AccountTypeBreakdownDialog.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/components/accounting/AccountTypeBreakdownDialog.tsx): Nivel 2 que muestra el desglose analítico de cuentas para una categoría y mes seleccionados en los gráficos, con porcentaje de contribución y botón directo "Ver Libro Mayor".
  * Drawer de Libro Mayor [`AccountLedgerDrawer.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/components/accounting/AccountLedgerDrawer.tsx): Nivel 3 optimizado con propiedades `defaultStartDate` y `defaultEndDate` para abrir directamente el rango del mes inspeccionado, permitiendo saltar con un clic al comprobante de origen (`SourceDocumentDialog`).
* **Página y Dashboard Financiero Ejecutivo** ([`dashboard-financiero.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dashboard-financiero.tsx)):
  * Selector global de período (rango de meses) y fecha de corte.
  * Gráfico de Estado de Resultados Mensual (Recharts ComposedChart de barras y línea de margen neto) con botones de drill-down rápido por categoría.
  * Gráfico de Flujo de Caja Operativo Mensual con drill-down a libro mayor de tesorería y bancos.
  * Tarjetas de Cuentas por Cobrar (Clientes) y Cuentas por Pagar (Proveedores) con saldos al corte y acceso directo a mayor contable.
  * Indicador de Rotación de Inventarios (Días DIO) con stock promedio valorizado y costo de ventas.
  * Panel IFRS de Ratios de Liquidez (Razón Corriente, Prueba Ácida), Endeudamiento (Deuda / Patrimonio) y Rentabilidad (Margen Neto), con alerta de auditoría si existen cuentas de balance sin clasificar.
  * Tarjeta de Alerta de Tesorería con movimientos bancarios pendientes de conciliación y enlace directo al módulo de bancos.
* **Integración Global de Navegación y Permisos**:
  * Registro de ruta `/dashboard-financiero` en [`routeTree.gen.ts`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routeTree.gen.ts).
  * Tarjeta de acceso en el panel principal [`dashboard.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dashboard.tsx).
  * Acceso directo en cabecera global [`AppHeader.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/components/layout/AppHeader.tsx).
  * Configuración y preset contable en modal de módulos [`CompanyModulesModal.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/components/setup/CompanyModulesModal.tsx).

---

## [Sprint 38: Órdenes de Compra con Catálogo de Proveedor y Numeración Atómica] - 2026-10-03

### Añadido
* **Migración SQL y Modelo de Órdenes de Compra (OC)** ([`20261003000038_sprint38_orden_de_compra.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20261003000038_sprint38_orden_de_compra.sql)):
  * Tipo enum `public.po_status` con estados `'draft'`, `'sent'`, `'confirmed'`, `'cancelled'`, `'closed'`.
  * Tabla `public.purchase_orders`: cabecera de orden de compra multiempresa con correlativo atómico `po_number` (único por `entity_id` y `po_number`), proveedor (`party_id`), bodega de destino (`warehouse_id`), centro de costos (`cost_center_id`), fechas de emisión y entrega esperada, moneda y tipo de cambio, observaciones comerciales y montos calculados (neto, IVA y total).
  * Tabla `public.purchase_order_lines`: detalle de líneas enlazadas con `supplier_catalog_items` (catálogo del proveedor), discriminación de `item_type` (`'producto'` o `'servicio'`), cantidad, precio pactado, tasa de IVA y subtotal de línea.
  * Columna gancho `purchase_invoices.purchase_order_id` (FK nullable) para permitir la asociación y habilitar el futuro 3-Way Match entre OC y facturación sin alterar registros históricos.
  * Función RPC transaccional `public.create_purchase_order(...)`: asigna el número de orden de forma atómica mediante `get_next_entry_number(_entity_id, 'OC-')` con bloqueo pesimista `FOR UPDATE`, valida cantidades y precios positivos, calcula subtotales e impuestos e inserta cabecera y líneas en una sola transacción protegida por `SECURITY DEFINER`.
  * Políticas de Seguridad RLS: permisos completos para el staff interno según la empresa activa (`user_has_company_access`) y permisos de solo lectura para proveedores en el portal sobre sus propias órdenes (`user_has_party_access`).
* **Componentes de Emisión y Consulta de Órdenes de Compra**:
  * Diálogo modal [`CreatePurchaseOrderDialog.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/components/purchases/CreatePurchaseOrderDialog.tsx): formulario de cabecera con selección de proveedor, bodega de recepción, centro de costo, fecha esperada y glosa de observaciones. Selector dinámico de ítems en cada línea filtrado estrictamente al catálogo activo del proveedor seleccionado, prellenando descripción comercial, tipo y precio unitario pactado con recálculo dinámico de subtotal, IVA (19%) y total.
  * Diálogo modal [`ViewPurchaseOrderDialog.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/components/purchases/ViewPurchaseOrderDialog.tsx): vista detallada con membrete formal, datos del proveedor y recepción, desglose de líneas con SKU de catálogo, observaciones de despacho, totales y botón de impresión / PDF (`window.print()`).
* **Integración en Módulo de Compras** ([`purchases.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/purchases.tsx)):
  * Botón de acción rápida "Nueva Orden de Compra" en la cabecera.
  * Pestaña dedicada "Órdenes de Compra ({count})": listado con número de OC, proveedor, fecha, entrega esperada, montos neto / IVA / total, badge de estado y botón "Ver / PDF".

---

## [Sprint 37: Gestión de Proveedores, Catálogo y Portal] - 2026-10-03

### Añadido
* **Migración SQL y Modelo de Proveedores & Catálogo** ([`20261003000037_sprint37_gestion_proveedores_catalogo_portal.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20261003000037_sprint37_gestion_proveedores_catalogo_portal.sql)):
  * Columna `requires_contract boolean DEFAULT false` en la tabla `public.parties`.
  * Tipo enum `public.catalog_item_type` con valores `'producto'` y `'servicio'`.
  * Tabla `public.supplier_catalog_items`: catálogo independiente por proveedor con SKU (`supplier_sku`), nombre, descripción, tipo, precio unitario, moneda, unidad de medida (`uom`), vinculación opcional a ítem interno (`linked_item_id`) y estado activo/inactivo (con restricción única por `party_id` y `supplier_sku`).
  * Tabla `public.supplier_contracts`: historial de versiones de contratos en PDF con número de versión correlativo (`version_number`), ruta y nombre de archivo en Supabase Storage, notas comerciales, flag de vigencia actual (`is_current`) y usuario responsable.
  * Bucket privado de Supabase Storage `supplier-contracts` con convención de ruta `{entity_id}/{party_id}/{timestamp}-{nombre_archivo}` y políticas RLS: staff interno con `user_has_company_access` y roles `admin` o `purchasing`; portal de proveedores con lectura protegida vía `user_has_party_access`.
  * Políticas RLS en tablas: staff gestiona por empresa; proveedores en el portal gestionan su propio catálogo (lectura, alta y edición) y leen sus contratos en modo solo lectura.
  * Registro del módulo `'suppliers'` en el catálogo maestro `public.modules` ('Operaciones').
* **Gestión de Contratos y Catálogos en Compras** ([`purchases.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/purchases.tsx)):
  * En la pestaña Directorio de Proveedores: indicador visual de estado de contrato (`Vigente (vN)`, `Pendiente` o `Opcional`) con enlace directo a gestión de acuerdos.
  * Diálogo modal [`SupplierContractManagerDialog.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/components/purchases/SupplierContractManagerDialog.tsx): toggle de requerimiento formal de contrato, historial completo de versiones con notas y descarga segura de PDF mediante URL firmada (1 hora de vigencia), y subida de nuevas versiones PDF versionadas automáticamente.
  * Diálogo modal [`SupplierCatalogManagerDialog.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/components/purchases/SupplierCatalogManagerDialog.tsx): buscador reactivo, alta manual con discriminación de producto/servicio y vinculación a ítem de inventario interno, activación/desactivación de ítems (sin borrado destructivo para proteger historial de órdenes), y carga masiva mediante planillas Excel/CSV con pre-validación exhaustiva que reporta filas válidas e inconsistencias (SKU vacío, precio negativo o duplicados) antes de confirmar el upsert.
* **Portal de Proveedores Reutilizado** ([`_portal/route.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_portal/route.tsx), [`_portal/portal.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_portal/portal.tsx) y [`SupplierPortalView.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/components/portal/SupplierPortalView.tsx)):
  * Detección automática de tipo de tercero (`parties.classification = 'supplier'`).
  * Encabezado y navegación adaptados mostrando el rol de Proveedor Oficial y la Razón Social de la empresa compradora.
  * Pestaña "Mi Catálogo": edición completa y autónoma por parte del proveedor de sus propios productos/servicios, alta manual y carga masiva por Excel/CSV.
  * Pestaña "Mis Contratos": visualización y descarga en PDF de contratos y anexos en modo seguro de solo lectura.

---

## [Sprint 33: Configuración Granular de Módulos por Empresa] - 2026-09-29

### Añadido
* **Migración SQL y Esquema de Módulos por Empresa** ([`20260929000033_sprint33_company_modules.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260929000033_sprint33_company_modules.sql)):
  * Tabla `public.company_modules(id, entity_id, module_name, enabled, created_at, updated_at)` con restricción única compuesta sobre `(entity_id, module_name)`.
  * Catálogo de 17 módulos del sistema registrados en `public.modules` categorizados en Finanzas, Operaciones, Logística 3PL, Impuestos y Configuración.
  * Función RPC `get_company_modules(p_entity_id uuid)`: retorna todos los módulos del sistema con su estado de activación para la empresa, garantizando que el módulo `setup` siempre esté habilitado.
  * Función RPC `set_company_modules_bulk(p_entity_id uuid, p_modules jsonb)`: actualiza atómicamente la habilitación de módulos en lote para una empresa.
  * Políticas de seguridad RLS: lectura autorizada para usuarios autenticados y modificación restringida a administradores.
  * Backfill automático para habilitar módulos por defecto a todas las entidades legales existentes en el sistema.
* **Hook React Reactivo** ([`useCompanyModules.ts`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/hooks/useCompanyModules.ts)):
  * Consulta centralizada con `react-query` y clave de caché `['company-modules', entityId]`.
  * Normalización automática de identificadores de módulos (guiones bajos y medios) y fallback seguro.
  * Métodos de utilidad: `isModuleEnabled(name)`, lista de módulos habilitados y estado de carga.
* **Componente y Modal de Configuración** ([`CompanyModulesModal.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/components/setup/CompanyModulesModal.tsx)):
  * Modal interactivo accesible desde la tabla de Empresas Registradas en `/setup`.
  * Visualización de detalles de la empresa (Razón Social, RUT, Código) y contador dinámico de módulos activos.
  * Switches individuales por módulo agrupados por categoría funcional con descripción e íconos temáticos.
  * Botones de Plantillas / Presets rápidos:
    * *Habilitar Todos*: activa los 17 módulos.
    * *Asesoría Contable & Tributaria*: enfocado en contabilidad, libros SII, impuestos, DDJJ, reportes y configuración.
    * *Operador Logístico 3PL*: enfocado en inventario, guías 3PL, portal clientes, facturación y BI 3PL.
    * *Comercial & POS*: enfocado en ventas, compras, POS e inventario.
  * Bloqueo permanente de seguridad en el módulo de Configuración para impedir bloqueos accidentales de administración.
* **Filtrado Reactivo en la Navegación y Dashboard**:
  * Menú "Módulos" de la barra superior ([`AppHeader.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/components/layout/AppHeader.tsx)): filtra automáticamente las opciones visibles según la empresa activa seleccionada.
  * Botón de acceso rápido "Portal 3PL" en la barra de navegación: se oculta si la empresa activa no tiene el módulo logístico habilitado.
  * Cuadrícula de accesos en el panel de control ([`dashboard.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dashboard.tsx)): despliega únicamente las tarjetas de los módulos activados para la empresa, con badge informativo de módulos habilitados.

---

## [Sprint 32: Gestión Integral de Usuarios, Roles y Seguridad Multiempresa] - 2026-09-28

### Añadido
* **Migración SQL de Seguridad y Gestión de Usuarios** ([`20260928000032_sprint32_gestion_usuarios_roles.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260928000032_sprint32_gestion_usuarios_roles.sql)):
  * Función RPC `admin_get_users_list()`: retorna la lista integral de usuarios con sus correos, perfiles, rol de sistema y detalle de empresas autorizadas en JSON.
  * Función RPC `admin_create_user(p_email, p_password, p_full_name, p_role, p_company_ids, p_default_company_id)`: creación atómica en `auth.users`, `auth.identities`, `public.profiles`, `public.user_roles` y `public.company_users`.
  * Función RPC `admin_reset_user_password(p_user_id, p_new_password)`: reseteo directo de contraseña cifrada con `extensions.crypt(..., gen_salt('bf'))`.
  * Función RPC `admin_toggle_user_active(p_user_id, p_active)`: activación y desactivación de usuarios con restricción de login y protección de auto-bloqueo.
  * Función RPC `admin_delete_user(p_user_id)`: borrado definitivo y en cascada de credenciales y registros relacionados.
  * Función RPC `admin_update_user_role(p_user_id, p_new_role)`: actualización ágil de rol del sistema.
  * Función RPC `admin_set_user_companies(p_user_id, p_company_assignments, p_default_company_id)`: asignación granular de permisos empresa por empresa con rol específico y selección de empresa predeterminada.
* **Componente y Módulo Frontend de Usuarios y Roles** ([`UsersAndRolesManager.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/components/users/UsersAndRolesManager.tsx)):
  * Vista con pestañas para "Gestión de Usuarios" y "Roles del Sistema".
  * Tarjetas de estadísticas en tiempo real (Total Usuarios, Activos, Inactivos, Administradores).
  * Barra de búsqueda reactiva por correo, nombre o usuario, combinada con filtros por Rol y Estado.
  * Modal interactivo para Crear Usuario con autogeneración de claves seguras y selección de empresas.
  * Modales dedicados para Resetear Contraseña, Cambiar Rol, Gestionar Empresas Granulares y Eliminar Usuario.
  * Matriz descriptiva de los 6 roles del sistema (`admin`, `accountant`, `sales`, `purchasing`, `inventory`, `viewer`) con capacidades y módulos permitidos.
* **Navegación e Integración de Acceso Rápido**:
  * Integración en [`setup.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/setup.tsx) completando la pestaña `Roles & Usuarios` con soporte de parámetros de búsqueda (`?tab=roles`).
  * Enlace directo en el menú desplegable "Módulos" de la barra superior ([`AppHeader.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/components/layout/AppHeader.tsx)).
  * Tarjeta de acceso al módulo en el panel principal ([`dashboard.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dashboard.tsx)).

---

## [Sprint 31: AI-Driven Predictive Analytics & Automated Stock-Out Alerts] - 2026-09-28

### Añadido
* **Motor Predictivo y Automatización de Quiebres en PostgreSQL** ([`20260928000031_sprint31_ai_driven_stock_forecast.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260928000031_sprint31_ai_driven_stock_forecast.sql)):
  * Vistas de compatibilidad `kardex_movements` (sobre `stock_ledger_entries`) y `order_items` (sobre `sales_order_lines` y `sales_orders`).
  * Tabla `client_alerts` con segregación multi-inquilino por empresa (`company_id`) y cliente (`party_id`), índices de búsqueda y políticas RLS para lectura y actualización por portal y staff.
  * Función PL/pgSQL `get_inventory_stockout_forecast(company_id, party_id)`: calcula el consumo diario promedio de los últimos 30 días (`qty_change < 0` en salidas de kardex), proyecta días restantes de inventario (`days_to_stockout = current_stock / avg_daily_consumption`), y clasifica ítems en `CRITICAL` (≤ 7 días o stock agotado), `WARNING` (8-14 días) o `HEALTHY` (> 14 días).
  * Función PL/pgSQL `check_and_create_stockout_alerts(company_id, party_id)`: procesa automáticamente el motor predictivo, resuelve alertas no leídas cuando el stock se recupera, e inserta o actualiza notificaciones activas para clientes.
  * Funciones RPC `mark_client_alert_read` y `mark_all_client_alerts_read` para gestión de notificaciones.
* **Script de Analítica Predictiva en Python** ([`scripts/forecast_demand_trends.py`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/scripts/forecast_demand_trends.py)):
  * Pipeline por lotes con soporte de Pandas, cálculo de medias móviles semanales (7d / 14d), estimación de burn rate y detección de quiebres de stock.
* **Servicios de Servidor TypeScript** ([`src/lib/stockForecast.functions.ts`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/lib/stockForecast.functions.ts)):
  * `getInventoryForecastFn` y `triggerStockoutAlertsCheckFn` para consultas y ejecuciones del pronóstico.
* **Componente y Notificaciones en Portal de Clientes** ([`ClientStockoutAlerts.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/components/portal/ClientStockoutAlerts.tsx) y [`portal.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_portal/portal.tsx)):
  * Alertas visuales destacadas con `Alert variant="destructive"` e ícono `AlertTriangle` para riesgos críticos de quiebre (&le; 7 días).
  * Alertas preventivas en ámbar para inventario entre 8 y 14 días.
  * Opciones para descartar individualmente o marcar todas como leídas.
  * Nueva pestaña "Predicción AI" en el portal con tabla analítica completa, búsqueda, filtros de estado y recomendaciones operacionales automatizadas.
* **Integración en Panel 3PL de Operaciones** ([`dashboard-3pl.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dashboard-3pl.tsx)):
  * Pestaña "Quiebres AI" en el dashboard de control para que el operador logístico supervise artículos en riesgo de todos los clientes y dispare recalculaciones en tiempo real.

---

## [Sprint 30: Medición Configurable de Almacenaje por Bodega] - 2026-09-28

### Añadido
* **Migraciones SQL de Medición de Almacenaje** ([`20260928000029_sprint30a_enum_service_rate_type.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260928000029_sprint30a_enum_service_rate_type.sql) y [`20260928000030_sprint30b_medicion_almacenaje.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260928000030_sprint30b_medicion_almacenaje.sql)):
  * Enums `storage_measure_method` (`by_location`, `by_item_attributes`, `by_warehouse_default`, `manual`) y `storage_measure_basis` (`pallet`, `m2`, `m3`, `unit`).
  * Nuevos tipos de tarifas en enum `service_rate_type`: `storage_m3` y `storage_unit`.
  * Columnas en `warehouses`: `storage_measure_method`, `storage_measure_basis`, `default_units_per_pallet`, `storage_capacity`.
  * Columnas físicas en `warehouse_locations`: `pallet_positions` (default 1) y `area_m2`.
  * Columnas físicas en `items`: `units_per_pallet` y `unit_volume_m3`.
  * Función nativa `stock_balance_at(p_entity_id, p_warehouse_id, p_item_id, p_party_id, p_as_of_date)` para consultar saldos a una fecha determinada reconstruidos desde el Kardex (`stock_ledger_entries`).
  * Función nativa `storage_measure_on(p_warehouse_id, p_party_id, p_date)` para computar la ocupación física real en pallets, m², m³ o unidades según el método configurado en la bodega.
  * Función nativa `get_storage_usage(p_entity_id, p_party_id, p_start_date, p_end_date)` para calcular el uso diario o puntual de almacenamiento aplicable a la facturación de servicios 3PL.
* **Liquidación y Previsualización de Facturación 3PL** ([`src/lib/billing3pl.functions.ts`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/lib/billing3pl.functions.ts)):
  * `previewServiceBillingFn`: Servidor que calcula y previsualiza de forma transparente las líneas liquidables sin emitir facturas, detectando bodegas manuales o sin tarifas.
  * Soporte de tarifas por m³ (`storage_m3`) y unidad (`storage_unit`) junto a pallets y m².
* **Gestión WMS e Inventario ([`inventory.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/inventory.tsx) y [`dispatch.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dispatch.tsx))**:
  * Nueva pestaña "Ubicaciones WMS" en inventario para administrar posiciones físicas de racks/pasillos.
  * Formulario y modal de creación de ubicaciones WMS con `pallet_positions` y `area_m2`.
  * Modal y tabla de catálogo de productos con `units_per_pallet` y `unit_volume_m3`.
  * Modal de previsualización detallada de liquidación 3PL antes de generar facturas en `dispatch.tsx`.
* **Configuración de Medición en Dashboard BI 3PL ([`dashboard-3pl.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dashboard-3pl.tsx))**:
  * Modal "Configurar medición" para parametrizar método, base, unidades por pallet y capacidad de cada bodega.
  * Integración con RPC `get_storage_usage` para tasas de ocupación reales sin multiplicadores inventados.

---

## [Sprint 29: Correcciones Críticas 3PL — Facturación, Portal y Webhooks] - 2026-09-28

### Corregido & Mejorado
* **Regla de la Verdad y Eliminación de Multiplicadores Arbitrarios**:
  * Removidas divisiones artificiales (`units / 50` para pallets, `units / 25` para m²) en [`billing3pl.functions.ts`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/lib/billing3pl.functions.ts) y [`dashboard-3pl.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dashboard-3pl.tsx).
  * Corregida lectura de saldo en `stock_balances` (`qty_on_hand` en lugar de la columna inexistente `balance`).
* **Ingesta Atómica y Segura de Pedidos OMS** ([`20260928000028_sprint29_correcciones_3pl.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260928000028_sprint29_correcciones_3pl.sql) y [`oms.functions.ts`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/lib/oms.functions.ts)):
  * Función RPC transaccional `ingest_oms_order` para autenticar tokens y crear pedido con sus líneas de forma atómica.
  * Hashing obligatorio de tokens con SHA-256 (`token_hash` y prefijo `token_prefix`). El token plano ya no se persiste en texto plano en la base de datos.
  * Coincidencia exacta de SKU (`lower(code) = lower(external_sku)`) para la entidad dueña del catálogo. Eliminado el fallback arbitrario a productos no relacionados.
  * Manejo estricto de idempotencia (`party_id`, `channel`, `external_order_id`) retornando HTTP 200 con `{ ignored: true }` si ya existía el pedido.
* **Endurecimiento RLS de Portal Cliente**:
  * Políticas RLS sobre `party_portal_users` para impedir fuga de datos entre empresas.
  * Función con `SECURITY DEFINER` `get_party_portal_users` para verificar usuarios autorizados de cada cliente.
  * Restricción de acceso en catálogo `items` para usuarios del portal: solo pueden leer ítems con los que tienen custodia, movimientos o guías.
  * Eliminado el texto estático engañoso "Sesión Segura (RLS Cliente)" en [`_portal/route.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_portal/route.tsx), reflejando dinámicamente el nombre del cliente auditado.

---

### Añadido
* **Módulo de Rentabilidad por Cliente 3PL ([`dashboard-3pl.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dashboard-3pl.tsx))**:
  * Nueva pestaña analítica **"Rentabilidad por Cliente"** que combina datos financieros reales con costeo de gestión operativo.
  * **Ingreso Real por Cliente**: Suma de facturación neta (`total_amount`) proveniente directamente de `sales_invoices` (Sprint 6 y Sprint 26) para facturas no canceladas emitidas dentro del rango temporal seleccionado.
  * **Asignación Proporcional de Costos de Gestión**: Distribución transparente y proporcional del costo operativo del período (`operational_cost_inputs.total_cost`) entre clientes según su ponderación de actividad física en bodega:
    $$\text{Puntos de Actividad} = \text{Unidades Pickeadas} + (\text{Saldos en Custodia} \times 0.5)$$
  * **Margen de Contribución Estimado**: Cálculo de Margen = Ingreso Real - Costo Asignado Estimado, y porcentaje de margen sobre ventas.
  * **Transparencia y Rigor Metodológico**:
    * Etiquetado explícito de costos y márgenes como "Estimado*" para evitar confusiones con contabilidad analítica formal o costeo por absorción.
    * Si no existen insumos de costos registrados en el período, el sistema muestra exclusivamente la facturación neta real junto con un aviso y botón de acción para cargar los costos operativos de bodega, impidiendo la generación de márgenes ficticios o inventados.
  * **Ordenamiento Dinámico y Filtros**:
    * Selector para ordenar clientes por mayor facturación ("Mayor Ingreso") o por mayor margen ("Mayor Margen").
    * Badges de estado comercial: "Rentable" (margen positivo), "En Pérdida" (costo asignado superior a facturación) o "Facturado / Sin Movimiento".
  * **Metadatos y Título del Dashboard**: Actualizados para reflejar tanto los KPIs operacionales como los comerciales.

---

## [Sprint 27: Dashboard BI y KPIs Operacionales 3PL] - 2026-09-27

### Añadido
* **Migración SQL de Capacidad Volumétrica y Costos Operativos** ([`supabase/migrations/20260927000026_sprint27_bi_kpis_operacionales.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260927000026_sprint27_bi_kpis_operacionales.sql)):
  * Agregada columna `capacity_m3 numeric(20,2)` a `public.warehouses` para registrar la capacidad volumétrica máxima en metros cúbicos por bodega.
  * Creada tabla `public.operational_cost_inputs` (`id`, `entity_id`, `period_start`, `period_end`, `total_cost`, `notes`, `created_at`, `created_by`) para carga manual y flexible de costos operativos mensuales/quincenales de bodega, habilitada con políticas completas de Row Level Security (RLS) multiempresa.
* **Página y Dashboard Analítico 3PL ([`dashboard-3pl.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dashboard-3pl.tsx))**:
  * Cuatro tarjetas de indicadores operacionales clave:
    1. **Nivel de Servicio OTIF (On-Time In-Full)**: Porcentaje global de guías entregadas a tiempo ($\le 24$ horas entre salida y llegada) y empaque completo (100% de líneas embaladas).
    2. **Alertas de SLA (Cuellos de Botella)**: Identificación de órdenes en estado borrador con antigüedad superior al umbral configurable (default: 2 días) y picking pendiente.
    3. **Costo por Unidad Procesada**: Cálculo dinámico del costo operativo unitario ($ \text{Costo Total de Bodega} / \text{Unidades Pickeadas} $) basado en `operational_cost_inputs` y `dispatch_note_lines`.
    4. **Ocupación Volumétrica de Bodegas**: Cálculo porcentual de metros cúbicos y pallets ocupados contra la capacidad configurada en `warehouses.capacity_m3`.
  * Filtros de análisis por rango de fechas (Desde / Hasta), umbral de días SLA, cliente 3PL y bodega.
  * Cuatro pestañas analíticas:
    * **OTIF por Cliente**: Desglose comparativo por cliente con volumen despachado, guías a tiempo, retrasos, incompletas, tiempo de tránsito promedio y badge de nivel de servicio.
    * **Alertas de SLA**: Tabla detallada de órdenes rezagadas con días en espera, barra de progreso de picking y enlace de gestión directa.
    * **Capacidad de Bodegas**: Tarjetas por bodega con volumen ocupado, pallets estimados, barras de progreso de ocupación y modal para configurar o actualizar los m³ máximos.
    * **Costos Operativos**: Historial de insumos de costos operativos cargados con modal para ingresar nuevos períodos de gasto.
* **Navegación e Integración ([`AppHeader.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/components/layout/AppHeader.tsx) y [`dispatch.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dispatch.tsx))**:
  * Enlace al "Dashboard BI 3PL" en el menú de navegación superior global.
  * Botón de acceso directo "Dashboard BI 3PL" en la cabecera de Operaciones 3PL (`dispatch.tsx`).
* **Tipos TypeScript y Rutas ([`types.ts`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/integrations/supabase/types.ts) y [`routeTree.gen.ts`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routeTree.gen.ts))**:
  * Tipado de `capacity_m3` en `warehouses` y tabla `operational_cost_inputs`.
  * Registro de ruta autenticada `/dashboard-3pl` en el árbol de rutas de TanStack Router.

---

## [Sprint 26: Facturación de Servicios 3PL y Notas de Ajuste] - 2026-09-27

### Añadido
* **Migración SQL para Facturación Unificada y Ajustes** ([`supabase/migrations/20260927000025_sprint26_facturacion_servicios.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260927000025_sprint26_facturacion_servicios.sql)):
  * Agregada columna `adjustment_of_invoice_id uuid REFERENCES public.sales_invoices(id) ON DELETE SET NULL` a la tabla `sales_invoices`.
  * Índice `idx_sales_invoices_adjustment_of_invoice_id` para búsquedas eficientes de trazabilidad entre facturas y sus notas de crédito/débito de ajuste.
  * Reutilización directa del modelo existente de `sales_invoices` y `sales_invoice_lines` del Sprint 6 sin duplicar esquemas de facturación ni crear subsistemas paralelos.
* **Función Servidor de Liquidación Automática de Servicios 3PL** ([`src/lib/billing3pl.functions.ts`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/lib/billing3pl.functions.ts)):
  * `generateServiceInvoiceFn`: Server Function protegida con `requireSupabaseAuth` que automatiza el cálculo de liquidación para un cliente 3PL y un rango de fechas (`period_start` a `period_end`).
  * Medición de consumos reales:
    * **Almacenaje por Pallet / m²**: Saldo de stock en custodia desde `stock_balances` al cierre de período.
    * **Picking**: Conteo de unidades desde `dispatch_note_lines` con `picked=true` en despachos realizados dentro del período.
    * **Transporte**: Suma de `distance_km` recorridos en guías de despacho durante el período.
    * **Recargo Fijo**: Aplicación de cargos fijos operacionales estipulados en contrato.
  * Prevención estricta de duplicados mediante clave estructurada de período en `memo` (`"Servicios 3PL [period_start al period_end]"`), evitando doble facturación.
  * Creación de factura en `sales_invoices` en estado borrador (`draft`) con cálculo de IVA (19%) y líneas detalladas en `sales_invoice_lines`.
* **Pestaña de Facturación 3PL en Frontend ([`dispatch.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dispatch.tsx))**:
  * Pestaña interactiva "Facturación 3PL" con selector de rango de fechas de liquidación.
  * Botón "Liquidar Período en Lote" con ejecución asíncrona sobre todos los contratos 3PL activos, reporte de éxitos, omisiones y errores.
  * Cuatro tarjetas métricas KPI: contratos vigentes, documentos totales, facturación acumulada 3PL y notas de ajuste emitidas.
  * Tabla de contratos activos con visualización de estado en el período seleccionado (Facturado con enlace / Pendiente) y botón para facturación individual inmediata.
  * Tabla de historial de facturas 3PL y notas de ajuste con desglose de importes netos, IVA, totales y estado.
  * Modal de inspección de detalle de factura con tabla desglosada de conceptos liquidados (pallets, unidades pickeadas, km, tarifas unitarias y totales).
  * Modal para emitir Notas de Ajuste (Crédito o Débito) referenciando la factura original vía `adjustment_of_invoice_id`, con cálculo dinámico de impuestos e inserción en tabla de ventas.
* **Tipos TypeScript ([`types.ts`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/integrations/supabase/types.ts))**:
  * Tipado de `adjustment_of_invoice_id` en `Row`, `Insert`, `Update` y `Relationships` de `sales_invoices`.

---

## [Sprint 25: Contratos y Tarifarios para Clientes 3PL] - 2026-09-27

### Añadido
* **Migración SQL de Contratos y Tarifarios** ([`supabase/migrations/20260927000024_sprint25_contratos_tarifarios.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260927000024_sprint25_contratos_tarifarios.sql)):
  * Enum `billing_frequency`: frecuencia de facturación del contrato (`mensual`, `quincenal`).
  * Enum `service_rate_type`: tipos de tarifas de servicios 3PL (`storage_pallet`, `storage_m2`, `picking_unit`, `transport_km`, `recargo_fijo`).
  * Tabla `service_contracts`: contrato marco de servicios 3PL por cliente (`entity_id` FK a `entities`, `party_id` FK a `parties`, `billing_frequency`, `active`, `notes`, restricción de unicidad `UNIQUE (entity_id, party_id)`). Habilitada con RLS multiempresa.
  * Tabla `service_rate_lines`: desglose de tarifas pactadas vinculadas al contrato (`contract_id` FK on delete cascade, `rate_type`, `unit_price`, `description`). Habilitada con RLS subordinada a la empresa del contrato.
  * Columna `distance_km numeric(10,2)` en tabla `dispatch_notes`: distancia recorrida en kilómetros para efectos de tarificación de transporte.
* **Gestión de Contratos y Tarifas en Frontend ([`dispatch.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dispatch.tsx))**:
  * Sección "Contrato de Servicios y Tarifario 3PL" dentro de la ficha de edición de clientes 3PL.
  * Creación y actualización de contrato con selector de frecuencia de facturación (`mensual` o `quincenal`) y conmutador para pausar o reactivar el contrato.
  * Tabla de tarifas pactadas con badges por tipo de tarifa, descripción, precio unitario y eliminación de líneas.
  * Formulario inline para agregar nuevas tarifas por pallet, m², unidad de picking, km recorrido o recargo fijo.
* **Captura de Kilómetros en Guías de Despacho ([`dispatch.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dispatch.tsx))**:
  * Campo numérico opcional "Distancia (km, opcional)" en el formulario de creación de guías de despacho.
  * Visualización de la distancia en kilómetros en la tabla principal de guías de despacho.
  * Visualización y campo editable con botón "Guardar" para registrar o actualizar la distancia recorrida directamente desde el modal de detalle y picking de la guía.
* **Tipos TypeScript ([`types.ts`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/integrations/supabase/types.ts))**:
  * Tipado de `service_contracts` y `service_rate_lines` en `Tables`.
  * Tipado de `distance_km` en `dispatch_notes`.
  * Tipado de `billing_frequency` y `service_rate_type` en `Enums`.

---

## [Sprint 24: Portal Cliente 3PL y RLS Segregado] - 2026-09-27

### Añadido
* **Migración SQL de Portal Cliente y Segregación RLS** ([`supabase/migrations/20260927000023_sprint24_portal_cliente.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260927000023_sprint24_portal_cliente.sql)):
  * Tabla `party_portal_users`: vinculación de usuarios de Supabase Auth con clientes 3PL (`user_id` FK a `auth.users`, `party_id` FK a `parties`, restricción única `UNIQUE (user_id, party_id)`). Habilitada con RLS.
  * Función `user_has_party_access(check_party_id uuid)` (`SECURITY DEFINER STABLE`): función espejo de `user_has_company_access` pero orientada a clientes terceros para consultar exclusivamente su data asignada.
  * Políticas adicionales RLS aditivas para clientes en `dispatch_notes`, `dispatch_note_lines`, `stock_ledger_entries`, `parties`, `items`, `warehouses`, `warehouse_locations`, `sales_orders` y `sales_order_lines`.
  * Enforzamiento de `ALTER VIEW public.stock_balances SET (security_invoker = true)` para que las consultas del portal respeten las políticas RLS sobre las tablas base subyacentes.
  * Funciones RPC `assign_party_portal_user(p_party_id, p_email)` y `get_party_portal_users(p_party_id)` para asignación segura de usuarios sin comprometer datos confidenciales de autenticación.
* **Layout y Rutas Dedicadas del Portal Cliente ([`_portal/route.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_portal/route.tsx))**:
  * Grupo de rutas independiente en `src/routes/_portal/` totalmente separado de `_authenticated/`.
  * Verificación de sesión de autenticación sin requerir membresía en `company_users`.
  * Manejo de estado vacío claro e informativo si el usuario no tiene clientes 3PL asignados.
  * Soporte multicliente con selector dropdown si el usuario tiene acceso a más de una empresa/cliente.
* **Portal Cliente 3PL Frontend ([`_portal/portal.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_portal/portal.tsx))**:
  * Tarjetas métricas en tiempo real: SKUs activos en custodia, unidades totales en stock, guías de despacho y pedidos OMS.
  * Pestaña "Mi Inventario en Custodia": consulta directa a `stock_balances` filtrada por RLS con desglose por bodega, ubicación física, lote y fecha de vencimiento.
  * Pestaña "Guías de Despacho": historial de despachos con buscador, badges de estado y visualización de líneas.
  * Pestaña "Mis Pedidos OMS": historial de pedidos recibidos por canales digitales con estado operativo y guía asociada.
  * Modal y comprobante imprimible de Guía de Despacho con leyenda visible: `"DOCUMENTO INTERNO DE TRASLADO 3PL — BORRADOR OPERATIVO (NO VÁLIDO COMO DTE FISCAL SII)"` y disparador nativo de impresión/PDF.
* **Gestión de Accesos al Portal en Clientes 3PL ([`dispatch.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dispatch.tsx))**:
  * Sección "Acceso al Portal Cliente (3PL)" dentro del formulario de edición de clientes 3PL.
  * Formulario para vincular correos de usuarios registrados en el sistema mediante RPC seguro.
  * Listado de usuarios autorizados con indicador de estado y botón para desvincular o revocar acceso.
* **Navegación Global ([`AppHeader.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/components/layout/AppHeader.tsx))**:
  * Acceso rápido a "Portal 3PL" en la barra de navegación superior y elemento en el menú de módulos.
* **Tipos TypeScript ([`types.ts`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/integrations/supabase/types.ts))**:
  * Tipado de `party_portal_users` en `Tables`.
  * Tipado de `assign_party_portal_user`, `get_party_portal_users` y `user_has_party_access` en `Functions`.

---

## [Sprint 23: OMS — Pedidos Multicanal y Webhook de Integración] - 2026-09-27

### Añadido
* **Migración SQL de OMS Pedidos Multicanal** ([`supabase/migrations/20260927000022_sprint23_oms_pedidos_multicanal.sql`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/supabase/migrations/20260927000022_sprint23_oms_pedidos_multicanal.sql)):
  * Enum `order_status`: estados del pedido (`pendiente`, `procesado`, `cancelado`).
  * Tabla `sales_orders`: registro de pedidos recibidos por canales digitales (`channel`, `external_order_id`, `destination_address`, `status`, `dispatch_note_id`, `notes`), con restricción de unicidad anti-duplicados `UNIQUE (party_id, channel, external_order_id)`.
  * Tabla `sales_order_lines`: desglose de productos y unidades (`sales_order_id` ON DELETE CASCADE, `item_id` nullable, `external_sku`, `qty`).
  * Tabla `party_webhook_tokens`: tokens secretos de autenticación por cliente 3PL (`party_id` ON DELETE CASCADE, `token` único, `is_active`).
  * Función segura `ingest_oms_order` (`SECURITY DEFINER`): validación de token activo, mapeo de SKUs externos contra el catálogo de ítems de la empresa y upsert atómico del pedido y sus líneas.
  * Políticas de Row Level Security (RLS) multiempresa en `sales_orders`, `sales_order_lines` y `party_webhook_tokens`.
* **Motor de Ingestión y Receptor de Webhooks Server-Side**:
  * TanStack Start Server Function `ingestOmsOrderFn` ([`src/lib/oms.functions.ts`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/lib/oms.functions.ts)): endpoint server-side desacoplado de sesiones de usuario interactivas, con validación Zod y fallback seguro.
  * Endpoint HTTP directo `POST /api/webhooks/oms` ([`src/routes/api/webhooks/oms.ts`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/api/webhooks/oms.ts)): receptor público para integración directa con Shopify, VTEX, Mercado Libre, ERPs o scripts cURL mediante token.
* **Interfaz de Gestión OMS en Frontend ([`dispatch.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dispatch.tsx))**:
  * Pestaña "Pedidos OMS" con medidores y KPIs de pedidos totales, pendientes, procesados y canales activos.
  * Filtros dinámicos por texto (ID externo, cliente, dirección), estado, canal de venta y cliente 3PL.
  * Tabla de pedidos con badges estilizados por canal (Shopify, VTEX, Mercado Libre, Manual, CSV), estado y guía de despacho asociada.
  * Modal "Nuevo Pedido Manual": registro manual para canales telefónicos o directos con selector de ítems del catálogo y líneas dinámicas.
  * Modal "Importador Masivo CSV": carga en lote con parseo instantáneo de columnas `external_order_id, destination_address, sku, qty` y agrupación por pedido.
  * Acción "Convertir a Guía de Despacho": genera automáticamente la guía en borrador (`dispatch_notes` + `dispatch_note_lines`) en la bodega asignada al cliente (`party_warehouses`), marca el pedido como `procesado` y lo deja listo para picking WMS.
  * Modal "Detalle de Pedido OMS": visor exhaustivo de líneas, cantidades, notas y accesos directos a la guía generada.
* **Generador de Tokens en Clientes 3PL ([`dispatch.tsx`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/dispatch.tsx))**:
  * Botón "Generar token de integración" en la pestaña de Clientes 3PL.
  * Modal interactivo con token generado, botón de copiado rápido, URL del webhook y snippet cURL listo para usar.
  * Listado de tokens por cliente con posibilidad de activar, desactivar o revocar.
* **Tipos TypeScript ([`types.ts`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/integrations/supabase/types.ts))**:
  * Tipado de `sales_orders`, `sales_order_lines` y `party_webhook_tokens` en `Tables`.
  * Tipado de `ingest_oms_order` en `Functions`.
  * Tipado de `order_status` en `Enums` y `Constants`.

---

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
