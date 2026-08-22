import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, BarChart3, Users, Shield } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Cacao Accounting" },
      { name: "description", content: "Sistema contable y administrativo para empresas." },
      { property: "og:title", content: "Cacao Accounting" },
      { property: "og:description", content: "Sistema contable y administrativo para empresas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Index() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  if (!loading && isAuthenticated) {
    navigate({ to: "/dashboard" });
    return null;
  }

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
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost">
              <Link to="/auth">Iniciar sesión</Link>
            </Button>
            <Button asChild>
              <Link to="/auth">Crear cuenta</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Control total de tu empresa
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Contabilidad, compras, ventas, inventario y bancos en un solo lugar.
            Diseñado para empresas nicaragüenses.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Button asChild size="lg">
              <Link to="/auth">Comenzar gratis</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/auth">Iniciar sesión</Link>
            </Button>
          </div>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <BarChart3 className="h-8 w-8 text-primary" />
              <CardTitle className="mt-2 text-lg">Contabilidad</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Libro mayor, asientos contables, estados financieros y cierre de períodos.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <Users className="h-8 w-8 text-primary" />
              <CardTitle className="mt-2 text-lg">Clientes y proveedores</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Directorio de terceros, contactos, direcciones y seguimiento de saldos.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <BookOpen className="h-8 w-8 text-primary" />
              <CardTitle className="mt-2 text-lg">Inventario</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Productos, bodegas, existencias y valoración FIFO para tu operación.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <Shield className="h-8 w-8 text-primary" />
              <CardTitle className="mt-2 text-lg">Roles y permisos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Controla quién puede acceder, crear, editar o aprobar en cada módulo.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
