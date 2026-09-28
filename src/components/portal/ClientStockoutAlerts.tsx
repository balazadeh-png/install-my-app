import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Check,
  TrendingDown,
  Sparkles,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

interface ClientStockoutAlertsProps {
  partyId?: string | undefined;
  companyId?: string | undefined;
  companyName?: string | undefined;
}

export function ClientStockoutAlerts({
  partyId,
  companyId,
  companyName,
}: ClientStockoutAlertsProps) {
  const qc = useQueryClient();
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // 1. Consultar alertas no leídas para el cliente en el portal
  const alertsQ = useQuery({
    queryKey: ["client_alerts_portal", partyId, companyId],
    enabled: !!partyId,
    queryFn: async () => {
      let q = supabase
        .from("client_alerts" as any)
        .select(`
          id,
          company_id,
          party_id,
          item_id,
          severity,
          message,
          is_read,
          created_at,
          items (code, name)
        `)
        .eq("party_id", partyId!)
        .eq("is_read", false)
        .order("created_at", { ascending: false });

      if (companyId) {
        q = q.eq("company_id", companyId);
      }

      const { data, error } = await q;
      if (error) {
        console.warn("Error consultando client_alerts:", error);
        return [];
      }
      return (data as any[]) || [];
    },
    refetchInterval: 30000, // Revalida cada 30 segundos
  });

  // 2. Consultar el pronóstico de inventario predictivo (para el modal detallado)
  const forecastQ = useQuery({
    queryKey: ["inventory_forecast", companyId, partyId],
    enabled: !!companyId && !!partyId && detailModalOpen,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_inventory_stockout_forecast", {
        p_company_id: companyId!,
        p_party_id: partyId!,
      });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  // 3. Mutación para recalcular alertas automáticamente
  const recomputeAlertsM = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No se ha definido la empresa activa");
      const { data, error } = await supabase.rpc("check_and_create_stockout_alerts", {
        p_company_id: companyId,
        ...(partyId ? { p_party_id: partyId } : {}),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (res: any) => {
      toast.success(
        `Pronóstico actualizado: ${res?.critical_alerts ?? 0} críticos, ${res?.warning_alerts ?? 0} advertencias.`
      );
      qc.invalidateQueries({ queryKey: ["client_alerts_portal"] });
      qc.invalidateQueries({ queryKey: ["inventory_forecast"] });
    },
    onError: (err: any) => {
      toast.error(`Error al actualizar pronóstico: ${err.message}`);
    },
  });

  // 4. Mutación para marcar una alerta como leída
  const markReadM = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase.rpc("mark_client_alert_read", {
        p_alert_id: alertId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_alerts_portal"] });
    },
    onError: (err: any) => {
      toast.error(`Error al descartar alerta: ${err.message}`);
    },
  });

  // 5. Mutación para marcar todas las alertas como leídas
  const markAllReadM = useMutation({
    mutationFn: async () => {
      if (!partyId) return;
      const { error } = await supabase.rpc("mark_all_client_alerts_read", {
        p_party_id: partyId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Todas las alertas han sido marcadas como leídas");
      qc.invalidateQueries({ queryKey: ["client_alerts_portal"] });
    },
    onError: (err: any) => {
      toast.error(`Error al descartar alertas: ${err.message}`);
    },
  });

  const alerts = alertsQ.data || [];
  const criticalAlerts = alerts.filter((a) => a.severity === "CRITICAL");
  const warningAlerts = alerts.filter((a) => a.severity === "WARNING");

  if (!partyId) return null;

  return (
    <div className="space-y-3">
      {/* Barra de estado rápido si no hay alertas críticas */}
      {alerts.length === 0 && (
        <div className="flex items-center justify-between p-3.5 bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Inventario Saludable:</strong> El motor predictivo AI no detecta riesgos de
              quiebre de stock en los próximos 14 días.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/50"
              onClick={() => setDetailModalOpen(true)}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              Ver Proyecciones
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs border-emerald-300 dark:border-emerald-700"
              onClick={() => recomputeAlertsM.mutate()}
              disabled={recomputeAlertsM.isPending}
            >
              <RefreshCw
                className={`h-3 w-3 mr-1 ${recomputeAlertsM.isPending ? "animate-spin" : ""}`}
              />
              Recalcular
            </Button>
          </div>
        </div>
      )}

      {/* Alertas Críticas (Rojo Destructivo) */}
      {criticalAlerts.length > 0 && (
        <Alert variant="destructive" className="border-red-500/40 bg-red-50 dark:bg-red-950/30">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
            <div>
              <AlertTitle className="text-sm font-semibold flex items-center gap-2 text-red-900 dark:text-red-200">
                <span>Riesgo Crítico de Quiebre de Stock ({criticalAlerts.length})</span>
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                  Acción Inmediata
                </Badge>
              </AlertTitle>
              <AlertDescription className="text-xs text-red-800 dark:text-red-300 mt-1">
                Se proyecta que {criticalAlerts.length}{" "}
                {criticalAlerts.length === 1 ? "artículo se agotará" : "artículos se agotarán"} en
                menos de 7 días según el consumo diario promedio de los últimos 30 días.
              </AlertDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-red-300 dark:border-red-800 text-red-900 dark:text-red-100 hover:bg-red-100 dark:hover:bg-red-900/50"
                onClick={() => setDetailModalOpen(true)}
              >
                Ver Detalle ({alerts.length})
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-red-700 dark:text-red-300"
                onClick={() => markAllReadM.mutate()}
                disabled={markAllReadM.isPending}
              >
                <Check className="h-3 w-3 mr-1" />
                Descartar todas
              </Button>
            </div>
          </div>

          {/* Listado de mensajes de alertas críticas */}
          <div className="mt-3 space-y-2 border-t border-red-200 dark:border-red-900/50 pt-2.5">
            {criticalAlerts.slice(0, 3).map((alert) => (
              <div
                key={alert.id}
                className="flex items-start justify-between gap-3 text-xs bg-background/80 dark:bg-card/70 p-2.5 rounded-md border border-red-200/60 dark:border-red-900/30"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground">
                      {alert.items?.code || "SKU"}
                    </span>
                    <span className="text-muted-foreground">— {alert.items?.name}</span>
                  </div>
                  <p className="text-red-700 dark:text-red-400 font-medium">{alert.message}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground shrink-0"
                  onClick={() => markReadM.mutate(alert.id)}
                  title="Marcar como leída"
                >
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {criticalAlerts.length > 3 && (
              <p className="text-[11px] text-red-600 dark:text-red-400 font-medium text-right">
                + {criticalAlerts.length - 3} alertas críticas adicionales en el visor detallado.
              </p>
            )}
          </div>
        </Alert>
      )}

      {/* Alertas de Advertencia (Ámbar) */}
      {warningAlerts.length > 0 && criticalAlerts.length === 0 && (
        <Alert className="border-amber-500/40 bg-amber-50/70 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
            <div>
              <AlertTitle className="text-sm font-semibold flex items-center gap-2">
                <span>Alerta Preventiva de Inventario ({warningAlerts.length})</span>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-800 border-amber-300"
                >
                  7 a 14 días restantes
                </Badge>
              </AlertTitle>
              <AlertDescription className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                Existen productos con stock suficiente para 14 días o menos según la tasa actual de
                consumo.
              </AlertDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-amber-300 dark:border-amber-700"
                onClick={() => setDetailModalOpen(true)}
              >
                Revisar Proyecciones
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => markAllReadM.mutate()}
                disabled={markAllReadM.isPending}
              >
                Descartar
              </Button>
            </div>
          </div>
        </Alert>
      )}

      {/* Modal Diálogo: Analítica Predictiva y Pronóstico AI Completo */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              <span>Pronóstico Predictivo de Stock y Proyección de Quiebres</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Algoritmo de cálculo basado en el consumo diario promedio de los últimos 30 días
              (kardex salidas) sobre existencias actuales disponibles en custodia.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-3 py-2 border-y bg-muted/30 px-3 rounded-md">
            <div className="text-xs text-muted-foreground">
              Operador Logístico: <strong>{companyName || "Custodio 3PL"}</strong>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => recomputeAlertsM.mutate()}
              disabled={recomputeAlertsM.isPending}
            >
              <RefreshCw
                className={`h-3 w-3 mr-1 ${recomputeAlertsM.isPending ? "animate-spin" : ""}`}
              />
              Recalcular Ahora
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto min-h-[300px]">
            {forecastQ.isLoading ? (
              <div className="flex items-center justify-center p-12 text-muted-foreground text-sm">
                <RefreshCw className="h-5 w-5 animate-spin mr-2 text-primary" />
                Calculando proyecciones de quiebre de stock...
              </div>
            ) : (forecastQ.data || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                <p className="text-sm font-medium">No se registran productos con consumo</p>
                <p className="text-xs mt-1">
                  Cuando se realicen movimientos de despacho o picking, el motor AI proyectará la
                  tasa de agotamiento.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Código / SKU</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Stock Actual</TableHead>
                    <TableHead className="text-right">Consumo Diario (Burn Rate)</TableHead>
                    <TableHead className="text-right">Días Restantes</TableHead>
                    <TableHead className="text-center w-[120px]">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(forecastQ.data || []).map((row: any) => (
                    <TableRow key={row.item_id}>
                      <TableCell className="font-mono text-xs font-semibold">
                        {row.item_code}
                      </TableCell>
                      <TableCell className="text-xs">{row.item_name}</TableCell>
                      <TableCell className="text-right font-medium text-xs">
                        {Number(row.current_stock).toLocaleString()} un.
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        <div className="flex items-center justify-end gap-1 text-muted-foreground">
                          <TrendingDown className="h-3 w-3 text-red-500" />
                          <span>{Number(row.avg_daily_consumption).toLocaleString()} un/día</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs font-semibold">
                        {row.days_to_stockout >= 999 ? (
                          <span className="text-muted-foreground">&gt; 90 días</span>
                        ) : row.days_to_stockout <= 0 ? (
                          <span className="text-red-600 font-bold">0 días (Agotado)</span>
                        ) : (
                          <span
                            className={
                              row.days_to_stockout <= 7
                                ? "text-red-600 font-bold"
                                : row.days_to_stockout <= 14
                                ? "text-amber-600 font-bold"
                                : "text-emerald-600"
                            }
                          >
                            {row.days_to_stockout} días
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.status === "CRITICAL" ? (
                          <Badge
                            variant="destructive"
                            className="text-[10px] uppercase font-bold"
                          >
                            Crítico
                          </Badge>
                        ) : row.status === "WARNING" ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase font-bold bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                          >
                            Advertencia
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase font-medium bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                          >
                            Saludable
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
