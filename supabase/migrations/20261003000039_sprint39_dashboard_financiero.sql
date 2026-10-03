-- ============================================================================
-- Sprint 39: Dashboard Financiero (Finanzas)
-- EasyERP — Indicadores IFRS, Estado de Resultados, Flujo de Caja y Drill-Down
-- ============================================================================

-- 1. Clasificación Corriente / No Corriente en Plan de Cuentas
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_current boolean;

CREATE INDEX IF NOT EXISTS ix_accounts_is_current ON public.accounts(is_current);

-- 2. Primitiva reutilizable: saldo de una cuenta a una fecha, con el signo correcto según su naturaleza
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

-- 3. Estado de Resultados Mensual (Últimos N meses)
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
  SELECT m, income, cogs, expense, (income - cogs - expense) AS net_income FROM base ORDER BY m;
$$;

-- 4. Flujo de Caja Neto Mensual sobre Cuentas Bancarias / Tesorería
CREATE OR REPLACE FUNCTION public.get_monthly_cash_flow(_entity_id uuid, _months_back integer DEFAULT 12)
RETURNS TABLE (month date, cash_in numeric, cash_out numeric, net_flow numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH months AS (
    SELECT (date_trunc('month', CURRENT_DATE) - (n || ' months')::interval)::date AS m
    FROM generate_series(0, _months_back - 1) AS n
  )
  SELECT months.m,
    COALESCE(SUM(l.debit), 0) AS cash_in,
    COALESCE(SUM(l.credit), 0) AS cash_out,
    COALESCE(SUM(l.debit - l.credit), 0) AS net_flow
  FROM months
  LEFT JOIN public.journal_entries je ON je.entity_id = _entity_id AND je.status = 'posted'
    AND date_trunc('month', je.posting_date)::date = months.m
  LEFT JOIN public.journal_entry_lines l ON l.journal_entry_id = je.id
    AND l.account_id IN (SELECT account_id FROM public.bank_accounts WHERE entity_id = _entity_id AND active = true)
  GROUP BY months.m ORDER BY months.m;
$$;

-- 5. Tercer piso del drill-down: qué cuentas componen una categoría en un período
CREATE OR REPLACE FUNCTION public.get_account_type_breakdown(_entity_id uuid, _account_type text, _period_start date, _period_end date)
RETURNS TABLE (account_id uuid, account_code text, account_name text, amount numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.code, a.name,
    CASE WHEN a.account_type = 'Income' THEN COALESCE(SUM(l.credit - l.debit), 0)
         ELSE COALESCE(SUM(l.debit - l.credit), 0) END AS amount
  FROM public.accounts a
  LEFT JOIN public.journal_entry_lines l ON l.account_id = a.id
  LEFT JOIN public.journal_entries je ON je.id = l.journal_entry_id AND je.status = 'posted'
    AND je.entity_id = _entity_id AND je.posting_date BETWEEN _period_start AND _period_end
  WHERE a.entity_id = _entity_id AND a.account_type = _account_type
  GROUP BY a.id, a.code, a.name
  HAVING COALESCE(SUM(l.debit), 0) <> 0 OR COALESCE(SUM(l.credit), 0) <> 0
  ORDER BY 4 DESC;
$$;

-- 6. Días de Inventario (DIO - Days Inventory Outstanding)
CREATE OR REPLACE FUNCTION public.get_days_inventory_outstanding(_entity_id uuid, _period_start date, _period_end date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_defaults record;
  v_inv_start numeric;
  v_inv_end numeric;
  v_avg numeric;
  v_cogs numeric;
  v_days int;
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
  RETURN jsonb_build_object(
    'average_inventory', v_avg,
    'cogs_period', v_cogs,
    'days_in_period', v_days,
    'dio', CASE WHEN v_cogs <> 0 THEN round((v_avg / v_cogs) * v_days, 1) ELSE NULL END
  );
END;
$$;

-- 7. Resumen Completo del Dashboard Financiero & Ratios IFRS
CREATE OR REPLACE FUNCTION public.get_financial_dashboard_summary(_entity_id uuid, _as_of_date date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_defaults record;
  v_ar numeric;
  v_ap numeric;
  v_inventory numeric;
  v_total_assets numeric;
  v_current_assets numeric;
  v_current_liabilities numeric;
  v_total_liabilities numeric;
  v_total_equity numeric;
  v_unreconciled int;
  v_unclassified int;
  v_ytd_income numeric;
  v_ytd_cogs numeric;
  v_ytd_expense numeric;
  v_net_income numeric;
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
    'as_of_date', _as_of_date,
    'accounts_receivable', v_ar,
    'accounts_payable', v_ap,
    'inventory_balance', v_inventory,
    'unreconciled_bank_lines', v_unreconciled,
    'unclassified_current_accounts', v_unclassified,
    'total_assets', v_total_assets,
    'total_liabilities', v_total_liabilities,
    'total_equity', v_total_equity,
    'current_assets', v_current_assets,
    'current_liabilities', v_current_liabilities,
    'net_income_ytd', v_net_income,
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

-- 8. Permisos de Ejecución
REVOKE ALL ON FUNCTION public.get_account_balance_as_of(uuid, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_account_balance_as_of(uuid, uuid, date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_monthly_income_statement(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_monthly_income_statement(uuid, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_monthly_cash_flow(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_monthly_cash_flow(uuid, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_account_type_breakdown(uuid, text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_account_type_breakdown(uuid, text, date, date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_days_inventory_outstanding(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_days_inventory_outstanding(uuid, date, date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_financial_dashboard_summary(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_financial_dashboard_summary(uuid, date) TO authenticated, service_role;

-- 9. Registrar módulo 'financial_dashboard' en public.modules y company_modules
INSERT INTO public.modules (name, label, group_name, group_sort_order, sort_order, active)
VALUES ('financial_dashboard', 'Dashboard Financiero', 'Finanzas', 1, 0, true)
ON CONFLICT (name) DO UPDATE 
SET label = EXCLUDED.label,
    group_name = EXCLUDED.group_name,
    group_sort_order = EXCLUDED.group_sort_order,
    sort_order = EXCLUDED.sort_order,
    active = true;

-- Habilitar por defecto para empresas existentes
INSERT INTO public.company_modules (entity_id, module_name, enabled)
SELECT id, 'financial_dashboard', true
FROM public.entities
ON CONFLICT (entity_id, module_name) DO NOTHING;
