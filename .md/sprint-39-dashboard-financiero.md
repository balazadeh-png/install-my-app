# Sprint 39 — Dashboard Financiero (Finanzas)

**Fase:** EasyERP core / Finanzas
**Depende de:** Sprint 2 (`journal_entries`/`journal_entry_lines`), Sprint 6 (`company_default_accounts`), Sprint 35 (`bank_accounts`, `bank_statement_lines`), componentes `AccountLedgerDrawer` y `SourceDocumentDialog` (ya existentes, se reutilizan)
**Bloquea a:** ninguno

## Objetivo

Un dashboard en Finanzas con los 7 indicadores pedidos, con drill-down real: cada número lleva al asiento que lo compone, no solo se ve bonito.

## Cómo reutiliza lo que ya existe (y qué agrega)

- **Clasificación de cuentas confirmada en el código**: `account_type` usa los valores `'Asset'`, `'Liability'`, `'Equity'`, `'Income'`, `'Expense'`, `'Cost of Goods Sold'` (así, en inglés — los uso tal cual en todo el SQL de abajo).
- **Drill-down de dos pisos ya existe**: `AccountLedgerDrawer` (abre el mayor de una cuenta en un rango de fechas) → dentro de ese drawer, cada línea abre `SourceDocumentDialog` (Sprint 34, el documento de origen). No se toca ninguno de los dos — este sprint agrega un **tercer piso, hacia arriba**: un panel de desglose por cuenta dentro de una categoría y un mes, que al hacer clic en una cuenta abre el `AccountLedgerDrawer` ya existente con esa cuenta y ese rango.
- **Cuentas bancarias**: `bank_accounts.account_id` ya identifica qué cuentas contables son caja/banco — lo uso para el Flujo de Caja en vez de inventar una regla nueva.
- **Conciliación**: `bank_statement_lines.reconciliation_status` ya existe (`'unreconciled'`, `'matched'`, `'reconciled'`, `'ignored'`). Cuento como pendiente `'unreconciled'` + `'matched'` (lo segundo es una sugerencia del sistema, no una conciliación confirmada por una persona) — es una interpretación razonable de "sin conciliar", dímelo si preferías solo `'unreconciled'`.

## Lo que falta para que los ratios de liquidez sean correctos, y lo agrego

El Current Ratio y el Quick Ratio necesitan saber qué cuentas de Activo y Pasivo son **corrientes** (vencen dentro de 12 meses) — ese dato no existe hoy en `accounts`. No lo invento: agrego `accounts.is_current` (nullable — `NULL` significa "sin clasificar todavía", no "no corriente"), con un control en el Plan de Cuentas para marcarlo, y el dashboard avisa cuántas cuentas de Activo/Pasivo siguen sin clasificar en vez de mostrar un ratio calculado con cuentas a medio marcar.

## Los 7 widgets, uno por uno

| # | Widget | Fuente | Tipo de vista |
|---|---|---|---|
| 1 | Estado de Resultado Mensual | `journal_entry_lines` por mes, tipos Income/COGS/Expense | Barras agrupadas + línea de utilidad neta, 12 meses |
| 2 | Flujo de Caja Neto Mensual | `journal_entry_lines` sobre cuentas de `bank_accounts` | Barras (entrada/salida) + línea neta, 12 meses |
| 3 | Cuentas por Pagar total | Saldo de `payable_account_id` a hoy | Card numérica + botón "Ver detalle" |
| 4 | Cuentas por Cobrar total | Saldo de `receivable_account_id` a hoy | Card numérica + botón "Ver detalle" |
| 5 | Días de Inventario | Inventario promedio (saldo GL de `inventory_account_id`) ÷ COGS del período | Card numérica, período configurable (default mes actual) |
| 6 | Ratios IFRS | Ver supuesto abajo | 4 grupos de cards: Liquidez, Endeudamiento, Rentabilidad, Eficiencia |
| 7 | Cuentas sin conciliar en banco | `bank_statement_lines.reconciliation_status` | Card numérica + botón "Ir a Conciliación" (`cash.tsx`) |

