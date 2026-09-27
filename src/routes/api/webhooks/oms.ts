import { createFileRoute } from "@tanstack/react-router";
import { ingestOmsOrderInternal } from "@/lib/oms.functions";

export const Route = createFileRoute("/api/webhooks/oms")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = await request.json();
          const { token, channel, external_order_id, destination_address, lines, notes } = body;

          if (!token || !external_order_id) {
            return new Response(
              JSON.stringify({ error: "Faltan campos obligatorios: token y external_order_id" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          if (!lines || !Array.isArray(lines) || lines.length === 0) {
            return new Response(
              JSON.stringify({ error: "Debe incluir el arreglo 'lines' con al menos un producto" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          const result = await ingestOmsOrderInternal({
            token,
            channel,
            external_order_id,
            destination_address,
            lines,
            notes,
          });

          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          console.error("Error processing OMS webhook:", err);
          return new Response(
            JSON.stringify({ error: err.message || "Internal server error" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
