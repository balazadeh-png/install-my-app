import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEntity } from "@/context/ActiveEntityContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FileBadge2,
  FileText,
  Settings,
  Plus,
  ArrowLeft,
  RefreshCw,
  Play,
  CheckCircle,
  Download,
  Send,
  Layers,
  HelpCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/declaraciones-juradas")({
  component: DeclaracionesJuradasPage,
  head: () => ({
    meta: [
      { title: "Declaraciones Juradas SII | EasyERP" },
      { name: "description", content: "Motor configurable de Declaraciones Juradas del SII (DJ 1879, 1887, 1947)." },
    ],
  }),
});

function DeclaracionesJuradasPage() {
  const queryClient = useQueryClient();
  const { activeEntity, activeEntityId } = useActiveEntity();

  const [selectedDjId, setSelectedDjId] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // State Modal Nueva DJ
  const [newDjModalOpen, setNewDjModalOpen] = useState(false);
  const [newDjCode, setNewDjCode] = useState("");
  const [newDjName, setNewDjName] = useState("");
  const [newFieldKey, setNewFieldKey] = useState("");
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [fieldsList, setFieldsList] = useState<{ key: string; label: string; description: string; type: string }[]>([]);

  // State Mapeos Locales
  const [localMappings, setLocalMappings] = useState<Record<string, string>>({});

  // Queries
  const djDefinitionsQuery = useQuery({
    queryKey: ["dj_definitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dj_definitions" as any)
        .select("*")
        .eq("active", true)
        .order("dj_code", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const accountsQuery = useQuery({
    queryKey: ["accounts_select", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("accounts")
        .select("id, code, name, account_type")
        .eq("entity_id", activeEntityId)
        .eq("is_group", false)
        .order("code", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeEntityId,
  });

  const djDefinitions = djDefinitionsQuery.data ?? [];
  const currentDj = djDefinitions.find((d) => d.id === selectedDjId) || djDefinitions[0];

  // Set default selected DJ
  if (!selectedDjId && djDefinitions.length > 0) {
    setSelectedDjId(djDefinitions[0].id);
  }

  // Query Mapeos de la DJ y empresa activa
  const mappingsQuery = useQuery({
    queryKey: ["dj_field_mappings", activeEntityId, currentDj?.id],
    queryFn: async () => {
      if (!activeEntityId || !currentDj?.id) return [];
      const { data, error } = await supabase
        .from("dj_field_mappings" as any)
        .select("*")
        .eq("entity_id", activeEntityId)
        .eq("dj_definition_id", currentDj.id);
      if (error) throw error;
      const mapObj: Record<string, string> = {};
      (data ?? []).forEach((m: any) => {
        mapObj[m.field_key] = m.source_account_id;
      });
      setLocalMappings(mapObj);
      return (data ?? []) as any[];
    },
    enabled: !!activeEntityId && !!currentDj?.id,
  });

  // Query Liquidaciones Generadas
  const djGenerationsQuery = useQuery({
    queryKey: ["dj_generations", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("dj_generations" as any)
        .select("*, dj_definitions(dj_code, name)")
        .eq("entity_id", activeEntityId)
        .order("tax_year", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!activeEntityId,
  });

  const accounts = accountsQuery.data ?? [];
  const generations = djGenerationsQuery.data ?? [];
  const currentGen = generations.find(
    (g) => g.dj_definition_id === currentDj?.id && g.tax_year === selectedYear
  );

  // Mutations
  const generateDjMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId || !currentDj?.id) throw new Error("Selecciona una empresa y una DJ");
      const { data, error } = await supabase.rpc("generate_dj", {
        _entity_id: activeEntityId,
        _dj_definition_id: currentDj.id,
        _tax_year: selectedYear,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dj_generations", activeEntityId] });
      toast.success(`Declaración Jurada ${currentDj?.dj_code} generada exitosamente para el AT ${selectedYear}`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al generar DJ");
    },
  });

  const saveMappingsMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId || !currentDj?.id) throw new Error("Datos incompletos");
      const fields = (currentDj.field_schema as any[]) || [];
      for (const f of fields) {
        const accId = localMappings[f.key] || null;
        const { error } = await supabase.from("dj_field_mappings" as any).upsert(
          {
            entity_id: activeEntityId,
            dj_definition_id: currentDj.id,
            field_key: f.key,
            source_account_id: accId,
            description: f.label,
          },
          { onConflict: "entity_id,dj_definition_id,field_key" }
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dj_field_mappings", activeEntityId, currentDj?.id] });
      toast.success("Mapeos de cuentas contables guardados correctamente");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al guardar mapeos");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ genId, status }: { genId: string; status: string }) => {
      const { data, error } = await supabase.rpc("update_dj_status", {
        _generation_id: genId,
        _new_status: status as any,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dj_generations", activeEntityId] });
      toast.success("Estado de la DJ actualizado");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al actualizar estado");
    },
  });

  const createDjDefMutation = useMutation({
    mutationFn: async () => {
      if (!newDjCode.trim() || !newDjName.trim()) throw new Error("Complete el código y nombre");
      if (fieldsList.length === 0) throw new Error("Debe agregar al menos un campo requerido al esquema");

      const { data, error } = await supabase.from("dj_definitions" as any).insert({
        dj_code: newDjCode.trim(),
        name: newDjName.trim(),
        periodicity: "anual",
        field_schema: fieldsList,
        active: true,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dj_definitions"] });
      toast.success("Nueva definición de DJ creada en el catálogo");
      setNewDjModalOpen(false);
      setNewDjCode("");
      setNewDjName("");
      setFieldsList([]);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al crear definición de DJ");
    },
  });

  function downloadDjCsv() {
    if (!currentGen || !currentGen.generated_values) {
      toast.error("No hay datos generados para descargar");
      return;
    }
    // Neutralize spreadsheet formula prefixes and escape quotes so a saved
    // label cannot execute as a formula when the CSV is opened in Excel/Sheets.
    const csvSafe = (value: unknown): string => {
      let s = String(value ?? "").replace(/"/g, '""');
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return s;
    };
    const headers = "Campo_Oficial;Valor_Calculado_CLP";
    const fields = (currentDj?.field_schema as any[]) || [];
    const rows = fields
      .map((f) => `"${csvSafe(f.label)}";"${csvSafe(Number(currentGen.generated_values[f.key] || 0))}"`)
      .join("\n");

    const blob = new Blob([`${headers}\n${rows}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `DJ_${currentDj?.dj_code}_AT${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Archivo CSV de la DJ generado");
  }

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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              djDefinitionsQuery.refetch();
              mappingsQuery.refetch();
              djGenerationsQuery.refetch();
            }}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileBadge2 className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Declaraciones Juradas SII</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Motor dinámico y extensible para la preparación y auditoría de Declaraciones Juradas anuales.
          </p>
        </div>

        <Dialog open={newDjModalOpen} onOpenChange={setNewDjModalOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Nueva Definición de DJ
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nueva Declaración Jurada</DialogTitle>
              <DialogDescription>
                Agrega un nuevo formulario tributario al catálogo sin modificar código fuente.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label className="text-xs font-semibold">Código DJ (ej. 1922) *</Label>
                <Input
                  placeholder="ej. 1922"
                  value={newDjCode}
                  onChange={(e) => setNewDjCode(e.target.value)}
                  className="mt-1 font-mono uppercase"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Nombre Oficial *</Label>
                <Input
                  placeholder="ej. DJ 1922: Fondo de Utilidades Tributarias"
                  value={newDjName}
                  onChange={(e) => setNewDjName(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="border-t pt-2 space-y-2">
                <Label className="text-xs font-bold">Campos Requeridos de la DJ</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Clave (ej. monto_fut)"
                    value={newFieldKey}
                    onChange={(e) => setNewFieldKey(e.target.value)}
                    className="text-xs font-mono"
                  />
                  <Input
                    placeholder="Etiqueta / Nombre Campo"
                    value={newFieldLabel}
                    onChange={(e) => setNewFieldLabel(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => {
                    if (!newFieldKey.trim() || !newFieldLabel.trim()) return;
                    setFieldsList([
                      ...fieldsList,
                      { key: newFieldKey.trim(), label: newFieldLabel.trim(), description: newFieldLabel.trim(), type: "currency" },
                    ]);
                    setNewFieldKey("");
                    setNewFieldLabel("");
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" /> Agregar Campo a la Lista
                </Button>

                {fieldsList.length > 0 && (
                  <div className="p-2 rounded bg-muted/40 text-xs space-y-1">
                    {fieldsList.map((f, idx) => (
                      <div key={idx} className="flex justify-between font-mono text-[11px]">
                        <span>{f.key}</span>
                        <span className="text-muted-foreground">{f.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createDjDefMutation.mutate()}
                disabled={createDjDefMutation.isPending || !newDjCode || !newDjName || fieldsList.length === 0}
              >
                Guardar Definición
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Selector Principal de DJ y Año */}
      <Card className="border shadow-sm mb-6">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <Label className="text-xs font-semibold">Selecciona Declaración Jurada</Label>
            <Select value={selectedDjId} onValueChange={setSelectedDjId}>
              <SelectTrigger className="mt-1 text-xs">
                <SelectValue placeholder="Selecciona una DJ..." />
              </SelectTrigger>
              <SelectContent>
                {djDefinitions.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    DJ {d.dj_code} - {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-semibold">Año Tributario (AT)</Label>
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="mt-1 text-xs font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2027">AT 2027 (Comercial 2026)</SelectItem>
                <SelectItem value="2026">AT 2026 (Comercial 2025)</SelectItem>
                <SelectItem value="2025">AT 2025 (Comercial 2024)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Button
              className="w-full text-xs font-bold"
              onClick={() => generateDjMutation.mutate()}
              disabled={generateDjMutation.isPending || !currentDj}
            >
              <Play className="mr-1.5 h-3.5 w-3.5" />
              {generateDjMutation.isPending ? "Procesando..." : "Generar Declaración Jurada"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="values" className="space-y-6">
        <TabsList>
          <TabsTrigger value="values" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            <span>Resultado Generado</span>
          </TabsTrigger>
          <TabsTrigger value="mappings" className="flex items-center gap-1.5">
            <Settings className="h-4 w-4" />
            <span>Mapeo de Cuentas Contables</span>
          </TabsTrigger>
          <TabsTrigger value="catalog" className="flex items-center gap-1.5">
            <Layers className="h-4 w-4" />
            <span>Catálogo Oficial de DJs ({djDefinitions.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab Resultado */}
        <TabsContent value="values" className="space-y-6">
          {currentGen ? (
            <Card className="border shadow-md">
              <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold">
                      DJ {currentDj?.dj_code} - Año Tributario {currentGen.tax_year}
                    </CardTitle>
                    <Badge
                      className={
                        currentGen.status === "filed"
                          ? "bg-emerald-600 text-white text-[11px]"
                          : currentGen.status === "reviewed"
                          ? "bg-blue-600 text-white text-[11px]"
                          : "bg-amber-500 text-white text-[11px]"
                      }
                    >
                      {currentGen.status === "filed"
                        ? "Presentada al SII"
                        : currentGen.status === "reviewed"
                        ? "Revisada / Aprobada"
                        : "Borrador"}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs mt-1">{currentDj?.name}</CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={downloadDjCsv}>
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Descargar CSV
                  </Button>

                  {currentGen.status === "draft" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => updateStatusMutation.mutate({ genId: currentGen.id, status: "reviewed" })}
                      disabled={updateStatusMutation.isPending}
                    >
                      <CheckCircle className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                      Aprobar
                    </Button>
                  )}
                  {currentGen.status === "reviewed" && (
                    <Button
                      size="sm"
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                      onClick={() => updateStatusMutation.mutate({ genId: currentGen.id, status: "filed" })}
                      disabled={updateStatusMutation.isPending}
                    >
                      <Send className="h-3.5 w-3.5 mr-1" />
                      Marcar Presentada
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-6">
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Campo Oficial SII</TableHead>
                        <TableHead>Descripción Técnica</TableHead>
                        <TableHead className="text-right">Monto Extraído / Calculado (CLP)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {((currentDj?.field_schema as any[]) || []).map((f) => (
                        <TableRow key={f.key}>
                          <TableCell className="font-semibold text-xs">{f.label}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{f.description}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs text-primary">
                            $ {Number(currentGen.generated_values[f.key] || 0).toLocaleString("es-CL")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="py-12 text-center text-muted-foreground text-sm">
              Presiona "Generar Declaración Jurada" para procesar las cuentas del año seleccionado.
            </div>
          )}
        </TabsContent>

        {/* Tab Mapeos */}
        <TabsContent value="mappings" className="space-y-6">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  Mapeo de Cuentas Contables - DJ {currentDj?.dj_code}
                </CardTitle>
                <CardDescription className="text-xs">
                  Asigna la cuenta del plan de cuentas de {activeEntity?.name} que alimentará automáticamente cada campo de la DJ.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => saveMappingsMutation.mutate()} disabled={saveMappingsMutation.isPending}>
                Guardar Mapeos
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {((currentDj?.field_schema as any[]) || []).map((f) => (
                  <div key={f.key} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center p-3 rounded-lg border bg-muted/20">
                    <div>
                      <div className="text-xs font-bold text-foreground">{f.label}</div>
                      <div className="text-[11px] text-muted-foreground">{f.description}</div>
                    </div>
                    <div>
                      <Select
                        value={localMappings[f.key] || "none"}
                        onValueChange={(val) =>
                          setLocalMappings({ ...localMappings, [f.key]: val === "none" ? "" : val })
                        }
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue placeholder="Sin cuenta contable asignada..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-- Sin cuenta contable asignada --</SelectItem>
                          {accounts.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.code} - {acc.name} ({acc.account_type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Catálogo */}
        <TabsContent value="catalog">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Catálogo General de Declaraciones Juradas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código DJ</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Periodicidad</TableHead>
                      <TableHead>Campos Configurados</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {djDefinitions.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono font-bold text-primary">DJ {d.dj_code}</TableCell>
                        <TableCell className="font-medium text-xs">{d.name}</TableCell>
                        <TableCell className="text-xs capitalize">{d.periodicity}</TableCell>
                        <TableCell className="text-xs font-mono">{((d.field_schema as any[]) || []).length} campos</TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-emerald-600 text-white text-[10px]">Activo</Badge>
                        </TableCell>
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
