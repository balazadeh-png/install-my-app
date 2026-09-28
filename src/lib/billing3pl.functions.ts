import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ServiceBillingLinePreview {
  rate_type: string;
  description: string;
  qty: number;
  unit_price: number;
  tax_rate: number;
  subtotal: number;
  is_manual?: boolean;
  warehouse_name?: string;
}

export interface WarehouseStorageUsage {
  warehouse_id: string;
  warehouse_name: string;
  method: string;
  basis: string;
  quantity: number | null;
  unit: string;
  rate_type: string | null;
  missing_data: number;
}

export interface ServiceBillingPreview {
  success: boolean;
  party_id: string;
  party_name: string;
  contract_id: string;
  billing_frequency: string;
  lines: ServiceBillingLinePreview[];
  subtotal: number;
  tax: number;
  total: number;
  already_invoiced: boolean;
  existing_invoice_id?: string;
  existing_invoice_number?: string;
  missing_inputs: string[];
  missing_data_warnings: string[];
  incompatible_warnings: string[];
  warehouses_usage: WarehouseStorageUsage[];
}

const storageQuantitiesSchema = z
  .object({
    storage_pallet: z.number().min(0).optional(),
    storage_m2: z.number().min(0).optional(),
    storage_m3: z.number().min(0).optional(),
    storage_unit: z.number().min(0).optional(),
  })
  .optional();

const billingInputSchema = z.object({
  entity_id: z.string().uuid(),
  party_id: z.string().uuid(),
  period_start: z.string().min(10), // YYYY-MM-DD
  period_end: z.string().min(10),   // YYYY-MM-DD
  storage_quantities: storageQuantitiesSchema,
});

/**
 * Función interna de cálculo de facturación 3PL
 * Respeta mediciones por bodega (Sprint 30), elimina factores inventados (Sprint 29)
 * y revisa errores en cada consulta sin descartar excepciones.
 */
