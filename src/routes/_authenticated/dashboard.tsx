import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getModules, getUserRoles } from "@/lib/auth.functions";
import { useServerFn } from "@tanstack/react-start";
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
} from "lucide-react";

const moduleConfig: Record<string, { icon: React.ReactNode; path: string; description: string }> = {
  accounting: {
    icon: <BookOpen className="h-5 w-5" />,
    path: "/accounting",
    description: "Catálogo de cuentas, asientos de diario y libro mayor.",
  },
  cash: {
    icon: <DollarSign className="h-5 w-5" />,
    path: "/cash",
    description: "Tasas de cambio oficiales y libros de tesorería.",
  },
  purchases: {
    icon: <ShoppingCart className="h-5 w-5" />,
    path: "/purchases",
    description: "Directorio de proveedores y control de compras.",
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
};

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dashboard | Cacao Accounting" },
      { name: "description", content: "Panel de control de Cacao Accounting." },
      { property: "og:title", content: "Dashboard | Cacao Accounting" },
      { property: "og:description", content: "Panel de control de Cacao Accounting." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Dashboard() {
  const fetchModules = useServerFn(getModules);
  const fetchRoles = useServerFn(getUserRoles);

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

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Welcome Banner */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Bienvenido al panel financiero y administrativo. Selecciona un módulo para comenzar.
        </p>
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
            <div className="text-2xl font-bold">{modules.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Disponibles para tu rol
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
            <div className="text-2xl font-bold">CLP</div>
            <p className="text-xs text-muted-foreground mt-1">
              Peso Chileno ($)
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

      {/* Modules Grid */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Módulos del Sistema</h2>
        <span className="text-xs text-muted-foreground">Acceso directo</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => {
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
                  <p className="text-xs text-muted-foreground mt-0.5">Módulo operativo</p>
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
    </main>
  );
}
