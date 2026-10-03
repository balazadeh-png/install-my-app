import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getModules, getUserRoles } from "@/lib/auth.functions";
import { useServerFn } from "@tanstack/react-start";
import { useActiveEntity } from "@/context/ActiveEntityContext";
import { useCompanyModules } from "@/hooks/useCompanyModules";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Package,
  ShoppingCart,
  DollarSign,
  Settings,
  BarChart3,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Factory,
  Store,
  FileSpreadsheet,
  Landmark,
  FileBadge2,
  Shield,
  ShieldCheck,
  TrendingUp,
  Truck,
  LineChart,
  Search,
  X,
  Coins,
  LayoutGrid,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

interface ModuleConfigItem {
  icon: React.ReactNode;
  path: string;
  description: string;
  colorTheme: "emerald" | "blue" | "purple" | "amber" | "indigo" | "slate";
}

const moduleConfig: Record<string, ModuleConfigItem> = {
  financial_dashboard: {
    icon: <TrendingUp className="h-5 w-5" />,
    path: "/dashboard-financiero",
    description: "Indicadores IFRS, Estado de Resultados mensual, Flujo de Caja y drill-down multinivel.",
    colorTheme: "emerald",
  },
  "financial-dashboard": {
    icon: <TrendingUp className="h-5 w-5" />,
    path: "/dashboard-financiero",
    description: "Indicadores IFRS, Estado de Resultados mensual, Flujo de Caja y drill-down multinivel.",
    colorTheme: "emerald",
  },
  accounting: {
    icon: <BookOpen className="h-5 w-5" />,
    path: "/accounting",
    description: "Catálogo de cuentas clasificado, asientos de diario, libro mayor y comprobantes.",
    colorTheme: "emerald",
  },
  cash: {
    icon: <DollarSign className="h-5 w-5" />,
    path: "/cash",
    description: "Conciliación bancaria inteligente, importación de cartolas y tesorería.",
    colorTheme: "emerald",
  },
  assets: {
    icon: <Building2 className="h-5 w-5" />,
    path: "/assets",
    description: "Catálogo de bienes de uso, depreciación mensual automática y bajas de activo fijo.",
    colorTheme: "emerald",
  },
  reports: {
    icon: <BarChart3 className="h-5 w-5" />,
    path: "/reports",
    description: "Balance general clasificado, estado de resultados y balances de 8 columnas.",
    colorTheme: "emerald",
  },
  sales: {
    icon: <Users className="h-5 w-5" />,
    path: "/sales",
    description: "Facturación electrónica DTE, notas de crédito, cotizaciones y clientes.",
    colorTheme: "blue",
  },
  pos: {
    icon: <Store className="h-5 w-5" />,
    path: "/pos",
    description: "Terminal de venta mostrador, emisión de boletas y arqueo de caja diario.",
    colorTheme: "blue",
  },
  purchases: {
    icon: <ShoppingCart className="h-5 w-5" />,
    path: "/purchases",
    description: "Facturación de compra, IVA crédito fiscal y órdenes de compra con numeración atómica.",
    colorTheme: "blue",
  },
  suppliers: {
    icon: <Building2 className="h-5 w-5" />,
    path: "/suppliers",
    description: "Directorio de proveedores, contratos PDF versionados y catálogo comercial.",
    colorTheme: "blue",
  },
  inventory: {
    icon: <Package className="h-5 w-5" />,
    path: "/inventory",
    description: "Kardex FIFO de mercaderías, saldos físicos y control multibodega.",
    colorTheme: "blue",
  },
  production: {
    icon: <Factory className="h-5 w-5" />,
    path: "/production",
    description: "Fórmulas de fabricación (BOM), costeo real y órdenes de producción.",
    colorTheme: "blue",
  },
  dispatch: {
    icon: <Truck className="h-5 w-5" />,
    path: "/dispatch",
    description: "Guías de despacho electrónicas, seguimiento WMS/TMS y facturación 3PL.",
    colorTheme: "purple",
  },
  "dashboard-3pl": {
    icon: <LineChart className="h-5 w-5" />,
    path: "/dashboard-3pl",
    description: "Panel BI de almacenamiento, cubicaje, facturación 3PL y predicción operacional.",
    colorTheme: "purple",
  },
  dashboard_3pl: {
    icon: <LineChart className="h-5 w-5" />,
    path: "/dashboard-3pl",
    description: "Panel BI de almacenamiento, cubicaje, facturación 3PL y predicción operacional.",
    colorTheme: "purple",
  },
  portal: {
    icon: <ShieldCheck className="h-5 w-5" />,
    path: "/portal",
    description: "Portal multi-inquilino de autoservicio para clientes y proveedores.",
    colorTheme: "purple",
  },
  "sii-books": {
    icon: <FileSpreadsheet className="h-5 w-5" />,
    path: "/sii-books",
    description: "Libros oficiales Diario, Mayor, Balance 8 Columnas y Registro RCV.",
    colorTheme: "amber",
  },
  sii_books: {
    icon: <FileSpreadsheet className="h-5 w-5" />,
    path: "/sii-books",
    description: "Libros oficiales Diario, Mayor, Balance 8 Columnas y Registro RCV.",
    colorTheme: "amber",
  },
  taxes: {
    icon: <Landmark className="h-5 w-5" />,
    path: "/taxes",
    description: "Declaraciones F29 mensual, cálculo de PPM y declaración de renta anual F22.",
    colorTheme: "amber",
  },
  "declaraciones-juradas": {
    icon: <FileBadge2 className="h-5 w-5" />,
    path: "/declaraciones-juradas",
    description: "Motor extensible de DDJJ anuales ante el SII (DJ 1879, 1887, 1947).",
    colorTheme: "amber",
  },
  declaraciones_juradas: {
    icon: <FileBadge2 className="h-5 w-5" />,
    path: "/declaraciones-juradas",
    description: "Motor extensible de DDJJ anuales ante el SII (DJ 1879, 1887, 1947).",
    colorTheme: "amber",
  },
  roles: {
    icon: <Shield className="h-5 w-5" />,
    path: "/setup?tab=roles",
    description: "Crear usuarios, restablecer credenciales, permisos y roles por empresa.",
    colorTheme: "indigo",
  },
  setup: {
    icon: <Settings className="h-5 w-5" />,
    path: "/setup",
    description: "Entidades legales, años fiscales, períodos, correlativos y plan contable.",
    colorTheme: "slate",
  },
};

