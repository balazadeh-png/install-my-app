import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, RefreshCw, BarChart3, PieChart, Scale, TrendingUp, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [
      { title: "Reportes Financieros | EasyERP" },
      { name: "description", content: "Balanza de comprobación, balance general y estado de resultados." },
    ],
  }),
});

function ReportsPage() {
  // Query: Accounts & GL Entries
  const dataQuery = useQuery({
    queryKey: ["financial_reports_data"],
    queryFn: async () => {
      const [accRes, glRes] = await Promise.all([
        supabase.from("accounts").select("*").order("code"),
        supabase.from("gl_entries").select("*"),
      ]);

      if (accRes.error) throw accRes.error;
      if (glRes.error) throw glRes.error;

      const accounts = accRes.data ?? [];
      const entries = glRes.data ?? [];

      // Calculate Balances per Account
      const balances: Record<string, { debit: number; credit: number; net: number }> = {};
      accounts.forEach((a) => {
        balances[a.id] = { debit: 0, credit: 0, net: 0 };
      });

      entries.forEach((e) => {
        if (balances[e.account_id]) {
          balances[e.account_id].debit += Number(e.debit || 0);
          balances[e.account_id].credit += Number(e.credit || 0);
        }
      });

      // Calculate net per account based on normal balance
      accounts.forEach((a) => {
        const b = balances[a.id];
        if (["Asset", "Expense", "Cost of Goods Sold"].includes(a.account_type)) {
          b.net = b.debit - b.credit;
        } else {
          b.net = b.credit - b.debit;
        }
      });

      return { accounts, entries, balances };
    },
  });

  const { accounts = [], balances = {} } = dataQuery.data ?? {};

  // Financial Aggregations
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;
  let totalIncome = 0;
  let totalExpenses = 0;

  accounts.forEach((a) => {
    const bal = balances[a.id]?.net || 0;
    if (a.account_type === "Asset") totalAssets += bal;
    if (a.account_type === "Liability") totalLiabilities += bal;
    if (a.account_type === "Equity") totalEquity += bal;
    if (a.account_type === "Income") totalIncome += bal;
    if (["Expense", "Cost of Goods Sold"].includes(a.account_type)) totalExpenses += bal;
  });

  const netIncome = totalIncome - totalExpenses;

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
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BarChart3 className="h-4 w-4" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reportes Financieros & Contables</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Estados financieros generados en tiempo real según las normas contables y asientos del sistema.
        </p>
      </div>

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
            <p className="text-xs text-muted-foreground mt-1">Bienes y derechos</p>
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
            <p className="text-xs text-muted-foreground mt-1">Obligaciones y deudas</p>
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
            <p className="text-xs text-muted-foreground mt-1">Ventas y otros ingresos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Utilidad Neta del Período
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
                  <span>Resultado Positivo</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                  <span>Pérdida en el Período</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="trial-balance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trial-balance" className="flex items-center gap-1.5">
            <Scale className="h-4 w-4" />
            <span>Balanza de Comprobación</span>
          </TabsTrigger>
          <TabsTrigger value="balance-sheet" className="flex items-center gap-1.5">
            <PieChart className="h-4 w-4" />
            <span>Balance General</span>
          </TabsTrigger>
          <TabsTrigger value="income-statement" className="flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" />
            <span>Estado de Resultados</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab Balanza de Comprobación */}
        <TabsContent value="trial-balance">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Balanza de Comprobación de Sumas y Saldos</CardTitle>
              <CardDescription>
                Verificación de la partida doble y saldos deudores / acreedores de cada cuenta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">Código</TableHead>
                      <TableHead>Cuenta</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Total Débito</TableHead>
                      <TableHead className="text-right">Total Crédito</TableHead>
                      <TableHead className="text-right">Saldo Neto ($)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                          No hay cuentas ni movimientos registrados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      accounts.map((a) => {
                        const b = balances[a.id] || { debit: 0, credit: 0, net: 0 };
                        return (
                          <TableRow key={a.id}>
                            <TableCell className="font-mono font-medium text-xs">{a.code}</TableCell>
                            <TableCell className="text-xs font-semibold">{a.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{a.account_type}</TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {b.debit > 0 ? b.debit.toLocaleString("es-CL") : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {b.credit > 0 ? b.credit.toLocaleString("es-CL") : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-bold">
                              $ {b.net.toLocaleString("es-CL")}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Balance General */}
        <TabsContent value="balance-sheet">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Activos */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Activos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {accounts
                    .filter((a) => a.account_type === "Asset")
                    .map((a) => (
                      <div key={a.id} className="flex justify-between items-center text-xs py-1 border-b border-muted">
                        <span className="font-medium">{a.code} - {a.name}</span>
                        <span className="font-mono font-semibold">
                          $ {(balances[a.id]?.net || 0).toLocaleString("es-CL")}
                        </span>
                      </div>
                    ))}
                  <div className="flex justify-between items-center text-sm font-bold pt-2">
                    <span>Total Activos</span>
                    <span className="font-mono">$ {totalAssets.toLocaleString("es-CL")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pasivos & Patrimonio */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Pasivos y Patrimonio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-xs font-bold text-muted-foreground uppercase">Pasivos</div>
                  {accounts
                    .filter((a) => a.account_type === "Liability")
                    .map((a) => (
                      <div key={a.id} className="flex justify-between items-center text-xs py-1 border-b border-muted">
                        <span className="font-medium">{a.code} - {a.name}</span>
                        <span className="font-mono font-semibold">
                          $ {(balances[a.id]?.net || 0).toLocaleString("es-CL")}
                        </span>
                      </div>
                    ))}
                  <div className="text-xs font-bold text-muted-foreground uppercase pt-2">Patrimonio</div>
                  {accounts
                    .filter((a) => a.account_type === "Equity")
                    .map((a) => (
                      <div key={a.id} className="flex justify-between items-center text-xs py-1 border-b border-muted">
                        <span className="font-medium">{a.code} - {a.name}</span>
                        <span className="font-mono font-semibold">
                          $ {(balances[a.id]?.net || 0).toLocaleString("es-CL")}
                        </span>
                      </div>
                    ))}
                  <div className="flex justify-between items-center text-xs py-1 border-b border-muted text-emerald-600 dark:text-emerald-400">
                    <span className="font-medium">Utilidad del Período</span>
                    <span className="font-mono font-semibold">
                      $ {netIncome.toLocaleString("es-CL")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold pt-2">
                    <span>Total Pasivo + Patrimonio</span>
                    <span className="font-mono">
                      $ {(totalLiabilities + totalEquity + netIncome).toLocaleString("es-CL")}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab Estado de Resultados */}
        <TabsContent value="income-statement">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Estado de Rendimiento Financiero (P&L)</CardTitle>
              <CardDescription>
                Resumen de ingresos operacionales, costos de venta y gastos administrativos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-2xl mx-auto space-y-4 text-xs">
                {/* Ingresos */}
                <div className="space-y-2">
                  <div className="font-bold text-foreground uppercase border-b pb-1">Ingresos Operacionales</div>
                  {accounts.filter((a) => a.account_type === "Income").map((a) => (
                    <div key={a.id} className="flex justify-between">
                      <span>{a.code} - {a.name}</span>
                      <span className="font-mono font-semibold">
                        $ {(balances[a.id]?.net || 0).toLocaleString("es-CL")}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold pt-1 border-t">
                    <span>Total Ingresos</span>
                    <span className="font-mono">$ {totalIncome.toLocaleString("es-CL")}</span>
                  </div>
                </div>

                {/* Gastos y Costos */}
                <div className="space-y-2 pt-4">
                  <div className="font-bold text-foreground uppercase border-b pb-1">Costos y Gastos Operacionales</div>
                  {accounts.filter((a) => ["Expense", "Cost of Goods Sold"].includes(a.account_type)).map((a) => (
                    <div key={a.id} className="flex justify-between">
                      <span>{a.code} - {a.name}</span>
                      <span className="font-mono font-semibold text-destructive">
                        ($ {(balances[a.id]?.net || 0).toLocaleString("es-CL")})
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold pt-1 border-t">
                    <span>Total Costos y Gastos</span>
                    <span className="font-mono text-destructive">
                      ($ {totalExpenses.toLocaleString("es-CL")})
                    </span>
                  </div>
                </div>

                {/* Resultado */}
                <div className="p-4 rounded-lg bg-muted/60 flex justify-between items-center text-sm font-bold mt-4">
                  <span>UTILIDAD / PÉRDIDA NETA:</span>
                  <span className={`font-mono text-base ${netIncome >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                    $ {netIncome.toLocaleString("es-CL")}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
