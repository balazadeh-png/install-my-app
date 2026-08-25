# Sprint 7 — Cierre de Período y Revalorización Cambiaria

**Fase:** 1 — Fundación (último sprint de la fase)
**Depende de:** Sprint 2 (partida doble), Sprint 3 (multimoneda), Sprint 6 (CxC/CxP reales)

## Objetivo

Cerrar la Fase 1 con dos piezas que faltan para que la contabilidad multimoneda sea completa: un proceso de **revalorización cambiaria** que ajuste los saldos en moneda extranjera al tipo de cambio de cierre, y un **flujo de cierre de período** que impida seguir posteando en meses ya cerrados.

## Por qué (brecha que resuelve)

Después de los Sprints 3 y 6, una cuenta en USD (banco, CxC de un cliente extranjero) queda registrada al tipo de cambio del día en que se originó cada movimiento. Pero el tipo de cambio se mueve, y al cierre de cada mes ese saldo debe reflejarse al tipo de cambio vigente ese día — la diferencia es una ganancia o pérdida **no realizada** que hoy no se calcula ni se postea en ningún lado. Sin esto, tu Balance General en una empresa con cuentas en USD queda desactualizado apenas el dólar se mueve.

## Alcance incluido

- `exchange_revaluations` / `exchange_revaluation_items`: registro de cada corrida de revalorización y el detalle por cuenta.
- Dos cuentas nuevas en `company_default_accounts`: `unrealized_exchange_gain_account_id` / `unrealized_exchange_loss_account_id` (distintas de las realizadas que ya se agregaron en el Sprint 6).
- Función `run_exchange_revaluation(entity_id, fecha)`: recorre las cuentas en moneda extranjera, calcula la diferencia contra la tasa de cierre, y postea el ajuste.
- `accounting_periods` gana estado (`open`/`closed`) y un checklist simple de cierre.
- El posteo (`post_journal_entry`, Sprint 2) se extiende para rechazar comprobantes con fecha dentro de un período ya cerrado.

## Fuera de alcance

- Consolidación de estados financieros entre empresas con distinta moneda funcional (es un problema real y más complejo — cuenta de conversión de moneda extranjera completa). Queda marcado en el RoadMap como candidato a una fase posterior, evaluar si de verdad la necesitas antes de construirla.

## Cambios de esquema (sketch SQL)

```sql
ALTER TABLE public.company_default_accounts
  ADD COLUMN IF NOT EXISTS unrealized_exchange_gain_account_id uuid REFERENCES public.accounts(id),
  ADD COLUMN IF NOT EXISTS unrealized_exchange_loss_account_id uuid REFERENCES public.accounts(id);

CREATE TYPE public.period_status AS ENUM ('open', 'closed');
ALTER TABLE public.accounting_periods ADD COLUMN IF NOT EXISTS status public.period_status DEFAULT 'open';

CREATE TABLE IF NOT EXISTS public.exchange_revaluations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) NOT NULL,
    revaluation_date date NOT NULL,
    journal_entry_id uuid REFERENCES public.journal_entries(id),
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.exchange_revaluation_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    exchange_revaluation_id uuid REFERENCES public.exchange_revaluations(id) ON DELETE CASCADE NOT NULL,
    account_id uuid REFERENCES public.accounts(id) NOT NULL,
    balance_account_currency numeric(20,4) NOT NULL,
    old_rate numeric(20,9) NOT NULL,
    new_rate numeric(20,9) NOT NULL,
    adjustment_amount numeric(20,4) NOT NULL -- en moneda funcional
);

CREATE TABLE IF NOT EXISTS public.period_close_checks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    accounting_period_id uuid REFERENCES public.accounting_periods(id) NOT NULL,
    check_name text NOT NULL,
    passed boolean DEFAULT false,
    checked_at timestamptz,
    checked_by uuid REFERENCES auth.users(id)
);
```

**Lógica de `run_exchange_revaluation(entity_id, fecha)`:**
1. Para cada cuenta con `currency_code` distinto a la moneda base de la empresa: sumar sus líneas posteadas para obtener el saldo en moneda de cuenta (`debit_account_currency - credit_account_currency`) y el saldo actualmente registrado en moneda funcional.
2. Convertir el saldo en moneda de cuenta a la tasa de cierre (`get_exchange_rate`, Sprint 3) y comparar contra lo que está registrado.
3. Si hay diferencia, postear un ajuste: la cuenta original se ajusta a su nuevo valor, y la contrapartida va a `unrealized_exchange_gain_account_id` o `unrealized_exchange_loss_account_id` según el signo.
4. Registrar el detalle en `exchange_revaluation_items` para trazabilidad.