## Supuesto sobre "Ratios Financieros standard bajo IFRS" — confírmamelo

IFRS no prescribe una lista fija de ratios (exige las partidas que los hacen posibles, no los ratios en sí). Propongo el set más usado en los 4 grupos clásicos — dime si falta alguno o sobra:

- **Liquidez**: Razón Corriente (Activo Corriente / Pasivo Corriente), Prueba Ácida ((Activo Corriente − Inventario) / Pasivo Corriente)
- **Endeudamiento**: Deuda/Patrimonio (Pasivo Total / Patrimonio), Deuda/Activos (Pasivo Total / Activo Total)
- **Rentabilidad** (año a la fecha): ROE (Utilidad Neta / Patrimonio), ROA (Utilidad Neta / Activo Total), Margen Neto, Margen Bruto
- **Eficiencia**: Rotación de Activos (Ingresos / Activo Total, año a la fecha)

## Alcance incluido

- `accounts.is_current` + control de clasificación en el Plan de Cuentas (`accounting.tsx`, pestaña "chart").
- Funciones SQL: `get_account_balance_as_of` (primitiva reutilizable, saldo de una cuenta a una fecha), `get_monthly_income_statement`, `get_monthly_cash_flow`, `get_account_type_breakdown` (el desglose del tercer piso de drill-down), `get_days_inventory_outstanding`, `get_financial_dashboard_summary` (AP, AR, ratios, cuentas sin conciliar, cuentas sin clasificar, todo en una sola llamada).
- Página `dashboard-financiero.tsx`, con los 7 widgets, filtro de rango de meses, y el desglose por cuenta como paso intermedio antes de abrir `AccountLedgerDrawer`.
- Registra el módulo como `'financial_dashboard'` en `company_modules` (patrón del Sprint 33).

## Fuera de alcance

- Métricas no pedidas (EBITDA, capital de trabajo, etc.) — si las quieres, se agregan después a `get_financial_dashboard_summary`.
- Exportar el dashboard a PDF/Excel.
- Comparación contra presupuesto (no existe un módulo de presupuesto todavía).

## Cambios de esquema (sketch SQL)

