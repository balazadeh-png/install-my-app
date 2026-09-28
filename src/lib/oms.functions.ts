import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * ============================================================================
 * OMS: Webhook de Ingestión de Pedidos Multicanal
 * ============================================================================
 * 
 * Este server function permite recibir pedidos de venta desde canales externos
 * (Shopify, VTEX, Mercado Libre, ERPs de clientes 3PL, etc.) autenticado
 * exclusivamente mediante el token de cliente registrado en `party_webhook_tokens`.
 * 
 * Formato esperado en el POST:
 * {
 *   "token": "tok_3pl_...",
 *   "channel": "shopify" | "vtex" | "mercadolibre" | "manual" | "csv" | string,
 *   "external_order_id": "#10492",
 *   "destination_address": "Av. Providencia 1234, Depto 402, Santiago",
 *   "lines": [
 *     { "external_sku": "SKU-PROD-01", "qty": 2 },
 *     { "external_sku": "SKU-PROD-02", "qty": 5 }
 *   ],
 *   "notes": "Entregar entre 9:00 y 14:00 hrs"
 * }
 * 
 * Endpoint disponible:
 * - Directo HTTP API: POST /api/webhooks/oms
 * - TanStack Server Function: ingestOmsOrderFn
 * ============================================================================
 */

function getAdminClient() {
  const SUPABASE_URL = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const SUPABASE_SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const SUPABASE_ANON_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
    throw new Error("Configuración del servidor incompleta (service role o anon key no disponible).");
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface IngestOmsOrderInput {
  token: string;
  channel?: string;
  external_order_id: string;
  destination_address?: string;
  lines: Array<{
    external_sku: string;
    qty: number;
  }>;
  notes?: string;
}

export const ingestOmsOrderInternal = async (input: IngestOmsOrderInput) => {
  const admin = getAdminClient();

  // Validar token y obtener party y entity
  const { data: tokenData, error: tokenError } = await admin
    .from("party_webhook_tokens")
    .select("id, party_id, is_active, parties(id, entity_id)")
    .eq("token", input.token.trim())
    .single();

  if (tokenError || !tokenData || !tokenData.is_active) {
    throw new Error("Token de integración inválido o inactivo.");
  }

  const partyId = tokenData.party_id;
  const entityId = (tokenData.parties as any)?.entity_id;

  if (!partyId || !entityId) {
    throw new Error("No se pudo determinar el cliente o empresa asociada al token.");
  }

  const channel = (input.channel || "webhook").trim();
  const externalOrderId = input.external_order_id.trim();
  const destinationAddress = (input.destination_address || "").trim();
  const notes = (input.notes || "").trim() || null;

  // Ejecutar vía RPC ingest_oms_order si está disponible, o hacer upsert directo
  try {
    const { data: rpcRes, error: rpcErr } = await admin.rpc("ingest_oms_order", {
      p_token: input.token.trim(),
      p_channel: channel,
      p_external_order_id: externalOrderId,
      p_destination_address: destinationAddress,
      p_lines: input.lines as any,
      ...(notes ? { p_notes: notes } : {}),
    });

    if (!rpcErr && rpcRes) {
      return rpcRes;
    }
  } catch (err) {
    console.warn("RPC ingest_oms_order fallback to direct upsert:", err);
  }

  // Fallback directo si RPC no estuviese compilado en la instancia local
  // Upsert en sales_orders
  const { data: existingOrder } = await admin
    .from("sales_orders")
    .select("id, status")
    .eq("party_id", partyId)
    .eq("channel", channel)
    .eq("external_order_id", externalOrderId)
    .maybeSingle();

  let orderId = existingOrder?.id;

  if (orderId) {
    await admin
      .from("sales_orders")
      .update({
        destination_address: destinationAddress,
        notes: notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);
  } else {
    const { data: inserted, error: insErr } = await admin
      .from("sales_orders")
      .insert({
        entity_id: entityId,
        party_id: partyId,
        channel,
        external_order_id: externalOrderId,
        destination_address: destinationAddress,
        status: "pendiente",
        notes,
      })
      .select("id")
      .single();

    if (insErr) throw insErr;
    orderId = inserted.id;
  }

  // Reemplazar líneas
  await admin.from("sales_order_lines").delete().eq("sales_order_id", orderId);

  if (input.lines && input.lines.length > 0) {
    // Buscar matching de items por code o name
    const { data: items } = await admin
      .from("items")
      .select("id, code, name")
      .eq("entity_id", entityId);

    const linesToInsert = input.lines.map((l) => {
      const sku = (l.external_sku || "").trim();
      const matchedItem = (items || []).find(
        (it) => it.code?.toLowerCase() === sku.toLowerCase() || it.name?.toLowerCase() === sku.toLowerCase()
      );
      return {
        sales_order_id: orderId!,
        item_id: matchedItem?.id || null,
        external_sku: sku,
        qty: Number(l.qty) || 1,
      };
    });

    await admin.from("sales_order_lines").insert(linesToInsert);
  }

  return {
    success: true,
    order_id: orderId,
    party_id: partyId,
    channel,
    external_order_id: externalOrderId,
    status: "pendiente",
  };
};

export const ingestOmsOrderFn = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        token: z.string().min(1, "El token de integración es obligatorio"),
        channel: z.string().optional().default("webhook"),
        external_order_id: z.string().min(1, "El ID externo del pedido es obligatorio"),
        destination_address: z.string().optional().default(""),
        lines: z.array(
          z.object({
            external_sku: z.string(),
            qty: z.number().positive("La cantidad debe ser mayor a 0"),
          })
        ).min(1, "Debe incluir al menos una línea de producto"),
        notes: z.string().optional(),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    try {
      const res = await ingestOmsOrderInternal(data as IngestOmsOrderInput);
      return { success: true, ...(res as object) };
    } catch (err: any) {
      console.error("Error in ingestOmsOrderFn:", err);
      return { success: false, error: err.message || "Error procesando el pedido OMS" };
    }
  });
