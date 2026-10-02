import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Users,
  Shield,
  UserPlus,
  KeyRound,
  Trash2,
  Building,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Search,
  RefreshCw,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  Lock,
  Layers,
  Building2,
  Check,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

export interface SystemUser {
  id: string;
  email: string;
  full_name: string;
  user_name: string;
  active: boolean;
  created_at: string;
  role: "admin" | "accountant" | "sales" | "purchasing" | "inventory" | "viewer";
  companies: {
    entity_id: string;
    entity_name: string;
    entity_code: string;
    role: string;
    is_default: boolean;
  }[];
}

const APP_ROLES = [
  { value: "admin", label: "Administrador (Acceso Total)", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200" },
  { value: "accountant", label: "Contador General", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200" },
  { value: "sales", label: "Ventas y POS", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200" },
  { value: "purchasing", label: "Compras y Adquisiciones", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200" },
  { value: "inventory", label: "Inventario y 3PL", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 border-cyan-200" },
  { value: "viewer", label: "Solo Lectura / Auditor", color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200" },
];

export function UsersAndRolesManager({ activeEntityId }: { activeEntityId?: string }) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modals state
  const [createOpen, setCreateOpen] = useState(false);
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [changeRoleOpen, setChangeRoleOpen] = useState(false);
  const [companiesOpen, setCompaniesOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);

  // Form states
  const [newEmail, setNewEmail] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newRole, setNewRole] = useState<any>("accountant");
  const [newSelectedCompanies, setNewSelectedCompanies] = useState<Record<string, { role: string; is_default: boolean }>>({});

  // Reset PW form
  const [resetPasswordVal, setResetPasswordVal] = useState("");
  const [showResetPw, setShowResetPw] = useState(false);

  // Change Role form
  const [editRoleVal, setEditRoleVal] = useState<any>("accountant");

  // Granular Companies edit form
  const [userCompaniesMap, setUserCompaniesMap] = useState<Record<string, { role: string; is_default: boolean }>>({});

  // 1. Fetch Entities (Empresas)
  const entitiesQuery = useQuery({
    queryKey: ["entities_for_users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("entities").select("id, code, name, base_currency_code, active").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const entities = entitiesQuery.data ?? [];

  // 2. Fetch System Roles definitions from public.roles
  const systemRolesQuery = useQuery({
    queryKey: ["system_roles_table"],
    queryFn: async () => {
      const { data, error } = await supabase.from("roles").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const systemRoles = systemRolesQuery.data ?? [];

  // 3. Fetch Users list via RPC (with robust fallback)
  const usersQuery = useQuery({
    queryKey: ["system_users_list"],
    queryFn: async () => {
      // Intentar primero con la RPC admin_get_users_list (Sprint 32)
      const { data: rpcData, error: rpcError } = await supabase.rpc("admin_get_users_list");

      if (!rpcError && Array.isArray(rpcData)) {
        return rpcData as SystemUser[];
      }

      // Fallback si la migración 32 aún no se ha ejecutado en Supabase:
      // Consultamos profiles con left joins manuales
      const { data: profiles, error: pError } = await supabase
        .from("profiles")
        .select("id, email, full_name, user_name, active, created_at, active_entity_id");

      if (pError) throw pError;

      const { data: userRoles } = await supabase.from("user_roles").select("user_id, role");
      const { data: compUsers } = await supabase.from("company_users" as any).select("user_id, entity_id, role, is_default");

      return (profiles ?? []).map((p) => {
        const uRole = (userRoles ?? []).find((r) => r.user_id === p.id)?.role || "accountant";
        const userComps = (compUsers ?? [])
          .filter((c: any) => c.user_id === p.id)
          .map((c: any) => {
            const ent = entities.find((e) => e.id === c.entity_id);
            return {
              entity_id: c.entity_id,
              entity_name: ent?.name || "Empresa",
              entity_code: ent?.code || "EMP",
              role: c.role || uRole,
              is_default: Boolean(c.is_default),
            };
          });

        return {
          id: p.id,
          email: p.email || "sin-correo@sistema.local",
          full_name: p.full_name || p.user_name || "Usuario",
          user_name: p.user_name || "usuario",
          active: p.active !== false,
          created_at: p.created_at || new Date().toISOString(),
          role: uRole as any,
          companies: userComps,
        };
      }) as SystemUser[];
    },
  });
  const users = usersQuery.data ?? [];

  // Helper para generar clave segura
  const generateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let pass = "EasyERP26!";
    for (let i = 0; i < 4; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  // MUTATIONS
  // 1. Crear Usuario
  const createUserMutation = useMutation({
    mutationFn: async () => {
      const email = newEmail.trim().toLowerCase();
      if (!email || !email.includes("@")) throw new Error("Ingresa un correo electrónico válido");
      if (newPassword.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres");
      if (!newFullName.trim()) throw new Error("Ingresa el nombre completo del usuario");

      const companyIds = Object.keys(newSelectedCompanies);
      const defaultCompanyId = Object.entries(newSelectedCompanies).find(([_, v]) => v.is_default)?.[0] || companyIds[0] || null;

      const { data, error } = await supabase.rpc("admin_create_user", {
        p_email: email,
        p_password: newPassword,
        p_full_name: newFullName.trim(),
        p_role: newRole,
        p_company_ids: companyIds,
        p_default_company_id: defaultCompanyId ?? undefined,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system_users_list"] });
      toast.success("Usuario creado y registrado exitosamente con sus roles y empresas.");
      setCreateOpen(false);
      setNewEmail("");
      setNewFullName("");
      setNewPassword("");
      setNewRole("accountant");
      setNewSelectedCompanies({});
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al crear usuario. Verifica que la migración SQL 32 esté ejecutada.");
    },
  });

  // 2. Resetear Clave
  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) throw new Error("No hay usuario seleccionado");
      if (resetPasswordVal.length < 6) throw new Error("La nueva contraseña debe tener mínimo 6 caracteres");

      const { data, error } = await supabase.rpc("admin_reset_user_password", {
        p_user_id: selectedUser.id,
        p_new_password: resetPasswordVal,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(`Contraseña de ${selectedUser?.email} restablecida correctamente`);
      setResetPwOpen(false);
      setResetPasswordVal("");
      setSelectedUser(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al resetear contraseña");
    },
  });

  // 3. Desactivar / Activar Usuario
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      const { data, error } = await supabase.rpc("admin_toggle_user_active", {
        p_user_id: userId,
        p_active: active,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["system_users_list"] });
      toast.success(vars.active ? "Usuario reactivado exitosamente" : "Usuario desactivado. Ya no podrá acceder al sistema.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al cambiar estado del usuario");
    },
  });

  // 4. Cambiar Rol
  const changeRoleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) throw new Error("No hay usuario seleccionado");
      const { data, error } = await supabase.rpc("admin_update_user_role", {
        p_user_id: selectedUser.id,
        p_new_role: editRoleVal,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system_users_list"] });
      toast.success("Rol del usuario actualizado correctamente");
      setChangeRoleOpen(false);
      setSelectedUser(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al actualizar rol");
    },
  });

  // 5. Guardar Empresas Granulares
  const saveCompaniesMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) throw new Error("No hay usuario seleccionado");

      const assignments = Object.entries(userCompaniesMap).map(([entity_id, val]) => ({
        entity_id,
        role: val.role || selectedUser.role || "accountant",
        is_default: Boolean(val.is_default),
      }));

      const defaultId = assignments.find((a) => a.is_default)?.entity_id || assignments[0]?.entity_id || null;

      const { data, error } = await supabase.rpc("admin_set_user_companies", {
        p_user_id: selectedUser.id,
        p_company_assignments: assignments,
        p_default_company_id: defaultId ?? undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system_users_list"] });
      toast.success("Accesos a empresas actualizados de forma granular");
      setCompaniesOpen(false);
      setSelectedUser(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al guardar empresas asignadas");
    },
  });

  // 6. Eliminar Usuario
  const deleteUserMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) throw new Error("No hay usuario seleccionado");
      const { data, error } = await supabase.rpc("admin_delete_user", {
        p_user_id: selectedUser.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system_users_list"] });
      toast.success("Usuario eliminado permanentemente del sistema");
      setDeleteOpen(false);
      setSelectedUser(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al eliminar usuario");
    },
  });

  // Open Handlers
  const openResetPasswordModal = (user: SystemUser) => {
    setSelectedUser(user);
    setResetPasswordVal(generateRandomPassword());
    setResetPwOpen(true);
  };

  const openChangeRoleModal = (user: SystemUser) => {
    setSelectedUser(user);
    setEditRoleVal(user.role);
    setChangeRoleOpen(true);
  };

  const openCompaniesModal = (user: SystemUser) => {
    setSelectedUser(user);
    const map: Record<string, { role: string; is_default: boolean }> = {};
    (user.companies || []).forEach((c) => {
      map[c.entity_id] = { role: c.role || user.role, is_default: c.is_default };
    });
    setUserCompaniesMap(map);
    setCompaniesOpen(true);
  };

  const openDeleteModal = (user: SystemUser) => {
    setSelectedUser(user);
    setDeleteOpen(true);
  };

  const openCreateModal = () => {
    setNewEmail("");
    setNewFullName("");
    setNewPassword(generateRandomPassword());
    setNewRole("accountant");
    // Pre-seleccionar la empresa activa si existe
    if (activeEntityId) {
      setNewSelectedCompanies({ [activeEntityId]: { role: "accountant", is_default: true } });
    } else if (entities.length > 0) {
      setNewSelectedCompanies({ [entities[0]!.id]: { role: "accountant", is_default: true } });
    } else {
      setNewSelectedCompanies({});
    }
    setCreateOpen(true);
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.user_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && u.active) ||
      (statusFilter === "INACTIVE" && !u.active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const activeCount = users.filter((u) => u.active).length;
  const adminCount = users.filter((u) => u.role === "admin").length;

  return (
    <div className="space-y-6">
      {/* Sub-tabs: Usuarios vs Roles del Sistema */}
      <Tabs defaultValue="users" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-3">
          <TabsList className="bg-muted">
            <TabsTrigger value="users" className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              <span>Gestión de Usuarios ({users.length})</span>
            </TabsTrigger>
            <TabsTrigger value="system_roles" className="flex items-center gap-1.5">
              <Shield className="h-4 w-4" />
              <span>Roles del Sistema ({systemRoles.length || 6})</span>
            </TabsTrigger>
          </TabsList>

          <Button onClick={openCreateModal} className="gap-2 shadow-sm">
            <UserPlus className="h-4 w-4" />
            <span>Crear Usuario Nuevo</span>
          </Button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: LISTADO Y ACCIONES DE USUARIOS */}
        {/* ========================================================================= */}
        <TabsContent value="users" className="space-y-4">
          {/* Quick Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border bg-card p-3 shadow-xs">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" /> Total Usuarios
              </div>
              <div className="text-xl font-bold mt-1">{users.length}</div>
            </div>
            <div className="rounded-lg border bg-card p-3 shadow-xs">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-emerald-600" /> Usuarios Activos
              </div>
              <div className="text-xl font-bold text-emerald-600 mt-1">{activeCount}</div>
            </div>
            <div className="rounded-lg border bg-card p-3 shadow-xs">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <UserX className="h-3.5 w-3.5 text-muted-foreground" /> Inactivos
              </div>
              <div className="text-xl font-bold text-muted-foreground mt-1">{users.length - activeCount}</div>
            </div>
            <div className="rounded-lg border bg-card p-3 shadow-xs">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-purple-600" /> Administradores
              </div>
              <div className="text-xl font-bold text-purple-600 mt-1">{adminCount}</div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por correo, nombre o usuario..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px] text-xs">
                  <SelectValue placeholder="Filtrar por Rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los roles</SelectItem>
                  {APP_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] text-xs">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los estados</SelectItem>
                  <SelectItem value="ACTIVE">Solo Activos</SelectItem>
                  <SelectItem value="INACTIVE">Solo Inactivos</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={() => usersQuery.refetch()}
                disabled={usersQuery.isRefetching}
                title="Actualizar lista"
              >
                <RefreshCw className={`h-4 w-4 ${usersQuery.isRefetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Users Table */}
          <div className="rounded-lg border bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider border-b">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Usuario / Nombre</th>
                    <th className="px-4 py-3 font-semibold">Rol Global</th>
                    <th className="px-4 py-3 font-semibold">Empresas Autorizadas</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold">Registrado</th>
                    <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {usersQuery.isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-muted-foreground">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                        Cargando catálogo de usuarios y credenciales...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="font-medium">No se encontraron usuarios</p>
                        <p className="text-[11px] mt-0.5">Crea uno nuevo con el botón superior para habilitar accesos.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const roleConfig = APP_ROLES.find((r) => r.value === u.role) || {
                        label: u.role,
                        color: "bg-gray-100 text-gray-800",
                      };

                      return (
                        <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                          {/* Usuario / Email */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                                {u.full_name?.charAt(0)?.toUpperCase() || u.email.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-foreground truncate max-w-[200px]">
                                  {u.full_name}
                                </span>
                                <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[200px]">
                                  {u.email}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Rol Global */}
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={`text-[10px] font-semibold ${roleConfig.color}`}>
                              {roleConfig.label}
                            </Badge>
                          </td>

                          {/* Empresas Granulares */}
                          <td className="px-4 py-3">
                            {u.companies && u.companies.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-[260px]">
                                {u.companies.map((c) => (
                                  <Badge
                                    key={c.entity_id}
                                    variant="secondary"
                                    className="text-[10px] font-mono py-0 px-1.5 flex items-center gap-1"
                                    title={`${c.entity_name} (${c.role})${c.is_default ? " - Principal" : ""}`}
                                  >
                                    <Building2 className="h-2.5 w-2.5 text-primary" />
                                    <span>{c.entity_code || c.entity_name}</span>
                                    {c.is_default && <span className="text-[9px] text-amber-500 font-bold">★</span>}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">Sin empresas asignadas</span>
                            )}
                          </td>

                          {/* Estado Activo/Inactivo */}
                          <td className="px-4 py-3">
                            {u.active ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Activo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-500 dark:text-rose-400 font-medium text-[11px]">
                                <XCircle className="h-3.5 w-3.5" />
                                Inactivo
                              </span>
                            )}
                          </td>

                          {/* Fecha Registro */}
                          <td className="px-4 py-3 text-muted-foreground text-[11px] font-mono whitespace-nowrap">
                            {u.created_at ? new Date(u.created_at).toLocaleDateString("es-CL") : "-"}
                          </td>

                          {/* Menú de Acciones */}
                          <td className="px-4 py-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuLabel className="text-xs">Acciones de Usuario</DropdownMenuLabel>
                                <DropdownMenuSeparator />

                                <DropdownMenuItem onClick={() => openChangeRoleModal(u)} className="cursor-pointer text-xs">
                                  <Shield className="mr-2 h-3.5 w-3.5 text-primary" />
                                  <span>Cambiar Rol ({u.role})</span>
                                </DropdownMenuItem>

                                <DropdownMenuItem onClick={() => openCompaniesModal(u)} className="cursor-pointer text-xs">
                                  <Building className="mr-2 h-3.5 w-3.5 text-blue-600" />
                                  <span>Asignar Empresas Granular</span>
                                </DropdownMenuItem>

                                <DropdownMenuItem onClick={() => openResetPasswordModal(u)} className="cursor-pointer text-xs">
                                  <KeyRound className="mr-2 h-3.5 w-3.5 text-amber-600" />
                                  <span>Resetear Contraseña</span>
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />

                                <DropdownMenuItem
                                  onClick={() => toggleActiveMutation.mutate({ userId: u.id, active: !u.active })}
                                  className="cursor-pointer text-xs"
                                >
                                  {u.active ? (
                                    <>
                                      <UserX className="mr-2 h-3.5 w-3.5 text-amber-500" />
                                      <span>Desactivar Usuario</span>
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="mr-2 h-3.5 w-3.5 text-emerald-600" />
                                      <span>Activar Usuario</span>
                                    </>
                                  )}
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => openDeleteModal(u)}
                                  className="cursor-pointer text-xs text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                                  <span>Eliminar Usuario</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 2: MATRIZ DE ROLES Y PERMISOS DEL SISTEMA */}
        {/* ========================================================================= */}
        <TabsContent value="system_roles" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {APP_ROLES.map((role) => {
              const matchedSeed = systemRoles.find((r) => r.name.toLowerCase() === role.value || r.name.toLowerCase().startsWith(role.value));
              return (
                <div key={role.value} className="rounded-lg border bg-card p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="outline" className={`text-xs font-semibold ${role.color}`}>
                        {role.label}
                      </Badge>
                      <Shield className="h-4 w-4 text-muted-foreground opacity-50" />
                    </div>

                    <p className="text-xs text-muted-foreground mb-4">
                      {matchedSeed?.note ||
                        (role.value === "admin"
                          ? "Control absoluto sobre configuración, empresas, períodos fiscales, usuarios y facturación."
                          : role.value === "accountant"
                          ? "Gestión de libro mayor, balances, asientos contables, cierre mensual y declaraciones tributarias."
                          : role.value === "sales"
                          ? "Emisión de facturas y boletas, terminal de punto de venta (POS) y catálogo de clientes."
                          : role.value === "purchasing"
                          ? "Recepción de facturas de compras, gestión de proveedores y órdenes de compra."
                          : role.value === "inventory"
                          ? "Control de existencias FIFO, movimientos kardex, bodegas y guías de despacho 3PL."
                          : "Visualización de reportes, estados financieros y dashboards sin permisos de modificación.")}
                    </p>

                    <div className="space-y-1.5 border-t pt-3">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                        Capacidades clave
                      </span>
                      <ul className="text-xs space-y-1 text-foreground/80">
                        {role.value === "admin" && (
                          <>
                            <li className="flex items-center gap-1.5">
                              <Check className="h-3 w-3 text-emerald-500" /> Multiempresa completa y RLS
                            </li>
                            <li className="flex items-center gap-1.5">
                              <Check className="h-3 w-3 text-emerald-500" /> Crear, resetear y gestionar usuarios
                            </li>
                            <li className="flex items-center gap-1.5">
                              <Check className="h-3 w-3 text-emerald-500" /> Cierre de períodos y revalorización
                            </li>
                          </>
                        )}
                        {role.value === "accountant" && (
                          <>
                            <li className="flex items-center gap-1.5">
                              <Check className="h-3 w-3 text-emerald-500" /> Asientos de diario y partida doble
                            </li>
                            <li className="flex items-center gap-1.5">
                              <Check className="h-3 w-3 text-emerald-500" /> Libros oficiales SII e Impuestos F29
                            </li>
                            <li className="flex items-center gap-1.5">
                              <Check className="h-3 w-3 text-emerald-500" /> Balances clasificados y 8 columnas
                            </li>
                          </>
                        )}
                        {role.value === "sales" && (
                          <>
                            <li className="flex items-center gap-1.5">
                              <Check className="h-3 w-3 text-emerald-500" /> Facturación electrónica de venta
                            </li>
                            <li className="flex items-center gap-1.5">
                              <Check className="h-3 w-3 text-emerald-500" /> Punto de venta (POS) y arqueo de caja
                            </li>
                          </>
                        )}
                        {role.value === "inventory" && (
                          <>
                            <li className="flex items-center gap-1.5">
                              <Check className="h-3 w-3 text-emerald-500" /> Guías de despacho y transferencias
                            </li>
                            <li className="flex items-center gap-1.5">
                              <Check className="h-3 w-3 text-emerald-500" /> Valorización de stock FIFO y 3PL
                            </li>
                          </>
                        )}
                        {role.value === "purchasing" && (
                          <>
                            <li className="flex items-center gap-1.5">
                              <Check className="h-3 w-3 text-emerald-500" /> Registro de facturas de proveedores
                            </li>
                            <li className="flex items-center gap-1.5">
                              <Check className="h-3 w-3 text-emerald-500" /> Libro de compras y crédito fiscal
                            </li>
                          </>
                        )}
                        {role.value === "viewer" && (
                          <>
                            <li className="flex items-center gap-1.5">
                              <Check className="h-3 w-3 text-emerald-500" /> Tableros de control y analítica
                            </li>
                            <li className="flex items-center gap-1.5">
                              <Check className="h-3 w-3 text-emerald-500" /> Exportación de estados financieros
                            </li>
                          </>
                        )}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t text-[11px] text-muted-foreground flex justify-between items-center font-mono">
                    <span>Usuarios asignados:</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {users.filter((u) => u.role === role.value).length}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* ========================================================================= */}
      {/* DIALOG 1: CREAR NUEVO USUARIO */}
      {/* ========================================================================= */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              <span>Crear Nuevo Usuario del Sistema</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Registra un usuario nuevo en Supabase Auth, define sus roles y asigna acceso a empresas de forma granular.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Correo */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Correo Electrónico (Login) *</Label>
              <Input
                type="email"
                placeholder="ejemplo@empresa.cl"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            {/* Nombre Completo */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nombre Completo *</Label>
              <Input
                type="text"
                placeholder="Juan Pérez González"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                className="text-xs"
              />
            </div>

            {/* Contraseña Inicial */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Contraseña Inicial *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setNewPassword(generateRandomPassword())}
                  className="h-6 text-[10px] text-primary"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  Generar Segura
                </Button>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="text-xs font-mono pr-9"
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Rol Principal */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Rol Global del Sistema *</Label>
              <Select value={newRole} onValueChange={(val: any) => setNewRole(val)}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APP_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Asignación Granular a Empresas */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  <span>Acceso Granular a Empresas</span>
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  {Object.keys(newSelectedCompanies).length} seleccionada(s)
                </span>
              </div>

              <div className="rounded-lg border bg-muted/20 p-2 space-y-2 max-h-48 overflow-y-auto">
                {entities.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">No hay empresas registradas aún.</p>
                ) : (
                  entities.map((ent) => {
                    const isChecked = Boolean(newSelectedCompanies[ent.id]);
                    const currentCompanySetting = newSelectedCompanies[ent.id] || {
                      role: newRole,
                      is_default: false,
                    };

                    return (
                      <div
                        key={ent.id}
                        className={`flex items-center justify-between p-2 rounded-md border text-xs transition-colors ${
                          isChecked ? "bg-card border-primary/40 shadow-xs" : "bg-card/40 border-border"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              const updated = { ...newSelectedCompanies };
                              if (checked) {
                                const hasDefault = Object.values(updated).some((v) => v.is_default);
                                updated[ent.id] = { role: newRole, is_default: !hasDefault };
                              } else {
                                delete updated[ent.id];
                              }
                              setNewSelectedCompanies(updated);
                            }}
                          />
                          <div>
                            <span className="font-semibold text-foreground">{ent.name}</span>
                            <span className="text-[10px] text-muted-foreground font-mono ml-1.5">({ent.code})</span>
                          </div>
                        </div>

                        {isChecked && (
                          <div className="flex items-center gap-2">
                            <Select
                              value={currentCompanySetting.role}
                              onValueChange={(r) => {
                                setNewSelectedCompanies({
                                  ...newSelectedCompanies,
                                  [ent.id]: { ...currentCompanySetting, role: r },
                                });
                              }}
                            >
                              <SelectTrigger className="h-7 text-[11px] w-[130px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {APP_ROLES.map((role) => (
                                  <SelectItem key={role.value} value={role.value}>
                                    {role.label.split(" (")[0]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <button
                              type="button"
                              onClick={() => {
                                const updated: Record<string, { role: string; is_default: boolean }> = {};
                                Object.entries(newSelectedCompanies).forEach(([id, val]) => {
                                  updated[id] = { ...val, is_default: id === ent.id };
                                });
                                setNewSelectedCompanies(updated);
                              }}
                              className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                                currentCompanySetting.is_default
                                  ? "bg-amber-100 text-amber-800 border-amber-300 font-bold dark:bg-amber-950 dark:text-amber-300"
                                  : "text-muted-foreground hover:bg-muted"
                              }`}
                              title="Marcar como empresa predeterminada al iniciar sesión"
                            >
                              {currentCompanySetting.is_default ? "★ Principal" : "Hacer Principal"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => createUserMutation.mutate()} disabled={createUserMutation.isPending}>
              {createUserMutation.isPending ? "Creando usuario..." : "Registrar Usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DIALOG 2: RESETEAR CONTRASEÑA */}
      {/* ========================================================================= */}
      <Dialog open={resetPwOpen} onOpenChange={setResetPwOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-600" />
              <span>Resetear Contraseña de Usuario</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Establece una nueva clave para el usuario{" "}
              <strong className="text-foreground">{selectedUser?.email}</strong>. El cambio tendrá efecto inmediato.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Nueva Contraseña *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setResetPasswordVal(generateRandomPassword())}
                  className="h-6 text-[10px] text-primary"
                >
                  <Sparkles className="h-3 w-3 mr-1" /> Generar Segura
                </Button>
              </div>
              <div className="relative">
                <Input
                  type={showResetPw ? "text" : "password"}
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                  className="text-xs font-mono pr-9"
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPw(!showResetPw)}
                  className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
                >
                  {showResetPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPwOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => resetPasswordMutation.mutate()} disabled={resetPasswordMutation.isPending}>
              {resetPasswordMutation.isPending ? "Guardando..." : "Guardar Contraseña"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DIALOG 3: CAMBIAR ROL */}
      {/* ========================================================================= */}
      <Dialog open={changeRoleOpen} onOpenChange={setChangeRoleOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span>Cambiar Rol de Usuario</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Modifica el rol principal para <strong className="text-foreground">{selectedUser?.email}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Seleccionar Nuevo Rol</Label>
              <Select value={editRoleVal} onValueChange={(val: any) => setEditRoleVal(val)}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APP_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeRoleOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => changeRoleMutation.mutate()} disabled={changeRoleMutation.isPending}>
              {changeRoleMutation.isPending ? "Actualizando..." : "Actualizar Rol"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DIALOG 4: ASIGNACIÓN GRANULAR DE EMPRESAS */}
      {/* ========================================================================= */}
      <Dialog open={companiesOpen} onOpenChange={setCompaniesOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-blue-600" />
              <span>Acceso Granular por Empresa</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configura a qué empresas de EasyERP tiene acceso{" "}
              <strong className="text-foreground">{selectedUser?.email}</strong> y con qué rol específico en cada una.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="rounded-lg border bg-muted/20 p-2 space-y-2 max-h-64 overflow-y-auto">
              {entities.map((ent) => {
                const isChecked = Boolean(userCompaniesMap[ent.id]);
                const setting = userCompaniesMap[ent.id] || {
                  role: selectedUser?.role || "accountant",
                  is_default: false,
                };

                return (
                  <div
                    key={ent.id}
                    className={`flex items-center justify-between p-2.5 rounded-md border text-xs transition-colors ${
                      isChecked ? "bg-card border-primary/40 shadow-xs" : "bg-card/40 border-border"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          const updated = { ...userCompaniesMap };
                          if (checked) {
                            const hasDefault = Object.values(updated).some((v) => v.is_default);
                            updated[ent.id] = {
                              role: selectedUser?.role || "accountant",
                              is_default: !hasDefault,
                            };
                          } else {
                            delete updated[ent.id];
                          }
                          setUserCompaniesMap(updated);
                        }}
                      />
                      <div>
                        <div className="font-semibold text-foreground">{ent.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          Código: {ent.code} • Moneda: {ent.base_currency_code || "CLP"}
                        </div>
                      </div>
                    </div>

                    {isChecked && (
                      <div className="flex items-center gap-2">
                        <Select
                          value={setting.role}
                          onValueChange={(r) => {
                            setUserCompaniesMap({
                              ...userCompaniesMap,
                              [ent.id]: { ...setting, role: r },
                            });
                          }}
                        >
                          <SelectTrigger className="h-7 text-[11px] w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {APP_ROLES.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label.split(" (")[0]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <button
                          type="button"
                          onClick={() => {
                            const updated: Record<string, { role: string; is_default: boolean }> = {};
                            Object.entries(userCompaniesMap).forEach(([id, val]) => {
                              updated[id] = { ...val, is_default: id === ent.id };
                            });
                            setUserCompaniesMap(updated);
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                            setting.is_default
                              ? "bg-amber-100 text-amber-800 border-amber-300 font-bold dark:bg-amber-950 dark:text-amber-300"
                              : "text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {setting.is_default ? "★ Principal" : "Hacer Principal"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCompaniesOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => saveCompaniesMutation.mutate()} disabled={saveCompaniesMutation.isPending}>
              {saveCompaniesMutation.isPending ? "Guardando..." : "Guardar Asignaciones"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DIALOG 5: CONFIRMAR ELIMINACIÓN */}
      {/* ========================================================================= */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              <span>¿Eliminar Usuario Definitivamente?</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Esta acción no se puede deshacer. Se eliminarán los accesos y credenciales de{" "}
              <strong className="text-foreground">{selectedUser?.email}</strong>.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteUserMutation.mutate()}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? "Eliminando..." : "Eliminar Definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
