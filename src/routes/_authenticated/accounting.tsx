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
import { BookOpen, Plus, ArrowLeft, RefreshCw, FileText, ListTree } from "lucide-react";

export const Route = createFileRoute("/_authenticated/accounting")({
  component: AccountingPage,
  head: () => ({
    meta: [
      { title: "Contabilidad | EasyERP" },
      { name: "description", content: "Plan de cuentas, libro mayor y asientos contables." },
    ],
  }),
});

function AccountingPage() {
  const queryClient = useQueryClient();
  const { activeEntity, activeEntityId } = useActiveEntity();
  const [newAccountOpen, setNewAccountOpen] = useState(false);
  const [newEntryOpen, setNewEntryOpen] = useState(false);

  // Form State para Nueva Cuenta
  const [accountCode, setAccountCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("Asset");
  const [isGroup, setIsGroup] = useState(false);

  // Form State para Nuevo Asiento Simple
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [entryAccount, setEntryAccount] = useState("");
  const [entryDebit, setEntryDebit] = useState("");
  const [entryCredit, setEntryCredit] = useState("");
  const [entryMemo, setEntryMemo] = useState("");

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

  // Query: Asientos Contables (gl_entries)
  const glEntriesQuery = useQuery({
    queryKey: ["gl_entries", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("gl_entries")
        .select("*, accounts(code, name)")
        .eq("entity_id", activeEntityId)
        .order("posting_date", { ascending: false })
        .limit(100);
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

  // Mutation: Crear Asiento
  const createEntryMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Selecciona una empresa primero");
      if (!entryAccount) throw new Error("Debe seleccionar una cuenta contable");
      const deb = parseFloat(entryDebit || "0");
      const cred = parseFloat(entryCredit || "0");
      if (deb === 0 && cred === 0) throw new Error("Debe ingresar un monto en Débito o Crédito");

      const { error } = await supabase.from("gl_entries").insert({
        entity_id: activeEntityId,
        posting_date: entryDate,
        account_id: entryAccount,
        debit: deb,
        credit: cred,
        currency: activeEntity?.base_currency_code || "CLP",
        memo: entryMemo,
        voucher_type: "Manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gl_entries", activeEntityId] });
      toast.success("Asiento contable registrado");
      setNewEntryOpen(false);
      setEntryDebit("");
      setEntryCredit("");
      setEntryMemo("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al registrar asiento");
    },
  });

  const accounts = accountsQuery.data ?? [];
  const glEntries = glEntriesQuery.data ?? [];

  const totalDebit = glEntries.reduce((acc, curr) => acc + Number(curr.debit || 0), 0);
  const totalCredit = glEntries.reduce((acc, curr) => acc + Number(curr.credit || 0), 0);

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
              glEntriesQuery.refetch();
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
            Gestión del catálogo de cuentas, libro diario, partidas por partida doble y libro mayor.
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
                    placeholder="ej. Caja General"
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

          {/* Dialog Registrar Asiento */}
          <Dialog open={newEntryOpen} onOpenChange={setNewEntryOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Registrar Asiento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Partida Contable</DialogTitle>
                <DialogDescription>
                  Ingresa un movimiento al Libro Mayor para una cuenta contable.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-3">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="date" className="text-right">Fecha</Label>
                  <Input
                    id="date"
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="account" className="text-right">Cuenta</Label>
                  <Select value={entryAccount} onValueChange={setEntryAccount}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Seleccione cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.code} - {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="debit" className="text-right">Débito ($)</Label>
                  <Input
                    id="debit"
                    type="number"
                    step="1"
                    placeholder="0"
                    value={entryDebit}
                    onChange={(e) => setEntryDebit(e.target.value)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="credit" className="text-right">Crédito ($)</Label>
                  <Input
                    id="credit"
                    type="number"
                    step="1"
                    placeholder="0"
                    value={entryCredit}
                    onChange={(e) => setEntryCredit(e.target.value)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="memo" className="text-right">Concepto</Label>
                  <Input
                    id="memo"
                    placeholder="Descripción de la transacción"
                    value={entryMemo}
                    onChange={(e) => setEntryMemo(e.target.value)}
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createEntryMutation.mutate()}
                  disabled={createEntryMutation.isPending || !entryAccount}
                >
                  Registrar Asiento
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="chart" className="space-y-4">
        <TabsList>
          <TabsTrigger value="chart" className="flex items-center gap-1.5">
            <ListTree className="h-4 w-4" />
            <span>Plan de Cuentas ({accounts.length})</span>
          </TabsTrigger>
          <TabsTrigger value="entries" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            <span>Libro Diario / Partidas ({glEntries.length})</span>
          </TabsTrigger>
        </TabsList>

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

        {/* Tab Libro Diario */}
        <TabsContent value="entries">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Movimientos del Libro Mayor (GL Entries)</CardTitle>
                <CardDescription>
                  Partidas contables registradas con trazabilidad de débitos y créditos.
                </CardDescription>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="bg-muted px-2.5 py-1 rounded">
                  Débitos: <span className="font-bold text-foreground">$ {totalDebit.toLocaleString("es-CL")}</span>
                </div>
                <div className="bg-muted px-2.5 py-1 rounded">
                  Créditos: <span className="font-bold text-foreground">$ {totalCredit.toLocaleString("es-CL")}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {glEntries.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No hay asientos contables registrados aún.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setNewEntryOpen(true)}
                  >
                    Registrar primer asiento
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">Fecha</TableHead>
                        <TableHead>Cuenta</TableHead>
                        <TableHead>Concepto / Memo</TableHead>
                        <TableHead>Comprobante</TableHead>
                        <TableHead className="text-right">Débito (CLP)</TableHead>
                        <TableHead className="text-right">Crédito (CLP)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {glEntries.map((entry) => {
                        const acc = (entry as any).accounts;
                        return (
                          <TableRow key={entry.id}>
                            <TableCell className="font-mono text-xs">{entry.posting_date}</TableCell>
                            <TableCell className="font-medium text-xs">
                              {acc ? `${acc.code} - ${acc.name}` : entry.account_id}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{entry.memo || "-"}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline">{entry.voucher_type || "General"}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-medium">
                              {Number(entry.debit) > 0 ? `$ ${Number(entry.debit).toLocaleString("es-CL")}` : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-medium">
                              {Number(entry.credit) > 0 ? `$ ${Number(entry.credit).toLocaleString("es-CL")}` : "-"}
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