```sql
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_current boolean;

-- Primitiva reutilizable: saldo de una cuenta a una fecha, con el signo correcto según su naturaleza
CREATE OR REPLACE FUNCTION public.get_account_balance_as_of(_entity_id uuid, _account_id uuid, _as_of_date date)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    CASE WHEN a.account_type IN ('Asset','Expense','Cost of Goods Sold')
         THEN SUM(l.debit - l.credit) ELSE SUM(l.credit - l.debit) END, 0)
  FROM public.accounts a
  LEFT JOIN public.journal_entry_lines l ON l.account_id = a.id
  LEFT JOIN public.journal_entries je ON je.id = l.journal_entry_id
    AND je.status = 'posted' AND je.entity_id = _entity_id AND je.posting_date <= _as_of_date
  WHERE a.id = _account_id AND a.entity_id = _entity_id
  GROUP BY a.account_type;
$$;

CREATE OR REPLACE FUNCTION public.get_monthly_income_statement(_entity_id uuid, _months_back integer DEFAULT 12)
RETURNS TABLE (month date, income numeric, cogs numeric, expense numeric, net_income numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH months AS (
    SELECT (date_trunc('month', CURRENT_DATE) - (n || ' months')::interval)::date AS m
    FROM generate_series(0, _months_back - 1) AS n
  ),
  base AS (
    SELECT months.m,
      COALESCE(SUM(l.credit - l.debit) FILTER (WHERE a.account_type = 'Income'), 0) AS income,
      COALESCE(SUM(l.debit - l.credit) FILTER (WHERE a.account_type = 'Cost of Goods Sold'), 0) AS cogs,
      COALESCE(SUM(l.debit - l.credit) FILTER (WHERE a.account_type = 'Expense'), 0) AS expense
    FROM months
    LEFT JOIN public.journal_entries je ON je.entity_id = _entity_id AND je.status = 'posted'
      AND date_trunc('month', je.posting_date)::date = months.m
    LEFT JOIN public.journal_entry_lines l ON l.journal_entry_id = je.id
    LEFT JOIN public.accounts a ON a.id = l.account_id AND a.account_type IN ('Income','Expense','Cost of Goods Sold')
    GROUP BY months.m
  )
  SELECT m, income, cogs, expense, (income - cogs - expense) FROM base ORDER BY m;
$$;

CREATE OR REPLACE FUNCTION public.get_monthly_cash_flow(_entity_id uuid, _months_back integer DEFAULT 12)
RETURNS TABLE (month date, cash_in numeric, cash_out numeric, net_flow numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH months AS (
    SELECT (date_trunc('month', CURRENT_DATE) - (n || ' months')::interval)::date AS m
    FROM generate_series(0, _months_back - 1) AS n
  )
  SELECT months.m, COALESCE(SUM(l.debit), 0), COALESCE(SUM(l.credit), 0), COALESCE(SUM(l.debit - l.credit), 0)
  FROM months
  LEFT JOIN public.journal_entries je ON je.entity_id = _entity_id AND je.status = 'posted'
    AND date_trunc('month', je.posting_date)::date = months.m
  LEFT JOIN public.journal_entry_lines l ON l.journal_entry_id = je.id
    AND l.account_id IN (SELECT account_id FROM public.bank_accounts WHERE entity_id = _entity_id AND active = true)
  GROUP BY months.m ORDER BY months.m;
$$;

-- Tercer piso del drill-down: qué cuentas componen una categoría en un período
CREATE OR REPLACE FUNCTION public.get_account_type_breakdown(_entity_id uuid, _account_type text, _period_start date, _period_end date)
RETURNS TABLE (account_id uuid, account_code text, account_name text, amount numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.code, a.name,
    CASE WHEN a.account_type = 'Income' THEN COALESCE(SUM(l.credit - l.debit), 0)
         ELSE COALESCE(SUM(l.debit - l.credit), 0) END
  FROM public.accounts a
  LEFT JOIN public.journal_entry_lines l ON l.account_id = a.id
  LEFT JOIN public.journal_entries je ON je.id = l.journal_entry_id AND je.status = 'posted'
    AND je.entity_id = _entity_id AND je.posting_date BETWEEN _period_start AND _period_end
  WHERE a.entity_id = _entity_id AND a.account_type = _account_type
  GROUP BY a.id, a.code, a.name
  HAVING COALESCE(SUM(l.debit), 0) <> 0 OR COALESCE(SUM(l.credit), 0) <> 0
  ORDER BY 4 DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_days_inventory_outstanding(_entity_id uuid, _period_start date, _period_end date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_defaults record; v_inv_start numeric; v_inv_end numeric; v_avg numeric; v_cogs numeric; v_days int;
BEGIN
  SELECT * INTO v_defaults FROM public.company_default_accounts WHERE entity_id = _entity_id;
  IF v_defaults.inventory_account_id IS NULL OR v_defaults.cogs_account_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Configura las cuentas de Inventario y Costo de Ventas en Configuración.');
  END IF;

  v_inv_start := public.get_account_balance_as_of(_entity_id, v_defaults.inventory_account_id, _period_start - 1);
  v_inv_end := public.get_account_balance_as_of(_entity_id, v_defaults.inventory_account_id, _period_end);
  v_avg := (v_inv_start + v_inv_end) / 2;

  SELECT COALESCE(SUM(l.debit - l.credit), 0) INTO v_cogs
  FROM public.journal_entry_lines l JOIN public.journal_entries je ON je.id = l.journal_entry_id
  WHERE je.entity_id = _entity_id AND je.status = 'posted' AND l.account_id = v_defaults.cogs_account_id
    AND je.posting_date BETWEEN _period_start AND _period_end;

  v_days := (_period_end - _period_start) + 1;
  RETURN jsonb_build_object('average_inventory', v_avg, 'cogs_period', v_cogs, 'days_in_period', v_days,
    'dio', CASE WHEN v_cogs <> 0 THEN round((v_avg / v_cogs) * v_days, 1) ELSE NULL END);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_financial_dashboard_summary(_entity_id uuid, _as_of_date date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_defaults record; v_ar numeric; v_ap numeric; v_inventory numeric;
  v_total_assets numeric; v_current_assets numeric; v_current_liabilities numeric;
  v_total_liabilities numeric; v_total_equity numeric; v_unreconciled int; v_unclassified int;
  v_ytd_income numeric; v_ytd_cogs numeric; v_ytd_expense numeric; v_net_income numeric;
BEGIN
  SELECT * INTO v_defaults FROM public.company_default_accounts WHERE entity_id = _entity_id;
  v_ar := CASE WHEN v_defaults.receivable_account_id IS NOT NULL
               THEN public.get_account_balance_as_of(_entity_id, v_defaults.receivable_account_id, _as_of_date) END;
  v_ap := CASE WHEN v_defaults.payable_account_id IS NOT NULL
               THEN public.get_account_balance_as_of(_entity_id, v_defaults.payable_account_id, _as_of_date) END;
  v_inventory := CASE WHEN v_defaults.inventory_account_id IS NOT NULL
               THEN public.get_account_balance_as_of(_entity_id, v_defaults.inventory_account_id, _as_of_date) END;

  SELECT COALESCE(SUM(l.debit - l.credit), 0) INTO v_total_assets FROM public.accounts a
    LEFT JOIN public.journal_entry_lines l ON l.account_id = a.id
    LEFT JOIN public.journal_entries je ON je.id = l.journal_entry_id AND je.status='posted' AND je.entity_id = _entity_id AND je.posting_date <= _as_of_date
    WHERE a.entity_id = _entity_id AND a.account_type = 'Asset';

  SELECT COALESCE(SUM(l.credit - l.debit), 0) INTO v_total_liabilities FROM public.accounts a
    LEFT JOIN public.journal_entry_lines l ON l.account_id = a.id
    LEFT JOIN public.journal_entries je ON je.id = l.journal_entry_id AND je.status='posted' AND je.entity_id = _entity_id AND je.posting_date <= _as_of_date
    WHERE a.entity_id = _entity_id AND a.account_type = 'Liability';

  SELECT COALESCE(SUM(l.credit - l.debit), 0) INTO v_total_equity FROM public.accounts a
    LEFT JOIN public.journal_entry_lines l ON l.account_id = a.id
    LEFT JOIN public.journal_entries je ON je.id = l.journal_entry_id AND je.status='posted' AND je.entity_id = _entity_id AND je.posting_date <= _as_of_date
    WHERE a.entity_id = _entity_id AND a.account_type = 'Equity';

  SELECT COALESCE(SUM(l.debit - l.credit), 0) INTO v_current_assets FROM public.accounts a
    LEFT JOIN public.journal_entry_lines l ON l.account_id = a.id
    LEFT JOIN public.journal_entries je ON je.id = l.journal_entry_id AND je.status='posted' AND je.entity_id = _entity_id AND je.posting_date <= _as_of_date
    WHERE a.entity_id = _entity_id AND a.account_type = 'Asset' AND a.is_current = true;

  SELECT COALESCE(SUM(l.credit - l.debit), 0) INTO v_current_liabilities FROM public.accounts a
    LEFT JOIN public.journal_entry_lines l ON l.account_id = a.id
    LEFT JOIN public.journal_entries je ON je.id = l.journal_entry_id AND je.status='posted' AND je.entity_id = _entity_id AND je.posting_date <= _as_of_date
    WHERE a.entity_id = _entity_id AND a.account_type = 'Liability' AND a.is_current = true;

  SELECT COUNT(*) INTO v_unclassified FROM public.accounts
    WHERE entity_id = _entity_id AND account_type IN ('Asset','Liability') AND is_current IS NULL AND active = true;

  SELECT COUNT(*) INTO v_unreconciled FROM public.bank_statement_lines
    WHERE entity_id = _entity_id AND reconciliation_status IN ('unreconciled','matched');

  SELECT
    COALESCE(SUM(l.credit - l.debit) FILTER (WHERE a.account_type = 'Income'), 0),
    COALESCE(SUM(l.debit - l.credit) FILTER (WHERE a.account_type = 'Cost of Goods Sold'), 0),
    COALESCE(SUM(l.debit - l.credit) FILTER (WHERE a.account_type = 'Expense'), 0)
  INTO v_ytd_income, v_ytd_cogs, v_ytd_expense
  FROM public.journal_entry_lines l JOIN public.journal_entries je ON je.id = l.journal_entry_id
  JOIN public.accounts a ON a.id = l.account_id
  WHERE je.entity_id = _entity_id AND je.status = 'posted' AND a.account_type IN ('Income','Cost of Goods Sold','Expense')
    AND je.posting_date BETWEEN date_trunc('year', _as_of_date)::date AND _as_of_date;

  v_net_income := v_ytd_income - v_ytd_cogs - v_ytd_expense;

  RETURN jsonb_build_object(
    'as_of_date', _as_of_date, 'accounts_receivable', v_ar, 'accounts_payable', v_ap,
    'unreconciled_bank_lines', v_unreconciled, 'unclassified_current_accounts', v_unclassified,
    'ratios', jsonb_build_object(
      'current_ratio', CASE WHEN v_current_liabilities <> 0 THEN round(v_current_assets / v_current_liabilities, 2) END,
      'quick_ratio', CASE WHEN v_current_liabilities <> 0 THEN round((v_current_assets - COALESCE(v_inventory,0)) / v_current_liabilities, 2) END,
      'debt_to_equity', CASE WHEN v_total_equity <> 0 THEN round(v_total_liabilities / v_total_equity, 2) END,
      'debt_to_assets', CASE WHEN v_total_assets <> 0 THEN round(v_total_liabilities / v_total_assets, 2) END,
      'roe_ytd', CASE WHEN v_total_equity <> 0 THEN round(v_net_income / v_total_equity, 4) END,
      'roa_ytd', CASE WHEN v_total_assets <> 0 THEN round(v_net_income / v_total_assets, 4) END,
      'net_margin_ytd', CASE WHEN v_ytd_income <> 0 THEN round(v_net_income / v_ytd_income, 4) END,
      'gross_margin_ytd', CASE WHEN v_ytd_income <> 0 THEN round((v_ytd_income - v_ytd_cogs) / v_ytd_income, 4) END,
      'asset_turnover_ytd', CASE WHEN v_total_assets <> 0 THEN round(v_ytd_income / v_total_assets, 4) END
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_account_balance_as_of(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_income_statement(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_cash_flow(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_account_type_breakdown(uuid, text, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_days_inventory_outstanding(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financial_dashboard_summary(uuid, date) TO authenticated;
```

