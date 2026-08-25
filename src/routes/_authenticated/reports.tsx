import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEntity } from "@/context/ActiveEntityContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  RefreshCw,
  BarChart3,
  PieChart,
  Scale,
  TrendingUp,
  TrendingDown,
  Filter,
  Network,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [
      { title: "Reportes Financieros & Centros de Costo | EasyERP" },
      { name: "description", content: "Balanza de comprobación, balance general y estado de resultados por centro de costo y sucursal." },
    ],
  }),
});

function ReportsPage() {
  const { activeEntity, activeEntityId } = useActiveEntity();
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>("ALL");
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>("ALL");

  const baseCurrency = activeEntity?.base_currency_code || "CLP";

  // Query: Centros de Costo
  const costCentersQuery = useQuery({
    queryKey: ["cost_centers", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("cost_centers")
        .select("*")
        .eq("entity_id", activeEntityId)
        .order("code");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeEntityId,
  });

  // Query: Unidades / Sucursales
  const businessUnitsQuery = useQuery({
    queryKey: ["business_units", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("business_units")
        .select("*")
        .eq("entity_id", activeEntityId)
        .order("code");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeEntityId,
  });

  // Query: Cuentas y Líneas de Comprobantes
  const dataQuery = useQuery({
    queryKey: ["financial_reports_data", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return { accounts: [], entries: [] };

      // 1. Cuentas
      const { data: accounts, error: accError } = await supabase
        .from("accounts")
        .select("*")
        .eq("entity_id", activeEntityId)
        .order("code");

      if (accError) throw accError;

      // 2. Líneas de comprobantes posteados
      const { data: journalLines, error: jlError } = await supabase
        .from("journal_entry_lines")
        .select(`
          account_id,
          debit,
          credit,
          cost_center_id,
          business_unit_id,
          journal_entries!inner(status, entity_id)
        `)
        .eq("journal_entries.entity_id", activeEntityId)
        .eq("journal_entries.status", "posted");

      let entries: {
        account_id: string;
        debit: number;
        credit: number;
        cost_center_id: string | null;
        business_unit_id: string | null;
      }[] = [];

      if (!jlError && journalLines && journalLines.length > 0) {
        entries = journalLines.map((jl: any) => ({
          account_id: jl.account_id,
          debit: Number(jl.debit || 0),
          credit: Number(jl.credit || 0),
          cost_center_id: jl.cost_center_id || null,
          business_unit_id: jl.business_unit_id || null,
        }));
      } else {
        const { data: glData } = await supabase
          .from("gl_entries")
          .select("account_id, debit, credit")
          .eq("entity_id", activeEntityId);
        entries = (glData || []).map((gl: any) => ({
          account_id: gl.account_id,
          debit: Number(gl.debit || 0),
          credit: Number(gl.credit || 0),
          cost_center_id: null,
          business_unit_id: null,
        }));
      }

      return { accounts: accounts ?? [], entries };
    },
    enabled: !!activeEntityId,
  });

  const costCenters = costCentersQuery.data ?? [];
  const businessUnits = businessUnitsQuery.data ?? [];
  const { accounts = [], entries = [] } = dataQuery.data ?? {};

  // Filtrado analítico y cálculo reactivo de saldos
  const { balances, totalAssets, totalLiabilities, totalEquity, totalIncome, totalExpenses, netIncome } = useMemo(() => {
    // 1. Filtrar movimientos según Centro de Costo y Sucursal
    const filteredEntries = entries.filter((e) => {
      if (selectedCostCenter !== "ALL" && e.cost_center_id !== selectedCostCenter) return false;
      if (selectedBusinessUnit !== "ALL" && e.business_unit_id !== selectedBusinessUnit) return false;
      return true;
    });

    // 2. Calcular saldos por cuenta
    const balMap: Record<string, { debit: number; credit: number; net: number }> = {};
    accounts.forEach((a) => {
      balMap[a.id] = { debit: 0, credit: 0, net: 0 };
    });

    filteredEntries.forEach((e) => {
      const bal = balMap[e.account_id];
      if (bal) {
        bal.debit += e.debit;
        bal.credit += e.credit;
      }
    });

    // 3. Determinar saldo neto según naturaleza
    let assets = 0;
    let liabilities = 0;
    let equity = 0;
    let income = 0;
    let expenses = 0;

    accounts.forEach((a) => {
      const b = balMap[a.id];
      if (!b) return;
      if (["Asset", "Expense", "Cost of Goods Sold"].includes(a.account_type)) {
        b.net = b.debit - b.credit;
      } else {
        b.net = b.credit - b.debit;
      }

      if (a.account_type === "Asset") assets += b.net;
      if (a.account_type === "Liability") liabilities += b.net;
      if (a.account_type === "Equity") equity += b.net;
      if (a.account_type === "Income") income += b.net;
      if (["Expense", "Cost of Goods Sold"].includes(a.account_type)) expenses += b.net;
    });

    return {
      balances: balMap,
      totalAssets: assets,
      totalLiabilities: liabilities,
      totalEquity: equity,
      totalIncome: income,
      totalExpenses: expenses,
      netIncome: income - expenses,
    };
  }, [accounts, entries, selectedCostCenter, selectedBusinessUnit]);

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
        <Button variant="outline" size="sm" onClick={() => dataQuery.refetch()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Actualizar Reportes
        </Button>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BarChart3 className="h-4 w-4" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reportes Financieros & Analíticos</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Estados financieros generados en tiempo real con filtro por Sucursal y Centro de Costo ({baseCurrency}).
        </p>
      </div>

      {/* Barra de Filtros Analíticos */}
      <Card className="mb-8 border shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
            <Filter className="h-4 w-4 text-primary" />
            <span>Filtro Analítico:</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Centro de Costo</Label>
              <Select value={selectedCostCenter} onValueChange={setSelectedCostCenter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todos los Centros de Costo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los Centros de Costo</SelectItem>
                  {costCenters.map((cc) => (
                    <SelectItem key={cc.id} value={cc.id}>
                      {cc.code} - {cc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Sucursal / Unidad</Label>
              <Select value={selectedBusinessUnit} onValueChange={setSelectedBusinessUnit}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todas las Sucursales" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas las Sucursales</SelectItem>
                  {businessUnits.map((bu) => (
                    <SelectItem key={bu.id} value={bu.id}>
                      {bu.code} - {bu.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(selectedCostCenter !== "ALL" || selectedBusinessUnit !== "ALL") && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8 text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => {
                setSelectedCostCenter("ALL");
                setSelectedBusinessUnit("ALL");
              }}
            >
              Limpiar Filtros
            </Button>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Total Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              $ {totalAssets.toLocaleString("es-CL")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Bienes y derechos ({baseCurrency})</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Total Pasivos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              $ {totalLiabilities.toLocaleString("es-CL")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Obligaciones y deudas ({baseCurrency})</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Total Ingresos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              $ {totalIncome.toLocaleString("es-CL")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ventas y operaciones ({baseCurrency})</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Resultado del Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono ${netIncome >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
              $ {netIncome.toLocaleString("es-CL")}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              {netIncome >= 0 ? (
                <>
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Utilidad Neta</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                  <span>Pérdida Neta</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="income-statement" className="space-y-4">
        <TabsList>
          <TabsTrigger value="income-statement" className="flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4" />
            <span>Estado de Resultados (P&L)</span>
          </TabsTrigger>
          <TabsTrigger value="balance-sheet" className="flex items-center gap-1.5">
            <Scale className="h-4 w-4" />
            <span>Balance General</span>
          </TabsTrigger>
          <TabsTrigger value="trial-balance" className="flex items-center gap-1.5">
            <PieChart className="h-4 w-4" />
            <span>Balanza de Comprobación</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab Estado de Resultados */}
        <TabsContent value="income-statement">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Estado de Resultados (P&L)</CardTitle>
              <CardDescription>
                Resumen de ingresos operacionales, costos y gastos clasificados.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Ingresos */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2 border-b pb-1">
                    1. Ingresos Operacionales
                  </h4>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableBody>
                        {accounts
                          .filter((a) => a.account_type === "Income")
                          .map((a) => (
                            <TableRow key={a.id}>
                              <TableCell className="font-mono text-xs w-[180px]">{a.code}</TableCell>
                              <TableCell className="text-xs font-medium">{a.name}</TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                $ {(balances[a.id]?.net || 0).toLocaleString("es-CL")}
                              </TableCell>
                            </TableRow>
                          ))}
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell colSpan={2} className="text-xs">Total Ingresos</TableCell>
                          <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                            $ {totalIncome.toLocaleString("es-CL")}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Costos y Gastos */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-destructive mb-2 border-b pb-1">
                    2. Costos de Venta & Gastos Operacionales
                  </h4>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableBody>
                        {accounts
                          .filter((a) => ["Expense", "Cost of Goods Sold"].includes(a.account_type))
                          .map((a) => (
                            <TableRow key={a.id}>
                              <TableCell className="font-mono text-xs w-[180px]">{a.code}</TableCell>
                              <TableCell className="text-xs font-medium">{a.name}</TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                $ {(balances[a.id]?.net || 0).toLocaleString("es-CL")}
                              </TableCell>
                            </TableRow>
                          ))}
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell colSpan={2} className="text-xs">Total Costos y Gastos</TableCell>
                          <TableCell className="text-right font-mono text-xs text-destructive">
                            $ {totalExpenses.toLocaleString("es-CL")}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Resumen Final */}
                <div className="p-4 rounded-lg bg-muted/60 border flex items-center justify-between">
                  <span className="font-bold text-sm">Utilidad / (Pérdida) Neta del Ejercicio:</span>
                  <span className={`font-mono text-lg font-bold ${netIncome >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                    $ {netIncome.toLocaleString("es-CL")} {baseCurrency}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Balance General */}
        <TabsContent value="balance-sheet">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Balance General Clasificado</CardTitle>
              <CardDescription>
                Estructura financiera: Activo = Pasivo + Patrimonio + Resultado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Activos */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary border-b pb-1">
                    Activos
                  </h4>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableBody>
                        {accounts
                          .filter((a) => a.account_type === "Asset")
                          .map((a) => (
                            <TableRow key={a.id}>
                              <TableCell className="font-mono text-xs w-[140px]">{a.code}</TableCell>
                              <TableCell className="text-xs">{a.name}</TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                $ {(balances[a.id]?.net || 0).toLocaleString("es-CL")}
                              </TableCell>
                            </TableRow>
                          ))}
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell colSpan={2} className="text-xs">Total Activos</TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            $ {totalAssets.toLocaleString("es-CL")}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Pasivo y Patrimonio */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary border-b pb-1">
                    Pasivos & Patrimonio
                  </h4>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableBody>
                        {accounts
                          .filter((a) => ["Liability", "Equity"].includes(a.account_type))
                          .map((a) => (
                            <TableRow key={a.id}>
                              <TableCell className="font-mono text-xs w-[140px]">{a.code}</TableCell>
                              <TableCell className="text-xs">{a.name}</TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                $ {(balances[a.id]?.net || 0).toLocaleString("es-CL")}
                              </TableCell>
                            </TableRow>
                          ))}
                        <TableRow>
                          <TableCell className="font-mono text-xs w-[140px]">3.9.00.000</TableCell>
                          <TableCell className="text-xs italic font-medium">Resultado del Ejercicio (P&L)</TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold">
                            $ {netIncome.toLocaleString("es-CL")}
                          </TableCell>
                        </TableRow>
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell colSpan={2} className="text-xs">Total Pasivo + Patrimonio</TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            $ {(totalLiabilities + totalEquity + netIncome).toLocaleString("es-CL")}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Balanza de Comprobación */}
        <TabsContent value="trial-balance">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Balanza de Comprobación y Saldos</CardTitle>
              <CardDescription>
                Sumas acumuladas de débitos, créditos y saldos netos por cuenta contable.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">Código</TableHead>
                      <TableHead>Nombre de la Cuenta</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Total Débito</TableHead>
                      <TableHead className="text-right">Total Crédito</TableHead>
                      <TableHead className="text-right">Saldo Neto ({baseCurrency})</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((a) => {
                      const b = balances[a.id] || { debit: 0, credit: 0, net: 0 };
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="font-mono text-xs font-medium">{a.code}</TableCell>
                          <TableCell className="text-xs">{a.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {a.account_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {b.debit > 0 ? `$ ${b.debit.toLocaleString("es-CL")}` : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {b.credit > 0 ? `$ ${b.credit.toLocaleString("es-CL")}` : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold">
                            $ {b.net.toLocaleString("es-CL")}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
