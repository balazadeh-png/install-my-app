import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { getCurrentProfile } from "@/lib/auth.functions";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEntity } from "@/context/ActiveEntityContext";
import {
  BookOpen,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  BarChart3,
  Settings,
  LayoutDashboard,
  LogOut,
  ChevronDown,
  Building2,
  Check,
  Plus,
  Factory,
  Store,
  FileSpreadsheet,
  Landmark,
  FileBadge2,
  Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const moduleNavItems = [
  { name: "accounting", label: "Contabilidad", path: "/accounting", icon: BookOpen },
  { name: "sales", label: "Ventas", path: "/sales", icon: Users },
  { name: "pos", label: "Punto de Venta (POS)", path: "/pos", icon: Store },
  { name: "purchases", label: "Compras", path: "/purchases", icon: ShoppingCart },
  { name: "inventory", label: "Inventario", path: "/inventory", icon: Package },
  { name: "dispatch", label: "Guías de Despacho (3PL)", path: "/dispatch", icon: Truck },
  { name: "production", label: "Producción", path: "/production", icon: Factory },
  { name: "assets", label: "Activos Fijos", path: "/assets", icon: Building2 },
  { name: "cash", label: "Bancos / Tesorería", path: "/cash", icon: DollarSign },
  { name: "sii-books", label: "Libros Legales SII", path: "/sii-books", icon: FileSpreadsheet },
  { name: "taxes", label: "Impuestos (F29/F22)", path: "/taxes", icon: Landmark },
  { name: "declaraciones-juradas", label: "DDJJ (SII)", path: "/declaraciones-juradas", icon: FileBadge2 },
  { name: "reports", label: "Reportes", path: "/reports", icon: BarChart3 },
  { name: "setup", label: "Configuración", path: "/setup", icon: Settings },
];

export function AppHeader() {
  const navigate = useNavigate();
  const fetchProfile = useServerFn(getCurrentProfile);
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const { activeEntity, userCompanies, setActiveEntityId } = useActiveEntity();

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
  });

  const profile = profileQuery.data;

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand & Main Nav */}
        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-foreground">EasyERP</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">ERP Financiero</span>
            </div>
          </Link>

          {/* Quick Module Switcher for Desktop */}
          <nav className="hidden md:flex items-center gap-1">
            <Button
              asChild
              variant={currentPath === "/dashboard" ? "secondary" : "ghost"}
              size="sm"
              className="text-xs font-medium"
            >
              <Link to="/dashboard">
                <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" />
                Dashboard
              </Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs font-medium">
                  Módulos <ChevronDown className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Módulos del Sistema</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {moduleNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPath === item.path;
                  return (
                    <DropdownMenuItem key={item.path} asChild className={isActive ? "bg-accent font-medium" : ""}>
                      <Link to={item.path} className="flex items-center gap-2 cursor-pointer">
                        <Icon className="h-4 w-4 text-primary" />
                        <span>{item.label}</span>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>

        {/* Right Info & Actions */}
        <div className="flex items-center gap-3">
          {/* Active Company Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={activeEntity ? "outline" : "destructive"}
                size="sm"
                className="gap-2 text-xs font-medium max-w-[200px] sm:max-w-[260px]"
              >
                <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate">
                  {activeEntity ? `${activeEntity.code} - ${activeEntity.name}` : "Seleccionar Empresa"}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="text-xs text-muted-foreground flex justify-between items-center">
                <span>Empresa Activa</span>
                <Badge variant="outline" className="text-[10px] uppercase font-mono">
                  {activeEntity?.base_currency_code || "CLP"}
                </Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {userCompanies.length === 0 ? (
                <div className="p-3 text-xs text-center text-muted-foreground">
                  <p>No tienes empresas asignadas.</p>
                  <Button asChild size="sm" variant="outline" className="mt-2 text-xs w-full">
                    <Link to="/setup">
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Crear Empresa
                    </Link>
                  </Button>
                </div>
              ) : (
                userCompanies.map((company) => {
                  const isSelected = activeEntity?.id === company.id;
                  return (
                    <DropdownMenuItem
                      key={company.id}
                      onClick={() => setActiveEntityId(company.id)}
                      className={`flex items-center justify-between cursor-pointer py-2 ${
                        isSelected ? "bg-accent font-semibold" : ""
                      }`}
                    >
                      <div className="flex flex-col gap-0.5 truncate pr-2">
                        <span className="text-xs text-foreground truncate">{company.name}</span>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                          <span>{company.code}</span>
                          <span>•</span>
                          <span>{company.tax_id || "Sin RUT"}</span>
                          <span>•</span>
                          <span className="font-semibold text-foreground/80">{company.base_currency_code || "CLP"}</span>
                        </div>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  );
                })
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/setup" className="flex items-center gap-2 cursor-pointer text-xs text-primary font-medium">
                  <Plus className="h-3.5 w-3.5" />
                  <span>Gestionar Empresas</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 text-xs">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                <span className="max-w-[100px] truncate hidden sm:inline">
                  {profile?.full_name || profile?.user_name || "Usuario"}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{profile?.full_name || profile?.user_name}</p>
                  <p className="text-xs leading-none text-muted-foreground">{profile?.email || "Sin email"}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/setup" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Configuración</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