async function calculateServiceBillingInternal(
  supabase: any,
  data: z.infer<typeof billingInputSchema>
): Promise<ServiceBillingPreview> {
  const { entity_id, party_id, period_start, period_end, storage_quantities } = data;

  // 1. Obtener datos de la empresa y moneda
  const { data: entity, error: entityErr } = await supabase
    .from("entities")
    .select("id, name, base_currency_code")
    .eq("id", entity_id)
    .single();
  if (entityErr || !entity) {
    throw new Error(entityErr?.message || "Empresa activa no encontrada");
  }

  // 2. Obtener cliente 3PL
  const { data: party, error: partyErr } = await supabase
    .from("parties")
    .select("id, name, tax_id")
    .eq("id", party_id)
    .single();
  if (partyErr || !party) {
    throw new Error(partyErr?.message || "Cliente 3PL no encontrado");
  }

  // 3. Obtener contrato activo y tarifario
  const { data: contract, error: contractErr } = await supabase
    .from("service_contracts")
    .select(`
      id,
      entity_id,
      party_id,
      billing_frequency,
      active,
      service_rate_lines(id, rate_type, unit_price, description)
    `)
    .eq("entity_id", entity_id)
    .eq("party_id", party_id)
    .eq("active", true)
    .maybeSingle();

  if (contractErr) throw new Error(contractErr.message);
  if (!contract) {
    throw new Error(`El cliente "${party.name}" no tiene un contrato 3PL activo configurado.`);
  }

  const rateLines = contract.service_rate_lines || [];
  if (!rateLines.length) {
    throw new Error(`El contrato del cliente "${party.name}" no tiene tarifas definidas.`);
  }

  // 4. Prevenir duplicados (mismo cliente y mismo período en memo)
  const periodMemoKey = `Servicios 3PL [${period_start} al ${period_end}]`;
  const { data: existingInvoices, error: existingErr } = await supabase
    .from("sales_invoices")
    .select("id, invoice_number, memo, status")
    .eq("entity_id", entity_id)
    .eq("party_id", party_id)
    .ilike("memo", `%${periodMemoKey}%`)
    .neq("status", "cancelled");

  if (existingErr) throw new Error(existingErr.message);

  const alreadyInvoiced = Boolean(existingInvoices && existingInvoices.length > 0);
  const existingInv = alreadyInvoiced ? existingInvoices![0] : null;

  // 5. Medir consumos reales
  // 5.1 Almacenaje: Invocar get_storage_usage (Sprint 30)
  // Reemplaza por completo lecturas directas a stock_balances y factores inventados
  const { data: storageUsageRaw, error: storageErr } = await supabase.rpc(
    "get_storage_usage",
    {
      p_entity_id: entity_id,
      p_party_id: party_id,
      p_period_start: period_start,
      p_period_end: period_end,
    }
  );

  if (storageErr) throw new Error(storageErr.message);

  const warehousesUsage: WarehouseStorageUsage[] = (storageUsageRaw ?? []).map((w: any) => ({
    warehouse_id: w.warehouse_id,
    warehouse_name: w.warehouse_name,
    method: w.method,
    basis: w.basis,
    quantity: w.quantity !== null && w.quantity !== undefined ? Number(w.quantity) : null,
    unit: w.unit,
    rate_type: w.rate_type,
    missing_data: Number(w.missing_data) || 0,
  }));

  // 5.2 Picking y Transporte: Cantidades reales en guías de despacho (dispatch_notes)
  const periodStartTime = `${period_start}T00:00:00.000Z`;
  const periodEndTime = `${period_end}T23:59:59.999Z`;

  const { data: dispatchesInPeriod, error: dispatchesErr } = await supabase
    .from("dispatch_notes")
    .select(`
      id,
      distance_km,
      departure_at,
      dispatch_note_lines(qty, picked)
    `)
    .eq("entity_id", entity_id)
    .eq("party_id", party_id)
    .gte("departure_at", periodStartTime)
    .lte("departure_at", periodEndTime);

  if (dispatchesErr) throw new Error(dispatchesErr.message);

  let totalPickedUnits = 0;
  let totalKm = 0;

  for (const d of dispatchesInPeriod || []) {
    if (d.distance_km) totalKm += Number(d.distance_km);
    for (const l of (d as any).dispatch_note_lines || []) {
      if (l.picked) totalPickedUnits += Number(l.qty) || 0;
    }
  }

  // 6. Construir líneas de cobro y validar insumos
  const invoiceLines: ServiceBillingLinePreview[] = [];
  const missingInputs: string[] = [];
  const missingDataWarnings: string[] = [];
  const incompatibleWarnings: string[] = [];

  const STORAGE_RATE_TYPES = ["storage_pallet", "storage_m2", "storage_m3", "storage_unit"] as const;
  type StorageRateType = typeof STORAGE_RATE_TYPES[number];

  const BASIS_LABELS: Record<string, string> = {
    period_end: "saldo al cierre",
    daily_average: "promedio diario",
    daily_peak: "máximo diario",
  };

  const UNIT_NAMES: Record<StorageRateType, string> = {
    storage_pallet: "pallets",
    storage_m2: "m²",
    storage_m3: "m³",
    storage_unit: "unidades",
  };

  for (const rate of rateLines) {
    const price = Number(rate.unit_price) || 0;
    if (price <= 0) continue;

    if (STORAGE_RATE_TYPES.includes(rate.rate_type as StorageRateType)) {
      const targetRateType = rate.rate_type as StorageRateType;
      const unitName = UNIT_NAMES[targetRateType];

      // Revisar si hay bodegas con missing_data > 0
      for (const wh of warehousesUsage) {
        if (wh.missing_data > 0 && wh.rate_type === targetRateType) {
          missingDataWarnings.push(
            `Bodega ${wh.warehouse_name}: faltan datos de medición (${wh.missing_data} registro(s) sin ubicación o sin atributos volumétricos).`
          );
        }
      }

      // Buscar bodegas automáticas que coincidan con la unidad del tarifario
      const matchingAutoWarehouses = warehousesUsage.filter(
        (wh) => wh.method !== "manual" && wh.rate_type === targetRateType
      );

      // Buscar bodegas con método manual
      const hasManualWarehouse = warehousesUsage.some((wh) => wh.method === "manual") || warehousesUsage.length === 0;

      let lineGeneratedForRate = false;

      // 1. Generar líneas para bodegas automáticas
      for (const wh of matchingAutoWarehouses) {
        const qty = wh.quantity ?? 0;
        if (qty > 0) {
          const subtotal = Math.round(qty * price);
          const basisText = BASIS_LABELS[wh.basis] || wh.basis;
          invoiceLines.push({
            rate_type: targetRateType,
            description:
              rate.description ||
              `Almacenaje — ${wh.warehouse_name} — ${qty.toLocaleString("es-CL")} ${wh.unit} (${basisText})`,
            qty,
            unit_price: price,
            tax_rate: 19,
            subtotal,
            is_manual: false,
            warehouse_name: wh.warehouse_name,
          });
          lineGeneratedForRate = true;
        }
      }

      // 2. Si no hay bodega automática o hay bodegas en 'manual', aplicar ingreso manual
      if (hasManualWarehouse && matchingAutoWarehouses.length === 0) {
        const manualQty = storage_quantities?.[targetRateType];
        if (manualQty !== undefined && manualQty !== null) {
          if (manualQty > 0) {
            const subtotal = Math.round(manualQty * price);
            invoiceLines.push({
              rate_type: targetRateType,
              description:
                rate.description ||
                `Almacenaje — ${manualQty.toLocaleString("es-CL")} ${unitName} (cantidad ingresada manualmente)`,
              qty: manualQty,
              unit_price: price,
              tax_rate: 19,
              subtotal,
              is_manual: true,
            });
            lineGeneratedForRate = true;
          }
        } else {
          // Falta el insumo manual obligatorio
          missingInputs.push(targetRateType);
        }
      }

      // 3. Advertencia si no existe ninguna bodega compatible
      if (!lineGeneratedForRate && !hasManualWarehouse && matchingAutoWarehouses.length === 0) {
        incompatibleWarnings.push(
          `Tarifa "${targetRateType}" configurada en contrato sin bodega asociada que entregue medición compatible.`
        );
      }
    } else if (rate.rate_type === "picking_unit") {
      if (totalPickedUnits > 0) {
        const subtotal = Math.round(totalPickedUnits * price);
        invoiceLines.push({
          rate_type: "picking_unit",
          description:
            rate.description ||
            `Servicio de Picking WMS (${totalPickedUnits.toLocaleString("es-CL")} unidades x $${price.toLocaleString("es-CL")})`,
          qty: totalPickedUnits,
          unit_price: price,
          tax_rate: 19,
          subtotal,
        });
      }
    } else if (rate.rate_type === "transport_km") {
      if (totalKm > 0) {
        const subtotal = Math.round(totalKm * price);
        invoiceLines.push({
          rate_type: "transport_km",
          description:
            rate.description ||
            `Transporte y Distribución TMS (${totalKm.toLocaleString("es-CL")} km x $${price.toLocaleString("es-CL")})`,
          qty: totalKm,
          unit_price: price,
          tax_rate: 19,
          subtotal,
        });
      }
    } else if (rate.rate_type === "recargo_fijo") {
      invoiceLines.push({
        rate_type: "recargo_fijo",
        description: rate.description || "Recargo operacional fijo pactado en contrato",
        qty: 1,
        unit_price: price,
        tax_rate: 19,
        subtotal: price,
      });
    }
  }

  // 7. Calcular totales
  const subtotal = invoiceLines.reduce((sum, l) => sum + l.subtotal, 0);
  const tax = Math.round(subtotal * 0.19);
  const total = subtotal + tax;

  return {
    success: true,
    party_id,
    party_name: party.name,
    contract_id: contract.id,
    billing_frequency: contract.billing_frequency,
    lines: invoiceLines,
    subtotal,
    tax,
    total,
    already_invoiced: alreadyInvoiced,
    existing_invoice_id: existingInv?.id,
    existing_invoice_number: existingInv?.invoice_number || undefined,
    missing_inputs: missingInputs,
    missing_data_warnings: missingDataWarnings,
    incompatible_warnings: incompatibleWarnings,
    warehouses_usage: warehousesUsage,
  };
}

