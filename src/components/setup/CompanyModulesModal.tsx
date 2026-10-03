import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Layers,
  BookOpen,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  Truck,
  TrendingUp,
  ShieldCheck,
  Factory,
  Store,
  FileSpreadsheet,
  Landmark,
  FileBadge2,
  BarChart3,
  Shield,
  Settings,
  Sparkles,
  Check,
  RotateCcw,
} from "lucide-react";

export interface CompanyEntityTarget {
  id: string;
  code: string;
  name: string;
  tax_id?: string | null;
  base_currency_code?: string | null;
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  accounting: <BookOpen className="h-4 w-4 text-emerald-600" />,
  cash: <DollarSign className="h-4 w-4 text-emerald-600" />,
  assets: <Building2 className="h-4 w-4 text-emerald-600" />,
  reports: <BarChart3 className="h-4 w-4 text-emerald-600" />,
  sales: <Users className="h-4 w-4 text-blue-600" />,
  pos: <Store className="h-4 w-4 text-blue-600" />,
  purchases: <ShoppingCart className="h-4 w-4 text-blue-600" />,
  suppliers: <Building2 className="h-4 w-4 text-blue-600" />,
  inventory: <Package className="h-4 w-4 text-blue-600" />,
  production: <Factory className="h-4 w-4 text-blue-600" />,
  dispatch: <Truck className="h-4 w-4 text-purple-600" />,
  "dashboard-3pl": <TrendingUp className="h-4 w-4 text-purple-600" />,
  dashboard_3pl: <TrendingUp className="h-4 w-4 text-purple-600" />,
  portal: <ShieldCheck className="h-4 w-4 text-purple-600" />,
  "sii-books": <FileSpreadsheet className="h-4 w-4 text-amber-600" />,
  sii_books: <FileSpreadsheet className="h-4 w-4 text-amber-600" />,
  taxes: <Landmark className="h-4 w-4 text-amber-600" />,
  "declaraciones-juradas": <FileBadge2 className="h-4 w-4 text-amber-600" />,
  declaraciones_juradas: <FileBadge2 className="h-4 w-4 text-amber-600" />,
  roles: <Shield className="h-4 w-4 text-indigo-600" />,
  setup: <Settings className="h-4 w-4 text-slate-600" />,
};

const MODULE_DESCRIPTIONS: Record<string, string> = {
  accounting: "Plan de cuentas, libro diario, libro mayor y asientos contables.",
  cash: "Conciliación bancaria (Excel/PDF/API), cartolas, libros de caja y tipos de cambio.",
  assets: "Depreciación contable y tributaria de bienes de uso y activo fijo.",
  reports: "Balance clasificado, estado de resultados y balances de 8 columnas.",
  sales: "Facturación electrónica, notas de crédito, cotizaciones y clientes.",
  pos: "Punto de venta mostrador con boletas y cierre de caja diario.",
  purchases: "Registro de facturas de proveedores y cuentas por pagar.",
  suppliers: "Directorio de proveedores, contratos PDF versionados y catálogo comercial de productos/servicios.",
  inventory: "Kardex FIFO de mercaderías, saldos físicos y control de bodegas.",
  production: "Fórmulas de fabricación (BOM), costeo y órdenes de producción.",
  dispatch: "Guías de despacho electrónicas y control de salidas operacionales.",
  "dashboard-3pl": "Panel BI de almacenamiento, cubicaje, facturación 3PL y predicción AI.",
  portal: "Portal multi-inquilino de autoservicio para clientes de bodegaje.",
  "sii-books": "Libros oficiales electrónicos exigidos por el SII (RCV).",
  taxes: "Formulario F29 mensual, cálculo de PPM y declaración de renta F22.",
  "declaraciones-juradas": "Declaraciones juradas anuales (DJ 1879, 1887, 1947).",
  roles: "Gestión de usuarios del sistema, credenciales y roles por empresa.",
  setup: "Parámetros globales de la empresa, series y cuentas contables.",
};

