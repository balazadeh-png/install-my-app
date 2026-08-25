import { createFileRoute } from "@tanstack/react-router";
import { Route as DeclaracionesRoute } from "./declaraciones-juradas";

export const Route = createFileRoute("/_authenticated/declaraciones_juradas")({
  component: DeclaracionesRoute.options.component,
  head: () => ({
    meta: [
      { title: "Declaraciones Juradas SII | EasyERP" },
      { name: "description", content: "Motor configurable de Declaraciones Juradas del SII (DJ 1879, 1887, 1947)." },
    ],
  }),
});
