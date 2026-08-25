# Especificación y Funcionalidad de Módulos - EasyERP (Norma Chilena / CLP)

Este documento describe en detalle cada uno de los módulos operativos integrados en el sistema ERP **EasyERP** adaptado para Chile.

---

## 1. Contabilidad & Multimoneda ([`/accounting`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/accounting.tsx))
* **Catálogo Multimoneda & Reglas Analíticas**:
  * Estructura jerárquica con código numérico (ej. `1.1.01.001`), nombre y tipo de cuenta (`Asset`, `Liability`, `Equity`, `Income`, `Expense`, `Cost of Goods Sold`).
  * Asignación de moneda propia por cuenta (`currency_code`), permitiendo cuentas en USD o divisas extranjeras conviviendo con la moneda base CLP.
  * Reglas de obligatoriedad de imputación analítica: `requires_cost_center` y `requires_business_unit` para forzar la selección de Centro de Costo y Sucursal en cuentas de resultado (gastos e ingresos).
* **Motor de Comprobantes por Partida Doble & Conversión Automática**:
  * Formulario de comprobantes contables con cabecera (fecha, tipo de comprobante, libro opcional, glosa) y tabla de $N$ líneas contables.
  * Imputación analítica por línea: selector de **Centro de Costo** (`cost_center_id`) y **Sucursal / Unidad** (`business_unit_id`).
  * Validación de existencia de tasa de cambio oficial para la fecha exacta del comprobante con modal de alta rápida integrado.
  * Validación en tiempo real del cuadre de partida doble ($\sum \text{Débitos} = \sum \text{Créditos}$) y bloqueo de guardado en caso de descuadre o falta de dimensiones requeridas.
  * Asignación atómica de número correlativo oficial (`ASI-000001`) mediante `get_next_entry_number` y `naming_series`.
  * **Inmutabilidad estricta**: Los comprobantes en estado `posted` no admiten modificación ni eliminación (`trg_journal_entries_immutability`).
  * **Mecanismo de Reversión**: Acción de anulación/reversión que genera automáticamente un contra-asiento invertido (`reversal_of`).

---

## 2. Ventas & Clientes ([`/sales`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/sales.tsx))
* **Directorio de Clientes (`parties`)**:
  * Gestión de clientes con razón social, nombre comercial y **RUT** chileno (ej. `76.123.456-K`).
  * Relación con personas de contacto (`contacts`) incluyendo correo y teléfono.
  * Modal para el registro rápido de nuevos clientes con su contacto principal.

---

## 3. Compras & Proveedores ([`/purchases`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/purchases.tsx))
* **Directorio de Suplidores (`parties`)**:
  * Registro de proveedores de materias primas, productos y servicios con **RUT**.
  * Contactos asociados para cotizaciones y pedidos.
  * Modal de alta rápida de proveedores.

---

## 4. Inventario & Bodegas ([`/inventory`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/inventory.tsx))
* **Maestro de Artículos (`items`)**:
  * Catálogo de productos y servicios con SKU/código, descripción, categoría y unidad de medida (`uom`).
  * Indicador de control de stock y método de valoración predeterminado (FIFO).
* **Bodegas y Almacenes (`warehouses`)**:
  * Registro y gestión de ubicaciones físicas de almacenamiento.
* **Unidades de Medida (`uom`)**:
  * Catálogo de unidades estándar (UNIDAD, KG, LT, etc.).

---

## 5. Bancos & Tesorería ([`/cash`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/cash.tsx))
* **Tasas de Cambio Oficiales / Dólar Observado (`exchange_rates`)**:
  * Registro y consulta del tipo de cambio oficial diario USD $\rightarrow$ CLP.
  * Indicador en tiempo real del Dólar Observado vigente.
* **Libros de Caja & Bancos (`books`)**:
  * Control de cajas chicas y cuentas corrientes bancarias en pesos chilenos y moneda extranjera.

---

## 6. Reportes Financieros & Analíticos ([`/reports`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/reports.tsx))
* **Filtros Analíticos**: Selector para segmentar estados financieros por **Centro de Costo** específico o por **Sucursal / Unidad**.
* **Balanza de Comprobación**: Sumas de débitos y créditos y saldo neto para cada cuenta del catálogo calculados directamente desde comprobantes posteados en `$ CLP`.
* **Balance General**: Desglose clasificado de Activos, Pasivos, Patrimonio y verificación de la ecuación contable.
* **Estado de Resultados (P&L)**: Resumen de ingresos operacionales, costos de venta, gastos y cálculo de la utilidad/pérdida neta del ejercicio, con capacidad de ver el P&L de una sucursal o centro de costo particular.

---

## 7. Configuración General ([`/setup`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/setup.tsx))
* **Empresas / Entidades (`entities`)**: Registro de razones sociales y sucursales con RUT y moneda base CLP.
* **Centros de Costo (`cost_centers`)**: Estructura analítica jerárquica para distribución de gastos e ingresos.
* **Unidades de Negocio & Sucursales (`business_units`)**: Gestión de sedes y filiales.
* **Años Fiscales (`fiscal_years`)**: Gestión de ejercicios contables anuales.
* **Correlativos y Series (`naming_series`)**: Prefijos y numeraciones automáticas para facturas y comprobantes.
* **Roles del Sistema (`roles`)**: Catálogo de roles de seguridad y permisos.
