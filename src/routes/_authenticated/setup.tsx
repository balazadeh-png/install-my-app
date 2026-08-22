import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Settings, Plus, ArrowLeft, RefreshCw, Building, Calendar, Hash, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/setup")({
  component: SetupPage,
  head: () => ({
    meta: [
      { title: "Configuración | Cacao Accounting" },
      { name: "description", content: "Empresa, años fiscales, períodos contables y correlativos." },
    ],
  }),
});

function SetupPage() {
  const queryClient = useQueryClient();
  const [newEntityOpen, setNewEntityOpen] = useState(false);
  const [newYearOpen, setNewYearOpen] = useState(false);
  const [newSeriesOpen, setNewSeriesOpen] = useState(false);

  // Form Entity
  const [entityCode, setEntityCode] = useState("");
  const [entityName, setEntityName] = useState("");
  const [entityTaxId, setEntityTaxId] = useState("");

  // Form Fiscal Year
  const [yearName, setYearName] = useState(`Ejercicio ${new Date().getFullYear()}`);
  const [yearStart, setYearStart] = useState(`${new Date().getFullYear()}-01-01`);
  const [yearEnd, setYearEnd] = useState(`${new Date().getFullYear()}-12-31`);

  // Form Series
  const [seriesName, setSeriesName] = useState("");
  const [seriesPrefix, setSeriesPrefix] = useState("");

  // Queries
  const entitiesQuery = useQuery({
    queryKey: ["entities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("entities").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const fiscalYearsQuery = useQuery({
    queryKey: ["fiscal_years"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fiscal_years").select("*").order("start_date");
      if (error) throw error;
      return data ?? [];
    },
  });

  const seriesQuery = useQuery({
    queryKey: ["naming_series"],
    queryFn: async () => {
      const { data, error } = await supabase.from("naming_series").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
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
      const { error } = await supabase.from("entities").insert({
        code: entityCode.trim(),
        name: entityName.trim(),
        tax_id: entityTaxId.trim() || null,
        currency: "NIO",
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entities"] });
      toast.success("Empresa registrada");
      setNewEntityOpen(false);
      setEntityCode("");
      setEntityName("");
      setEntityTaxId("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al registrar empresa");
    },
  });

  const createYearMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("fiscal_years").insert({
        name: yearName.trim(),
        start_date: yearStart,
        end_date: yearEnd,
        closed: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal_years"] });
      toast.success("Año fiscal registrado");
      setNewYearOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al registrar año fiscal");
    },
  });

  const createSeriesMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("naming_series").insert({
        name: seriesName.trim(),
        prefix: seriesPrefix.trim().toUpperCase(),
        next_number: 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["naming_series"] });
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
          }}
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Actualizar
        </Button>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Settings className="h-4 w-4" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Configuración General del Sistema</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Parámetros de empresa, ejercicios fiscales, correlativos y catálogo de roles.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="entities" className="space-y-4">
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
            <Hash className="h-4 w-4" />
            <span>Correlativos / Series ({series.length})</span>
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4" />
            <span>Roles del Sistema ({roles.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab Entities */}
        <TabsContent value="entities">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Empresas y Sucursales</CardTitle>
                <CardDescription>
                  Entidades legales u operativas administradas en el ERP.
                </CardDescription>
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
                      Ingresa los datos de la razón social de la empresa.
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
                        placeholder="ej. Cacao Corporation S.A."
                        value={entityName}
                        onChange={(e) => setEntityName(e.target.value)}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="eTax" className="text-right">RUC</Label>
                      <Input
                        id="eTax"
                        placeholder="ej. J0310000009999"
                        value={entityTaxId}
                        onChange={(e) => setEntityTaxId(e.target.value)}
                        className="col-span-3 font-mono"
                      />
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
            </CardHeader>
            <CardContent>
              {entities.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  No hay entidades registradas. Crea la primera empresa para asociar catálogos.
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">Código</TableHead>
                        <TableHead>Razón Social</TableHead>
                        <TableHead>RUC</TableHead>
                        <TableHead>Moneda Base</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entities.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="font-mono font-medium text-xs">{e.code}</TableCell>
                          <TableCell className="font-semibold text-xs">{e.name}</TableCell>
                          <TableCell className="font-mono text-xs">{e.tax_id || "-"}</TableCell>
                          <TableCell className="text-xs font-mono">{e.currency}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={e.active ? "outline" : "secondary"} className="text-xs">
                              {e.active ? "Activa" : "Inactiva"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Fiscal Years */}
        <TabsContent value="fiscal">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Ejercicios y Años Fiscales</CardTitle>
                <CardDescription>
                  Períodos anuales para cierre de balance y control contable.
                </CardDescription>
              </div>
              <Dialog open={newYearOpen} onOpenChange={setNewYearOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
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
                    <Button onClick={() => createYearMutation.mutate()} disabled={createYearMutation.isPending}>
                      Guardar Año Fiscal
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {fiscalYears.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  No hay años fiscales registrados.
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
                      {fiscalYears.map((fy) => (
                        <TableRow key={fy.id}>
                          <TableCell className="font-semibold text-xs">{fy.name}</TableCell>
                          <TableCell className="font-mono text-xs">{fy.start_date}</TableCell>
                          <TableCell className="font-mono text-xs">{fy.end_date}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={fy.closed ? "secondary" : "outline"} className="text-xs">
                              {fy.closed ? "Cerrado" : "Abierto"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Series */}
        <TabsContent value="series">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Series de Numeración y Correlativos</CardTitle>
                <CardDescription>
                  Prefijos y secuencias de numeración para facturas, asientos y comprobantes.
                </CardDescription>
              </div>
              <Dialog open={newSeriesOpen} onOpenChange={setNewSeriesOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Nueva Serie
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Registrar Serie de Numeración</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-3">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="srName" className="text-right">Documento</Label>
                      <Input
                        id="srName"
                        placeholder="ej. Facturas de Venta"
                        value={seriesName}
                        onChange={(e) => setSeriesName(e.target.value)}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="srPrefix" className="text-right">Prefijo</Label>
                      <Input
                        id="srPrefix"
                        placeholder="ej. FAC-"
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
            </CardHeader>
            <CardContent>
              {series.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  No hay series configuradas aún.
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre Documento</TableHead>
                        <TableHead>Prefijo</TableHead>
                        <TableHead className="text-right">Siguiente Correlativo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {series.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium text-xs">{s.name}</TableCell>
                          <TableCell className="font-mono text-xs font-bold">{s.prefix}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{s.next_number}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Roles */}
        <TabsContent value="roles">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Catálogo de Roles de Usuario</CardTitle>
              <CardDescription>
                Roles predeterminados del sistema y niveles de autorización.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Identificador de Rol</TableHead>
                      <TableHead>Descripción / Nota</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roles.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs font-semibold">
                          <Badge variant="outline">{r.name}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.note || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
