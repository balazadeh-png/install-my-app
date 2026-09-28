# Sprint 30 — Medición de almacenaje configurable por bodega

**Fase:** 4 — Vertical 3PL / Endurecimiento
**Depende de:** Sprint 29 (facturación sin factores inventados y migraciones al día), Sprint 19 (`warehouse_locations`, `stock_ledger_entries.location_id`), Sprint 25 (tarifas de almacenaje)
**Bloquea a:** ninguno

## Objetivo

Que cada bodega virtual defina **cómo se mide su almacenaje** (pallets, m², m³ o unidades), y que la facturación (Sprint 26/29) y el panel de ocupación (Sprint 27) lean esa definición en lugar de constantes globales. El ingreso manual de cantidades del Sprint 29 queda como uno de los métodos (`manual`).

## Por qué es por bodega

Cada bodega mide distinto: una cobra por posiciones de pallet ocupadas, otra por pallets calculados desde las unidades, otra por m² de piso, otra por m³, otra por unidad almacenada. No existe una conversión universal entre esas unidades, así que **el sistema no convierte**: cada bodega entrega su medida en su propia unidad, y la tarifa del contrato debe estar en esa misma unidad.

## Métodos de medición

| Método | Qué mide | Datos que necesita | Tarifa que se aplica |
|---|---|---|---|
| `manual` (por defecto) | La cantidad que se ingresa al facturar | Ninguno | Cualquier tarifa de almacenaje |
| `pallet_positions` | Posiciones de pallet ocupadas | `warehouse_locations.pallet_positions`; todo el stock con ubicación | `storage_pallet` |
| `units_per_pallet` | Pallets = Σ ⌈saldo ÷ unidades por pallet⌉ por ítem | `items.units_per_pallet` o `warehouses.default_units_per_pallet` | `storage_pallet` |
| `area_m2` | Σ `area_m2` de las ubicaciones ocupadas | `warehouse_locations.area_m2` | `storage_m2` |
| `volume_m3` | Σ saldo × `items.unit_volume_m3` | `items.unit_volume_m3` | `storage_m3` (nueva) |
| `units` | Σ saldo | Ninguno | `storage_unit` (nueva) |

**Base temporal** (por bodega): `period_end` (saldo al cierre del período, por defecto), `daily_average` (promedio de los saldos diarios) o `daily_peak` (máximo diario del período).

## Supuestos explícitos

1. `units_per_pallet` asume que un pallet no mezcla ítems.
2. `pallet_positions` y `area_m2` solo son confiables si todos los movimientos llevan ubicación. El stock sin ubicación no se ignora en silencio: se informa como dato faltante.
3. Si a la bodega le falta algún dato requerido por su método (`missing_data > 0`), la vista previa de facturación lo muestra y **la generación se rechaza** hasta completarlo o cambiar la bodega a `manual`. Es preferible bloquear a facturar de menos sin aviso.
4. Sin conversión entre unidades: si el contrato tiene tarifa `storage_pallet` y la bodega mide en `volume_m3`, esa línea no se genera y se avisa.
5. La tarifa es por contrato y tipo, no por bodega (una tarifa distinta por bodega queda para más adelante).

## Alcance incluido

- Configuración por bodega: método, base temporal, unidades por pallet por defecto y capacidad en la unidad del método. `capacity_m3` queda como campo heredado (no se elimina, para no romper el Sprint 27); el formulario lo ofrece como valor inicial al elegir `volume_m3`.
- Datos base: `warehouse_locations.pallet_positions` y `.area_m2`; `items.units_per_pallet` y `.unit_volume_m3`.
- Dos tipos de tarifa nuevos: `storage_m3` y `storage_unit`.
- Funciones SQL: `stock_balance_at` (saldo a una fecha, por ubicación e ítem), `storage_measure_on` (medida de un día) y `get_storage_usage` (resultado por bodega para un período).
- Facturación: una línea de almacenaje por bodega, con su unidad y base temporal, leyendo `get_storage_usage`.
- Dashboard 3PL: ocupación real = medida ÷ `storage_capacity`, en la misma unidad.

## Fuera de alcance

- Tarifa distinta por bodega dentro de un mismo contrato.
- Pallets mixtos (varios ítems en un pallet) y ocupación por lote o vencimiento.
- Lectura de códigos de barras o dimensiones desde hardware.

## Cambios de esquema (sketch SQL)

