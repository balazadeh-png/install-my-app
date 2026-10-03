import { createFileRoute } from "@tanstack/react-router";
import { syncSiiDocumentsInternal } from "@/lib/sii-sync.functions";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function getAdminClient() {
  const SUPABASE_URL = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const SUPABASE_SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase admin configuration");
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function normalizeRut(rut: string): string {
  return (rut || "").replace(/[^0-9kK]/g, "").toUpperCase();
}

export const Route = createFileRoute("/api/webhooks/apipyme")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
    try {
      // 1. Validar Webhook Secret — obligatorio: si no está configurado en el
      // servidor, se rechaza la llamada (nunca se omite la verificación).
      const expectedSecret = process.env["APIPYME_WEBHOOK_SECRET"];

      if (!expectedSecret) {
        console.error("APIPYME_WEBHOOK_SECRET is not configured; rejecting webhook call");
        return new Response(JSON.stringify({ error: "Webhook not configured" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      const providedSecret = request.headers.get("X-Webhook-Secret") ?? "";

      const { createHmac, timingSafeEqual } = await import("crypto");
      const expectedDigest = createHmac("sha256", expectedSecret).update("webhook").digest();
      const providedDigest = createHmac("sha256", providedSecret).update("webhook").digest();

      if (!timingSafeEqual(expectedDigest, providedDigest)) {
        return new Response(JSON.stringify({ error: "Unauthorized webhook" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 2. Leer Payload: { event, module, rut, period, status, rows, task_id }
      const body = await request.json();
      const { module, rut, period, status, rows, task_id } = body;

      if (!task_id) {
        return new Response(JSON.stringify({ error: "Missing task_id" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const admin = getAdminClient();

      // 3. Buscar la empresa por entities.tax_id normalizado
      const cleanRut = normalizeRut(rut);
      const { data: entities } = await admin
        .from("entities")
        .select("id, tax_id");

      const matchedEntity = (entities ?? []).find(
        (e) => normalizeRut(e.tax_id || "") === cleanRut
      );

      const entity_id = matchedEntity?.id;

      // 4. Actualizar estado en sii_sync_jobs
      await admin.from("sii_sync_jobs").upsert(
        {
          entity_id: entity_id || "00000000-0000-0000-0000-000000000000",
          module: module || "ventas",
          period: period || "",
          apipyme_task_id: task_id,
          status: status === "SUCCESS" ? "SUCCESS" : status === "FAILED" ? "FAILED" : "RUNNING",
          rows_extracted: Number(rows || 0),
          completed_at: status === "SUCCESS" || status === "FAILED" ? new Date().toISOString() : null,
        },
        { onConflict: "apipyme_task_id" }
      );

      // 5. Si fue exitoso y encontramos la empresa, sincronizar los datos finales
      if (status === "SUCCESS" && entity_id && period) {
        const docType = module === "compras" ? "compra" : "venta";
        syncSiiDocumentsInternal(entity_id, docType, period).catch((err) => {
          console.error("Error executing background sync on webhook:", err);
        });
      }

      return new Response(
        JSON.stringify({ received: true, task_id, status }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (err: any) {
      console.error("Webhook processing error:", err);
      return new Response(
        JSON.stringify({ error: err.message || "Internal server error" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    },
    },
  },
});
