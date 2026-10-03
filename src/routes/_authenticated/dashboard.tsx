import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getModules, getUserRoles } from "@/lib/auth.functions";
import { useServerFn } from "@tanstack/react-start";
import { useActiveEntity } from "@/context/ActiveEntityContext";
import { useCompanyModules } from "@/hooks/useCompanyModules";
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
  Building2,
  Factory,
  Store,
  FileSpreadsheet,
  Landmark,
  FileBadge2,
  Shield,
} from "lucide-react";

const moduleConfig: Record<string, { icon: React.ReactNode; path: string; description: string }> = {
  accounting: {
    icon: <BookOpen className="h-5 w-5" />,
    path: "/accounting",
    description: "Catálogo de cuentas, asientos de diario y libro mayor.",
  },
  pos: {
    icon: <Store className="h-5 w-5" />,
    path: "/pos",
    description: "Terminal de venta mostrador, boletas y arqueo de caja.",
  },
  cash: {
    icon: <DollarSign className="h-5 w-5" />,
    path: "/cash",
    description: "Tasas de cambio oficiales y libros de tesorería.",
  },
  purchases: {
    icon: <ShoppingCart className="h-5 w-5" />,
    path: "/purchases",
    description: "Facturación de compra, IVA crédito fiscal y órdenes de compra.",
  },
  suppliers: {
    icon: <Building2 className="h-5 w-5" />,
    path: "/suppliers",
    description: "Directorio de proveedores, contratos PDF versionados y catálogo comercial.",
  },
  sales: {
    icon: <Users className="h-5 w-5" />,
    path: "/sales",
    description: "Directorio de clientes, contactos y saldos.",
  },
  inventory: {
    icon: <Package className="h-5 w-5" />,
    path: "/inventory",
    description: "Catálogo de artículos, bodegas y método FIFO.",
  },
  production: {
    icon: <Factory className="h-5 w-5" />,
    path: "/production",
    description: "Fórmulas BOM, órdenes de producción y costeo real.",
  },
  assets: {
    icon: <Building2 className="h-5 w-5" />,
    path: "/assets",
    description: "Catálogo de bienes de uso, depreciación mensual y bajas.",
  },
  "sii-books": {
    icon: <FileSpreadsheet className="h-5 w-5" />,
    path: "/sii-books",
    description: "Libros Diario, Mayor, Balance 8 Columnas y RCV.",
  },
  sii_books: {
    icon: <FileSpreadsheet className="h-5 w-5" />,
    path: "/sii-books",
    description: "Libros Diario, Mayor, Balance 8 Columnas y RCV.",
  },
  taxes: {
    icon: <Landmark className="h-5 w-5" />,
    path: "/taxes",
    description: "Declaraciones F29 mensual, F22 anual y regímenes.",
  },
  "declaraciones-juradas": {
    icon: <FileBadge2 className="h-5 w-5" />,
    path: "/declaraciones-juradas",
    description: "Motor extensible de DDJJ anuales (DJ 1879, 1887, 1947).",
  },
  declaraciones_juradas: {
    icon: <FileBadge2 className="h-5 w-5" />,
    path: "/declaraciones-juradas",
    description: "Motor extensible de DDJJ anuales (DJ 1879, 1887, 1947).",
  },
  reports: {
    icon: <BarChart3 className="h-5 w-5" />,
    path: "/reports",
    description: "Balance general, estado de resultados y balanza.",
  },
  setup: {
    icon: <Settings className="h-5 w-5" />,
    path: "/setup",
    description: "Entidades, años fiscales, períodos y correlativos.",
  },
  roles: {
    icon: <Shield className="h-5 w-5" />,
    path: "/setup?tab=roles",
    description: "Crear usuarios, resetear contraseñas, roles y acceso por empresa.",
  },
};

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dashboard | EasyERP" },
      { name: "description", content: "Panel de control de EasyERP." },
      { property: "og:title", content: "Dashboard | EasyERP" },
      { property: "og:description", content: "Panel de control de EasyERP." },
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
  const visibleModules = modules.filter((mod) => isModuleEnabled(mod.name));

  const groupIcons: Record<string, React.ReactNode> = {
    Finanzas: <Landmark className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
    Operaciones: <Factory className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
    "Logística 3PL": <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
    Impuestos: <FileBadge2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
    Configuración: <Settings className="h-5 w-5 text-slate-600 dark:text-slate-400" />,
    Configuracion: <Settings className="h-5 w-5 text-slate-600 dark:text-slate-400" />,
    Otros: <LayoutDashboard className="h-5 w-5 text-muted-foreground" />,
  };

  // Agrupar módulos respetando el orden proveniente del servidor
  const groupedModules = visibleModules.reduce<Record<string, typeof modules>>((acc, mod) => {
    const grp = (mod as any).group_name || "Otros";
    if (!acc[grp]) acc[grp] = [];
    acc[grp].push(mod);
    return acc;
  }, {});

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Welcome Banner */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Bienvenido al panel financiero y administrativo. Selecciona un módulo para comenzar.
          </p>
        </div>
        {activeEntity && (
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3.5 py-2 text-xs shadow-sm">
            <Building2 className="h-4 w-4 text-primary" />
            <div>
              <div className="font-semibold text-foreground">{activeEntity.name}</div>
              <div className="text-muted-foreground font-mono text-[11px]">{activeEntity.code} • RUT: {activeEntity.tax_id || "No registrado"}</div>
            </div>
          </div>
        )}
      </div>

      {/* KPI Overview Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Roles asignados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles.length}</div>
            <p className="text-xs text-muted-foreground mt-1 capitalize font-medium">
              {roles.join(", ") || "Sin roles"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Módulos activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{visibleModules.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Habilitados en {activeEntity?.name ? activeEntity.name.split(" ")[0] : "la empresa"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Moneda base
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeEntity?.base_currency_code || "CLP"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeEntity?.name || "Empresa activa"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Estado del Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">Activo</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Conexión en línea con Supabase
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secciones Temáticas de Módulos */}
      <div className="space-y-10">
        {Object.entries(groupedModules).map(([groupName, groupMods]) => (
          <section key={groupName} className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/60 border shadow-xs">
                  {groupIcons[groupName] || groupIcons["Otros"]}
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-foreground">{groupName}</h2>
                  <p className="text-xs text-muted-foreground">
                    {groupMods.length} {groupMods.length === 1 ? "módulo operativo" : "módulos operativos"}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groupMods.map((module) => {
                const config = moduleConfig[module.name] || {
                  icon: <LayoutDashboard className="h-5 w-5" />,
                  path: `/${module.name}`,
                  description: `Accede a la gestión de ${module.label.toLowerCase()}.`,
                };

                return (
                  <Card
                    key={module.id}
                    className="group hover:border-primary/50 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                  >
                    <CardHeader className="flex flex-row items-center gap-3 pb-2">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        {config.icon}
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold">{module.label}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">{groupName}</p>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-2 flex-1 flex flex-col justify-between">
                      <p className="text-xs text-muted-foreground">
                        {config.description}
                      </p>
                      <div className="mt-4 pt-3 border-t">
                        <Button asChild variant="outline" size="sm" className="w-full justify-between group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <Link to={config.path}>
                            <span>Abrir módulo</span>
                            <ArrowRight className="h-3.5 w-3.5 ml-1 transition-transform group-hover:translate-x-1" />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