Van en **dos archivos**, porque un valor nuevo de enum no se puede usar en la misma transacción en que se agrega.

**Archivo 1 — `<AAAAMMDD>000029_sprint30a_enum_service_rate_type.sql`**

```sql
ALTER TYPE public.service_rate_type ADD VALUE IF NOT EXISTS 'storage_m3';
ALTER TYPE public.service_rate_type ADD VALUE IF NOT EXISTS 'storage_unit';
```

**Archivo 2 — `<AAAAMMDD>000030_sprint30b_medicion_almacenaje.sql`**

```sql
DO $$ BEGIN
  CREATE TYPE public.storage_measure_method AS ENUM
    ('manual','pallet_positions','units_per_pallet','area_m2','volume_m3','units');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.storage_measure_basis AS ENUM ('period_end','daily_average','daily_peak');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.warehouses
  ADD COLUMN IF NOT EXISTS storage_measure_method public.storage_measure_method NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS storage_measure_basis public.storage_measure_basis NOT NULL DEFAULT 'period_end',
  ADD COLUMN IF NOT EXISTS default_units_per_pallet numeric(20,4) CHECK (default_units_per_pallet > 0),
  ADD COLUMN IF NOT EXISTS storage_capacity numeric(20,2) CHECK (storage_capacity >= 0);

ALTER TABLE public.warehouse_locations
  ADD COLUMN IF NOT EXISTS pallet_positions integer NOT NULL DEFAULT 1 CHECK (pallet_positions > 0),
  ADD COLUMN IF NOT EXISTS area_m2 numeric(20,4) CHECK (area_m2 >= 0);

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS units_per_pallet numeric(20,4) CHECK (units_per_pallet > 0),
  ADD COLUMN IF NOT EXISTS unit_volume_m3 numeric(20,6) CHECK (unit_volume_m3 >= 0);

-- Saldo por ubicación e ítem a una fecha (SECURITY INVOKER: respeta el RLS de quien consulta)
CREATE OR REPLACE FUNCTION public.stock_balance_at(p_entity_id uuid, p_party_id uuid, p_date date)
RETURNS TABLE (warehouse_id uuid, location_id uuid, item_id uuid, qty numeric)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT sle.warehouse_id, sle.location_id, sle.item_id, SUM(sle.qty_change) AS qty
  FROM public.stock_ledger_entries sle
  JOIN public.warehouses w ON w.id = sle.warehouse_id
  WHERE w.entity_id = p_entity_id
    AND sle.party_id = p_party_id
    AND sle.posting_date <= p_date
  GROUP BY sle.warehouse_id, sle.location_id, sle.item_id
  HAVING SUM(sle.qty_change) > 0;
$$;

-- Medida de un día según el método de la bodega; missing_data cuenta lo que impide medir bien
CREATE OR REPLACE FUNCTION public.storage_measure_on(
  p_entity_id uuid, p_party_id uuid, p_warehouse_id uuid,
  p_method public.storage_measure_method, p_default_upp numeric, p_date date)
RETURNS TABLE (quantity numeric, missing_data numeric)
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH b AS (
    SELECT sb.location_id, sb.item_id, sb.qty
    FROM public.stock_balance_at(p_entity_id, p_party_id, p_date) sb
    WHERE sb.warehouse_id = p_warehouse_id
  ),
  occupied AS (
    SELECT l.id, l.pallet_positions, l.area_m2
    FROM public.warehouse_locations l
    WHERE l.id IN (SELECT location_id FROM b WHERE location_id IS NOT NULL
                   GROUP BY location_id HAVING SUM(qty) > 0)
  )
  SELECT
    CASE p_method
      WHEN 'units' THEN COALESCE((SELECT SUM(qty) FROM b), 0)
      WHEN 'units_per_pallet' THEN COALESCE((
        SELECT SUM(CEIL(b.qty / COALESCE(i.units_per_pallet, p_default_upp)))
        FROM b JOIN public.items i ON i.id = b.item_id
        WHERE COALESCE(i.units_per_pallet, p_default_upp) IS NOT NULL), 0)
      WHEN 'pallet_positions' THEN COALESCE((SELECT SUM(pallet_positions) FROM occupied), 0)
      WHEN 'area_m2' THEN COALESCE((SELECT SUM(area_m2) FROM occupied), 0)
      WHEN 'volume_m3' THEN COALESCE((
        SELECT SUM(b.qty * i.unit_volume_m3)
        FROM b JOIN public.items i ON i.id = b.item_id
        WHERE i.unit_volume_m3 IS NOT NULL), 0)
    END AS quantity,
    CASE p_method
      WHEN 'units_per_pallet' THEN (
        SELECT COUNT(*) FROM b JOIN public.items i ON i.id = b.item_id
        WHERE COALESCE(i.units_per_pallet, p_default_upp) IS NULL)
      WHEN 'pallet_positions' THEN COALESCE((SELECT SUM(qty) FROM b WHERE location_id IS NULL), 0)
      WHEN 'area_m2' THEN COALESCE((SELECT SUM(qty) FROM b WHERE location_id IS NULL), 0)
                          + (SELECT COUNT(*) FROM occupied WHERE area_m2 IS NULL)
      WHEN 'volume_m3' THEN (
        SELECT COUNT(*) FROM b JOIN public.items i ON i.id = b.item_id
        WHERE i.unit_volume_m3 IS NULL)
      ELSE 0
    END AS missing_data;
$$;

-- Resultado por bodega para un período. En plpgsql, las columnas de salida son variables:
-- califica siempre con alias para evitar "column reference is ambiguous".
CREATE OR REPLACE FUNCTION public.get_storage_usage(
  p_entity_id uuid, p_party_id uuid, p_period_start date, p_period_end date)
RETURNS TABLE (warehouse_id uuid, warehouse_name text,
               method public.storage_measure_method, basis public.storage_measure_basis,
               quantity numeric, unit text, rate_type text, missing_data numeric)
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  w record; d date; r record; v_from date; v_vals numeric[]; v_missing numeric;
BEGIN
  FOR w IN
    SELECT wh.id AS wid, wh.name AS wname,
           wh.storage_measure_method AS m, wh.storage_measure_basis AS b,
           wh.default_units_per_pallet AS dup
    FROM public.warehouses wh
    WHERE wh.entity_id = p_entity_id
      AND (EXISTS (SELECT 1 FROM public.party_warehouses pw
                   WHERE pw.warehouse_id = wh.id AND pw.party_id = p_party_id)
           OR EXISTS (SELECT 1 FROM public.stock_ledger_entries s
                      WHERE s.warehouse_id = wh.id AND s.party_id = p_party_id))
    ORDER BY wh.name
  LOOP
    IF w.m = 'manual' THEN
      RETURN QUERY SELECT w.wid, w.wname, w.m, w.b, NULL::numeric, 'manual'::text, NULL::text, 0::numeric;
      CONTINUE;
    END IF;

    v_vals := ARRAY[]::numeric[];
    v_missing := 0;
    v_from := CASE WHEN w.b = 'period_end' THEN p_period_end ELSE p_period_start END;

    FOR d IN SELECT gs::date FROM generate_series(v_from::timestamp, p_period_end::timestamp, interval '1 day') gs
    LOOP
      SELECT m2.quantity, m2.missing_data INTO r
      FROM public.storage_measure_on(p_entity_id, p_party_id, w.wid, w.m, w.dup, d) m2;
      v_vals := v_vals || COALESCE(r.quantity, 0);
      v_missing := GREATEST(v_missing, COALESCE(r.missing_data, 0));
    END LOOP;

    RETURN QUERY SELECT
      w.wid, w.wname, w.m, w.b,
      CASE w.b
        WHEN 'period_end'    THEN v_vals[array_upper(v_vals, 1)]
        WHEN 'daily_average' THEN (SELECT AVG(x) FROM unnest(v_vals) x)
        WHEN 'daily_peak'    THEN (SELECT MAX(x) FROM unnest(v_vals) x)
      END,
      CASE w.m WHEN 'pallet_positions' THEN 'pallets' WHEN 'units_per_pallet' THEN 'pallets'
               WHEN 'area_m2' THEN 'm2' WHEN 'volume_m3' THEN 'm3' WHEN 'units' THEN 'unidades' END,
      CASE w.m WHEN 'pallet_positions' THEN 'storage_pallet' WHEN 'units_per_pallet' THEN 'storage_pallet'
               WHEN 'area_m2' THEN 'storage_m2' WHEN 'volume_m3' THEN 'storage_m3' WHEN 'units' THEN 'storage_unit' END,
      v_missing;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.stock_balance_at(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_measure_on(uuid, uuid, uuid, public.storage_measure_method, numeric, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_storage_usage(uuid, uuid, date, date) TO authenticated;
```

