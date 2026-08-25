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
  Factory,
  Plus,
  ArrowLeft,
  RefreshCw,
  Layers,
  CheckCircle2,
  Package,
  Boxes,
  Trash2,
  Sparkles,
  ArrowRightLeft,
  CheckCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/production")({
  component: ProductionPage,
  head: () => ({
    meta: [
      { title: "Producción & Recetas BOM | EasyERP" },
      { name: "description", content: "Órdenes de producción, recetas/fórmulas BOM y costeo real de materiales." },
    ],
  }),
});

function ProductionPage() {
  const queryClient = useQueryClient();
  const { activeEntity, activeEntityId } = useActiveEntity();

  const [newBomOpen, setNewBomOpen] = useState(false);
  const [newOrderOpen, setNewOrderOpen] = useState(false);

  // Form State BOM
  const [bomName, setBomName] = useState("");
  const [bomItemId, setBomItemId] = useState("");
  const [bomOutputQty, setBomOutputQty] = useState("1");
  const [bomNotes, setBomNotes] = useState("");
  const [bomComponents, setBomComponents] = useState<Array<{ component_item_id: string; qty_required: string }>>([
    { component_item_id: "", qty_required: "1" },
  ]);

  // Form State Production Order
  const [orderNumber, setOrderNumber] = useState(`OP-${Date.now().toString().slice(-6)}`);
  const [orderBomId, setOrderBomId] = useState("");
  const [orderQty, setOrderQty] = useState("1");
  const [orderSourceWarehouseId, setOrderSourceWarehouseId] = useState("");
  const [orderTargetWarehouseId, setOrderTargetWarehouseId] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [orderCostCenterId, setOrderCostCenterId] = useState("");
  const [orderBusinessUnitId, setOrderBusinessUnitId] = useState("");

  const baseCurrency = activeEntity?.base_currency_code || "CLP";

  // Queries
  const itemsQuery = useQuery({
    queryKey: ["items", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("entity_id", activeEntityId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeEntityId,
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("warehouses")
        .select("*")
        .eq("entity_id", activeEntityId)
        .eq("is_active", true)
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
        .eq("is_group", false)
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
        .eq("is_group", false)
        .order("code");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeEntityId,
  });

  const bomsQuery = useQuery({
    queryKey: ["bill_of_materials", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("bill_of_materials" as any)
        .select(`
          *,
          finished_item:item_id(sku, name),
          bom_lines(id, component_item_id, qty_required, component_item:component_item_id(sku, name))
        `)
        .eq("entity_id", activeEntityId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!activeEntityId,
  });

  const productionOrdersQuery = useQuery({
    queryKey: ["production_orders", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("production_orders" as any)
        .select(`
          *,
          finished_item:item_id(sku, name),
          bom:bom_id(name),
          source_warehouse:source_warehouse_id(name),
          target_warehouse:target_warehouse_id(name)
        `)
        .eq("entity_id", activeEntityId)
        .order("planned_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!activeEntityId,
  });

  const items = itemsQuery.data ?? [];
  const warehouses = warehousesQuery.data ?? [];
  const costCenters = costCentersQuery.data ?? [];
  const businessUnits = businessUnitsQuery.data ?? [];
  const boms = bomsQuery.data ?? [];
  const orders = productionOrdersQuery.data ?? [];

  // Mutations
  const createBomMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Selecciona una empresa primero");
      const outQty = parseFloat(bomOutputQty || "1");
      if (!bomName.trim()) throw new Error("Ingrese nombre de la receta / BOM");
      if (!bomItemId) throw new Error("Seleccione el producto terminado");
      if (isNaN(outQty) || outQty <= 0) throw new Error("El rendimiento base debe ser mayor a 0");

      const validLines = bomComponents.filter((c) => c.component_item_id && parseFloat(c.qty_required) > 0);
      if (validLines.length === 0) throw new Error("Agregue al menos un insumo o componente");

      // 1. Crear cabecera BOM
      const { data: newBom, error: bomErr } = await supabase
        .from("bill_of_materials" as any)
        .insert({
          entity_id: activeEntityId,
          name: bomName.trim(),
          item_id: bomItemId,
          output_qty: outQty,
          notes: bomNotes.trim() || null,
          is_active: true,
        })
        .select()
        .single();

      if (bomErr) throw bomErr;

      // 2. Crear líneas de componentes
      const linesToInsert = validLines.map((l) => ({
        bom_id: newBom.id,
        component_item_id: l.component_item_id,
        qty_required: parseFloat(l.qty_required),
      }));

      const { error: linesErr } = await supabase.from("bom_lines" as any).insert(linesToInsert);
      if (linesErr) throw linesErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bill_of_materials", activeEntityId] });
      toast.success("Fórmula / Receta (BOM) registrada correctamente");
      setNewBomOpen(false);
      setBomName("");
      setBomItemId("");
      setBomOutputQty("1");
      setBomNotes("");
      setBomComponents([{ component_item_id: "", qty_required: "1" }]);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al crear fórmula BOM");
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Selecciona una empresa primero");
      const qty = parseFloat(orderQty || "1");
      if (!orderBomId) throw new Error("Seleccione una receta BOM");
      if (!orderSourceWarehouseId || !orderTargetWarehouseId) throw new Error("Seleccione ambas bodegas (origen y destino)");
      if (isNaN(qty) || qty <= 0) throw new Error("La cantidad planificada debe ser mayor a 0");

      const selectedBom = boms.find((b) => b.id === orderBomId);
      if (!selectedBom) throw new Error("BOM no encontrado");

      const { error } = await supabase.from("production_orders" as any).insert({
        entity_id: activeEntityId,
        order_number: orderNumber.trim().toUpperCase(),
        bom_id: orderBomId,
        item_id: selectedBom.item_id,
        qty_planned: qty,
        source_warehouse_id: orderSourceWarehouseId,
        target_warehouse_id: orderTargetWarehouseId,
        cost_center_id: orderCostCenterId || null,
        business_unit_id: orderBusinessUnitId || null,
        planned_date: orderDate,
        status: "planned",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production_orders", activeEntityId] });
      toast.success("Orden de producción creada");
      setNewOrderOpen(false);
      setOrderNumber(`OP-${Date.now().toString().slice(-6)}`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al crear orden de producción");
    },
  });

  const completeOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.rpc("complete_production_order", {
        _order_id: orderId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["production_orders", activeEntityId] });
      queryClient.invalidateQueries({ queryKey: ["stock_balances", activeEntityId] });
      queryClient.invalidateQueries({ queryKey: ["stock_ledger", activeEntityId] });
      toast.success(`Producción completada con éxito: ${res?.qty_produced} unidades fabricadas a un costo unitario real de $ ${Number(res?.unit_cost || 0).toLocaleString("es-CL")}`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al procesar orden de producción");
    },
  });

  const completedOrders = orders.filter((o) => o.status === "completed");
  const totalProducedUnits = completedOrders.reduce((s, o) => s + Number(o.qty_produced || 0), 0);
  const totalProductionCost = completedOrders.reduce((s, o) => s + Number(o.total_cost || 0), 0);

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
            productionOrdersQuery.refetch();
            bomsQuery.refetch();
            itemsQuery.refetch();
            warehousesQuery.refetch();
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
              <Factory className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Producción & Fórmulas (BOM)</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión de recetas de producción, consumo FIFO de materias primas e ingreso de productos terminados valorizados.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Dialog Nueva Receta BOM */}
          <Dialog open={newBomOpen} onOpenChange={setNewBomOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Boxes className="mr-1.5 h-3.5 w-3.5" />
                Nueva Receta (BOM)
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Crear Fórmula de Producción (BOM)</DialogTitle>
                <DialogDescription>
                  Define el producto terminado y las proporciones de materias primas necesarias.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-3 border-b">
                <div>
                  <Label className="text-xs font-semibold">Nombre de la Receta *</Label>
                  <Input
                    placeholder="ej. Ensamble Básico Mesa de Oficina"
                    value={bomName}
                    onChange={(e) => setBomName(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold">Producto Terminado a Fabricar *</Label>
                    <Select value={bomItemId} onValueChange={setBomItemId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Seleccione producto" />
                      </SelectTrigger>
                      <SelectContent>
                        {items.map((it) => (
                          <SelectItem key={it.id} value={it.id}>
                            {it.sku} - {it.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Rendimiento Base (Cantidad Producida) *</Label>
                    <Input
                      type="number"
                      step="any"
                      value={bomOutputQty}
                      onChange={(e) => setBomOutputQty(e.target.value)}
                      className="mt-1 font-mono"
                    />
                  </div>
                </div>

                {/* Componentes */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Insumos / Componentes Necesarios
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setBomComponents([...bomComponents, { component_item_id: "", qty_required: "1" }])}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Agregar Insumo
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {bomComponents.map((comp, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="flex-1">
                          <Select
                            value={comp.component_item_id}
                            onValueChange={(val) => {
                              const updated = [...bomComponents];
                              updated[idx].component_item_id = val;
                              setBomComponents(updated);
                            }}
                          >
                            <SelectTrigger className="text-xs">
                              <SelectValue placeholder="Seleccionar insumo / materia prima" />
                            </SelectTrigger>
                            <SelectContent>
                              {items.map((it) => (
                                <SelectItem key={it.id} value={it.id}>
                                  {it.sku} - {it.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-32">
                          <Input
                            type="number"
                            step="any"
                            placeholder="Cantidad"
                            value={comp.qty_required}
                            onChange={(e) => {
                              const updated = [...bomComponents];
                              updated[idx].qty_required = e.target.value;
                              setBomComponents(updated);
                            }}
                            className="text-xs font-mono"
                          />
                        </div>
                        {bomComponents.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive"
                            onClick={() => setBomComponents(bomComponents.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createBomMutation.mutate()}
                  disabled={createBomMutation.isPending || !bomName || !bomItemId}
                >
                  Guardar Fórmula BOM
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Dialog Nueva Orden de Producción */}
          <Dialog open={newOrderOpen} onOpenChange={setNewOrderOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Nueva Orden de Producción
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Lanzar Orden de Producción</DialogTitle>
                <DialogDescription>
                  Selecciona la receta a ejecutar, las bodegas involucradas y la cantidad a fabricar.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-3">
                <div>
                  <Label className="text-xs font-semibold">N° Orden *</Label>
                  <Input
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    className="mt-1 font-mono uppercase"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Fecha Programada *</Label>
                  <Input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs font-semibold">Fórmula / Receta (BOM) *</Label>
                  <Select value={orderBomId} onValueChange={setOrderBomId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Seleccione fórmula de fabricación" />
                    </SelectTrigger>
                    <SelectContent>
                      {boms.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name} (Produce {b.output_qty} {b.finished_item?.name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Cantidad a Fabricar *</Label>
                  <Input
                    type="number"
                    step="any"
                    value={orderQty}
                    onChange={(e) => setOrderQty(e.target.value)}
                    className="mt-1 font-mono"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Bodega Origen (Insumos) *</Label>
                  <Select value={orderSourceWarehouseId} onValueChange={setOrderSourceWarehouseId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Bodega de materiales" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.code} - {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs font-semibold">Bodega Destino (Producto Terminado) *</Label>
                  <Select value={orderTargetWarehouseId} onValueChange={setOrderTargetWarehouseId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Bodega de destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.code} - {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Centro de Costo</Label>
                  <Select value={orderCostCenterId} onValueChange={setOrderCostCenterId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sin centro de costo</SelectItem>
                      {costCenters.map((cc) => (
                        <SelectItem key={cc.id} value={cc.id}>
                          {cc.code} - {cc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Sucursal / Unidad</Label>
                  <Select value={orderBusinessUnitId} onValueChange={setOrderBusinessUnitId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sin sucursal</SelectItem>
                      {businessUnits.map((bu) => (
                        <SelectItem key={bu.id} value={bu.id}>
                          {bu.code} - {bu.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createOrderMutation.mutate()}
                  disabled={createOrderMutation.isPending || !orderBomId || !orderSourceWarehouseId || !orderTargetWarehouseId}
                >
                  Guardar Orden Planificada
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Órdenes Completadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {completedOrders.length} / {orders.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Lotes procesados exitosamente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Unidades Producidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {totalProducedUnits.toLocaleString("es-CL")} u.
            </div>
            <p className="text-xs text-muted-foreground mt-1">Rendimiento acumulado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Costo Total Materiales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-primary">
              $ {totalProductionCost.toLocaleString("es-CL")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Costo real FIFO consumido ({baseCurrency})</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList>
          <TabsTrigger value="orders" className="flex items-center gap-1.5">
            <Factory className="h-4 w-4" />
            <span>Órdenes de Producción ({orders.length})</span>
          </TabsTrigger>
          <TabsTrigger value="boms" className="flex items-center gap-1.5">
            <Boxes className="h-4 w-4" />
            <span>Fórmulas / Recetas BOM ({boms.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab Órdenes */}
        <TabsContent value="orders">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Órdenes de Producción</CardTitle>
              <CardDescription>
                Ejecución de lotes con rebaja de materias primas e ingreso de stock terminado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Factory className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No hay órdenes de producción registradas.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setNewOrderOpen(true)}
                  >
                    Crear primera orden
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">N° Orden</TableHead>
                        <TableHead>Producto Terminado</TableHead>
                        <TableHead>Receta (BOM)</TableHead>
                        <TableHead className="text-right">Planificado</TableHead>
                        <TableHead className="text-right">Producido</TableHead>
                        <TableHead>Bodegas (Origen $\rightarrow$ Destino)</TableHead>
                        <TableHead className="text-right">Costo Unitario Real</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                        <TableHead className="text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((o) => {
                        const isCompleted = o.status === "completed";
                        const isPlanned = o.status === "planned" || o.status === "in_progress";

                        return (
                          <TableRow key={o.id}>
                            <TableCell className="font-mono font-bold text-xs text-primary">
                              {o.order_number}
                            </TableCell>
                            <TableCell className="text-xs font-semibold">
                              {o.finished_item?.name}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {o.bom?.name}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {Number(o.qty_planned).toLocaleString("es-CL")}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-bold">
                              {Number(o.qty_produced || 0).toLocaleString("es-CL")}
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="flex items-center gap-1 font-mono text-[11px]">
                                <span>{o.source_warehouse?.name}</span>
                                <span>&rarr;</span>
                                <span className="font-bold text-foreground">{o.target_warehouse?.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              {o.unit_cost ? `$ ${Number(o.unit_cost).toLocaleString("es-CL")}` : "-"}
                            </TableCell>
                            <TableCell className="text-center">
                              {isCompleted ? (
                                <Badge className="bg-emerald-600 text-white text-[11px] gap-1">
                                  <CheckCircle className="h-3 w-3" /> Completada
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[11px] border-blue-500 text-blue-600">
                                  Planificada
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {isPlanned && (
                                <Button
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    if (confirm(`¿Procesar orden ${o.order_number}? Se consumirán los materiales de ${o.source_warehouse?.name} y se ingresará el producto a ${o.target_warehouse?.name}.`)) {
                                      completeOrderMutation.mutate(o.id);
                                    }
                                  }}
                                  disabled={completeOrderMutation.isPending}
                                >
                                  Completar
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab BOMs */}
        <TabsContent value="boms">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Listas de Materiales / Fórmulas (BOM)</CardTitle>
              <CardDescription>
                Estructura de componentes e insumos para la fabricación de productos terminados.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {boms.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <p className="text-sm">No hay recetas de producción configuradas.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {boms.map((b) => (
                    <Card key={b.id} className="border shadow-none">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-bold">{b.name}</CardTitle>
                          <Badge variant="outline" className="text-xs">
                            Rendimiento: {b.output_qty} u.
                          </Badge>
                        </div>
                        <CardDescription className="text-xs">
                          Producto Terminado: <strong className="text-foreground">{b.finished_item?.name}</strong> ({b.finished_item?.sku})
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-2">
                        <div className="text-xs font-semibold text-muted-foreground mb-2">
                          Componentes Requeridos:
                        </div>
                        <div className="space-y-1.5 border rounded p-2 bg-muted/20">
                          {b.bom_lines?.map((line: any) => (
                            <div key={line.id} className="flex justify-between items-center text-xs">
                              <span>&bull; {line.component_item?.name}</span>
                              <span className="font-mono font-bold text-foreground">
                                {Number(line.qty_required).toLocaleString("es-CL")} u.
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
