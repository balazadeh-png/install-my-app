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
  Building2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/accounting")({
  component: AccountingPage,
  head: () => ({
    meta: [
      { title: "Contabilidad & Partida Doble | EasyERP" },
      { name: "description", content: "Plan de cuentas, comprobantes contables por partida doble y libro mayor." },
    ],
  }),
});

interface JournalLineForm {
  account_id: string;
  party_id?: string;
  debit: string;
  credit: string;
  memo: string;
}

function AccountingPage() {
  const queryClient = useQueryClient();
  const { activeEntity, activeEntityId } = useActiveEntity();
  const [newAccountOpen, setNewAccountOpen] = useState(false);
  const [newVoucherOpen, setNewVoucherOpen] = useState(false);
  const [reversingId, setReversingId] = useState<string | null>(null);

  // Form State para Nueva Cuenta
  const [accountCode, setAccountCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("Asset");
  const [isGroup, setIsGroup] = useState(false);

  // Form State para Nuevo Comprobante Contable
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split("T")[0]);
  const [voucherType, setVoucherType] = useState("Manual");
  const [voucherBookId, setVoucherBookId] = useState<string>("");
  const [voucherMemo, setVoucherMemo] = useState("");
  const [lines, setLines] = useState<JournalLineForm[]>([
    { account_id: "", debit: "", credit: "", memo: "" },
    { account_id: "", debit: "", credit: "", memo: "" },
  ]);

  // Query: Cuentas Contables
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

  // Query: Libros de Tesorería
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

  // Query: Terceros (Parties)
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

  // Query: Comprobantes Contables (journal_entries con detalle)
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
            debit,
            credit,
            memo,
            accounts(code, name),
            parties(name, tax_id)
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

  // Mutation: Crear Cuenta
  const createAccountMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Selecciona una empresa primero");
      const { error } = await supabase.from("accounts").insert({
        entity_id: activeEntityId,
        code: accountCode.trim(),
        name: accountName.trim(),
        account_type: accountType,
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
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al crear la cuenta");
    },
  });

  // Helper para modificar líneas
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
    updated[index] = { ...updated[index], [field]: value };
    // Si escribe débito, limpiar crédito y viceversa
    if (field === "debit" && parseFloat(value || "0") > 0) {
      updated[index].credit = "";
    } else if (field === "credit" && parseFloat(value || "0") > 0) {
      updated[index].debit = "";
    }
    setLines(updated);
  };

  // Cálculos de Totales y Cuadre de Partida Doble
  const totalDebitCalc = lines.reduce((sum, l) => sum + (parseFloat(l.debit || "0") || 0), 0);
  const totalCreditCalc = lines.reduce((sum, l) => sum + (parseFloat(l.credit || "0") || 0), 0);
  const difference = Math.abs(totalDebitCalc - totalCreditCalc);
  const isBalanced = totalDebitCalc > 0 && Math.abs(totalDebitCalc - totalCreditCalc) < 0.001;

  // Mutation: Crear y Postear Comprobante Contable
  const createVoucherMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Selecciona una empresa primero");
      if (!isBalanced) throw new Error("El comprobante no cuadra: Total Débito debe ser igual a Total Crédito");
      if (lines.length < 2) throw new Error("Se requieren al menos dos líneas contables");

      // 1. Crear cabecera en estado draft
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

      // 2. Insertar líneas de comprobante
      const linesToInsert = lines.map((line, idx) => ({
        journal_entry_id: header.id,
        line_no: idx + 1,
        account_id: line.account_id,
        party_id: line.party_id || null,
        debit: parseFloat(line.debit || "0") || 0,
        credit: parseFloat(line.credit || "0") || 0,
        memo: line.memo.trim() || null,
      }));

      const { error: linesError } = await supabase
        .from("journal_entry_lines")
        .insert(linesToInsert);

      if (linesError) throw linesError;

      // 3. Postear mediante función SQL atómica de verificación
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
      toast.success("Comprobante contable reversado correctamente con asiento inverso");
      setReversingId(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al reversar comprobante");
    },
  });

  const accounts = accountsQuery.data ?? [];
  const books = booksQuery.data ?? [];
  const parties = partiesQuery.data ?? [];
  const journalEntries = journalEntriesQuery.data ?? [];

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
      {/* Breadcrumb & Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Volver al Dashboard
            </Link>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              accountsQuery.refetch();
              journalEntriesQuery.refetch();
            }}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Actualizar
          </Button>
        </div>
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
            Motor de partida doble, catálogo jerárquico de cuentas, comprobantes inmutables y libro diario.
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
                  Crea una nueva cuenta o grupo en el catálogo de cuentas de la empresa.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-3">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="code" className="text-right">Código</Label>
                  <Input
                    id="code"
                    placeholder="ej. 1.1.01.001"
                    value={accountCode}
                    onChange={(e) => setAccountCode(e.target.value)}
                    className="col-span-3 font-mono"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Nombre</Label>
                  <Input
                    id="name"
                    placeholder="ej. Banco de Chile"
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
                  <Label htmlFor="isGroup" className="text-right">¿Es Grupo?</Label>
                  <div className="col-span-3 flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isGroup"
                      checked={isGroup}
                      onChange={(e) => setIsGroup(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="isGroup" className="text-xs text-muted-foreground">
                      Marcar si agrupa subcuentas
                    </label>
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

          {/* Dialog Registrar Comprobante (Partida Doble N Líneas) */}
          <Dialog open={newVoucherOpen} onOpenChange={setNewVoucherOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Nuevo Comprobante
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nuevo Comprobante Contable</DialogTitle>
                <DialogDescription>
                  Ingresa la cabecera y las partidas contables. Debe cumplirse estrictamente la partida doble (Débitos = Créditos).
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

              {/* Tabla de Líneas Contables */}
              <div className="py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Partidas Contables (Mínimo 2 líneas)
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
                        <TableHead className="w-[30%]">Cuenta Contable</TableHead>
                        <TableHead className="w-[20%]">Tercero / RUT</TableHead>
                        <TableHead className="w-[18%] text-right">Débito ($)</TableHead>
                        <TableHead className="w-[18%] text-right">Crédito ($)</TableHead>
                        <TableHead className="w-[14%] text-center">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((line, idx) => (
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
                                      {acc.code} - {acc.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-2">
                            <Select
                              value={line.party_id || ""}
                              onValueChange={(val) => handleLineChange(idx, "party_id", val)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Sin tercero" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Sin tercero</SelectItem>
                                {parties.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name} ({p.tax_id || "Sin RUT"})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              step="1"
                              placeholder="0"
                              value={line.debit}
                              onChange={(e) => handleLineChange(idx, "debit", e.target.value)}
                              className="h-8 text-right font-mono text-xs"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              step="1"
                              placeholder="0"
                              value={line.credit}
                              onChange={(e) => handleLineChange(idx, "credit", e.target.value)}
                              className="h-8 text-right font-mono text-xs"
                            />
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

                {/* Barra de Totales y Validación de Partida Doble */}
                <div className="mt-3 flex flex-col sm:flex-row items-center justify-between p-3 rounded-lg bg-muted/60 border text-xs gap-3">
                  <div className="flex items-center gap-2">
                    {isBalanced ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Partida Doble Cuadrada
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Descuadre de $ {difference.toLocaleString("es-CL")}
                      </Badge>
                    )}
                    <span className="text-muted-foreground">
                      {lines.length} {lines.length === 1 ? "línea" : "líneas"}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 font-mono">
                    <div>
                      Débitos: <span className="font-bold text-foreground">$ {totalDebitCalc.toLocaleString("es-CL")}</span>
                    </div>
                    <div>
                      Créditos: <span className="font-bold text-foreground">$ {totalCreditCalc.toLocaleString("es-CL")}</span>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="mt-2">
                <Button
                  onClick={() => createVoucherMutation.mutate()}
                  disabled={createVoucherMutation.isPending || !isBalanced || lines.some((l) => !l.account_id)}
                >
                  {createVoucherMutation.isPending ? "Posteando..." : "Guardar y Postear Comprobante"}
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
                <CardTitle className="text-base font-semibold">Comprobantes de Diario (Partida Doble)</CardTitle>
                <CardDescription>
                  Asientos contables agrupados por comprobante correlativo e inmutables con historial de reversión.
                </CardDescription>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="bg-muted px-2.5 py-1 rounded">
                  Total Débitos: <span className="font-bold text-foreground">$ {totalGlobalDebit.toLocaleString("es-CL")}</span>
                </div>
                <div className="bg-muted px-2.5 py-1 rounded">
                  Total Créditos: <span className="font-bold text-foreground">$ {totalGlobalCredit.toLocaleString("es-CL")}</span>
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
                                <TableHead className="w-[10%] text-xs py-1.5">Línea</TableHead>
                                <TableHead className="w-[35%] text-xs py-1.5">Cuenta Contable</TableHead>
                                <TableHead className="w-[25%] text-xs py-1.5">Tercero / RUT</TableHead>
                                <TableHead className="w-[15%] text-right text-xs py-1.5">Débito ({activeEntity?.base_currency_code || "CLP"})</TableHead>
                                <TableHead className="w-[15%] text-right text-xs py-1.5">Crédito ({activeEntity?.base_currency_code || "CLP"})</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {linesArr.map((line: any, idx: number) => {
                                const acc = line.accounts;
                                const prt = line.parties;
                                return (
                                  <TableRow key={line.id || idx}>
                                    <TableCell className="text-xs font-mono py-1.5 text-muted-foreground">{idx + 1}</TableCell>
                                    <TableCell className="text-xs font-medium py-1.5">
                                      {acc ? `${acc.code} - ${acc.name}` : line.account_id}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground py-1.5">
                                      {prt ? `${prt.name} (${prt.tax_id || "Sin RUT"})` : "-"}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-xs font-medium py-1.5">
                                      {Number(line.debit) > 0 ? `$ ${Number(line.debit).toLocaleString("es-CL")}` : "-"}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-xs font-medium py-1.5">
                                      {Number(line.credit) > 0 ? `$ ${Number(line.credit).toLocaleString("es-CL")}` : "-"}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Total Comprobante */}
                        <div className="mt-2 text-right text-xs font-mono text-muted-foreground">
                          Total Comprobante: <span className="font-bold text-foreground">$ {vDebit.toLocaleString("es-CL")}</span>
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
                Estructura contable para el registro y clasificación de operaciones financieras.
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
                        <TableHead className="w-[180px]">Código</TableHead>
                        <TableHead>Nombre de la Cuenta</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-center">Clasificación</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accounts.map((acc) => (
                        <TableRow key={acc.id}>
                          <TableCell className="font-mono font-medium">{acc.code}</TableCell>
                          <TableCell className={acc.is_group ? "font-semibold text-foreground" : "text-muted-foreground"}>
                            {acc.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {acc.account_type}
                            </Badge>
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
    </div>
  );
}