Este SQL es un sketch: los **casos de prueba de abajo** son el criterio de aceptación, y mandan sobre cualquier detalle de sintaxis.

## Cambios en servidor y UI

- **`src/lib/billing3pl.functions.ts`:** llamar una vez a `get_storage_usage` por cliente y período. Para cada `service_rate_lines` de almacenaje con `unit_price > 0`:
  - filas con `rate_type` igual al de la tarifa y `quantity > 0` → una línea por bodega: `Almacenaje — {bodega} — {qty} {unidad} ({base temporal})`;
  - filas con `method = 'manual'` → la cantidad viene de `storage_quantities` (mecanismo del Sprint 29), ahora para los cuatro tipos de almacenaje;
  - filas con `missing_data > 0` → la vista previa lo muestra y la generación se rechaza ("Bodega {nombre}: faltan datos de medición");
  - si ninguna bodega del cliente entrega la unidad de esa tarifa → advertencia "Tarifa {tipo} sin bodega con medición compatible", sin línea.
  - La vista previa devuelve además un detalle de medición por bodega para mostrarlo.
- **Configuración de bodega:** diálogo "Configurar medición" (método, base temporal, unidades por pallet por defecto, capacidad con la unidad según el método), accesible desde la tarjeta de bodega del dashboard (`dashboard-3pl.tsx`, donde hoy está `editingWarehouse`). Texto de ayuda por método que diga qué datos necesita.
- **Ubicaciones** (`dispatch.tsx` e `inventory.tsx`): campos "Posiciones de pallet" (por defecto 1) y "Área m²" (opcional).
- **Ítems** (`inventory.tsx`, formulario de alta/edición): "Unidades por pallet" y "Volumen unitario m³" (ambos opcionales).
- **Dashboard 3PL:** ocupación = `get_storage_usage` al día de hoy ÷ `storage_capacity`, solo si el método no es `manual` y hay capacidad; si no, "—" con el motivo.
- **Contratos** (Sprint 25): el selector de tipo de tarifa incluye `storage_m3` y `storage_unit`.