const THEMES = {
  emerald: {
    iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:bg-emerald-600 group-hover:text-white dark:group-hover:bg-emerald-500 dark:group-hover:text-slate-950",
    pillBg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    cardHover: "hover:border-emerald-500/50 hover:shadow-emerald-500/10",
    accentDot: "bg-emerald-500",
  },
  blue: {
    iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 group-hover:bg-blue-600 group-hover:text-white dark:group-hover:bg-blue-500 dark:group-hover:text-slate-950",
    pillBg: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
    cardHover: "hover:border-blue-500/50 hover:shadow-blue-500/10",
    accentDot: "bg-blue-500",
  },
  purple: {
    iconBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 group-hover:bg-purple-600 group-hover:text-white dark:group-hover:bg-purple-500 dark:group-hover:text-slate-950",
    pillBg: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
    cardHover: "hover:border-purple-500/50 hover:shadow-purple-500/10",
    accentDot: "bg-purple-500",
  },
  amber: {
    iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 group-hover:bg-amber-600 group-hover:text-white dark:group-hover:bg-amber-500 dark:group-hover:text-slate-950",
    pillBg: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    cardHover: "hover:border-amber-500/50 hover:shadow-amber-500/10",
    accentDot: "bg-amber-500",
  },
  indigo: {
    iconBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 group-hover:bg-indigo-600 group-hover:text-white dark:group-hover:bg-indigo-500 dark:group-hover:text-slate-950",
    pillBg: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
    cardHover: "hover:border-indigo-500/50 hover:shadow-indigo-500/10",
    accentDot: "bg-indigo-500",
  },
  slate: {
    iconBg: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20 group-hover:bg-slate-800 dark:group-hover:bg-slate-200 group-hover:text-white dark:group-hover:text-slate-950",
    pillBg: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
    cardHover: "hover:border-slate-500/50 hover:shadow-slate-500/10",
    accentDot: "bg-slate-500",
  },
};

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dashboard | EasyERP" },
      { name: "description", content: "Panel de control ejecutivo de EasyERP." },
      { property: "og:title", content: "Dashboard | EasyERP" },
      { property: "og:description", content: "Panel de control ejecutivo de EasyERP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Dashboard() {
  const fetchModules = useServerFn(getModules);
  const fetchRoles = useServerFn(getUserRoles);
  const { activeEntity, activeEntityId } = useActiveEntity();
  const { isModuleEnabled } = useCompanyModules(activeEntityId);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  const modulesQuery = useQuery({
    queryKey: ["modules"],
    queryFn: fetchModules,
  });

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: fetchRoles,
  });

  const modules = modulesQuery.data ?? [];
  const roles = rolesQuery.data ?? [];

  // Filtrar módulos habilitados para la empresa activa
  const visibleModules = useMemo(() => {
    return modules.filter((mod) => isModuleEnabled(mod.name));
  }, [modules, isModuleEnabled]);

  // Lista de categorías únicas presentes
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    visibleModules.forEach((m: any) => {
      if (m.group_name) set.add(m.group_name);
    });
    return Array.from(set);
  }, [visibleModules]);

  // Filtrado reactivo por texto y por pestaña de categoría
  const filteredModules = useMemo(() => {
    return visibleModules.filter((mod) => {
      const group = (mod as any).group_name || "Otros";
      if (selectedCategory !== "ALL" && group !== selectedCategory) {
        return false;
      }
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const cfg = moduleConfig[mod.name];
      const matchLabel = mod.label.toLowerCase().includes(q);
      const matchName = mod.name.toLowerCase().includes(q);
      const matchDesc = cfg?.description.toLowerCase().includes(q);
      const matchGroup = group.toLowerCase().includes(q);

      return matchLabel || matchName || matchDesc || matchGroup;
    });
  }, [visibleModules, selectedCategory, searchQuery]);

  // Agrupar módulos filtrados
  const groupedModules = useMemo(() => {
    return filteredModules.reduce<Record<string, typeof modules>>((acc, mod) => {
      const grp = (mod as any).group_name || "Otros";
      if (!acc[grp]) acc[grp] = [];
      acc[grp].push(mod);
      return acc;
    }, {});
  }, [filteredModules]);

  const groupIcons: Record<string, React.ReactNode> = {
    Finanzas: <Landmark className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
    Operaciones: <Factory className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
    "Logística 3PL": <Truck className="h-4 w-4 text-purple-600 dark:text-purple-400" />,
    Impuestos: <FileBadge2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
    Configuración: <Settings className="h-4 w-4 text-slate-600 dark:text-slate-400" />,
    Configuracion: <Settings className="h-4 w-4 text-slate-600 dark:text-slate-400" />,
    Otros: <LayoutDashboard className="h-4 w-4 text-muted-foreground" />,
  };

  const groupBadgeThemes: Record<string, keyof typeof THEMES> = {
    Finanzas: "emerald",
    Operaciones: "blue",
    "Logística 3PL": "purple",
    Impuestos: "amber",
    Configuración: "slate",
    Configuracion: "slate",
    Otros: "slate",
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50/70 via-background to-slate-100/40 dark:from-background dark:via-background dark:to-slate-950/40 pb-16">
      {/* Decorative ambient gradient backdrop */}
      <div className="absolute top-0 inset-x-0 h-96 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(16,185,129,0.07),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(16,185,129,0.12),rgba(0,0,0,0))] pointer-events-none" />

      <main className="relative mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8 space-y-8">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 shadow-2xs">
              <Sparkles className="h-3.5 w-3.5" />
              <span>EasyERP • Panel Principal</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Dashboard Operativo
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Haz clic en cualquier bloque o tarjeta para acceder directamente al módulo deseado.
            </p>
          </div>

          {activeEntity && (
            <div className="flex items-center gap-3.5 rounded-2xl border border-border/80 bg-card/90 px-4 py-3 shadow-xs backdrop-blur-xs transition-shadow hover:shadow-md">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-bold text-sm shadow-xs">
                {activeEntity.name ? activeEntity.name.slice(0, 2).toUpperCase() : "EE"}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground truncate max-w-[200px]">
                    {activeEntity.name}
                  </span>
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500" title="Empresa Conectada" />
                </div>
                <div className="text-muted-foreground font-mono text-[11px] mt-0.5">
                  {activeEntity.code} • RUT: {activeEntity.tax_id || "Sin RUT"}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4 Top KPI Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border border-border/70 bg-card/85 shadow-xs backdrop-blur-xs hover:border-indigo-500/40 transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                Roles Asignados
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <Shield className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight text-foreground">{roles.length}</div>
              <p className="text-xs text-muted-foreground mt-1 capitalize font-medium truncate">
                {roles.join(", ") || "Sin roles asignados"}
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border/70 bg-card/85 shadow-xs backdrop-blur-xs hover:border-emerald-500/40 transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                Módulos Activos
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <LayoutGrid className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight text-foreground">{visibleModules.length}</div>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                Habilitados en {activeEntity?.name ? activeEntity.name.split(" ")[0] : "la empresa"}
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border/70 bg-card/85 shadow-xs backdrop-blur-xs hover:border-amber-500/40 transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                Moneda Base
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Coins className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight text-foreground">{activeEntity?.base_currency_code || "CLP"}</div>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                Moneda tributaria y contable
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border/70 bg-card/85 shadow-xs backdrop-blur-xs hover:border-emerald-500/40 transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                Estado del Sistema
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  Activo
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Conexión en línea con Supabase
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search & Category Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-2.5 rounded-2xl border border-border/70 bg-card/80 backdrop-blur-md shadow-2xs">
          {/* Quick Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 px-1">
            <Button
              variant={selectedCategory === "ALL" ? "default" : "ghost"}
              size="sm"
              onClick={() => setSelectedCategory("ALL")}
              className={cn(
                "h-8 rounded-xl text-xs font-medium px-3 transition-all",
                selectedCategory === "ALL"
                  ? "shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>Todos</span>
              <span className={cn(
                "ml-1.5 rounded-full px-1.5 py-0.2 text-[10px]",
                selectedCategory === "ALL" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {visibleModules.length}
              </span>
            </Button>

            {availableCategories.map((cat) => {
              const count = visibleModules.filter((m: any) => m.group_name === cat).length;
              const isSelected = selectedCategory === cat;
              return (
                <Button
                  key={cat}
                  variant={isSelected ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "h-8 rounded-xl text-xs font-medium px-3 whitespace-nowrap transition-all",
                    isSelected
                      ? "bg-secondary text-secondary-foreground font-semibold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="mr-1">{groupIcons[cat]}</span>
                  <span>{cat}</span>
                  <span className="ml-1.5 rounded-full bg-muted/80 px-1.5 py-0.2 text-[10px] text-muted-foreground">
                    {count}
                  </span>
                </Button>
              );
            })}
          </div>

          {/* Quick Search Input */}
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar módulo..."
              className="h-8 pl-8 pr-8 rounded-xl text-xs border-border/80 bg-background/80 focus-visible:ring-1"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Empty Search State */}
        {filteredModules.length === 0 && (
          <div className="text-center py-16 px-4 rounded-3xl border border-dashed border-border bg-card/50">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No se encontraron módulos</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              No hay módulos que coincidan con &ldquo;{searchQuery}&rdquo;. Intenta con otro término o limpia los filtros.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("ALL");
              }}
              className="mt-4 rounded-xl text-xs"
            >
              Restablecer filtros
            </Button>
          </div>
        )}

        {/* Secciones Temáticas de Módulos */}
        <div className="space-y-10">
          {Object.entries(groupedModules).map(([groupName, groupMods]) => {
            const themeKey = groupBadgeThemes[groupName] || "slate";
            const theme = THEMES[themeKey];

            return (
              <section key={groupName} className="space-y-4">
                {/* Header de la Categoría */}
                <div className="flex items-center justify-between pb-3 border-b border-border/60">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl shadow-2xs",
                      theme.iconBg
                    )}>
                      {groupIcons[groupName] || groupIcons["Otros"]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold tracking-tight text-foreground">{groupName}</h2>
                        <Badge variant="outline" className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", theme.pillBg)}>
                          {groupMods.length} {groupMods.length === 1 ? "módulo" : "módulos"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {groupName === "Finanzas" && "Contabilidad, bancos, activos fijos y reportes IFRS"}
                        {groupName === "Operaciones" && "Ventas, punto de venta, inventario FIFO y compras"}
                        {groupName === "Logística 3PL" && "Guías de despacho, facturación logística y portal de autoservicio"}
                        {groupName === "Impuestos" && "Formularios F29, F22, DDJJ y libros oficiales del SII"}
                        {groupName === "Configuración" && "Parámetros globales, roles y plan contable de la empresa"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Grid de Tarjetas 100% Clickeables */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {groupMods.map((module) => {
                    const config = moduleConfig[module.name] || {
                      icon: <LayoutDashboard className="h-5 w-5" />,
                      path: `/${module.name}`,
                      description: `Accede a la gestión de ${module.label.toLowerCase()}.`,
                      colorTheme: "slate",
                    };

                    const cardTheme = THEMES[config.colorTheme] || THEMES.slate;

                    return (
                      <Link
                        key={module.id || module.name}
                        to={config.path}
                        className={cn(
                          "group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card/90 p-5 shadow-xs backdrop-blur-xs transition-all duration-200",
                          "hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 active:scale-[0.99] cursor-pointer overflow-hidden",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                          cardTheme.cardHover
                        )}
                      >
                        {/* Ambient decorative top corner light */}
                        <div className="absolute -top-12 -right-12 h-24 w-24 rounded-full bg-primary/5 group-hover:bg-primary/10 blur-xl transition-all duration-500 pointer-events-none" />

                        <div>
                          {/* Card Top Row: Icon + Category Badge + Slide-up Arrow */}
                          <div className="flex items-start justify-between gap-3 mb-3.5">
                            <div className={cn(
                              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-xs transition-all duration-200 group-hover:scale-105",
                              cardTheme.iconBg
                            )}>
                              {config.icon}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                                cardTheme.pillBg
                              )}>
                                {groupName}
                              </span>
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/70 text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200 shadow-2xs">
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              </div>
                            </div>
                          </div>

                          {/* Title & Description */}
                          <div>
                            <h3 className="text-base font-bold tracking-tight text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                              {module.label}
                            </h3>
                            <p className="text-xs text-muted-foreground leading-relaxed mt-1.5 line-clamp-2">
                              {config.description}
                            </p>
                          </div>
                        </div>

                        {/* Interactive Full-Width Action Strip */}
                        <div className="mt-5 pt-3.5 border-t border-border/60 flex items-center justify-between text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                          <span className="flex items-center gap-1.5">
                            <span className={cn("h-1.5 w-1.5 rounded-full transition-colors", cardTheme.accentDot)} />
                            <span>Abrir módulo</span>
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium opacity-80 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                            Ingresar <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