Nota de seguridad: estas funciones son `SECURITY DEFINER` y filtran siempre por `_entity_id` recibido como parámetro, pero **no validan por sí solas** que quien llama tenga acceso a esa empresa — igual que el resto de funciones RPC del proyecto, confían en que el frontend pasa el `activeEntityId` correcto. Antes de usarlas desde cualquier lugar nuevo (no solo este dashboard), confirma que siguen el mismo supuesto que ya aceptaste para las demás.

## Criterios de aceptación

- [ ] Clasificar una cuenta de Activo como corriente y una de Pasivo como corriente hace que el Current Ratio deje de ser `NULL` y muestre un número.
- [ ] Sin ninguna cuenta clasificada, el dashboard muestra "Clasifica tus cuentas corrientes para ver este ratio" en vez de un número o un `NULL` crudo.
- [ ] El gráfico de Estado de Resultado Mensual muestra 12 meses; clic en la barra de Ingresos de un mes abre el desglose por cuenta de ese mes; clic en una cuenta del desglose abre `AccountLedgerDrawer` con esa cuenta y ese mes.
- [ ] El Flujo de Caja Neto Mensual solo considera las cuentas marcadas en `bank_accounts` — verificar con una cuenta de caja que NO esté en `bank_accounts`, su movimiento no debe aparecer acá.
- [ ] Cuentas por Pagar y por Cobrar muestran el saldo de las cuentas configuradas en Configuración → Cuentas Predeterminadas, y el botón "Ver detalle" abre `AccountLedgerDrawer` directo en esa cuenta.
- [ ] Días de Inventario muestra el mensaje de configuración si falta la cuenta de Inventario o de Costo de Ventas, en vez de un número inventado.
- [ ] El contador de cuentas sin conciliar coincide con `SELECT COUNT(*) FROM bank_statement_lines WHERE reconciliation_status IN ('unreconciled','matched')` para la empresa activa, y el botón lleva a la pestaña de conciliación en `cash.tsx`.

