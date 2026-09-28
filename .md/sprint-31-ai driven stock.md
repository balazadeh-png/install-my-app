# Sprint 31: AI-Driven Predictive Analytics & Automated Stock-Out Alerts

## Objetivo del Sprint
Implementar una capa de analítica predictiva y automatización de alertas en la base de datos PostgreSQL (via Supabase) para proyectar quiebres de stock (*stock-outs*), calcular consumo diario promedio (*burn-rate*) por ítem/empresa, e integrar notificaciones en tiempo real directo en el portal de clientes 3PL.

---

## Alcance Técnico

### 1. Base de Datos (PostgreSQL / Supabase)
*   **Función PL/pgSQL `get_inventory_stockout_forecast()`:**
    *   Calcula el consumo diario promedio de los últimos 30 días basándose en los movimientos de salida del kardex (`kardex_movements` con cantidad negativa).
    *   Proyecta los días restantes de inventario (`days_to_stockout`) dividiendo el stock actual entre el consumo diario.
    *   Clasifica el estado del inventario en `CRITICAL` (menor o igual a 7 días), `WARNING` (menor o igual a 14 días) o `HEALTHY`.
*   **Tabla de Alertas `client_alerts`:**
    *   Almacena alertas multi-empresa aisladas por `company_id` con políticas RLS habilitadas.
    *   Campos: `id`, `company_id`, `item_id`, `severity`, `message`, `is_read`, `created_at`.
*   **Automatización `check_and_create_stockout_alerts()`:**
    *   Función programada para limpiar alertas críticas resueltas y generar nuevas advertencias automáticas basadas en el motor predictivo.

### 2. Capa Backend & Procesamiento (Python)
*   Script con Pandas y Supabase Client para procesar lotes de líneas de pedidos (`order_items`) y calcular tendencias de demanda semanales mediante medias móviles o regresiones para alimentar los dashboards ejecutivos.

### 3. Interfaz de Usuario (React + Lovable + shadcn/ui)
*   **Componente `ClientStockoutAlerts`:**
    *   Integrado en el portal de clientes (`src/routes/_portal/portal.tsx`)[cite: 1].
    *   Consulta de forma segura las alertas no leídas filtradas por el `company_id` activo del usuario.
    *   Renderizado visual de alertas críticas con componentes de tipo `Alert` y advertencias de iconos de riesgo (`AlertTriangle`).

---

## Tareas de Implementación (Checklist para Antigravity)

1.  **Migración SQL:**
    *   Crear la migración en Supabase para la función de pronóstico de inventario y quiebre de stock.
    *   Crear la tabla `client_alerts` junto con sus políticas de Row Level Security (RLS).
    *   Implementar la función de generación automática de alertas.
2.  **Scripts de Analítica:**
    *   Añadir el script de pronóstico de demanda en Python para ejecución programada.
3.  **Frontend & Componentes:**
    *   Crear el componente de alertas UI en la ruta del portal (`src/routes/_portal/`)[cite: 1].
    *   Conectar el estado con las consultas asíncronas de Supabase.