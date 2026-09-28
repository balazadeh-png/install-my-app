import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ServiceBillingPreview {
  party_id: string;
  party_name: string;
  contract_id: string;
  billing_frequency: string;
  lines: Array<{
    rate_type: string;
    description: string;
    qty: number;
    unit_price: number;
    subtotal: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  already_invoiced: boolean;
  existing_invoice_id?: string;
}

const generateServiceInvoiceInputSchema = z.object({
  entity_id: z.string().uuid(),
  party_id: z.string().uuid(),
  period_start: z.string().min(10), // YYYY-MM-DD
  period_end: z.string().min(10),   // YYYY-MM-DD
});

export const generateServiceInvoiceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => generateServiceInvoiceInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { entity_id, party_id, period_start, period_end } = data;

    // 1. Obtener datos de la empresa y moneda
    const { data: entity, error: entityErr } = await supabase
      .from("entities")
      .select("id, name, base_currency_code")
      .eq("id", entity_id)
      .single();
    if (entityErr || !entity) throw new Error("Empresa no encontrada");

    // 2. Obtener cliente
    const { data: party, error: partyErr } = await supabase
      .from("parties")
      .select("id, name, tax_id")
      .eq("id", party_id)
      .single();
    if (partyErr || !party) throw new Error("Cliente 3PL no encontrado");

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
    const { data: existingInvoices } = await supabase
      .from("sales_invoices")
      .select("id, invoice_number, memo, status")
      .eq("entity_id", entity_id)
      .eq("party_id", party_id)
      .ilike("memo", `%${periodMemoKey}%`)
      .neq("status", "cancelled");

    if (existingInvoices && existingInvoices.length > 0) {
      const inv = existingInvoices[0];
      throw new Error(
        `Ya existe una factura registrada para el cliente "${party.name}" en el período ${period_start} a ${period_end} (${inv.invoice_number ? `Folio #${inv.invoice_number}` : `ID ${inv.id.slice(0, 8)}`}).`
      );
    }

    // 5. Medir consumos reales
    // 5.1 Almacenaje: Saldo actual en stock_balances para el cliente
    const { data: balances } = await supabase
      .from("stock_balances" as any)
      .select("balance, item_id")
      .eq("party_id", party_id);

    const totalCustodyUnits = (balances || []).reduce((acc: number, b: any) => acc + (Number(b.balance) || 0), 0);
    const estimatedPallets = totalCustodyUnits > 0 ? Math.max(1, Math.ceil(totalCustodyUnits / 50)) : 0;
    const estimatedM2 = totalCustodyUnits > 0 ? Math.max(1, Math.ceil(totalCustodyUnits / 25)) : 0;

    // 5.2 Picking: Cantidad en dispatch_note_lines con picked=true en el período
    const periodStartTime = `${period_start}T00:00:00.000Z`;
    const periodEndTime = `${period_end}T23:59:59.999Z`;

    const { data: dispatchesInPeriod } = await supabase
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

    let totalPickedUnits = 0;
    let totalKm = 0;

    for (const d of dispatchesInPeriod || []) {
      if (d.distance_km) totalKm += Number(d.distance_km);
      for (const l of (d as any).dispatch_note_lines || []) {
        if (l.picked) totalPickedUnits += Number(l.qty) || 0;
      }
    }

    // 6. Construir líneas de la factura
    const invoiceLinesToInsert: Array<{
      description: string;
      qty: number;
      unit_price: number;
      tax_rate: number;
      line_total: number;
    }> = [];

    for (const rate of rateLines) {
      const price = Number(rate.unit_price) || 0;
      if (price <= 0) continue;

      if (rate.rate_type === "storage_pallet") {
        if (estimatedPallets > 0) {
          const total = estimatedPallets * price;
          invoiceLinesToInsert.push({
            description: rate.description || `Almacenaje mensual en custodia (${estimatedPallets} pallets x $${price.toLocaleString("es-CL")})`,
            qty: estimatedPallets,
            unit_price: price,
            tax_rate: 19,
            line_total: total,
          });
        }
      } else if (rate.rate_type === "storage_m2") {
        if (estimatedM2 > 0) {
          const total = estimatedM2 * price;
          invoiceLinesToInsert.push({
            description: rate.description || `Almacenaje por superficie (${estimatedM2} m² x $${price.toLocaleString("es-CL")})`,
            qty: estimatedM2,
            unit_price: price,
            tax_rate: 19,
            line_total: total,
          });
        }
      } else if (rate.rate_type === "picking_unit") {
        if (totalPickedUnits > 0) {
          const total = totalPickedUnits * price;
          invoiceLinesToInsert.push({
            description: rate.description || `Servicio de Picking WMS (${totalPickedUnits} unidades x $${price.toLocaleString("es-CL")})`,
            qty: totalPickedUnits,
            unit_price: price,
            tax_rate: 19,
            line_total: total,
          });
        }
      } else if (rate.rate_type === "transport_km") {
        if (totalKm > 0) {
          const total = Math.round(totalKm * price);
          invoiceLinesToInsert.push({
            description: rate.description || `Transporte y Distribución TMS (${totalKm} km x $${price.toLocaleString("es-CL")})`,
            qty: totalKm,
            unit_price: price,
            tax_rate: 19,
            line_total: total,
          });
        }
      } else if (rate.rate_type === "recargo_fijo") {
        invoiceLinesToInsert.push({
          description: rate.description || "Recargo operacional fijo pactado en contrato",
          qty: 1,
          unit_price: price,
          tax_rate: 19,
          line_total: price,
        });
      }
    }

    if (!invoiceLinesToInsert.length) {
      throw new Error(
        `No se registró consumo ni tarifas aplicables para "${party.name}" en el período ${period_start} al ${period_end}.`
      );
    }

    // 7. Calcular totales
    const subtotal = invoiceLinesToInsert.reduce((sum, l) => sum + l.line_total, 0);
    const tax = Math.round(subtotal * 0.19);
    const grandTotal = subtotal + tax;

    const todayStr = new Date().toISOString().split("T")[0];
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    const dueDateStr = dueDate.toISOString().split("T")[0];

    // 8. Crear factura en sales_invoices
    const { data: newInvoice, error: invError } = await supabase
      .from("sales_invoices")
      .insert({
        entity_id,
        party_id,
        currency_code: entity.base_currency_code || "CLP",
        exchange_rate: 1.0,
        issue_date: todayStr,
        due_date: dueDateStr,
        subtotal_amount: subtotal,
        tax_amount: tax,
        total_amount: grandTotal,
        memo: periodMemoKey,
        status: "draft",
      })
      .select("id, memo, total_amount, status")
      .single();

    if (invError) throw new Error(invError.message);

    // 9. Crear líneas en sales_invoice_lines
    const linesToInsert = invoiceLinesToInsert.map((l) => ({
      sales_invoice_id: newInvoice.id,
      description: l.description,
      qty: l.qty,
      unit_price: l.unit_price,
      tax_rate: l.tax_rate,
      line_total: l.line_total,
    }));

    const { error: linesError } = await supabase
      .from("sales_invoice_lines" as any)
      .insert(linesToInsert);

    if (linesError) throw new Error(linesError.message);

    return {
      success: true,
      invoice_id: newInvoice.id,
      party_name: party.name,
      subtotal,
      tax,
      total: grandTotal,
      lines_count: invoiceLinesToInsert.length,
      memo: newInvoice.memo,
    };
  });
