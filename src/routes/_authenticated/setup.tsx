import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEntity } from "@/context/ActiveEntityContext";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/button";
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
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/setup")({
  component: SetupPage,
  head: () => ({
    meta: [
      { title: "Configuración | EasyERP" },
      { name: "description", content: "Empresa, años fiscales, períodos contables y correlativos." },
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

      // Asignar al creador como admin de esta empresa
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
      toast.success("Año fiscal registrado");
      setNewYearOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al registrar año fiscal");
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
      toast.success("Serie registrada");
      setNewSeriesOpen(false);
      setSeriesName("");
      setSeriesPrefix("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al registrar serie");
    },
  });

  const entities = entitiesQuery.data ?? [];
  const currencies = currenciesQuery.data ?? [];
  const fiscalYears = fiscalYearsQuery.data ?? [];
  const series = seriesQuery.data ?? [];
  const roles = rolesQuery.data ?? [];

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
            rolesQuery.refetch();
            refetchCompanies();
          }}
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Actualizar
        </Button>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Configuración del Sistema</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Gestión de entidades legales, años fiscales, correlativos y catálogo de seguridad.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="entities" className="space-y-6">
        <TabsList>
          <TabsTrigger value="entities" className="flex items-center gap-1.5">
            <Building className="h-4 w-4" />
            <span>Empresas / Entidades ({entities.length})</span>
          </TabsTrigger>
          <TabsTrigger value="fiscal" className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            <span>Años Fiscales ({fiscalYears.length})</span>
          </TabsTrigger>
          <TabsTrigger value="series" className="flex items-center gap-1.5">
            <Layers className="h-4 w-4" />
            <span>Correlativos ({series.length})</span>
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
