import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEntity } from "@/context/ActiveEntityContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import {
  FileText,
  Receipt,
  CreditCard,
  Building2,
  Calendar,
  DollarSign,
  ArrowRight,
  ExternalLink,
  Layers,
  Scale,
  CheckCircle2,
  User,
  Hash,
} from "lucide-react";

interface SourceDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journalEntryId: string | null;
}

export function SourceDocumentDialog({
  open,
  onOpenChange,
  journalEntryId,
}: SourceDocumentDialogProps) {
  const { activeEntityId, activeEntity } = useActiveEntity();
  const baseCurrency = activeEntity?.base_currency_code || "CLP";

  // Query: Resolver el Documento Fuente asociado al comprobante
  const sourceQuery = useQuery({
    queryKey: ["journal_entry_source_document", activeEntityId, journalEntryId],
    queryFn: async () => {
      if (!activeEntityId || !journalEntryId) return null;

      // 1. Intentar vía RPC atómica
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "get_journal_entry_source_document",
          {
            _journal_entry_id: journalEntryId,
            _entity_id: activeEntityId,
          }
        );

        if (!rpcError && rpcData && (rpcData as any).success) {
          return rpcData as any;
        }
      } catch (err) {
        console.warn("RPC get_journal_entry_source_document no disponible, ejecutando fallback cliente:", err);
      }

      // 2. Fallback resiliente vía consultas directas
      // 2.1 Obtener comprobante contable y líneas
      const { data: je, error: jeError } = await supabase
        .from("journal_entries")
        .select(`
          *,
          books(name),
          journal_entry_lines(
            id,
            line_no,
            account_id,
            debit,
            credit,
            memo,
            accounts(code, name),
            parties(name, tax_id),
            cost_centers(code, name),
            business_units(code, name)
          )
        `)
        .eq("id", journalEntryId)
        .eq("entity_id", activeEntityId)
        .single();

      if (jeError || !je) throw jeError || new Error("Comprobante contable no encontrado");

      const linesFormatted = (je.journal_entry_lines || []).map((l: any) => ({
        id: l.id,
        line_no: l.line_no,
        account_id: l.account_id,
        account_code: l.accounts?.code,
        account_name: l.accounts?.name,
        party_name: l.parties?.name,
        party_tax_id: l.parties?.tax_id,
        cost_center_name: l.cost_centers?.name,
        business_unit_name: l.business_units?.name,
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
        memo: l.memo,
      }));

      const jeObj = {
        ...je,
        lines: linesFormatted,
      };

      // 2.2 Buscar en Facturas de Venta
      const { data: si } = await supabase
        .from("sales_invoices")
        .select(`
          *,
          parties(name, tax_id),
          warehouses(name),
          cost_centers(name),
          sales_invoice_lines(*, items(code, name))
        `)
        .eq("journal_entry_id", journalEntryId)
        .eq("entity_id", activeEntityId)
        .maybeSingle();

      if (si) {
        return {
          success: true,
          source_type: "sales_invoice",
          title: "Factura Electrónica de Venta",
          journal_entry: jeObj,
          document: {
            ...si,
            customer_name: si.parties?.name,
            customer_tax_id: si.parties?.tax_id,
            warehouse_name: si.warehouses?.name,
            cost_center_name: si.cost_centers?.name,
            lines: (si.sales_invoice_lines || []).map((l: any) => ({
              id: l.id,
              description: l.description,
              qty: l.qty,
              unit_price: l.unit_price,
              tax_rate: l.tax_rate,
              line_total: l.line_total,
              item_code: l.items?.code,
              item_name: l.items?.name,
            })),
          },
        };
      }

      // 2.3 Buscar en Facturas de Compra
      const { data: pi } = await supabase
        .from("purchase_invoices")
        .select(`
          *,
          parties(name, tax_id),
          warehouses(name),
          cost_centers(name),
          purchase_invoice_lines(*, items(code, name))
        `)
        .eq("journal_entry_id", journalEntryId)
        .eq("entity_id", activeEntityId)
        .maybeSingle();

      if (pi) {
        return {
          success: true,
          source_type: "purchase_invoice",
          title: "Factura de Compra / Proveedor",
          journal_entry: jeObj,
          document: {
            ...pi,
            supplier_name: pi.parties?.name,
            supplier_tax_id: pi.parties?.tax_id,
            warehouse_name: pi.warehouses?.name,
            cost_center_name: pi.cost_centers?.name,
            lines: (pi.purchase_invoice_lines || []).map((l: any) => ({
              id: l.id,
              description: l.description,
              qty: l.qty,
              unit_price: l.unit_price,
              tax_rate: l.tax_rate,
              line_total: l.line_total,
              item_code: l.items?.code,
              item_name: l.items?.name,
            })),
          },
        };
      }

      // 2.4 Buscar en Pagos y Cobranzas
      const { data: pay } = await supabase
        .from("invoice_payments")
        .select(`
          *,
          accounts(code, name),
          sales_invoices(invoice_number, parties(name, tax_id)),
          purchase_invoices(invoice_number, parties(name, tax_id))
        `)
        .eq("journal_entry_id", journalEntryId)
        .eq("entity_id", activeEntityId)
        .maybeSingle();

      if (pay) {
        const isSales = !!pay.sales_invoice_id;
        return {
          success: true,
          source_type: "invoice_payment",
          title: isSales ? "Cobranza de Cliente" : "Pago a Proveedor",
          journal_entry: jeObj,
          document: {
            ...pay,
            bank_account_code: pay.accounts?.code,
            bank_account_name: pay.accounts?.name,
            sales_invoice_number: pay.sales_invoices?.invoice_number,
            customer_name: pay.sales_invoices?.parties?.name,
            customer_tax_id: pay.sales_invoices?.parties?.tax_id,
            purchase_invoice_number: pay.purchase_invoices?.invoice_number,
            supplier_name: pay.purchase_invoices?.parties?.name,
            supplier_tax_id: pay.purchase_invoices?.parties?.tax_id,
          },
        };
      }

      // 2.5 Por defecto: Comprobante Manual / Apertura
      return {
        success: true,
        source_type: "journal_voucher",
        title: je.voucher_type || "Comprobante Contable de Diario",
        journal_entry: jeObj,
        document: jeObj,
      };
    },
    enabled: open && !!activeEntityId && !!journalEntryId,
  });

  const sourceData = sourceQuery.data;
  const doc = sourceData?.document;
  const je = sourceData?.journal_entry;
  const sourceType = sourceData?.source_type;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="border-b pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {sourceType === "sales_invoice" ? (
                  <Receipt className="h-5 w-5" />
                ) : sourceType === "purchase_invoice" ? (
                  <FileText className="h-5 w-5" />
                ) : sourceType === "invoice_payment" ? (
                  <CreditCard className="h-5 w-5" />
                ) : sourceType === "depreciation" ? (
                  <Building2 className="h-5 w-5" />
                ) : (
                  <Layers className="h-5 w-5" />
                )}
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <span>{sourceData?.title || "Documento Contable"}</span>
                  {doc?.invoice_number && (
                    <Badge variant="outline" className="font-mono text-sm border-primary/30 text-primary">
                      #{doc.invoice_number}
                    </Badge>
                  )}
                  {je?.entry_number && !doc?.invoice_number && (
                    <Badge variant="outline" className="font-mono text-sm border-primary/30 text-primary">
                      {je.entry_number}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Trazabilidad de origen del movimiento contable (Comprobante: {je?.entry_number || "-"})
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {sourceType === "sales_invoice" && (
                <Button asChild size="sm" variant="outline" className="text-xs gap-1.5">
                  <Link to="/sales">
                    <span>Ir a Ventas</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
              {sourceType === "purchase_invoice" && (
                <Button asChild size="sm" variant="outline" className="text-xs gap-1.5">
                  <Link to="/purchases">
                    <span>Ir a Compras</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {sourceQuery.isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Cargando documento fuente...
          </div>
        ) : !sourceData ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No se encontró el documento asociado.
          </div>
        ) : (
          <Tabs defaultValue="document" className="mt-4">
            <TabsList className="mb-4">
              <TabsTrigger value="document" className="text-xs gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                <span>Documento Comercial / Operativo</span>
              </TabsTrigger>
              <TabsTrigger value="voucher" className="text-xs gap-1.5">
                <Scale className="h-3.5 w-3.5" />
                <span>Asiento Contable Cuadrado ({je?.lines?.length || 0} líneas)</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Documento Operativo / Comercial */}
            <TabsContent value="document" className="space-y-4">
              {/* VISTA 1: Factura de Venta / Factura de Compra */}
              {(sourceType === "sales_invoice" || sourceType === "purchase_invoice") && (
                <div className="space-y-4">
                  {/* Ficha Resumen de la Factura */}
                  <Card className="border bg-muted/20 shadow-none">
                    <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Contraparte</span>
                        <div className="font-semibold text-foreground mt-0.5">
                          {doc.customer_name || doc.supplier_name || "-"}
                        </div>
                        <div className="font-mono text-muted-foreground text-[10px]">
                          RUT: {doc.customer_tax_id || doc.supplier_tax_id || "-"}
                        </div>
                      </div>

                      <div>
                        <span className="text-muted-foreground block text-[11px]">Fecha de Emisión</span>
                        <div className="font-mono font-medium text-foreground mt-0.5">
                          {doc.issue_date || "-"}
                        </div>
                        {doc.due_date && (
                          <div className="text-[10px] text-muted-foreground">
                            Vence: {doc.due_date}
                          </div>
                        )}
                      </div>

                      <div>
                        <span className="text-muted-foreground block text-[11px]">Centro de Costo / Bodega</span>
                        <div className="font-medium text-foreground mt-0.5">
                          {doc.cost_center_name || "General"}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Bodega: {doc.warehouse_name || "Principal"}
                        </div>
                      </div>

                      <div>
                        <span className="text-muted-foreground block text-[11px]">Estado Documento</span>
                        <Badge
                          variant="outline"
                          className="mt-1 font-mono text-[10px] uppercase border-emerald-500/30 text-emerald-600 bg-emerald-500/10"
                        >
                          {doc.status || "Vigente"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tabla de Ítems / Líneas Facturadas */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      Detalle de Productos / Servicios
                    </h4>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="text-xs">Ítem / Descripción</TableHead>
                            <TableHead className="text-xs text-right w-20">Cant.</TableHead>
                            <TableHead className="text-xs text-right w-28">Precio Unit.</TableHead>
                            <TableHead className="text-xs text-right w-20">IVA %</TableHead>
                            <TableHead className="text-xs text-right w-32">Total Línea</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(doc.lines || []).map((line: any, idx: number) => (
                            <TableRow key={line.id || idx} className="text-xs">
                              <TableCell>
                                <div className="font-medium text-foreground">{line.description}</div>
                                {line.item_code && (
                                  <div className="text-[10px] font-mono text-muted-foreground">
                                    Código: {line.item_code}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-mono">{Number(line.qty || 0).toLocaleString("es-CL")}</TableCell>
                              <TableCell className="text-right font-mono">$ {Number(line.unit_price || 0).toLocaleString("es-CL")}</TableCell>
                              <TableCell className="text-right font-mono text-muted-foreground">{line.tax_rate}%</TableCell>
                              <TableCell className="text-right font-mono font-semibold">
                                $ {Number(line.line_total || 0).toLocaleString("es-CL")}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Totales de la Factura */}
                  <div className="flex justify-end pt-2">
                    <div className="w-full max-w-xs space-y-1.5 p-3 rounded-lg bg-muted/30 border text-xs">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal Neto:</span>
                        <span className="font-mono">$ {Number(doc.subtotal_amount || 0).toLocaleString("es-CL")}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>IVA (19%):</span>
                        <span className="font-mono">$ {Number(doc.tax_amount || 0).toLocaleString("es-CL")}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold text-foreground border-t pt-1.5">
                        <span>Total Factura:</span>
                        <span className="font-mono text-primary">$ {Number(doc.total_amount || 0).toLocaleString("es-CL")} {doc.currency_code || baseCurrency}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* VISTA 2: Pago o Cobranza */}
              {sourceType === "invoice_payment" && (
                <div className="space-y-4">
                  <Card className="border bg-muted/20 shadow-none">
                    <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Tipo de Operación</span>
                        <div className="font-semibold text-foreground mt-0.5">
                          {doc.customer_name ? "Cobranza de Factura de Venta" : "Pago de Factura de Compra"}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Documento Relacionado: <strong className="text-primary font-mono">{doc.sales_invoice_number || doc.purchase_invoice_number || "Factura"}</strong>
                        </div>
                      </div>

                      <div>
                        <span className="text-muted-foreground block text-[11px]">Cuenta Bancaria de Tesorería</span>
                        <div className="font-medium text-foreground mt-0.5">
                          {doc.bank_account_code} - {doc.bank_account_name || "Cuenta Corriente"}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Fecha Pago: {doc.payment_date}
                        </div>
                      </div>

                      <div>
                        <span className="text-muted-foreground block text-[11px]">Monto Pagado</span>
                        <div className="font-mono font-bold text-lg text-emerald-600 dark:text-emerald-400 mt-0.5">
                          $ {Number(doc.amount || 0).toLocaleString("es-CL")} {doc.currency_code || baseCurrency}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {doc.memo && (
                    <div className="p-3 rounded-md bg-muted/30 border text-xs text-muted-foreground italic">
                      Glosa del Pago: {doc.memo}
                    </div>
                  )}
                </div>
              )}

              {/* VISTA 3: Depreciación de Activo Fijo */}
              {sourceType === "depreciation" && (
                <div className="space-y-4">
                  <Card className="border bg-muted/20 shadow-none">
                    <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Activo Fijo</span>
                        <div className="font-semibold text-foreground mt-0.5">{doc.asset_name}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">Código: {doc.asset_code}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Período Depreciado</span>
                        <div className="font-medium text-foreground mt-0.5">{doc.period_date}</div>
                        <div className="text-[10px] text-muted-foreground">Método: {doc.depreciation_method}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Cuota Mensual</span>
                        <div className="font-mono font-bold text-base text-primary mt-0.5">
                          $ {Number(doc.amount || 0).toLocaleString("es-CL")}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* VISTA 4: Comprobante Contable de Diario */}
              {sourceType === "journal_voucher" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-md border bg-muted/20 text-xs text-muted-foreground">
                    Este movimiento corresponde a un comprobante contable directo (asiento de diario manual, apertura, traspaso o ajuste). Puedes revisar todas las partidas en la pestaña contable contigua.
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB 2: Asiento Contable Cuadrado (Partida Doble) */}
            <TabsContent value="voucher" className="space-y-4">
              <div className="p-3 rounded-md bg-muted/20 border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">N° Comprobante:</span>{" "}
                  <strong className="font-mono text-primary">{je?.entry_number}</strong>
                  <span className="mx-2 text-muted-foreground">•</span>
                  <span className="text-muted-foreground">Fecha:</span>{" "}
                  <strong className="font-mono">{je?.posting_date}</strong>
                </div>
                {je?.memo && (
                  <div className="text-muted-foreground italic truncate max-w-md">
                    {je.memo}
                  </div>
                )}
              </div>

              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-12 text-xs">Línea</TableHead>
                      <TableHead className="text-xs">Cuenta Contable</TableHead>
                      <TableHead className="text-xs">Centro Costo / Sucursal</TableHead>
                      <TableHead className="text-xs">Tercero / RUT</TableHead>
                      <TableHead className="text-right text-xs">Débito ({baseCurrency})</TableHead>
                      <TableHead className="text-right text-xs">Crédito ({baseCurrency})</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(je?.lines || []).map((line: any, idx: number) => (
                      <TableRow key={line.id || idx} className="text-xs">
                        <TableCell className="font-mono text-muted-foreground">{line.line_no || idx + 1}</TableCell>
                        <TableCell>
                          <span className="font-mono font-bold text-foreground">{line.account_code}</span>{" "}
                          <span className="text-muted-foreground">- {line.account_name}</span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {line.cost_center_name || line.business_unit_name || "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {line.party_name ? `${line.party_name} (${line.party_tax_id || ""})` : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {Number(line.debit || 0) > 0 ? `$ ${Number(line.debit).toLocaleString("es-CL")}` : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {Number(line.credit || 0) > 0 ? `$ ${Number(line.credit).toLocaleString("es-CL")}` : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Verificación de Cuadre */}
              {(() => {
                const totalDebit = (je?.lines || []).reduce((s: number, l: any) => s + Number(l.debit || 0), 0);
                const totalCredit = (je?.lines || []).reduce((s: number, l: any) => s + Number(l.credit || 0), 0);
                const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

                return (
                  <div className="flex flex-col sm:flex-row items-center justify-between p-3 rounded-lg bg-muted/30 border text-xs gap-3">
                    <div className="flex items-center gap-1.5 font-medium">
                      {isBalanced ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <span className="text-emerald-700 dark:text-emerald-400">Asiento Balanceado (Partida Doble Cuadrada)</span>
                        </>
                      ) : (
                        <span className="text-destructive font-bold">Desbalance Contable detectado</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 font-mono font-semibold">
                      <span>Débitos: $ {totalDebit.toLocaleString("es-CL")}</span>
                      <span>Créditos: $ {totalCredit.toLocaleString("es-CL")}</span>
                    </div>
                  </div>
                );
              })()}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
