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
  Package,
  Plus,
  ArrowLeft,
  RefreshCw,
  Warehouse,
  ArrowRightLeft,
  ListOrdered,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  Building2,
  Truck,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: InventoryPage,
  head: () => ({
    meta: [
      { title: "Inventario & Multibodega | EasyERP" },
      { name: "description", content: "Movimientos de stock, traslados entre bodegas, existencias y Kardex FIFO." },
    ],
  }),
});

function InventoryPage() {
  const queryClient = useQueryClient();
  const { activeEntity, activeEntityId } = useActiveEntity();

  const [newItemOpen, setNewItemOpen] = useState(false);
  const [newWarehouseOpen, setNewWarehouseOpen] = useState(false);
  const [newMovementOpen, setNewMovementOpen] = useState(false);
  const [newTransferOpen, setNewTransferOpen] = useState(false);

  // Form State Item
  const [itemCode, setItemCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemCategory, setItemCategory] = useState("");
  const [itemUom, setItemUom] = useState("");
  const [isStockItem, setIsStockItem] = useState(true);

  // Form State Warehouse
  const [warehouseCode, setWarehouseCode] = useState("");
  const [warehouseName, setWarehouseName] = useState("");

  // Form State Movimiento Individual (Entrada / Salida / Ajuste)
  const [movType, setMovType] = useState<"receipt" | "issue" | "adjustment">("receipt");
  const [movItemId, setMovItemId] = useState("");
  const [movWarehouseId, setMovWarehouseId] = useState("");
  const [movQty, setMovQty] = useState("");
  const [movRate, setMovRate] = useState("");
  const [movDate, setMovDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [movMemo, setMovMemo] = useState("");

  // Form State Traslado entre Bodegas
  const [trItem, setTrItem] = useState("");
  const [trFromWh, setTrFromWh] = useState("");
  const [trToWh, setTrToWh] = useState("");
  const [trQty, setTrQty] = useState("");
  const [trDate, setTrDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [trMemo, setTrMemo] = useState("");

  // Filtros de vista
  const [filterWarehouse, setFilterWarehouse] = useState<string>("ALL");
  const [filterParty, setFilterParty] = useState<string>("ALL");
  const [movPartyId, setMovPartyId] = useState<string>("NONE");

  const baseCurrency = activeEntity?.base_currency_code || "CLP";

  // Query: Items
  const itemsQuery = useQuery({
    queryKey: ["items", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("items")
        .select("*, item_categories(name), uom(code, name)")
        .eq("entity_id", activeEntityId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeEntityId,
  });

  // Query: Categories
  const categoriesQuery = useQuery({
    queryKey: ["item_categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("item_categories").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Query: UOM
  const uomQuery = useQuery({
    queryKey: ["uom"],
    queryFn: async () => {
      const { data, error } = await supabase.from("uom").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Query: Warehouses
  const warehousesQuery = useQuery({
    queryKey: ["warehouses", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("warehouses")
        .select("*")
        .eq("entity_id", activeEntityId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeEntityId,
  });

  // Query: Saldos por Bodega (stock_balances)
  const balancesQuery = useQuery({
    queryKey: ["stock_balances", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("stock_balances" as any)
        .select("*")
        .eq("entity_id", activeEntityId);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!activeEntityId,
  });

  // Query: Kardex / Movimientos (stock_ledger_entries)
  const movementsQuery = useQuery({
    queryKey: ["stock_ledger_entries", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("stock_ledger_entries" as any)
        .select("*, items(code, name), warehouses(code, name)")
        .eq("entity_id", activeEntityId)
        .order("posting_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!activeEntityId,
  });

  // Query: Clientes 3PL
  const parties3plQuery = useQuery({
    queryKey: ["parties_3pl", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("parties")
        .select("*")
        .eq("entity_id", activeEntityId)
        .eq("is_3pl_client", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeEntityId,
  });

  // Mutation: Crear Item
  const createItemMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Selecciona una empresa primero");
      const { error } = await supabase.from("items").insert({
        entity_id: activeEntityId,
        code: itemCode.trim().toUpperCase(),
        name: itemName.trim(),
        category_id: itemCategory || null,
        uom_id: itemUom || null,
        is_stock_item: isStockItem,
        valuation_method: "FIFO",
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items", activeEntityId] });
      toast.success("Artículo creado correctamente");
      setNewItemOpen(false);
      setItemCode("");
      setItemName("");
      setItemCategory("");
      setItemUom("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al crear artículo");
    },
  });

  // Mutation: Crear Bodega
  const createWarehouseMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Selecciona una empresa primero");
      const { error } = await supabase.from("warehouses").insert({
        entity_id: activeEntityId,
        code: warehouseCode.trim().toUpperCase(),
        name: warehouseName.trim(),
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses", activeEntityId] });
      toast.success("Bodega registrada exitosamente");
      setNewWarehouseOpen(false);
      setWarehouseCode("");
      setWarehouseName("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al registrar bodega");
    },
  });

  // Mutation: Registrar Movimiento Individual (Entrada / Salida / Ajuste)
  const createMovementMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Selecciona una empresa primero");
      if (!movItemId) throw new Error("Selecciona un artículo");
      if (!movWarehouseId) throw new Error("Selecciona una bodega");

      const qty = parseFloat(movQty);
      if (isNaN(qty) || qty <= 0) throw new Error("Ingresa una cantidad válida mayor a cero");

      const isExit = movType === "issue";
      const finalQty = isExit ? -qty : qty;
      const rate = parseFloat(movRate || "0");

      if (!isExit && (isNaN(rate) || rate <= 0)) {
        throw new Error("Las entradas requieren un costo unitario de valorización mayor a cero");
      }

      const { error } = await supabase.from("stock_ledger_entries" as any).insert({
        entity_id: activeEntityId,
        item_id: movItemId,
        warehouse_id: movWarehouseId,
        party_id: movPartyId && movPartyId !== "NONE" ? movPartyId : null,
        movement_type: movType,
        qty_change: finalQty,
        valuation_rate: isExit ? 0 : rate, // El trigger FIFO calcula el rate en salidas
        posting_date: movDate,
        memo: movMemo.trim() || `Movimiento de ${movType === "receipt" ? "Entrada" : movType === "issue" ? "Salida" : "Ajuste"}`,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock_ledger_entries", activeEntityId] });
      queryClient.invalidateQueries({ queryKey: ["stock_balances", activeEntityId] });
      toast.success("Movimiento de inventario procesado correctamente");
      setNewMovementOpen(false);
      setMovQty("");
      setMovRate("");
      setMovMemo("");
      setMovPartyId("NONE");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al procesar movimiento");
    },
  });

  // Mutation: Registrar Traslado entre Bodegas
  const createTransferMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Selecciona una empresa primero");
      if (!trItem) throw new Error("Selecciona un artículo");
      if (!trFromWh || !trToWh) throw new Error("Selecciona bodegas de origen y destino");
      if (trFromWh === trToWh) throw new Error("Las bodegas deben ser distintas");

      const qty = parseFloat(trQty);
      if (isNaN(qty) || qty <= 0) throw new Error("Ingresa una cantidad mayor a cero");

      const { data, error } = await supabase.rpc("create_warehouse_transfer", {
        _entity_id: activeEntityId,
        _item_id: trItem,
        _from_warehouse: trFromWh,
        _to_warehouse: trToWh,
        _qty: qty,
        _posting_date: trDate,
        _memo: trMemo.trim() || "Traslado entre bodegas",
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["stock_ledger_entries", activeEntityId] });
      queryClient.invalidateQueries({ queryKey: ["stock_balances", activeEntityId] });
      toast.success(`Traslado completado. Costo unitario FIFO transferido: $ ${Number(res?.valuation_rate || 0).toLocaleString("es-CL")}`);
      setNewTransferOpen(false);
      setTrQty("");
      setTrMemo("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al realizar traslado");
    },
  });

  const items = itemsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const uoms = uomQuery.data ?? [];
  const warehouses = warehousesQuery.data ?? [];
  const balances = balancesQuery.data ?? [];
  const movements = movementsQuery.data ?? [];
  const parties3pl = parties3plQuery.data ?? [];

  const filteredBalances = balances.filter((b) => {
    if (filterWarehouse !== "ALL" && b.warehouse_id !== filterWarehouse) return false;
    if (filterParty === "OWN" && b.party_id !== null) return false;
    if (filterParty !== "ALL" && filterParty !== "OWN" && b.party_id !== filterParty) return false;
    return true;
  });

  const totalStockQty = balances.reduce((sum, b) => sum + Number(b.qty_on_hand || 0), 0);
  const totalStockValue = balances.reduce((sum, b) => sum + Number(b.value_on_hand || 0), 0);

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
            itemsQuery.refetch();
            warehousesQuery.refetch();
            balancesQuery.refetch();
            movementsQuery.refetch();
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
              <Package className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Módulo de Inventario & Multibodega</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Control de existencias por bodega, movimientos de entrada/salida, traslados y Kardex valorizado bajo método FIFO.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Dialog Crear Artículo */}
          <Dialog open={newItemOpen} onOpenChange={setNewItemOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Nuevo Artículo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Artículo de Inventario</DialogTitle>
                <DialogDescription>
                  Crea un nuevo ítem en el catálogo de productos con método de valorización FIFO.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-3">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="iCode" className="text-right">Código / SKU</Label>
                  <Input
                    id="iCode"
                    placeholder="ej. PROD-001"
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value)}
                    className="col-span-3 font-mono"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="iName" className="text-right">Descripción</Label>
                  <Input
                    id="iName"
                    placeholder="ej. Notebook Dell Latitude 5420"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="iCat" className="text-right">Categoría</Label>
                  <Select value={itemCategory} onValueChange={setItemCategory}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Seleccione categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="iUom" className="text-right">Unidad (UOM)</Label>
                  <Select value={itemUom} onValueChange={setItemUom}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Seleccione unidad" />
                    </SelectTrigger>
                    <SelectContent>
                      {uoms.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.code} - {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Stockable</Label>
                  <div className="col-span-3 flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isStock"
                      checked={isStockItem}
                      onChange={(e) => setIsStockItem(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="isStock" className="text-xs text-muted-foreground">
                      Lleva control de inventario y capas FIFO
                    </label>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createItemMutation.mutate()}
                  disabled={createItemMutation.isPending || !itemCode || !itemName}
                >
                  Guardar Artículo
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Dialog Crear Bodega */}
          <Dialog open={newWarehouseOpen} onOpenChange={setNewWarehouseOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Warehouse className="mr-1.5 h-3.5 w-3.5" />
                Nueva Bodega
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Bodega / Almacén</DialogTitle>
                <DialogDescription>
                  Agrega una ubicación física para el almacenamiento de inventario.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-3">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="wCode" className="text-right">Código</Label>
                  <Input
                    id="wCode"
                    placeholder="ej. BOD-01"
                    value={warehouseCode}
                    onChange={(e) => setWarehouseCode(e.target.value)}
                    className="col-span-3 font-mono"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="wName" className="text-right">Nombre</Label>
                  <Input
                    id="wName"
                    placeholder="ej. Bodega Central Santiago"
                    value={warehouseName}
                    onChange={(e) => setWarehouseName(e.target.value)}
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createWarehouseMutation.mutate()}
                  disabled={createWarehouseMutation.isPending || !warehouseCode || !warehouseName}
                >
                  Guardar Bodega
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Dialog Traslado entre Bodegas */}
          <Dialog open={newTransferOpen} onOpenChange={setNewTransferOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" size="sm">
                <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5 text-primary" />
                Traslado entre Bodegas
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Traslado de Mercadería entre Bodegas</DialogTitle>
                <DialogDescription>
                  Mueve unidades entre bodegas preservando automáticamente el costo FIFO de origen.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-3">
                <div>
                  <Label className="text-xs">Artículo a Trasladar</Label>
                  <Select value={trItem} onValueChange={setTrItem}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Seleccionar producto" />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.code} - {i.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Bodega Origen (Salida)</Label>
                    <Select value={trFromWh} onValueChange={setTrFromWh}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Origen" />
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
                    <Label className="text-xs">Bodega Destino (Entrada)</Label>
                    <Select value={trToWh} onValueChange={setTrToWh}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Destino" />
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
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Cantidad</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="0"
                      value={trQty}
                      onChange={(e) => setTrQty(e.target.value)}
                      className="mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Fecha</Label>
                    <Input
                      type="date"
                      value={trDate}
                      onChange={(e) => setTrDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Glosa / Observación</Label>
                  <Input
                    placeholder="Motivo del traslado"
                    value={trMemo}
                    onChange={(e) => setTrMemo(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createTransferMutation.mutate()}
                  disabled={createTransferMutation.isPending || !trItem || !trFromWh || !trToWh || !trQty}
                >
                  {createTransferMutation.isPending ? "Procesando..." : "Ejecutar Traslado FIFO"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Dialog Registrar Movimiento (Entrada / Salida / Ajuste) */}
          <Dialog open={newMovementOpen} onOpenChange={setNewMovementOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Registrar Movimiento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Movimiento de Inventario</DialogTitle>
                <DialogDescription>
                  Ingreso de compras, salidas a consumo o ajustes de existencias.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-3">
                <div>
                  <Label className="text-xs">Tipo de Movimiento</Label>
                  <Select value={movType} onValueChange={(val: any) => setMovType(val)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receipt">Entrada / Recepción de Mercadería</SelectItem>
                      <SelectItem value="issue">Salida / Consumo de Materiales</SelectItem>
                      <SelectItem value="adjustment">Ajuste de Inventario (Entrada)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Artículo</Label>
                  <Select value={movItemId} onValueChange={setMovItemId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Seleccionar producto" />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.code} - {i.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Bodega</Label>
                  <Select value={movWarehouseId} onValueChange={setMovWarehouseId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Seleccionar bodega" />
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
                  <Label className="text-xs flex items-center justify-between">
                    <span>Propietario / Cliente 3PL (Custodia)</span>
                    <Badge variant="outline" className="text-[10px]">Opcional</Badge>
                  </Label>
                  <Select value={movPartyId} onValueChange={setMovPartyId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Propio de la empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Propio (Empresa - Uso Interno)</SelectItem>
                      {parties3pl.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          3PL: {p.name} {p.tax_id ? `(${p.tax_id})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Selecciona un cliente 3PL si la mercadería ingresa o sale en custodia de un tercero.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Cantidad</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="0"
                      value={movQty}
                      onChange={(e) => setMovQty(e.target.value)}
                      className="mt-1 font-mono"
                    />
                  </div>
                  {movType !== "issue" ? (
                    <div>
                      <Label className="text-xs">Costo Unitario ($ {baseCurrency})</Label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="ej. 1500"
                        value={movRate}
                        onChange={(e) => setMovRate(e.target.value)}
                        className="mt-1 font-mono"
                      />
                    </div>
                  ) : (
                    <div>
                      <Label className="text-xs text-muted-foreground">Costo Salida</Label>
                      <div className="mt-1 h-9 px-3 flex items-center rounded border bg-muted text-xs text-muted-foreground font-mono">
                        Cálculo FIFO Auto
                      </div>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Fecha</Label>
                    <Input
                      type="date"
                      value={movDate}
                      onChange={(e) => setMovDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Glosa / Concepto</Label>
                    <Input
                      placeholder="ej. Factura Compra #102"
                      value={movMemo}
                      onChange={(e) => setMovMemo(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createMovementMutation.mutate()}
                  disabled={createMovementMutation.isPending || !movItemId || !movWarehouseId || !movQty}
                >
                  {createMovementMutation.isPending ? "Guardando..." : "Registrar Movimiento"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Total Unidades en Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {totalStockQty.toLocaleString("es-CL")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Existencias globales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Valorización Total (FIFO)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              $ {totalStockValue.toLocaleString("es-CL")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Moneda base ({baseCurrency})</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Bodegas Activas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {warehouses.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ubicaciones de acopio</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Catálogo de Artículos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {items.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">SKUs registrados</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="balances" className="space-y-4">
        <TabsList>
          <TabsTrigger value="balances" className="flex items-center gap-1.5">
            <Boxes className="h-4 w-4" />
            <span>Saldos por Bodega ({balances.length})</span>
          </TabsTrigger>
          <TabsTrigger value="ledger" className="flex items-center gap-1.5">
            <ListOrdered className="h-4 w-4" />
            <span>Kardex / Movimientos ({movements.length})</span>
          </TabsTrigger>
          <TabsTrigger value="items" className="flex items-center gap-1.5">
            <Package className="h-4 w-4" />
            <span>Catálogo de Artículos ({items.length})</span>
          </TabsTrigger>
          <TabsTrigger value="warehouses" className="flex items-center gap-1.5">
            <Warehouse className="h-4 w-4" />
            <span>Bodegas ({warehouses.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab Saldos por Bodega */}
        <TabsContent value="balances">
          <Card>
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold">Existencias y Valorización por Bodega</CardTitle>
                <CardDescription>
                  Saldos en tiempo real consolidados a partir de las capas FIFO activas.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">Bodega:</Label>
                  <Select value={filterWarehouse} onValueChange={setFilterWarehouse}>
                    <SelectTrigger className="w-[170px] h-8 text-xs">
                      <SelectValue placeholder="Todas las bodegas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todas las bodegas</SelectItem>
                      {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.code} - {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">Propietario / 3PL:</Label>
                  <Select value={filterParty} onValueChange={setFilterParty}>
                    <SelectTrigger className="w-[190px] h-8 text-xs">
                      <SelectValue placeholder="Todos los saldos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos los saldos</SelectItem>
                      <SelectItem value="OWN">Solo Propio (Empresa)</SelectItem>
                      {parties3pl.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          3PL: {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredBalances.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Boxes className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No hay registros de stock en las bodegas.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setNewMovementOpen(true)}
                  >
                    Registrar primera entrada
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[130px]">SKU / Código</TableHead>
                        <TableHead>Artículo</TableHead>
                        <TableHead>Bodega</TableHead>
                        <TableHead>Propietario / Cliente 3PL</TableHead>
                        <TableHead className="text-right">Cantidad en Stock</TableHead>
                        <TableHead className="text-right">Costo Promedio Unitario</TableHead>
                        <TableHead className="text-right">Valorización Total ({baseCurrency})</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBalances.map((b, idx) => (
                        <TableRow key={`${b.item_id}-${b.warehouse_id}-${b.party_id || 'own'}-${idx}`}>
                          <TableCell className="font-mono text-xs font-semibold text-primary">
                            {b.item_code}
                          </TableCell>
                          <TableCell className="text-xs font-medium">{b.item_name}</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-xs">
                              {b.warehouse_code} - {b.warehouse_name}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {b.party_id ? (
                              <Badge
                                variant="outline"
                                className="text-[11px] bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 flex items-center gap-1 w-fit"
                              >
                                <Building2 className="h-3 w-3" />
                                <span>{b.party_name || "Cliente 3PL"}</span>
                                {b.party_tax_id && (
                                  <span className="opacity-70 text-[10px]">({b.party_tax_id})</span>
                                )}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[11px] text-muted-foreground w-fit">
                                Propio (Empresa)
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-bold">
                            {Number(b.qty_on_hand).toLocaleString("es-CL")}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            $ {Number(b.avg_rate).toLocaleString("es-CL")}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            $ {Number(b.value_on_hand).toLocaleString("es-CL")}
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

        {/* Tab Kardex / Movimientos */}
        <TabsContent value="ledger">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Kardex de Movimientos de Inventario</CardTitle>
                <CardDescription>
                  Trazabilidad inmutable de entradas, salidas y traslados con costo FIFO real.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {movements.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <ListOrdered className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No hay movimientos registrados en el Kardex.</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Artículo</TableHead>
                        <TableHead>Bodega</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">Costo Unitario FIFO</TableHead>
                        <TableHead className="text-right">Total Movimiento</TableHead>
                        <TableHead>Glosa / Referencia</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movements.map((m) => {
                        const isEntry = Number(m.qty_change) > 0;
                        const isTransfer = m.movement_type === "transfer_in" || m.movement_type === "transfer_out";
                        const totalVal = Math.abs(Number(m.qty_change) * Number(m.valuation_rate));

                        return (
                          <TableRow key={m.id}>
                            <TableCell className="font-mono text-xs">{m.posting_date}</TableCell>
                            <TableCell className="text-xs">
                              {m.movement_type === "receipt" && (
                                <Badge className="bg-emerald-600 text-white gap-1 text-[11px]">
                                  <ArrowDownRight className="h-3 w-3" /> Entrada
                                </Badge>
                              )}
                              {m.movement_type === "issue" && (
                                <Badge variant="destructive" className="gap-1 text-[11px]">
                                  <ArrowUpRight className="h-3 w-3" /> Salida
                                </Badge>
                              )}
                              {m.movement_type === "transfer_out" && (
                                <Badge variant="outline" className="border-amber-500 text-amber-600 gap-1 text-[11px]">
                                  <ArrowRightLeft className="h-3 w-3" /> Traslado Salida
                                </Badge>
                              )}
                              {m.movement_type === "transfer_in" && (
                                <Badge variant="outline" className="border-blue-500 text-blue-600 gap-1 text-[11px]">
                                  <ArrowRightLeft className="h-3 w-3" /> Traslado Entrada
                                </Badge>
                              )}
                              {m.movement_type === "adjustment" && (
                                <Badge variant="secondary" className="text-[11px]">
                                  Ajuste
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs font-medium">
                              {m.items ? `${m.items.code} - ${m.items.name}` : m.item_id}
                            </TableCell>
                            <TableCell className="text-xs">
                              {m.warehouses?.name || m.warehouse_id}
                            </TableCell>
                            <TableCell className={`text-right font-mono text-xs font-bold ${isEntry ? "text-emerald-600" : "text-destructive"}`}>
                              {isEntry ? `+${Number(m.qty_change).toLocaleString("es-CL")}` : Number(m.qty_change).toLocaleString("es-CL")}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              $ {Number(m.valuation_rate).toLocaleString("es-CL")}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-semibold">
                              $ {totalVal.toLocaleString("es-CL")}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {m.memo || "-"}
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

        {/* Tab Items */}
        <TabsContent value="items">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Catálogo Maestro de Artículos</CardTitle>
              <CardDescription>
                Productos y servicios administrados por la empresa.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Package className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No hay artículos registrados aún.</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">SKU / Código</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Unidad</TableHead>
                        <TableHead className="text-center">Método</TableHead>
                        <TableHead className="text-center">Control Stock</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell className="font-mono text-xs font-semibold">{i.code}</TableCell>
                          <TableCell className="text-xs font-medium">{i.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {i.item_categories?.name || "-"}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {i.uom?.code || "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-xs">
                              {i.valuation_method || "FIFO"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {i.is_stock_item ? (
                              <Badge variant="default" className="text-xs bg-primary/20 text-primary border-primary/30">
                                Stockable
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Servicio
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`inline-block h-2 w-2 rounded-full ${i.active ? "bg-emerald-500" : "bg-red-500"}`} />
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

        {/* Tab Warehouses */}
        <TabsContent value="warehouses">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Bodegas & Ubicaciones de Almacenamiento</CardTitle>
              <CardDescription>
                Instalaciones físicas configuradas para la empresa activa.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {warehouses.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Warehouse className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No hay bodegas registradas aún.</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">Código</TableHead>
                        <TableHead>Nombre del Almacén</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {warehouses.map((w) => (
                        <TableRow key={w.id}>
                          <TableCell className="font-mono text-xs font-semibold text-primary">{w.code}</TableCell>
                          <TableCell className="text-xs font-semibold">{w.name}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={w.active ? "outline" : "secondary"} className="text-xs">
                              {w.active ? "Operativa" : "Inactiva"}
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
