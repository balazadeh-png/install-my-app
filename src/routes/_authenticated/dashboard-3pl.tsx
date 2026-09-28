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
  Coins,
  AlertCircle,
  ArrowUpDown,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard-3pl")({
  head: () => ({
    meta: [
      { title: "Dashboard BI y KPIs 3PL (Operacionales y Comerciales) — EasyERP" },
      {
        name: "description",
        content:
          "Indicadores clave de rendimiento logístico y rentabilidad comercial 3PL: OTIF (On-Time In-Full), alertas de SLA, costo por unidad procesada, ocupación volumétrica y rentabilidad por cliente.",
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
  const [profitabilitySortBy, setProfitabilitySortBy] = useState<"revenue" | "margin">("revenue");

  // Estado para Modal de Costo Operativo
  const [isCostModalOpen, setIsCostModalOpen] = useState(false);
  const [costPeriodStart, setCostPeriodStart] = useState(periodStart);
  const [costPeriodEnd, setCostPeriodEnd] = useState(periodEnd);
  const [costAmount, setCostAmount] = useState<number>(0);
  const [costNotes, setCostNotes] = useState("");

  // Estado para Modal de Medición de Bodega (Sprint 30)
  const [editingWarehouse, setEditingWarehouse] = useState<{
    id: string;
    name: string;
    capacity_m3: number | null;
    storage_measure_method?: string;
    storage_measure_basis?: string;
    default_units_per_pallet?: number | null;
    storage_capacity?: number | null;
  } | null>(null);
  const [whMethod, setWhMethod] = useState<string>("manual");
  const [whBasis, setWhBasis] = useState<string>("period_end");
  const [whDefaultUpp, setWhDefaultUpp] = useState<string>("");
  const [whStorageCapacity, setWhStorageCapacity] = useState<string>("");
  const [whCapacityM3, setWhCapacityM3] = useState<string>("");

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

  // 2. Bodegas activas con atributos de medición (Sprint 30)
  const warehousesQ = useQuery({
    queryKey: ["warehouses_3pl_kpis", activeEntityId],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("id, code, name, is_active, capacity_m3, storage_measure_method, storage_measure_basis, default_units_per_pallet, storage_capacity")
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

  // 6. Saldos actuales en bodega para cálculo de ocupación (Sprint 29: usa qty_on_hand real)
  const stockBalancesQ = useQuery({
    queryKey: ["stock_balances_capacity_kpis", activeEntityId],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_balances" as any)
        .select("warehouse_id, item_id, qty_on_hand, party_id");
      if (error) throw error;
      return (data ?? []) as Array<{ warehouse_id: string; item_id: string; qty_on_hand: number; party_id: string | null }>;
    },
  });

  // 6.1 Mediciones de almacenaje calculadas por bodega (Sprint 30)
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const storageUsageQ = useQuery({
    queryKey: ["warehouses_storage_usage", activeEntityId, partiesQ.data, todayStr],
    enabled: !!activeEntityId && !!partiesQ.data?.length,
    queryFn: async () => {
      const parties = partiesQ.data ?? [];
      const allUsage: Array<{
        warehouse_id: string;
        warehouse_name: string;
        method: string;
        basis: string;
        quantity: number | null;
        unit: string;
        rate_type: string | null;
        missing_data: number;
      }> = [];

      for (const p of parties) {
        const { data, error } = await supabase.rpc("get_storage_usage", {
          p_entity_id: activeEntityId!,
          p_party_id: p.id,
          p_period_start: todayStr,
          p_period_end: todayStr,
        });
        if (error) {
          console.warn("Error consultando get_storage_usage para cliente:", p.id, error);
          continue;
        }
        if (data) {
          allUsage.push(...(data as any[]));
        }
      }
      return allUsage;
    },
  });

  // 7. Facturas de venta en el período para cálculo de rentabilidad real por cliente
  const salesInvoicesPeriodQ = useQuery({
    queryKey: ["sales_invoices_period_profitability", activeEntityId, periodStart, periodEnd],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_invoices")
        .select("id, party_id, invoice_number, issue_date, subtotal_amount, total_amount, status, memo, adjustment_of_invoice_id")
        .eq("entity_id", activeEntityId!)
        .gte("issue_date", periodStart)
        .lte("issue_date", periodEnd)
        .neq("status", "cancelled");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Mutación: Guardar Costo Operativo
  const saveOperationalCostM = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Entidad activa requerida");
      if (costAmount <= 0) throw new Error("El costo debe ser mayor a 0");
      if (costPeriodEnd! < costPeriodStart!) throw new Error("La fecha de fin debe ser posterior a la de inicio");

      const { error } = await supabase.from("operational_cost_inputs").insert({
        entity_id: activeEntityId,
        period_start: costPeriodStart!,
        period_end: costPeriodEnd!,
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

  // Modal de edición de medición de bodega (Sprint 30)
  const openEditWarehouseModal = (wh: any) => {
    setEditingWarehouse(wh);
    setWhMethod(wh.storage_measure_method || "manual");
    setWhBasis(wh.storage_measure_basis || "period_end");
    setWhDefaultUpp(wh.default_units_per_pallet ? String(wh.default_units_per_pallet) : "");
    setWhStorageCapacity(wh.storage_capacity ? String(wh.storage_capacity) : "");
    setWhCapacityM3(wh.capacity_m3 ? String(wh.capacity_m3) : "");
  };

  // Mutación: Guardar Configuración de Medición de Bodega (Sprint 30)
  const updateWarehouseMeasurementM = useMutation({
    mutationFn: async () => {
      if (!editingWarehouse) return;
      const parsedUpp = whDefaultUpp.trim() ? parseFloat(whDefaultUpp) : null;
      if (parsedUpp !== null && (isNaN(parsedUpp) || parsedUpp <= 0)) {
        throw new Error("Las unidades por pallet por defecto deben ser un número positivo (> 0)");
      }

      const parsedCap = whStorageCapacity.trim() ? parseFloat(whStorageCapacity) : null;
      if (parsedCap !== null && (isNaN(parsedCap) || parsedCap < 0)) {
        throw new Error("La capacidad de almacenamiento debe ser mayor o igual a 0");
      }

      const parsedCapM3 = whCapacityM3.trim() ? parseFloat(whCapacityM3) : null;
      if (parsedCapM3 !== null && (isNaN(parsedCapM3) || parsedCapM3 < 0)) {
        throw new Error("La capacidad en m³ debe ser un número positivo (>= 0)");
      }

      const { error } = await supabase
        .from("warehouses")
        .update({
          storage_measure_method: whMethod,
          storage_measure_basis: whBasis,
          default_units_per_pallet: parsedUpp,
          storage_capacity: parsedCap,
          capacity_m3: parsedCapM3,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingWarehouse.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuración de medición de bodega actualizada");
      setEditingWarehouse(null);
      qc.invalidateQueries({ queryKey: ["warehouses_3pl_kpis"] });
      qc.invalidateQueries({ queryKey: ["warehouses_storage_usage"] });
    },
    onError: (err: any) => toast.error(err.message || "Error al actualizar medición"),
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

  // Cálculo de Ocupación de Bodegas (Sprint 29 / 30: sin factores inventados, medición por bodega)
  const warehouseOccupancyAnalysis = useMemo(() => {
    const warehouses = warehousesQ.data ?? [];
    const balances = stockBalancesQ.data ?? [];
    const usageRows = storageUsageQ.data ?? [];

    const METHOD_LABELS: Record<string, string> = {
      manual: "Manual",
      pallet_positions: "Posiciones de Pallet",
      units_per_pallet: "Pallets Calculados",
      area_m2: "Área en m²",
      volume_m3: "Volumen en m³",
      units: "Unidades",
    };

    const stats = warehouses.map((wh) => {
      // Sumar unidades físicas reales en esta bodega (qty_on_hand)
      const whBalances = balances.filter((b) => b.warehouse_id === wh.id);
      const totalUnits = whBalances.reduce((sum, b) => sum + (Number(b.qty_on_hand) || 0), 0);

      const method = (wh as any).storage_measure_method || "manual";
      const basis = (wh as any).storage_measure_basis || "period_end";
      const storageCapacity = (wh as any).storage_capacity ? Number((wh as any).storage_capacity) : null;
      const capacityM3 = wh.capacity_m3 ? Number(wh.capacity_m3) : null;

      // Medición obtenida de get_storage_usage para esta bodega
      const matchingUsage = usageRows.filter((u) => u.warehouse_id === wh.id);
      const measuredQty = matchingUsage.reduce((sum, u) => sum + (Number(u.quantity) || 0), 0);
      const totalMissingData = matchingUsage.reduce((sum, u) => sum + (Number(u.missing_data) || 0), 0);

      const unitName =
        matchingUsage[0]?.unit ||
        (method === "volume_m3" ? "m³" : method === "area_m2" ? "m²" : method === "units" ? "unidades" : "pallets");

      let occupancyRate: number | null = null;
      let statusExplanation: string = "";

      if (method === "manual") {
        statusExplanation = "Requiere definir el método de medición de la bodega (Sprint 30)";
      } else if (!storageCapacity || storageCapacity <= 0) {
        statusExplanation = `Capacidad en ${unitName} no configurada`;
      } else {
        occupancyRate = Math.min(100, Math.round((measuredQty / storageCapacity) * 100));
      }

      return {
        ...wh,
        totalUnits,
        method,
        methodLabel: METHOD_LABELS[method] || method,
        basis,
        storageCapacity,
        capacityM3,
        measuredQty,
        unitName,
        occupancyRate,
        statusExplanation,
        missingData: totalMissingData,
      };
    });

    const activeOccupancies = stats.filter((w) => w.occupancyRate !== null);
    const globalOccupancy =
      activeOccupancies.length > 0
        ? Math.round(activeOccupancies.reduce((acc, w) => acc + (w.occupancyRate || 0), 0) / activeOccupancies.length)
        : null;

    return {
      warehouses: stats,
      hasConfiguredCapacity: stats.some((w) => w.storageCapacity !== null && w.storageCapacity > 0),
      globalOccupancy,
    };
  }, [warehousesQ.data, stockBalancesQ.data, storageUsageQ.data]);

  // Sprint 28: Cálculo de Rentabilidad por Cliente 3PL
  // Combina facturación real (sales_invoices) con asignación proporcional de costos operativos
  const profitabilityAnalysis = useMemo(() => {
    const parties = partiesQ.data ?? [];
    const invoices = salesInvoicesPeriodQ.data ?? [];
    const dispatches = dispatchesQ.data ?? [];
    const balances = stockBalancesQ.data ?? [];
    const costInputs = operationalCostQ.data ?? [];

    const totalOperationalCost = costInputs.reduce((sum, c) => sum + (Number(c.total_cost) || 0), 0);
    const hasCostData = costInputs.length > 0 && totalOperationalCost > 0;

    // Recopilar actividad por cliente
    const clientActivity: Record<string, { pickedQty: number; custodyUnits: number; revenue: number }> = {};

    for (const p of parties) {
      clientActivity[p.id] = { pickedQty: 0, custodyUnits: 0, revenue: 0 };
    }

    // 1. Ingreso Facturado (sales_invoices en el período)
    for (const inv of invoices) {
      if (!clientActivity[inv.party_id]) {
        clientActivity[inv.party_id] = { pickedQty: 0, custodyUnits: 0, revenue: 0 };
      }
      clientActivity[inv.party_id].revenue += Number(inv.subtotal_amount) || 0;
    }

    // 2. Unidades pickeadas en el período
    for (const g of dispatches) {
      const pId = g.party_id;
      if (!pId) continue;
      if (!clientActivity[pId]) {
        clientActivity[pId] = { pickedQty: 0, custodyUnits: 0, revenue: 0 };
      }
      for (const l of (g as any).dispatch_note_lines || []) {
        if (l.picked) clientActivity[pId].pickedQty += Number(l.qty) || 0;
      }
    }

    // 3. Saldo en custodia actual (Sprint 29: usa qty_on_hand)
    for (const b of balances) {
      const pId = b.party_id;
      if (!pId) continue;
      if (!clientActivity[pId]) {
        clientActivity[pId] = { pickedQty: 0, custodyUnits: 0, revenue: 0 };
      }
      clientActivity[pId].custodyUnits += Number(b.qty_on_hand) || 0;
    }

    // 4. Calcular ponderación de actividad:
    // Ponderador = Unidades pickeadas + (Unidades en custodia * 0.5)
    let totalActivityPoints = 0;
    const clientRows = parties.map((p) => {
      const act = clientActivity[p.id] || { pickedQty: 0, custodyUnits: 0, revenue: 0 };
      const activityPoints = act.pickedQty + (act.custodyUnits * 0.5);
      totalActivityPoints += activityPoints;
      return {
        party_id: p.id,
        party_name: p.name,
        tax_id: p.tax_id,
        revenue: act.revenue,
        pickedQty: act.pickedQty,
        custodyUnits: act.custodyUnits,
        activityPoints,
      };
    });

    // 5. Asignar costo proporcional y margen
    const clientResults = clientRows.map((c) => {
      const activityShare = totalActivityPoints > 0 ? (c.activityPoints / totalActivityPoints) : 0;
      const estimatedCost = hasCostData ? Math.round(totalOperationalCost * activityShare) : null;
      const estimatedMargin = hasCostData && estimatedCost !== null ? c.revenue - estimatedCost : null;
      const marginPct = hasCostData && estimatedMargin !== null && c.revenue > 0 ? Math.round((estimatedMargin / c.revenue) * 100) : null;

      return {
        ...c,
        activitySharePct: Math.round(activityShare * 100),
        estimatedCost,
        estimatedMargin,
        marginPct,
      };
    });

    // Ordenar según criterio
    clientResults.sort((a, b) => {
      if (profitabilitySortBy === "margin" && hasCostData) {
        return (b.estimatedMargin || 0) - (a.estimatedMargin || 0);
      }
      return b.revenue - a.revenue;
    });

    const totalRevenue = clientResults.reduce((sum, c) => sum + c.revenue, 0);
    const totalEstimatedMargin = hasCostData ? totalRevenue - totalOperationalCost : null;
    const overallMarginPct = hasCostData && totalRevenue > 0 && totalEstimatedMargin !== null ? Math.round((totalEstimatedMargin / totalRevenue) * 100) : null;

    return {
      hasCostData,
      totalRevenue,
      totalOperationalCost,
      totalEstimatedMargin,
      overallMarginPct,
      clients: clientResults,
    };
  }, [partiesQ.data, salesInvoicesPeriodQ.data, dispatchesQ.data, stockBalancesQ.data, operationalCostQ.data, profitabilitySortBy]);

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
      <Tabs defaultValue="profitability" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 h-auto gap-1">
          <TabsTrigger value="profitability" className="text-xs gap-1.5 py-2">
            <Coins className="h-4 w-4 text-emerald-500" />
            Rentabilidad por Cliente
          </TabsTrigger>
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

        {/* PESTAÑA: RENTABILIDAD POR CLIENTE (SPRINT 28) */}
        <TabsContent value="profitability" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Coins className="h-4 w-4 text-emerald-600" />
                    Rentabilidad y Margen Estimado por Cliente 3PL
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Ingresos reales facturados (sales_invoices) contrastados con la cuota proporcional de costos operativos según actividad física (picking y custodia).
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Ordenar por:</span>
                  <Select
                    value={profitabilitySortBy}
                    onValueChange={(v: "revenue" | "margin") => setProfitabilitySortBy(v)}
                  >
                    <SelectTrigger className="h-8 text-xs w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="revenue">Mayor Facturación ($)</SelectItem>
                      <SelectItem value="margin" disabled={!profitabilityAnalysis.hasCostData}>
                        Mayor Margen ($) {!profitabilityAnalysis.hasCostData ? "(Requiere costos)" : ""}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tarjetas resumen de rentabilidad */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-muted/30 rounded-xl border text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Facturación Total Neta (3PL)</span>
                  <span className="text-xl font-bold font-mono text-foreground">
                    ${profitabilityAnalysis.totalRevenue.toLocaleString("es-CL")}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Gasto Operacional Asignado</span>
                  {profitabilityAnalysis.hasCostData ? (
                    <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
                      ${profitabilityAnalysis.totalOperationalCost.toLocaleString("es-CL")}
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-muted-foreground italic">Sin costos cargados</span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Margen Operativo Estimado</span>
                  {profitabilityAnalysis.hasCostData && profitabilityAnalysis.totalEstimatedMargin !== null ? (
                    <div className="flex items-baseline gap-2">
                      <span
                        className={`text-xl font-bold font-mono ${
                          profitabilityAnalysis.totalEstimatedMargin >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        ${profitabilityAnalysis.totalEstimatedMargin.toLocaleString("es-CL")}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono ${
                          (profitabilityAnalysis.overallMarginPct || 0) >= 20
                            ? "text-emerald-600 border-emerald-500/30"
                            : (profitabilityAnalysis.overallMarginPct || 0) >= 0
                            ? "text-amber-600 border-amber-500/30"
                            : "text-rose-600 border-rose-500/30"
                        }`}
                      >
                        {profitabilityAnalysis.overallMarginPct}%
                      </Badge>
                    </div>
                  ) : (
                    <span className="text-sm font-medium text-muted-foreground italic">Pendiente de costos</span>
                  )}
                </div>
              </div>

              {/* Banner informativo si no hay costos cargados */}
              {!profitabilityAnalysis.hasCostData && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">Cálculo de margen pendiente</p>
                    <p className="text-[11px] opacity-90">
                      Actualmente se muestra la facturación neta real de cada cliente. Para desbloquear la estimación de costo por cliente y margen de contribución, ingrese los costos del período en la pestaña <strong>"Costos Operativos"</strong>.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCostModalOpen(true)}
                      className="h-6 text-[11px] gap-1 mt-1 bg-background text-foreground"
                    >
                      <Plus className="h-3 w-3" /> Cargar Costo Operativo
                    </Button>
                  </div>
                </div>
              )}

              {/* Tabla de Rentabilidad */}
              {salesInvoicesPeriodQ.isLoading ? (
                <p className="text-xs text-muted-foreground py-6 text-center">Calculando rentabilidad por cliente...</p>
              ) : profitabilityAnalysis.clients.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">No hay clientes 3PL registrados en el sistema.</p>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20">
                        <TableHead>Cliente 3PL</TableHead>
                        <TableHead className="text-right">Facturación Neta (Real)</TableHead>
                        <TableHead className="text-center">Cuota Actividad WMS</TableHead>
                        <TableHead className="text-right">
                          {profitabilityAnalysis.hasCostData ? "Costo Asignado (Estimado*)" : "Costo Asignado"}
                        </TableHead>
                        <TableHead className="text-right">Margen Estimado</TableHead>
                        <TableHead className="text-center">% Margen</TableHead>
                        <TableHead className="text-right">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profitabilityAnalysis.clients.map((c) => {
                        const hasRevenue = c.revenue > 0;
                        const isProfitable = (c.estimatedMargin || 0) > 0;
                        return (
                          <TableRow key={c.party_id}>
                            <TableCell>
                              <div className="font-semibold text-xs text-foreground">{c.party_name}</div>
                              {c.tax_id && <div className="text-[10px] text-muted-foreground font-mono">{c.tax_id}</div>}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-semibold">
                              ${c.revenue.toLocaleString("es-CL")}
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs text-muted-foreground">
                              <span>{c.activitySharePct}%</span>
                              <span className="block text-[10px] text-muted-foreground/70">
                                {c.pickedQty} pk / {c.custodyUnits} bal
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {profitabilityAnalysis.hasCostData && c.estimatedCost !== null ? (
                                <span className="text-amber-600 dark:text-amber-400">
                                  ${c.estimatedCost.toLocaleString("es-CL")}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-[11px] italic">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-bold">
                              {profitabilityAnalysis.hasCostData && c.estimatedMargin !== null ? (
                                <span
                                  className={
                                    c.estimatedMargin >= 0
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-rose-600 dark:text-rose-400"
                                  }
                                >
                                  ${c.estimatedMargin.toLocaleString("es-CL")}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-[11px] italic">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs">
                              {profitabilityAnalysis.hasCostData && c.marginPct !== null ? (
                                <Badge
                                  className={`text-[10px] font-mono ${
                                    c.marginPct >= 25
                                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                      : c.marginPct >= 10
                                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                      : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
                                  }`}
                                >
                                  {c.marginPct}%
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-[11px] italic">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {profitabilityAnalysis.hasCostData ? (
                                hasRevenue && isProfitable ? (
                                  <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 bg-emerald-500/10 text-[10px]">
                                    Rentable
                                  </Badge>
                                ) : hasRevenue ? (
                                  <Badge variant="outline" className="text-rose-600 border-rose-500/30 bg-rose-500/10 text-[10px]">
                                    En Pérdida
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-[10px]">
                                    Sin Facturación
                                  </Badge>
                                )
                              ) : (
                                <Badge variant="secondary" className="text-[10px]">
                                  {hasRevenue ? "Facturado" : "Sin Movimiento"}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground italic pt-1">
                * El costo por cliente corresponde a una asignación proporcional de gestión calculada sobre el total de costos operativos declarados y ponderada por la actividad física en bodega (unidades pickeadas y saldos en custodia). No constituye un costeo contable formal por absorción ni reemplaza la contabilidad analítica.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

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

        {/* PESTAÑA 3: CAPACIDAD Y OCUPACIÓN DE BODEGAS (Sprint 29 / 30) */}
        <TabsContent value="occupancy" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Medición de Almacenaje y Capacidad de Bodegas</h3>
              <p className="text-xs text-muted-foreground">
                Ocupación física calculada según el método configurado en cada bodega (sin factores inventados ni conversiones globales).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {warehouseOccupancyAnalysis.warehouses.map((wh: any) => (
              <Card key={wh.id} className="border shadow-sm flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs font-mono">
                      {wh.code}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 text-primary hover:bg-primary/10"
                      onClick={() => openEditWarehouseModal(wh)}
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      Configurar medición
                    </Button>
                  </div>
                  <CardTitle className="text-base mt-1">{wh.name}</CardTitle>
                  <CardDescription className="text-xs flex items-center gap-1.5 flex-wrap">
                    <span>Método:</span>
                    <Badge variant="secondary" className="text-[10px] font-medium">
                      {wh.methodLabel}
                    </Badge>
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-2 p-2.5 bg-muted/40 rounded-lg">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Unidades en Custodia</span>
                      <span className="font-mono font-bold text-sm">{wh.totalUnits.toLocaleString("es-CL")} un.</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Base Temporal</span>
                      <span className="font-mono text-xs font-medium capitalize">
                        {wh.basis === "period_end" ? "Cierre" : wh.basis === "daily_average" ? "Promedio" : "Pico"}
                      </span>
                    </div>
                  </div>

                  {wh.occupancyRate !== null ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Nivel de ocupación ({wh.unitName}):</span>
                        <span
                          className={`font-mono font-bold ${
                            wh.occupancyRate > 90
                              ? "text-rose-600"
                              : wh.occupancyRate > 75
                              ? "text-amber-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {wh.occupancyRate}%
                        </span>
                      </div>
                      <Progress
                        value={wh.occupancyRate}
                        className={`h-2 ${
                          wh.occupancyRate > 90
                            ? "[&>div]:bg-rose-500"
                            : wh.occupancyRate > 75
                            ? "[&>div]:bg-amber-500"
                            : "[&>div]:bg-emerald-500"
                        }`}
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{wh.measuredQty.toLocaleString("es-CL")} {wh.unitName} ocupados</span>
                        <span>{Number(wh.storageCapacity).toLocaleString("es-CL")} {wh.unitName} capacidad</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-muted/40 border rounded-lg text-muted-foreground text-[11px] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">Ocupación:</span>
                        <span className="font-mono font-bold text-sm">—</span>
                      </div>
                      <p className="text-[10px] opacity-80">{wh.statusExplanation}</p>
                    </div>
                  )}

                  {wh.missingData > 0 && (
                    <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0" /> {wh.missingData} registro(s) sin ubicación o sin atributos volumétricos
                    </p>
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

      {/* DIÁLOGO: CONFIGURAR MEDICIÓN DE BODEGA (Sprint 30) */}
      <Dialog open={!!editingWarehouse} onOpenChange={(open) => !open && setEditingWarehouse(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Warehouse className="h-5 w-5 text-primary" />
              Configurar Medición de Bodega
            </DialogTitle>
            <DialogDescription className="text-xs">
              Defina cómo mide su almacenaje <strong>{editingWarehouse?.name}</strong> para facturación y control de ocupación.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            {/* 1. Método de Medición */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Método de Medición *</Label>
              <Select
                value={whMethod}
                onValueChange={(val) => {
                  setWhMethod(val);
                  if (val === "volume_m3" && !whStorageCapacity && whCapacityM3) {
                    setWhStorageCapacity(whCapacityM3);
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual (Ingreso manual al facturar)</SelectItem>
                  <SelectItem value="pallet_positions">Posiciones de Pallet (Ubicaciones WMS)</SelectItem>
                  <SelectItem value="units_per_pallet">Pallets Calculados (Unidades por Pallet)</SelectItem>
                  <SelectItem value="area_m2">Área en m² (Superficie ocupada)</SelectItem>
                  <SelectItem value="volume_m3">Volumen en m³ (Volumen unitario por ítem)</SelectItem>
                  <SelectItem value="units">Unidades físicas totales</SelectItem>
                </SelectContent>
              </Select>

              {/* Ayuda contextual por método */}
              <div className="p-2.5 rounded-md bg-muted/50 border text-[11px] text-muted-foreground mt-1">
                {whMethod === "manual" && (
                  <p>
                    <strong>Manual:</strong> La cantidad se ingresa manualmente al facturar. La ocupación en panel se reporta como "—".
                  </p>
                )}
                {whMethod === "pallet_positions" && (
                  <p>
                    <strong>Posiciones de Pallet:</strong> Cuenta las posiciones físicas ocupadas. Requiere que las ubicaciones tengan <code>pallet_positions</code> y que el stock esté asignado a ubicación.
                  </p>
                )}
                {whMethod === "units_per_pallet" && (
                  <p>
                    <strong>Pallets Calculados:</strong> Aplica <code>⌈saldo ÷ unidades_por_pallet⌉</code> por ítem. Requiere <code>units_per_pallet</code> en artículos o valor por defecto de bodega.
                  </p>
                )}
                {whMethod === "area_m2" && (
                  <p>
                    <strong>Área m²:</strong> Suma los metros cuadrados de las ubicaciones ocupadas. Requiere <code>area_m2</code> en ubicaciones y stock con ubicación.
                  </p>
                )}
                {whMethod === "volume_m3" && (
                  <p>
                    <strong>Volumen m³:</strong> Suma <code>saldo × unit_volume_m3</code> de cada producto. Requiere <code>unit_volume_m3</code> en catálogo de artículos.
                  </p>
                )}
                {whMethod === "units" && (
                  <p>
                    <strong>Unidades:</strong> Suma directa de las unidades físicas en custodia de la bodega.
                  </p>
                )}
              </div>
            </div>

            {/* 2. Base Temporal */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Base Temporal de Medición *</Label>
              <Select value={whBasis} onValueChange={setWhBasis}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="period_end">Saldo al cierre del período (Por defecto)</SelectItem>
                  <SelectItem value="daily_average">Promedio de los saldos diarios</SelectItem>
                  <SelectItem value="daily_peak">Máximo diario del período</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 3. Unidades por pallet por defecto (si aplica) */}
            {whMethod === "units_per_pallet" && (
              <div className="space-y-1">
                <Label htmlFor="wh_upp" className="text-xs font-semibold">
                  Unidades por Pallet por Defecto de la Bodega
                </Label>
                <Input
                  id="wh_upp"
                  type="number"
                  min="1"
                  step="1"
                  value={whDefaultUpp}
                  onChange={(e) => setWhDefaultUpp(e.target.value)}
                  placeholder="ej. 48"
                  className="h-8 text-xs font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Se usa cuando el artículo no tiene especificado su propio <code>units_per_pallet</code>.
                </p>
              </div>
            )}

            {/* 4. Capacidad de Almacenamiento en la unidad del método */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="wh_store_cap" className="text-xs font-semibold">
                  Capacidad de Almacenamiento ({whMethod === "volume_m3" ? "m³" : whMethod === "area_m2" ? "m²" : whMethod === "units" ? "unidades" : "pallets"})
                </Label>
                {whMethod === "volume_m3" && whCapacityM3 && whStorageCapacity !== whCapacityM3 && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-[10px] text-primary"
                    onClick={() => setWhStorageCapacity(whCapacityM3)}
                  >
                    Usar {whCapacityM3} m³
                  </Button>
                )}
              </div>
              <Input
                id="wh_store_cap"
                type="number"
                min="0"
                step="0.1"
                value={whStorageCapacity}
                onChange={(e) => setWhStorageCapacity(e.target.value)}
                placeholder="ej. 500"
                className="h-8 text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Capacidad máxima para calcular el porcentaje de ocupación real en el dashboard.
              </p>
            </div>

            {/* 5. Capacidad m3 heredada */}
            <div className="space-y-1 pt-1 border-t">
              <Label htmlFor="wh_cap_legacy" className="text-xs text-muted-foreground">
                Capacidad Volumétrica m³ (campo heredado)
              </Label>
              <Input
                id="wh_cap_legacy"
                type="number"
                min="0"
                step="0.1"
                value={whCapacityM3}
                onChange={(e) => setWhCapacityM3(e.target.value)}
                placeholder="ej. 1200"
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setEditingWarehouse(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => updateWarehouseMeasurementM.mutate()}
              disabled={updateWarehouseMeasurementM.isPending}
            >
              {updateWarehouseMeasurementM.isPending ? "Guardando..." : "Guardar Configuración"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