interface CompanyModulesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: CompanyEntityTarget | null;
}

export function CompanyModulesModal({ open, onOpenChange, company }: CompanyModulesModalProps) {
  const queryClient = useQueryClient();
  const [localMap, setLocalMap] = useState<Record<string, boolean>>({});

  // 1. Fetch modules for this company
  const modulesQuery = useQuery({
    queryKey: ["company_modules_config", company?.id],
    queryFn: async () => {
      if (!company?.id) return [];

      const { data, error } = await supabase.rpc("get_company_modules", {
        p_entity_id: company.id,
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data;
      }

      // Fallback
      const { data: allModules } = await supabase
        .from("modules")
        .select("name, label, group_name, group_sort_order, sort_order")
        .eq("active", true)
        .order("group_sort_order", { ascending: true })
        .order("sort_order", { ascending: true });

      const { data: compRows } = await supabase
        .from("company_modules" as any)
        .select("module_name, enabled")
        .eq("entity_id", company.id);

      const statusMap = new Map<string, boolean>();
      (compRows || []).forEach((r: any) => statusMap.set(r.module_name, Boolean(r.enabled)));

      return (allModules || []).map((m: any) => ({
        module_name: m.name,
        label: m.label,
        group_name: m.group_name || "General",
        group_sort_order: m.group_sort_order || 99,
        sort_order: m.sort_order || 99,
        enabled: m.name === "setup" ? true : statusMap.has(m.name) ? statusMap.get(m.name)! : true,
      }));
    },
    enabled: open && !!company?.id,
  });

  const modules = modulesQuery.data ?? [];

  // Sincronizar estado local al cargar
  useEffect(() => {
    if (modules.length > 0) {
      const map: Record<string, boolean> = {};
      modules.forEach((m: any) => {
        map[m.module_name] = m.module_name === "setup" ? true : Boolean(m.enabled);
      });
      setLocalMap(map);
    }
  }, [modules]);

  // Mutation para guardar
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!company?.id) throw new Error("Empresa no seleccionada");

      // Asegurar que setup siempre esté activo
      const payload = { ...localMap, setup: true };

      const { data, error } = await supabase.rpc("set_company_modules_bulk", {
        p_entity_id: company.id,
        p_modules: payload,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company_modules"] });
      queryClient.invalidateQueries({ queryKey: ["company_modules_config", company?.id] });
      queryClient.invalidateQueries({ queryKey: ["modules"] });
      toast.success(`Módulos de "${company?.name}" actualizados correctamente.`);
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al actualizar módulos");
    },
  });

  // Agrupar por categorías
  const groupedModules = modules.reduce<Record<string, any[]>>((acc, item) => {
    const grp = item.group_name || "General";
    if (!acc[grp]) acc[grp] = [];
    acc[grp].push(item);
    return acc;
  }, {});

  // Presets rápidos
  const applyPreset = (type: "ALL" | "ACCOUNTING" | "LOGISTICS_3PL" | "COMMERCIAL") => {
    const newMap: Record<string, boolean> = {};

    modules.forEach((m: any) => {
      const name = m.module_name;
      if (name === "setup") {
        newMap[name] = true;
        return;
      }

      switch (type) {
        case "ALL":
          newMap[name] = true;
          break;

        case "ACCOUNTING":
          // Solo Contabilidad, Bancos, Activos, Libros SII, Impuestos, DDJJ, Reportes, Roles, Setup
          newMap[name] = [
            "accounting",
            "cash",
            "assets",
            "reports",
            "sii-books",
            "sii_books",
            "taxes",
            "declaraciones-juradas",
            "declaraciones_juradas",
            "roles",
            "setup",
          ].includes(name);
          break;

        case "LOGISTICS_3PL":
          // Foco 3PL: Inventario, Guías 3PL, Dashboard 3PL, Portal, Facturación, Reportes, Setup
          newMap[name] = [
            "inventory",
            "dispatch",
            "dashboard-3pl",
            "dashboard_3pl",
            "portal",
            "sales",
            "reports",
            "roles",
            "setup",
          ].includes(name);
          break;

        case "COMMERCIAL":
          // Foco Comercial: Ventas, POS, Compras, Proveedores, Inventario, Reportes, Setup
          newMap[name] = [
            "sales",
            "pos",
            "purchases",
            "suppliers",
            "inventory",
            "cash",
            "reports",
            "roles",
            "setup",
          ].includes(name);
          break;
      }
    });

    setLocalMap(newMap);
  };

  const totalEnabled = Object.values(localMap).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  Configuración de Módulos Operativos
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span className="font-semibold text-foreground">{company?.name}</span>
                  <span>•</span>
                  <span className="font-mono">{company?.code}</span>
                  {company?.tax_id && (
                    <>
                      <span>•</span>
                      <span className="font-mono">{company?.tax_id}</span>
                    </>
                  )}
                </DialogDescription>
              </div>
            </div>

            <Badge variant="outline" className="text-xs font-mono py-1 px-2.5">
              {totalEnabled} de {modules.length} activos
            </Badge>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap pt-3 mt-3 border-t">
            <span className="text-[11px] font-semibold text-muted-foreground mr-1">Perfiles Rápidos:</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 text-[11px] px-2 py-0"
              onClick={() => applyPreset("ALL")}
            >
              Habilitar Todos
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 text-[11px] px-2 py-0 border-emerald-300 text-emerald-700 dark:text-emerald-400"
              onClick={() => applyPreset("ACCOUNTING")}
            >
              Asesoría Contable & Tributaria
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 text-[11px] px-2 py-0 border-purple-300 text-purple-700 dark:text-purple-400"
              onClick={() => applyPreset("LOGISTICS_3PL")}
            >
              Operador Logístico 3PL
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 text-[11px] px-2 py-0 border-blue-300 text-blue-700 dark:text-blue-400"
              onClick={() => applyPreset("COMMERCIAL")}
            >
              Comercial & POS
            </Button>
          </div>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {modulesQuery.isLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Cargando catálogo de módulos...
            </div>
          ) : (
            Object.entries(groupedModules).map(([groupTitle, groupItems]) => (
              <div key={groupTitle} className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary/80 border-b pb-1">
                  {groupTitle}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {groupItems.map((mod: any) => {
                    const isSetup = mod.module_name === "setup";
                    const isChecked = isSetup ? true : Boolean(localMap[mod.module_name]);

                    return (
                      <div
                        key={mod.module_name}
                        className={`flex items-start justify-between p-3 rounded-lg border text-xs transition-colors ${
                          isChecked
                            ? "bg-card border-border shadow-xs"
                            : "bg-muted/30 border-muted opacity-60"
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0 pr-2">
                          <div className="mt-0.5 shrink-0">
                            {MODULE_ICONS[mod.module_name] || <Layers className="h-4 w-4 text-muted-foreground" />}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-foreground flex items-center gap-1.5">
                              {mod.label}
                              {isSetup && (
                                <Badge variant="secondary" className="text-[9px] py-0 px-1 font-mono">
                                  Requerido
                                </Badge>
                              )}
                            </span>
                            <span className="text-[11px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">
                              {MODULE_DESCRIPTIONS[mod.module_name] || "Módulo integrado del ERP."}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 pt-0.5">
                          <Switch
                            checked={isChecked}
                            disabled={isSetup}
                            onCheckedChange={(val) => {
                              setLocalMap({ ...localMap, [mod.module_name]: val });
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t bg-muted/10 gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || modulesQuery.isLoading}
            className="gap-1.5"
          >
            <Check className="h-4 w-4" />
            {saveMutation.isPending ? "Guardando cambios..." : "Guardar Configuración"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
