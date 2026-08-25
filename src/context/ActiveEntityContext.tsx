import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface CompanyEntity {
  id: string;
  code: string;
  name: string;
  tax_id: string | null;
  base_currency_code: string | null;
  currency?: string | null;
  tax_regime?: string | null;
  ppm_rate?: number | null;
  active: boolean | null;
  userRole?: string;
}

interface ActiveEntityContextType {
  activeEntity: CompanyEntity | null;
  activeEntityId: string | null;
  userCompanies: CompanyEntity[];
  isLoading: boolean;
  setActiveEntityId: (entityId: string) => Promise<void>;
  refetchCompanies: () => Promise<void>;
}

const ActiveEntityContext = createContext<ActiveEntityContextType | undefined>(undefined);

export function ActiveEntityProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [activeEntity, setActiveEntity] = useState<CompanyEntity | null>(null);
  const [activeEntityId, setActiveEntityIdState] = useState<string | null>(null);
  const [userCompanies, setUserCompanies] = useState<CompanyEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserCompaniesAndActive = useCallback(async () => {
    if (!user || !isAuthenticated) {
      setActiveEntity(null);
      setActiveEntityIdState(null);
      setUserCompanies([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Obtener perfil para active_entity_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("active_entity_id")
        .eq("id", user.id)
        .single();

      // 2. Obtener empresas asignadas en company_users
      const { data: companyUsers, error: cuError } = await supabase
        .from("company_users" as any)
        .select("role, is_default, entities(id, code, name, tax_id, base_currency_code, currency, active)")
        .eq("user_id", user.id);

      let companiesList: CompanyEntity[] = [];

      if (!cuError && companyUsers && companyUsers.length > 0) {
        companiesList = companyUsers
          .filter((cu: any) => cu.entities)
          .map((cu: any) => ({
            id: cu.entities.id,
            code: cu.entities.code,
            name: cu.entities.name,
            tax_id: cu.entities.tax_id,
            base_currency_code: cu.entities.base_currency_code || cu.entities.currency || "CLP",
            active: cu.entities.active,
            userRole: cu.role,
          }));
      }

      // Si es admin global o no encontró vínculos, intentar consultar entities directamente
      if (companiesList.length === 0) {
        const { data: allEntities } = await supabase
          .from("entities")
          .select("id, code, name, tax_id, base_currency_code, currency, active");

        if (allEntities && allEntities.length > 0) {
          companiesList = allEntities.map((e: any) => ({
            id: e.id,
            code: e.code,
            name: e.name,
            tax_id: e.tax_id,
            base_currency_code: e.base_currency_code || e.currency || "CLP",
            active: e.active,
            userRole: "admin",
          }));
        }
      }

      setUserCompanies(companiesList);

      // Determinar empresa activa
      let currentActiveId = profile?.active_entity_id;
      let matchedEntity = companiesList.find((c) => c.id === currentActiveId);

      if (!matchedEntity && companiesList.length > 0) {
        matchedEntity = companiesList[0];
        currentActiveId = matchedEntity.id;

        // Auto-actualizar active_entity_id en el perfil si no tenía o no coincidía
        await supabase
          .from("profiles")
          .update({ active_entity_id: currentActiveId })
          .eq("id", user.id);
      }

      setActiveEntity(matchedEntity || null);
      setActiveEntityIdState(currentActiveId || null);
    } catch (err) {
      console.error("Error cargando empresas del usuario:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user, isAuthenticated]);

  useEffect(() => {
    fetchUserCompaniesAndActive();
  }, [fetchUserCompaniesAndActive]);

  const setActiveEntityId = async (entityId: string) => {
    if (!user) return;

    const matched = userCompanies.find((c) => c.id === entityId);
    if (!matched) {
      toast.error("No tienes acceso a esta empresa.");
      return;
    }

    try {
      setActiveEntity(matched);
      setActiveEntityIdState(entityId);

      await supabase
        .from("profiles")
        .update({ active_entity_id: entityId })
        .eq("id", user.id);

      // Invalidar todas las queries de negocio en TanStack Query
      await queryClient.invalidateQueries();
      toast.success(`Empresa activa: ${matched.name}`);
    } catch (err: any) {
      toast.error(err.message || "Error al cambiar de empresa");
    }
  };

  return (
    <ActiveEntityContext.Provider
      value={{
        activeEntity,
        activeEntityId,
        userCompanies,
        isLoading,
        setActiveEntityId,
        refetchCompanies: fetchUserCompaniesAndActive,
      }}
    >
      {children}
    </ActiveEntityContext.Provider>
  );
}

export function useActiveEntity() {
  const context = useContext(ActiveEntityContext);
  if (!context) {
    throw new Error("useActiveEntity must be used within an ActiveEntityProvider");
  }
  return context;
}
