import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEntity } from "@/context/ActiveEntityContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Calculator,
  FileCheck,
  FileText,
  ArrowLeft,
  RefreshCw,
  Landmark,
  Receipt,
  CheckCircle,
  AlertCircle,
  Coins,
  Send,
  Eye,
  Percent,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/taxes")({
  component: TaxesPage,
  head: () => ({
    meta: [
      { title: "Declaración de Impuestos (F29 / F22) | EasyERP" },
      { name: "description", content: "Motor tributario para Formulario 29 mensual, Formulario 22 de Renta y regímenes chilenos." },
    ],
  }),
});

function TaxesPage() {
  const queryClient = useQueryClient();
  const { activeEntity, activeEntityId } = useActiveEntity();

  // F29 Dates
  const [f29Start, setF29Start] = useState(`${new Date().getFullYear()}-08-01`);
  const [f29End, setF29End] = useState(`${new Date().getFullYear()}-08-31`);

  // F22 Dates
  const [f22Start, setF22Start] = useState(`${new Date().getFullYear()}-01-01`);
  const [f22End, setF22End] = useState(`${new Date().getFullYear()}-12-31`);

  const baseCurrency = activeEntity?.base_currency_code || "CLP";

  // Queries
  const taxRunsQuery = useQuery({
    queryKey: ["tax_calculation_runs", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("tax_calculation_runs" as any)
        .select("*")
        .eq("entity_id", activeEntityId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!activeEntityId,
  });

  const taxRuns = taxRunsQuery.data ?? [];
  const latestF29 = taxRuns.find((r) => r.form_type === "f29");
  const latestF22 = taxRuns.find((r) => r.form_type === "f22");

  // Mutations
  const calculateF29Mutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Selecciona una empresa primero");
      const { data, error } = await supabase.rpc("calculate_f29", {
        _entity_id: activeEntityId,
        _period_start: f29Start,
        _period_end: f29End,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["tax_calculation_runs", activeEntityId] });
      const vals = res?.calculated_values;
      toast.success(`Cálculo de F29 completado: Total a Pagar $ ${Number(vals?.total_a_pagar_f29 || 0).toLocaleString("es-CL")}`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al calcular F29");
    },
  });

  const calculateF22Mutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Selecciona una empresa primero");
      const { data, error } = await supabase.rpc("calculate_f22", {
        _entity_id: activeEntityId,
        _period_start: f22Start,
        _period_end: f22End,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["tax_calculation_runs", activeEntityId] });
      const vals = res?.calculated_values;
      toast.success(`Borrador F22 generado: RLI $ ${Number(vals?.renta_liquida_imponible_rli || 0).toLocaleString("es-CL")}`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al calcular F22");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ runId, status }: { runId: string; status: string }) => {
      const { data, error } = await supabase.rpc("update_tax_run_status", {
        _run_id: runId,
        _new_status: status as any,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax_calculation_runs", activeEntityId] });
      toast.success("Estado de declaración tributaria actualizado");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al actualizar estado");
    },
  });

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
              taxRunsQuery.refetch();
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
              <Landmark className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Declaración de Impuestos SII (F29 / F22)</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Motor de cálculo y liquidación de IVA, PPM y Renta Líquida Imponible para {activeEntity?.name || "la empresa"}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono py-1 px-2.5">
            Régimen: {activeEntity?.tax_regime || "14D3 Pro Pyme General"}
          </Badge>
          <Badge variant="secondary" className="text-xs font-mono py-1 px-2.5">
            Tasa PPM: {activeEntity?.ppm_rate || "0.25"}%
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="f29" className="space-y-6">
        <TabsList>
          <TabsTrigger value="f29" className="flex items-center gap-1.5">
            <Receipt className="h-4 w-4" />
            <span>Formulario 29 (F29 Mensual)</span>
          </TabsTrigger>
          <TabsTrigger value="f22" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            <span>Formulario 22 (F22 Anual Renta)</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1.5">
            <FileCheck className="h-4 w-4" />
            <span>Historial de Declaraciones ({taxRuns.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab F29 */}
        <TabsContent value="f29" className="space-y-6">
          {/* Card Parámetros de Cálculo F29 */}
          <Card className="border shadow-sm">
            <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <Label className="text-xs font-semibold">Fecha Inicio Período Mensual</Label>
                <Input
                  type="date"
                  value={f29Start}
                  onChange={(e) => setF29Start(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Fecha Fin Período Mensual</Label>
                <Input
                  type="date"
                  value={f29End}
                  onChange={(e) => setF29End(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Button
                  className="w-full text-xs font-bold"
                  onClick={() => calculateF29Mutation.mutate()}
                  disabled={calculateF29Mutation.isPending}
                >
                  <Calculator className="mr-1.5 h-3.5 w-3.5" />
                  {calculateF29Mutation.isPending ? "Calculando..." : "Calcular F29 del Mes"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Resultado F29 */}
          {latestF29 ? (
            <Card className="border shadow-md">
              <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold">
                      Propuesta F29 - Período {latestF29.period_start} al {latestF29.period_end}
                    </CardTitle>
                    <Badge
                      className={
                        latestF29.status === "filed"
                          ? "bg-emerald-600 text-white text-[11px]"
                          : latestF29.status === "reviewed"
                          ? "bg-blue-600 text-white text-[11px]"
                          : "bg-amber-500 text-white text-[11px]"
                      }
                    >
                      {latestF29.status === "filed" ? "Presentado al SII" : latestF29.status === "reviewed" ? "Revisado / Aprobado" : "Borrador"}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs mt-1">
                    Cálculo generado automáticamente desde los comprobantes y cuentas oficiales de {activeEntity?.name}.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  {latestF29.status === "draft" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => updateStatusMutation.mutate({ runId: latestF29.id, status: "reviewed" })}
                      disabled={updateStatusMutation.isPending}
                    >
                      <CheckCircle className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                      Aprobar Revisión
                    </Button>
                  )}
                  {latestF29.status === "reviewed" && (
                    <Button
                      size="sm"
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                      onClick={() => updateStatusMutation.mutate({ runId: latestF29.id, status: "filed" })}
                      disabled={updateStatusMutation.isPending}
                    >
                      <Send className="h-3.5 w-3.5 mr-1" />
                      Marcar Presentado
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {/* Cuadrícula Casillas F29 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Sección IVA */}
                  <div className="space-y-3 rounded-lg border p-4 bg-muted/20">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary border-b pb-1">
                      1. Determinación de Impuesto al Valor Agregado (IVA)
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Débito Fiscal IVA 19% (Ventas/Boletas):</span>
                        <span className="font-mono font-bold">
                          $ {Number(latestF29.calculated_values?.debito_fiscal_iva || 0).toLocaleString("es-CL")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Crédito Fiscal IVA 19% (Compras del Mes):</span>
                        <span className="font-mono font-bold">
                          $ {Number(latestF29.calculated_values?.credito_fiscal_iva || 0).toLocaleString("es-CL")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Remanente de Crédito Mes Anterior:</span>
                        <span className="font-mono font-bold">
                          $ {Number(latestF29.calculated_values?.remanente_anterior || 0).toLocaleString("es-CL")}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-1 font-semibold text-foreground">
                        <span>Total Crédito Fiscal Disponible:</span>
                        <span className="font-mono">
                          $ {Number(latestF29.calculated_values?.credito_total || 0).toLocaleString("es-CL")}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-1 font-bold text-sm">
                        <span>IVA Determinado a Pagar:</span>
                        <span className="font-mono text-primary">
                          $ {Number(latestF29.calculated_values?.iva_determinado_a_pagar || 0).toLocaleString("es-CL")}
                        </span>
                      </div>
                      {Number(latestF29.calculated_values?.nuevo_remanente_mes_siguiente || 0) > 0 && (
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                          <span>Nuevo Remanente para Mes Siguiente:</span>
                          <span className="font-mono">
                            $ {Number(latestF29.calculated_values?.nuevo_remanente_mes_siguiente).toLocaleString("es-CL")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sección PPM */}
                  <div className="space-y-3 rounded-lg border p-4 bg-muted/20">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary border-b pb-1">
                      2. Pago Provisional Mensual (PPM Obligatorio)
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Base Imponible (Ventas Netas del Mes):</span>
                        <span className="font-mono font-bold">
                          $ {Number(latestF29.calculated_values?.base_imponible_ventas_netas || 0).toLocaleString("es-CL")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tasa PPM Aplicable:</span>
                        <span className="font-mono font-bold">
                          {Number(latestF29.calculated_values?.tasa_ppm_porcentaje || 0)}%
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-1 font-bold text-sm">
                        <span>Monto PPM Determinado:</span>
                        <span className="font-mono text-primary">
                          $ {Number(latestF29.calculated_values?.monto_ppm_determinado || 0).toLocaleString("es-CL")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Total Liquidación F29 */}
                <div className="p-4 rounded-lg border bg-primary/5 flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                      Total a Declarar y Pagar en F29
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Suma de IVA Determinado + Pago Provisional Mensual (PPM).
                    </div>
                  </div>
                  <div className="text-3xl font-extrabold font-mono text-primary">
                    $ {Number(latestF29.calculated_values?.total_a_pagar_f29 || 0).toLocaleString("es-CL")}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="py-12 text-center text-muted-foreground text-sm">
              Selecciona las fechas y presiona "Calcular F29 del Mes" para generar la propuesta.
            </div>
          )}
        </TabsContent>

        {/* Tab F22 */}
        <TabsContent value="f22" className="space-y-6">
          <Card className="border shadow-sm">
            <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <Label className="text-xs font-semibold">Inicio Ejercicio Fiscal</Label>
                <Input
                  type="date"
                  value={f22Start}
                  onChange={(e) => setF22Start(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Fin Ejercicio Fiscal</Label>
                <Input
                  type="date"
                  value={f22End}
                  onChange={(e) => setF22End(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Button
                  className="w-full text-xs font-bold"
                  onClick={() => calculateF22Mutation.mutate()}
                  disabled={calculateF22Mutation.isPending}
                >
                  <Calculator className="mr-1.5 h-3.5 w-3.5" />
                  {calculateF22Mutation.isPending ? "Generando..." : "Calcular Borrador F22 Renta"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {latestF22 ? (
            <Card className="border shadow-md">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base font-bold">
                  Borrador F22 - Ejercicio Comercial {f22Start.split("-")[0]}
                </CardTitle>
                <CardDescription className="text-xs">
                  Determinación de Renta Líquida Imponible e Impuesto de Primera Categoría para {activeEntity?.name}.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 rounded-lg border p-4 bg-muted/20 text-xs">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary border-b pb-1">
                      Resultado Financiero
                    </h4>
                    <div className="flex justify-between">
                      <span>Ingresos Totales:</span>
                      <span className="font-mono font-bold">$ {Number(latestF22.calculated_values?.total_ingresos || 0).toLocaleString("es-CL")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Costos de Venta (COGS):</span>
                      <span className="font-mono font-bold">$ {Number(latestF22.calculated_values?.total_costo_ventas || 0).toLocaleString("es-CL")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gastos de Operación:</span>
                      <span className="font-mono font-bold">$ {Number(latestF22.calculated_values?.total_gastos || 0).toLocaleString("es-CL")}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1 font-bold text-sm">
                      <span>Resultado Financiero Antes Impuestos:</span>
                      <span className="font-mono text-primary">$ {Number(latestF22.calculated_values?.resultado_financiero_neto || 0).toLocaleString("es-CL")}</span>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-lg border p-4 bg-muted/20 text-xs">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary border-b pb-1">
                      Impuesto a la Renta de Primera Categoría
                    </h4>
                    <div className="flex justify-between">
                      <span>Renta Líquida Imponible (RLI):</span>
                      <span className="font-mono font-bold">$ {Number(latestF22.calculated_values?.renta_liquida_imponible_rli || 0).toLocaleString("es-CL")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tasa Aplicable Régimen ({latestF22.calculated_values?.regimen_tributario}):</span>
                      <span className="font-mono font-bold">{latestF22.calculated_values?.tasa_primera_categoria}%</span>
                    </div>
                    <div className="flex justify-between border-t pt-1">
                      <span>Impuesto de Primera Categoría:</span>
                      <span className="font-mono font-bold">$ {Number(latestF22.calculated_values?.impuesto_primera_categoria || 0).toLocaleString("es-CL")}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600">
                      <span>(-) PPMs Pagados durante el año:</span>
                      <span className="font-mono font-bold">$ {Number(latestF22.calculated_values?.ppm_acumulado_anual || 0).toLocaleString("es-CL")}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1 font-bold text-sm">
                      <span>Impuesto Líquido a Pagar / (Devolución):</span>
                      <span className="font-mono text-primary">$ {Number(latestF22.calculated_values?.resultado_final_f22 || 0).toLocaleString("es-CL")}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="py-12 text-center text-muted-foreground text-sm">
              Presiona "Calcular Borrador F22 Renta" para ver la estimación de impuesto anual.
            </div>
          )}
        </TabsContent>

        {/* Tab Historial */}
        <TabsContent value="history">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Historial de Corridas Tributarias</CardTitle>
            </CardHeader>
            <CardContent>
              {taxRuns.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">No hay declaraciones generadas aún.</div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Formulario</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead>Fecha Generación</TableHead>
                        <TableHead className="text-right">Monto Determinado</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {taxRuns.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono font-bold text-primary uppercase">{r.form_type}</TableCell>
                          <TableCell className="font-mono text-xs">{r.period_start} &rarr; {r.period_end}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("es-CL")}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs">
                            $ {Number(r.calculated_values?.total_a_pagar_f29 || r.calculated_values?.resultado_final_f22 || 0).toLocaleString("es-CL")}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              className={
                                r.status === "filed"
                                  ? "bg-emerald-600 text-white text-[10px]"
                                  : r.status === "reviewed"
                                  ? "bg-blue-600 text-white text-[10px]"
                                  : "bg-amber-500 text-white text-[10px]"
                              }
                            >
                              {r.status}
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
      </Tabs>
    </div>
  );
}
