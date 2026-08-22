import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentProfile, getModules, getUserRoles } from "@/lib/auth.functions";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Package,
  ShoppingCart,
  DollarSign,
  Settings,
  LogOut,
} from "lucide-react";

const moduleIcons: Record<string, React.ReactNode> = {
  accounting: <BookOpen className="h-5 w-5" />,
  cash: <DollarSign className="h-5 w-5" />,
  purchases: <ShoppingCart className="h-5 w-5" />,
  sales: <Users className="h-5 w-5" />,
  inventory: <Package className="h-5 w-5" />,
  reports: <LayoutDashboard className="h-5 w-5" />,
  setup: <Settings className="h-5 w-5" />,
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
  const fetchProfile = useServerFn(getCurrentProfile);
  const fetchModules = useServerFn(getModules);
  const fetchRoles = useServerFn(getUserRoles);
  const navigate = useNavigate();

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
  });

  const modulesQuery = useQuery({
    queryKey: ["modules"],
    queryFn: fetchModules,
  });

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: fetchRoles,
  });

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  const profile = profileQuery.data;
  const modules = modulesQuery.data ?? [];
  const roles = rolesQuery.data ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BookOpen className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Cacao Accounting</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {profile?.full_name || profile?.user_name || "Usuario"}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Bienvenido de nuevo. Selecciona un módulo para comenzar.
          </p>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Roles asignados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{roles.length}</div>
              <p className="text-xs text-muted-foreground">
                {roles.join(", ") || "Sin roles"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Módulos activos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{modules.length}</div>
              <p className="text-xs text-muted-foreground">
                Disponibles para tu rol
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Moneda base
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">NIO</div>
              <p className="text-xs text-muted-foreground">
                Córdoba Nicaragüense
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Estado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">Activo</div>
              <p className="text-xs text-muted-foreground">
                Sistema operativo
              </p>
            </CardContent>
          </Card>
        </div>

        <h2 className="mb-4 text-xl font-semibold">Módulos</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <Card key={module.id} className="hover:bg-accent/50 transition-colors">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {moduleIcons[module.name] ?? <LayoutDashboard className="h-5 w-5" />}
                </div>
                <CardTitle className="text-lg">{module.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Accede al módulo de {module.label.toLowerCase()}.
                </p>
                <Button asChild variant="ghost" className="mt-3 w-full justify-start px-0">
                  <Link to="/dashboard">Abrir módulo</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
