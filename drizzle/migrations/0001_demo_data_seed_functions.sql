
CREATE OR REPLACE FUNCTION public.demo_acc(p_e uuid, p_code text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.accounts WHERE entity_id = p_e AND code = p_code LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.demo_wh_addr(p_code text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE p_code
    WHEN 'BOD-STGO-SECO' THEN 'Av. Américo Vespucio 1501, Pudahuel, Santiago'
    WHEN 'BOD-STGO-FRIO' THEN 'Camino Lo Boza 8200, Pudahuel, Santiago'
    WHEN 'BOD-ANT' THEN 'Av. Pedro Aguirre Cerda 10500, Antofagasta'
    WHEN 'BOD-PMO' THEN 'Ruta 5 Sur Km 1025, Puerto Montt'
    WHEN 'BOD-PAR' THEN 'Av. Eduardo Frei 3400, Barrio Industrial, Punta Arenas'
    WHEN 'BOD-ARI' THEN 'Zona Franca Industrial Chacalluta, Arica'
    ELSE 'Casa Matriz, Santiago' END
$$;

CREATE OR REPLACE FUNCTION public.demo_post_je(p_e uuid, p_date date, p_voucher text, p_memo text, p_lines jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j uuid; l jsonb; i int := 1;
BEGIN
  INSERT INTO public.journal_entries(entity_id, posting_date, voucher_type, memo, status, created_by)
  VALUES (p_e, p_date, p_voucher, p_memo, 'draft', auth.uid()) RETURNING id INTO j;
  FOR l IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    IF COALESCE((l->>'d')::numeric,0) = 0 AND COALESCE((l->>'c')::numeric,0) = 0 THEN CONTINUE; END IF;
    INSERT INTO public.journal_entry_lines(journal_entry_id, line_no, account_id, party_id, debit, credit, memo)
    VALUES (j, i, (l->>'a')::uuid, NULLIF(l->>'p','')::uuid, COALESCE((l->>'d')::numeric,0), COALESCE((l->>'c')::numeric,0), l->>'m');
    i := i + 1;
  END LOOP;
  PERFORM public.post_journal_entry(j);
  RETURN j;
END $$;

CREATE OR REPLACE FUNCTION public.demo_sales_invoice(p_e uuid, p_party uuid, p_date date, p_wh uuid, p_lines jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv uuid; l jsonb; sub numeric := 0; tax numeric; num text; je uuid; jl jsonb; r record;
BEGIN
  num := public.get_next_entry_number(p_e, 'FVE-');
  INSERT INTO public.sales_invoices(entity_id, party_id, warehouse_id, currency_code, exchange_rate, invoice_number, issue_date, due_date, status, memo, created_by)
  VALUES (p_e, p_party, p_wh, 'CLP', 1, num, p_date, p_date + 30, 'draft', 'Factura ' || num, auth.uid()) RETURNING id INTO inv;
  FOR l IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    INSERT INTO public.sales_invoice_lines(sales_invoice_id, item_id, description, qty, unit_price, tax_rate, line_total)
    VALUES (inv, NULLIF(l->>'item','')::uuid, l->>'desc', (l->>'qty')::numeric, (l->>'price')::numeric, 19, round((l->>'qty')::numeric * (l->>'price')::numeric));
    sub := sub + round((l->>'qty')::numeric * (l->>'price')::numeric);
  END LOOP;
  tax := round(sub * 0.19);
  jl := jsonb_build_array(jsonb_build_object('a', public.demo_acc(p_e,'1201'), 'd', sub + tax, 'p', p_party, 'm', 'CxC ' || num));
  FOR r IN SELECT x->>'acc' AS acc, sum(round((x->>'qty')::numeric * (x->>'price')::numeric)) AS amt FROM jsonb_array_elements(p_lines) x GROUP BY 1 LOOP
    jl := jl || jsonb_build_array(jsonb_build_object('a', public.demo_acc(p_e, r.acc), 'c', r.amt, 'p', p_party, 'm', 'Ingreso ' || num));
  END LOOP;
  jl := jl || jsonb_build_array(jsonb_build_object('a', public.demo_acc(p_e,'2102'), 'c', tax, 'p', p_party, 'm', 'IVA Débito ' || num));
  je := public.demo_post_je(p_e, p_date, 'Factura de Venta', 'Factura de Venta ' || num, jl);
  UPDATE public.sales_invoices SET subtotal_amount = sub, tax_amount = tax, total_amount = sub + tax, status = 'confirmed', journal_entry_id = je WHERE id = inv;
  RETURN inv;
END $$;

CREATE OR REPLACE FUNCTION public.demo_purchase_invoice(p_e uuid, p_party uuid, p_date date, p_memo text, p_lines jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv uuid; l jsonb; sub numeric := 0; tax numeric := 0; num text; je uuid; jl jsonb := '[]'::jsonb; r record;
BEGIN
  num := 'F-' || (100000 + floor(random() * 899999))::int;
  INSERT INTO public.purchase_invoices(entity_id, party_id, currency_code, exchange_rate, invoice_number, issue_date, due_date, status, memo, created_by)
  VALUES (p_e, p_party, 'CLP', 1, num, p_date, p_date + 30, 'draft', p_memo, auth.uid()) RETURNING id INTO inv;
  FOR l IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    INSERT INTO public.purchase_invoice_lines(purchase_invoice_id, description, qty, unit_price, tax_rate, line_total)
    VALUES (inv, l->>'desc', (l->>'qty')::numeric, (l->>'price')::numeric, COALESCE((l->>'tax')::numeric,19), round((l->>'qty')::numeric * (l->>'price')::numeric));
    sub := sub + round((l->>'qty')::numeric * (l->>'price')::numeric);
    tax := tax + round((l->>'qty')::numeric * (l->>'price')::numeric * COALESCE((l->>'tax')::numeric,19) / 100.0);
  END LOOP;
  FOR r IN SELECT x->>'acc' AS acc, sum(round((x->>'qty')::numeric * (x->>'price')::numeric)) AS amt FROM jsonb_array_elements(p_lines) x GROUP BY 1 LOOP
    jl := jl || jsonb_build_array(jsonb_build_object('a', public.demo_acc(p_e, r.acc), 'd', r.amt, 'p', p_party, 'm', p_memo));
  END LOOP;
  jl := jl || jsonb_build_array(jsonb_build_object('a', public.demo_acc(p_e,'1401'), 'd', tax, 'p', p_party, 'm', 'IVA Crédito ' || num));
  jl := jl || jsonb_build_array(jsonb_build_object('a', public.demo_acc(p_e,'2101'), 'c', sub + tax, 'p', p_party, 'm', 'CxP ' || num));
  je := public.demo_post_je(p_e, p_date, 'Factura de Compra', p_memo || ' ' || num, jl);
  UPDATE public.purchase_invoices SET subtotal_amount = sub, tax_amount = tax, total_amount = sub + tax, status = 'confirmed', journal_entry_id = je WHERE id = inv;
  RETURN inv;
END $$;

CREATE OR REPLACE FUNCTION public.seed_demo_base(p_start date) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e uuid; y int; d date; u_un uuid; u_kg uuid; w record; p record; c uuid; cc_tra uuid; cc_bod uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Solo administradores pueden cargar datos de ejemplo.'; END IF;
  IF EXISTS (SELECT 1 FROM public.entities WHERE code = 'DEMO-3PL') THEN RAISE EXCEPTION 'Los datos de ejemplo ya están cargados. Elimínelos primero.'; END IF;
  p_start := date_trunc('month', p_start)::date;

  INSERT INTO public.entities(code, name, tax_id, currency, base_currency_code, tax_regime, ppm_rate, active)
  VALUES ('DEMO-3PL', 'Logística Austral Demo SpA', '76.543.210-K', 'CLP', 'CLP', '14A_general', 0.0125, true) RETURNING id INTO e;

  INSERT INTO public.company_users(user_id, entity_id, role, is_default)
  SELECT DISTINCT ur.user_id, e, 'admin', false FROM public.user_roles ur WHERE ur.role = 'admin';
  IF auth.uid() IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.company_users WHERE user_id = auth.uid() AND entity_id = e) THEN
    INSERT INTO public.company_users(user_id, entity_id, role, is_default) VALUES (auth.uid(), e, 'admin', false);
  END IF;

  INSERT INTO public.accounts(entity_id, code, name, account_type, is_group, active) VALUES
   (e,'1101','Banco Estado Cuenta Corriente','Asset',false,true),
   (e,'1102','Caja','Asset',false,true),
   (e,'1201','Clientes','Asset',false,true),
   (e,'1301','Inventario','Asset',false,true),
   (e,'1401','IVA Crédito Fiscal','Asset',false,true),
   (e,'1501','Vehículos y Camiones','Asset',false,true),
   (e,'1502','Maquinaria y Grúas Horquilla','Asset',false,true),
   (e,'1503','Racks e Instalaciones de Bodega','Asset',false,true),
   (e,'1509','Depreciación Acumulada','Asset',false,true),
   (e,'2101','Proveedores','Liability',false,true),
   (e,'2102','IVA Débito Fiscal','Liability',false,true),
   (e,'2103','Remuneraciones por Pagar','Liability',false,true),
   (e,'2104','Leyes Sociales por Pagar','Liability',false,true),
   (e,'2201','Préstamo Bancario Largo Plazo','Liability',false,true),
   (e,'3101','Capital Social','Equity',false,true),
   (e,'3201','Utilidades Acumuladas','Equity',false,true),
   (e,'4101','Ingresos por Transporte','Income',false,true),
   (e,'4102','Ingresos por Almacenaje 3PL','Income',false,true),
   (e,'4103','Otros Ingresos','Income',false,true),
   (e,'5101','Costo de Ventas','Expense',false,true),
   (e,'5201','Combustible','Expense',false,true),
   (e,'5202','Peajes y Pasos Fronterizos','Expense',false,true),
   (e,'5203','Transporte Subcontratado','Expense',false,true),
   (e,'5204','Arriendo de Bodegas','Expense',false,true),
   (e,'5205','Remuneraciones','Expense',false,true),
   (e,'5206','Mantención de Flota','Expense',false,true),
   (e,'5207','Energía Eléctrica y Frío','Expense',false,true),
   (e,'5208','Seguros','Expense',false,true),
   (e,'5209','Depreciación del Ejercicio','Expense',false,true),
   (e,'5210','Gastos Generales y Telecomunicaciones','Expense',false,true),
   (e,'5211','Servicios de Agencia de Aduana','Expense',false,true),
   (e,'6101','Diferencia de Cambio Ganancia','Income',false,true),
   (e,'6102','Diferencia de Cambio Pérdida','Expense',false,true);

  INSERT INTO public.company_default_accounts(entity_id, receivable_account_id, payable_account_id, sales_income_account_id, purchase_expense_account_id, cogs_account_id, inventory_account_id, output_tax_account_id, input_tax_account_id, realized_exchange_gain_account_id, realized_exchange_loss_account_id, unrealized_exchange_gain_account_id, unrealized_exchange_loss_account_id)
  VALUES (e, public.demo_acc(e,'1201'), public.demo_acc(e,'2101'), public.demo_acc(e,'4101'), public.demo_acc(e,'5210'), public.demo_acc(e,'5101'), public.demo_acc(e,'1301'), public.demo_acc(e,'2102'), public.demo_acc(e,'1401'), public.demo_acc(e,'6101'), public.demo_acc(e,'6102'), public.demo_acc(e,'6101'), public.demo_acc(e,'6102'));

  FOR y IN extract(year FROM p_start)::int .. extract(year FROM current_date)::int LOOP
    INSERT INTO public.fiscal_years(entity_id, name, start_date, end_date, closed) VALUES (e, 'Ejercicio ' || y, make_date(y,1,1), make_date(y,12,31), false) RETURNING id INTO c;
    d := make_date(y,1,1);
    WHILE d <= make_date(y,12,1) LOOP
      IF d >= p_start THEN
        INSERT INTO public.accounting_periods(entity_id, fiscal_year_id, name, start_date, end_date, closed, status)
        VALUES (e, c, to_char(d,'MM/YYYY'), d, (d + interval '1 month - 1 day')::date, false, 'open');
      END IF;
      d := (d + interval '1 month')::date;
    END LOOP;
  END LOOP;

  INSERT INTO public.cost_centers(entity_id, code, name, is_group, active) VALUES
   (e,'CC-TRA','Transporte Nacional',false,true),(e,'CC-BOD','Bodegaje 3PL',false,true),(e,'CC-FRI','Cadena de Frío',false,true),(e,'CC-ADM','Administración',false,true);
  INSERT INTO public.business_units(entity_id, code, name, is_group, active) VALUES
   (e,'STGO','Casa Matriz Santiago',false,true),(e,'ARI','Sucursal Arica',false,true),(e,'ANT','Sucursal Antofagasta',false,true),(e,'PMO','Sucursal Puerto Montt',false,true),(e,'PAR','Sucursal Punta Arenas',false,true);

  INSERT INTO public.warehouses(entity_id, code, name, active, is_active, capacity_m3, storage_measure_method, storage_measure_basis, default_units_per_pallet, storage_capacity) VALUES
   (e,'BOD-STGO-SECO','CD Pudahuel Seco (Santiago)',true,true,14000,'pallet_positions','period_end',60,4200),
   (e,'BOD-STGO-FRIO','CD Pudahuel Frío -18°C (Santiago)',true,true,4500,'pallet_positions','period_end',80,1400),
   (e,'BOD-ARI','Bodega Zona Franca Arica',true,true,3000,'pallet_positions','period_end',60,900),
   (e,'BOD-ANT','Bodega Antofagasta',true,true,3200,'pallet_positions','period_end',60,950),
   (e,'BOD-PMO','Bodega Puerto Montt',true,true,2600,'pallet_positions','period_end',60,780),
   (e,'BOD-PAR','Bodega Punta Arenas (Frío y Seco)',true,true,1800,'pallet_positions','period_end',60,540);
  FOR w IN SELECT id, code, storage_capacity FROM public.warehouses WHERE entity_id = e LOOP
    INSERT INTO public.warehouse_locations(entity_id, warehouse_id, code, name, is_active, pallet_positions, area_m2)
    SELECT e, w.id, 'P' || lpad(g::text,2,'0'), 'Pasillo ' || g, true, (w.storage_capacity / 4)::int, round(w.storage_capacity / 4 * 1.2)
    FROM generate_series(1,4) g;
  END LOOP;

  SELECT id INTO u_un FROM public.uom WHERE code = 'UNIDAD' LIMIT 1;
  SELECT id INTO u_kg FROM public.uom WHERE code = 'KG' LIMIT 1;

  INSERT INTO public.parties(entity_id, name, commercial_name, classification, party_type, tax_id, enabled, is_3pl_client) VALUES
   (e,'Farmacias Cruz Verde S.A.','Cruz Verde','customer','customer','96.100.200-1',true,false),
   (e,'Salcobrand S.A.','Salcobrand','customer','customer','96.100.200-2',true,false),
   (e,'Farmacias Ahumada S.A.','Farmacias Ahumada','customer','customer','96.100.200-3',true,false),
   (e,'Farmacias del Dr. Simi SpA','Dr. Simi','customer','customer','96.100.200-4',true,false),
   (e,'Falabella Retail S.A.','Falabella','customer','customer','96.100.200-5',true,false),
   (e,'Comercial Ripley S.A.','Ripley','customer','customer','96.100.200-6',true,false),
   (e,'Cencosud Retail S.A.','Paris / Jumbo','customer','customer','96.100.200-7',true,false),
   (e,'Walmart Chile S.A.','Lider','customer','customer','96.100.200-8',true,false),
   (e,'Hipermercados Tottus S.A.','Tottus','customer','customer','96.100.200-9',true,false),
   (e,'SMU S.A.','Unimarc','customer','customer','96.100.201-0',true,false),
   (e,'Sodimac S.A.','Sodimac','customer','customer','96.100.201-1',true,false),
   (e,'Empresas Hites S.A.','Hites','customer','customer','96.100.201-2',true,false),
   (e,'TecnoImport Chile SpA','TecnoImport','customer','customer','77.210.330-1',true,true),
   (e,'ElectroHogar Andes Ltda.','ElectroHogar','customer','customer','76.880.412-5',true,true),
   (e,'Frigorífico Austral SpA','Frigorífico Austral','customer','customer','78.455.120-7',true,true),
   (e,'Congelados del Sur S.A.','Congelados del Sur','customer','customer','76.301.998-2',true,true),
   (e,'Alimentos Secos Valle Central SpA','Valle Central','customer','customer','77.654.001-9',true,true),
   (e,'Distribuidora Granos del Norte Ltda.','Granos del Norte','customer','customer','79.120.887-4',true,true),
   (e,'Compañía de Petróleos de Chile Copec S.A.','Copec','supplier','supplier','99.520.000-7',true,false),
   (e,'Sociedad Concesionaria Rutas del Pacífico S.A.','Autopistas / Peajes','supplier','supplier','96.800.100-1',true,false),
   (e,'Transportes Hermanos Pérez Ltda.','Hnos. Pérez','supplier','supplier','76.222.333-4',true,false),
   (e,'Inmobiliaria Bodegas Pudahuel S.A.','Bodegas Pudahuel','supplier','supplier','76.444.555-6',true,false),
   (e,'Enel Distribución Chile S.A.','Enel','supplier','supplier','96.800.570-7',true,false),
   (e,'Scania Chile S.A.','Scania','supplier','supplier','96.500.600-2',true,false),
   (e,'HDI Seguros S.A.','HDI Seguros','supplier','supplier','99.231.000-6',true,false),
   (e,'Entel PCS Telecomunicaciones S.A.','Entel','supplier','supplier','96.806.980-2',true,false),
   (e,'Shenzhen Rack Industrial Co. Ltd.','Shenzhen Rack (China)','supplier','supplier','55.555.001-1',true,false),
   (e,'Ningbo Forklift Machinery Co. Ltd.','Ningbo Forklift (China)','supplier','supplier','55.555.002-K',true,false),
   (e,'Agencia de Aduanas Valparaíso Ltda.','Agencia Aduana','supplier','supplier','78.901.234-5',true,false);

  INSERT INTO public.items(entity_id, code, sku, name, uom_id, is_stock_item, valuation_method, active, units_per_pallet, unit_volume_m3) VALUES
   (e,'SRV-FTL','SRV-FTL','Flete camión completo (FTL)',u_un,false,'FIFO',true,1,0),
   (e,'SRV-LTL','SRV-LTL','Flete carga consolidada (LTL)',u_un,false,'FIFO',true,1,0),
   (e,'SRV-FRIO','SRV-FRIO','Flete refrigerado / congelado',u_un,false,'FIFO',true,1,0),
   (e,'SRV-ULT','SRV-ULT','Distribución última milla',u_un,false,'FIFO',true,1,0),
   (e,'SRV-ALM','SRV-ALM','Almacenaje por posición pallet / mes',u_un,false,'FIFO',true,1,0),
   (e,'SRV-PICK','SRV-PICK','Picking y packing por unidad',u_un,false,'FIFO',true,1,0),
   (e,'SRV-CROSS','SRV-CROSS','Cross-docking',u_un,false,'FIFO',true,1,0),
   (e,'EL-TV55','EL-TV55','Smart TV 55" 4K',u_un,true,'FIFO',true,24,0.18),
   (e,'EL-NB14','EL-NB14','Notebook 14" Core i5',u_un,true,'FIFO',true,120,0.02),
   (e,'EL-CEL','EL-CEL','Smartphone 128GB',u_un,true,'FIFO',true,600,0.002),
   (e,'EL-AUD','EL-AUD','Audífonos Bluetooth',u_un,true,'FIFO',true,800,0.0015),
   (e,'EL-MIC','EL-MIC','Microondas 25L',u_un,true,'FIFO',true,40,0.06),
   (e,'EL-REF','EL-REF','Refrigerador No Frost 300L',u_un,true,'FIFO',true,6,0.55),
   (e,'CG-POLLO','CG-POLLO','Pechuga de pollo IQF 1kg',u_kg,true,'FIFO',true,500,0.002),
   (e,'CG-SALMON','CG-SALMON','Filete de salmón congelado 500g',u_un,true,'FIFO',true,800,0.001),
   (e,'CG-HELADO','CG-HELADO','Helado 1L',u_un,true,'FIFO',true,480,0.0015),
   (e,'CG-PAPAS','CG-PAPAS','Papas prefritas congeladas 2,5kg',u_un,true,'FIFO',true,200,0.006),
   (e,'CG-VERD','CG-VERD','Mix de verduras congeladas 1kg',u_un,true,'FIFO',true,500,0.002),
   (e,'SC-ARROZ','SC-ARROZ','Arroz grado 1 1kg',u_un,true,'FIFO',true,1000,0.0012),
   (e,'SC-ACEITE','SC-ACEITE','Aceite maravilla 1L',u_un,true,'FIFO',true,720,0.0012),
   (e,'SC-FIDEOS','SC-FIDEOS','Fideos spaghetti 400g',u_un,true,'FIFO',true,1200,0.0008),
   (e,'SC-AZUCAR','SC-AZUCAR','Azúcar granulada 1kg',u_un,true,'FIFO',true,1000,0.0011),
   (e,'SC-HARINA','SC-HARINA','Harina panadera 25kg',u_un,true,'FIFO',true,40,0.035);

  INSERT INTO public.party_warehouses(entity_id, party_id, warehouse_id)
  SELECT e, p.id, w.id FROM (VALUES
    ('77.210.330-1','BOD-STGO-SECO'),('77.210.330-1','BOD-ARI'),
    ('76.880.412-5','BOD-STGO-SECO'),('76.880.412-5','BOD-ANT'),
    ('78.455.120-7','BOD-STGO-FRIO'),('78.455.120-7','BOD-PAR'),
    ('76.301.998-2','BOD-STGO-FRIO'),('76.301.998-2','BOD-PMO'),
    ('77.654.001-9','BOD-STGO-SECO'),('77.654.001-9','BOD-PMO'),
    ('79.120.887-4','BOD-ANT'),('79.120.887-4','BOD-ARI')) v(tax, wh)
  JOIN public.parties p ON p.entity_id = e AND p.tax_id = v.tax
  JOIN public.warehouses w ON w.entity_id = e AND w.code = v.wh;

  FOR p IN SELECT id, name FROM public.parties WHERE entity_id = e AND is_3pl_client LOOP
    INSERT INTO public.service_contracts(entity_id, party_id, billing_frequency, active, notes)
    VALUES (e, p.id, 'mensual', true, 'Contrato de servicios logísticos 3PL - ' || p.name) RETURNING id INTO c;
    INSERT INTO public.service_rate_lines(contract_id, rate_type, unit_price, description) VALUES
     (c,'storage_pallet',8500,'Almacenaje por posición pallet / mes'),
     (c,'picking_unit',180,'Picking y packing por unidad'),
     (c,'transport_km',1450,'Transporte por km recorrido'),
     (c,'recargo_fijo',150000,'Cargo fijo administración de cuenta');
  END LOOP;

  INSERT INTO public.vehicles(entity_id, plate, vehicle_type, capacity_kg, capacity_m3, active) VALUES
   (e,'KXPT-21','Tractocamión Scania R450',28000,90,true),(e,'KXPT-22','Tractocamión Scania R450',28000,90,true),
   (e,'LBRS-45','Tractocamión Scania R450',28000,90,true),(e,'LBRS-46','Tractocamión Scania R450',28000,90,true),
   (e,'PFGH-10','Tractocamión Volvo FH',28000,90,true),(e,'PFGH-11','Tractocamión Volvo FH',28000,90,true),
   (e,'RTZK-73','Camión refrigerado 12T',12000,45,true),(e,'RTZK-74','Camión refrigerado 12T',12000,45,true),
   (e,'SJWD-02','Camión refrigerado 12T',12000,45,true),(e,'HHKL-58','Camión 3/4 última milla',4500,18,true),
   (e,'HHKL-59','Camión 3/4 última milla',4500,18,true),(e,'JPLM-90','Furgón eléctrico última milla',1500,8,true);

  SELECT id INTO cc_tra FROM public.cost_centers WHERE entity_id = e AND code = 'CC-TRA';
  SELECT id INTO cc_bod FROM public.cost_centers WHERE entity_id = e AND code = 'CC-BOD';
  INSERT INTO public.fixed_assets(entity_id, cost_center_id, asset_code, name, acquisition_date, acquisition_value, currency_code, residual_value, useful_life_months, depreciation_method, accumulated_depreciation, asset_account_id, accumulated_depreciation_account_id, depreciation_expense_account_id, status, memo)
  SELECT e, CASE WHEN v.acc = '1501' THEN cc_tra ELSE cc_bod END, v.code, v.name, v.dt::date, v.val, 'CLP', round(v.val*0.1), v.life, 'linea_recta', v.acum,
         public.demo_acc(e, v.acc), public.demo_acc(e,'1509'), public.demo_acc(e,'5209'), 'active', v.memo
  FROM (VALUES
   ('AF-001','Tractocamión Scania R450 KXPT-21','2023-03-01',95000000,84,25000000,'1501','Flota troncal Arica - Punta Arenas'),
   ('AF-002','Tractocamión Scania R450 KXPT-22','2023-03-01',95000000,84,25000000,'1501','Flota troncal'),
   ('AF-003','Tractocamión Scania R450 LBRS-45','2023-08-01',95000000,84,25000000,'1501','Flota troncal'),
   ('AF-004','Tractocamión Scania R450 LBRS-46','2023-08-01',95000000,84,25000000,'1501','Flota troncal'),
   ('AF-005','Tractocamión Volvo FH PFGH-10','2024-01-01',95000000,84,25000000,'1501','Flota troncal'),
   ('AF-006','Tractocamión Volvo FH PFGH-11','2024-01-01',95000000,84,25000000,'1501','Flota troncal'),
   ('AF-007','Camión refrigerado 12T RTZK-73','2024-02-01',50000000,84,10000000,'1501','Cadena de frío'),
   ('AF-008','Camión refrigerado 12T RTZK-74','2024-02-01',50000000,84,10000000,'1501','Cadena de frío'),
   ('AF-009','Camión refrigerado 12T SJWD-02','2024-06-01',50000000,84,10000000,'1501','Cadena de frío'),
   ('AF-010','Lote 8 grúas horquilla eléctricas (importadas desde Ningbo, China)','2024-05-01',100000000,120,20000000,'1502','Importación desde China - DIN 2024'),
   ('AF-011','Equipamiento cámara frigorífica -18°C','2024-04-01',40000000,120,5000000,'1502','CD Pudahuel Frío'),
   ('AF-012','Racks selectivos 4.200 posiciones (importados desde Shenzhen, China)','2025-01-01',95000000,180,5000000,'1503','Importación desde China - DIN 2025')
  ) v(code,name,dt,val,life,acum,acc,memo);

  PERFORM public.demo_post_je(e, p_start, 'Asiento de Apertura', 'Asiento de apertura empresa demo', jsonb_build_array(
    jsonb_build_object('a',public.demo_acc(e,'1101'),'d',180000000,'m','Saldo inicial banco'),
    jsonb_build_object('a',public.demo_acc(e,'1501'),'d',720000000,'m','Flota de camiones'),
    jsonb_build_object('a',public.demo_acc(e,'1502'),'d',140000000,'m','Maquinaria'),
    jsonb_build_object('a',public.demo_acc(e,'1503'),'d',95000000,'m','Racks e instalaciones'),
    jsonb_build_object('a',public.demo_acc(e,'1509'),'c',210000000,'m','Depreciación acumulada'),
    jsonb_build_object('a',public.demo_acc(e,'2201'),'c',300000000,'m','Crédito bancario flota'),
    jsonb_build_object('a',public.demo_acc(e,'3101'),'c',400000000,'m','Capital pagado'),
    jsonb_build_object('a',public.demo_acc(e,'3201'),'c',225000000,'m','Utilidades acumuladas')));

  RETURN e;
END $$;

CREATE OR REPLACE FUNCTION public.seed_demo_month(p_entity uuid, p_month date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e uuid := p_entity; m date := date_trunc('month', p_month)::date; last_day int; f numeric; is_current boolean;
  c record; it record; g record; r record; k int; n int; trips int; km numeric; dest_i int; qty numeric; avail numeric;
  lines jsonb; d date; inv uuid; dn uuid; rt uuid; je uuid; dep timestamptz; st text; amt numeric;
  veh text[]; veh_ids uuid[]; drivers text[] := ARRAY['Juan Soto','Pedro Muñoz','Luis Rojas','Carlos Díaz','Marcelo Vera','Jorge Araya','Andrés Fuentes','Rodrigo Silva'];
  cities text[] := ARRAY['Arica','Iquique','Antofagasta','Calama','Copiapó','La Serena','Valparaíso','Rancagua','Talca','Concepción','Temuco','Valdivia','Puerto Montt','Coyhaique','Punta Arenas'];
  city_km int[] := ARRAY[2060,1780,1360,1570,800,470,120,90,255,500,680,840,1030,1650,3090];
  dests text[] := ARRAY['CD Falabella, Av. Lo Espejo 01565, San Bernardo','CD Ripley, Camino a Melipilla 16000, Maipú','CD Lider, Av. Pdte. Eduardo Frei 11500, Quilicura','Unimarc Punta Arenas, Av. Bulnes 01245, Punta Arenas','Tottus Antofagasta, Av. Angamos 745, Antofagasta','Paris Arica, 21 de Mayo 450, Arica','CD Cruz Verde, Camino Lo Boza 120, Pudahuel','Jumbo Puerto Montt, Av. Pdte. Ibáñez 1100, Puerto Montt','Hites Iquique, Vivar 537, Iquique','Sodimac Temuco, Av. Alemania 0671, Temuco'];
  dest_km int[] := ARRAY[25,30,20,3090,1360,2060,15,1030,1780,680];
  srv record; cnt_s int := 0; cnt_d int := 0; month_cost numeric := 0; payroll numeric;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Solo administradores pueden cargar datos de ejemplo.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.entities WHERE id = e AND code = 'DEMO-3PL') THEN RAISE EXCEPTION 'Empresa demo no encontrada.'; END IF;
  PERFORM setseed(((extract(year FROM m)::int * 12 + extract(month FROM m)::int) % 997) / 997.0);
  is_current := (m = date_trunc('month', current_date)::date);
  last_day := CASE WHEN is_current THEN greatest(extract(day FROM current_date)::int, 2) ELSE extract(day FROM (m + interval '1 month - 1 day'))::int END;
  f := CASE extract(month FROM m)::int WHEN 11 THEN 1.12 WHEN 12 THEN 1.28 WHEN 1 THEN 0.95 WHEN 2 THEN 0.86 WHEN 3 THEN 1.04 ELSE 1.0 END;

  SELECT array_agg(plate ORDER BY plate), array_agg(id ORDER BY plate) INTO veh, veh_ids FROM public.vehicles WHERE entity_id = e;
  SELECT
    max(id::text) FILTER (WHERE code='SRV-FTL') ftl, max(id::text) FILTER (WHERE code='SRV-LTL') ltl,
    max(id::text) FILTER (WHERE code='SRV-FRIO') frio, max(id::text) FILTER (WHERE code='SRV-ULT') ult,
    max(id::text) FILTER (WHERE code='SRV-ALM') alm, max(id::text) FILTER (WHERE code='SRV-PICK') pick
  INTO srv FROM public.items WHERE entity_id = e;

  -- 1. Payments of previous month invoices
  FOR r IN SELECT id, party_id, total_amount, invoice_number FROM public.sales_invoices
           WHERE entity_id = e AND status = 'confirmed' AND issue_date >= (m - interval '1 month') AND issue_date < m ORDER BY issue_date LOOP
    IF random() < 0.92 THEN
      d := m + least(4 + floor(random()*24)::int, last_day - 1);
      je := public.demo_post_je(e, d, 'Pago Recibido', 'Cobro factura ' || r.invoice_number, jsonb_build_array(
        jsonb_build_object('a',public.demo_acc(e,'1101'),'d',r.total_amount,'p',r.party_id,'m','Depósito cliente'),
        jsonb_build_object('a',public.demo_acc(e,'1201'),'c',r.total_amount,'p',r.party_id,'m','Cobro ' || r.invoice_number)));
      INSERT INTO public.invoice_payments(entity_id, sales_invoice_id, amount, currency_code, payment_date, bank_account_id, journal_entry_id, memo, created_by)
      VALUES (e, r.id, r.total_amount, 'CLP', d, public.demo_acc(e,'1101'), je, 'Transferencia cliente', auth.uid());
      UPDATE public.sales_invoices SET status = 'paid' WHERE id = r.id;
    END IF;
  END LOOP;
  FOR r IN SELECT id, party_id, total_amount, invoice_number FROM public.purchase_invoices
           WHERE entity_id = e AND status = 'confirmed' AND issue_date >= (m - interval '1 month') AND issue_date < m ORDER BY issue_date LOOP
    d := m + least(9 + floor(random()*15)::int, last_day - 1);
    je := public.demo_post_je(e, d, 'Pago Emitido', 'Pago factura proveedor ' || r.invoice_number, jsonb_build_array(
      jsonb_build_object('a',public.demo_acc(e,'2101'),'d',r.total_amount,'p',r.party_id,'m','Pago ' || r.invoice_number),
      jsonb_build_object('a',public.demo_acc(e,'1101'),'c',r.total_amount,'p',r.party_id,'m','Transferencia a proveedor')));
    INSERT INTO public.invoice_payments(entity_id, purchase_invoice_id, amount, currency_code, payment_date, bank_account_id, journal_entry_id, memo, created_by)
    VALUES (e, r.id, r.total_amount, 'CLP', d, public.demo_acc(e,'1101'), je, 'Transferencia a proveedor', auth.uid());
    UPDATE public.purchase_invoices SET status = 'paid' WHERE id = r.id;
  END LOOP;

  -- 2. Transport sales (pharmacies & retail)
  FOR c IN SELECT id, name, commercial_name FROM public.parties WHERE entity_id = e AND classification = 'customer' AND NOT COALESCE(is_3pl_client,false) ORDER BY name LOOP
    n := 2 + floor(random()*2)::int;
    FOR k IN 1..n LOOP
      d := m + floor(random()*last_day)::int;
      dest_i := 1 + floor(random()*array_length(cities,1))::int;
      trips := 1 + floor(random()*3)::int;
      km := city_km[dest_i];
      IF c.name ILIKE '%farmac%' OR c.name ILIKE '%salcobrand%' THEN
        lines := jsonb_build_array(
          jsonb_build_object('item',srv.ltl,'desc','Flete consolidado Santiago - ' || cities[dest_i],'qty',trips,'price',round((km*520 + 180000)*f/1000)*1000,'acc','4101'),
          jsonb_build_object('item',srv.ult,'desc','Distribución última milla a locales ' || cities[dest_i],'qty',20 + floor(random()*40)::int,'price',18500,'acc','4101'));
      ELSIF c.name ILIKE '%SMU%' OR c.name ILIKE '%Tottus%' OR c.name ILIKE '%Walmart%' THEN
        lines := jsonb_build_array(
          jsonb_build_object('item',srv.frio,'desc','Flete refrigerado Santiago - ' || cities[dest_i],'qty',trips,'price',round((km*980 + 300000)*f/1000)*1000,'acc','4101'));
      ELSE
        lines := jsonb_build_array(
          jsonb_build_object('item',srv.ftl,'desc','Flete camión completo Santiago - ' || cities[dest_i],'qty',trips,'price',round((km*850 + 250000)*f/1000)*1000,'acc','4101'));
      END IF;
      PERFORM public.demo_sales_invoice(e, c.id, d, NULL, lines);
      cnt_s := cnt_s + 1;
    END LOOP;
  END LOOP;

  -- 3. 3PL client inventory model
  CREATE TEMP TABLE IF NOT EXISTS _di(item_id uuid, code text, name text, party_id uuid, wh_id uuid, loc_id uuid, wh_code text, rate numeric, base numeric, kg numeric, vol numeric) ON COMMIT DROP;
  TRUNCATE _di;
  INSERT INTO _di
  SELECT i.id, i.code, i.name, p.id, w.id, (SELECT wl.id FROM public.warehouse_locations wl WHERE wl.warehouse_id = w.id ORDER BY wl.code LIMIT 1), w.code, v.rate, v.base, v.kg, i.unit_volume_m3
  FROM (VALUES
    ('EL-TV55','77.210.330-1','BOD-STGO-SECO',289000,380,18.5),('EL-NB14','77.210.330-1','BOD-STGO-SECO',459000,300,2.2),
    ('EL-CEL','77.210.330-1','BOD-ARI',219000,900,0.4),('EL-AUD','77.210.330-1','BOD-ARI',29900,1500,0.3),
    ('EL-MIC','76.880.412-5','BOD-STGO-SECO',69900,450,13),('EL-REF','76.880.412-5','BOD-ANT',349000,160,62),
    ('CG-POLLO','78.455.120-7','BOD-STGO-FRIO',5490,9000,1),('CG-SALMON','78.455.120-7','BOD-PAR',7990,6000,0.5),
    ('CG-HELADO','78.455.120-7','BOD-STGO-FRIO',3290,12000,0.6),('CG-PAPAS','76.301.998-2','BOD-STGO-FRIO',4290,8000,2.5),
    ('CG-VERD','76.301.998-2','BOD-PMO',2590,7000,1),('SC-ARROZ','77.654.001-9','BOD-STGO-SECO',1390,20000,1),
    ('SC-ACEITE','77.654.001-9','BOD-PMO',2490,15000,0.92),('SC-FIDEOS','77.654.001-9','BOD-STGO-SECO',890,25000,0.4),
    ('SC-AZUCAR','79.120.887-4','BOD-ANT',1190,18000,1),('SC-HARINA','79.120.887-4','BOD-ARI',16900,2500,25)
  ) v(code, tax, wh, rate, base, kg)
  JOIN public.items i ON i.entity_id = e AND i.code = v.code
  JOIN public.parties p ON p.entity_id = e AND p.tax_id = v.tax
  JOIN public.warehouses w ON w.entity_id = e AND w.code = v.wh;

  -- 3a. Receipts (client-owned stock)
  FOR it IN SELECT * FROM _di LOOP
    qty := round(it.base * f * (CASE WHEN EXISTS (SELECT 1 FROM public.stock_ledger_entries s WHERE s.item_id = it.item_id) THEN 1 ELSE 1.8 END) * (0.9 + random()*0.2));
    INSERT INTO public.stock_ledger_entries(entity_id, item_id, warehouse_id, movement_type, qty_change, valuation_rate, voucher_type, memo, posting_date, created_by, party_id, location_id, lot_number, qc_notes)
    VALUES (e, it.item_id, it.wh_id, 'receipt', qty, it.rate, 'Recepción 3PL', 'Recepción mercadería cliente - ' || it.name,
            m + least(1 + floor(random()*6)::int, last_day - 1), auth.uid(), it.party_id, it.loc_id,
            'L' || to_char(m,'YYMM') || '-' || it.code, CASE WHEN random() < 0.1 THEN 'QC: 2 cajas con embalaje dañado, aceptado con observación' ELSE 'QC OK' END);
  END LOOP;

  -- 3b. Dispatch notes, routes, orders
  FOR g IN SELECT DISTINCT party_id, wh_id, wh_code FROM _di ORDER BY wh_code LOOP
    n := 2 + floor(random()*2)::int;
    SELECT id INTO rt FROM public.routes WHERE false;
    INSERT INTO public.routes(entity_id, name, route_date, vehicle_id, driver_name, status, notes)
    VALUES (e, 'Ruta ' || (SELECT commercial_name FROM public.parties WHERE id = g.party_id) || ' ' || g.wh_code || ' ' || to_char(m,'MM/YYYY'),
            m + least(5, last_day - 1), veh_ids[1 + floor(random()*array_length(veh_ids,1))::int], drivers[1 + floor(random()*array_length(drivers,1))::int],
            CASE WHEN is_current THEN 'en_curso' ELSE 'finalizada' END, 'Ruta generada con datos de ejemplo')
    RETURNING id INTO rt;
    FOR k IN 1..n LOOP
      d := m + least(floor(random()*last_day)::int, last_day - 1);
      dest_i := 1 + floor(random()*array_length(dests,1))::int;
      dep := d + time '07:00' + (floor(random()*5) || ' hours')::interval;
      st := CASE WHEN d < current_date - 1 THEN 'issued' ELSE 'draft' END;
      INSERT INTO public.dispatch_notes(entity_id, party_id, warehouse_id, dispatch_number, transfer_type, origin_address, destination_address, carrier_name, carrier_tax_id, vehicle_plate, departure_at, arrival_at, status, notes, created_by, courier_name, courier_tracking_number, courier_status, distance_km)
      VALUES (e, g.party_id, g.wh_id, public.get_next_entry_number(e,'GD-'), 'venta', public.demo_wh_addr(g.wh_code), dests[dest_i],
              'Logística Austral Demo SpA', '76.543.210-K', veh[1 + floor(random()*array_length(veh,1))::int], dep,
              CASE WHEN st = 'issued' THEN dep + ((greatest(dest_km[dest_i],20) / 55.0) || ' hours')::interval ELSE NULL END,
              st::public.dispatch_status, 'Despacho a cliente final del mandante 3PL', auth.uid(),
              CASE WHEN random() < 0.2 THEN (ARRAY['Blue Express','Chilexpress','Starken'])[1 + floor(random()*3)::int] END,
              CASE WHEN random() < 0.2 THEN 'TRK' || (10000000 + floor(random()*89999999))::bigint END,
              CASE WHEN st = 'issued' THEN 'Entregado' ELSE 'Pendiente' END, dest_km[dest_i])
      RETURNING id INTO dn;
      FOR it IN SELECT * FROM _di WHERE party_id = g.party_id AND wh_id = g.wh_id LOOP
        SELECT COALESCE(sum(qty_change),0) INTO avail FROM public.stock_ledger_entries WHERE item_id = it.item_id AND warehouse_id = it.wh_id;
        qty := least(round(it.base * f * 0.85 / n * (0.85 + random()*0.3)), avail);
        IF qty <= 0 THEN CONTINUE; END IF;
        INSERT INTO public.dispatch_note_lines(dispatch_note_id, item_id, qty, uom, weight_kg, volume_m3, unit_value, location_id, lot_number, picked, packed, picked_at, packed_at)
        VALUES (dn, it.item_id, qty, 'UN', round(qty*it.kg,2), round(qty*it.vol,3), it.rate, it.loc_id, 'L' || to_char(m,'YYMM') || '-' || it.code,
                st = 'issued', st = 'issued', CASE WHEN st='issued' THEN dep - interval '3 hours' END, CASE WHEN st='issued' THEN dep - interval '1 hour' END);
        IF st = 'issued' THEN
          INSERT INTO public.stock_ledger_entries(entity_id, item_id, warehouse_id, movement_type, qty_change, valuation_rate, voucher_type, voucher_id, memo, posting_date, created_by, party_id, location_id, lot_number)
          VALUES (e, it.item_id, it.wh_id, 'issue', -qty, 0, 'Guía de Despacho', dn, 'Despacho 3PL - ' || it.name, d, auth.uid(), it.party_id, it.loc_id, 'L' || to_char(m,'YYMM') || '-' || it.code);
        END IF;
      END LOOP;
      INSERT INTO public.route_stops(route_id, dispatch_note_id, stop_order, delivery_status, arrived_at, received_by, delivery_notes)
      VALUES (rt, dn, k, CASE WHEN st='issued' THEN 'entregado' ELSE 'pendiente' END::public.stop_delivery_status,
              CASE WHEN st='issued' THEN dep + interval '6 hours' END,
              CASE WHEN st='issued' THEN (ARRAY['María González','José Pérez','Carolina Reyes','Felipe Contreras'])[1 + floor(random()*4)::int] END,
              CASE WHEN st='issued' THEN 'Recepción conforme' END);
      IF random() < 0.6 THEN
        INSERT INTO public.sales_orders(entity_id, party_id, channel, external_order_id, destination_address, status, dispatch_note_id, notes)
        VALUES (e, g.party_id, (ARRAY['shopify','vtex','mercadolibre','falabella_seller'])[1 + floor(random()*4)::int],
                'EXT-' || to_char(m,'YYMM') || '-' || lpad((floor(random()*999999))::int::text, 6, '0'), dests[dest_i], 'procesado', dn, 'Pedido e-commerce del cliente')
        RETURNING id INTO inv;
        INSERT INTO public.sales_order_lines(sales_order_id, item_id, external_sku, qty)
        SELECT inv, l.item_id, (SELECT code FROM public.items WHERE id = l.item_id), l.qty FROM public.dispatch_note_lines l WHERE l.dispatch_note_id = dn;
      END IF;
      cnt_d := cnt_d + 1;
    END LOOP;
  END LOOP;

  IF is_current THEN
    FOR it IN SELECT DISTINCT ON (party_id) * FROM _di ORDER BY party_id, code LOOP
      INSERT INTO public.sales_orders(entity_id, party_id, channel, external_order_id, destination_address, status, notes)
      VALUES (e, it.party_id, 'shopify', 'EXT-PEND-' || lpad((floor(random()*999999))::int::text, 6, '0'), dests[1 + floor(random()*array_length(dests,1))::int], 'pendiente', 'Pedido pendiente de convertir a guía')
      RETURNING id INTO inv;
      INSERT INTO public.sales_order_lines(sales_order_id, item_id, external_sku, qty) VALUES (inv, it.item_id, it.code, greatest(round(it.base*0.05),1));
    END LOOP;
  END IF;

  -- 3c. Monthly 3PL service invoices
  FOR c IN SELECT id, name FROM public.parties WHERE entity_id = e AND is_3pl_client ORDER BY name LOOP
    trips := 2 + floor(random()*3)::int;
    km := 300 + floor(random()*1500);
    lines := jsonb_build_array(
      jsonb_build_object('item',srv.alm,'desc','Almacenaje posiciones pallet ' || to_char(m,'MM/YYYY'),'qty',round((140 + random()*300)*f),'price',8500,'acc','4102'),
      jsonb_build_object('item',srv.pick,'desc','Picking y packing unidades despachadas','qty',round((5000 + random()*14000)*f),'price',180,'acc','4102'),
      jsonb_build_object('item',NULL,'desc','Cargo fijo administración de cuenta','qty',1,'price',150000,'acc','4102'),
      jsonb_build_object('item',srv.ftl,'desc','Transporte de despachos (' || km || ' km)','qty',km,'price',1450,'acc','4101'));
    PERFORM public.demo_sales_invoice(e, c.id, least((m + interval '1 month - 1 day')::date, m + last_day - 1), NULL, lines);
    cnt_s := cnt_s + 1;
  END LOOP;

  -- 4. Purchases
  FOR r IN SELECT * FROM (VALUES
     ('99.520.000-7','Combustible diésel flota',16000000,'5201',19),
     ('96.800.100-1','Peajes autopistas y pasos fronterizos',2800000,'5202',19),
     ('76.222.333-4','Fletes subcontratados zona sur y austral',12500000,'5203',19),
     ('76.444.555-6','Arriendo CD Pudahuel y bodegas regionales',7500000,'5204',19),
     ('96.800.570-7','Energía eléctrica cámaras de frío',2100000,'5207',19),
     ('96.500.600-2','Mantención preventiva y neumáticos flota',2600000,'5206',19),
     ('99.231.000-6','Seguro de carga y flota',1400000,'5208',0),
     ('96.806.980-2','Telefonía, GPS y datos móviles',450000,'5210',19)
   ) v(tax, descr, base, acc, taxr) LOOP
    SELECT id INTO inv FROM public.parties WHERE entity_id = e AND tax_id = r.tax;
    amt := round(r.base * (CASE WHEN r.acc IN ('5201','5202','5203') THEN f ELSE 1 END) * (0.93 + random()*0.14));
    PERFORM public.demo_purchase_invoice(e, inv, m + least(2 + floor(random()*20)::int, last_day - 1), r.descr,
      jsonb_build_array(jsonb_build_object('desc', r.descr || ' ' || to_char(m,'MM/YYYY'), 'qty', 1, 'price', amt, 'acc', r.acc, 'tax', r.taxr)));
    month_cost := month_cost + amt;
  END LOOP;

  IF extract(month FROM m)::int IN (2,5,8,11) THEN
    SELECT id INTO inv FROM public.parties WHERE entity_id = e AND tax_id = CASE WHEN extract(month FROM m)::int IN (2,8) THEN '55.555.001-1' ELSE '55.555.002-K' END;
    amt := round(9000000 + random()*6000000);
    PERFORM public.demo_purchase_invoice(e, inv, m + least(10, last_day - 1),
      CASE WHEN extract(month FROM m)::int IN (2,8) THEN 'Importación racks selectivos desde China (FOB Shenzhen)' ELSE 'Importación repuestos grúas horquilla desde China (FOB Ningbo)' END,
      jsonb_build_array(jsonb_build_object('desc','Mercadería importada - DIN ' || to_char(m,'YYYYMM'),'qty',1,'price',amt,'acc',CASE WHEN extract(month FROM m)::int IN (2,8) THEN '1503' ELSE '5206' END,'tax',0)));
    SELECT id INTO inv FROM public.parties WHERE entity_id = e AND tax_id = '78.901.234-5';
    PERFORM public.demo_purchase_invoice(e, inv, m + least(12, last_day - 1), 'Honorarios agencia de aduana y almacenaje portuario',
      jsonb_build_array(jsonb_build_object('desc','Servicios de desaduanamiento importación China','qty',1,'price',round(amt*0.035),'acc','5211','tax',19)));
  END IF;

  -- 5. Payroll
  payroll := round(29500000 + random()*1500000);
  d := least((m + interval '1 month - 1 day')::date, m + last_day - 1);
  PERFORM public.demo_post_je(e, d, 'Remuneraciones', 'Centralización remuneraciones ' || to_char(m,'MM/YYYY'), jsonb_build_array(
    jsonb_build_object('a',public.demo_acc(e,'5205'),'d',payroll,'m','Remuneraciones brutas 62 trabajadores'),
    jsonb_build_object('a',public.demo_acc(e,'2103'),'c',round(payroll*0.83),'m','Líquido a pagar'),
    jsonb_build_object('a',public.demo_acc(e,'2104'),'c',payroll - round(payroll*0.83),'m','AFP, salud y seguro cesantía')));
  IF NOT is_current THEN
    PERFORM public.demo_post_je(e, d, 'Pago Remuneraciones', 'Pago remuneraciones y leyes sociales ' || to_char(m,'MM/YYYY'), jsonb_build_array(
      jsonb_build_object('a',public.demo_acc(e,'2103'),'d',round(payroll*0.83),'m','Pago nómina'),
      jsonb_build_object('a',public.demo_acc(e,'2104'),'d',payroll - round(payroll*0.83),'m','Pago Previred'),
      jsonb_build_object('a',public.demo_acc(e,'1101'),'c',payroll,'m','Transferencias nómina y Previred')));
  END IF;
  month_cost := month_cost + payroll;

  -- 6. Foreign trade
  FOR c IN SELECT id, tax_id FROM public.parties WHERE entity_id = e AND tax_id IN ('77.210.330-1','76.880.412-5') LOOP
    INSERT INTO public.foreign_trade_operations(entity_id, party_id, operation_type, country_code, dus_number, booking_number, customs_status, notes, created_by)
    VALUES (e, c.id, 'importacion', 'CN', 'DIN-' || to_char(m,'YYYYMM') || lpad((floor(random()*9999))::int::text,4,'0'),
            (ARRAY['COSU','MSCU','EGLV','HLCU'])[1 + floor(random()*4)::int] || (1000000 + floor(random()*8999999))::int,
            (CASE WHEN is_current THEN 'tramitando' ELSE 'autorizado' END)::public.ft_customs_status,
            'Contenedor 40HC electrónica desde ' || (ARRAY['Shanghai','Shenzhen','Ningbo'])[1 + floor(random()*3)::int] || ', arribo puerto San Antonio / Arica', auth.uid());
  END LOOP;
  IF extract(month FROM m)::int % 2 = 0 THEN
    INSERT INTO public.foreign_trade_operations(entity_id, party_id, operation_type, country_code, dus_number, booking_number, customs_status, notes, created_by)
    SELECT e, id, 'exportacion', 'PE', 'DUS-' || to_char(m,'YYYYMM') || lpad((floor(random()*9999))::int::text,4,'0'), 'TER-' || (100000 + floor(random()*899999))::int,
           (CASE WHEN is_current THEN 'pendiente' ELSE 'autorizado' END)::public.ft_customs_status, 'Exportación terrestre de azúcar y harina a Tacna vía Chacalluta', auth.uid()
    FROM public.parties WHERE entity_id = e AND tax_id = '79.120.887-4';
  END IF;

  -- 7. Operational cost input
  INSERT INTO public.operational_cost_inputs(entity_id, period_start, period_end, total_cost, notes, created_by)
  VALUES (e, m, (m + interval '1 month - 1 day')::date, month_cost, 'Costos operacionales del mes (combustible, peajes, subcontratos, arriendos, energía, remuneraciones)', auth.uid());

  RETURN jsonb_build_object('month', m, 'sales_invoices', cnt_s, 'dispatch_notes', cnt_d);
END $$;

CREATE OR REPLACE FUNCTION public.delete_demo_data() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e uuid; t text; pass int; n bigint; total bigint := 0; failed int;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Solo administradores pueden eliminar los datos de ejemplo.'; END IF;
  SELECT id INTO e FROM public.entities WHERE code = 'DEMO-3PL';
  IF e IS NULL THEN RETURN jsonb_build_object('deleted', false, 'message', 'No hay datos de ejemplo cargados.'); END IF;

  UPDATE public.journal_entries SET status = 'reversed' WHERE entity_id = e AND status = 'posted';
  DELETE FROM public.stock_valuation_layers WHERE item_id IN (SELECT id FROM public.items WHERE entity_id = e) OR warehouse_id IN (SELECT id FROM public.warehouses WHERE entity_id = e);
  DELETE FROM public.journal_entry_lines WHERE journal_entry_id IN (SELECT id FROM public.journal_entries WHERE entity_id = e);
  DELETE FROM public.sales_invoice_lines WHERE sales_invoice_id IN (SELECT id FROM public.sales_invoices WHERE entity_id = e);
  DELETE FROM public.purchase_invoice_lines WHERE purchase_invoice_id IN (SELECT id FROM public.purchase_invoices WHERE entity_id = e);
  DELETE FROM public.route_stops WHERE route_id IN (SELECT id FROM public.routes WHERE entity_id = e);
  DELETE FROM public.sales_order_lines WHERE sales_order_id IN (SELECT id FROM public.sales_orders WHERE entity_id = e);
  DELETE FROM public.dispatch_note_lines WHERE dispatch_note_id IN (SELECT id FROM public.dispatch_notes WHERE entity_id = e);
  DELETE FROM public.service_rate_lines WHERE contract_id IN (SELECT id FROM public.service_contracts WHERE entity_id = e);
  DELETE FROM public.party_portal_users WHERE party_id IN (SELECT id FROM public.parties WHERE entity_id = e);
  DELETE FROM public.party_webhook_tokens WHERE party_id IN (SELECT id FROM public.parties WHERE entity_id = e);

  FOR pass IN 1..8 LOOP
    failed := 0;
    FOR t IN SELECT c.table_name FROM information_schema.columns c JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
             WHERE c.table_schema = 'public' AND c.column_name = 'entity_id' AND c.table_name <> 'entities' LOOP
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE entity_id = $1', t) USING e;
        GET DIAGNOSTICS n = ROW_COUNT; total := total + n;
      EXCEPTION WHEN foreign_key_violation THEN failed := failed + 1;
      END;
    END LOOP;
    EXIT WHEN failed = 0;
  END LOOP;
  IF failed > 0 THEN RAISE EXCEPTION 'No se pudieron eliminar todos los datos de ejemplo (% tablas con dependencias).', failed; END IF;

  DELETE FROM public.entities WHERE id = e;
  RETURN jsonb_build_object('deleted', true, 'rows', total);
END $$;

REVOKE ALL ON FUNCTION public.demo_acc(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.demo_wh_addr(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.demo_post_je(uuid, date, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.demo_sales_invoice(uuid, uuid, date, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.demo_purchase_invoice(uuid, uuid, date, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.seed_demo_base(date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.seed_demo_month(uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_demo_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_demo_base(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_demo_month(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_demo_data() TO authenticated;
