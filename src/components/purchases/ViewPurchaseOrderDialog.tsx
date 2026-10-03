import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShoppingCart, Printer, Building2, Calendar, FileText, Loader2, CheckCircle, Clock, XCircle } from "lucide-react";

interface ViewPurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrderId: string | null;
}

export function ViewPurchaseOrderDialog({
  open,
  onOpenChange,
  purchaseOrderId,
}: ViewPurchaseOrderDialogProps) {
  const poQuery = useQuery({
    queryKey: ["purchase_order_detail", purchaseOrderId],
    enabled: !!purchaseOrderId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          parties(name, tax_id, commercial_name),
          warehouses(code, name),
          cost_centers(code, name),
          purchase_order_lines(
            id,
            description,
            item_type,
            qty,
            unit_price,
            tax_rate,
            line_total,
            catalog_item_id,
            supplier_catalog_items(supplier_sku, name)
          )
        `)
        .eq("id", purchaseOrderId!)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const po = poQuery.data;
  const lines = (po?.purchase_order_lines as any[]) ?? [];

  function getStatusBadge(status: string) {
    switch (status) {
      case "confirmed":
        return (
          <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
            <CheckCircle className="h-3 w-3" />
            <span>Confirmada</span>
          </Badge>
        );
      case "sent":
        return (
          <Badge className="bg-blue-600 text-white text-[10px] gap-1">
            <Clock className="h-3 w-3" />
            <span>Enviada al Proveedor</span>
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="destructive" className="text-[10px] gap-1">
            <XCircle className="h-3 w-3" />
            <span>Anulada</span>
          </Badge>
        );
      case "closed":
        return (
          <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-700">
            Cerrada
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-[10px]">
            Borrador
          </Badge>
        );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto print:max-w-full">
        {poQuery.isLoading ? (
          <div className="py-16 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Cargando detalle de la orden de compra...
          </div>
        ) : !po ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No se encontró la orden de compra solicitada.
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Encabezado Principal */}
            <div className="flex justify-between items-start border-b pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <ShoppingCart className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold font-mono tracking-tight text-foreground">
                      {po.po_number}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Emisión: {po.issue_date} · Entrega esperada: {po.expected_date || "No definida"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-right space-y-1">
                <div>{getStatusBadge(po.status)}</div>
                <div className="text-xs font-mono font-bold text-primary">
                  $ {Number(po.total_amount).toLocaleString("es-CL")} {po.currency_code}
                </div>
              </div>
            </div>

            {/* Cuadrícula Proveedor y Destino */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-muted/20 p-4 rounded-xl border">
              <div className="space-y-1">
                <span className="text-muted-foreground font-semibold uppercase text-[10px]">
                  Proveedor Destinatario:
                </span>
                <div className="font-bold text-sm text-foreground">{po.parties?.name}</div>
                <div className="text-muted-foreground font-mono">
                  RUT: {po.parties?.tax_id || "Sin RUT"}
                </div>
                {po.parties?.commercial_name && (
                  <div className="text-[11px] text-muted-foreground italic">
                    {po.parties.commercial_name}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground font-semibold uppercase text-[10px]">
                  Datos de Recepción:
                </span>
                <div>
                  <span className="font-semibold">Bodega:</span>{" "}
                  {po.warehouses ? `${po.warehouses.code} — ${po.warehouses.name}` : "Central / No asignada"}
                </div>
                {po.cost_centers && (
                  <div>
                    <span className="font-semibold">Centro Costo:</span>{" "}
                    {po.cost_centers.code} — {po.cost_centers.name}
                  </div>
                )}
                <div>
                  <span className="font-semibold">Moneda:</span> {po.currency_code}{" "}
                  {po.currency_code !== "CLP" && `(T.C. $${po.exchange_rate})`}
                </div>
              </div>
            </div>

            {/* Tabla de Líneas */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Líneas de la Orden ({lines.length})
              </h4>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-muted/30">
                      <TableHead className="w-[120px]">SKU Catálogo</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="w-[70px]">Tipo</TableHead>
                      <TableHead className="w-[80px] text-right">Cantidad</TableHead>
                      <TableHead className="w-[110px] text-right">Precio Unit.</TableHead>
                      <TableHead className="w-[70px] text-right">IVA %</TableHead>
                      <TableHead className="w-[110px] text-right">Total Línea</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l: any) => (
                      <TableRow key={l.id} className="text-xs">
                        <TableCell className="font-mono text-primary font-medium">
                          {l.supplier_catalog_items?.supplier_sku || "—"}
                        </TableCell>
                        <TableCell className="font-medium">{l.description}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] capitalize ${
                              l.item_type === "servicio"
                                ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
                                : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30"
                            }`}
                          >
                            {l.item_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {Number(l.qty).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          $ {Number(l.unit_price).toLocaleString("es-CL")}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {l.tax_rate}%
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          $ {Number(l.line_total).toLocaleString("es-CL")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Observaciones y Totales */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-xs space-y-1">
                <span className="font-semibold uppercase text-[10px] text-muted-foreground block">
                  Observaciones Comerciales & Despacho:
                </span>
                <div className="p-3 bg-muted/20 border rounded-lg text-muted-foreground italic min-h-[60px]">
                  {po.observaciones || "Sin observaciones registradas."}
                </div>
              </div>

              <div className="bg-muted/30 p-3.5 rounded-xl border space-y-1.5 self-end text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal Neto:</span>
                  <span className="font-mono font-medium">$ {Number(po.subtotal_amount).toLocaleString("es-CL")}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>IVA Crédito 19%:</span>
                  <span className="font-mono font-medium">$ {Number(po.tax_amount).toLocaleString("es-CL")}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t pt-1.5 text-primary">
                  <span>Total Orden de Compra:</span>
                  <span className="font-mono">$ {Number(po.total_amount).toLocaleString("es-CL")} {po.currency_code}</span>
                </div>
              </div>
            </div>

            <DialogFooter className="print:hidden">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                <span>Imprimir / PDF</span>
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
