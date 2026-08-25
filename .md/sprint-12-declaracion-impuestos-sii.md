# Sprint 12 — Declaración de Impuestos SII (F29 / F22)

**Fase:** 2 — Módulos Ampliados
**Depende de:** Sprint 6 (facturación — el IVA débito/crédito sale de ahí), Sprint 7 (cierre de período)

## Objetivo

Motor de cálculo de IVA y PPM para poblar el Formulario 29 (mensual) y un borrador de apoyo para el Formulario 22 (anual, Renta) — **calcular y dejar los datos listos para revisión humana**, no presentar directamente ante el SII.

## Por qué

Necesitas esto para cerrar el ciclo tributario mensual/anual de cada empresa que administres en el sistema. Es deliberadamente un módulo de **cálculo y preparación**, no de presentación automática: el trámite real ante el SII (timbrado, envío, certificado digital) tiene sus propios requisitos que quedan fuera del alcance de EasyERP en este MVP — la presentación final la haces tú o tu equipo, con los números que este módulo ya te deja calculados y trazables.

## ⚠️ Nota sobre precisión regulatoria

El remanente de crédito fiscal, IVA postergado, cambio de sujeto y otras particularidades dependen del régimen tributario de cada empresa. Este sprint construye el cálculo **general**; valida con tu propio criterio contable las particularidades de cada cliente antes de dar por bueno un cálculo automático.

## Alcance incluido

- `tax_calculation_runs`: una corrida de cálculo por empresa/período/formulario, con los valores calculados en un campo estructurado y un estado (`draft` → `reviewed` → `filed`) que exige revisión humana antes de considerarse presentado.
- `tax_adjustments`: ajustes tributarios (agregados/deducciones) para el cálculo de renta líquida imponible del F22, trazables y editables.
- `entities.ppm_rate`: tasa de PPM configurable por empresa (depende de la actividad económica).
- Función `calculate_f29(entity_id, period)`: suma el IVA débito y crédito fiscal del período desde las cuentas configuradas en `company_default_accounts`, aplica el remanente del mes anterior si corresponde, y calcula el PPM sobre los ingresos del período.

## Fuera de alcance

- Envío/presentación automática al SII (requiere certificado digital y las validaciones propias del sitio del SII — decisión de negocio a evaluar aparte, igual que la de DTE).
- Regímenes tributarios especiales (renta presunta, PYME 14 D, etc.) — el cálculo base cubre el caso general; casos especiales se agregan como extensión configurable después.

## Cambios de esquema (sketch SQL)

```sql
CREATE TYPE public.tax_form_type AS ENUM ('f29', 'f22');
CREATE TYPE public.tax_calculation_status AS ENUM ('draft', 'reviewed', 'filed');

CREATE TABLE IF NOT EXISTS public.tax_calculation_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) NOT NULL,
    form_type public.tax_form_type NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    calculated_values jsonb NOT NULL DEFAULT '{}',
    status public.tax_calculation_status DEFAULT 'draft',
    reviewed_by uuid REFERENCES auth.users(id),
    filed_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.tax_adjustments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) NOT NULL,
    tax_calculation_run_id uuid REFERENCES public.tax_calculation_runs(id),
    adjustment_type text NOT NULL, -- 'agregado' | 'deduccion'
    description text NOT NULL,
    amount numeric(20,4) NOT NULL
);

ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS ppm_rate numeric(6,3);
```

**Lógica de `calculate_f29(entity_id, period)`:** suma los movimientos del período en `output_tax_account_id` (débito fiscal) y `input_tax_account_id` (crédito fiscal) desde `company_default_accounts`; si el crédito fiscal supera al débito, guarda el remanente para el período siguiente (leyendo el `calculated_values` del `tax_calculation_run` anterior); calcula el PPM como `ppm_rate * ingresos del período`; guarda todo en `calculated_values` como un objeto estructurado (débito fiscal, crédito fiscal, remanente aplicado, PPM, total a pagar).

## Cambios de UI/backend esperados

- Pantalla "Declaración de Impuestos": selector de empresa/período/formulario, botón "Calcular", vista del detalle (de dónde sale cada cifra, con link a las cuentas/comprobantes que la componen), y un flujo de estados `draft` → `reviewed` (requiere que un usuario con rol accountant o admin lo marque explícitamente) → `filed` (registra la fecha de presentación real, hecha fuera del sistema).
- Pantalla de ajustes tributarios para el F22 (alta de agregados/deducciones con su descripción y monto).

## Criterios de aceptación

- [ ] El cálculo de F29 de un período suma correctamente el IVA débito y crédito desde las cuentas configuradas, y aplica el remanente del mes anterior cuando corresponde.
- [ ] El borrador de F22 muestra la renta líquida imponible con los ajustes aplicados, cada uno trazable a su descripción y monto.
- [ ] Ningún cálculo pasa a `filed` sin haber pasado explícitamente por `reviewed` por un usuario con rol adecuado.

---

## Prompt listo para pegar en Lovable

```
Necesito un motor de cálculo de impuestos para apoyar el F29 mensual y el F22 anual — que calcule y deje los datos listos para revisión humana, sin presentar nada directamente al SII.

1. Crea los enums `tax_form_type` ('f29','f22') y `tax_calculation_status` ('draft','reviewed','filed').

2. Crea `tax_calculation_runs` (entity_id, form_type, period_start, period_end, calculated_values jsonb, status, reviewed_by, filed_at, created_at).

3. Crea `tax_adjustments` (entity_id, tax_calculation_run_id, adjustment_type 'agregado'/'deduccion', description, amount) para los ajustes tributarios del F22.

4. Agrega la columna `ppm_rate` (numeric, nullable) a `entities`.

5. Crea la función `calculate_f29(_entity_id uuid, _period_start date, _period_end date)`: suma los movimientos del período en la cuenta `output_tax_account_id` de `company_default_accounts` de esa empresa (débito fiscal) y en `input_tax_account_id` (crédito fiscal); si hubo un cálculo del período anterior con remanente de crédito fiscal, lo suma al crédito fiscal de este período; calcula el PPM multiplicando `ppm_rate` por los ingresos del período (suma de `sales_income_account_id`); guarda todos estos valores en `calculated_values` como un objeto estructurado, y crea el registro con status 'draft'.

6. Crea la función equivalente para armar el borrador de F22: suma las cuentas de resultado del ejercicio (ingresos menos gastos, usando la estructura del plan de cuentas) y aplica los `tax_adjustments` registrados para llegar a la renta líquida imponible.

7. Crea una pantalla "Declaración de Impuestos": selector de empresa/período/formulario, botón "Calcular", vista de detalle mostrando de dónde sale cada cifra (con acceso a los comprobantes que la componen), y controles para pasar el estado de 'draft' a 'reviewed' (solo accountant/admin) y de ahí a 'filed' (registrando la fecha real de presentación, que ocurre fuera del sistema).

8. Crea una pantalla de ajustes tributarios (alta de agregados/deducciones con descripción y monto) vinculada al cálculo de F22.

Aplica RLS multiempresa. Al terminar, documenta en `.md/CHANGELOG.md` y agrega el módulo a `.md/MODULOS.md` y `.md/ARQUITECTURA.md`, dejando clara la nota de que las particularidades de régimen tributario de cada cliente deben validarse antes de usar el cálculo con datos reales.
```
