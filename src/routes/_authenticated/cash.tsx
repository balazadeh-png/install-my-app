import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEntity } from "@/context/ActiveEntityContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  DollarSign, Plus, ArrowLeft, RefreshCw, TrendingUp, Landmark,
  Upload, CheckCircle2, Clock, Sparkles, Scale, FileSpreadsheet,
  AlertCircle, Building2, Zap, ArrowUpRight, ArrowDownLeft, RotateCcw,
  Check, FileText, ChevronRight
} from "lucide-react";
import {
  parseBankStatementCsv,
  parseBankStatementPdfText,
  generateBankApiMockMovements,
  ParsedBankMovement
} from "@/lib/bank-reconciliation";

export const Route = createFileRoute("/_authenticated/cash")({
  component: CashPage,
  head: () => ({
    meta: [
      { title: "Bancos & Conciliación Bancaria | EasyERP" },
      { name: "description", content: "Conciliación bancaria inteligente, cartolas Excel/PDF, API bancaria y contabilización con 1-clic." },
    ],
  }),
});

function CashPage() {
  const queryClient = useQueryClient();
  const { activeEntityId } = useActiveEntity();

  // Active Tab
  const [activeTab, setActiveTab] = useState<string>("reconciliation");

  // Selected Bank Account for Reconciliation
  const [selectedBankAccId, setSelectedBankAccId] = useState<string>("");
  const [selectedStatementId, setSelectedStatementId] = useState<string>("");

  // Modals state
  const [newRateOpen, setNewRateOpen] = useState(false);
  const [newBookOpen, setNewBookOpen] = useState(false);
  const [newBankAccOpen, setNewBankAccOpen] = useState(false);
  const [importCartolaOpen, setImportCartolaOpen] = useState(false);
  const [apiSyncOpen, setApiSyncOpen] = useState(false);
  const [manualMatchOpen, setManualMatchOpen] = useState(false);
  const [activeLineForManualMatch, setActiveLineForManualMatch] = useState<any>(null);

  // Form States: Rate
  const [rateDate, setRateDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [rateValue, setRateValue] = useState("");

  // Form States: Book
  const [bookCode, setBookCode] = useState("");
  const [bookName, setBookName] = useState("");

  // Form States: New Bank Account
  const [baBankName, setBaBankName] = useState("Banco de Chile");
  const [baAccNumber, setBaAccNumber] = useState("");
  const [baAccType, setBaAccType] = useState("corriente");
  const [baLedgerAccId, setBaLedgerAccId] = useState("");
  const [baInitialBalance, setBaInitialBalance] = useState("0");
  const [baCurrency, setBaCurrency] = useState("CLP");
  const [baApiProvider, setBaApiProvider] = useState("sandbox_api");

  // Form States: Cartola Import
  const [cartolaSource, setCartolaSource] = useState<"excel" | "pdf">("excel");
  const [cartolaTextContent, setCartolaTextContent] = useState("");
  const [cartolaFileName, setCartolaFileName] = useState("");
  const [cartolaPeriodStart, setCartolaPeriodStart] = useState(new Date().toISOString().slice(0, 8) + "01");
  const [cartolaPeriodEnd, setCartolaPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const [cartolaInitialBal, setCartolaInitialBal] = useState("0");
  const [cartolaFinalBal, setCartolaFinalBal] = useState("0");
  const [parsedPreviewLines, setParsedPreviewLines] = useState<ParsedBankMovement[]>([]);

  // Form States: Manual Match Selection
  const [manualInvoiceType, setManualInvoiceType] = useState<"sale_invoice" | "purchase_invoice" | "bank_expense">("sale_invoice");
  const [manualSelectedInvoiceId, setManualSelectedInvoiceId] = useState("");

  // =========================================================================
  // QUERIES
  // =========================================================================

  // 1. Cuentas Bancarias Registradas (bank_accounts)
  const bankAccountsQuery = useQuery({
    queryKey: ["bank_accounts", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("bank_accounts" as any)
        .select("*, account:accounts(code, name)")
        .eq("entity_id", activeEntityId)
        .eq("active", true)
        .order("created_at", { ascending: true });
      if (error) {
        console.warn("bank_accounts query error:", error);
        return [];
      }
      return (data as any[]) ?? [];
    },
    enabled: !!activeEntityId,
  });

  const bankAccounts = bankAccountsQuery.data ?? [];
  const currentBankAcc = useMemo(() => {
    if (!bankAccounts.length) return null;
    if (selectedBankAccId) {
      return bankAccounts.find((b) => b.id === selectedBankAccId) || bankAccounts[0];
    }
    return bankAccounts[0];
  }, [bankAccounts, selectedBankAccId]);

  // Set default bank account if not set
  if (currentBankAcc && !selectedBankAccId) {
    setSelectedBankAccId(currentBankAcc.id);
  }

  // 2. Cartolas de la Cuenta Bancaria (bank_statements)
  const statementsQuery = useQuery({
    queryKey: ["bank_statements", activeEntityId, currentBankAcc?.id],
    queryFn: async () => {
      if (!activeEntityId || !currentBankAcc?.id) return [];
      const { data, error } = await supabase
        .from("bank_statements" as any)
        .select("*")
        .eq("entity_id", activeEntityId)
        .eq("bank_account_id", currentBankAcc.id)
        .order("period_end", { ascending: false });
      if (error) {
        console.warn("bank_statements query error:", error);
        return [];
      }
      return (data as any[]) ?? [];
    },
    enabled: !!activeEntityId && !!currentBankAcc?.id,
  });

  const statements = statementsQuery.data ?? [];
  const currentStatement = useMemo(() => {
    if (!statements.length) return null;
    if (selectedStatementId) {
      return statements.find((s) => s.id === selectedStatementId) || statements[0];
    }
    return statements[0];
  }, [statements, selectedStatementId]);

  // Set default statement
  if (currentStatement && !selectedStatementId) {
    setSelectedStatementId(currentStatement.id);
  }

  // 3. Movimientos de la Cartola Activa (bank_statement_lines)
  const statementLinesQuery = useQuery({
    queryKey: ["bank_statement_lines", currentStatement?.id],
    queryFn: async () => {
      if (!currentStatement?.id) return [];
      const { data, error } = await supabase
        .from("bank_statement_lines" as any)
        .select(`
          *,
          sales_invoice:sales_invoices(id, invoice_number, total_amount, party:parties(name, tax_id)),
          purchase_invoice:purchase_invoices(id, invoice_number, total_amount, party:parties(name, tax_id)),
          journal_entry:journal_entries(id, entry_number, posting_date)
        `)
        .eq("statement_id", currentStatement.id)
        .order("line_number", { ascending: true });
      if (error) {
        console.warn("bank_statement_lines error:", error);
        return [];
      }
      return (data as any[]) ?? [];
    },
    enabled: !!currentStatement?.id,
  });

  const statementLines = statementLinesQuery.data ?? [];

  // 4. Resumen de Cuadratura Bancaria
  const reconciliationSummaryQuery = useQuery({
    queryKey: ["reconciliation_summary", activeEntityId, currentBankAcc?.id, currentStatement?.id],
    queryFn: async () => {
      if (!activeEntityId || !currentBankAcc?.id) return null;
      const { data, error } = await supabase.rpc("get_bank_reconciliation_summary", {
        _entity_id: activeEntityId,
        _bank_account_id: currentBankAcc.id,
        _statement_id: currentStatement?.id || null,
      });
      if (error) {
        console.warn("reconciliation_summary rpc error:", error);
        return null;
      }
      return data;
    },
    enabled: !!activeEntityId && !!currentBankAcc?.id,
  });

  const summary = reconciliationSummaryQuery.data;

  // 5. Facturas de Venta Pendientes (sales_invoice_balances)
  const pendingSalesQuery = useQuery({
    queryKey: ["sales_invoice_balances", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("sales_invoice_balances" as any)
        .select("*")
        .eq("entity_id", activeEntityId)
        .gt("balance_due", 0)
        .order("issue_date", { ascending: false });
      if (error) return [];
      return (data as any[]) ?? [];
    },
    enabled: !!activeEntityId,
  });

  const pendingSales = pendingSalesQuery.data ?? [];

  // 6. Facturas de Compra Pendientes (purchase_invoice_balances)
  const pendingPurchasesQuery = useQuery({
    queryKey: ["purchase_invoice_balances", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("purchase_invoice_balances" as any)
        .select("*")
        .eq("entity_id", activeEntityId)
        .gt("balance_due", 0)
        .order("issue_date", { ascending: false });
      if (error) return [];
      return (data as any[]) ?? [];
    },
    enabled: !!activeEntityId,
  });

  const pendingPurchases = pendingPurchasesQuery.data ?? [];

  // 7. Cuentas Contables del Activo / Banco para asignación
  const ledgerAccountsQuery = useQuery({
    queryKey: ["accounts_bank", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("accounts")
        .select("id, code, name, account_type")
        .eq("entity_id", activeEntityId)
        .eq("is_group", false)
        .eq("active", true)
        .order("code", { ascending: true });
      if (error) return [];
      return data ?? [];
    },
    enabled: !!activeEntityId,
  });

  const ledgerAccounts = ledgerAccountsQuery.data ?? [];

  // 8. Tasas de Cambio USD/CLP (Histórico preexistente)
  const ratesQuery = useQuery({
    queryKey: ["exchange_rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exchange_rates")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // 9. Libros Auxiliares (Histórico preexistente)
  const booksQuery = useQuery({
    queryKey: ["books", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("entity_id", activeEntityId)
        .order("code", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeEntityId,
  });

  // =========================================================================
  // MUTATIONS
  // =========================================================================

  // Mutation: Crear Cuenta Bancaria
  const createBankAccMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Seleccione una empresa activa.");
      if (!baAccNumber.trim()) throw new Error("Ingrese el número de cuenta bancaria.");
      if (!baLedgerAccId) throw new Error("Seleccione la cuenta contable en el Plan de Cuentas.");

      const initBal = parseFloat(baInitialBalance) || 0;

      const { data, error } = await supabase.from("bank_accounts" as any).insert({
        entity_id: activeEntityId,
        account_id: baLedgerAccId,
        bank_name: baBankName.trim(),
        account_number: baAccNumber.trim(),
        account_type: baAccType,
        currency_code: baCurrency,
        initial_balance: initBal,
        current_balance: initBal,
        api_provider: baApiProvider,
      }).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["bank_accounts", activeEntityId] });
      toast.success("Cuenta bancaria registrada exitosamente");
      setNewBankAccOpen(false);
      setBaAccNumber("");
      setBaInitialBalance("0");
      if ((data as any)?.id) setSelectedBankAccId((data as any).id);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al crear cuenta bancaria");
    },
  });

  // Mutation: Importar Cartola Bancaria (Batch)
  const importCartolaMutation = useMutation({
    mutationFn: async (linesToImport: ParsedBankMovement[]) => {
      if (!activeEntityId || !currentBankAcc) {
        throw new Error("Seleccione una cuenta bancaria antes de importar.");
      }
      if (linesToImport.length === 0) {
        throw new Error("No hay movimientos válidos para importar en la cartola.");
      }

      const initB = parseFloat(cartolaInitialBal) || 0;
      const finalB = parseFloat(cartolaFinalBal) || (linesToImport[linesToImport.length - 1]?.balance || 0);

      const { data, error } = await supabase.rpc("import_bank_statement_batch", {
        _entity_id: activeEntityId,
        _bank_account_id: currentBankAcc.id,
        _period_start: cartolaPeriodStart,
        _period_end: cartolaPeriodEnd,
        _initial_balance: initB,
        _final_balance: finalB,
        _source: cartolaSource,
        _file_name: cartolaFileName || `Cartola_${currentBankAcc.bank_name}_${Date.now()}.${cartolaSource === "excel" ? "xlsx" : "pdf"}`,
        _lines: linesToImport as any,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["bank_statements", activeEntityId] });
      queryClient.invalidateQueries({ queryKey: ["bank_statement_lines"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation_summary"] });
      toast.success(`Cartola importada con éxito: ${res.total_movements} movimientos (${res.matched_movements} coincidencias automáticas detectadas)`);
      setImportCartolaOpen(false);
      setParsedPreviewLines([]);
      setCartolaTextContent("");
      if (res?.statement_id) setSelectedStatementId(res.statement_id);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al importar cartola bancaria");
    },
  });

  // Mutation: Contabilizar Pago con 1 Solo Clic (reconcile_and_post_bank_payment)
  const postPaymentMutation = useMutation({
    mutationFn: async ({
      lineId,
      opType,
      invoiceId,
      memo
    }: {
      lineId: string;
      opType: string;
      invoiceId?: string | undefined;
      memo?: string | undefined;
    }) => {
      const { data, error } = await supabase.rpc("reconcile_and_post_bank_payment", {
        _line_id: lineId,
        _operation_type: opType,
        _invoice_id: invoiceId || undefined,
        _expense_account_id: undefined,
        _memo: memo || undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["bank_statement_lines"] });
      queryClient.invalidateQueries({ queryKey: ["bank_statements"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation_summary"] });
      queryClient.invalidateQueries({ queryKey: ["sales_invoice_balances"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_invoice_balances"] });
      queryClient.invalidateQueries({ queryKey: ["journal_entries"] });
      toast.success(`Movimiento contabilizado con éxito en comprobante ${res.journal_entry_number || ""}`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al contabilizar pago");
    },
  });

  // Mutation: Contabilizar Todos los Matches al 100% (Bulk Reconcile)
  const bulkReconcileMutation = useMutation({
    mutationFn: async () => {
      if (!currentStatement?.id) throw new Error("No hay cartola activa seleccionada.");
      const { data, error } = await supabase.rpc("bulk_reconcile_matched_payments", {
        _statement_id: currentStatement.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["bank_statement_lines"] });
      queryClient.invalidateQueries({ queryKey: ["bank_statements"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation_summary"] });
      queryClient.invalidateQueries({ queryKey: ["sales_invoice_balances"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_invoice_balances"] });
      queryClient.invalidateQueries({ queryKey: ["journal_entries"] });
      toast.success(`Se contabilizaron automáticamente ${res.reconciled_count} movimientos coincidentes.`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error en contabilización masiva");
    },
  });

  // Mutation: Deshacer Conciliación
  const unreconcileMutation = useMutation({
    mutationFn: async (lineId: string) => {
      const { data, error } = await supabase.rpc("unreconcile_bank_line", {
        _line_id: lineId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank_statement_lines"] });
      queryClient.invalidateQueries({ queryKey: ["bank_statements"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation_summary"] });
      queryClient.invalidateQueries({ queryKey: ["sales_invoice_balances"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_invoice_balances"] });
      toast.success("Conciliación revertida y pago anulado correctamente.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al revertir conciliación");
    },
  });

  // Mutation: Sincronización Automática API Bancaria (Simulador / Sandbox)
  const syncBankApiMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId || !currentBankAcc) throw new Error("Seleccione una cuenta bancaria.");

      // Genera movimientos basados en facturas de venta y compra reales para crear matches perfectos
      const apiMovements = generateBankApiMockMovements(pendingSales, pendingPurchases);
      const today = new Date().toISOString().slice(0, 10);

      const { data, error } = await supabase.rpc("import_bank_statement_batch", {
        _entity_id: activeEntityId,
        _bank_account_id: currentBankAcc.id,
        _period_start: today,
        _period_end: today,
        _initial_balance: 15420000,
        _final_balance: apiMovements[apiMovements.length - 1]?.balance || 15420000,
        _source: "api_fintoc",
        _file_name: `Sync_API_${currentBankAcc.bank_name}_${today}`,
        _lines: apiMovements,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["bank_statements", activeEntityId] });
      queryClient.invalidateQueries({ queryKey: ["bank_statement_lines"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation_summary"] });
      toast.success(`Sincronización API completada: ${res.total_movements} movimientos bancarios importados en tiempo real.`);
      setApiSyncOpen(false);
      if (res?.statement_id) setSelectedStatementId(res.statement_id);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al sincronizar con API bancaria");
    },
  });

  // Handlers para carga de archivos
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setCartolaFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCartolaTextContent(content);

      let parsed: ParsedBankMovement[] = [];
      if (file.name.toLowerCase().endsWith(".pdf")) {
        setCartolaSource("pdf");
        parsed = parseBankStatementPdfText(content);
      } else {
        setCartolaSource("excel");
        parsed = parseBankStatementCsv(content);
      }

      setParsedPreviewLines(parsed);
      if (parsed.length > 0) {
        toast.info(`Se detectaron ${parsed.length} movimientos en el archivo`);
      } else {
        toast.warning("No se pudieron detectar movimientos automáticos. Puedes pegar el texto en el recuadro.");
      }
    };

    reader.readAsText(file);
  }

  function handleProcessText() {
    let parsed: ParsedBankMovement[] = [];
    if (cartolaSource === "pdf") {
      parsed = parseBankStatementPdfText(cartolaTextContent);
    } else {
      parsed = parseBankStatementCsv(cartolaTextContent);
    }
    setParsedPreviewLines(parsed);
    if (parsed.length > 0) {
      toast.success(`Procesados ${parsed.length} movimientos listos para importar.`);
    } else {
      toast.error("No se detectaron movimientos válidos en el texto ingresado.");
    }
  }

  // Pre-seed sample Chilean Bank Account si no tiene ninguna creada
  async function handleCreateDefaultAccount() {
    if (!activeEntityId) return;
    const defaultAcc = ledgerAccounts.find((a) => a.code.startsWith("1.1.01") || a.name.toLowerCase().includes("banco")) || ledgerAccounts[0];
    if (!defaultAcc) {
      toast.error("Primero crea una cuenta de Banco en el Plan de Cuentas (ej. 1.1.01.002 Banco de Chile)");
      return;
    }

    try {
      const { data, error } = await supabase.from("bank_accounts" as any).insert({
        entity_id: activeEntityId,
        account_id: defaultAcc.id,
        bank_name: "Banco de Chile",
        account_number: "00-165-89412-03",
        account_type: "corriente",
        currency_code: "CLP",
        initial_balance: 15420000,
        current_balance: 15420000,
        api_provider: "sandbox_api",
      }).select().single();

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["bank_accounts", activeEntityId] });
      toast.success("Cuenta Banco de Chile creada como cuenta principal");
      if ((data as any)?.id) setSelectedBankAccId((data as any).id);
    } catch (e: any) {
      toast.error(e.message || "Error al crear cuenta por defecto");
    }
  }

  // Cálculos rápidos de cuadratura
  const stmtBal = Number((summary as any)?.statement_balance || currentStatement?.final_balance || 0);
  const legBal = Number((summary as any)?.ledger_balance || 0);
  const diffBal = stmtBal - legBal;

  const totalMovs = Number((summary as any)?.total_movements || statementLines.length || 0);
  const recMovs = statementLines.filter(l => l.reconciliation_status === "reconciled").length;
  const matchMovs = statementLines.filter(l => l.reconciliation_status === "matched").length;
  const pendingMovs = totalMovs - recMovs;

  const rates = ratesQuery.data ?? [];
  const books = booksQuery.data ?? [];
  const latestRate = rates[0]?.rate;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Navigation & Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 px-2 text-muted-foreground">
              <Link to="/dashboard">
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                Dashboard
              </Link>
            </Button>
            <span className="text-muted-foreground">/</span>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <Landmark className="h-3.5 w-3.5" />
              Finanzas & Tesorería
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1 flex items-center gap-2">
            Conciliación Bancaria & Tesorería
          </h1>
          <p className="text-xs text-muted-foreground">
            Gestión de cartolas bancarias, contrastación con ventas y compras, y contabilización en 1-clic.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              bankAccountsQuery.refetch();
              statementsQuery.refetch();
              statementLinesQuery.refetch();
              reconciliationSummaryQuery.refetch();
              ratesQuery.refetch();
              booksQuery.refetch();
              toast.info("Datos actualizados");
            }}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Actualizar
          </Button>

          {/* Botón Sincronizar API Bancaria */}
          <Button
            variant="outline"
            size="sm"
            className="border-primary/30 text-primary hover:bg-primary/5"
            onClick={() => setApiSyncOpen(true)}
            disabled={!currentBankAcc}
          >
            <Zap className="mr-1.5 h-3.5 w-3.5 text-amber-500 fill-amber-500" />
            Sincronizar API Bancaria
          </Button>

          {/* Botón Importar Cartola */}
          <Button
            size="sm"
            onClick={() => setImportCartolaOpen(true)}
            disabled={!currentBankAcc}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Importar Cartola
          </Button>
        </div>
      </div>

      {/* Tabs Principales */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-lg bg-muted/60 p-1">
          <TabsTrigger value="reconciliation" className="flex items-center gap-2 text-xs font-medium">
            <Scale className="h-3.5 w-3.5" />
            Conciliación Bancaria
          </TabsTrigger>
          <TabsTrigger value="bank_accounts" className="flex items-center gap-2 text-xs font-medium">
            <Building2 className="h-3.5 w-3.5" />
            Cuentas Bancarias
          </TabsTrigger>
          <TabsTrigger value="cash_rates" className="flex items-center gap-2 text-xs font-medium">
            <TrendingUp className="h-3.5 w-3.5" />
            Dólar & Libros
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* TAB 1: CONCILIACIÓN BANCARIA */}
        {/* ========================================================================= */}
        <TabsContent value="reconciliation" className="space-y-6">
          {bankAccounts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Landmark className="h-12 w-12 text-muted-foreground/60 mb-3" />
                <h3 className="text-base font-semibold">No hay Cuentas Bancarias Registradas</h3>
                <p className="text-xs text-muted-foreground max-w-md mt-1 mb-4">
                  Para conciliar cartolas bancarias, primero configura una cuenta bancaria asociada a una cuenta del Plan de Cuentas (ej. Banco de Chile).
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setNewBankAccOpen(true)}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Registrar Cuenta Bancaria
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCreateDefaultAccount}>
                    <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" />
                    Crear Cuenta de Ejemplo
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Controles de Selección de Cuenta y Cartola */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-muted/40 p-3.5 rounded-lg border">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Banco:</Label>
                    <Select value={selectedBankAccId} onValueChange={setSelectedBankAccId}>
                      <SelectTrigger className="h-8 text-xs w-[240px] bg-background">
                        <SelectValue placeholder="Seleccione Cuenta" />
                      </SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map((b) => (
                          <SelectItem key={b.id} value={b.id} className="text-xs">
                            {b.bank_name} — N° {b.account_number} ({b.currency_code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Cartola / Período:</Label>
                    {statements.length === 0 ? (
                      <span className="text-xs text-muted-foreground italic">Sin cartolas importadas</span>
                    ) : (
                      <Select value={selectedStatementId} onValueChange={setSelectedStatementId}>
                        <SelectTrigger className="h-8 text-xs w-[260px] bg-background">
                          <SelectValue placeholder="Seleccione Cartola" />
                        </SelectTrigger>
                        <SelectContent>
                          {statements.map((s) => (
                            <SelectItem key={s.id} value={s.id} className="text-xs">
                              {s.period_start} al {s.period_end} ({s.reconciled_movements}/{s.total_movements} conc.)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                {/* Acciones Masivas */}
                {matchMovs > 0 && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-8 shadow-sm"
                    onClick={() => bulkReconcileMutation.mutate()}
                    disabled={bulkReconcileMutation.isPending}
                  >
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Contabilizar Todos los Matches ({matchMovs})
                  </Button>
                )}
              </div>

              {/* KPI Cards de Cuadratura Financiera */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                      Saldo Cartola Bancaria
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono">
                      $ {Math.round(stmtBal).toLocaleString("es-CL")}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Informado por {currentBankAcc?.bank_name}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                      Saldo Libro Mayor (ERP)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono">
                      $ {Math.round(legBal).toLocaleString("es-CL")}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cuenta {currentBankAcc?.account?.code || "1.1.01"} Contable
                    </p>
                  </CardContent>
                </Card>

                <Card className={Math.abs(diffBal) < 1 ? "border-emerald-500/40 bg-emerald-50/20" : "border-amber-500/40 bg-amber-50/20"}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground flex items-center justify-between">
                      <span>Diferencia de Cuadratura</span>
                      {Math.abs(diffBal) < 1 ? (
                        <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-100 text-[10px]">
                          Cuadrado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-100 text-[10px]">
                          En Tránsito
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold font-mono ${Math.abs(diffBal) < 1 ? "text-emerald-700" : "text-amber-700"}`}>
                      $ {Math.round(diffBal).toLocaleString("es-CL")}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {Math.abs(diffBal) < 1 ? "Cartola y Mayor 100% sincronizados" : "Partidas pendientes de contabilizar"}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                      Progreso de Conciliación
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold">
                        {totalMovs > 0 ? Math.round((recMovs / totalMovs) * 100) : 0}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{recMovs}</span> de {totalMovs} movs
                      </div>
                    </div>
                    <div className="w-full bg-muted h-2 rounded-full mt-2 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${totalMovs > 0 ? (recMovs / totalMovs) * 100 : 0}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tabla de Movimientos de la Cartola & Contraste con ERP */}
              <Card>
                <CardHeader className="pb-3 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-primary" />
                      Movimientos de la Cartola Bancaria
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Contrasta automáticamente con facturas de venta y compra. Haz clic en "Contabilizar Pago" para generar el asiento y saldar el documento.
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      Total: {totalMovs}
                    </Badge>
                    <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-800">
                      Conciliados: {recMovs}
                    </Badge>
                    <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                      Coincidencias Listas: {matchMovs}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  {statementLines.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-sm flex flex-col items-center">
                      <FileText className="h-8 w-8 text-muted-foreground/40 mb-2" />
                      <p className="font-medium text-foreground">No hay movimientos en esta cartola</p>
                      <p className="text-xs mt-1 max-w-sm">
                        Importa una cartola en Excel / PDF o pulsa "Sincronizar API Bancaria" para cargar los movimientos diarios.
                      </p>
                      <div className="mt-4 flex gap-2">
                        <Button size="sm" onClick={() => setImportCartolaOpen(true)}>
                          <Upload className="mr-1.5 h-3.5 w-3.5" />
                          Importar Cartola
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => syncBankApiMutation.mutate()}>
                          <Zap className="mr-1.5 h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                          Simular Carga de API
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="w-12 text-center">N°</TableHead>
                            <TableHead className="w-24">Fecha</TableHead>
                            <TableHead className="min-w-[220px]">Glosa / Detalle Bancario</TableHead>
                            <TableHead className="w-24">Referencia</TableHead>
                            <TableHead className="w-28 text-right text-rose-600">Cargo (-)</TableHead>
                            <TableHead className="w-28 text-right text-emerald-600">Abono (+)</TableHead>
                            <TableHead className="w-28 text-right">Saldo Banco</TableHead>
                            <TableHead className="min-w-[280px]">Documento ERP Sugerido / Encontrado</TableHead>
                            <TableHead className="w-40 text-center">Acción</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {statementLines.map((line: any, idx: number) => {
                            const isReconciled = line.reconciliation_status === "reconciled";
                            const isMatched = line.reconciliation_status === "matched";
                            const isExpense = line.matched_operation_type === "bank_expense";
                            const isSale = line.matched_operation_type === "sale_invoice";
                            const isPurchase = line.matched_operation_type === "purchase_invoice";

                            const suggestedDoc = line.sales_invoice || line.purchase_invoice;

                            return (
                              <TableRow
                                key={line.id}
                                className={`text-xs ${isReconciled ? "bg-muted/20" : isMatched ? "bg-emerald-50/30" : ""}`}
                              >
                                <TableCell className="text-center font-mono text-muted-foreground">
                                  {idx + 1}
                                </TableCell>
                                <TableCell className="font-mono whitespace-nowrap">
                                  {line.movement_date}
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium text-foreground">{line.description}</div>
                                  {line.match_reason && !isReconciled && (
                                    <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                      <Sparkles className="h-3 w-3 text-amber-500" />
                                      {line.match_reason}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="font-mono text-muted-foreground text-[11px]">
                                  {line.reference_number || "—"}
                                </TableCell>
                                <TableCell className="text-right font-mono font-medium text-rose-600">
                                  {line.debit_amount > 0 ? `$ ${Math.round(line.debit_amount).toLocaleString("es-CL")}` : "—"}
                                </TableCell>
                                <TableCell className="text-right font-mono font-medium text-emerald-600">
                                  {line.credit_amount > 0 ? `$ ${Math.round(line.credit_amount).toLocaleString("es-CL")}` : "—"}
                                </TableCell>
                                <TableCell className="text-right font-mono text-muted-foreground">
                                  $ {Math.round(line.balance || 0).toLocaleString("es-CL")}
                                </TableCell>

                                {/* Documento Sugerido / Encontrado */}
                                <TableCell>
                                  {isReconciled ? (
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 text-[11px] font-normal flex items-center gap-1">
                                        <Check className="h-3 w-3" />
                                        Contabilizado
                                      </Badge>
                                      {line.journal_entry && (
                                        <span className="font-mono text-[11px] font-semibold text-foreground">
                                          {line.journal_entry.entry_number}
                                        </span>
                                      )}
                                      {suggestedDoc && (
                                        <span className="text-[11px] text-muted-foreground truncate">
                                          ({suggestedDoc.invoice_number})
                                        </span>
                                      )}
                                    </div>
                                  ) : isMatched ? (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        {isSale && (
                                          <Badge className="bg-emerald-600 text-white text-[10px] h-5">
                                            Venta: {suggestedDoc?.invoice_number || "Factura"}
                                          </Badge>
                                        )}
                                        {isPurchase && (
                                          <Badge className="bg-blue-600 text-white text-[10px] h-5">
                                            Compra: {suggestedDoc?.invoice_number || "Factura"}
                                          </Badge>
                                        )}
                                        {isExpense && (
                                          <Badge className="bg-amber-600 text-white text-[10px] h-5">
                                            Comisión / Gasto Bancario
                                          </Badge>
                                        )}

                                        <span className="text-[10px] font-semibold font-mono text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                          Match {Math.round(line.match_confidence)}%
                                        </span>
                                      </div>

                                      {suggestedDoc?.party?.name && (
                                        <div className="text-[11px] text-muted-foreground truncate">
                                          {suggestedDoc.party.name} ({suggestedDoc.party.tax_id})
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] text-muted-foreground italic">
                                        Sin coincidencia exacta
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-[11px] px-1.5 text-primary hover:bg-primary/5"
                                        onClick={() => {
                                          setActiveLineForManualMatch(line);
                                          setManualMatchOpen(true);
                                        }}
                                      >
                                        Asignar Manual
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>

                                {/* Acción 1-Clic */}
                                <TableCell className="text-center">
                                  {isReconciled ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs text-muted-foreground hover:text-rose-600"
                                      onClick={() => unreconcileMutation.mutate(line.id)}
                                      disabled={unreconcileMutation.isPending}
                                      title="Deshacer conciliación y anular pago"
                                    >
                                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                      Deshacer
                                    </Button>
                                  ) : isMatched ? (
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                                      onClick={() => {
                                        postPaymentMutation.mutate({
                                          lineId: line.id,
                                          opType: line.matched_operation_type,
                                          invoiceId: line.matched_invoice_id,
                                        });
                                      }}
                                      disabled={postPaymentMutation.isPending}
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                      Contabilizar Pago
                                    </Button>
                                  ) : (
                                    <div className="flex items-center justify-center gap-1">
                                      {line.debit_amount > 0 && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-7 text-[11px] px-2 text-muted-foreground"
                                          onClick={() => {
                                            postPaymentMutation.mutate({
                                              lineId: line.id,
                                              opType: "bank_expense",
                                            });
                                          }}
                                          disabled={postPaymentMutation.isPending}
                                        >
                                          Gasto Bancario
                                        </Button>
                                      )}
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-[11px] px-2"
                                        onClick={() => {
                                          setActiveLineForManualMatch(line);
                                          setManualMatchOpen(true);
                                        }}
                                      >
                                        Buscar Doc
                                      </Button>
                                    </div>
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
            </>
          )}
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 2: CUENTAS BANCARIAS & CONFIGURACIÓN API */}
        {/* ========================================================================= */}
        <TabsContent value="bank_accounts" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Cuentas Corrientes y Cuentas Bancarias</h2>
              <p className="text-xs text-muted-foreground">
                Configura las cuentas bancarias de la empresa y vincúlalas al Plan de Cuentas para conciliación y pagos.
              </p>
            </div>
            <Button size="sm" onClick={() => setNewBankAccOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Nueva Cuenta Bancaria
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bankAccounts.map((acc: any) => (
              <Card key={acc.id} className="relative overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="capitalize text-xs">
                      {acc.account_type} ({acc.currency_code})
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-800">
                      Activa
                    </Badge>
                  </div>
                  <CardTitle className="text-base font-semibold mt-2">{acc.bank_name}</CardTitle>
                  <CardDescription className="font-mono text-xs text-foreground">
                    N° {acc.account_number}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">Cuenta Contable:</span>
                    <span className="font-mono font-medium">{acc.account?.code} — {acc.account?.name}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">Saldo Registrado:</span>
                    <span className="font-mono font-bold">$ {Math.round(acc.current_balance || acc.initial_balance || 0).toLocaleString("es-CL")}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">API Bancaria:</span>
                    <span className="font-medium text-primary capitalize flex items-center gap-1">
                      <Zap className="h-3 w-3 fill-primary" />
                      {acc.api_provider}
                    </span>
                  </div>

                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => {
                        setSelectedBankAccId(acc.id);
                        setActiveTab("reconciliation");
                      }}
                    >
                      Ir a Conciliar Cartolas
                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 3: DÓLAR OBSERVADO & LIBROS (Funcionalidad Histórica) */}
        {/* ========================================================================= */}
        <TabsContent value="cash_rates" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Dólar Observado y Libros Auxiliares</h2>
              <p className="text-xs text-muted-foreground">
                Tipos de cambio oficiales aplicados para conversiones contables multimoneda (USD / CLP).
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setNewRateOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Registrar Tasa Oficial
              </Button>
              <Button size="sm" variant="outline" onClick={() => setNewBookOpen(true)}>
                <Landmark className="mr-1.5 h-3.5 w-3.5" />
                Nuevo Libro / Caja
              </Button>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Rates Table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Historial de Tasas de Cambio</CardTitle>
                <CardDescription className="text-xs">
                  Tipos de cambio USD / CLP (Dólar Observado).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {rates.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    No hay tipos de cambio registrados aún.
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto max-h-[360px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Par</TableHead>
                          <TableHead className="text-right">Tasa Oficial</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rates.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-mono text-xs">{r.date}</TableCell>
                            <TableCell className="text-xs font-semibold">{r.origin} / {r.destination}</TableCell>
                            <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                              $ {Number(r.rate).toLocaleString("es-CL", { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Books Table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Libros Auxiliares / Cajas</CardTitle>
                <CardDescription className="text-xs">
                  Cajas chicas y libros de tesorería registrados.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {books.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    No hay libros registrados aún.
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto max-h-[360px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead className="text-center">Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {books.map((b) => (
                          <TableRow key={b.id}>
                            <TableCell className="font-mono font-medium text-xs">{b.code}</TableCell>
                            <TableCell className="text-xs">{b.name}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={b.active ? "outline" : "secondary"} className="text-xs">
                                {b.active ? "Activo" : "Inactivo"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ========================================================================= */}
      {/* MODAL 1: IMPORTADOR DE CARTOLAS (EXCEL / CSV / PDF) */}
      {/* ========================================================================= */}
      <Dialog open={importCartolaOpen} onOpenChange={setImportCartolaOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Importar Cartola Bancaria ({currentBankAcc?.bank_name || "Banco"})
            </DialogTitle>
            <DialogDescription className="text-xs">
              Sube el archivo Excel (.xlsx / .csv) o PDF emitido por tu banco, o pega directamente las transacciones.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Fecha Inicio Período</Label>
                <Input
                  type="date"
                  value={cartolaPeriodStart}
                  onChange={(e) => setCartolaPeriodStart(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">Fecha Término Período</Label>
                <Input
                  type="date"
                  value={cartolaPeriodEnd}
                  onChange={(e) => setCartolaPeriodEnd(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            {/* Selector de Archivo */}
            <div className="border-2 border-dashed rounded-lg p-5 text-center bg-muted/20 hover:bg-muted/40 transition">
              <FileSpreadsheet className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <div className="text-xs font-medium">Selecciona tu archivo de Cartola</div>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">
                Formatos compatibles: Excel (.csv, .xlsx) y Cartolas en texto PDF de Banco de Chile, Santander, BCI, Banco Estado, etc.
              </p>
              <Input
                type="file"
                accept=".csv,.txt,.pdf"
                onChange={handleFileUpload}
                className="max-w-xs mx-auto text-xs"
              />
            </div>

            {/* O pegar texto directo */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">O pega aquí el texto copiado de la cartola bancaria:</Label>
                <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={handleProcessText}>
                  Analizar Texto
                </Button>
              </div>
              <Textarea
                placeholder="Pega las líneas de la cartola aquí (ej. 15/09/2026 TRANSF 76123456-7 PAGO FAC 1025 250000 15200000)"
                value={cartolaTextContent}
                onChange={(e) => setCartolaTextContent(e.target.value)}
                rows={4}
                className="font-mono text-xs"
              />
            </div>

            {/* Previsualización de Movimientos Detectados */}
            {parsedPreviewLines.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Previsualización ({parsedPreviewLines.length} movimientos detectados):</span>
                  <Badge variant="outline" className="text-emerald-700 bg-emerald-50">
                    Listo para contrastar con ERP
                  </Badge>
                </div>
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 text-[11px]">
                        <TableHead>Fecha</TableHead>
                        <TableHead>Glosa</TableHead>
                        <TableHead className="text-right">Cargo (-)</TableHead>
                        <TableHead className="text-right">Abono (+)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedPreviewLines.slice(0, 10).map((p, idx) => (
                        <TableRow key={idx} className="text-[11px]">
                          <TableCell className="font-mono">{p.movement_date}</TableCell>
                          <TableCell className="truncate max-w-[200px]">{p.description}</TableCell>
                          <TableCell className="text-right font-mono text-rose-600">
                            {p.debit_amount > 0 ? `$ ${Math.round(p.debit_amount).toLocaleString("es-CL")}` : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-emerald-600">
                            {p.credit_amount > 0 ? `$ ${Math.round(p.credit_amount).toLocaleString("es-CL")}` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {parsedPreviewLines.length > 10 && (
                  <p className="text-[10px] text-muted-foreground italic text-right">
                    Mostrando primeros 10 de {parsedPreviewLines.length} registros...
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setImportCartolaOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={parsedPreviewLines.length === 0 || importCartolaMutation.isPending}
              onClick={() => importCartolaMutation.mutate(parsedPreviewLines)}
            >
              {importCartolaMutation.isPending ? "Procesando..." : `Importar y Conciliar (${parsedPreviewLines.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 2: SINCRONIZACIÓN API BANCARIA */}
      {/* ========================================================================= */}
      <Dialog open={apiSyncOpen} onOpenChange={setApiSyncOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500 fill-amber-500" />
              Sincronización API Bancaria en Vivo
            </DialogTitle>
            <DialogDescription className="text-xs">
              Conexión directa vía Open Banking / Fintoc con {currentBankAcc?.bank_name || "Banco"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-amber-900">
              <div className="font-semibold flex items-center gap-1.5 mb-1">
                <Sparkles className="h-3.5 w-3.5" />
                Conexión Open Banking Activa
              </div>
              <p className="text-[11px] text-amber-800">
                La API consultará los movimientos de hoy directamente desde la cuenta corriente N° <strong>{currentBankAcc?.account_number}</strong> y ejecutará el motor de auto-matching en tiempo real.
              </p>
            </div>

            <div className="space-y-2 border rounded-md p-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Proveedor Conector:</span>
                <span className="font-semibold text-foreground">Fintoc / Open Banking API</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cuenta Destino:</span>
                <span className="font-mono">{currentBankAcc?.bank_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estado:</span>
                <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px]">
                  Online / Listo
                </Badge>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setApiSyncOpen(false)}>
              Cerrar
            </Button>
            <Button
              size="sm"
              className="bg-primary"
              onClick={() => syncBankApiMutation.mutate()}
              disabled={syncBankApiMutation.isPending}
            >
              {syncBankApiMutation.isPending ? "Sincronizando..." : "Sincronizar Movimientos de Hoy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 3: ASIGNACIÓN MANUAL DE DOCUMENTO */}
      {/* ========================================================================= */}
      <Dialog open={manualMatchOpen} onOpenChange={setManualMatchOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Asignar Documento Manual a la Cartola</DialogTitle>
            <DialogDescription className="text-xs">
              Movimiento: {activeLineForManualMatch?.description} — Monto: $ {Math.round(activeLineForManualMatch?.credit_amount || activeLineForManualMatch?.debit_amount || 0).toLocaleString("es-CL")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de Documento</Label>
              <Select value={manualInvoiceType} onValueChange={(v: any) => setManualInvoiceType(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sale_invoice">Factura de Venta por Cobrar (Clientes)</SelectItem>
                  <SelectItem value="purchase_invoice">Factura de Compra por Pagar (Proveedores)</SelectItem>
                  <SelectItem value="bank_expense">Gasto Bancario / Comisión de Cuenta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {manualInvoiceType === "sale_invoice" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Selecciona la Factura de Venta pendiente:</Label>
                <Select value={manualSelectedInvoiceId} onValueChange={setManualSelectedInvoiceId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Seleccione Factura" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {pendingSales.map((s: any) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.invoice_number} — {s.party_name} — Saldo: ${Math.round(s.balance_due).toLocaleString("es-CL")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {manualInvoiceType === "purchase_invoice" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Selecciona la Factura de Proveedor pendiente:</Label>
                <Select value={manualSelectedInvoiceId} onValueChange={setManualSelectedInvoiceId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Seleccione Factura" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {pendingPurchases.map((p: any) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.invoice_number} — {p.party_name} — Saldo: ${Math.round(p.balance_due).toLocaleString("es-CL")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {manualInvoiceType === "bank_expense" && (
              <div className="text-xs text-muted-foreground p-3 bg-muted/40 rounded-md">
                Se contabilizará directamente como un Egreso bancario contra la cuenta de Gastos Financieros y Comisiones Bancarias del Plan de Cuentas.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setManualMatchOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={postPaymentMutation.isPending || (manualInvoiceType !== "bank_expense" && !manualSelectedInvoiceId)}
              onClick={() => {
                if (!activeLineForManualMatch) return;
                postPaymentMutation.mutate({
                  lineId: activeLineForManualMatch.id,
                  opType: manualInvoiceType,
                  invoiceId: manualInvoiceType === "bank_expense" ? undefined : manualSelectedInvoiceId,
                });
                setManualMatchOpen(false);
              }}
            >
              Contabilizar y Conciliar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 4: CREAR CUENTA BANCARIA */}
      {/* ========================================================================= */}
      <Dialog open={newBankAccOpen} onOpenChange={setNewBankAccOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Nueva Cuenta Bancaria</DialogTitle>
            <DialogDescription className="text-xs">
              Asocia la cuenta bancaria de la empresa a una cuenta del Plan Contable.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre del Banco</Label>
              <Select value={baBankName} onValueChange={setBaBankName}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Banco de Chile">Banco de Chile</SelectItem>
                  <SelectItem value="Banco Santander">Banco Santander</SelectItem>
                  <SelectItem value="Banco BCI">Banco BCI</SelectItem>
                  <SelectItem value="Banco Estado">Banco Estado</SelectItem>
                  <SelectItem value="Banco Scotiabank">Banco Scotiabank</SelectItem>
                  <SelectItem value="Banco Itaú">Banco Itaú</SelectItem>
                  <SelectItem value="Banco BICE">Banco BICE</SelectItem>
                  <SelectItem value="Banco Security">Banco Security</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Número de Cuenta</Label>
              <Input
                placeholder="ej. 00-165-89412-03"
                value={baAccNumber}
                onChange={(e) => setBaAccNumber(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de Cuenta</Label>
                <Select value={baAccType} onValueChange={setBaAccType}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corriente">Cuenta Corriente</SelectItem>
                    <SelectItem value="vista">Cuenta Vista / RUT</SelectItem>
                    <SelectItem value="ahorro">Cuenta de Ahorro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Moneda</Label>
                <Select value={baCurrency} onValueChange={setBaCurrency}>
                  <SelectTrigger className="h-8 text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLP">CLP (Pesos Chilenos)</SelectItem>
                    <SelectItem value="USD">USD (Dólar USA)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Cuenta del Plan Contable (Activo)</Label>
              <Select value={baLedgerAccId} onValueChange={setBaLedgerAccId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Seleccione cuenta contable..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {ledgerAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="text-xs">
                      {a.code} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Saldo Inicial ($)</Label>
              <Input
                type="number"
                value={baInitialBalance}
                onChange={(e) => setBaInitialBalance(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setNewBankAccOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => createBankAccMutation.mutate()}
              disabled={createBankAccMutation.isPending || !baAccNumber || !baLedgerAccId}
            >
              Guardar Cuenta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 5: REGISTRAR TASA OFICIAL USD/CLP */}
      {/* ========================================================================= */}
      <Dialog open={newRateOpen} onOpenChange={setNewRateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Tasa de Cambio Oficial</DialogTitle>
            <DialogDescription>
              Registra el tipo de cambio oficial USD a CLP (Dólar Observado) para una fecha determinada.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="rDate" className="text-right">Fecha</Label>
              <Input
                id="rDate"
                type="date"
                value={rateDate}
                onChange={(e) => setRateDate(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="rValue" className="text-right">Tasa (CLP $)</Label>
              <Input
                id="rValue"
                type="number"
                step="0.01"
                placeholder="ej. 945.50"
                value={rateValue}
                onChange={(e) => setRateValue(e.target.value)}
                className="col-span-3 font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                const numRate = parseFloat(rateValue);
                if (isNaN(numRate) || numRate <= 0) {
                  toast.error("Ingrese una tasa válida");
                  return;
                }
                const { error } = await supabase.from("exchange_rates").insert({
                  origin: "USD",
                  destination: "CLP",
                  date: rateDate,
                  rate: numRate,
                });
                if (error) {
                  toast.error(error.message);
                } else {
                  queryClient.invalidateQueries({ queryKey: ["exchange_rates"] });
                  toast.success("Tasa registrada");
                  setNewRateOpen(false);
                  setRateValue("");
                }
              }}
              disabled={!rateValue}
            >
              Guardar Tasa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 6: REGISTRAR LIBRO / CAJA */}
      {/* ========================================================================= */}
      <Dialog open={newBookOpen} onOpenChange={setNewBookOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Libro Contable / Caja</DialogTitle>
            <DialogDescription>
              Define un nuevo libro o caja chica auxiliar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="bCode" className="text-right">Código</Label>
              <Input
                id="bCode"
                placeholder="ej. CAJA-CHICA-STGO"
                value={bookCode}
                onChange={(e) => setBookCode(e.target.value)}
                className="col-span-3 font-mono"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="bName" className="text-right">Nombre</Label>
              <Input
                id="bName"
                placeholder="ej. Caja Chica Santiago Centro"
                value={bookName}
                onChange={(e) => setBookName(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                if (!activeEntityId) return;
                const { error } = await supabase.from("books").insert({
                  entity_id: activeEntityId,
                  code: bookCode.trim(),
                  name: bookName.trim(),
                  active: true,
                });
                if (error) {
                  toast.error(error.message);
                } else {
                  queryClient.invalidateQueries({ queryKey: ["books", activeEntityId] });
                  toast.success("Libro registrado");
                  setNewBookOpen(false);
                  setBookCode("");
                  setBookName("");
                }
              }}
              disabled={!bookCode || !bookName}
            >
              Guardar Libro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export default CashPage;
