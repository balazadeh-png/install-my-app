import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * ============================================================================
 * OMS: Webhook de Ingestión de Pedidos Multicanal (Sprint 23 / 29)
 * ============================================================================
 * 
 * Reglas de endurecimiento (Sprint 29):
 * 1. Una sola vía: RPC pública ingest_oms_order autenticada con cliente anon.
 * 2. Validación estricta con Zod.
 * 3. Token con hash SHA-256 (código 28000 -> 401).
 * 4. Validación de payload atómica (código 22023 -> 400).
 * 5. Reintentos de órdenes procesadas devuelven 200 con { ignored: true }.
 * 6. Cualquier falla no controlada devuelve 500 con mensaje genérico.
 * ============================================================================
 */

export const omsOrderLineSchema = z.object({
  external_sku: z.string().trim().min(1, "Cada línea requiere sku"),
  qty: z.number().positive("La cantidad (qty) debe ser mayor a 0"),
});

export const omsOrderInputSchema = z.object({
  token: z.string().trim().min(1, "El token de integración es obligatorio"),
  channel: z.string().trim().optional().default("webhook"),
  external_order_id: z.string().trim().min(1, "external_order_id es obligatorio"),
  destination_address: z.string().trim().optional().default(""),
  lines: z.array(omsOrderLineSchema).min(1, "El pedido debe incluir al menos una línea"),
  notes: z.string().trim().optional(),
});

export type IngestOmsOrderInput = z.infer<typeof omsOrderInputSchema>;

function getAnonSupabaseClient() {
  const SUPABASE_URL = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const SUPABASE_ANON_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Configuración del servidor incompleta (SUPABASE_URL o ANON_KEY no configurados).");
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface OmsIngestResult {
  status: number;
  data: {
    success?: boolean;
    ignored?: boolean;
    order_id?: string;
    party_id?: string;
    channel?: string;
    external_order_id?: string;
    status?: string;
    error?: string;
  };
}

export async function processOmsOrderWebhook(rawBody: unknown): Promise<OmsIngestResult> {
  // 1. Validar body con zod
  const parseResult = omsOrderInputSchema.safeParse(rawBody);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(", ");
    return {
      status: 400,
      data: { error: errorMsg },
    };
  }

  const { token, channel, external_order_id, destination_address, lines, notes } = parseResult.data;

  try {
    const client = getAnonSupabaseClient();
    const { data: rpcRes, error: rpcErr } = await client.rpc("ingest_oms_order", {
      p_token: token,
      p_channel: channel,
      p_external_order_id: external_order_id,
      p_destination_address: destination_address,
      p_lines: lines as any,
      p_notes: notes || undefined,
    });

    if (rpcErr) {
      if (rpcErr.code === "28000" || rpcErr.message?.toLowerCase().includes("token")) {
        return {
          status: 401,
          data: { error: "Token de integración inválido o inactivo" },
        };
      }
      if (rpcErr.code === "22023" || rpcErr.message?.includes("obligatorio") || rpcErr.message?.includes("línea")) {
        return {
          status: 400,
          data: { error: rpcErr.message },
        };
      }
      console.error("Internal OMS RPC Error:", rpcErr);
      return {
        status: 500,
        data: { error: "Error interno del servidor al procesar el pedido" },
      };
    }

    return {
      status: 200,
      data: rpcRes as any,
    };
  } catch (err: any) {
    console.error("Unexpected OMS webhook exception:", err);
    return {
      status: 500,
      data: { error: "Error interno del servidor al procesar el pedido" },
    };
  }
}

export const ingestOmsOrderFn = createServerFn({ method: "POST" })
  .inputValidator((data) => omsOrderInputSchema.parse(data))
  .handler(async ({ data }) => {
    const res = await processOmsOrderWebhook(data);
    if (res.status >= 400) {
      return { success: false, error: res.data.error };
    }
    return { success: true, ...res.data };
  });