## Casos de prueba con números (criterio de aceptación)

| # | Datos | Resultado esperado |
|---|---|---|
| 1 | Bodega A, `units_per_pallet`, por defecto 48, `period_end`. Cliente X: ítem P saldo 100 (sin override) e ítem Q saldo 30 con `units_per_pallet` = 10 | ⌈100÷48⌉ + ⌈30÷10⌉ = 3 + 3 = **6 pallets** |
| 2 | Bodega B, `pallet_positions`. Ubicaciones: L1 (2 posiciones, saldo 5), L2 (1 posición, saldo 0), L3 (1 posición, saldo 12) | **3 pallets** |
| 3 | Igual que 2, más 7 unidades del cliente sin ubicación | `missing_data` = 7 → la generación se rechaza hasta asignarles ubicación |
| 4 | Bodega B, `pallet_positions`, `daily_average`, período del 1 al 10. El cliente tiene 0 pallets los días 1–5 y 5 pallets los días 6–10 | **2,5 pallets** |
| 5 | Mismos datos que 4 con `daily_peak` | **5 pallets** |
| 6 | Bodega C, `volume_m3`. Ítem con `unit_volume_m3` = 0,02 y saldo 250 | **5,0 m³** |
| 7 | Bodega C, un ítem sin `unit_volume_m3` con saldo 10 | `missing_data` = 1 → generación rechazada |
| 8 | Contrato con tarifa `storage_pallet`; único stock del cliente en la bodega C (`volume_m3`) | No se convierte: sin línea, y aviso "Tarifa storage_pallet sin bodega con medición compatible" |
| 9 | Cliente con stock en la bodega A (pallets) y en la C (m³), contrato con tarifas `storage_pallet` y `storage_m3` | **Dos líneas** de almacenaje, una por bodega, cada una en su unidad |
| 10 | Bodega método `pallet_positions` con `storage_capacity` = 100 y ocupación de 25 posiciones | Dashboard muestra **25 %** |
| 11 | Bodega en `manual` | Facturación pide la cantidad (Sprint 29); dashboard muestra "—" |
| 12 | Un usuario de portal ejecuta `get_storage_usage` para su propio `party_id` | Devuelve solo su medición; con el `party_id` de otro cliente, vacío |

