import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Package,
  Plus,
  FileSpreadsheet,
  Search,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Edit2,
  PowerOff,
  Power,
  Layers,
} from "lucide-react";

interface SupplierCatalogItem {
  id: string;
  entity_id: string;
  party_id: string;
  supplier_sku: string;
  name: string;
  description: string | null;
  item_type: "producto" | "servicio";
  unit_price: number;
  currency_code: string;
  uom: string | null;
  linked_item_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  items?: {
    id: string;
    code: string;
    name: string;
  } | null;
}

interface ParsedCatalogRow {
  rowNumber: number;
  supplier_sku: string;
  name: string;
  description: string | null;
  item_type: "producto" | "servicio";
  unit_price: number;
  uom: string | null;
  currency_code: string;
  isValid: boolean;
  errors: string[];
}

interface SupplierCatalogManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: {
    id: string;
    name: string;
    tax_id?: string | null;
  } | null;
  entityId: string;
  isPortalView?: boolean;
}

export function SupplierCatalogManagerDialog({
  open,
  onOpenChange,
  supplier,
  entityId,
  isPortalView = false,
}: SupplierCatalogManagerDialogProps) {
  const queryClient = useQueryClient();
  const supplierId = supplier?.id;

  // Estados de interfaz
  const [searchTerm, setSearchTerm] = useState("");
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [editItem, setEditItem] = useState<SupplierCatalogItem | null>(null);
  const [excelImportOpen, setExcelImportOpen] = useState(false);

  // Estados del Formulario Manual
  const [formSku, setFormSku] = useState("");
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formType, setFormType] = useState<"producto" | "servicio">("producto");
  const [formPrice, setFormPrice] = useState("0");
  const [formCurrency, setFormCurrency] = useState("CLP");
  const [formUom, setFormUom] = useState("UN");
  const [formLinkedItemId, setFormLinkedItemId] = useState<string>("none");

  // Estados de Carga Masiva Excel
  const [parsedRows, setParsedRows] = useState<ParsedCatalogRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);

  // 1. Cargar Ítems del Catálogo del Proveedor
  const catalogQuery = useQuery({
    queryKey: ["supplier_catalog_items", supplierId],
    enabled: !!supplierId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_catalog_items" as any)
        .select(`
          *,
          items:linked_item_id(id, code, name)
        `)
        .eq("party_id", supplierId!)
        .order("name", { ascending: true });

      if (error) {
        console.error("Error loading supplier catalog:", error);
        throw error;
      }
      return (data as any[]) ?? [];
    },
  });

  // 2. Cargar Ítems Internos (para el mapeo linked_item_id)
  const internalItemsQuery = useQuery({
    queryKey: ["internal_items_lookup", entityId],
    enabled: !!entityId && !isPortalView && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("id, code, name")
        .eq("entity_id", entityId)
        .eq("active", true)
        .order("code");
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const catalogItems = catalogQuery.data ?? [];
  const internalItems = internalItemsQuery.data ?? [];

  // Filtrado por búsqueda
  const filteredItems = catalogItems.filter((i) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      i.supplier_sku?.toLowerCase().includes(q) ||
      i.name?.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q) ||
      i.items?.code?.toLowerCase().includes(q)
    );
  });

  // 3. Mutación para Guardar / Actualizar ítem manual
  const saveItemMutation = useMutation({
    mutationFn: async () => {
      if (!supplierId || !entityId) throw new Error("Datos de proveedor no válidos");
      const sku = formSku.trim();
      const name = formName.trim();
      const price = parseFloat(formPrice);

      if (!sku) throw new Error("El SKU del proveedor es obligatorio");
      if (!name) throw new Error("La descripción o nombre del ítem es obligatorio");
      if (isNaN(price) || price < 0) throw new Error("El precio unitario debe ser mayor o igual a 0");

      const payload = {
        entity_id: entityId,
        party_id: supplierId,
        supplier_sku: sku,
        name: name,
        description: formDesc.trim() || null,
        item_type: formType,
        unit_price: price,
        currency_code: formCurrency || "CLP",
        uom: formUom.trim().toUpperCase() || "UN",
        linked_item_id: formLinkedItemId && formLinkedItemId !== "none" ? formLinkedItemId : null,
        updated_at: new Date().toISOString(),
      };

      if (editItem) {
        const { error } = await supabase
          .from("supplier_catalog_items" as any)
          .update(payload)
          .eq("id", editItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("supplier_catalog_items" as any)
          .upsert(payload, { onConflict: "party_id,supplier_sku" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      catalogQuery.refetch();
      toast.success(editItem ? "Ítem del catálogo actualizado" : "Ítem agregado al catálogo");
      setAddItemOpen(false);
      setEditItem(null);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al guardar ítem en el catálogo");
    },
  });

  // 4. Mutación para Desactivar / Activar ítem (nunca borrado para mantener integridad)
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("supplier_catalog_items" as any)
        .update({ active: !active, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return !active;
    },
    onSuccess: (newStatus) => {
      catalogQuery.refetch();
      toast.success(newStatus ? "Ítem reactivado en el catálogo" : "Ítem desactivado del catálogo");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al actualizar estado del ítem");
    },
  });

  function resetForm() {
    setFormSku("");
    setFormName("");
    setFormDesc("");
    setFormType("producto");
    setFormPrice("0");
    setFormCurrency("CLP");
    setFormUom("UN");
    setFormLinkedItemId("none");
  }

  function handleOpenEdit(item: SupplierCatalogItem) {
    setEditItem(item);
    setFormSku(item.supplier_sku);
    setFormName(item.name);
    setFormDesc(item.description || "");
    setFormType(item.item_type || "producto");
    setFormPrice(String(item.unit_price || 0));
    setFormCurrency(item.currency_code || "CLP");
    setFormUom(item.uom || "UN");
    setFormLinkedItemId(item.linked_item_id || "none");
    setAddItemOpen(true);
  }

  // 5. Lógica de Lectura y Validación de Archivo Excel / CSV
  function handleExcelFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        toast.error("El archivo está vacío");
        return;
      }

      parseAndValidateCatalogText(text);
    };

    reader.readAsText(file);
  }

  function parseAndValidateCatalogText(text: string) {
    const rawLines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (rawLines.length === 0) {
      setParsedRows([]);
      return;
    }

    // Detectar delimitador (tabulador, punto y coma o coma)
    const firstLine = rawLines[0];
    const delimiter = firstLine.includes("\t") ? "\t" : firstLine.includes(";") ? ";" : ",";

    // Analizar encabezados
    const headers = firstLine.split(delimiter).map((h) => h.trim().toLowerCase().replace(/"/g, ""));
    const skuIdx = headers.findIndex((h) => h.includes("sku") || h.includes("codigo") || h.includes("item_id"));
    const nameIdx = headers.findIndex((h) => h.includes("name") || h.includes("nombre") || h.includes("descripcion") || h.includes("producto"));
    const descIdx = headers.findIndex((h) => h.includes("desc") || h.includes("detalle") || h.includes("notas"));
    const typeIdx = headers.findIndex((h) => h.includes("type") || h.includes("tipo"));
    const priceIdx = headers.findIndex((h) => h.includes("price") || h.includes("precio") || h.includes("valor") || h.includes("costo"));
    const uomIdx = headers.findIndex((h) => h.includes("uom") || h.includes("unidad") || h.includes("medida"));

    const hasHeader = skuIdx !== -1 || nameIdx !== -1 || priceIdx !== -1;
    const dataLines = hasHeader ? rawLines.slice(1) : rawLines;

    const seenSkus = new Set<string>();
    const results: ParsedCatalogRow[] = [];

    dataLines.forEach((line, index) => {
      const rowNum = index + (hasHeader ? 2 : 1);
      const cols = line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));

      const sku = (skuIdx !== -1 ? cols[skuIdx] : cols[0])?.trim() || "";
      const name = (nameIdx !== -1 ? cols[nameIdx] : cols[1])?.trim() || "";
      const desc = descIdx !== -1 ? cols[descIdx]?.trim() || null : null;
      const rawType = typeIdx !== -1 ? cols[typeIdx]?.trim().toLowerCase() : "";
      const rawPrice = (priceIdx !== -1 ? cols[priceIdx] : cols[2])?.trim() || "0";
      const uom = uomIdx !== -1 ? cols[uomIdx]?.trim() : cols[3]?.trim() || "UN";

      const errors: string[] = [];

      // Validar SKU
      if (!sku) {
        errors.push("SKU vacío");
      } else if (seenSkus.has(sku.toLowerCase())) {
        errors.push(`SKU repetido en el archivo: "${sku}"`);
      } else {
        seenSkus.add(sku.toLowerCase());
      }

      // Validar Nombre
      if (!name) {
        errors.push("Nombre / Descripción vacío");
      }

      // Validar Precio
      const cleanPriceStr = rawPrice.replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
      const priceNum = parseFloat(cleanPriceStr);
      if (isNaN(priceNum) || priceNum < 0) {
        errors.push(`Precio inválido o negativo (${rawPrice})`);
      }

      // Normalizar Tipo (producto / servicio)
      const itemType: "producto" | "servicio" =
        rawType.includes("serv") || rawType.includes("srv") ? "servicio" : "producto";

      results.push({
        rowNumber: rowNum,
        supplier_sku: sku,
        name: name,
        description: desc,
        item_type: itemType,
        unit_price: isNaN(priceNum) ? 0 : priceNum,
        uom: uom || "UN",
        currency_code: "CLP",
        isValid: errors.length === 0,
        errors,
      });
    });

    setParsedRows(results);
    const validCount = results.filter((r) => r.isValid).length;
    const invalidCount = results.length - validCount;
    if (invalidCount > 0) {
      toast.warning(`Archivo leído: ${validCount} filas válidas, ${invalidCount} con errores`);
    } else {
      toast.info(`Archivo leído: ${validCount} filas listas para importar`);
    }
  }

  // 6. Confirmar e importar filas válidas
  async function handleConfirmImport() {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0 || !supplierId || !entityId) {
      toast.error("No hay filas válidas para importar");
      return;
    }

    try {
      setImporting(true);

      const rowsToUpsert = validRows.map((r) => ({
        entity_id: entityId,
        party_id: supplierId,
        supplier_sku: r.supplier_sku,
        name: r.name,
        description: r.description,
        item_type: r.item_type,
        unit_price: r.unit_price,
        currency_code: r.currency_code,
        uom: r.uom,
        active: true,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("supplier_catalog_items" as any)
        .upsert(rowsToUpsert, { onConflict: "party_id,supplier_sku" });

      if (error) throw error;

      toast.success(`Se importaron ${rowsToUpsert.length} productos al catálogo de ${supplier?.name}`);
      setExcelImportOpen(false);
      setParsedRows([]);
      setFileName("");
      catalogQuery.refetch();
    } catch (err: any) {
      console.error("Import error:", err);
      toast.error(err.message || "Error al importar catálogo");
    } finally {
      setImporting(false);
    }
  }

  const validRowsCount = parsedRows.filter((r) => r.isValid).length;
  const invalidRowsCount = parsedRows.length - validRowsCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Catálogo de Productos y Servicios — {supplier?.name}</DialogTitle>
              <DialogDescription className="text-xs">
                RUT: {supplier?.tax_id || "Sin RUT"} · Catálogo exclusivo de ítems provistos por este suplidor.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Barra de Acciones */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por SKU proveedor, nombre, descripción..."
                className="pl-8 text-xs h-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setExcelImportOpen(true)}
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                <span>Cargar Excel / CSV</span>
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => {
                  setEditItem(null);
                  resetForm();
                  setAddItemOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Nuevo Ítem</span>
              </Button>
            </div>
          </div>

          {/* Tabla de Ítems del Catálogo */}
          {catalogQuery.isLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Cargando catálogo del proveedor...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground border rounded-lg bg-muted/10">
              <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="font-medium">No hay productos en este catálogo</p>
              <p className="text-[11px] mt-0.5">Puedes crear ítems a mano o importar masivamente una lista en Excel.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs bg-muted/30">
                    <TableHead className="w-[120px]">SKU Proveedor</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nombre / Descripción</TableHead>
                    <TableHead className="text-right">Precio Unitario</TableHead>
                    <TableHead>U.M.</TableHead>
                    {!isPortalView && <TableHead>Ítem ERP Vinculado</TableHead>}
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id} className="text-xs">
                      <TableCell className="font-mono font-bold text-primary">
                        {item.supplier_sku}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize ${
                            item.item_type === "servicio"
                              ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
                              : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30"
                          }`}
                        >
                          {item.item_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{item.name}</div>
                        {item.description && (
                          <div className="text-[11px] text-muted-foreground italic truncate max-w-[220px]">
                            {item.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        $ {Number(item.unit_price).toLocaleString("es-CL")} {item.currency_code}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {item.uom || "UN"}
                      </TableCell>
                      {!isPortalView && (
                        <TableCell>
                          {item.items ? (
                            <div className="text-[11px] font-mono">
                              <span className="font-bold text-foreground">{item.items.code}</span>
                              <span className="text-muted-foreground block truncate max-w-[140px]">{item.items.name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic text-[11px]">Sin vincular</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-center">
                        {item.active ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
                            Activo
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                            Inactivo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Editar ítem"
                            onClick={() => handleOpenEdit(item)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 ${item.active ? "text-amber-600 hover:text-amber-700" : "text-emerald-600 hover:text-emerald-700"}`}
                            title={item.active ? "Desactivar ítem" : "Activar ítem"}
                            onClick={() => toggleActiveMutation.mutate({ id: item.id, active: item.active })}
                            disabled={toggleActiveMutation.isPending}
                          >
                            {item.active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* SUB-MODAL: ALTA Y EDICIÓN MANUAL DE ÍTEM                          */}
        {/* ----------------------------------------------------------------- */}
        <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                {editItem ? "Editar Ítem del Catálogo" : "Nuevo Ítem en Catálogo de Proveedor"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {editItem ? "Modifica los datos comerciales del ítem." : "Ingresa el SKU y precio unitario ofrecido por el suplidor."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="formSku" className="text-xs">SKU del Proveedor *</Label>
                  <Input
                    id="formSku"
                    placeholder="Ej. PROV-001"
                    className="h-8 text-xs font-mono mt-1"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="formType" className="text-xs">Tipo de Ítem *</Label>
                  <Select value={formType} onValueChange={(val: any) => setFormType(val)}>
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="producto">Producto Físico</SelectItem>
                      <SelectItem value="servicio">Servicio / Honorario</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="formName" className="text-xs">Nombre Comercial *</Label>
                <Input
                  id="formName"
                  placeholder="Ej. Bobina de Acero Galvanizado 2mm"
                  className="h-8 text-xs mt-1"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="formDesc" className="text-xs">Descripción / Especificación Técnica</Label>
                <Input
                  id="formDesc"
                  placeholder="Detalles, dimensiones, ficha de referencia"
                  className="h-8 text-xs mt-1"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="formPrice" className="text-xs">Precio Unitario *</Label>
                  <Input
                    id="formPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    className="h-8 text-xs font-mono mt-1"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="formCurrency" className="text-xs">Moneda</Label>
                  <Select value={formCurrency} onValueChange={setFormCurrency}>
                    <SelectTrigger className="h-8 text-xs mt-1">
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
                <div>
                  <Label htmlFor="formUom" className="text-xs">U. Medida</Label>
                  <Input
                    id="formUom"
                    placeholder="UN / KG / M"
                    className="h-8 text-xs font-mono mt-1 uppercase"
                    value={formUom}
                    onChange={(e) => setFormUom(e.target.value)}
                  />
                </div>
              </div>

              {!isPortalView && (
                <div>
                  <Label htmlFor="formLinkedItem" className="text-xs flex items-center gap-1">
                    <Layers className="h-3 w-3 text-muted-foreground" />
                    <span>Vincular con Ítem Interno del ERP (Opcional)</span>
                  </Label>
                  <Select value={formLinkedItemId} onValueChange={setFormLinkedItemId}>
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue placeholder="Seleccionar ítem interno..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      <SelectItem value="none">Sin vinculación directa</SelectItem>
                      {internalItems.map((it) => (
                        <SelectItem key={it.id} value={it.id}>
                          <span className="font-mono font-bold">{it.code}</span> — {it.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Facilita el ingreso automático a inventario y matching al recibir Facturas u Órdenes de Compra.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setAddItemOpen(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => saveItemMutation.mutate()}
                disabled={saveItemMutation.isPending}
              >
                {saveItemMutation.isPending ? "Guardando..." : editItem ? "Actualizar Ítem" : "Agregar al Catálogo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ----------------------------------------------------------------- */}
        {/* SUB-MODAL: CARGA MASIVA EXCEL / CSV CON REPORTE PRE-VALIDACIÓN    */}
        {/* ----------------------------------------------------------------- */}
        <Dialog open={excelImportOpen} onOpenChange={setExcelImportOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                Carga Masiva de Catálogo (Excel / CSV)
              </DialogTitle>
              <DialogDescription className="text-xs">
                Sube una planilla de cálculo con los ítems del proveedor. Las filas se validarán antes de guardar para evitar cargas erróneas.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="p-3 border-2 border-dashed rounded-lg text-center bg-muted/20 space-y-2">
                <FileSpreadsheet className="h-8 w-8 mx-auto text-emerald-600/70" />
                <div className="text-xs font-medium">
                  {fileName ? (
                    <span className="font-bold text-foreground">{fileName}</span>
                  ) : (
                    <span>Selecciona un archivo .csv, .tsv o exportado desde Excel</span>
                  )}
                </div>
                <Input
                  type="file"
                  accept=".csv,.tsv,.txt,.xlsx"
                  className="max-w-xs mx-auto text-xs"
                  onChange={handleExcelFileSelect}
                />
                <p className="text-[11px] text-muted-foreground">
                  Columnas sugeridas: <code>supplier_sku</code>, <code>name</code>, <code>description</code>, <code>item_type</code>, <code>unit_price</code>, <code>uom</code>
                </p>
              </div>

              {/* Reporte de Pre-Validación */}
              {parsedRows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
                    <div className="text-xs font-semibold">Resumen de Validación</div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        Total: {parsedRows.length}
                      </Badge>
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
                        Válidas: {validRowsCount}
                      </Badge>
                      {invalidRowsCount > 0 && (
                        <Badge variant="destructive" className="text-[10px]">
                          Con errores: {invalidRowsCount}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {invalidRowsCount > 0 && (
                    <div className="p-3 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 space-y-1.5 max-h-40 overflow-y-auto text-xs">
                      <div className="font-semibold text-red-700 dark:text-red-300 flex items-center gap-1.5">
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Detalle de filas con errores (no se importarán):</span>
                      </div>
                      {parsedRows
                        .filter((r) => !r.isValid)
                        .map((r) => (
                          <div key={r.rowNumber} className="text-[11px] text-red-600 dark:text-red-400 font-mono">
                            Fila {r.rowNumber} ({r.supplier_sku || "Sin SKU"}): {r.errors.join(", ")}
                          </div>
                        ))}
                    </div>
                  )}

                  {validRowsCount > 0 && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span>{validRowsCount} filas correctas listas para hacer upsert al catálogo.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setExcelImportOpen(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                disabled={validRowsCount === 0 || importing}
                onClick={handleConfirmImport}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Confirmar e Importar {validRowsCount} Ítems
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