/**
 * Endpoint de Vista Previa de Facturación 3PL
 * Permite a la interfaz consultar consumos calculados por bodega y detectar
 * campos manuales o inconsistencias de datos antes de generar la factura.
 */
export const previewServiceBillingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => billingInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    return await calculateServiceBillingInternal(context.supabase, data);
  });

/**
 * Endpoint de Generación Definitiva de Factura 3PL
 * Rechaza la creación si faltan insumos obligatorios o si existen inconsistencias
 * de medición no resueltas.
 */
export const generateServiceInvoiceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => billingInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { entity_id, party_id, period_start, period_end } = data;

    const preview = await calculateServiceBillingInternal(supabase, data);

    // Validar bloqueos
    if (preview.already_invoiced) {
      throw new Error(
        `Ya existe una factura registrada para el cliente "${preview.party_name}" en el período ${period_start} a ${period_end} (${preview.existing_invoice_number ? `Folio #${preview.existing_invoice_number}` : `ID ${preview.existing_invoice_id?.slice(0, 8)}`}).`
      );
    }

    if (preview.missing_data_warnings.length > 0) {
      throw new Error(preview.missing_data_warnings[0]);
    }

    if (preview.missing_inputs.length > 0) {
      const typeNames = preview.missing_inputs
        .map((t) => (t === "storage_pallet" ? "pallets" : t === "storage_m2" ? "m²" : t === "storage_m3" ? "m³" : "unidades"))
        .join(", ");
      throw new Error(`Ingresa la cantidad almacenada de ${typeNames} del período.`);
    }

    if (!preview.lines.length) {
      throw new Error(
        `No se registró consumo ni tarifas aplicables para "${preview.party_name}" en el período ${period_start} al ${period_end}.`
      );
    }

    // Obtener moneda base de la empresa
    const { data: entity, error: entityErr } = await supabase
      .from("entities")
      .select("base_currency_code")
      .eq("id", entity_id)
      .single();
    if (entityErr || !entity) throw new Error(entityErr?.message || "Empresa no encontrada");

    const periodMemoKey = `Servicios 3PL [${period_start} al ${period_end}]`;
    const todayStr = new Date().toISOString().split("T")[0];
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    const dueDateStr = dueDate.toISOString().split("T")[0];

    // Insertar factura borrador
    const { data: newInvoice, error: invError } = await supabase
      .from("sales_invoices")
      .insert({
        entity_id,
        party_id,
        currency_code: entity.base_currency_code || "CLP",
        exchange_rate: 1.0,
        issue_date: todayStr,
        due_date: dueDateStr,
        subtotal_amount: preview.subtotal,
        tax_amount: preview.tax,
        total_amount: preview.total,
        memo: periodMemoKey,
        status: "draft",
      })
      .select("id, memo, total_amount, status, invoice_number")
      .single();

    if (invError) throw new Error(invError.message);

    // Insertar líneas de la factura
    const linesToInsert = preview.lines.map((l) => ({
      sales_invoice_id: newInvoice.id,
      description: l.description,
      qty: l.qty,
      unit_price: l.unit_price,
      tax_rate: l.tax_rate,
      line_total: l.subtotal,
    }));

    const { error: linesError } = await supabase
      .from("sales_invoice_lines" as any)
      .insert(linesToInsert);

    if (linesError) throw new Error(linesError.message);

    return {
      success: true,
      invoice_id: newInvoice.id,
      invoice_number: newInvoice.invoice_number,
      party_name: preview.party_name,
      subtotal: preview.subtotal,
      tax: preview.tax,
      total: preview.total,
      lines_count: preview.lines.length,
      memo: newInvoice.memo,
    };
  });