---

## Prompt listo para pegar en Lovable

```
Voy a crear el Dashboard Financiero en Finanzas con 7 indicadores y drill-down, reutilizando AccountLedgerDrawer y SourceDocumentDialog que ya existen — no los reescribas.

1. Agrega is_current boolean (nullable, sin default) a accounts.

2. Crea las funciones SQL get_account_balance_as_of, get_monthly_income_statement, get_monthly_cash_flow, get_account_type_breakdown, get_days_inventory_outstanding y get_financial_dashboard_summary exactamente como están en el archivo sprint-39-dashboard-financiero.md (carpeta .md/). Todas SECURITY DEFINER, STABLE, search_path = public, GRANT EXECUTE a authenticated.

3. En accounting.tsx, pestaña "chart" (Plan de Cuentas): para cuentas con account_type 'Asset' o 'Liability', agrega un selector "Clasificación: Corriente / No corriente / Sin clasificar" que escribe is_current (true/false/null). Para los demás tipos de cuenta, no muestres este campo.

4. Crea la ruta dashboard-financiero.tsx (mismo patrón de layout que dashboard-3pl.tsx) con:
   - Un selector de rango (últimos 12 meses por defecto, pero el usuario puede acortar).
   - Estado de Resultado Mensual: gráfico de barras agrupadas (Ingresos, Costo de Ventas, Gastos) con recharts, más una línea de Utilidad Neta superpuesta, usando get_monthly_income_statement. Clic en una barra de un mes abre un diálogo de desglose (nuevo componente AccountTypeBreakdownDialog) llamando a get_account_type_breakdown con ese tipo de cuenta y ese mes como rango; cada fila de ese diálogo, al hacer clic, cierra el diálogo y abre AccountLedgerDrawer con esa cuenta y ese mismo rango de fechas.
   - Flujo de Caja Neto Mensual: mismo patrón de gráfico (barras entrada/salida + línea neta) usando get_monthly_cash_flow. Clic en una barra abre AccountLedgerDrawer directo (puedes usar cualquier cuenta de bank_accounts como referencia, o si hay varias, que el usuario elija cuál ver primero).
   - Cuentas por Pagar y por Cobrar: dos cards numéricas grandes desde get_financial_dashboard_summary, cada una con botón "Ver detalle" que abre AccountLedgerDrawer directo en payable_account_id / receivable_account_id (tráelos de company_default_accounts).
   - Días de Inventario: card numérica desde get_days_inventory_outstanding para el rango seleccionado; si la función devuelve error, muestra ese mensaje en vez de un número.
   - Ratios IFRS: 4 secciones de cards pequeñas (Liquidez, Endeudamiento, Rentabilidad, Eficiencia) leyendo el objeto ratios de get_financial_dashboard_summary; cualquier ratio que venga null se muestra como "—" con un tooltip explicando qué falta (ej. clasificar cuentas corrientes). Si unclassified_current_accounts > 0, muestra un aviso arriba de la sección de Liquidez con el conteo y un enlace a Plan de Cuentas.
   - Cuentas sin Conciliar: card numérica con unreconciled_bank_lines, y un botón "Ir a Conciliación" que navega a cash.tsx.

5. Registra el módulo en company_modules con module_name='financial_dashboard' (patrón del Sprint 33).

Documenta en .md/CHANGELOG.md y actualiza .md/ARQUITECTURA.md y .md/MODULOS.md.
```
