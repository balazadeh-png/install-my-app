# Sprint 8 — Activos Fijos

**Fase:** 2 — Módulos Ampliados (primer sprint de esta fase)
**Depende de:** Sprint 1 (multiempresa), Sprint 2 (partida doble), Sprint 4 (centros de costo/unidades)

## Objetivo

Módulo de Activos Fijos: alta, depreciación mensual automática, y baja/disposición, con posteo directo al mayor.

## Por qué

Este módulo no existe ni en EasyERP ni en tu Cacao Accounting original (lo confirmé revisando el modelo de datos fuente — no hay ninguna clase de Activo/Depreciación ahí). Es terreno nuevo, no una migración de algo que ya tenías construido.

## Alcance incluido

- `fixed_assets`: ficha del activo (valor de adquisición, moneda, vida útil, método de depreciación, cuentas contables asociadas).
- `fixed_asset_depreciation_entries`: una fila por corrida mensual, enlazada a su comprobante contable.
- Función `run_monthly_depreciation(entity_id, period)`: calcula y postea la depreciación del mes para todos los activos activos de la empresa.
- Función `dispose_fixed_asset(asset_id, disposal_date, disposal_value)`: da de baja un activo, revierte su depreciación acumulada y postea la utilidad o pérdida en la baja.
- Chile permite depreciación acelerada (normalmente 1/3 de la vida útil normal) para ciertos activos nuevos — se modela como una opción del método, pero **valida los requisitos vigentes con el SII antes de habilitarla para un cliente real**, no la des por buena solo por este documento.

## Fuera de alcance

- Revalorización técnica de activos (tasación), corrección monetaria histórica — quedan fuera del MVP.

## Cambios de esquema (sketch SQL)

```sql
CREATE TYPE public.depreciation_method AS ENUM ('linea_recta', 'acelerada');
CREATE TYPE public.asset_status AS ENUM ('active', 'fully_depreciated', 'disposed');

CREATE TABLE IF NOT EXISTS public.fixed_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) NOT NULL,
    cost_center_id uuid REFERENCES public.cost_centers(id),
    business_unit_id uuid REFERENCES public.business_units(id),
    asset_code text NOT NULL,
    name text NOT NULL,
    acquisition_date date NOT NULL,
    acquisition_value numeric(20,4) NOT NULL,
    currency_code text REFERENCES public.currencies(code) NOT NULL,
    residual_value numeric(20,4) DEFAULT 0,
    useful_life_months integer NOT NULL,
    depreciation_method public.depreciation_method DEFAULT 'linea_recta',
    accumulated_depreciation numeric(20,4) DEFAULT 0,
    asset_account_id uuid REFERENCES public.accounts(id) NOT NULL,
    accumulated_depreciation_account_id uuid REFERENCES public.accounts(id) NOT NULL,
    depreciation_expense_account_id uuid REFERENCES public.accounts(id) NOT NULL,
    status public.asset_status DEFAULT 'active',
    disposal_date date,
    disposal_value numeric(20,4),
    UNIQUE (entity_id, asset_code)
);

CREATE TABLE IF NOT EXISTS public.fixed_asset_depreciation_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fixed_asset_id uuid REFERENCES public.fixed_assets(id) NOT NULL,
    period_date date NOT NULL,
    amount numeric(20,4) NOT NULL,
    journal_entry_id uuid REFERENCES public.journal_entries(id),
    UNIQUE (fixed_asset_id, period_date)
);
```

`run_monthly_depreciation`: para cada activo `active` cuya depreciación acumulada sea menor a `acquisition_value - residual_value`, calcular la cuota mensual (línea recta: `(acquisition_value - residual_value) / useful_life_months`; acelerada: dividiendo por `useful_life_months / 3`), topada para no superar el valor depreciable restante, postear débito a `depreciation_expense_account_id` / crédito a `accumulated_depreciation_account_id`, y actualizar `accumulated_depreciation` en el activo (marcándolo `fully_depreciated` al llegar al tope).

`dispose_fixed_asset`: revierte `accumulated_depreciation_account_id`, da de baja `asset_account_id` por el valor de adquisición, y postea la diferencia contra una cuenta de utilidad/pérdida en venta de activos.

## Cambios de UI/backend esperados

- Pantalla "Activos Fijos": alta con todos los campos de la ficha, listado con estado y depreciación acumulada a la fecha.
- Botón "Ejecutar Depreciación del Mes" (por empresa y período) y botón "Dar de Baja" por activo.
- Reporte "Libro de Activos Fijos": detalle por activo, con su historial de depreciación.

## Criterios de aceptación

- [ ] Ejecutar la depreciación mensual postea automáticamente un comprobante balanceado por cada activo con depreciación pendiente.
- [ ] Ningún activo se deprecia más allá de `acquisition_value - residual_value`.
- [ ] Dar de baja un activo revierte correctamente su depreciación acumulada y postea la utilidad o pérdida resultante.
- [ ] El Libro de Activos Fijos permite ver el historial completo de depreciación de cualquier activo.

---

## Prompt listo para pegar en Lovable

```
Necesito construir el módulo de Activos Fijos desde cero (no existe ningún antecedente en el sistema actual).

1. Crea los enums `depreciation_method` ('linea_recta','acelerada') y `asset_status` ('active','fully_depreciated','disposed').

2. Crea `fixed_assets` (entity_id, cost_center_id, business_unit_id, asset_code, name, acquisition_date, acquisition_value, currency_code, residual_value, useful_life_months, depreciation_method, accumulated_depreciation, asset_account_id, accumulated_depreciation_account_id, depreciation_expense_account_id, status, disposal_date, disposal_value) — todas las cuentas contables son FK a `accounts`.

3. Crea `fixed_asset_depreciation_entries` (fixed_asset_id, period_date, amount, journal_entry_id), única por (fixed_asset_id, period_date) para que no se pueda correr la depreciación dos veces en el mismo período.

4. Crea la función `run_monthly_depreciation(_entity_id uuid, _period date)`: para cada activo activo de la empresa cuya depreciación acumulada sea menor al valor depreciable (adquisición menos valor residual), calcula la cuota mensual según el método (línea recta: valor depreciable dividido en la vida útil en meses; acelerada: dividiendo la vida útil entre 3), topada para no exceder el valor depreciable restante, postea un comprobante por cada activo (débito a la cuenta de gasto por depreciación, crédito a la cuenta de depreciación acumulada, con el centro de costo/unidad del activo), actualiza el acumulado del activo y lo marca 'fully_depreciated' si corresponde.

5. Crea la función `dispose_fixed_asset(_asset_id uuid, _disposal_date date, _disposal_value numeric)`: postea la reversión de la depreciación acumulada, da de baja el activo por su valor de adquisición, y postea la diferencia (utilidad o pérdida) contra una cuenta de resultado por venta de activos. Marca el activo como 'disposed'.

6. Crea una pantalla "Activos Fijos": alta de activo con todos los campos, listado con estado y depreciación acumulada, botón "Ejecutar Depreciación del Mes" (por empresa/período) y botón "Dar de Baja" por activo.

7. Crea un reporte "Libro de Activos Fijos" con el detalle y el historial de depreciación de cada activo.

Aplica RLS multiempresa a las tablas nuevas. Al terminar, documenta en `.md/CHANGELOG.md` y agrega el módulo a `.md/MODULOS.md` y `.md/ARQUITECTURA.md`.
```
