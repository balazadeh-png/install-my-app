import { createFileRoute } from "@tanstack/react-router";
import { Route as SiiBooksRoute } from "./sii-books";

export const Route = createFileRoute("/_authenticated/sii_books")({
  component: SiiBooksRoute.options.component,
  head: () => ({
    meta: [
      { title: "Libros Legales SII & RCV | EasyERP" },
      { name: "description", content: "Libro Diario, Mayor, Balance Tributario de 8 Columnas y Conciliación RCV para el SII." },
    ],
  }),
});
