import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEntity } from "@/context/ActiveEntityContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings,
  Building,
  Calendar,
  Layers,
  Shield,
  Plus,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  Building2,
  PieChart,
  Network,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/setup")({
  component: SetupPage,
  head: () => ({
    meta: [
      { title: "Configuración | EasyERP" },
      { name: "description", content: "Empresa, centros de costo, sucursales, años fiscales y correlativos." },
    ],
  }),
});

function SetupPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activeEntity, activeEntityId, setActiveEntityId, refetchCompanies } = useActiveEntity();

  const [newEntityOpen, setNewEntityOpen] = useState(false);
  const [newYearOpen, setNewYearOpen] = useState(false);
  const [newSeriesOpen, setNewSeriesOpen] = useState(false);
  const [newCcOpen, setNewCcOpen] = useState(false);
  const [newBuOpen, setNewBuOpen] = useState(false);

  // Form Entity
  const [entityCode, setEntityCode] = useState("");
  const [entityName, setEntityName] = useState("");
  const [entityTaxId, setEntityTaxId] = useState("");
  const [entityCurrency, setEntityCurrency] = useState("CLP");

  // Form Fiscal Year
  const [yearName, setYearName] = useState(`Ejercicio ${new Date().getFullYear()}`);
  const [yearStart, setYearStart] = useState(`${new Date().getFullYear()}-01-01`);
  const [yearEnd, setYearEnd] = useState(`${new Date().getFullYear()}-12-31`);

  // Form Series
  const [seriesName, setSeriesName] = useState("");
  const [seriesPrefix, setSeriesPrefix] = useState("");

  // Form Cost Center
  const [ccCode, setCcCode] = useState("");
  const [ccName, setCcName] = useState("");
  const [ccParentId, setCcParentId] = useState<string>("NONE");
  const [ccIsGroup, setCcIsGroup] = useState(false);

  // Form Business Unit
  const [buCode, setBuCode] = useState("");
  const [buName, setBuName] = useState("");
  const [buParentId, setBuParentId] = useState<string>("NONE");
  const [buIsGroup, setBuIsGroup] = useState(false);

  // Queries
  const currenciesQuery = useQuery({
    queryKey: ["currencies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("currencies").select("*").order("code");
      if (error) throw error;
      return data ?? [];
    },
  });

  const entitiesQuery = useQuery({
    queryKey: ["entities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("entities").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const fiscalYearsQuery = useQuery({
    queryKey: ["fiscal_years", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("fiscal_years")
        .select("*")
        .eq("entity_id", activeEntityId)
        .order("start_date");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeEntityId,
  });

  const seriesQuery = useQuery({
    queryKey: ["naming_series", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("naming_series")
        .select("*")
        .eq("entity_id", activeEntityId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeEntityId,
  });

  const costCentersQuery = useQuery({
    queryKey: ["cost_centers", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("cost_centers")
        .select("*")
        .eq("entity_id", activeEntityId)
        .order("code");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeEntityId,
  });

  const businessUnitsQuery = useQuery({
    queryKey: ["business_units", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("business_units")
        .select("*")
        .eq("entity_id", activeEntityId)
        .order("code");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeEntityId,
  });

  const rolesQuery = useQuery({
    queryKey: ["system_roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("roles").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Mutations
  const createEntityMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("No hay usuario autenticado");
      
      const { data: newEntity, error: entityErr } = await supabase
        .from("entities")
        .insert({
          code: entityCode.trim().toUpperCase(),
          name: entityName.trim(),
          tax_id: entityTaxId.trim() || null,
          base_currency_code: entityCurrency,
          currency: entityCurrency,
          active: true,
        })
        .select()
        .single();

      if (entityErr) throw entityErr;

      const { error: cuErr } = await supabase.from("company_users" as any).insert({
        user_id: user.id,
        entity_id: newEntity.id,
        role: "admin",
        is_default: false,
      });
      if (cuErr) console.warn("Aviso en company_users:", cuErr);

      return newEntity;
    },
    onSuccess: async (newEntity) => {
      queryClient.invalidateQueries({ queryKey: ["entities"] });
      await refetchCompanies();
      if (!activeEntityId && newEntity) {
        await setActiveEntityId(newEntity.id);
      }
      toast.success("Empresa registrada y asignada correctamente");
      setNewEntityOpen(false);
      setEntityCode("");
      setEntityName("");
      setEntityTaxId("");
      setEntityCurrency("CLP");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al registrar empresa");
    },
  });

  const createYearMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Selecciona una empresa primero");
      const { error } = await supabase.from("fiscal_years").insert({
        entity_id: activeEntityId,
        name: yearName.trim(),
        start_date: yearStart,
        end_date: yearEnd,
        closed: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal_years", activeEntityId] });
      toast.success("Año fiscal aperturado exitosamente");
      setNewYearOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al crear año fiscal");
    },
  });

  const createSeriesMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Selecciona una empresa primero");
      const { error } = await supabase.from("naming_series").insert({
        entity_id: activeEntityId,
        name: seriesName.trim(),
        prefix: seriesPrefix.trim().toUpperCase(),
        next_number: 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["naming_series", activeEntityId] });
      toast.success("Serie correlativa creada");
      setNewSeriesOpen(false);
      setSeriesName("");
      setSeriesPrefix("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al crear serie");
    },
  });

  const createCcMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Selecciona una empresa primero");
      const { error } = await supabase.from("cost_centers").insert({
        entity_id: activeEntityId,
        code: ccCode.trim().toUpperCase(),
        name: ccName.trim(),
        parent_id: ccParentId === "NONE" ? null : ccParentId,
        is_group: ccIsGroup,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost_centers", activeEntityId] });
      toast.success("Centro de costo registrado");
      setNewCcOpen(false);
      setCcCode("");
      setCcName("");
      setCcParentId("NONE");
      setCcIsGroup(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al crear centro de costo");
    },
  });

  const createBuMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Selecciona una empresa primero");
      const { error } = await supabase.from("business_units").insert({
        entity_id: activeEntityId,
        code: buCode.trim().toUpperCase(),
        name: buName.trim(),
        parent_id: buParentId === "NONE" ? null : buParentId,
        is_group: buIsGroup,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business_units", activeEntityId] });
      toast.success("Unidad / Sucursal registrada");
      setNewBuOpen(false);
      setBuCode("");
      setBuName("");
      setBuParentId("NONE");
      setBuIsGroup(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al crear sucursal");
    },
  });

  const entities = entitiesQuery.data ?? [];
  const fiscalYears = fiscalYearsQuery.data ?? [];
  const series = seriesQuery.data ?? [];
  const costCenters = costCentersQuery.data ?? [];
  const businessUnits = businessUnitsQuery.data ?? [];
  const roles = rolesQuery.data ?? [];
  const currencies = currenciesQuery.data ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/dashboard">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Volver al Dashboard
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            entitiesQuery.refetch();
            fiscalYearsQuery.refetch();
            seriesQuery.refetch();
            costCentersQuery.refetch();
            businessUnitsQuery.refetch();
          }}
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Actualizar
        </Button>
      </div>

      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Settings className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Configuración del Sistema</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión de empresas, centros de costo, unidades/sucursales, ejercicios contables y series.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="entities" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto p-1">
          <TabsTrigger value="entities" className="flex items-center gap-1.5">
            <Building className="h-4 w-4" />
            <span>Empresas ({entities.length})</span>
          </TabsTrigger>
          <TabsTrigger value="cost_centers" className="flex items-center gap-1.5">
            <PieChart className="h-4 w-4" />
            <span>Centros de Costo ({costCenters.length})</span>
          </TabsTrigger>
          <TabsTrigger value="business_units" className="flex items-center gap-1.5">
            <Network className="h-4 w-4" />
            <span>Sucursales / Unidades ({businessUnits.length})</span>
          </TabsTrigger>
          <TabsTrigger value="fiscal" className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            <span>Años Fiscales ({fiscalYears.length})</span>
          </TabsTrigger>
          <TabsTrigger value="series" className="flex items-center gap-1.5">
            <Layers className="h-4 w-4" />
            <span>Series ({series.length})</span>
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-1.5">
            <Shield className="h-4 w-4" />
            <span>Roles ({roles.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab Entities */}
        <TabsContent value="entities">
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="p-6 pb-3 flex flex-row items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Empresas Registradas</h3>
                <p className="text-xs text-muted-foreground">
                  Entidades legales con aislamiento de datos, catálogo de cuentas y moneda base.
                </p>
              </div>
              <Dialog open={newEntityOpen} onOpenChange={setNewEntityOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Nueva Empresa
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Registrar Empresa / Entidad</DialogTitle>
                    <DialogDescription>
                      Ingresa los datos de la razón social y selecciona la moneda base.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-3">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="eCode" className="text-right">Código</Label>
                      <Input
                        id="eCode"
                        placeholder="ej. EMP-01"
                        value={entityCode}
                        onChange={(e) => setEntityCode(e.target.value)}
                        className="col-span-3 font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="eName" className="text-right">Razón Social</Label>
                      <Input
                        id="eName"
                        placeholder="ej. Inversiones y Servicios SpA"
                        value={entityName}
                        onChange={(e) => setEntityName(e.target.value)}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="eTax" className="text-right">RUT</Label>
                      <Input
                        id="eTax"
                        placeholder="ej. 76.123.456-K"
                        value={entityTaxId}
                        onChange={(e) => setEntityTaxId(e.target.value)}
                        className="col-span-3 font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="eCurrency" className="text-right">Moneda Base</Label>
                      <div className="col-span-3">
                        <Select value={entityCurrency} onValueChange={setEntityCurrency}>
                          <SelectTrigger id="eCurrency">
                            <SelectValue placeholder="Selecciona moneda" />
                          </SelectTrigger>
                          <SelectContent>
                            {currencies.map((c) => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.code} - {c.name} ({c.symbol || "$"})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => createEntityMutation.mutate()}
                      disabled={createEntityMutation.isPending || !entityCode || !entityName}
                    >
                      Guardar Empresa
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="p-6 pt-0">
              {entities.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  No hay entidades registradas. Crea la primera empresa para asociar catálogos.
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">Código</TableHead>
                        <TableHead>Razón Social</TableHead>
                        <TableHead>RUT</TableHead>
                        <TableHead>Moneda Base</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                        <TableHead className="text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entities.map((e) => {
                        const isCurrentActive = activeEntityId === e.id;
                        return (
                          <TableRow key={e.id} className={isCurrentActive ? "bg-accent/40" : ""}>
                            <TableCell className="font-mono font-medium text-xs">{e.code}</TableCell>
                            <TableCell className="font-semibold text-xs">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span>{e.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{e.tax_id || "-"}</TableCell>
                            <TableCell className="text-xs font-mono font-semibold">
                              {e.base_currency_code || e.currency || "CLP"}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={e.active ? "outline" : "secondary"} className="text-xs">
                                {e.active ? "Activa" : "Inactiva"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {isCurrentActive ? (
                                <Badge variant="default" className="gap-1 text-xs">
                                  <CheckCircle className="h-3 w-3" />
                                  Seleccionada
                                </Badge>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => setActiveEntityId(e.id)}
                                >
                                  Activar
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab Cost Centers */}
        <TabsContent value="cost_centers">
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="p-6 pb-3 flex flex-row items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Centros de Costo</h3>
                <p className="text-xs text-muted-foreground">
                  Dimensiones jerárquicas para imputación de gastos, costos e ingresos en {activeEntity?.name || "la empresa"}.
                </p>
              </div>
              <Dialog open={newCcOpen} onOpenChange={setNewCcOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={!activeEntityId}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Nuevo Centro de Costo
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Crear Centro de Costo</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-3">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="ccCode" className="text-right">Código</Label>
                      <Input
                        id="ccCode"
                        placeholder="ej. CC-ADM"
                        value={ccCode}
                        onChange={(e) => setCcCode(e.target.value)}
                        className="col-span-3 font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="ccName" className="text-right">Nombre</Label>
                      <Input
                        id="ccName"
                        placeholder="ej. Administración Central"
                        value={ccName}
                        onChange={(e) => setCcName(e.target.value)}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="ccParent" className="text-right">Depende de</Label>
                      <div className="col-span-3">
                        <Select value={ccParentId} onValueChange={setCcParentId}>
                          <SelectTrigger id="ccParent">
                            <SelectValue placeholder="Centro de costo padre" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NONE">Ninguno (Nivel Principal)</SelectItem>
                            {costCenters.map((cc) => (
                              <SelectItem key={cc.id} value={cc.id}>
                                {cc.code} - {cc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="ccGroup" className="text-right">¿Es Grupo?</Label>
                      <div className="col-span-3 flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="ccGroup"
                          checked={ccIsGroup}
                          onChange={(e) => setCcIsGroup(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <label htmlFor="ccGroup" className="text-xs text-muted-foreground">
                          Agrupador de sub-centros (no recibe asientos directos)
                        </label>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => createCcMutation.mutate()}
                      disabled={createCcMutation.isPending || !ccCode || !ccName}
                    >
                      Guardar Centro de Costo
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="p-6 pt-0">
              {!activeEntityId ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  Selecciona una empresa activa para gestionar sus centros de costo.
                </div>
              ) : costCenters.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  No hay centros de costo registrados para esta empresa.
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">Código</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead className="text-center">Tipo</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {costCenters.map((cc) => (
                        <TableRow key={cc.id}>
                          <TableCell className="font-mono font-medium text-xs text-primary">{cc.code}</TableCell>
                          <TableCell className="text-xs font-semibold">
                            <span className={cc.parent_id ? "pl-4 text-muted-foreground" : ""}>
                              {cc.parent_id && "&bull; "} {cc.name}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={cc.is_group ? "secondary" : "outline"} className="text-xs">
                              {cc.is_group ? "Grupo" : "Imputable"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`inline-block h-2 w-2 rounded-full ${cc.active ? "bg-emerald-500" : "bg-red-500"}`} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab Business Units */}
        <TabsContent value="business_units">
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="p-6 pb-3 flex flex-row items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Unidades de Negocio & Sucursales</h3>
                <p className="text-xs text-muted-foreground">
                  Estructura geográfica y operativa para segmentación de resultados.
                </p>
              </div>
              <Dialog open={newBuOpen} onOpenChange={setNewBuOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={!activeEntityId}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Nueva Sucursal / Unidad
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Crear Unidad / Sucursal</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-3">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="buCode" className="text-right">Código</Label>
                      <Input
                        id="buCode"
                        placeholder="ej. SUC-STGO"
                        value={buCode}
                        onChange={(e) => setBuCode(e.target.value)}
                        className="col-span-3 font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="buName" className="text-right">Nombre</Label>
                      <Input
                        id="buName"
                        placeholder="ej. Sucursal Santiago Centro"
                        value={buName}
                        onChange={(e) => setBuName(e.target.value)}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="buParent" className="text-right">Depende de</Label>
                      <div className="col-span-3">
                        <Select value={buParentId} onValueChange={setBuParentId}>
                          <SelectTrigger id="buParent">
                            <SelectValue placeholder="Unidad padre" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NONE">Ninguna (Nivel Principal)</SelectItem>
                            {businessUnits.map((bu) => (
                              <SelectItem key={bu.id} value={bu.id}>
                                {bu.code} - {bu.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="buGroup" className="text-right">¿Es Grupo?</Label>
                      <div className="col-span-3 flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="buGroup"
                          checked={buIsGroup}
                          onChange={(e) => setBuIsGroup(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <label htmlFor="buGroup" className="text-xs text-muted-foreground">
                          Agrupador de sucursales (no recibe asientos directos)
                        </label>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => createBuMutation.mutate()}
                      disabled={createBuMutation.isPending || !buCode || !buName}
                    >
                      Guardar Sucursal
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="p-6 pt-0">
              {!activeEntityId ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  Selecciona una empresa activa para gestionar sus sucursales.
                </div>
              ) : businessUnits.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  No hay unidades o sucursales registradas para esta empresa.
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">Código</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead className="text-center">Tipo</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {businessUnits.map((bu) => (
                        <TableRow key={bu.id}>
                          <TableCell className="font-mono font-medium text-xs text-primary">{bu.code}</TableCell>
                          <TableCell className="text-xs font-semibold">
                            <span className={bu.parent_id ? "pl-4 text-muted-foreground" : ""}>
                              {bu.parent_id && "&bull; "} {bu.name}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={bu.is_group ? "secondary" : "outline"} className="text-xs">
                              {bu.is_group ? "Grupo" : "Imputable"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`inline-block h-2 w-2 rounded-full ${bu.active ? "bg-emerald-500" : "bg-red-500"}`} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab Fiscal Years */}
        <TabsContent value="fiscal">
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="p-6 pb-3 flex flex-row items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Ejercicios y Años Fiscales</h3>
                <p className="text-xs text-muted-foreground">
                  Períodos anuales para cierre de balance y control contable en {activeEntity?.name || "la empresa activa"}.
                </p>
              </div>
              <Dialog open={newYearOpen} onOpenChange={setNewYearOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={!activeEntityId}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Nuevo Año Fiscal
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Abrir Nuevo Ejercicio Fiscal</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-3">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="yName" className="text-right">Nombre</Label>
                      <Input
                        id="yName"
                        value={yearName}
                        onChange={(e) => setYearName(e.target.value)}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="yStart" className="text-right">Inicio</Label>
                      <Input
                        id="yStart"
                        type="date"
                        value={yearStart}
                        onChange={(e) => setYearStart(e.target.value)}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="yEnd" className="text-right">Fin</Label>
                      <Input
                        id="yEnd"
                        type="date"
                        value={yearEnd}
                        onChange={(e) => setYearEnd(e.target.value)}
                        className="col-span-3"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => createYearMutation.mutate()}
                      disabled={createYearMutation.isPending || !yearName}
                    >
                      Guardar Año Fiscal
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="p-6 pt-0">
              {!activeEntityId ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  Selecciona una empresa activa en el encabezado superior para ver y gestionar sus años fiscales.
                </div>
              ) : fiscalYears.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  No hay años fiscales registrados para esta empresa.
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Fecha Inicio</TableHead>
                        <TableHead>Fecha Fin</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fiscalYears.map((y) => (
                        <TableRow key={y.id}>
                          <TableCell className="font-semibold text-xs">{y.name}</TableCell>
                          <TableCell className="font-mono text-xs">{y.start_date}</TableCell>
                          <TableCell className="font-mono text-xs">{y.end_date}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={y.closed ? "secondary" : "outline"} className="text-xs">
                              {y.closed ? "Cerrado" : "Abierto"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab Series */}
        <TabsContent value="series">
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="p-6 pb-3 flex flex-row items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Series de Numeración</h3>
                <p className="text-xs text-muted-foreground">
                  Correlativos automáticos para facturas, asientos y comprobantes.
                </p>
              </div>
              <Dialog open={newSeriesOpen} onOpenChange={setNewSeriesOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={!activeEntityId}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Nueva Serie
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nueva Serie de Numeración</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-3">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="sName" className="text-right">Nombre</Label>
                      <Input
                        id="sName"
                        placeholder="ej. Facturas de Venta Electrónicas"
                        value={seriesName}
                        onChange={(e) => setSeriesName(e.target.value)}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="sPrefix" className="text-right">Prefijo</Label>
                      <Input
                        id="sPrefix"
                        placeholder="ej. FVE-"
                        value={seriesPrefix}
                        onChange={(e) => setSeriesPrefix(e.target.value)}
                        className="col-span-3 font-mono"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => createSeriesMutation.mutate()}
                      disabled={createSeriesMutation.isPending || !seriesName || !seriesPrefix}
                    >
                      Guardar Serie
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="p-6 pt-0">
              {!activeEntityId ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  Selecciona una empresa activa para gestionar sus correlativos.
                </div>
              ) : series.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  No hay series de numeración configuradas para esta empresa.
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Prefijo</TableHead>
                        <TableHead className="text-right">Siguiente Número</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {series.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-semibold text-xs">{s.name}</TableCell>
                          <TableCell className="font-mono text-xs font-bold text-primary">{s.prefix}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{s.next_number}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab Roles */}
        <TabsContent value="roles">
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="p-6 pb-3">
              <h3 className="text-base font-semibold">Roles y Permisos del Sistema</h3>
              <p className="text-xs text-muted-foreground">
                Perfiles de seguridad disponibles para asignación a usuarios.
              </p>
            </div>
            <div className="p-6 pt-0">
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre del Rol</TableHead>
                      <TableHead>Descripción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roles.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs font-semibold text-primary">{r.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.description || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
