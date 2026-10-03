import { createFileRoute, Link, Navigate, Outlet } from "@tanstack/react-router";
import { useEffect, useState, createContext, useContext } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Package, LogOut, Building2, ShieldAlert, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface PortalParty {
  id: string;
  name: string;
  tax_id: string | null;
  entity_id: string;
  classification?: string | null;
  requires_contract?: boolean | null;
  entities?: {
    business_name: string;
    tax_id: string | null;
  } | null;
}

export interface PortalContextType {
  activeParty: PortalParty | null;
  availableParties: PortalParty[];
  setActivePartyId: (id: string) => void;
}

export const PortalContext = createContext<PortalContextType>({
  activeParty: null,
  availableParties: [],
  setActivePartyId: () => {},
});

export const usePortal = () => useContext(PortalContext);

export const Route = createFileRoute("/_portal")({
  component: PortalLayout,
});

function PortalLayout() {
  const { user, isAuthenticated, loading} = useAuth();
  const signOut = () => supabase.auth.signOut();
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");

  const portalAccessQ = useQuery({
    queryKey: ["portal_parties", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("party_portal_users")
        .select(`
          id,
          party_id,
          parties(
            id,
            name,
            tax_id,
            entity_id,
            classification,
            requires_contract,
            entities(business_name, tax_id)
          )
        `)
        .eq("user_id", user!.id);

      if (error) {
        console.error("Error loading portal access:", error);
        return [];
      }

      return (data ?? [])
        .map((row: any) => row.parties)
        .filter(Boolean) as PortalParty[];
    },
  });

  const availableParties = portalAccessQ.data ?? [];

  useEffect(() => {
    if (availableParties.length > 0 && !selectedPartyId) {
      setSelectedPartyId(availableParties[0]!.id);
    }
  }, [availableParties, selectedPartyId]);

  if (loading || portalAccessQ.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Accediendo al Portal...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" />;
  }

  // Si el usuario autenticado no tiene asignado ningún cliente o proveedor
  if (availableParties.length === 0) {
    return (
      <div className="min-h-screen bg-muted/20 flex flex-col justify-center items-center p-6">
        <div className="max-w-md w-full bg-background border rounded-xl p-8 shadow-sm text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold">Portal Externo EasyERP</h2>
          <p className="text-sm text-muted-foreground">
            Tu cuenta de usuario (<strong>{user?.email}</strong>) no tiene acceso asignado a ningún cliente o proveedor registrado.
          </p>
          <p className="text-xs text-muted-foreground bg-muted p-3 rounded-lg text-left">
            Si eres cliente de bodegaje/transporte o proveedor de bienes y servicios, contacta a tu contraparte para que vincule tu correo a tu ficha de empresa.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar sesión
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/auth">Cambiar de cuenta</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const activeParty = availableParties.find((p) => p.id === selectedPartyId) || availableParties[0];
  const isSupplier = activeParty?.classification === "supplier";

  return (
    <PortalContext.Provider
      value={{
        activeParty: activeParty ?? null,
        availableParties,
        setActivePartyId: setSelectedPartyId,
      }}
    >
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header exclusivo del Portal */}
        <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-md px-4 sm:px-6 h-16 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-4">
            <Link to="/portal" className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <span className="font-bold text-sm tracking-tight block">
                  {isSupplier ? "Portal de Proveedores" : "Portal Cliente 3PL"}
                </span>
                <span className="text-[10px] text-muted-foreground block -mt-1">
                  {isSupplier ? "Comprador: " : "Operador: "}
                  {activeParty?.entities?.business_name || (isSupplier ? "EasyERP Compras" : "Servicio Logístico 3PL")}
                </span>
              </div>
            </Link>

            {/* Selector si tiene acceso a más de una empresa */}
            {availableParties.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs max-w-[200px] truncate">
                    <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">{activeParty?.name}</span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 text-xs">
                  <DropdownMenuLabel>Tus Cuentas Asociadas</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {availableParties.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => setSelectedPartyId(p.id)}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <span className="font-medium truncate">{p.name}</span>
                      {p.id === activeParty?.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {availableParties.length === 1 && (
              <Badge variant="secondary" className="text-[11px] gap-1 hidden sm:inline-flex">
                <Building2 className="h-3 w-3" />
                {activeParty?.name} {activeParty?.tax_id ? `(${activeParty.tax_id})` : ""}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <span className="text-xs font-medium block">{user?.email}</span>
              <span className="text-[10px] text-muted-foreground font-medium block truncate max-w-[180px]">
                {activeParty?.name || (isSupplier ? "Proveedor" : "Cliente 3PL")}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => signOut()}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </Button>
          </div>
        </header>

        {/* Contenido principal */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </PortalContext.Provider>
  );
}
