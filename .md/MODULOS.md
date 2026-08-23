# Especificación y Funcionalidad de Módulos - EasyERP (Norma Chilena / CLP)

Este documento describe en detalle cada uno de los módulos operativos integrados en el sistema ERP **EasyERP** adaptado para Chile.

---

## 1. Contabilidad ([`/accounting`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/accounting.tsx))
* **Catálogo / Plan de Cuentas**:
  * Estructura jerárquica con código numérico (ej. `1.1.01.001`), nombre y tipo de cuenta (`Asset`, `Liability`, `Equity`, `Income`, `Expense`, `Cost of Goods Sold`).
  * Distinción entre cuentas de grupo (agrupadoras) y cuentas de detalle (asentables).
  * Diálogo modal para la creación de nuevas cuentas contables.
* **Libro Diario & Libro Mayor (`gl_entries`)**:
  * Registro de transacciones con trazabilidad de fecha, cuenta, concepto/memo, débito, crédito y tipo de comprobante en Pesos Chilenos (**CLP / $**).
  * Resumen automático de sumas totales de débitos y créditos con formateo `es-CL`.

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

## 6. Reportes Financieros ([`/reports`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/reports.tsx))
* **Balanza de Comprobación**: Sumas de débitos y créditos y saldo neto para cada cuenta del catálogo expresado en `$ CLP`.
* **Balance General**: Desglose clasificado de Activos, Pasivos, Patrimonio y verificación de la ecuación contable.
* **Estado de Resultados (P&L)**: Resumen de ingresos operacionales, costos de venta, gastos y cálculo de la utilidad/pérdida neta del ejercicio.

---

## 7. Configuración General ([`/setup`](file:///c:/Users/kbala/Box/My%20Canvases/Portal_Contabilidad/install-my-app/src/routes/_authenticated/setup.tsx))
* **Empresas / Entidades (`entities`)**: Registro de razones sociales y sucursales con RUT y moneda base CLP.
* **Años Fiscales (`fiscal_years`)**: Gestión de ejercicios contables anuales.
* **Correlativos y Series (`naming_series`)**: Prefijos y numeraciones automáticas para facturas y comprobantes.
* **Roles del Sistema (`roles`)**: Catálogo de roles de seguridad y permisos.