> **Nota importante de implementación:** la línea de ajuste que crea este proceso postea directamente en moneda funcional (el ajuste ya es la diferencia, no una transacción nueva en moneda de cuenta). Eso puede chocar con el trigger `resolve_line_currency_amounts` del Sprint 3, que intentaría reconvertir el monto. La forma más simple de evitarlo: agrega una columna `journal_entry_lines.skip_currency_resolution boolean DEFAULT false`, que la revalorización marque en `true`, y ajusta el trigger del Sprint 3 para que no actúe cuando esta bandera esté activa (`WHEN (NEW.skip_currency_resolution IS NOT TRUE)` en la condición del trigger).

## Cambios de UI/backend esperados

- Pantalla "Cierre de Período" (puede vivir en `setup.tsx` o en `reports.tsx`): muestra el período seleccionado, un checklist (comprobantes en borrador pendientes, revalorización ejecutada o no) y dos botones: "Ejecutar Revalorización Cambiaria" y "Cerrar Período" (este último solo habilitado si el checklist está completo).
- El posteo de cualquier comprobante debe rechazar fechas dentro de un período con `status = 'closed'`, con un mensaje claro indicando qué período está cerrado.

## Criterios de aceptación

- [ ] Ejecutar la revalorización cambiaria de una empresa con una cuenta bancaria en USD postea correctamente la ganancia o pérdida no realizada según cómo se movió el tipo de cambio desde la última revalorización.
- [ ] Un período cerrado rechaza cualquier intento de postear un comprobante con fecha dentro de ese período, con un mensaje claro.
- [ ] El checklist de cierre muestra con precisión qué falta (comprobantes en borrador, revalorización pendiente) antes de permitir cerrar.
- [ ] `exchange_revaluation_items` permite auditar, cuenta por cuenta, de dónde salió cada ajuste.

---

## Prompt listo para pegar en Lovable

```
Necesito cerrar la Fase 1 del ERP con el proceso de revalorización cambiaria de cierre y un flujo básico de cierre de período.

1. Agrega `unrealized_exchange_gain_account_id` y `unrealized_exchange_loss_account_id` a `company_default_accounts` (FK a accounts), distintas de las cuentas de diferencia de cambio realizada que ya existen.

2. Crea el enum `period_status` ('open','closed') y agrega la columna `status` (default 'open') a `accounting_periods`.

3. Crea `exchange_revaluations` (entity_id, revaluation_date, journal_entry_id, created_by, created_at) y `exchange_revaluation_items` (exchange_revaluation_id, account_id, balance_account_currency, old_rate, new_rate, adjustment_amount).

4. Agrega la columna `skip_currency_resolution` (boolean, default false) a `journal_entry_lines`, y modifica el trigger `resolve_line_currency_amounts` (creado en el Sprint 3) para que no se ejecute cuando esta bandera esté en true — así los ajustes de revalorización, que ya vienen en moneda funcional, no se vuelven a convertir.

5. Crea la función `run_exchange_revaluation(_entity_id uuid, _revaluation_date date)`: recorre todas las cuentas de la empresa con `currency_code` distinto a la moneda base que tengan movimientos posteados, calcula el saldo en moneda de cuenta y su saldo actualmente registrado en moneda funcional, lo compara contra el valor que tendría a la tasa de cambio de `_revaluation_date` (usando `get_exchange_rate`), y si hay diferencia crea un comprobante (marcando sus líneas con `skip_currency_resolution = true`) que ajusta la cuenta original contra `unrealized_exchange_gain_account_id` o `unrealized_exchange_loss_account_id` según corresponda, guardando el detalle en `exchange_revaluation_items`.

6. Crea `period_close_checks` (accounting_period_id, check_name, passed, checked_at, checked_by) como un checklist simple.

7. Extiende la función `post_journal_entry` (Sprint 2) para que rechace, con un mensaje claro, cualquier intento de postear un comprobante cuya `posting_date` caiga dentro de un `accounting_period` con `status = 'closed'`.

8. Crea una pantalla "Cierre de Período": muestra el período activo, el checklist de cierre, un botón "Ejecutar Revalorización Cambiaria" (llama a `run_exchange_revaluation`) y un botón "Cerrar Período" que solo se habilita cuando el checklist está completo (sin comprobantes en borrador pendientes y con la revalorización ya ejecutada).

Al terminar, documenta en `.md/CHANGELOG.md` y actualiza `.md/ARQUITECTURA.md` con el nuevo flujo de cierre. Con esto se completa la Fase 1 del RoadMap — antes de seguir a la Fase 2, vale la pena hacer una pasada de pruebas de extremo a extremo: crear una empresa, cargar cuentas con moneda propia, facturar en moneda extranjera, cerrar un período y revisar que los reportes cuadren.
```
