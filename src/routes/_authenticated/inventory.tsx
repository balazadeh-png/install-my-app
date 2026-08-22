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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Package, Plus, ArrowLeft, RefreshCw, Warehouse, Scale } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: InventoryPage,
  head: () => ({
    meta: [
      { title: "Inventario & Bodegas | Cacao Accounting" },
      { name: "description", content: "Catálogo de artículos, bodegas, valoración FIFO y existencias." },
    ],
  }),
});

function InventoryPage() {
  const queryClient = useQueryClient();
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [newWarehouseOpen, setNewWarehouseOpen] = useState(false);

  // Form State Item
  const [itemCode, setItemCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemCategory, setItemCategory] = useState("");
  const [itemUom, setItemUom] = useState("");
  const [isStockItem, setIsStockItem] = useState(true);

  // Form State Warehouse
  const [warehouseCode, setWarehouseCode] = useState("");
  const [warehouseName, setWarehouseName] = useState("");

  // Query: Items
  const itemsQuery = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("*, item_categories(name), uom(code, name)")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
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
    queryKey: ["warehouses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Mutation: Crear Item
  const createItemMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("items").insert({
        code: itemCode.trim(),
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
      queryClient.invalidateQueries({ queryKey: ["items"] });
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
      const { error } = await supabase.from("warehouses").insert({
        code: warehouseCode.trim(),
        name: warehouseName.trim(),
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success("Bodega registrada exitosamente");
      setNewWarehouseOpen(false);
      setWarehouseCode("");
      setWarehouseName("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al registrar bodega");
    },
  });

  const items = itemsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const uoms = uomQuery.data ?? [];
  const warehouses = warehousesQuery.data ?? [];

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
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Módulo de Inventario & Bodegas</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Catálogo de productos, control de existencias, bodegas físicas y valoración FIFO.
          </p>
        </div>

        <div className="flex items-center gap-2">
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
                  Define una nueva ubicación física para almacenar inventario.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-3">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="wCode" className="text-right">Código</Label>
                  <Input
                    id="wCode"
                    placeholder="ej. BOD-CENTRAL"
                    value={warehouseCode}
                    onChange={(e) => setWarehouseCode(e.target.value)}
                    className="col-span-3 font-mono"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="wName" className="text-right">Nombre</Label>
                  <Input
                    id="wName"
                    placeholder="ej. Bodega Principal Managua"
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

          {/* Dialog Crear Item */}
          <Dialog open={newItemOpen} onOpenChange={setNewItemOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Nuevo Artículo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Crear Producto o Servicio</DialogTitle>
                <DialogDescription>
                  Agrega un nuevo ítem a la lista maestra de inventario.
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
                    placeholder="ej. Cacao en Grano Grado A (Saco 50kg)"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="iCategory" className="text-right">Categoría</Label>
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
                  <Label htmlFor="iUom" className="text-right">U. Medida</Label>
                  <Select value={itemUom} onValueChange={setItemUom}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Seleccione unidad" />
                    </SelectTrigger>
                    <SelectContent>
                      {uoms.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} ({u.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="isStock" className="text-right">¿Controla Stock?</Label>
                  <div className="col-span-3 flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isStock"
                      checked={isStockItem}
                      onChange={(e) => setIsStockItem(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="isStock" className="text-xs text-muted-foreground">
                      Desmarcar si es un Servicio
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
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="items" className="space-y-4">
        <TabsList>
          <TabsTrigger value="items" className="flex items-center gap-1.5">
            <Package className="h-4 w-4" />
            <span>Artículos ({items.length})</span>
          </TabsTrigger>
          <TabsTrigger value="warehouses" className="flex items-center gap-1.5">
            <Warehouse className="h-4 w-4" />
            <span>Bodegas ({warehouses.length})</span>
          </TabsTrigger>
          <TabsTrigger value="uom" className="flex items-center gap-1.5">
            <Scale className="h-4 w-4" />
            <span>Unidades de Medida ({uoms.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab Items */}
        <TabsContent value="items">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Maestro de Artículos y Servicios</CardTitle>
              <CardDescription>
                Productos con método de valoración FIFO y control de inventario.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Package className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No hay artículos registrados aún.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setNewItemOpen(true)}
                  >
                    Crear primer artículo
                  </Button>
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
                        <TableHead className="text-center">Tipo</TableHead>
                        <TableHead className="text-center">Valoración</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((it) => {
                        const cat = (it as any).item_categories;
                        const uom = (it as any).uom;
                        return (
                          <TableRow key={it.id}>
                            <TableCell className="font-mono font-medium text-xs">{it.code}</TableCell>
                            <TableCell className="font-semibold text-foreground text-xs">{it.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{cat?.name || "Sin categoría"}</TableCell>
                            <TableCell className="text-xs">{uom?.code || "-"}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={it.is_stock_item ? "default" : "secondary"} className="text-[11px]">
                                {it.is_stock_item ? "Inventario" : "Servicio"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs text-muted-foreground">
                              {it.valuation_method || "FIFO"}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={`inline-block h-2 w-2 rounded-full ${it.active ? "bg-emerald-500" : "bg-red-500"}`} />
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

        {/* Tab Warehouses */}
        <TabsContent value="warehouses">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Bodegas y Almacenes</CardTitle>
              <CardDescription>
                Ubicaciones físicas de almacenamiento y control de existencias.
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
                        <TableHead className="w-[180px]">Código</TableHead>
                        <TableHead>Nombre de Bodega</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {warehouses.map((w) => (
                        <TableRow key={w.id}>
                          <TableCell className="font-mono font-medium text-xs">{w.code}</TableCell>
                          <TableCell className="font-medium text-xs">{w.name}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={w.active ? "outline" : "secondary"} className="text-xs">
                              {w.active ? "Activa" : "Inactiva"}
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

        {/* Tab UOM */}
        <TabsContent value="uom">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Unidades de Medida (UOM)</CardTitle>
              <CardDescription>
                Unidades estándar para compras, ventas y control de existencias.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Código</TableHead>
                      <TableHead>Descripción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uoms.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-mono font-semibold text-xs">{u.code}</TableCell>
                        <TableCell className="text-xs">{u.name}</TableCell>
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