## Criterios de aceptación

- [ ] Los 12 casos de prueba dan el resultado esperado.
- [ ] Ninguna constante de conversión entre unidades existe en el código ni en SQL.
- [ ] Toda bodega existente queda en `manual`: nada cambia para quien no configure nada.
- [ ] Los dos archivos de migración existen, son idempotentes y el enum se agrega en un archivo aparte.

---

## Prompt listo para pegar en Lovable

```
Voy a hacer que cada bodega defina cómo se mide su almacenaje, para que facturación y ocupación lo lean en vez de usar constantes. Regla: todo cambio de esquema va en archivos de migración idempotentes con el siguiente número correlativo; ningún dato faltante se reemplaza por un número inventado; no existe conversión entre unidades (pallets, m², m³, unidades).

1. Migración 1 (archivo aparte): agrega los valores 'storage_m3' y 'storage_unit' al enum service_rate_type con ADD VALUE IF NOT EXISTS.

2. Migración 2: crea los enums storage_measure_method ('manual','pallet_positions','units_per_pallet','area_m2','volume_m3','units') y storage_measure_basis ('period_end','daily_average','daily_peak'), cada uno dentro de un bloque DO con EXCEPTION WHEN duplicate_object THEN NULL. Agrega a warehouses: storage_measure_method (NOT NULL, default 'manual'), storage_measure_basis (NOT NULL, default 'period_end'), default_units_per_pallet numeric(20,4) > 0, storage_capacity numeric(20,2) >= 0. Agrega a warehouse_locations: pallet_positions integer NOT NULL default 1 (> 0) y area_m2 numeric(20,4) >= 0. Agrega a items: units_per_pallet numeric(20,4) > 0 y unit_volume_m3 numeric(20,6) >= 0. No elimines warehouses.capacity_m3.

3. En la misma migración crea las funciones SECURITY INVOKER (respetan el RLS de quien consulta) stock_balance_at(p_entity_id, p_party_id, p_date), storage_measure_on(...) y get_storage_usage(p_entity_id, p_party_id, p_period_start, p_period_end) según las fórmulas de la tabla de métodos del sprint-30-medicion-almacenaje-por-bodega.md (que está en .md/). En plpgsql califica siempre las columnas con alias para evitar ambigüedad con las columnas de salida. GRANT EXECUTE a authenticated.

4. Facturación (src/lib/billing3pl.functions.ts): llama a get_storage_usage una vez por cliente y período. Para cada service_rate_lines de almacenaje con unit_price > 0 genera una línea por bodega con rate_type coincidente y quantity > 0: "Almacenaje — {bodega} — {qty} {unidad} ({base temporal})". Las bodegas con método 'manual' usan storage_quantities (ya existe del Sprint 29; amplíalo a storage_pallet, storage_m2, storage_m3 y storage_unit). Si alguna fila trae missing_data > 0, la vista previa lo muestra y la generación se rechaza con "Bodega {nombre}: faltan datos de medición". Si ninguna bodega del cliente entrega la unidad de una tarifa, no generes esa línea y devuelve una advertencia. La vista previa devuelve además un detalle de medición por bodega y la pantalla lo muestra.

5. Configuración de bodega: crea el diálogo "Configurar medición" (método, base temporal, unidades por pallet por defecto, capacidad con la unidad según el método, con texto de ayuda de qué datos necesita cada método), accesible desde la tarjeta de bodega del dashboard 3PL donde hoy está editingWarehouse. Al elegir 'volume_m3' ofrece precargar la capacidad desde capacity_m3.

6. Formularios: en ubicaciones (dispatch.tsx e inventory.tsx) agrega "Posiciones de pallet" (default 1) y "Área m²" opcional; en el formulario de ítems (inventory.tsx) agrega "Unidades por pallet" y "Volumen unitario m³" opcionales; en el selector de tipo de tarifa de Contratos incluye storage_m3 y storage_unit.

7. Dashboard 3PL: ocupación = get_storage_usage al día de hoy ÷ storage_capacity, solo si el método no es 'manual' y hay capacidad; si no, muestra "—" con el motivo.

8. Al terminar, entrégame el SQL para verificar los casos de prueba 1 al 12 del sprint con datos de ejemplo, con UUID como placeholders.

Documenta en .md/CHANGELOG.md y actualiza .md/ARQUITECTURA.md y .md/MODULOS.md.
```
