import { createFileRoute } from "@tanstack/react-router";
import { processOmsOrderWebhook } from "@/lib/oms.functions";

export const Route = createFileRoute("/api/webhooks/oms")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = await request.json();
          const result = await processOmsOrderWebhook(body);
          return new Response(JSON.stringify(result.data), {
            status: result.status,
            headers: { "Content-Type": "application/json" },
          });
        } catch {
          return new Response(
            JSON.stringify({ error: "Cuerpo de solicitud JSON inválido" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
