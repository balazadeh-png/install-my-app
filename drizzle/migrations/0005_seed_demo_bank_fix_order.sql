CREATE OR REPLACE FUNCTION public.seed_demo_bank()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e uuid; v_acc uuid; v_ba uuid; v_lines jsonb := '[]'::jsonb; v_bal numeric := 48500000; v_init numeric;
  r record; i int := 0; d date; v_start date := date_trunc('month', current_date)::date; v_res jsonb; v_stmt uuid;
  v_amt numeric;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Solo administradores pueden cargar datos de ejemplo.'; END IF;
  SELECT id INTO e FROM entities WHERE code = 'DEMO-3PL';
  IF e IS NULL THEN RAISE EXCEPTION 'Primero carga la empresa de ejemplo.'; END IF;
  IF EXISTS (SELECT 1 FROM bank_statements WHERE entity_id = e) THEN RAISE EXCEPTION 'La cartola de ejemplo ya está cargada.'; END IF;

  SELECT id INTO v_acc FROM accounts WHERE entity_id = e AND code = '1101';
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE entity_id = e AND name ILIKE '%comision%') THEN
    INSERT INTO accounts (entity_id, code, name, account_type, is_group)
    SELECT e, '5299', 'Comisiones y Gastos Bancarios', 'Expense', false
    WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE entity_id = e AND code = '5299');
  END IF;

  SELECT id INTO v_ba FROM bank_accounts WHERE entity_id = e LIMIT 1;
  IF v_ba IS NULL THEN
    INSERT INTO bank_accounts (entity_id, account_id, bank_name, account_number, account_type, currency_code, initial_balance, current_balance, api_provider)
    VALUES (e, v_acc, 'Banco Estado', '000-12345-67', 'corriente', 'CLP', v_bal, v_bal, 'none') RETURNING id INTO v_ba;
  END IF;
  v_init := v_bal;

  FOR r IN SELECT * FROM sales_invoice_balances WHERE entity_id = e AND balance_due > 0 ORDER BY invoice_number LIMIT 8 LOOP
    i := i + 1; d := v_start + (i % 25); v_bal := v_bal + r.balance_due;
    v_lines := v_lines || jsonb_build_object('movement_date', d, 'description', 'TRANSF. RECIBIDA ' || COALESCE(r.party_tax_id,'') || ' ' || upper(r.party_name) || ' PAGO FAC ' || r.invoice_number,
      'reference_number', 'TEF-' || (400000 + i), 'debit_amount', 0, 'credit_amount', r.balance_due, 'balance', v_bal);
  END LOOP;
  FOR r IN SELECT * FROM sales_invoice_balances WHERE entity_id = e AND balance_due > 0 ORDER BY invoice_number OFFSET 8 LIMIT 4 LOOP
    i := i + 1; d := v_start + (i % 25); v_bal := v_bal + r.balance_due;
    v_lines := v_lines || jsonb_build_object('movement_date', d, 'description', 'DEPOSITO ' || upper(r.party_name),
      'reference_number', 'DEP-' || (500000 + i), 'debit_amount', 0, 'credit_amount', r.balance_due, 'balance', v_bal);
  END LOOP;
  FOR r IN SELECT * FROM sales_invoice_balances WHERE entity_id = e AND balance_due > 0 ORDER BY invoice_number OFFSET 12 LIMIT 2 LOOP
    i := i + 1; d := v_start + (i % 25); v_amt := round(r.balance_due / 2); v_bal := v_bal + v_amt;
    v_lines := v_lines || jsonb_build_object('movement_date', d, 'description', 'TRANSF. RECIBIDA ABONO PARCIAL CLIENTE',
      'reference_number', 'TEF-' || (600000 + i), 'debit_amount', 0, 'credit_amount', v_amt, 'balance', v_bal);
  END LOOP;
  i := i + 1; v_bal := v_bal + 1250000;
  v_lines := v_lines || jsonb_build_object('movement_date', v_start + 20, 'description', 'DEPOSITO EN EFECTIVO SUCURSAL ANTOFAGASTA', 'reference_number', 'DEP-900001', 'debit_amount', 0, 'credit_amount', 1250000, 'balance', v_bal);

  FOR r IN SELECT * FROM purchase_invoice_balances WHERE entity_id = e AND balance_due > 0 ORDER BY invoice_number LIMIT 6 LOOP
    i := i + 1; d := v_start + (i % 25); v_bal := v_bal - r.balance_due;
    v_lines := v_lines || jsonb_build_object('movement_date', d,
      'description', CASE WHEN i % 3 = 0 THEN 'TRANSF. EMITIDA PAGO PROVEEDOR' ELSE 'TRANSF. EMITIDA A ' || COALESCE(r.party_tax_id,'') || ' ' || upper(r.party_name) || ' FAC ' || r.invoice_number END,
      'reference_number', 'TEF-' || (700000 + i), 'debit_amount', r.balance_due, 'credit_amount', 0, 'balance', v_bal);
  END LOOP;

  v_bal := v_bal - 18500;
  v_lines := v_lines || jsonb_build_object('movement_date', v_start + 1, 'description', 'COMISION MANTENCION MENSUAL CUENTA CORRIENTE PLAN EMPRESA', 'reference_number', 'COM-0001', 'debit_amount', 18500, 'credit_amount', 0, 'balance', v_bal);
  v_bal := v_bal - 3200;
  v_lines := v_lines || jsonb_build_object('movement_date', v_start + 5, 'description', 'IMPUESTO LEY DE TIMBRES Y ESTAMPILLAS D.L. 3475', 'reference_number', 'IMP-0001', 'debit_amount', 3200, 'credit_amount', 0, 'balance', v_bal);
  v_bal := v_bal - 45900;
  v_lines := v_lines || jsonb_build_object('movement_date', v_start + 12, 'description', 'COMISION TRANSFERENCIAS MASIVAS NOMINA', 'reference_number', 'COM-0002', 'debit_amount', 45900, 'credit_amount', 0, 'balance', v_bal);
  v_bal := v_bal - 2350000;
  v_lines := v_lines || jsonb_build_object('movement_date', v_start + 15, 'description', 'CARGO PAC ARRIENDO GRUAS HORQUILLA', 'reference_number', 'PAC-7781', 'debit_amount', 2350000, 'credit_amount', 0, 'balance', v_bal);

  v_res := public.import_bank_statement_batch(e, v_ba, v_start, (v_start + interval '1 month - 1 day')::date, v_init, v_bal, 'excel', 'cartola_demo_banco_estado.xlsx', v_lines);
  v_stmt := (v_res->>'statement_id')::uuid;

  UPDATE bank_statement_lines SET reconciliation_status = 'matched', matched_operation_type = 'bank_expense', match_confidence = 95,
    match_reason = 'Gasto bancario reconocido por glosa'
  WHERE statement_id = v_stmt AND reconciliation_status = 'unreconciled' AND (description ILIKE 'COMISION%' OR description ILIKE 'IMPUESTO LEY%');

  UPDATE bank_accounts SET current_balance = v_bal WHERE id = v_ba;
  RETURN v_res;
END $$;