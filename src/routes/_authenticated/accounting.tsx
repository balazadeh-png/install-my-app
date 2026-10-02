import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
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
import { toast } from "sonner";
import {
  BookOpen,
  Plus,
  ArrowLeft,
  RefreshCw,
  FileText,
  ListTree,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  PieChart,
  Network,
  ArrowUpRight,
} from "lucide-react";
import { SourceDocumentDialog } from "@/components/accounting/SourceDocumentDialog";
import { AccountLedgerDrawer } from "@/components/accounting/AccountLedgerDrawer";

export const Route = createFileRoute("/_authenticated/accounting")({
  component: AccountingPage,
  head: () => ({
    meta: [
      { title: "Contabilidad, Multimoneda & Centros de Costo | EasyERP" },
      { name: "description", content: "Plan de cuentas, centros de costo, sucursales y comprobantes contables por partida doble." },
    ],
  }),
});

interface JournalLineForm {
  account_id: string;
  party_id?: string;
  cost_center_id?: string;
  business_unit_id?: string;
  debit: string;
  credit: string;
  memo: string;
}

function AccountingPage() {
  const queryClient = useQueryClient();
  const { activeEntity, activeEntityId } = useActiveEntity();
  const [newAccountOpen, setNewAccountOpen] = useState(false);
  const [newVoucherOpen, setNewVoucherOpen] = useState(false);
  const [quickRateOpen, setQuickRateOpen] = useState(false);
  const [quickRateValue, setQuickRateValue] = useState("");

  // Drill-down a Documento Fuente y Mayor
  const [selectedJournalEntryId, setSelectedJournalEntryId] = useState<string | null>(null);
  const [sourceDocModalOpen, setSourceDocModalOpen] = useState(false);
  const [selectedAccountForLedger, setSelectedAccountForLedger] = useState<{
    id: string;
    code: string;
    name: string;
    account_type: string;
  } | null>(null);
  const [ledgerDrawerOpen, setLedgerDrawerOpen] = useState(false);

  // Form State para Nueva Cuenta
  const [accountCode, setAccountCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("Asset");
  const [accountCurrency, setAccountCurrency] = useState<string>("DEFAULT");
  const [requiresCc, setRequiresCc] = useState(false);
  const [requiresBu, setRequiresBu] = useState(false);
  const [isGroup, setIsGroup] = useState(false);

  // Form State para Nuevo Comprobante Contable
  const [voucherDate, setVoucherDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [voucherType, setVoucherType] = useState("Manual");
  const [voucherBookId, setVoucherBookId] = useState<string>("");
  const [voucherMemo, setVoucherMemo] = useState("");
  const [lines, setLines] = useState<JournalLineForm[]>([
    { account_id: "", debit: "", credit: "", memo: "" },
    { account_id: "", debit: "", credit: "", memo: "" },
  ]);

  const baseCurrency = activeEntity?.base_currency_code || "CLP";

  // Queries
  const currenciesQuery = useQuery({
    queryKey: ["currencies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("currencies").select("*").order("code");
      if (error) throw error;
      return data ?? [];
    },
  });

  const exchangeRatesQuery = useQuery({
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

  const accountsQuery = useQuery({
    queryKey: ["accounts", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("entity_id", activeEntityId)
        .order("code", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeEntityId,
  });

  const costCentersQuery = useQuery({
    queryKey: ["cost_centers", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("cost_centers")
        .select("*")
        .eq("entity_id", activeEntityId)
        .eq("active", true)
        .order("code");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeEntityId,
  });

  const businessUnitsQuery = useQuery({
    queryKey: ["business_units", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("business_units")
        .select("*")
        .eq("entity_id", activeEntityId)
        .eq("active", true)
        .order("code");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeEntityId,
  });

  const booksQuery = useQuery({
    queryKey: ["books", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("entity_id", activeEntityId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeEntityId,
  });

  const partiesQuery = useQuery({
    queryKey: ["parties", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("parties")
        .select("id, name, tax_id")
        .eq("entity_id", activeEntityId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeEntityId,
  });

  const journalEntriesQuery = useQuery({
    queryKey: ["journal_entries", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("journal_entries")
        .select(`
          *,
          books(name),
          journal_entry_lines(
            id,
            line_no,
            account_id,
            party_id,
            cost_center_id,
            business_unit_id,
            currency_code,
            exchange_rate,
            debit_account_currency,
            credit_account_currency,
            debit,
            credit,
            memo,
            accounts(code, name, currency_code),
            parties(name, tax_id),
            cost_centers(code, name),
            business_units(code, name)
          )
        `)
        .eq("entity_id", activeEntityId)
        .order("posting_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeEntityId,
  });

  const currencies = currenciesQuery.data ?? [];
  const exchangeRates = exchangeRatesQuery.data ?? [];
  const accounts = accountsQuery.data ?? [];
  const costCenters = costCentersQuery.data ?? [];
  const businessUnits = businessUnitsQuery.data ?? [];
  const books = booksQuery.data ?? [];
  const parties = partiesQuery.data ?? [];
  const journalEntries = journalEntriesQuery.data ?? [];

  // Helper tasa de cambio
  const findExchangeRate = (fromCurr: string, toCurr: string, dateStr: string): number | null => {
    if (!fromCurr || !toCurr || fromCurr === toCurr) return 1.0;
    const direct = exchangeRates.find(
      (r) => r.origin === fromCurr && r.destination === toCurr && r.date === dateStr
    );
    if (direct && Number(direct.rate) > 0) return Number(direct.rate);

    const inverse = exchangeRates.find(
      (r) => r.origin === toCurr && r.destination === fromCurr && r.date === dateStr
    );
    if (inverse && Number(inverse.rate) > 0) return 1.0 / Number(inverse.rate);

    return null;
  };

  // Mutation: Crear Cuenta
  const createAccountMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Selecciona una empresa primero");
      const finalCurrency = accountCurrency === "DEFAULT" ? null : accountCurrency;
      const { error } = await supabase.from("accounts").insert({
        entity_id: activeEntityId,
        code: accountCode.trim(),
        name: accountName.trim(),
        account_type: accountType,
        currency_code: finalCurrency,
        requires_cost_center: requiresCc,
        requires_business_unit: requiresBu,
        is_group: isGroup,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts", activeEntityId] });
      toast.success("Cuenta contable creada correctamente");
      setNewAccountOpen(false);
      setAccountCode("");
      setAccountName("");
      setAccountCurrency("DEFAULT");
      setRequiresCc(false);
      setRequiresBu(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al crear la cuenta");
    },
  });

  // Mutation: Alta rápida de Tasa de Cambio
  const createQuickRateMutation = useMutation({
    mutationFn: async () => {
      const numRate = parseFloat(quickRateValue);
      if (isNaN(numRate) || numRate <= 0) throw new Error("Ingrese una tasa válida mayor a cero");

      const { error } = await supabase.from("exchange_rates").insert({
        origin: "USD",
        destination: baseCurrency,
        date: voucherDate,
        rate: numRate,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange_rates"] });
      toast.success(`Tasa de cambio USD / ${baseCurrency} registrada para el ${voucherDate}`);
      setQuickRateOpen(false);
      setQuickRateValue("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al registrar tasa");
    },
  });

  // Helpers para modificar líneas
  const handleAddLine = () => {
    setLines([...lines, { account_id: "", debit: "", credit: "", memo: "" }]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 2) {
      toast.error("Un comprobante contable requiere mínimo 2 líneas.");
      return;
    }
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof JournalLineForm, value: string) => {
    const updated = [...lines];
    const currentLine = updated[index];
    if (!currentLine) return;
    const next: JournalLineForm = { ...currentLine, [field]: value };
    if (field === "debit" && parseFloat(value || "0") > 0) {
      next.credit = "";
    } else if (field === "credit" && parseFloat(value || "0") > 0) {
      next.debit = "";
    }
    updated[index] = next;
    setLines(updated);
  };

  // Cálculos dinámicos en moneda funcional y validaciones analíticas
  const computedLines = useMemo(() => {
    let missingRate = false;
    let missingCurrency = "";
    let missingDimensionMsg = "";

    const calculated = lines.map((line, idx) => {
      const acc = accounts.find((a) => a.id === line.account_id);
      const accCurrency = acc?.currency_code || baseCurrency;
      const isForeign = accCurrency !== baseCurrency;

      const rawDebit = parseFloat(line.debit || "0") || 0;
      const rawCredit = parseFloat(line.credit || "0") || 0;

      let rate = 1.0;
      if (isForeign) {
        const found = findExchangeRate(accCurrency, baseCurrency, voucherDate);
        if (found !== null) {
          rate = found;
        } else {
          missingRate = true;
          missingCurrency = accCurrency;
          rate = 0;
        }
      }

      // Validar requerimientos analíticos
      if (acc?.requires_cost_center && !line.cost_center_id) {
        missingDimensionMsg = `Línea ${idx + 1}: La cuenta "${acc.name}" exige Centro de Costo obligatorio.`;
      }
      if (acc?.requires_business_unit && !line.business_unit_id) {
        missingDimensionMsg = `Línea ${idx + 1}: La cuenta "${acc.name}" exige Unidad/Sucursal obligatoria.`;
      }

      const functionalDebit = isForeign ? Math.round(rawDebit * rate) : rawDebit;
      const functionalCredit = isForeign ? Math.round(rawCredit * rate) : rawCredit;

      return {
        ...line,
        account: acc,
        accCurrency,
        isForeign,
        rate,
        rawDebit,
        rawCredit,
        functionalDebit,
        functionalCredit,
      };
    });

    const totalDebitCalc = calculated.reduce((sum, l) => sum + l.functionalDebit, 0);
    const totalCreditCalc = calculated.reduce((sum, l) => sum + l.functionalCredit, 0);
    const difference = Math.abs(totalDebitCalc - totalCreditCalc);
    const isBalanced = totalDebitCalc > 0 && difference < 0.01 && !missingRate && !missingDimensionMsg;

    return {
      calculated,
      totalDebitCalc,
      totalCreditCalc,
      difference,
      isBalanced,
      missingRate,
      missingCurrency,
      missingDimensionMsg,
    };
  }, [lines, accounts, baseCurrency, exchangeRates, voucherDate]);

  // Mutation: Crear y Postear Comprobante Contable
  const createVoucherMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Selecciona una empresa primero");
      if (computedLines.missingRate) {
        throw new Error(`Falta registrar la tasa de cambio para ${computedLines.missingCurrency} en la fecha ${voucherDate}`);
      }
      if (computedLines.missingDimensionMsg) {
        throw new Error(computedLines.missingDimensionMsg);
      }
      if (!computedLines.isBalanced) {
        throw new Error("El comprobante no cuadra: Total Débito debe ser igual a Total Crédito en moneda base");
      }
      if (lines.length < 2) throw new Error("Se requieren al menos dos líneas contables");

      // 1. Cabecera
      const { data: header, error: headerError } = await supabase
        .from("journal_entries")
        .insert({
          entity_id: activeEntityId,
          book_id: voucherBookId || null,
          posting_date: voucherDate,
          voucher_type: voucherType,
          memo: voucherMemo.trim() || "Comprobante de Diario",
          status: "draft",
        })
        .select()
        .single();

      if (headerError) throw headerError;

      // 2. Líneas con dimensiones analíticas
      const linesToInsert = computedLines.calculated.map((line, idx) => ({
        journal_entry_id: header.id,
        line_no: idx + 1,
        account_id: line.account_id,
        party_id: line.party_id || null,
        cost_center_id: line.cost_center_id || null,
        business_unit_id: line.business_unit_id || null,
        currency_code: line.accCurrency,
        exchange_rate: line.rate,
        debit_account_currency: line.rawDebit,
        credit_account_currency: line.rawCredit,
        debit: line.functionalDebit,
        credit: line.functionalCredit,
        memo: line.memo.trim() || null,
      }));

      const { error: linesError } = await supabase
        .from("journal_entry_lines")
        .insert(linesToInsert);

      if (linesError) throw linesError;

      // 3. Postear comprobante
      const { data: postRes, error: postError } = await supabase.rpc("post_journal_entry", {
        _journal_entry_id: header.id,
      });

      if (postError) throw postError;
      return postRes;
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["journal_entries", activeEntityId] });
      queryClient.invalidateQueries({ queryKey: ["financial_reports_data", activeEntityId] });
      toast.success(`Comprobante ${res?.entry_number || ""} posteado con éxito`);
      setNewVoucherOpen(false);
      setVoucherMemo("");
      setLines([
        { account_id: "", debit: "", credit: "", memo: "" },
        { account_id: "", debit: "", credit: "", memo: "" },
      ]);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al crear comprobante");
    },
  });

  // Mutation: Reversar Comprobante
  const reverseVoucherMutation = useMutation({
    mutationFn: async (journalEntryId: string) => {
      const { data, error } = await supabase.rpc("reverse_journal_entry", {
        _journal_entry_id: journalEntryId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal_entries", activeEntityId] });
      queryClient.invalidateQueries({ queryKey: ["financial_reports_data", activeEntityId] });
      toast.success("Comprobante contable reversado correctamente con contra-asiento");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al reversar comprobante");
    },
  });

  const totalGlobalDebit = journalEntries.reduce((acc, curr: any) => {
    const linesArr = curr.journal_entry_lines || [];
    return acc + linesArr.reduce((lsum: number, line: any) => lsum + Number(line.debit || 0), 0);
  }, 0);

  const totalGlobalCredit = journalEntries.reduce((acc, curr: any) => {
    const linesArr = curr.journal_entry_lines || [];
    return acc + linesArr.reduce((lsum: number, line: any) => lsum + Number(line.credit || 0), 0);
  }, 0);

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
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            accountsQuery.refetch();
            journalEntriesQuery.refetch();
            exchangeRatesQuery.refetch();
            costCentersQuery.refetch();
            businessUnitsQuery.refetch();
          }}
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Actualizar
        </Button>
      </div>

      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BookOpen className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Módulo de Contabilidad</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Motor de partida doble, catálogo multimoneda ({baseCurrency}), centros de costo, sucursales y libro mayor.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Dialog Crear Cuenta */}
          <Dialog open={newAccountOpen} onOpenChange={setNewAccountOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Nueva Cuenta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Agregar Cuenta Contable</DialogTitle>
                <DialogDescription>
                  Crea una nueva cuenta en el catálogo con reglas analíticas de centros de costo o sucursal.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-3">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="code" className="text-right">Código</Label>
                  <Input
                    id="code"
                    placeholder="ej. 5.1.01.001"
                    value={accountCode}
                    onChange={(e) => setAccountCode(e.target.value)}
                    className="col-span-3 font-mono"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Nombre</Label>
                  <Input
                    id="name"
                    placeholder="ej. Gastos de Publicidad y Marketing"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="type" className="text-right">Tipo</Label>
                  <Select value={accountType} onValueChange={setAccountType}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Seleccione tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asset">Activo (Asset)</SelectItem>
                      <SelectItem value="Liability">Pasivo (Liability)</SelectItem>
                      <SelectItem value="Equity">Patrimonio (Equity)</SelectItem>
                      <SelectItem value="Income">Ingresos (Income)</SelectItem>
                      <SelectItem value="Expense">Gastos (Expense)</SelectItem>
                      <SelectItem value="Cost of Goods Sold">Costo de Ventas (COGS)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="currency" className="text-right">Moneda</Label>
                  <Select value={accountCurrency} onValueChange={setAccountCurrency}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Moneda de la cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DEFAULT">
                        Moneda base de la empresa ({baseCurrency})
                      </SelectItem>
                      {currencies
                        .filter((c) => c.code !== baseCurrency)
                        .map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.code} - {c.name} ({c.symbol})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Requerimientos</Label>
                  <div className="col-span-3 space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="reqCc"
                        checked={requiresCc}
                        onChange={(e) => setRequiresCc(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="reqCc" className="text-xs text-foreground font-medium">
                        Exigir Centro de Costo al asentar
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="reqBu"
                        checked={requiresBu}
                        onChange={(e) => setRequiresBu(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="reqBu" className="text-xs text-foreground font-medium">
                        Exigir Sucursal / Unidad al asentar
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isGroup"
                        checked={isGroup}
                        onChange={(e) => setIsGroup(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="isGroup" className="text-xs text-muted-foreground">
                        Marcar como cuenta de grupo (agrupadora)
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createAccountMutation.mutate()}
                  disabled={createAccountMutation.isPending || !accountCode || !accountName}
                >
                  Guardar Cuenta
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Dialog Registrar Comprobante */}
          <Dialog open={newVoucherOpen} onOpenChange={setNewVoucherOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Nuevo Comprobante
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nuevo Comprobante Contable</DialogTitle>
                <DialogDescription>
                  Ingresa las partidas contables con imputación a Centros de Costo y Sucursales.
                </DialogDescription>
              </DialogHeader>

              {/* Cabecera del Comprobante */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-3 border-b">
                <div>
                  <Label htmlFor="voucherDate" className="text-xs font-semibold">Fecha Contable</Label>
                  <Input
                    id="voucherDate"
                    type="date"
                    value={voucherDate}
                    onChange={(e) => setVoucherDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="voucherType" className="text-xs font-semibold">Tipo de Comprobante</Label>
                  <Select value={voucherType} onValueChange={setVoucherType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Manual">Diario / Manual</SelectItem>
                      <SelectItem value="Ingreso">Comprobante de Ingreso</SelectItem>
                      <SelectItem value="Egreso">Comprobante de Egreso</SelectItem>
                      <SelectItem value="Traspaso">Comprobante de Traspaso</SelectItem>
                      <SelectItem value="Apertura">Asiento de Apertura</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="voucherBook" className="text-xs font-semibold">Libro / Caja (Opcional)</Label>
                  <Select value={voucherBookId} onValueChange={setVoucherBookId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Seleccionar libro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Ninguno / General</SelectItem>
                      {books.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-3">
                  <Label htmlFor="voucherMemo" className="text-xs font-semibold">Glosa / Concepto General</Label>
                  <Input
                    id="voucherMemo"
                    placeholder="Descripción detallada de la operación contable"
                    value={voucherMemo}
                    onChange={(e) => setVoucherMemo(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Alerta de Falta de Tasa de Cambio */}
              {computedLines.missingRate && (
                <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>
                      No existe tasa de cambio para <strong>{computedLines.missingCurrency} &rarr; {baseCurrency}</strong> en la fecha <strong>{voucherDate}</strong>.
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-amber-500 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900"
                    onClick={() => setQuickRateOpen(true)}
                  >
                    + Registrar Tasa del Día
                  </Button>
                </div>
              )}

              {/* Alerta de Dimensión Faltante */}
              {computedLines.missingDimensionMsg && (
                <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{computedLines.missingDimensionMsg}</span>
                </div>
              )}

              {/* Tabla de Líneas Contables */}
              <div className="py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Partidas Contables & Dimensiones Analíticas
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddLine}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Agregar Línea
                  </Button>
                </div>

                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[22%]">Cuenta Contable</TableHead>
                        <TableHead className="w-[14%]">Centro de Costo</TableHead>
                        <TableHead className="w-[14%]">Sucursal / Unidad</TableHead>
                        <TableHead className="w-[14%]">Tercero / RUT</TableHead>
                        <TableHead className="w-[16%] text-right">Débito</TableHead>
                        <TableHead className="w-[16%] text-right">Crédito</TableHead>
                        <TableHead className="w-[4%] text-center"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {computedLines.calculated.map((line, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="p-2">
                            <Select
                              value={line.account_id}
                              onValueChange={(val) => handleLineChange(idx, "account_id", val)}
                            >
                              <SelectTrigger className="h-8 text-xs font-mono">
                                <SelectValue placeholder="Seleccionar cuenta" />
                              </SelectTrigger>
                              <SelectContent>
                                {accounts
                                  .filter((a) => !a.is_group)
                                  .map((acc) => (
                                    <SelectItem key={acc.id} value={acc.id}>
                                      {acc.code} - {acc.name} {acc.currency_code ? `(${acc.currency_code})` : ""}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </TableCell>

                          {/* Centro de Costo */}
                          <TableCell className="p-2">
                            <Select
                              value={line.cost_center_id || ""}
                              onValueChange={(val) => handleLineChange(idx, "cost_center_id", val)}
                            >
                              <SelectTrigger className={`h-8 text-xs ${line.account?.requires_cost_center && !line.cost_center_id ? "border-red-500" : ""}`}>
                                <SelectValue placeholder={line.account?.requires_cost_center ? "Obligatorio *" : "Opcional"} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Sin Centro de Costo</SelectItem>
                                {costCenters
                                  .filter((cc) => !cc.is_group)
                                  .map((cc) => (
                                    <SelectItem key={cc.id} value={cc.id}>
                                      {cc.code} - {cc.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </TableCell>

                          {/* Unidad / Sucursal */}
                          <TableCell className="p-2">
                            <Select
                              value={line.business_unit_id || ""}
                              onValueChange={(val) => handleLineChange(idx, "business_unit_id", val)}
                            >
                              <SelectTrigger className={`h-8 text-xs ${line.account?.requires_business_unit && !line.business_unit_id ? "border-red-500" : ""}`}>
                                <SelectValue placeholder={line.account?.requires_business_unit ? "Obligatorio *" : "Opcional"} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Sin Sucursal</SelectItem>
                                {businessUnits
                                  .filter((bu) => !bu.is_group)
                                  .map((bu) => (
                                    <SelectItem key={bu.id} value={bu.id}>
                                      {bu.code} - {bu.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </TableCell>

                          {/* Tercero */}
                          <TableCell className="p-2">
                            <Select
                              value={line.party_id || ""}
                              onValueChange={(val) => handleLineChange(idx, "party_id", val)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Opcional" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Sin tercero</SelectItem>
                                {parties.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>

                          {/* Débito */}
                          <TableCell className="p-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  step="any"
                                  placeholder="0"
                                  value={line.debit}
                                  onChange={(e) => handleLineChange(idx, "debit", e.target.value)}
                                  className="h-8 text-right font-mono text-xs"
                                />
                                {line.isForeign && (
                                  <Badge variant="outline" className="text-[10px] font-mono h-6 shrink-0">
                                    {line.accCurrency}
                                  </Badge>
                                )}
                              </div>
                              {line.isForeign && line.rawDebit > 0 && (
                                <div className="text-[10px] text-right font-mono text-muted-foreground">
                                  &asymp; $ {line.functionalDebit.toLocaleString("es-CL")} {baseCurrency}
                                </div>
                              )}
                            </div>
                          </TableCell>

                          {/* Crédito */}
                          <TableCell className="p-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  step="any"
                                  placeholder="0"
                                  value={line.credit}
                                  onChange={(e) => handleLineChange(idx, "credit", e.target.value)}
                                  className="h-8 text-right font-mono text-xs"
                                />
                                {line.isForeign && (
                                  <Badge variant="outline" className="text-[10px] font-mono h-6 shrink-0">
                                    {line.accCurrency}
                                  </Badge>
                                )}
                              </div>
                              {line.isForeign && line.rawCredit > 0 && (
                                <div className="text-[10px] text-right font-mono text-muted-foreground">
                                  &asymp; $ {line.functionalCredit.toLocaleString("es-CL")} {baseCurrency}
                                </div>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="p-2 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveLine(idx)}
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Barra de Totales y Validación */}
                <div className="mt-3 flex flex-col sm:flex-row items-center justify-between p-3 rounded-lg bg-muted/60 border text-xs gap-3">
                  <div className="flex items-center gap-2">
                    {computedLines.isBalanced ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Partida Doble Cuadrada ({baseCurrency})
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {computedLines.missingDimensionMsg
                          ? "Falta completar dimensiones requeridas"
                          : computedLines.missingRate
                          ? "Falta tasa de cambio"
                          : `Descuadre de $ ${computedLines.difference.toLocaleString("es-CL")} ${baseCurrency}`}
                      </Badge>
                    )}
                    <span className="text-muted-foreground">
                      {lines.length} líneas
                    </span>
                  </div>

                  <div className="flex items-center gap-4 font-mono">
                    <div>
                      Total Débitos: <span className="font-bold text-foreground">$ {computedLines.totalDebitCalc.toLocaleString("es-CL")} {baseCurrency}</span>
                    </div>
                    <div>
                      Total Créditos: <span className="font-bold text-foreground">$ {computedLines.totalCreditCalc.toLocaleString("es-CL")} {baseCurrency}</span>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="mt-2">
                <Button
                  onClick={() => createVoucherMutation.mutate()}
                  disabled={createVoucherMutation.isPending || !computedLines.isBalanced || lines.some((l) => !l.account_id)}
                >
                  {createVoucherMutation.isPending ? "Posteando..." : "Guardar y Postear Comprobante"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Dialog Rápido de Tasa de Cambio */}
          <Dialog open={quickRateOpen} onOpenChange={setQuickRateOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Registrar Tasa Oficial del Día</DialogTitle>
                <DialogDescription>
                  Ingresa el valor del Dólar Observado para el <strong>{voucherDate}</strong>.
                </DialogDescription>
              </DialogHeader>
              <div className="py-3 space-y-3">
                <div>
                  <Label htmlFor="qRate" className="text-xs">Tasa USD &rarr; {baseCurrency}</Label>
                  <Input
                    id="qRate"
                    type="number"
                    step="any"
                    placeholder="ej. 950.50"
                    value={quickRateValue}
                    onChange={(e) => setQuickRateValue(e.target.value)}
                    className="mt-1 font-mono"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createQuickRateMutation.mutate()}
                  disabled={createQuickRateMutation.isPending || !quickRateValue}
                >
                  Guardar Tasa
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="vouchers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vouchers" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            <span>Libro Diario / Comprobantes ({journalEntries.length})</span>
          </TabsTrigger>
          <TabsTrigger value="chart" className="flex items-center gap-1.5">
            <ListTree className="h-4 w-4" />
            <span>Plan de Cuentas ({accounts.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab Libro Diario / Comprobantes */}
        <TabsContent value="vouchers">
          <Card>
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold">Comprobantes de Diario (Partida Doble, Multimoneda & CC)</CardTitle>
                <CardDescription>
                  Comprobantes inmutables con trazabilidad por Centro de Costo y Sucursal.
                </CardDescription>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="bg-muted px-2.5 py-1 rounded">
                  Total Débitos: <span className="font-bold text-foreground">$ {totalGlobalDebit.toLocaleString("es-CL")} {baseCurrency}</span>
                </div>
                <div className="bg-muted px-2.5 py-1 rounded">
                  Total Créditos: <span className="font-bold text-foreground">$ {totalGlobalCredit.toLocaleString("es-CL")} {baseCurrency}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {journalEntries.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No hay comprobantes contables registrados aún.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setNewVoucherOpen(true)}
                  >
                    Crear primer comprobante
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {journalEntries.map((voucher: any) => {
                    const linesArr = voucher.journal_entry_lines || [];
                    const vDebit = linesArr.reduce((s: number, l: any) => s + Number(l.debit || 0), 0);
                    const isReversed = voucher.status === "reversed";
                    const isPosted = voucher.status === "posted";

                    return (
                      <div key={voucher.id} className="rounded-lg border bg-card p-4 shadow-sm">
                        {/* Cabecera del comprobante */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sm text-primary">
                              {voucher.entry_number || "ASI-BORRADOR"}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {voucher.voucher_type}
                            </Badge>
                            {voucher.books?.name && (
                              <Badge variant="secondary" className="text-xs">
                                {voucher.books.name}
                              </Badge>
                            )}
                            {isPosted && (
                              <Badge className="bg-emerald-600 text-white text-xs">Posteado</Badge>
                            )}
                            {isReversed && (
                              <Badge variant="destructive" className="text-xs">Reversado</Badge>
                            )}
                            {voucher.reversal_of && (
                              <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                                Asiento de Reversión
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground font-mono">
                              Fecha: <strong className="text-foreground">{voucher.posting_date}</strong>
                            </span>

                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1 text-primary border-primary/30 hover:bg-primary/5"
                              onClick={() => {
                                setSelectedJournalEntryId(voucher.id);
                                setSourceDocModalOpen(true);
                              }}
                            >
                              <FileText className="h-3 w-3" />
                              <span>Ver Doc. Origen</span>
                            </Button>

                            {isPosted && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950"
                                onClick={() => {
                                  if (confirm(`¿Deseas reversar el comprobante ${voucher.entry_number}? Se creará un asiento inverso automáticamente.`)) {
                                    reverseVoucherMutation.mutate(voucher.id);
                                  }
                                }}
                                disabled={reverseVoucherMutation.isPending}
                              >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Reversar
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Glosa */}
                        {voucher.memo && (
                          <div className="py-2 text-xs text-muted-foreground italic">
                            Glosa: {voucher.memo}
                          </div>
                        )}

                        {/* Líneas */}
                        <div className="mt-2 rounded border overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/40">
                                <TableHead className="w-[6%] text-xs py-1.5">Línea</TableHead>
                                <TableHead className="w-[28%] text-xs py-1.5">Cuenta Contable</TableHead>
                                <TableHead className="w-[18%] text-xs py-1.5">Centro Costo / Sucursal</TableHead>
                                <TableHead className="w-[16%] text-xs py-1.5">Tercero / RUT</TableHead>
                                <TableHead className="w-[16%] text-right text-xs py-1.5">Débito ({baseCurrency})</TableHead>
                                <TableHead className="w-[16%] text-right text-xs py-1.5">Crédito ({baseCurrency})</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {linesArr.map((line: any, idx: number) => {
                                const acc = line.accounts;
                                const prt = line.parties;
                                const cc = line.cost_centers;
                                const bu = line.business_units;
                                const isForeign = line.currency_code && line.currency_code !== baseCurrency;

                                return (
                                  <TableRow key={line.id || idx}>
                                    <TableCell className="text-xs font-mono py-1.5 text-muted-foreground">{idx + 1}</TableCell>
                                    <TableCell className="text-xs font-medium py-1.5">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span>{acc ? `${acc.code} - ${acc.name}` : line.account_id}</span>
                                        {acc?.currency_code && acc.currency_code !== baseCurrency && (
                                          <Badge variant="outline" className="text-[10px] h-4 font-mono">
                                            {acc.currency_code}
                                          </Badge>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-xs py-1.5">
                                      <div className="flex flex-col gap-0.5">
                                        {cc && (
                                          <span className="text-[11px] font-mono text-primary flex items-center gap-1">
                                            <PieChart className="h-3 w-3 inline" /> {cc.code}
                                          </span>
                                        )}
                                        {bu && (
                                          <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                                            <Network className="h-3 w-3 inline" /> {bu.code}
                                          </span>
                                        )}
                                        {!cc && !bu && <span className="text-muted-foreground">-</span>}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground py-1.5">
                                      {prt ? `${prt.name}` : "-"}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-xs font-medium py-1.5">
                                      {Number(line.debit) > 0 ? (
                                        <div>
                                          <span>$ {Number(line.debit).toLocaleString("es-CL")}</span>
                                          {isForeign && (
                                            <div className="text-[10px] text-muted-foreground">
                                              ({line.currency_code} {Number(line.debit_account_currency).toLocaleString("es-CL")})
                                            </div>
                                          )}
                                        </div>
                                      ) : "-"}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-xs font-medium py-1.5">
                                      {Number(line.credit) > 0 ? (
                                        <div>
                                          <span>$ {Number(line.credit).toLocaleString("es-CL")}</span>
                                          {isForeign && (
                                            <div className="text-[10px] text-muted-foreground">
                                              ({line.currency_code} {Number(line.credit_account_currency).toLocaleString("es-CL")})
                                            </div>
                                          )}
                                        </div>
                                      ) : "-"}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Total Comprobante */}
                        <div className="mt-2 text-right text-xs font-mono text-muted-foreground">
                          Total Comprobante: <span className="font-bold text-foreground">$ {vDebit.toLocaleString("es-CL")} {baseCurrency}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Plan de Cuentas */}
        <TabsContent value="chart">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Catálogo Jerárquico de Cuentas</CardTitle>
              <CardDescription>
                Estructura contable con reglas de imputación analítica y centros de costo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {accounts.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <BookOpen className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No hay cuentas contables registradas aún.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setNewAccountOpen(true)}
                  >
                    Crear primera cuenta
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">Código</TableHead>
                        <TableHead>Nombre de la Cuenta</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-center">Moneda</TableHead>
                        <TableHead className="text-center">Dimensiones Exigidas</TableHead>
                        <TableHead className="text-center">Clasificación</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                        <TableHead className="text-center w-24">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accounts.map((acc) => (
                        <TableRow
                          key={acc.id}
                          className="cursor-pointer hover:bg-primary/5 transition-colors group"
                          onClick={() => {
                            setSelectedAccountForLedger(acc);
                            setLedgerDrawerOpen(true);
                          }}
                          title={`Ver Libro Mayor de ${acc.code} - ${acc.name}`}
                        >
                          <TableCell className="font-mono font-bold text-xs text-primary group-hover:underline">
                            <span className="inline-flex items-center gap-1">
                              {acc.code}
                              <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </span>
                          </TableCell>
                          <TableCell className={acc.is_group ? "font-semibold text-foreground" : "text-muted-foreground"}>
                            {acc.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {acc.account_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {acc.currency_code ? (
                              <Badge variant="secondary" className="text-xs font-mono font-semibold">
                                {acc.currency_code}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground font-mono">
                                {baseCurrency} (Base)
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1 flex-wrap">
                              {acc.requires_cost_center && (
                                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-400">
                                  Exige CC
                                </Badge>
                              )}
                              {acc.requires_business_unit && (
                                <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-400">
                                  Exige Sucursal
                                </Badge>
                              )}
                              {!acc.requires_cost_center && !acc.requires_business_unit && (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {acc.is_group ? (
                              <Badge variant="secondary" className="text-xs">Grupo</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">Detalle</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`inline-block h-2 w-2 rounded-full ${acc.active ? "bg-emerald-500" : "bg-red-500"}`} />
                          </TableCell>
                          <TableCell className="text-center p-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[11px] px-2 gap-1 text-primary hover:text-primary hover:bg-primary/10"
                              onClick={() => {
                                setSelectedAccountForLedger(acc);
                                setLedgerDrawerOpen(true);
                              }}
                            >
                              <BookOpen className="h-3 w-3" />
                              <span>Mayor</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Visor Modal de Documento Fuente */}
      <SourceDocumentDialog
        open={sourceDocModalOpen}
        onOpenChange={setSourceDocModalOpen}
        journalEntryId={selectedJournalEntryId}
      />

      {/* Drawer Lateral del Libro Mayor */}
      <AccountLedgerDrawer
        open={ledgerDrawerOpen}
        onOpenChange={setLedgerDrawerOpen}
        account={selectedAccountForLedger}
      />
    </div>
  );
}
