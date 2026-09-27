import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEntity } from "@/context/ActiveEntityContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useServerFn } from "@tanstack/react-start";
import { syncSiiDocuments } from "@/lib/sii-sync.functions";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  Download,
  Upload,
  ArrowLeft,
  RefreshCw,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Search,
  Scale,
  DollarSign,
  Layers,
  CloudLightning,
  Clock,
  Sparkles,
  Receipt,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/sii-books")({
  component: SiiBooksPage,
  head: () => ({
    meta: [
      { title: "Libros Legales SII & RCV | EasyERP" },
      { name: "description", content: "Libro Diario, Mayor, Balance Tributario de 8 Columnas y Conciliación RCV para el SII." },
    ],
  }),
});

type BookType = "libro_diario" | "libro_mayor" | "balance_tributario_8_columnas" | "libro_ventas" | "libro_compras";

function SiiBooksPage() {
  const queryClient = useQueryClient();
  const { activeEntity, activeEntityId } = useActiveEntity();

  const [selectedBook, setSelectedBook] = useState<BookType>("balance_tributario_8_columnas");
  const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(`${new Date().getFullYear()}-12-31`);

  // State Conciliación RCV
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [rcvOperation, setRcvOperation] = useState<"VENTA" | "COMPRA">("VENTA");
  const [rcvDocType, setRcvDocType] = useState("33 Factura Electronica");
  const [rcvDocNum, setRcvDocNum] = useState("");
  const [rcvRut, setRcvRut] = useState("");
  const [rcvPartyName, setRcvPartyName] = useState("");
  const [rcvTotalAmount, setRcvTotalAmount] = useState("");
  const [rcvDate, setRcvDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // State Sincronización ApiPyme
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncPeriod, setSyncPeriod] = useState(
    `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}`
  );
  const [syncDocType, setSyncDocType] = useState<"venta" | "compra">("venta");

  const fetchSyncSiiFn = useServerFn(syncSiiDocuments);

  const baseCurrency = activeEntity?.base_currency_code || "CLP";

  // Query: Datos del libro legal seleccionado
  const bookDataQuery = useQuery({
    queryKey: ["sii_book_data", activeEntityId, selectedBook, startDate, endDate],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase.rpc("get_sii_book_data", {
        _entity_id: activeEntityId,
        _book_type: selectedBook,
        _start_date: startDate,
        _end_date: endDate,
      });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!activeEntityId,
  });

  // Query: Historial de Conciliaciones RCV
  const rcvRunsQuery = useQuery({
    queryKey: ["rcv_reconciliation_runs", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("rcv_reconciliation_runs" as any)
        .select("*, rcv_reconciliation_items(*)")
        .eq("entity_id", activeEntityId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!activeEntityId,
  });

  // Query: Resumen de Boletas Electrónicas del período
  const boletasSummaryQuery = useQuery({
    queryKey: ["sii_boletas_summary", activeEntityId, syncPeriod],
    queryFn: async () => {
      if (!activeEntityId) return null;
      const { data, error } = await supabase
        .from("sii_boletas_summary" as any)
        .select("*")
        .eq("entity_id", activeEntityId)
        .eq("period", syncPeriod)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!activeEntityId,
  });

  // Query: Jobs de extracción de ApiPyme
  const syncJobsQuery = useQuery({
    queryKey: ["sii_sync_jobs", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("sii_sync_jobs" as any)
        .select("*")
        .eq("entity_id", activeEntityId)
        .order("requested_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!activeEntityId,
  });

  // Query: Documentos oficiales descargados del SII (ApiPyme)
  const syncedDocsQuery = useQuery({
    queryKey: ["sii_synced_documents", activeEntityId, selectedBook, startDate, endDate],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const docType = selectedBook === "libro_compras" ? "compra" : "venta";
      const { data, error } = await supabase
        .from("sii_synced_documents" as any)
        .select("*")
        .eq("entity_id", activeEntityId)
        .eq("document_type", docType)
        .gte("issue_date", startDate)
        .lte("issue_date", endDate)
        .order("issue_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!activeEntityId && (selectedBook === "libro_ventas" || selectedBook === "libro_compras"),
  });

  // Mutation: Sincronizar desde SII
  const syncSiiMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Selecciona una empresa primero");
      return await fetchSyncSiiFn({
        data: {
          entity_id: activeEntityId,
          document_type: syncDocType,
          period: syncPeriod.trim(),
        },
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["sii_boletas_summary", activeEntityId] });
      queryClient.invalidateQueries({ queryKey: ["sii_sync_jobs", activeEntityId] });
      queryClient.invalidateQueries({ queryKey: ["sii_book_data", activeEntityId] });
      queryClient.invalidateQueries({ queryKey: ["sii_synced_documents", activeEntityId] });

      if (res.status === "pending") {
        toast.info(
          `Extracción en curso en ApiPyme (Tarea: ${res.task_id}). Se completará automáticamente vía Webhook.`
        );
      } else {
        toast.success(
          `Sincronización completada: ${res.count} documentos de ${syncDocType}s actualizados.`
        );
      }
      setSyncModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al sincronizar con el SII vía ApiPyme");
    },
  });

  const bookRows = bookDataQuery.data ?? [];
  const rcvRuns = rcvRunsQuery.data ?? [];
  const latestRun = rcvRuns[0];
  const boletasSummary = boletasSummaryQuery.data;
  const syncJobs = syncJobsQuery.data ?? [];
  const syncedDocs = syncedDocsQuery.data ?? [];

  // Mutation para agregar documento RCV para conciliar
  const reconcileSingleDocMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Selecciona una empresa primero");
      const tot = parseFloat(rcvTotalAmount);
      if (isNaN(tot) || tot <= 0) throw new Error("El monto total debe ser mayor a 0");
      if (!rcvDocNum.trim() || !rcvRut.trim()) throw new Error("Complete el N° de documento y RUT");

      const payloadRow = {
        operation_type: rcvOperation,
        doc_type: rcvDocType,
        doc_number: rcvDocNum.trim(),
        rut: rcvRut.trim(),
        name: rcvPartyName.trim() || "Contraparte RCV",
        total_amount: tot,
        issue_date: rcvDate,
      };

      const { data, error } = await supabase.rpc("reconcile_rcv_batch", {
        _entity_id: activeEntityId,
        _period_start: startDate,
        _period_end: endDate,
        _file_name: `Carga_Manual_${rcvOperation}_${Date.now()}.csv`,
        _rcv_rows: [payloadRow],
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rcv_reconciliation_runs", activeEntityId] });
      toast.success("Documento RCV contrastado y registrado en la conciliación");
      setImportModalOpen(false);
      setRcvDocNum("");
      setRcvRut("");
      setRcvPartyName("");
      setRcvTotalAmount("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al contrastar documento RCV");
    },
  });

  // Exportar datos actuales a CSV
  function downloadCsv() {
    if (bookRows.length === 0) {
      toast.error("No hay registros para exportar en este período");
      return;
    }
    const headers = Object.keys(bookRows[0]).join(";");
    const rows = bookRows
      .map((row) =>
        Object.values(row)
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(";")
      )
      .join("\n");

    const blob = new Blob([`${headers}\n${rows}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${selectedBook}_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Archivo CSV generado y descargado");
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/dashboard">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Volver al Dashboard
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={syncModalOpen} onOpenChange={setSyncModalOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-sm">
                <CloudLightning className="h-3.5 w-3.5" />
                <span>Sincronizar desde SII (ApiPyme)</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CloudLightning className="h-5 w-5 text-amber-500" />
                  <span>Sincronización RCV Oficial (ApiPyme)</span>
                </DialogTitle>
                <DialogDescription>
                  Extrae facturas, notas y boletas electrónicas directamente desde el SII para {activeEntity?.name || "la empresa"}.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-3 text-xs">
                <div>
                  <Label className="text-xs font-semibold">Período Fiscal (Formato YYYYMM) *</Label>
                  <Input
                    placeholder="ej. 202608"
                    value={syncPeriod}
                    onChange={(e) => setSyncPeriod(e.target.value)}
                    className="mt-1 font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Año y mes de los documentos a descargar (ejemplo: Agosto 2026 = 202608).
                  </p>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Módulo de Documentos *</Label>
                  <Select value={syncDocType} onValueChange={(val: any) => setSyncDocType(val)}>
                    <SelectTrigger className="mt-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="venta">Libro de Ventas (Emitidos & Boletas)</SelectItem>
                      <SelectItem value="compra">Libro de Compras (Recibidos)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-lg border bg-muted/40 p-3 text-[11px] space-y-1">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span>Paginación y Extracción Asíncrona</span>
                  </div>
                  <p className="text-muted-foreground">
                    Soporta paginación completa (hasta 5.000 docs/página). Si el SII demora en procesar, la extracción responderá en segundo plano y se completará automáticamente vía Webhook.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setSyncModalOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={() => syncSiiMutation.mutate()}
                  disabled={syncSiiMutation.isPending || !syncPeriod.trim() || !activeEntityId}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                  {syncSiiMutation.isPending ? "Sincronizando..." : "Iniciar Sincronización"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              bookDataQuery.refetch();
              rcvRunsQuery.refetch();
              boletasSummaryQuery.refetch();
              syncJobsQuery.refetch();
            }}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Actualizar
          </Button>
          <Button size="sm" onClick={downloadCsv} disabled={bookRows.length === 0}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Exportar a CSV / Excel
          </Button>
        </div>
      </div>

      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Libros Legales SII & Conciliación RCV</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Generación oficial de Libro Diario, Mayor, Balance Tributario de 8 Columnas y cruce contra el Registro de Compras y Ventas.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="books" className="space-y-6">
        <TabsList>
          <TabsTrigger value="books" className="flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" />
            <span>Libros Contables Oficiales</span>
          </TabsTrigger>
          <TabsTrigger value="rcv" className="flex items-center gap-1.5">
            <Scale className="h-4 w-4" />
            <span>Conciliación RCV (Compras y Ventas SII)</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab Libros Contables */}
        <TabsContent value="books" className="space-y-4">
          {/* Filtros de Selección de Libro */}
          <Card className="border shadow-sm">
            <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
              <div>
                <Label className="text-xs font-semibold">Tipo de Libro Legal SII</Label>
                <Select value={selectedBook} onValueChange={(val: any) => setSelectedBook(val)}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balance_tributario_8_columnas">Balance Tributario de 8 Columnas</SelectItem>
                    <SelectItem value="libro_diario">Libro Diario Legal</SelectItem>
                    <SelectItem value="libro_mayor">Libro Mayor Legal</SelectItem>
                    <SelectItem value="libro_ventas">Libro de Ventas (Facturas Emitidas)</SelectItem>
                    <SelectItem value="libro_compras">Libro de Compras (Facturas Proveedores)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Fecha Desde</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Fecha Hasta</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Button
                  className="w-full text-xs"
                  onClick={() => {
                    bookDataQuery.refetch();
                    syncedDocsQuery.refetch();
                  }}
                >
                  <Search className="mr-1.5 h-3.5 w-3.5" />
                  Consultar Libro
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Renderizado de Tabla según el Libro */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold capitalize">
                  {selectedBook.replace(/_/g, " ")} ({bookRows.length} registros)
                </CardTitle>
                <CardDescription className="text-xs">
                  Período contable del {startDate} al {endDate} en {activeEntity?.name || "la empresa"}.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {bookDataQuery.isLoading ? (
                <div className="py-16 text-center text-muted-foreground text-sm">Cargando libro contable...</div>
              ) : bookRows.length === 0 && selectedBook !== "libro_ventas" && selectedBook !== "libro_compras" ? (
                <div className="py-16 text-center text-muted-foreground text-sm">
                  No hay movimientos o comprobantes registrados para este libro en el período seleccionado.
                </div>
              ) : selectedBook === "balance_tributario_8_columnas" ? (
                /* Balance Tributario de 8 Columnas */
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead rowSpan={2} className="w-24">Cuenta</TableHead>
                        <TableHead rowSpan={2}>Nombre Cuenta</TableHead>
                        <TableHead colSpan={2} className="text-center border-l border-r">1 & 2: Sumas Mayor</TableHead>
                        <TableHead colSpan={2} className="text-center border-r">3 & 4: Saldos</TableHead>
                        <TableHead colSpan={2} className="text-center border-r">5 & 6: Inventario</TableHead>
                        <TableHead colSpan={2} className="text-center">7 & 8: Resultados</TableHead>
                      </TableRow>
                      <TableRow className="bg-muted/30 text-[11px]">
                        <TableHead className="text-right border-l">Débito</TableHead>
                        <TableHead className="text-right border-r">Crédito</TableHead>
                        <TableHead className="text-right">Deudor</TableHead>
                        <TableHead className="text-right border-r">Acreedor</TableHead>
                        <TableHead className="text-right">Activo</TableHead>
                        <TableHead className="text-right border-r">Pasivo</TableHead>
                        <TableHead className="text-right">Pérdida</TableHead>
                        <TableHead className="text-right">Ganancia</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bookRows.map((r, i) => (
                        <TableRow key={i} className="text-xs font-mono">
                          <TableCell className="font-bold text-primary">{r.account_code}</TableCell>
                          <TableCell className="font-sans font-medium">{r.account_name}</TableCell>
                          <TableCell className="text-right border-l">$ {Number(r.total_debit || 0).toLocaleString("es-CL")}</TableCell>
                          <TableCell className="text-right border-r">$ {Number(r.total_credit || 0).toLocaleString("es-CL")}</TableCell>
                          <TableCell className="text-right">$ {Number(r.saldo_deudor || 0).toLocaleString("es-CL")}</TableCell>
                          <TableCell className="text-right border-r">$ {Number(r.saldo_acreedor || 0).toLocaleString("es-CL")}</TableCell>
                          <TableCell className="text-right font-semibold">$ {Number(r.inventario_activo || 0).toLocaleString("es-CL")}</TableCell>
                          <TableCell className="text-right border-r font-semibold">$ {Number(r.inventario_pasivo || 0).toLocaleString("es-CL")}</TableCell>
                          <TableCell className="text-right text-destructive font-semibold">$ {Number(r.resultado_perdida || 0).toLocaleString("es-CL")}</TableCell>
                          <TableCell className="text-right text-emerald-600 font-semibold">$ {Number(r.resultado_ganancia || 0).toLocaleString("es-CL")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : selectedBook === "libro_diario" ? (
                /* Libro Diario */
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>N° Comprobante</TableHead>
                        <TableHead>Cuenta</TableHead>
                        <TableHead>Glosa / Detalle</TableHead>
                        <TableHead className="text-right">Débito ($)</TableHead>
                        <TableHead className="text-right">Crédito ($)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bookRows.map((r, i) => (
                        <TableRow key={i} className="text-xs">
                          <TableCell className="font-mono">{r.posting_date}</TableCell>
                          <TableCell className="font-mono font-bold text-primary">{r.entry_number}</TableCell>
                          <TableCell>
                            <span className="font-mono font-bold">{r.account_code}</span> - {r.account_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{r.line_memo || r.header_memo}</TableCell>
                          <TableCell className="text-right font-mono">{Number(r.debit || 0) > 0 ? `$ ${Number(r.debit).toLocaleString("es-CL")}` : "-"}</TableCell>
                          <TableCell className="text-right font-mono">{Number(r.credit || 0) > 0 ? `$ ${Number(r.credit).toLocaleString("es-CL")}` : "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                /* Libro Compras / Ventas */
                <div>
                  {selectedBook === "libro_ventas" && (
                    <div className="p-4 bg-muted/20 border-b">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <Receipt className="h-4 w-4 text-primary" />
                          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                            Resumen Oficial de Boletas Electrónicas (SII)
                          </span>
                        </div>
                        {boletasSummary && (
                          <Badge variant="outline" className="text-[10px] font-mono gap-1 text-emerald-600 border-emerald-500/30">
                            <CheckCircle2 className="h-3 w-3" />
                            Sincronizado vía ApiPyme • {boletasSummary.period}
                          </Badge>
                        )}
                      </div>

                      {boletasSummary ? (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          <div className="p-2.5 rounded-md bg-card border">
                            <div className="text-[11px] text-muted-foreground">Cantidad Boletas</div>
                            <div className="text-base font-bold font-mono text-foreground">
                              {Number(boletasSummary.cantidad_documentos || 0).toLocaleString("es-CL")}
                            </div>
                          </div>
                          <div className="p-2.5 rounded-md bg-card border">
                            <div className="text-[11px] text-muted-foreground">Monto Neto</div>
                            <div className="text-base font-bold font-mono text-foreground">
                              $ {Number(boletasSummary.monto_neto || 0).toLocaleString("es-CL")}
                            </div>
                          </div>
                          <div className="p-2.5 rounded-md bg-card border">
                            <div className="text-[11px] text-muted-foreground">Monto Exento</div>
                            <div className="text-base font-bold font-mono text-foreground">
                              $ {Number(boletasSummary.monto_exento || 0).toLocaleString("es-CL")}
                            </div>
                          </div>
                          <div className="p-2.5 rounded-md bg-card border">
                            <div className="text-[11px] text-muted-foreground">IVA Débito (19%)</div>
                            <div className="text-base font-bold font-mono text-primary">
                              $ {Number(boletasSummary.monto_iva || 0).toLocaleString("es-CL")}
                            </div>
                          </div>
                          <div className="p-2.5 rounded-md bg-card border bg-primary/5">
                            <div className="text-[11px] text-muted-foreground font-semibold">Total Boletas</div>
                            <div className="text-base font-bold font-mono text-primary">
                              $ {Number(boletasSummary.monto_total || 0).toLocaleString("es-CL")}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-3 rounded-md bg-card border text-xs text-muted-foreground">
                          <span>Sin boletas descargadas para el período {syncPeriod}. Puedes sincronizarlas con el botón superior.</span>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setSyncModalOpen(true)}>
                            <CloudLightning className="h-3 w-3 text-amber-500" />
                            Sincronizar Boletas
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha Emisión</TableHead>
                          <TableHead>Folio / N°</TableHead>
                          <TableHead>Tipo Documento</TableHead>
                          <TableHead>RUT</TableHead>
                          <TableHead>Razón Social</TableHead>
                          <TableHead className="text-right">Monto Neto</TableHead>
                          <TableHead className="text-right">IVA (19%)</TableHead>
                          <TableHead className="text-right">Monto Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bookRows.map((r, i) => (
                          <TableRow key={i} className="text-xs">
                            <TableCell className="font-mono">{r.issue_date}</TableCell>
                            <TableCell className="font-mono font-bold text-primary">{r.invoice_number}</TableCell>
                            <TableCell>{r.doc_type_name}</TableCell>
                            <TableCell className="font-mono">{r.customer_rut || r.supplier_rut || "-"}</TableCell>
                            <TableCell className="font-medium">{r.customer_name || r.supplier_name}</TableCell>
                            <TableCell className="text-right font-mono">$ {Number(r.monto_neto || 0).toLocaleString("es-CL")}</TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">$ {Number(r.iva_debito_19 || r.iva_credito_19 || 0).toLocaleString("es-CL")}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-foreground">$ {Number(r.monto_total || 0).toLocaleString("es-CL")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Documentos oficiales descargados del SII (ApiPyme) */}
                  <div className="border-t p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <CloudLightning className="h-4 w-4 text-amber-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Documentos Oficiales SII Sincronizados ({selectedBook === "libro_ventas" ? "Ventas" : "Compras"})
                        </span>
                      </div>
                      {syncedDocs.length > 0 && (
                        <Badge variant="outline" className="text-[10px] font-mono gap-1 text-emerald-600 border-emerald-500/30">
                          <CheckCircle2 className="h-3 w-3" />
                          {syncedDocs.length} documentos descargados del SII
                        </Badge>
                      )}
                    </div>

                    {syncedDocs.length === 0 ? (
                      <div className="flex items-center justify-between p-3 rounded-md bg-card border text-xs text-muted-foreground">
                        <span>No hay documentos {selectedBook === "libro_ventas" ? "de venta" : "de compra"} sincronizados desde el SII en este rango de fechas.</span>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setSyncModalOpen(true)}>
                          <CloudLightning className="h-3 w-3 text-amber-500" />
                          Sincronizar desde SII
                        </Button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/40">
                              <TableHead>Fecha Emisión</TableHead>
                              <TableHead>Tipo DTE</TableHead>
                              <TableHead>Folio</TableHead>
                              <TableHead>RUT Contraparte</TableHead>
                              <TableHead>Razón Social</TableHead>
                              <TableHead className="text-right">Neto</TableHead>
                              <TableHead className="text-right">Exento</TableHead>
                              <TableHead className="text-right">IVA</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {syncedDocs.map((d: any, i: number) => {
                              const dteNames: Record<string, string> = {
                                "33": "Factura Electrónica",
                                "34": "Factura Exenta",
                                "39": "Boleta Electrónica",
                                "56": "Nota de Débito",
                                "61": "Nota de Crédito",
                              };
                              return (
                                <TableRow key={d.id ?? i} className="text-xs">
                                  <TableCell className="font-mono">{d.issue_date}</TableCell>
                                  <TableCell>
                                    {dteNames[String(d.sii_doc_type)] ?? `DTE ${d.sii_doc_type}`}
                                    <span className="text-muted-foreground"> ({d.sii_doc_type})</span>
                                  </TableCell>
                                  <TableCell className="font-mono font-bold text-primary">{d.folio}</TableCell>
                                  <TableCell className="font-mono">{d.party_tax_id || "-"}</TableCell>
                                  <TableCell className="font-medium">{d.party_name || "-"}</TableCell>
                                  <TableCell className="text-right font-mono">$ {Number(d.net_amount || 0).toLocaleString("es-CL")}</TableCell>
                                  <TableCell className="text-right font-mono text-muted-foreground">$ {Number(d.exempt_amount || 0).toLocaleString("es-CL")}</TableCell>
                                  <TableCell className="text-right font-mono text-muted-foreground">$ {Number(d.tax_amount || 0).toLocaleString("es-CL")}</TableCell>
                                  <TableCell className="text-right font-mono font-bold text-foreground">$ {Number(d.total_amount || 0).toLocaleString("es-CL")}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Conciliación RCV */}
        <TabsContent value="rcv" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold">Cruce & Conciliación con el Registro de Compras y Ventas (RCV)</h3>
              <p className="text-xs text-muted-foreground">
                Compara las facturas y boletas registradas en EasyERP contra los documentos oficiales informados al SII.
              </p>
            </div>
            <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Ingresar Documento RCV a Contrastar
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Contrastar Documento RCV</DialogTitle>
                  <DialogDescription>
                    Ingresa los datos del documento según el informe RCV descargado del SII para cruzar contra EasyERP.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-semibold">Operación</Label>
                      <Select value={rcvOperation} onValueChange={(val: any) => setRcvOperation(val)}>
                        <SelectTrigger className="mt-1 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="VENTA">Venta (Emitido)</SelectItem>
                          <SelectItem value="COMPRA">Compra (Recibido)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Tipo DTE</Label>
                      <Select value={rcvDocType} onValueChange={setRcvDocType}>
                        <SelectTrigger className="mt-1 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="33 Factura Electronica">33 Factura Electrónica</SelectItem>
                          <SelectItem value="34 Factura Exenta">34 Factura Exenta</SelectItem>
                          <SelectItem value="39 Boleta Electronica">39 Boleta Electrónica</SelectItem>
                          <SelectItem value="61 Nota de Credito">61 Nota de Crédito</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">N° Folio / Factura en SII *</Label>
                    <Input
                      placeholder="ej. 1045"
                      value={rcvDocNum}
                      onChange={(e) => setRcvDocNum(e.target.value)}
                      className="mt-1 font-mono uppercase"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">RUT Contraparte *</Label>
                    <Input
                      placeholder="ej. 76.123.456-K"
                      value={rcvRut}
                      onChange={(e) => setRcvRut(e.target.value)}
                      className="mt-1 font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Razón Social</Label>
                    <Input
                      placeholder="ej. Distribuidora Central SpA"
                      value={rcvPartyName}
                      onChange={(e) => setRcvPartyName(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-semibold">Monto Total en SII ($) *</Label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="ej. 595000"
                        value={rcvTotalAmount}
                        onChange={(e) => setRcvTotalAmount(e.target.value)}
                        className="mt-1 font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Fecha Emisión</Label>
                      <Input
                        type="date"
                        value={rcvDate}
                        onChange={(e) => setRcvDate(e.target.value)}
                        className="mt-1 font-mono"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => reconcileSingleDocMutation.mutate()}
                    disabled={reconcileSingleDocMutation.isPending || !rcvDocNum || !rcvRut || !rcvTotalAmount}
                  >
                    Contrastar Documento
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Historial de Extracciones ApiPyme */}
          {syncJobs.length > 0 && (
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CloudLightning className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Historial de Extracciones ApiPyme / SII
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">Últimas sincronizaciones</span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {syncJobs.map((job) => (
                  <div key={job.id} className="p-2.5 rounded-md bg-card border text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold capitalize text-foreground">
                        {job.module} ({job.period})
                      </span>
                      <Badge
                        className={
                          job.status === "SUCCESS"
                            ? "bg-emerald-600 text-white text-[10px]"
                            : job.status === "FAILED"
                            ? "bg-destructive text-white text-[10px]"
                            : "bg-amber-500 text-white text-[10px]"
                        }
                      >
                        {job.status === "PENDING" ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 animate-spin" /> En Curso
                          </span>
                        ) : (
                          job.status
                        )}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex justify-between">
                      <span>
                        Extraídos: <strong>{job.rows_extracted || 0}</strong> docs
                      </span>
                      <span>{new Date(job.requested_at).toLocaleDateString("es-CL")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* KPIs de la última corrida */}
          {latestRun && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                    Total Documentos Analizados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">{latestRun.total_items}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                    Documentos Coincidentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono text-emerald-600">
                    {latestRun.matched_items}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                    Diferencias / No Encontrados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono text-destructive">
                    {latestRun.unmatched_items}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tabla de Detalle de Conciliación */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Resultados del Cruce EasyERP vs. RCV</CardTitle>
              <CardDescription>
                Auditoría línea por línea identificando calces exactos, diferencias de monto o faltantes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!latestRun || (latestRun.rcv_reconciliation_items || []).length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No se han registrado corridas de conciliación RCV aún.
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Operación</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>RUT Contraparte</TableHead>
                        <TableHead>Razón Social</TableHead>
                        <TableHead className="text-right">Monto en EasyERP</TableHead>
                        <TableHead className="text-right">Monto en RCV (SII)</TableHead>
                        <TableHead className="text-right">Diferencia</TableHead>
                        <TableHead className="text-center">Estado Conciliación</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {latestRun.rcv_reconciliation_items.map((item: any) => {
                        const isMatched = item.matched;
                        const isMissing = item.status === "missing_in_easyerp";
                        const isMismatch = item.status === "amount_mismatch";

                        return (
                          <TableRow key={item.id} className="text-xs">
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-[10px]">
                                {item.operation_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono font-bold text-primary">
                              {item.document_number}
                            </TableCell>
                            <TableCell className="font-mono">{item.party_tax_id}</TableCell>
                            <TableCell className="font-medium">{item.party_name || "-"}</TableCell>
                            <TableCell className="text-right font-mono">
                              {item.amount_in_easyerp !== null ? `$ ${Number(item.amount_in_easyerp).toLocaleString("es-CL")}` : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold">
                              $ {Number(item.amount_in_rcv).toLocaleString("es-CL")}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold">
                              {Number(item.difference || 0) === 0 ? (
                                <span className="text-emerald-600">$ 0</span>
                              ) : (
                                <span className="text-destructive">$ {Number(item.difference).toLocaleString("es-CL")}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {isMatched && (
                                <Badge className="bg-emerald-600 text-white gap-1 text-[11px]">
                                  <CheckCircle2 className="h-3 w-3" /> Coincide
                                </Badge>
                              )}
                              {isMismatch && (
                                <Badge variant="outline" className="border-amber-500 text-amber-600 gap-1 text-[11px]">
                                  <AlertTriangle className="h-3 w-3" /> Monto Discrepante
                                </Badge>
                              )}
                              {isMissing && (
                                <Badge variant="destructive" className="gap-1 text-[11px]">
                                  <XCircle className="h-3 w-3" /> No registrado en ERP
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
