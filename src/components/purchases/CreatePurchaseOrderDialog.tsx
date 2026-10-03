import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ShoppingCart,
  Plus,
  Trash2,
  Loader2,
  Calendar,
  Building2,
  DollarSign,
  AlertCircle,
  Package,
  Layers,
} from "lucide-react";

interface POLineDraft {
  id: string;
  catalog_item_id: string;
  item_id: string;
  description: string;
  item_type: "producto" | "servicio";
  qty: string;
  unit_price: string;
  tax_rate: string;
}

interface CreatePurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  suppliers: any[];
  warehouses: any[];
  costCenters: any[];
  currencies: any[];
  onSuccess?: (poId: string) => void;
}

export function CreatePurchaseOrderDialog({
  open,
  onOpenChange,
  entityId,
  suppliers,
  warehouses,
  costCenters,
  currencies,
  onSuccess,
}: CreatePurchaseOrderDialogProps) {
  const queryClient = useQueryClient();

  // Estados de Cabecera
  const [partyId, setPartyId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [currencyCode, setCurrencyCode] = useState("CLP");
  const [exchangeRate, setExchangeRate] = useState("1.0");
  const [expectedDate, setExpectedDate] = useState("");
  const [observaciones, setObservaciones] = useState("");

  // Estados de Líneas
  const [lines, setLines] = useState<POLineDraft[]>([
    {
      id: crypto.randomUUID(),
      catalog_item_id: "",
      item_id: "",
      description: "",
      item_type: "producto",
      qty: "1",
      unit_price: "0",
      tax_rate: "19",
    },
  ]);

  // Cargar Catálogo Activo del Proveedor Seleccionado
  const supplierCatalogQuery = useQuery({
    queryKey: ["supplier_catalog_active", partyId],
    enabled: !!partyId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_catalog_items" as any)
        .select("id, supplier_sku, name, description, item_type, unit_price, currency_code, uom, linked_item_id")
        .eq("party_id", partyId)
        .eq("active", true)
        .order("name", { ascending: true });

      if (error) {
        console.error("Error loading supplier catalog for PO:", error);
        return [];
      }
      return (data as any[]) ?? [];
    },
  });

  const catalogItems = supplierCatalogQuery.data ?? [];
  const selectedSupplier = suppliers.find((s) => s.id === partyId);

  // Manejar selección de ítem desde el catálogo
  function handleSelectCatalogItem(lineId: string, catalogItemId: string) {
    const item = catalogItems.find((ci) => ci.id === catalogItemId);
    if (!item) return;

    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        return {
          ...l,
          catalog_item_id: item.id,
          item_id: item.linked_item_id || "",
          description: item.name + (item.description ? ` (${item.description})` : ""),
          item_type: item.item_type || "producto",
          unit_price: String(item.unit_price ?? 0),
          qty: l.qty || "1",
          tax_rate: "19",
        };
      })
    );
  }

  function handleAddLine() {
    setLines((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        catalog_item_id: "",
        item_id: "",
        description: "",
        item_type: "producto",
        qty: "1",
        unit_price: "0",
        tax_rate: "19",
      },
    ]);
  }

  function handleRemoveLine(id: string) {
    if (lines.length <= 1) {
      toast.warning("La orden debe tener al menos una línea");
      return;
    }
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  function handleUpdateLine(id: string, field: keyof POLineDraft, value: string) {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  }

  // Cálculos de Totales
  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;

    lines.forEach((l) => {
      const q = parseFloat(l.qty) || 0;
      const p = parseFloat(l.unit_price) || 0;
      const t = parseFloat(l.tax_rate) || 0;
      const lineSub = q * p;
      subtotal += lineSub;
      tax += lineSub * (t / 100);
    });

    return {
      subtotal,
      tax,
      total: subtotal + tax,
    };
  }, [lines]);

  // Mutación: Crear Orden de Compra atómica
  const createPOMutation = useMutation({
    mutationFn: async () => {
      if (!entityId) throw new Error("Selecciona una empresa activa");
      if (!partyId) throw new Error("Selecciona el proveedor de la orden de compra");
      if (lines.length === 0) throw new Error("La orden debe tener al menos una línea");

      // Validar líneas
      const linesPayload = lines.map((l, idx) => {
        const q = parseFloat(l.qty);
        const p = parseFloat(l.unit_price);
        const tr = parseFloat(l.tax_rate);

        if (isNaN(q) || q <= 0) {
          throw new Error(`Línea ${idx + 1}: Cantidad inválida (debe ser mayor a 0)`);
        }
        if (isNaN(p) || p < 0) {
          throw new Error(`Línea ${idx + 1}: Precio unitario inválido (no puede ser negativo)`);
        }
        if (!l.description.trim()) {
          throw new Error(`Línea ${idx + 1}: Ingresa una descripción para el ítem`);
        }

        return {
          catalog_item_id: l.catalog_item_id || null,
          item_id: l.item_id || null,
          description: l.description.trim(),
          item_type: l.item_type || "producto",
          qty: q,
          unit_price: p,
          tax_rate: isNaN(tr) ? 19.0 : tr,
        };
      });

      const { data: poId, error } = await supabase.rpc("create_purchase_order", {
        _entity_id: entityId,
        _party_id: partyId,
        _warehouse_id: warehouseId && warehouseId !== "none" ? warehouseId : null,
        _cost_center_id: costCenterId && costCenterId !== "none" ? costCenterId : null,
        _currency_code: currencyCode || "CLP",
        _exchange_rate: parseFloat(exchangeRate) || 1.0,
        _expected_date: expectedDate || null,
        _observaciones: observaciones.trim() || null,
        _lines: linesPayload as any,
      });

      if (error) {
        throw error;
      }

      return poId;
    },
    onSuccess: async (poId) => {
      // Consultar el número de OC asignado para mostrar en el mensaje
      let assignedNumber = "";
      if (poId) {
        const { data: poData } = await supabase
          .from("purchase_orders")
          .select("po_number")
          .eq("id", poId)
          .single();
        assignedNumber = poData?.po_number || "";
      }

      queryClient.invalidateQueries({ queryKey: ["purchase_orders", entityId] });
      toast.success(
        assignedNumber
          ? `Orden de Compra ${assignedNumber} generada con éxito`
          : "Orden de Compra creada correctamente"
      );

      onOpenChange(false);
      resetForm();
      if (onSuccess && poId) {
        onSuccess(poId);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al emitir la Orden de Compra");
    },
  });

  function resetForm() {
    setPartyId("");
    setWarehouseId("");
    setCostCenterId("");
    setCurrencyCode("CLP");
    setExchangeRate("1.0");
    setExpectedDate("");
    setObservaciones("");
    setLines([
      {
        id: crypto.randomUUID(),
        catalog_item_id: "",
        item_id: "",
        description: "",
        item_type: "producto",
        qty: "1",
        unit_price: "0",
        tax_rate: "19",
      },
    ]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Emitir Orden de Compra (OC)</DialogTitle>
              <DialogDescription className="text-xs">
                Selecciona el proveedor y agrega líneas desde su catálogo comercial con numeración correlativa atómica.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Fila 1: Proveedor y Bodega */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-lg border bg-muted/20">
            <div>
              <Label htmlFor="poParty" className="text-xs font-semibold">
                Proveedor *
              </Label>
              <Select
                value={partyId}
                onValueChange={(val) => {
                  setPartyId(val);
                  // Limpiar selecciones de catálogo de las líneas al cambiar de proveedor
                  setLines((prev) =>
                    prev.map((l) => ({
                      ...l,
                      catalog_item_id: "",
                      item_id: "",
                      description: "",
                      unit_price: "0",
                    }))
                  );
                }}
              >
                <SelectTrigger id="poParty" className="h-8 text-xs mt-1 bg-background">
                  <SelectValue placeholder="Selecciona un proveedor..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="font-semibold">{s.name}</span>
                      {s.tax_id && <span className="font-mono text-muted-foreground ml-1.5">({s.tax_id})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {partyId && (
                <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                  <Package className="h-3 w-3 text-primary" />
                  <span>
                    Catálogo activo: <strong>{catalogItems.length}</strong> ítems disponibles
                  </span>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="poWarehouse" className="text-xs">
                Bodega de Recepción Destino
              </Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger id="poWarehouse" className="h-8 text-xs mt-1 bg-background">
                  <SelectValue placeholder="Bodega opcional..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin bodega asignada</SelectItem>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      <span className="font-mono font-semibold">{w.code}</span> — {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="poCostCenter" className="text-xs">
                Centro de Costo / Proyecto
              </Label>
              <Select value={costCenterId} onValueChange={setCostCenterId}>
                <SelectTrigger id="poCostCenter" className="h-8 text-xs mt-1 bg-background">
                  <SelectValue placeholder="Centro de costo opcional..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin centro de costo</SelectItem>
                  {costCenters.map((cc) => (
                    <SelectItem key={cc.id} value={cc.id}>
                      <span className="font-mono font-semibold">{cc.code}</span> — {cc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fila 2: Moneda, Fecha Estimada */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="poCurrency" className="text-xs">Moneda</Label>
              <Select value={currencyCode} onValueChange={setCurrencyCode}>
                <SelectTrigger id="poCurrency" className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLP">CLP ($)</SelectItem>
                  <SelectItem value="USD">USD (US$)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="UF">UF</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {currencyCode !== "CLP" && (
              <div>
                <Label htmlFor="poRate" className="text-xs">Tasa de Cambio a CLP</Label>
                <Input
                  id="poRate"
                  type="number"
                  step="0.0001"
                  className="h-8 text-xs font-mono mt-1"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                />
              </div>
            )}

            <div>
              <Label htmlFor="poExpDate" className="text-xs">Fecha Estimada de Entrega</Label>
              <Input
                id="poExpDate"
                type="date"
                className="h-8 text-xs font-mono mt-1"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </div>
          </div>

          {/* Fila 3: Líneas de la Orden de Compra */}
          <div className="space-y-2 border rounded-xl p-3 bg-card">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ShoppingCart className="h-3.5 w-3.5 text-primary" />
                  Ítems y Detalle de la Orden ({lines.length})
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  El selector de ítems se alimenta automáticamente del catálogo del proveedor seleccionado.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={handleAddLine}
              >
                <Plus className="h-3 w-3" />
                <span>Agregar Línea</span>
              </Button>
            </div>

            {!partyId ? (
              <div className="py-8 text-center text-xs text-muted-foreground border rounded-lg bg-muted/10">
                <AlertCircle className="h-6 w-6 mx-auto mb-1 text-muted-foreground/50" />
                <p>Primero selecciona un proveedor para cargar su catálogo de ítems disponibles.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-muted/30">
                      <TableHead className="w-[240px]">Catálogo Proveedor</TableHead>
                      <TableHead>Descripción / Glosa</TableHead>
                      <TableHead className="w-[80px]">Tipo</TableHead>
                      <TableHead className="w-[90px] text-right">Cantidad</TableHead>
                      <TableHead className="w-[120px] text-right">Precio Unit.</TableHead>
                      <TableHead className="w-[80px] text-right">IVA %</TableHead>
                      <TableHead className="w-[120px] text-right">Total Línea</TableHead>
                      <TableHead className="w-[40px] text-center"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l, index) => {
                      const qtyNum = parseFloat(l.qty) || 0;
                      const priceNum = parseFloat(l.unit_price) || 0;
                      const lineTot = qtyNum * priceNum;

                      return (
                        <TableRow key={l.id} className="text-xs">
                          <TableCell>
                            <Select
                              value={l.catalog_item_id || "manual"}
                              onValueChange={(val) => {
                                if (val === "manual") {
                                  handleUpdateLine(l.id, "catalog_item_id", "");
                                } else {
                                  handleSelectCatalogItem(l.id, val);
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs font-mono">
                                <SelectValue placeholder="Elegir del catálogo..." />
                              </SelectTrigger>
                              <SelectContent className="max-h-56 max-w-md">
                                <SelectItem value="manual">
                                  <span className="italic text-muted-foreground">— Entrada manual libre —</span>
                                </SelectItem>
                                {catalogItems.map((ci) => (
                                  <SelectItem key={ci.id} value={ci.id}>
                                    <span className="font-bold text-primary">{ci.supplier_sku}</span>: {ci.name} (${Number(ci.unit_price).toLocaleString("es-CL")})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>

                          <TableCell>
                            <Input
                              placeholder="Descripción del bien o servicio..."
                              className="h-8 text-xs"
                              value={l.description}
                              onChange={(e) => handleUpdateLine(l.id, "description", e.target.value)}
                            />
                          </TableCell>

                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] capitalize ${
                                l.item_type === "servicio"
                                  ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
                                  : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30"
                              }`}
                            >
                              {l.item_type}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <Input
                              type="number"
                              min="0.001"
                              step="any"
                              className="h-8 text-xs font-mono text-right"
                              value={l.qty}
                              onChange={(e) => handleUpdateLine(l.id, "qty", e.target.value)}
                            />
                          </TableCell>

                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              className="h-8 text-xs font-mono text-right"
                              value={l.unit_price}
                              onChange={(e) => handleUpdateLine(l.id, "unit_price", e.target.value)}
                            />
                          </TableCell>

                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              className="h-8 text-xs font-mono text-right"
                              value={l.tax_rate}
                              onChange={(e) => handleUpdateLine(l.id, "tax_rate", e.target.value)}
                            />
                          </TableCell>

                          <TableCell className="text-right font-mono font-semibold">
                            $ {Math.round(lineTot).toLocaleString("es-CL")}
                          </TableCell>

                          <TableCell className="text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveLine(l.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Totales y Observaciones */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <Label htmlFor="poObs" className="text-xs">
                  Observaciones / Términos de Entrega y Pago
                </Label>
                <Textarea
                  id="poObs"
                  placeholder="Instrucciones para despacho, horario de recepción en bodega, condición de crédito (ej. 30 días contra factura)..."
                  className="h-20 text-xs mt-1 resize-none"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                />
              </div>

              <div className="bg-muted/30 p-3 rounded-lg border space-y-1.5 self-end">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Subtotal Neto:</span>
                  <span className="font-mono font-medium">$ {Math.round(totals.subtotal).toLocaleString("es-CL")}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>IVA 19%:</span>
                  <span className="font-mono font-medium">$ {Math.round(totals.tax).toLocaleString("es-CL")}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t pt-1 text-primary">
                  <span>Total Orden de Compra:</span>
                  <span className="font-mono">$ {Math.round(totals.total).toLocaleString("es-CL")} {currencyCode}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => createPOMutation.mutate()}
            disabled={createPOMutation.isPending || !partyId || lines.length === 0}
          >
            {createPOMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generando Orden de Compra...
              </>
            ) : (
              <>
                <ShoppingCart className="h-3.5 w-3.5" />
                Emitir Orden de Compra
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
