import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEntity } from "@/context/ActiveEntityContext";

export interface CompanyModuleItem {
  module_name: string;
  label: string;
  group_name: string;
  group_sort_order: number;
  sort_order: number;
  enabled: boolean;
}

export function useCompanyModules(customEntityId?: string | null) {
  const { activeEntityId } = useActiveEntity();
  const entityId = customEntityId !== undefined ? customEntityId : activeEntityId;

  const query = useQuery({
    queryKey: ["company_modules", entityId],
    queryFn: async (): Promise<CompanyModuleItem[]> => {
      if (!entityId) return [];

      // 1. Intentar RPC get_company_modules
      const { data, error } = await supabase.rpc("get_company_modules", {
        p_entity_id: entityId,
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data as CompanyModuleItem[];
      }

      // 2. Fallback: consultar company_modules directamente
      const { data: directData } = await supabase
        .from("company_modules" as any)
        .select("module_name, enabled")
        .eq("entity_id", entityId);

      const statusMap = new Map<string, boolean>();
      (directData || []).forEach((row: any) => {
        statusMap.set(row.module_name, Boolean(row.enabled));
      });

      // Consultar maestro modules
      const { data: allModules } = await supabase
        .from("modules")
        .select("name, label, group_name, group_sort_order, sort_order")
        .eq("active", true);

      return (allModules || []).map((m: any) => ({
        module_name: m.name,
        label: m.label,
        group_name: m.group_name || "General",
        group_sort_order: m.group_sort_order || 99,
        sort_order: m.sort_order || 99,
        enabled: m.name === "setup" ? true : statusMap.has(m.name) ? statusMap.get(m.name)! : true,
      }));
    },
    enabled: !!entityId,
  });

  const modules = query.data ?? [];
  const enabledModules = modules.filter((m) => m.enabled).map((m) => m.module_name);

  const isModuleEnabled = (moduleName: string): boolean => {
    // Setup siempre está disponible para administradores
    if (moduleName === "setup") return true;
    if (!entityId) return true; // Si no hay empresa activa seleccionada, mostrar catálogo general

    // Manejar alias comunes con guión o guión bajo
    const normalized = moduleName.replace(/_/g, "-");
    const alternative = moduleName.replace(/-/g, "_");

    // Si aún no han cargado los módulos, default a true para no parpadear
    if (modules.length === 0 && query.isLoading) return true;

    const found = modules.find(
      (m) =>
        m.module_name === moduleName ||
        m.module_name === normalized ||
        m.module_name === alternative
    );

    // Si no se ha configurado expresamente, por defecto está activo
    if (!found) return true;
    return found.enabled;
  };

  return {
    modules,
    enabledModules,
    isModuleEnabled,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
