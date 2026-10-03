import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEntity } from "@/context/ActiveEntityContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
} from "recharts";
import {
  BarChart3,
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  Landmark,
  Scale,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  BookOpen,
  PieChart,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  Info,
} from "lucide-react";
import { AccountLedgerDrawer } from "@/components/accounting/AccountLedgerDrawer";
import { SourceDocumentDialog } from "@/components/accounting/SourceDocumentDialog";
import { AccountTypeBreakdownDialog } from "@/components/accounting/AccountTypeBreakdownDialog";

export const Route = createFileRoute("/_authenticated/dashboard-financiero")({
  head: () => ({
    meta: [
      { title: "Dashboard Financiero & Ratios IFRS | EasyERP" },
      {
        name: "description",
        content:
          "Tablero financiero ejecutivo con Estado de Resultados, Flujo de Caja, Ratios IFRS, Días de Inventario y drill-down a nivel de libro mayor y documento fuente.",
      },
    ],
  }),
  component: FinancialDashboardPage,
});

function FinancialDashboardPage() {
  const { activeEntity, activeEntityId } = useActiveEntity();
  const baseCurrency = activeEntity?.base_currency_code || "CLP";

  // Estados de Filtros
  const [monthsBack, setMonthsBack] = useState<number>(12);
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Estados de Drill-Down Multinivel
  // Nivel 2: Desglose por Cuentas del Tipo y Mes
  const [breakdownState, setBreakdownState] = useState<{
    open: boolean;
    accountType: string;
    categoryLabel: string;
    periodStart: string;
    periodEnd: string;
  }>({
    open: false,
    accountType: "Income",
    categoryLabel: "Ingresos Operacionales",
    periodStart: "",
    periodEnd: "",
  });

  // Nivel 3: Libro Mayor de Cuenta Específica
  const [selectedLedgerAccount, setSelectedLedgerAccount] = useState<{
    id: string;
    code: string;
    name: string;
    account_type: string;
  } | null>(null);
  const [ledgerDrawerOpen, setLedgerDrawerOpen] = useState(false);
  const [ledgerStartDate, setLedgerStartDate] = useState<string | undefined>(undefined);
  const [ledgerEndDate, setLedgerEndDate] = useState<string | undefined>(undefined);

  // Nivel 4: Documento Fuente
  const [selectedJournalEntryId, setSelectedJournalEntryId] = useState<string | null>(null);
  const [sourceDocModalOpen, setSourceDocModalOpen] = useState(false);

  // Periodo para Días de Inventario (DIO) - default: mes actual
  const [dioPeriodStart, setDioPeriodStart] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [dioPeriodEnd, setDioPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));

  // =========================================================================
  // QUERIES
  // =========================================================================

  // 1. Resumen General del Dashboard & Ratios IFRS
  const summaryQuery = useQuery({
    queryKey: ["financial_dashboard_summary", activeEntityId, asOfDate],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_financial_dashboard_summary", {
        _entity_id: activeEntityId,
        _as_of_date: asOfDate,
      });
      if (error) {
        console.error("Error loading financial dashboard summary:", error);
        throw error;
      }
      return data as any;
    },
  });

  // 2. Estado de Resultados Mensual
  const incomeStatementQuery = useQuery({
    queryKey: ["monthly_income_statement", activeEntityId, monthsBack],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_monthly_income_statement", {
        _entity_id: activeEntityId,
        _months_back: monthsBack,
      });
      if (error) {
        console.error("Error loading monthly income statement:", error);
        throw error;
      }
      return (data as any[]) ?? [];
    },
  });

  // 3. Flujo de Caja Mensual
  const cashFlowQuery = useQuery({
    queryKey: ["monthly_cash_flow", activeEntityId, monthsBack],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_monthly_cash_flow", {
        _entity_id: activeEntityId,
        _months_back: monthsBack,
      });
      if (error) {
        console.error("Error loading monthly cash flow:", error);
        throw error;
      }
      return (data as any[]) ?? [];
    },
  });

  // 4. Cuentas Contables Predeterminadas
  const defaultsQuery = useQuery({
    queryKey: ["company_default_accounts", activeEntityId],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_default_accounts" as any)
        .select(`
          *,
          receivable_account:accounts!company_default_accounts_receivable_account_id_fkey(id, code, name, account_type),
          payable_account:accounts!company_default_accounts_payable_account_id_fkey(id, code, name, account_type)
        `)
        .eq("entity_id", activeEntityId)
        .maybeSingle();

      if (error) {
        console.warn("Could not fetch company default accounts:", error);
        return null;
      }
      return data as any;
    },
  });

  // 5. Cuentas Bancarias Registradas
  const bankAccountsQuery = useQuery({
    queryKey: ["bank_accounts", activeEntityId],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts" as any)
        .select("id, bank_name, account_number, account:accounts(id, code, name, account_type)")
        .eq("entity_id", activeEntityId)
        .eq("active", true);
      if (error) return [];
      return (data as any[]) ?? [];
    },
  });

  // 6. Días de Inventario (DIO)
  const dioQuery = useQuery({
    queryKey: ["days_inventory_outstanding", activeEntityId, dioPeriodStart, dioPeriodEnd],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_days_inventory_outstanding", {
        _entity_id: activeEntityId,
        _period_start: dioPeriodStart,
        _period_end: dioPeriodEnd,
      });
      if (error) throw error;
      return data as any;
    },
  });

  const summary = summaryQuery.data ?? {};
  const ratios = summary.ratios ?? {};
  const defaults = defaultsQuery.data;
  const bankAccounts = bankAccountsQuery.data ?? [];
  const dioData = dioQuery.data ?? {};

  // Formatear datos de Estado de Resultados para Recharts
  const incomeChartData = useMemo(() => {
    return (incomeStatementQuery.data ?? []).map((row: any) => {
      // row.month ej. "2026-05-01"
      const dateObj = new Date(row.month);
      const label = dateObj.toLocaleDateString("es-CL", { month: "short", year: "2-digit" });
      return {
        rawMonth: row.month,
        label,
        Ingresos: Number(row.income || 0),
        "Costo de Ventas": Number(row.cogs || 0),
        Gastos: Number(row.expense || 0),
        "Utilidad Neta": Number(row.net_income || 0),
      };
    });
  }, [incomeStatementQuery.data]);

  // Formatear datos de Flujo de Caja para Recharts
  const cashChartData = useMemo(() => {
    return (cashFlowQuery.data ?? []).map((row: any) => {
      const dateObj = new Date(row.month);
      const label = dateObj.toLocaleDateString("es-CL", { month: "short", year: "2-digit" });
      return {
        rawMonth: row.month,
        label,
        "Cobros / Entradas": Number(row.cash_in || 0),
        "Pagos / Salidas": Number(row.cash_out || 0),
        "Flujo Neto": Number(row.net_flow || 0),
      };
    });
  }, [cashFlowQuery.data]);

  // Manejador de Apertura del Desglose por Cuenta (Drill-Down Nivel 2)
  const handleOpenBreakdown = (accountType: string, label: string, monthDate: string) => {
    const start = new Date(monthDate);
    const y = start.getFullYear();
    const m = start.getMonth();
    const firstDay = new Date(y, m, 1).toISOString().slice(0, 10);
    const lastDay = new Date(y, m + 1, 0).toISOString().slice(0, 10);

    setBreakdownState({
      open: true,
      accountType,
      categoryLabel: label,
      periodStart: firstDay,
      periodEnd: lastDay,
    });
  };

  // Manejador de Selección de Cuenta para Mayor (Drill-Down Nivel 3)
  const handleSelectAccountForLedger = (
    account: { id: string; code: string; name: string; account_type: string },
    startDate?: string,
    endDate?: string
  ) => {
    setSelectedLedgerAccount(account);
    setLedgerStartDate(startDate);
    setLedgerEndDate(endDate);
    setLedgerDrawerOpen(true);
  };

  // Abrir Mayor de Cuentas por Cobrar o Pagar
  const handleOpenReceivableLedger = () => {
    if (!defaults?.receivable_account) {
      return;
    }
    handleSelectAccountForLedger(defaults.receivable_account);
  };

  const handleOpenPayableLedger = () => {
    if (!defaults?.payable_account) {
      return;
    }
    handleSelectAccountForLedger(defaults.payable_account);
  };

  // Abrir Mayor de Cuentas Bancarias
  const handleOpenBankLedger = () => {
    const firstBa = bankAccounts[0];
    if (firstBa?.account) {
      handleSelectAccountForLedger(firstBa.account);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Encabezado y Filtros */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              <span>Dashboard Financiero (IFRS / Finanzas)</span>
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1 ml-10">
            Monitor ejecutivo de rentabilidad, liquidez, flujo de caja y drill-down en 3 niveles hasta el comprobante de origen.
          </p>
        </div>

        {/* Filtros Globales */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 bg-card border rounded-lg px-2.5 py-1 text-xs shadow-xs">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground font-medium">Corte:</span>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="bg-transparent text-xs font-mono border-none focus:outline-none"
            />
          </div>

          <Select value={String(monthsBack)} onValueChange={(val) => setMonthsBack(Number(val))}>
            <SelectTrigger className="h-8 text-xs w-[130px]">
              <SelectValue placeholder="Rango meses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Últimos 12 meses</SelectItem>
              <SelectItem value="24">Últimos 24 meses</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              summaryQuery.refetch();
              incomeStatementQuery.refetch();
              cashFlowQuery.refetch();
              dioQuery.refetch();
            }}
            disabled={summaryQuery.isFetching}
            className="text-xs gap-1.5 h-8"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${summaryQuery.isFetching ? "animate-spin" : ""}`} />
            <span>Refrescar</span>
          </Button>
        </div>
      </div>

      {/* Alerta de Cuentas Corrientes Sin Clasificar */}
      {Number(summary.unclassified_current_accounts || 0) > 0 && (
        <div className="flex items-center justify-between p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-semibold">
                Tienes {summary.unclassified_current_accounts}{" "}
                {summary.unclassified_current_accounts === 1 ? "cuenta" : "cuentas"} de Activo/Pasivo sin clasificación de liquidez.
              </span>
              <p className="text-[11px] opacity-90 mt-0.5">
                Clasifícalas como Corriente (&le; 12 meses) o No Corriente en el Plan de Cuentas para calcular con precisión la Razón Corriente y Prueba Ácida.
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="h-7 text-xs border-amber-500/40 hover:bg-amber-500/20 shrink-0">
            <Link to="/accounting">
              <span>Ir al Plan de Cuentas</span>
              <ArrowUpRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </div>
      )}

      {/* KPI Cards Superiores: AR, AP, Inventario & Conciliación */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Widget 3: Cuentas por Cobrar Total */}
        <Card className="p-4 border-l-4 border-l-blue-500 shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
              <span>Cuentas por Cobrar (CxC)</span>
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold mt-2 font-mono text-foreground">
              {summary.accounts_receivable !== null
                ? `$ ${Number(summary.accounts_receivable).toLocaleString("es-CL")}`
                : "No configurada"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {defaults?.receivable_account
                ? `${defaults.receivable_account.code} - ${defaults.receivable_account.name}`
                : "Saldo clientes pendiente a la fecha"}
            </p>
          </div>
          <div className="mt-3 pt-2 border-t">
            {defaults?.receivable_account ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-full text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 justify-between px-1"
                onClick={handleOpenReceivableLedger}
              >
                <span>Ver Mayor de Clientes</span>
                <ArrowUpRight className="h-3 w-3" />
              </Button>
            ) : (
              <Button asChild variant="ghost" size="sm" className="h-7 w-full text-xs text-muted-foreground justify-between px-1">
                <Link to="/setup">Configurar cuenta</Link>
              </Button>
            )}
          </div>
        </Card>

        {/* Widget 4: Cuentas por Pagar Total */}
        <Card className="p-4 border-l-4 border-l-amber-500 shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
              <span>Cuentas por Pagar (CxP)</span>
              <ShoppingCart className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold mt-2 font-mono text-foreground">
              {summary.accounts_payable !== null
                ? `$ ${Number(summary.accounts_payable).toLocaleString("es-CL")}`
                : "No configurada"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {defaults?.payable_account
                ? `${defaults.payable_account.code} - ${defaults.payable_account.name}`
                : "Obligaciones pendientes con proveedores"}
            </p>
          </div>
          <div className="mt-3 pt-2 border-t">
            {defaults?.payable_account ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-full text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 justify-between px-1"
                onClick={handleOpenPayableLedger}
              >
                <span>Ver Mayor de Proveedores</span>
                <ArrowUpRight className="h-3 w-3" />
              </Button>
            ) : (
              <Button asChild variant="ghost" size="sm" className="h-7 w-full text-xs text-muted-foreground justify-between px-1">
                <Link to="/setup">Configurar cuenta</Link>
              </Button>
            )}
          </div>
        </Card>

        {/* Widget 5: Días de Inventario (DIO) */}
        <Card className="p-4 border-l-4 border-l-purple-500 shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
              <span>Días de Inventario (DIO)</span>
              <Package className="h-4 w-4 text-purple-600" />
            </div>
            {dioData.error ? (
              <div className="mt-2 text-xs text-amber-600 font-medium">
                {dioData.error}
              </div>
            ) : (
              <div className="text-2xl font-bold mt-2 font-mono text-purple-600 dark:text-purple-400">
                {dioData.dio !== null && dioData.dio !== undefined ? `${dioData.dio} días` : "—"}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {dioData.average_inventory !== undefined
                ? `Inventario Prom: $${Number(dioData.average_inventory || 0).toLocaleString("es-CL")}`
                : "Rotación promedio de mercaderías"}
            </p>
          </div>
          <div className="mt-3 pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Período: {dioData.days_in_period || 30} días</span>
            <Button asChild variant="ghost" size="sm" className="h-6 text-[11px] px-1 text-primary">
              <Link to="/inventory">Ver Kardex</Link>
            </Button>
          </div>
        </Card>

        {/* Widget 7: Cuentas sin Conciliar en Bancos */}
        <Card className="p-4 border-l-4 border-l-emerald-500 shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
              <span>Partidas sin Conciliar</span>
              <Landmark className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold mt-2 font-mono text-foreground flex items-center gap-2">
              <span>{summary.unreconciled_bank_lines ?? 0}</span>
              {Number(summary.unreconciled_bank_lines || 0) === 0 ? (
                <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Al día
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-[10px]">
                  Pendientes
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Líneas de cartola bancaria por conciliar
            </p>
          </div>
          <div className="mt-3 pt-2 border-t">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-7 w-full text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 justify-between px-1"
            >
              <Link to="/cash">
                <span>Ir a Conciliación Bancaria</span>
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </Card>
      </div>

      {/* Gráficos Principales: Estado de Resultados y Flujo de Caja */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Widget 1: Estado de Resultados Mensual */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <PieChart className="h-4 w-4 text-emerald-600" />
                <span>Estado de Resultados Mensual</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Ingresos, Costo de Ventas, Gastos y Utilidad Neta ({baseCurrency}). Haz clic en los botones de abajo para drill-down.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-2 flex-1 flex flex-col justify-between">
            <div className="h-[280px] w-full">
              {incomeStatementQuery.isLoading ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  Cargando estado de resultados...
                </div>
              ) : incomeChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  Sin datos contables registrados en el período.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={incomeChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(val: any) => [`$${Number(val).toLocaleString("es-CL")} ${baseCurrency}`, ""]}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                    <Bar dataKey="Ingresos" fill="#10b981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Costo de Ventas" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Gastos" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                    <Line
                      type="monotone"
                      dataKey="Utilidad Neta"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Accesos rápidos de Drill-Down por Mes Reciente */}
            {incomeChartData.length > 0 && (
              <div className="mt-3 pt-3 border-t flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground text-[11px] font-medium">
                  Drill-Down Mes Reciente ({incomeChartData[incomeChartData.length - 1]?.label}):
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[11px] px-2 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                    onClick={() =>
                      handleOpenBreakdown(
                        "Income",
                        "Ingresos Operacionales",
                        incomeChartData[incomeChartData.length - 1].rawMonth
                      )
                    }
                  >
                    Ver Ingresos
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[11px] px-2 text-amber-700 dark:text-amber-300 border-amber-500/40"
                    onClick={() =>
                      handleOpenBreakdown(
                        "Cost of Goods Sold",
                        "Costo de Ventas (COGS)",
                        incomeChartData[incomeChartData.length - 1].rawMonth
                      )
                    }
                  >
                    Ver Costo
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[11px] px-2 text-purple-700 dark:text-purple-300 border-purple-500/40"
                    onClick={() =>
                      handleOpenBreakdown(
                        "Expense",
                        "Gastos de Operación",
                        incomeChartData[incomeChartData.length - 1].rawMonth
                      )
                    }
                  >
                    Ver Gastos
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Widget 2: Flujo de Caja Neto Mensual */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <span>Flujo de Caja Neto Mensual</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Cobros, pagos y flujo neto sobre cuentas bancarias activas ({baseCurrency}).
              </CardDescription>
            </div>
            {bankAccounts.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-primary gap-1 px-1.5"
                onClick={handleOpenBankLedger}
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Mayor Bancos</span>
              </Button>
            )}
          </CardHeader>
          <CardContent className="pt-2 flex-1 flex flex-col justify-between">
            <div className="h-[280px] w-full">
              {cashFlowQuery.isLoading ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  Cargando flujo de caja...
                </div>
              ) : cashChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  Sin movimientos de tesorería registrados.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={cashChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(val: any) => [`$${Number(val).toLocaleString("es-CL")} ${baseCurrency}`, ""]}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                    <Bar dataKey="Cobros / Entradas" fill="#10b981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Pagos / Salidas" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    <Line
                      type="monotone"
                      dataKey="Flujo Neto"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
              <span>{bankAccounts.length} cuentas bancarias consideradas</span>
              <Button asChild variant="ghost" size="sm" className="h-6 text-[11px] px-1 text-primary">
                <Link to="/cash">Gestionar Cartolas</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Widget 6: Ratios Financieros Estándar IFRS */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" />
                <span>Ratios Financieros Estándar (Normativa IFRS)</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Métricas estándar de solvencia, liquidez, apalancamiento y rentabilidad calculadas sobre el Libro Mayor a la fecha de corte.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              Fecha de Corte: {asOfDate}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Grupo 1: Liquidez */}
            <div className="p-3.5 rounded-xl border bg-card/60 space-y-3">
              <div className="flex items-center justify-between border-b pb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  1. Ratios de Liquidez
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  Corto Plazo
                </Badge>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <div className="space-y-0.5">
                    <div className="font-semibold">Razón Corriente</div>
                    <div className="text-[10px] text-muted-foreground">Activo Corr. / Pasivo Corr.</div>
                  </div>
                  <div className="text-right font-mono font-bold text-sm">
                    {ratios.current_ratio !== null && ratios.current_ratio !== undefined ? (
                      <span className={Number(ratios.current_ratio) >= 1.5 ? "text-emerald-600" : "text-amber-600"}>
                        {ratios.current_ratio}x
                      </span>
                    ) : (
                      <span className="text-muted-foreground" title="Clasifica cuentas de Activo y Pasivo como corrientes">—</span>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <div className="space-y-0.5">
                    <div className="font-semibold">Prueba Ácida</div>
                    <div className="text-[10px] text-muted-foreground">(Act. Corr. − Inventario) / Pasivo</div>
                  </div>
                  <div className="text-right font-mono font-bold text-sm">
                    {ratios.quick_ratio !== null && ratios.quick_ratio !== undefined ? (
                      <span className={Number(ratios.quick_ratio) >= 1.0 ? "text-emerald-600" : "text-amber-600"}>
                        {ratios.quick_ratio}x
                      </span>
                    ) : (
                      <span className="text-muted-foreground" title="Clasifica cuentas corrientes">—</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Grupo 2: Endeudamiento */}
            <div className="p-3.5 rounded-xl border bg-card/60 space-y-3">
              <div className="flex items-center justify-between border-b pb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  2. Endeudamiento
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  Solvencia
                </Badge>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <div className="space-y-0.5">
                    <div className="font-semibold">Deuda / Patrimonio</div>
                    <div className="text-[10px] text-muted-foreground">Pasivo Total / Patrimonio</div>
                  </div>
                  <div className="text-right font-mono font-bold text-sm">
                    {ratios.debt_to_equity !== null && ratios.debt_to_equity !== undefined ? (
                      `${ratios.debt_to_equity}x`
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <div className="space-y-0.5">
                    <div className="font-semibold">Deuda / Activos</div>
                    <div className="text-[10px] text-muted-foreground">Pasivo Total / Activo Total</div>
                  </div>
                  <div className="text-right font-mono font-bold text-sm">
                    {ratios.debt_to_assets !== null && ratios.debt_to_assets !== undefined ? (
                      `${ratios.debt_to_assets}x`
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Grupo 3: Rentabilidad YTD */}
            <div className="p-3.5 rounded-xl border bg-card/60 space-y-3">
              <div className="flex items-center justify-between border-b pb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  3. Rentabilidad (YTD)
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  Resultados
                </Badge>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Margen Bruto:</span>
                  <span className="font-mono font-bold">
                    {ratios.gross_margin_ytd !== null && ratios.gross_margin_ytd !== undefined
                      ? `${(Number(ratios.gross_margin_ytd) * 100).toFixed(1)}%`
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Margen Neto:</span>
                  <span className="font-mono font-bold">
                    {ratios.net_margin_ytd !== null && ratios.net_margin_ytd !== undefined
                      ? `${(Number(ratios.net_margin_ytd) * 100).toFixed(1)}%`
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">ROE (Retorno Patrimonio):</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {ratios.roe_ytd !== null && ratios.roe_ytd !== undefined
                      ? `${(Number(ratios.roe_ytd) * 100).toFixed(1)}%`
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">ROA (Retorno Activos):</span>
                  <span className="font-mono font-bold">
                    {ratios.roa_ytd !== null && ratios.roa_ytd !== undefined
                      ? `${(Number(ratios.roa_ytd) * 100).toFixed(1)}%`
                      : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Grupo 4: Eficiencia Operacional */}
            <div className="p-3.5 rounded-xl border bg-card/60 space-y-3">
              <div className="flex items-center justify-between border-b pb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  4. Eficiencia
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  Operación
                </Badge>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <div className="space-y-0.5">
                    <div className="font-semibold">Rotación de Activos</div>
                    <div className="text-[10px] text-muted-foreground">Ingresos YTD / Activo Total</div>
                  </div>
                  <div className="text-right font-mono font-bold text-sm">
                    {ratios.asset_turnover_ytd !== null && ratios.asset_turnover_ytd !== undefined ? (
                      `${ratios.asset_turnover_ytd}x`
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t text-[11px] text-muted-foreground flex justify-between">
                  <span>Utilidad YTD Acumulada:</span>
                  <span className="font-mono font-semibold text-foreground">
                    $ {Number(summary.net_income_ytd || 0).toLocaleString("es-CL")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diálogos de Drill-Down */}

      {/* Nivel 2: Desglose por Cuenta */}
      <AccountTypeBreakdownDialog
        open={breakdownState.open}
        onOpenChange={(open) => setBreakdownState((prev) => ({ ...prev, open }))}
        entityId={activeEntityId || ""}
        accountType={breakdownState.accountType}
        categoryLabel={breakdownState.categoryLabel}
        periodStart={breakdownState.periodStart}
        periodEnd={breakdownState.periodEnd}
        baseCurrency={baseCurrency}
        onSelectAccount={(acc, start, end) => handleSelectAccountForLedger(acc, start, end)}
      />

      {/* Nivel 3: Libro Mayor Lateral Drawer */}
      <AccountLedgerDrawer
        open={ledgerDrawerOpen}
        onOpenChange={setLedgerDrawerOpen}
        account={selectedLedgerAccount}
        defaultStartDate={ledgerStartDate}
        defaultEndDate={ledgerEndDate}
      />

      {/* Nivel 4: Documento Fuente */}
      <SourceDocumentDialog
        open={sourceDocModalOpen}
        onOpenChange={setSourceDocModalOpen}
        journalEntryId={selectedJournalEntryId}
      />
    </div>
  );
}
