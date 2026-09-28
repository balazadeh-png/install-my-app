import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEntity } from "@/context/ActiveEntityContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ArrowLeft,
  Truck,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Box,
  DollarSign,
  TrendingUp,
  Percent,
  Plus,
  Warehouse,
  ExternalLink,
  Users,
  Building2,
  FileText,
  Settings2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard-3pl")({
  head: () => ({
    meta: [
      { title: "Dashboard BI y KPIs Operacionales 3PL — EasyERP" },
      {
        name: "description",
        content:
          "Indicadores clave de rendimiento logístico 3PL: OTIF (On-Time In-Full), alertas de SLA, costo por unidad procesada y ocupación volumétrica de bodegas.",
      },
    ],
  }),
  component: Dashboard3PLPage,
});

function Dashboard3PLPage() {
  const { activeEntity, activeEntityId } = useActiveEntity();
  const qc = useQueryClient();

  // Control de Rango de Fechas (default: primer día del mes actual a hoy)
  const [periodStart, setPeriodStart] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  });
  const [periodEnd, setPeriodEnd] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Umbral configurable de SLA (días máximos para guías en borrador sin picking)
  const [slaDaysThreshold, setSlaDaysThreshold] = useState<number>(2);

  // Filtros adicionales
  const [selectedPartyFilter, setSelectedPartyFilter] = useState<string>("ALL");
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>("ALL");

  // Estado para Modal de Costo Operativo
  const [isCostModalOpen, setIsCostModalOpen] = useState(false);
  const [costPeriodStart, setCostPeriodStart] = useState(periodStart);
  const [costPeriodEnd, setCostPeriodEnd] = useState(periodEnd);
  const [costAmount, setCostAmount] = useState<number>(0);
  const [costNotes, setCostNotes] = useState("");

  // Estado para Modal de Capacidad de Bodega
  const [editingWarehouse, setEditingWarehouse] = useState<{ id: string; name: string; capacity_m3: number | null } | null>(null);
  const [warehouseCapacityInput, setWarehouseCapacityInput] = useState<string>("");

  // 1. Clientes 3PL
  const partiesQ = useQuery({
    queryKey: ["parties_3pl_kpis", activeEntityId],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parties")
        .select("id, name, tax_id, is_3pl_client")
        .eq("entity_id", activeEntityId!)
        .eq("is_3pl_client", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // 2. Bodegas activas
  const warehousesQ = useQuery({
    queryKey: ["warehouses_3pl_kpis", activeEntityId],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("id, code, name, is_active, capacity_m3")
        .eq("entity_id", activeEntityId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // 3. Guías de despacho en el período consultado (para cálculo OTIF y productividad)
  const dispatchesQ = useQuery({
    queryKey: ["dispatches_period_kpis", activeEntityId, periodStart, periodEnd],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dispatch_notes")
        .select(`
          id,
          dispatch_number,
          party_id,
          warehouse_id,
          status,
          created_at,
          departure_at,
          arrival_at,
          distance_km,
          parties:party_id (id, name, tax_id),
          warehouses:warehouse_id (id, code, name),
          dispatch_note_lines (id, item_id, qty, picked, packed)
        `)
        .eq("entity_id", activeEntityId!)
        .gte("created_at", `${periodStart}T00:00:00.000Z`)
        .lte("created_at", `${periodEnd}T23:59:59.999Z`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // 4. Guías en alerta de SLA: status='draft' creadas antes de (hoy - N días) con picking incompleto
  const slaAlertDispatchesQ = useQuery({
    queryKey: ["sla_alerts_kpis", activeEntityId, slaDaysThreshold],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - slaDaysThreshold);
      const cutoffIso = cutoff.toISOString();

      const { data, error } = await supabase
        .from("dispatch_notes")
        .select(`
          id,
          dispatch_number,
          party_id,
          warehouse_id,
          status,
          created_at,
          departure_at,
          parties:party_id (id, name, tax_id),
          warehouses:warehouse_id (id, code, name),
          dispatch_note_lines (id, item_id, qty, picked, packed)
        `)
        .eq("entity_id", activeEntityId!)
        .eq("status", "draft")
        .lte("created_at", cutoffIso)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Filtrar sólo las que tengan al menos una línea sin pickear
      return (data ?? []).filter((g: any) => {
        const lines = g.dispatch_note_lines || [];
        return lines.length === 0 || lines.some((l: any) => !l.picked);
      });
    },
  });

  // 5. Insumos de costos operativos para el período
  const operationalCostQ = useQuery({
    queryKey: ["operational_costs_kpis", activeEntityId, periodStart, periodEnd],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operational_cost_inputs")
        .select("*")
        .eq("entity_id", activeEntityId!)
        .lte("period_start", periodEnd)
        .gte("period_end", periodStart)
        .order("period_start", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // 6. Saldos actuales en bodega para cálculo de ocupación
  const stockBalancesQ = useQuery({
    queryKey: ["stock_balances_capacity_kpis", activeEntityId],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_balances" as any)
        .select("warehouse_id, item_id, balance, party_id");
      if (error) throw error;
      return (data ?? []) as Array<{ warehouse_id: string; item_id: string; balance: number; party_id: string | null }>;
    },
  });

  // Mutación: Guardar Costo Operativo
  const saveOperationalCostM = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Entidad activa requerida");
      if (costAmount <= 0) throw new Error("El costo debe ser mayor a 0");
      if (costPeriodEnd < costPeriodStart) throw new Error("La fecha de fin debe ser posterior a la de inicio");

      const { error } = await supabase.from("operational_cost_inputs").insert({
        entity_id: activeEntityId,
        period_start: costPeriodStart,
        period_end: costPeriodEnd,
        total_cost: costAmount,
        notes: costNotes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Costo operativo ingresado exitosamente");
      setIsCostModalOpen(false);
      setCostAmount(0);
      setCostNotes("");
      qc.invalidateQueries({ queryKey: ["operational_costs_kpis"] });
    },
    onError: (err: any) => toast.error(err.message || "Error al guardar costo operativo"),
  });

  // Mutación: Guardar Capacidad Volumétrica de Bodega
  const updateWarehouseCapacityM = useMutation({
    mutationFn: async () => {
      if (!editingWarehouse) return;
      const parsed = warehouseCapacityInput.trim() ? parseFloat(warehouseCapacityInput) : null;
      if (parsed !== null && (isNaN(parsed) || parsed < 0)) {
        throw new Error("La capacidad en m³ debe ser un número positivo");
      }

      const { error } = await supabase
        .from("warehouses")
        .update({ capacity_m3: parsed, updated_at: new Date().toISOString() })
        .eq("id", editingWarehouse.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Capacidad de bodega actualizada");
      setEditingWarehouse(null);
      qc.invalidateQueries({ queryKey: ["warehouses_3pl_kpis"] });
    },
    onError: (err: any) => toast.error(err.message || "Error al actualizar capacidad"),
  });

  // ============================================================================
  // CÁLCULOS ESTADÍSTICOS Y MÉTRICAS
  // ============================================================================

  // Filtrado de guías por cliente y bodega
  const filteredDispatches = useMemo(() => {
    return (dispatchesQ.data ?? []).filter((g: any) => {
      if (selectedPartyFilter !== "ALL" && g.party_id !== selectedPartyFilter) return false;
      if (selectedWarehouseFilter !== "ALL" && g.warehouse_id !== selectedWarehouseFilter) return false;
      return true;
    });
  }, [dispatchesQ.data, selectedPartyFilter, selectedWarehouseFilter]);

  // Cálculo OTIF (On-Time In-Full)
  // Regla del roadmap: arrival_at dentro de las 24h de departure_at planeada Y todas sus líneas packed=true
  const otifAnalysis = useMemo(() => {
    let eligibleDispatches = 0;
    let otifSuccessCount = 0;
    let onTimeOnlyCount = 0;
    let inFullOnlyCount = 0;
    let totalPickedUnitsInPeriod = 0;

    // Métricas por cliente
    const clientStatsMap: Record<
      string,
      {
        party_name: string;
        tax_id: string | null;
        total: number;
        otifCount: number;
        lateCount: number;
        incompleteCount: number;
        totalTransitHours: number;
        deliveredCount: number;
      }
    > = {};

    for (const g of filteredDispatches) {
      const partyId = g.party_id || "general";
      const partyName = (g.parties as any)?.name || "Cliente General / Traslado";
      const taxId = (g.parties as any)?.tax_id || null;

      if (!clientStatsMap[partyId]) {
        clientStatsMap[partyId] = {
          party_name: partyName,
          tax_id: taxId,
          total: 0,
          otifCount: 0,
          lateCount: 0,
          incompleteCount: 0,
          totalTransitHours: 0,
          deliveredCount: 0,
        };
      }

      clientStatsMap[partyId].total += 1;

      // Sumar unidades pickeadas para el indicador de costo
      for (const line of (g as any).dispatch_note_lines || []) {
        if (line.picked) totalPickedUnitsInPeriod += Number(line.qty) || 0;
      }

      // Evaluar On-Time: arrival_at dentro de 24h de departure_at
      let isOnTime = false;
      if (g.departure_at && g.arrival_at) {
        const depTime = new Date(g.departure_at).getTime();
        const arrTime = new Date(g.arrival_at).getTime();
        const diffMs = arrTime - depTime;
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours >= 0 && diffHours <= 24) {
          isOnTime = true;
        }

        if (diffHours >= 0) {
          clientStatsMap[partyId].totalTransitHours += diffHours;
          clientStatsMap[partyId].deliveredCount += 1;
        }
      }

      // Evaluar In-Full: todas sus líneas packed=true
      const lines = (g as any).dispatch_note_lines || [];
      const isInFull = lines.length > 0 && lines.every((l: any) => l.packed === true);

      // Una guía es elegible para OTIF si ya salió o tiene registro de despacho
      if (g.departure_at) {
        eligibleDispatches += 1;
        if (isOnTime) onTimeOnlyCount += 1;
        if (isInFull) inFullOnlyCount += 1;

        if (isOnTime && isInFull) {
          otifSuccessCount += 1;
          clientStatsMap[partyId].otifCount += 1;
        } else {
          if (!isOnTime && g.arrival_at) {
            clientStatsMap[partyId].lateCount += 1;
          }
          if (!isInFull) {
            clientStatsMap[partyId].incompleteCount += 1;
          }
        }
      }
    }

    const otifPercentage = eligibleDispatches > 0 ? Math.round((otifSuccessCount / eligibleDispatches) * 100) : 0;
    const onTimePercentage = eligibleDispatches > 0 ? Math.round((onTimeOnlyCount / eligibleDispatches) * 100) : 0;
    const inFullPercentage = eligibleDispatches > 0 ? Math.round((inFullOnlyCount / eligibleDispatches) * 100) : 0;

    return {
      totalDispatches: filteredDispatches.length,
      eligibleDispatches,
      otifSuccessCount,
      otifPercentage,
      onTimePercentage,
      inFullPercentage,
      totalPickedUnitsInPeriod,
      clientStats: Object.entries(clientStatsMap).map(([id, stats]) => ({
        party_id: id,
        ...stats,
        otifRate: stats.total > 0 ? Math.round((stats.otifCount / stats.total) * 100) : 0,
        avgTransitHours: stats.deliveredCount > 0 ? (stats.totalTransitHours / stats.deliveredCount).toFixed(1) : "—",
      })),
    };
  }, [filteredDispatches]);

  // Cálculo de Costo por Unidad Procesada
  const costPerUnitAnalysis = useMemo(() => {
    const costInputs = operationalCostQ.data ?? [];
    const totalCost = costInputs.reduce((acc, c) => acc + (Number(c.total_cost) || 0), 0);
    const totalUnits = otifAnalysis.totalPickedUnitsInPeriod;

    if (costInputs.length === 0) {
      return {
        hasCostData: false,
        totalCost: 0,
        totalUnits,
        costPerUnit: null,
      };
    }

    const costPerUnit = totalUnits > 0 ? Math.round(totalCost / totalUnits) : 0;
    return {
      hasCostData: true,
      totalCost,
      totalUnits,
      costPerUnit,
    };
  }, [operationalCostQ.data, otifAnalysis.totalPickedUnitsInPeriod]);

  // Cálculo de Ocupación de Bodegas
  const warehouseOccupancyAnalysis = useMemo(() => {
    const warehouses = warehousesQ.data ?? [];
    const balances = stockBalancesQ.data ?? [];

    const stats = warehouses.map((wh) => {
      // Sumar unidades físicas en esta bodega
      const whBalances = balances.filter((b) => b.warehouse_id === wh.id);
      const totalUnits = whBalances.reduce((sum, b) => sum + (Number(b.balance) || 0), 0);

      // Aproximación volumétrica estándar: 1 pallet estándar = 50 unidades ≈ 1.5 m³
      const estimatedPallets = totalUnits > 0 ? Math.ceil(totalUnits / 50) : 0;
      const estimatedM3 = Number((estimatedPallets * 1.5).toFixed(1));

      const capacityM3 = wh.capacity_m3 ? Number(wh.capacity_m3) : null;
      const occupancyRate = capacityM3 && capacityM3 > 0 ? Math.min(100, Math.round((estimatedM3 / capacityM3) * 100)) : null;

      return {
        ...wh,
        totalUnits,
        estimatedPallets,
        estimatedM3,
        capacityM3,
        occupancyRate,
      };
    });

    const definedWarehouses = stats.filter((w) => w.capacityM3 !== null && w.capacityM3 > 0);
    const totalCapacity = definedWarehouses.reduce((sum, w) => sum + (w.capacityM3 || 0), 0);
    const totalUsedM3 = definedWarehouses.reduce((sum, w) => sum + w.estimatedM3, 0);
    const globalOccupancy = totalCapacity > 0 ? Math.min(100, Math.round((totalUsedM3 / totalCapacity) * 100)) : null;

    return {
      warehouses: stats,
      hasConfiguredCapacity: definedWarehouses.length > 0,
      globalOccupancy,
      totalCapacity,
      totalUsedM3,
    };
  }, [warehousesQ.data, stockBalancesQ.data]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Encabezado y Navegación */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dispatch">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Operaciones 3PL
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              Dashboard BI & KPIs Operacionales 3PL
            </h1>
            <p className="text-xs text-muted-foreground">
              Supervisión de calidad de servicio logístico (OTIF), cumplimiento de SLA, costos unitarios y capacidad física.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCostModalOpen(true)}
            className="text-xs gap-1.5 h-8 font-medium"
          >
            <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
            Cargar Costo Operativo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["dispatches_period_kpis"] });
              qc.invalidateQueries({ queryKey: ["sla_alerts_kpis"] });
              qc.invalidateQueries({ queryKey: ["operational_costs_kpis"] });
              qc.invalidateQueries({ queryKey: ["warehouses_3pl_kpis"] });
              qc.invalidateQueries({ queryKey: ["stock_balances_capacity_kpis"] });
              toast.success("Métricas actualizadas");
            }}
            className="h-8 w-8 p-0"
            title="Refrescar datos"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Barra de Filtros Globales */}
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl border bg-card/60 backdrop-blur-sm shadow-sm text-xs">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="period_start" className="text-muted-foreground font-normal">
            Desde:
          </Label>
          <Input
            id="period_start"
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="h-8 w-36 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Label htmlFor="period_end" className="text-muted-foreground font-normal">
            Hasta:
          </Label>
          <Input
            id="period_end"
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="h-8 w-36 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Label htmlFor="sla_threshold" className="text-muted-foreground font-normal flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Alerta SLA:
          </Label>
          <Input
            id="sla_threshold"
            type="number"
            min="1"
            max="30"
            value={slaDaysThreshold}
            onChange={(e) => setSlaDaysThreshold(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="h-8 w-16 text-xs font-mono"
          />
          <span className="text-muted-foreground">días</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Label className="text-muted-foreground font-normal">Cliente:</Label>
          <Select value={selectedPartyFilter} onValueChange={setSelectedPartyFilter}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los clientes</SelectItem>
              {(partiesQ.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5">
          <Label className="text-muted-foreground font-normal">Bodega:</Label>
          <Select value={selectedWarehouseFilter} onValueChange={setSelectedWarehouseFilter}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas las bodegas</SelectItem>
              {(warehousesQ.data ?? []).map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.code} - {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tarjetas KPI Superiores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: OTIF General */}
        <Card className="border bg-card/60 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>Nivel de Servicio OTIF</span>
              <Badge variant="outline" className="text-[10px] font-mono">
                {otifAnalysis.otifSuccessCount}/{otifAnalysis.eligibleDispatches} guías
              </Badge>
            </CardDescription>
            <CardTitle className="text-3xl font-extrabold flex items-center justify-between">
              <span
                className={
                  otifAnalysis.otifPercentage >= 90
                    ? "text-emerald-600 dark:text-emerald-400"
                    : otifAnalysis.otifPercentage >= 75
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-rose-600 dark:text-rose-400"
                }
              >
                {otifAnalysis.eligibleDispatches > 0 ? `${otifAnalysis.otifPercentage}%` : "—"}
              </span>
              <Percent className="h-5 w-5 text-muted-foreground/50" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
            {otifAnalysis.eligibleDispatches > 0 ? (
              <div className="space-y-1 mt-1">
                <div className="flex justify-between">
                  <span>A tiempo (≤ 24h tránsito):</span>
                  <span className="font-semibold text-foreground">{otifAnalysis.onTimePercentage}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Completo (100% embalado):</span>
                  <span className="font-semibold text-foreground">{otifAnalysis.inFullPercentage}%</span>
                </div>
              </div>
            ) : (
              <span>Sin guías despachadas con fecha en el período.</span>
            )}
          </CardContent>
        </Card>

        {/* KPI 2: Alertas de SLA */}
        <Card className="border bg-card/60 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>Cuellos de Botella SLA</span>
              <Badge
                variant="outline"
                className={
                  (slaAlertDispatchesQ.data ?? []).length > 0
                    ? "text-rose-600 border-rose-500/30 bg-rose-500/10 text-[10px]"
                    : "text-emerald-600 border-emerald-500/30 bg-emerald-500/10 text-[10px]"
                }
              >
                &gt; {slaDaysThreshold} días
              </Badge>
            </CardDescription>
            <CardTitle className="text-3xl font-extrabold flex items-center justify-between">
              <span
                className={
                  (slaAlertDispatchesQ.data ?? []).length > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }
              >
                {(slaAlertDispatchesQ.data ?? []).length}
              </span>
              <AlertTriangle
                className={`h-5 w-5 ${
                  (slaAlertDispatchesQ.data ?? []).length > 0 ? "text-rose-500" : "text-emerald-500"
                }`}
              />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
            {(slaAlertDispatchesQ.data ?? []).length > 0 ? (
              <span>Guías en borrador con picking pendiente retrasado.</span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Flujo de preparación al día sin atrasos.
              </span>
            )}
          </CardContent>
        </Card>

        {/* KPI 3: Costo por Unidad Procesada */}
        <Card className="border bg-card/60 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>Costo por Unidad Procesada</span>
              <DollarSign className="h-4 w-4 text-muted-foreground/50" />
            </CardDescription>
            <CardTitle className="text-3xl font-extrabold flex items-center justify-between">
              {costPerUnitAnalysis.hasCostData ? (
                <span className="text-blue-600 dark:text-blue-400 font-mono">
                  ${costPerUnitAnalysis.costPerUnit?.toLocaleString("es-CL")}
                </span>
              ) : (
                <span className="text-muted-foreground text-sm font-normal">Sin costo cargado</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
            {costPerUnitAnalysis.hasCostData ? (
              <div className="space-y-0.5">
                <div className="flex justify-between">
                  <span>Costo operativo:</span>
                  <span className="font-mono text-foreground">${costPerUnitAnalysis.totalCost.toLocaleString("es-CL")}</span>
                </div>
                <div className="flex justify-between">
                  <span>Unidades preparadas:</span>
                  <span className="font-mono text-foreground">{costPerUnitAnalysis.totalUnits.toLocaleString("es-CL")} un.</span>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs p-0 text-primary underline"
                onClick={() => setIsCostModalOpen(true)}
              >
                + Cargar costo operativo del mes
              </Button>
            )}
          </CardContent>
        </Card>

        {/* KPI 4: Ocupación de Bodega */}
        <Card className="border bg-card/60 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>Ocupación Global de Bodegas</span>
              <Warehouse className="h-4 w-4 text-muted-foreground/50" />
            </CardDescription>
            <CardTitle className="text-3xl font-extrabold flex items-center justify-between">
              {warehouseOccupancyAnalysis.hasConfiguredCapacity ? (
                <span
                  className={
                    (warehouseOccupancyAnalysis.globalOccupancy || 0) > 90
                      ? "text-rose-600"
                      : (warehouseOccupancyAnalysis.globalOccupancy || 0) > 75
                      ? "text-amber-600"
                      : "text-emerald-600"
                  }
                >
                  {warehouseOccupancyAnalysis.globalOccupancy}%
                </span>
              ) : (
                <span className="text-muted-foreground text-sm font-normal">Sin m³ configurados</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
            {warehouseOccupancyAnalysis.hasConfiguredCapacity ? (
              <div className="space-y-1 mt-1">
                <Progress value={warehouseOccupancyAnalysis.globalOccupancy || 0} className="h-1.5" />
                <div className="flex justify-between text-[10px]">
                  <span>{warehouseOccupancyAnalysis.totalUsedM3.toLocaleString("es-CL")} m³ usados</span>
                  <span>{warehouseOccupancyAnalysis.totalCapacity.toLocaleString("es-CL")} m³ totales</span>
                </div>
              </div>
            ) : (
              <span>Configure la capacidad en m³ en la pestaña "Capacidad de Bodegas".</span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pestañas de Análisis Detallado */}
      <Tabs defaultValue="otif" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto gap-1">
          <TabsTrigger value="otif" className="text-xs gap-1.5 py-2">
            <Percent className="h-4 w-4" />
            OTIF por Cliente 3PL
          </TabsTrigger>
          <TabsTrigger value="sla" className="text-xs gap-1.5 py-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Alertas SLA ({ (slaAlertDispatchesQ.data ?? []).length })
          </TabsTrigger>
          <TabsTrigger value="occupancy" className="text-xs gap-1.5 py-2">
            <Warehouse className="h-4 w-4" />
            Capacidad de Bodegas
          </TabsTrigger>
          <TabsTrigger value="costs" className="text-xs gap-1.5 py-2">
            <DollarSign className="h-4 w-4" />
            Costos Operativos
          </TabsTrigger>
        </TabsList>

        {/* PESTAÑA 1: OTIF POR CLIENTE */}
        <TabsContent value="otif" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Rendimiento de Entregas y OTIF por Cliente
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Mide el porcentaje de órdenes que cumplieron entrega a tiempo (≤ 24h tras salida) y empaque completo (100% unidades embaladas).
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {dispatchesQ.isLoading ? (
                <p className="text-xs text-muted-foreground py-6 text-center">Calculando indicadores OTIF...</p>
              ) : otifAnalysis.clientStats.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">
                  No se registraron guías de despacho en el rango de fechas seleccionado.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente 3PL</TableHead>
                      <TableHead className="text-center">Guías Despachadas</TableHead>
                      <TableHead className="text-center">Cumplieron OTIF</TableHead>
                      <TableHead className="text-center">Retrasadas (&gt;24h)</TableHead>
                      <TableHead className="text-center">Incompletas</TableHead>
                      <TableHead className="text-center">Tránsito Promedio</TableHead>
                      <TableHead className="text-right">% OTIF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {otifAnalysis.clientStats.map((stat) => (
                      <TableRow key={stat.party_id}>
                        <TableCell>
                          <div className="font-semibold text-xs text-foreground">{stat.party_name}</div>
                          {stat.tax_id && <div className="text-[10px] text-muted-foreground font-mono">{stat.tax_id}</div>}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs">{stat.total}</TableCell>
                        <TableCell className="text-center font-mono text-xs text-emerald-600 font-bold">
                          {stat.otifCount}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs text-amber-600">
                          {stat.lateCount}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs text-rose-600">
                          {stat.incompleteCount}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs text-muted-foreground">
                          {stat.avgTransitHours !== "—" ? `${stat.avgTransitHours} hrs` : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            className={`font-mono text-xs ${
                              stat.otifRate >= 90
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                : stat.otifRate >= 75
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
                            }`}
                          >
                            {stat.otifRate}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PESTAÑA 2: ALERTAS DE SLA */}
        <TabsContent value="sla" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Guías de Despacho en Alerta de SLA (&gt; {slaDaysThreshold} días en borrador)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Órdenes retenidas que exceden el tiempo máximo de preparación en bodega sin confirmación de picking.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {slaAlertDispatchesQ.isLoading ? (
                <p className="text-xs text-muted-foreground py-6 text-center">Buscando alertas de SLA...</p>
              ) : (slaAlertDispatchesQ.data ?? []).length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                  <p className="text-sm font-medium">No hay guías en riesgo de incumplimiento de SLA.</p>
                  <p className="text-xs text-muted-foreground">
                    Todas las guías pendientes de preparación tienen menos de {slaDaysThreshold} días desde su creación.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° Guía</TableHead>
                      <TableHead>Cliente 3PL</TableHead>
                      <TableHead>Bodega</TableHead>
                      <TableHead>Fecha Creación</TableHead>
                      <TableHead className="text-center">Días en Espera</TableHead>
                      <TableHead>Avance Picking</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(slaAlertDispatchesQ.data ?? []).map((guide: any) => {
                      const lines = guide.dispatch_note_lines || [];
                      const pickedLines = lines.filter((l: any) => l.picked).length;
                      const totalLines = lines.length;
                      const progressPct = totalLines > 0 ? Math.round((pickedLines / totalLines) * 100) : 0;

                      const createdDate = new Date(guide.created_at);
                      const now = new Date();
                      const daysWaiting = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

                      return (
                        <TableRow key={guide.id} className="bg-rose-500/[0.03]">
                          <TableCell className="font-mono text-xs font-semibold">
                            {guide.dispatch_number ? `#${guide.dispatch_number}` : `ID ${guide.id.slice(0, 8)}`}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-xs text-foreground">
                              {(guide.parties as any)?.name || "—"}
                            </div>
                            {(guide.parties as any)?.tax_id && (
                              <div className="text-[10px] text-muted-foreground font-mono">
                                {(guide.parties as any).tax_id}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {(guide.warehouses as any)?.code} - {(guide.warehouses as any)?.name}
                          </TableCell>
                          <TableCell className="text-xs">
                            {createdDate.toLocaleDateString("es-CL", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="destructive" className="text-xs font-mono font-bold">
                              {daysWaiting} días
                            </Badge>
                          </TableCell>
                          <TableCell className="w-48">
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>
                                  {pickedLines} de {totalLines} líneas
                                </span>
                                <span className="font-mono">{progressPct}%</span>
                              </div>
                              <Progress value={progressPct} className="h-1.5" />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" asChild className="h-7 text-xs gap-1">
                              <Link to="/dispatch">
                                Gestionar <ExternalLink className="h-3 w-3" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PESTAÑA 3: CAPACIDAD Y OCUPACIÓN DE BODEGAS */}
        <TabsContent value="occupancy" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Ocupación Volumétrica y Capacidad Máxima (m³)</h3>
              <p className="text-xs text-muted-foreground">
                Estimación de ocupación de rack y piso basada en saldos en custodia versus la capacidad cúbica de cada bodega.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {warehouseOccupancyAnalysis.warehouses.map((wh) => (
              <Card key={wh.id} className="border shadow-sm flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs font-mono">
                      {wh.code}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 text-primary"
                      onClick={() => {
                        setEditingWarehouse(wh);
                        setWarehouseCapacityInput(wh.capacity_m3 ? String(wh.capacity_m3) : "");
                      }}
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      {wh.capacity_m3 ? "Editar m³" : "Configurar m³"}
                    </Button>
                  </div>
                  <CardTitle className="text-base mt-1">{wh.name}</CardTitle>
                  <CardDescription className="text-xs">
                    {wh.capacity_m3
                      ? `Capacidad máxima: ${Number(wh.capacity_m3).toLocaleString("es-CL")} m³`
                      : "Capacidad no definida aún"}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-2 p-2.5 bg-muted/40 rounded-lg">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Unidades en Custodia</span>
                      <span className="font-mono font-bold text-sm">{wh.totalUnits.toLocaleString("es-CL")}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Pallets Estimados</span>
                      <span className="font-mono font-bold text-sm">~{wh.estimatedPallets} pos.</span>
                    </div>
                  </div>

                  {wh.capacity_m3 ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Nivel de ocupación:</span>
                        <span
                          className={`font-mono font-bold ${
                            (wh.occupancyRate || 0) > 90
                              ? "text-rose-600"
                              : (wh.occupancyRate || 0) > 75
                              ? "text-amber-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {wh.occupancyRate}%
                        </span>
                      </div>
                      <Progress
                        value={wh.occupancyRate || 0}
                        className={`h-2 ${
                          (wh.occupancyRate || 0) > 90
                            ? "[&>div]:bg-rose-500"
                            : (wh.occupancyRate || 0) > 75
                            ? "[&>div]:bg-amber-500"
                            : "[&>div]:bg-emerald-500"
                        }`}
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{wh.estimatedM3.toLocaleString("es-CL")} m³ ocupados</span>
                        <span>{Number(wh.capacity_m3).toLocaleString("es-CL")} m³ disponibles</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-700 dark:text-amber-300 text-[11px]">
                      Haga clic en <strong>"Configurar m³"</strong> para ingresar la capacidad volumétrica y habilitar la métrica de ocupación.
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* PESTAÑA 4: HISTORIAL DE COSTOS OPERATIVOS */}
        <TabsContent value="costs" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    Insumos de Costos Operativos de Bodega
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Registro de costos operacionales mensuales para contrastar contra el volumen de picking procesado.
                  </CardDescription>
                </div>
                <Button size="sm" onClick={() => setIsCostModalOpen(true)} className="gap-1 text-xs h-8">
                  <Plus className="h-3.5 w-3.5" />
                  Nuevo Costo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {operationalCostQ.isLoading ? (
                <p className="text-xs text-muted-foreground py-6 text-center">Cargando costos operativos...</p>
              ) : (operationalCostQ.data ?? []).length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <p className="text-sm font-medium">No se han registrado costos operativos para este período.</p>
                  <p className="text-xs text-muted-foreground">
                    Cargue el gasto operativo mensual consolidado para obtener el costo promedio por unidad procesada.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => setIsCostModalOpen(true)} className="mt-2 text-xs">
                    Ingresar Costo de Bodega
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período Desde</TableHead>
                      <TableHead>Período Hasta</TableHead>
                      <TableHead className="text-right">Costo Total ($ CLP)</TableHead>
                      <TableHead>Notas / Detalle</TableHead>
                      <TableHead>Fecha Registro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(operationalCostQ.data ?? []).map((cost: any) => (
                      <TableRow key={cost.id}>
                        <TableCell className="text-xs font-mono">{cost.period_start}</TableCell>
                        <TableCell className="text-xs font-mono">{cost.period_end}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-xs">
                          ${Number(cost.total_cost).toLocaleString("es-CL")}
                        </TableCell>
                        <TableCell className="text-xs max-w-xs truncate">{cost.notes || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(cost.created_at).toLocaleDateString("es-CL")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIÁLOGO: CARGAR COSTO OPERATIVO */}
      <Dialog open={isCostModalOpen} onOpenChange={setIsCostModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              Ingresar Costo Operativo Mensual
            </DialogTitle>
            <DialogDescription className="text-xs">
              Monto total de costos operativos de bodega para calcular el costo por unidad procesada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-xs py-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="c_start" className="text-xs">
                  Fecha Inicio
                </Label>
                <Input
                  id="c_start"
                  type="date"
                  value={costPeriodStart}
                  onChange={(e) => setCostPeriodStart(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="c_end" className="text-xs">
                  Fecha Término
                </Label>
                <Input
                  id="c_end"
                  type="date"
                  value={costPeriodEnd}
                  onChange={(e) => setCostPeriodEnd(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="c_amount" className="text-xs">
                Costo Operativo Total ($ CLP)
              </Label>
              <Input
                id="c_amount"
                type="number"
                min="1"
                step="1"
                value={costAmount || ""}
                onChange={(e) => setCostAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                placeholder="Ej: 3500000"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="c_notes" className="text-xs">
                Notas / Glosa (opcional)
              </Label>
              <Input
                id="c_notes"
                type="text"
                value={costNotes}
                onChange={(e) => setCostNotes(e.target.value)}
                placeholder="Ej: Sueldos de operarios, arriendo nave central, insumos embalaje"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsCostModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => saveOperationalCostM.mutate()}
              disabled={saveOperationalCostM.isPending || costAmount <= 0}
            >
              {saveOperationalCostM.isPending ? "Guardando..." : "Guardar Costo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO: CONFIGURAR CAPACIDAD EN M3 DE BODEGA */}
      <Dialog open={!!editingWarehouse} onOpenChange={(open) => !open && setEditingWarehouse(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Warehouse className="h-5 w-5 text-primary" />
              Capacidad Volumétrica de Bodega
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure la capacidad máxima en metros cúbicos para <strong>{editingWarehouse?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1">
              <Label htmlFor="wh_cap" className="text-xs">
                Capacidad Máxima (m³)
              </Label>
              <Input
                id="wh_cap"
                type="number"
                min="1"
                step="0.1"
                value={warehouseCapacityInput}
                onChange={(e) => setWarehouseCapacityInput(e.target.value)}
                placeholder="Ej: 1200"
                className="h-8 text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Deje en blanco si desconoce la capacidad física de esta nave.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setEditingWarehouse(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => updateWarehouseCapacityM.mutate()}
              disabled={updateWarehouseCapacityM.isPending}
            >
              {updateWarehouseCapacityM.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
