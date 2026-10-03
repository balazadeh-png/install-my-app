import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PortalParty } from "@/routes/_portal/route";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Package,
  FileText,
  Plus,
  FileSpreadsheet,
  Search,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  Edit2,
  PowerOff,
  Power,
  ShieldCheck,
  Building,
  Info,
} from "lucide-react";

interface SupplierPortalViewProps {
  activeParty: PortalParty;
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

export function SupplierPortalView({ activeParty }: SupplierPortalViewProps) {
  const queryClient = useQueryClient();
  const partyId = activeParty.id;
  const entityId = activeParty.entity_id;

  // Estados de Búsqueda y Navegación
  const [catalogSearch, setCatalogSearch] = useState("");
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [excelImportOpen, setExcelImportOpen] = useState(false);

  // Estados Formulario Manual
  const [formSku, setFormSku] = useState("");
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formType, setFormType] = useState<"producto" | "servicio">("producto");
  const [formPrice, setFormPrice] = useState("0");
  const [formCurrency, setFormCurrency] = useState("CLP");
  const [formUom, setFormUom] = useState("UN");

  // Estados Carga Masiva Excel
  const [parsedRows, setParsedRows] = useState<ParsedCatalogRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);

  // 1. Query: Mi Catálogo de Proveedor
  const catalogQuery = useQuery({
    queryKey: ["portal_supplier_catalog", partyId],
    enabled: !!partyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_catalog_items" as any)
        .select("*")
        .eq("party_id", partyId)
        .order("name", { ascending: true });

      if (error) {
        console.error("Portal catalog query error:", error);
        throw error;
      }
      return (data as any[]) ?? [];
    },
  });

  // 2. Query: Mis Contratos Firmados
  const contractsQuery = useQuery({
    queryKey: ["portal_supplier_contracts", partyId],
    enabled: !!partyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_contracts" as any)
        .select("*")
        .eq("party_id", partyId)
        .order("version_number", { ascending: false });

      if (error) {
        console.error("Portal contracts query error:", error);
        throw error;
      }
      return (data as any[]) ?? [];
    },
  });

  const catalogItems = catalogQuery.data ?? [];
  const contracts = contractsQuery.data ?? [];
  const currentContract = contracts.find((c) => c.is_current);

  // Métricas
  const totalProducts = catalogItems.filter((i) => i.item_type === "producto").length;
  const totalServices = catalogItems.filter((i) => i.item_type === "servicio").length;
  const activeItemsCount = catalogItems.filter((i) => i.active).length;

  // Filtrado
  const filteredCatalog = catalogItems.filter((i) => {
    if (!catalogSearch.trim()) return true;
    const q = catalogSearch.toLowerCase();
    return (
      i.supplier_sku?.toLowerCase().includes(q) ||
      i.name?.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q)
    );
  });

  // Guardar Ítem (Alta o Modificación)
  const saveItemMutation = useMutation({
    mutationFn: async () => {
      const sku = formSku.trim();
      const name = formName.trim();
      const price = parseFloat(formPrice);

      if (!sku) throw new Error("El SKU o código es obligatorio");
      if (!name) throw new Error("El nombre del producto/servicio es obligatorio");
      if (isNaN(price) || price < 0) throw new Error("El precio unitario debe ser mayor o igual a 0");

      const payload = {
        entity_id: entityId,
        party_id: partyId,
        supplier_sku: sku,
        name: name,
        description: formDesc.trim() || null,
        item_type: formType,
        unit_price: price,
        currency_code: formCurrency || "CLP",
        uom: formUom.trim().toUpperCase() || "UN",
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
      toast.success(editItem ? "Ítem de tu catálogo actualizado" : "Ítem agregado a tu catálogo");
      setAddItemOpen(false);
      setEditItem(null);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al guardar ítem en el catálogo");
    },
  });

  // Desactivar / Reactivar Ítem
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
      toast.success(newStatus ? "Ítem reactivado en tu catálogo" : "Ítem pausado / desactivado");
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
  }

  function handleOpenEdit(item: any) {
    setEditItem(item);
    setFormSku(item.supplier_sku);
    setFormName(item.name);
    setFormDesc(item.description || "");
    setFormType(item.item_type || "producto");
    setFormPrice(String(item.unit_price || 0));
    setFormCurrency(item.currency_code || "CLP");
    setFormUom(item.uom || "UN");
    setAddItemOpen(true);
  }

  // Descarga de Contrato PDF
  async function handleDownloadContract(filePath: string) {
    try {
      const { data, error } = await supabase.storage
        .from("supplier-contracts")
        .createSignedUrl(filePath, 3600);

      if (error || !data?.signedUrl) {
        throw new Error(error?.message || "No se pudo generar el enlace de descarga");
      }

      window.open(data.signedUrl, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Error al descargar contrato");
    }
  }

  // Lógica Excel Import
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

    const firstLine = rawLines[0];
    const delimiter = firstLine.includes("\t") ? "\t" : firstLine.includes(";") ? ";" : ",";

    const headers = firstLine.split(delimiter).map((h) => h.trim().toLowerCase().replace(/"/g, ""));
    const skuIdx = headers.findIndex((h) => h.includes("sku") || h.includes("codigo"));
    const nameIdx = headers.findIndex((h) => h.includes("name") || h.includes("nombre") || h.includes("producto"));
    const descIdx = headers.findIndex((h) => h.includes("desc") || h.includes("detalle"));
    const typeIdx = headers.findIndex((h) => h.includes("type") || h.includes("tipo"));
    const priceIdx = headers.findIndex((h) => h.includes("price") || h.includes("precio") || h.includes("valor"));
    const uomIdx = headers.findIndex((h) => h.includes("uom") || h.includes("unidad"));

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

      if (!sku) {
        errors.push("SKU vacío");
      } else if (seenSkus.has(sku.toLowerCase())) {
        errors.push(`SKU duplicado: "${sku}"`);
      } else {
        seenSkus.add(sku.toLowerCase());
      }

      if (!name) {
        errors.push("Nombre vacío");
      }

      const cleanPriceStr = rawPrice.replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
      const priceNum = parseFloat(cleanPriceStr);
      if (isNaN(priceNum) || priceNum < 0) {
        errors.push(`Precio inválido (${rawPrice})`);
      }

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
      toast.warning(`${validCount} filas válidas, ${invalidCount} con errores`);
    } else {
      toast.info(`${validCount} filas listas para importar`);
    }
  }

  async function handleConfirmImport() {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toast.error("No hay filas válidas para importar");
      return;
    }

    try {
      setImporting(true);

      const rowsToUpsert = validRows.map((r) => ({
        entity_id: entityId,
        party_id: partyId,
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

      toast.success(`Se importaron ${rowsToUpsert.length} productos a tu catálogo`);
      setExcelImportOpen(false);
      setParsedRows([]);
      setFileName("");
      catalogQuery.refetch();
    } catch (err: any) {
      console.error("Portal import error:", err);
      toast.error(err.message || "Error al importar catálogo");
    } finally {
      setImporting(false);
    }
  }

  const validRowsCount = parsedRows.filter((r) => r.isValid).length;
  const invalidRowsCount = parsedRows.length - validRowsCount;

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Banner de Bienvenida Proveedor */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card border rounded-xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Bienvenido, {activeParty.name}
            </h1>
            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
              Proveedor Oficial
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            RUT: {activeParty.tax_id || "Sin RUT"} · Empresa Compradora:{" "}
            <strong>{activeParty.entities?.business_name || "EasyERP"}</strong>
          </p>
        </div>
      </div>

      {/* Métricas del Proveedor */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-primary shadow-xs">
          <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>Total Catálogo</span>
            <Package className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-bold mt-2">{catalogItems.length}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{activeItemsCount} activos para órdenes</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-blue-500 shadow-xs">
          <div className="text-xs text-blue-700 dark:text-blue-300 font-medium flex items-center justify-between">
            <span>Productos Físicos</span>
            <Building className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold mt-2 text-blue-600 dark:text-blue-400">
            {totalProducts}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Insumos y mercaderías</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-purple-500 shadow-xs">
          <div className="text-xs text-purple-700 dark:text-purple-300 font-medium flex items-center justify-between">
            <span>Servicios</span>
            <FileText className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold mt-2 text-purple-600 dark:text-purple-400">
            {totalServices}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Honorarios y consultorías</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500 shadow-xs">
          <div className="text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center justify-between">
            <span>Contrato Vigente</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-lg font-bold mt-2 text-emerald-600 dark:text-emerald-400 truncate">
            {currentContract ? `Versión v${currentContract.version_number}` : activeParty.requires_contract ? "Pendiente" : "No Requerido"}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {currentContract ? currentContract.file_name : "Condiciones comerciales"}
          </p>
        </Card>
      </div>

      {/* Tabs Principales: Mi Catálogo & Mis Contratos */}
      <Tabs defaultValue="catalog" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md h-auto p-1 bg-muted/60">
          <TabsTrigger value="catalog" className="gap-1.5 text-xs py-2">
            <Package className="h-4 w-4" />
            <span>Mi Catálogo</span>
          </TabsTrigger>
          <TabsTrigger value="contracts" className="gap-1.5 text-xs py-2">
            <FileText className="h-4 w-4" />
            <span>Mis Contratos ({contracts.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------- */}
        {/* PESTAÑA 1: MI CATÁLOGO DE PRODUCTOS / SERVICIOS               */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="catalog" className="space-y-4">
          <Card>
            <CardHeader className="py-4 px-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    Catálogo de Productos y Servicios Disponibles
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Mantén actualizado tu tarifario y catálogo de ítems para que la empresa compradora emita sus órdenes de compra.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => setExcelImportOpen(true)}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Cargar Excel</span>
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

              {/* Barra de Filtro */}
              <div className="relative w-full sm:w-80 mt-3 pt-2">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-4.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar por SKU, producto o servicio..."
                  className="h-8 pl-8 text-xs bg-background"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                />
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {catalogQuery.isLoading ? (
                <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Cargando catálogo...
                </div>
              ) : filteredCatalog.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
                  <Package className="h-8 w-8 mx-auto text-muted-foreground/40" />
                  <p className="font-medium">No hay productos registrados en tu catálogo.</p>
                  <p className="text-[11px]">Agrega tus productos o importa tu lista en Excel.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="w-[120px]">SKU / Código</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descripción Comercial</TableHead>
                      <TableHead className="text-right">Precio Unitario</TableHead>
                      <TableHead>U.M.</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCatalog.map((item) => (
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
                            <div className="text-[11px] text-muted-foreground italic truncate max-w-[280px]">
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
                        <TableCell className="text-center">
                          {item.active ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
                              Activo
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                              Pausado
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleOpenEdit(item)}
                              title="Editar ítem"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-7 w-7 ${item.active ? "text-amber-600" : "text-emerald-600"}`}
                              onClick={() => toggleActiveMutation.mutate({ id: item.id, active: item.active })}
                              title={item.active ? "Desactivar de órdenes" : "Reactivar"}
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* PESTAÑA 2: MIS CONTRATOS (SOLO LECTURA)                        */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="contracts" className="space-y-4">
          <Card>
            <CardHeader className="py-4 px-5">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Historial de Contratos y Anexos Vigentes
              </CardTitle>
              <CardDescription className="text-xs">
                Contratos suscritos con la empresa compradora. Documentos protegidos y respaldados.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-2.5 p-3 rounded-lg border bg-muted/20 text-xs text-muted-foreground">
                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p>
                  Los documentos y anexos de contrato son incorporados y actualizados por el equipo de adquisiciones del cliente. Aquí puedes consultar y descargar copias fieles en PDF de todas las versiones vigentes e históricas.
                </p>
              </div>

              {contractsQuery.isLoading ? (
                <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Cargando contratos...
                </div>
              ) : contracts.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground border rounded-lg bg-muted/10">
                  <FileText className="h-7 w-7 mx-auto mb-1.5 text-muted-foreground/40" />
                  <p>No se registran documentos de contrato firmados en la plataforma.</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs bg-muted/30">
                        <TableHead className="w-[80px]">Versión</TableHead>
                        <TableHead>Nombre Documento</TableHead>
                        <TableHead>Fecha Emisión</TableHead>
                        <TableHead>Observaciones</TableHead>
                        <TableHead className="text-center">Vigencia</TableHead>
                        <TableHead className="text-right">Descarga</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contracts.map((c) => (
                        <TableRow key={c.id} className="text-xs">
                          <TableCell className="font-mono font-bold text-primary">
                            v{c.version_number}
                          </TableCell>
                          <TableCell className="font-medium max-w-[220px] truncate" title={c.file_name}>
                            {c.file_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {new Date(c.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-muted-foreground italic text-[11px] max-w-[200px] truncate" title={c.notes || ""}>
                            {c.notes || "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            {c.is_current ? (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
                                Vigente
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                                Histórica
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1.5"
                              onClick={() => handleDownloadContract(c.file_path)}
                            >
                              <Download className="h-3 w-3" />
                              <span>Descargar PDF</span>
                            </Button>
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

      {/* ------------------------------------------------------------- */}
      {/* MODAL: ALTA Y EDICIÓN MANUAL DE ÍTEM                          */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              {editItem ? "Editar Ítem de Catálogo" : "Nuevo Ítem en tu Catálogo"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ingresa los datos del producto o servicio que provees.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="p-sku" className="text-xs">SKU / Código *</Label>
                <Input
                  id="p-sku"
                  placeholder="Ej. PROD-100"
                  className="h-8 text-xs font-mono mt-1"
                  value={formSku}
                  onChange={(e) => setFormSku(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="p-type" className="text-xs">Tipo *</Label>
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
              <Label htmlFor="p-name" className="text-xs">Nombre Comercial *</Label>
              <Input
                id="p-name"
                placeholder="Ej. Cable UTP Categoría 6 Bobina 305m"
                className="h-8 text-xs mt-1"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="p-desc" className="text-xs">Descripción Detallada</Label>
              <Input
                id="p-desc"
                placeholder="Especificaciones técnicas o detalles de entrega"
                className="h-8 text-xs mt-1"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="p-price" className="text-xs">Precio Unitario *</Label>
                <Input
                  id="p-price"
                  type="number"
                  min="0"
                  step="0.01"
                  className="h-8 text-xs font-mono mt-1"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="p-curr" className="text-xs">Moneda</Label>
                <Select value={formCurrency} onValueChange={setFormCurrency}>
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLP">CLP ($)</SelectItem>
                    <SelectItem value="USD">USD (US$)</SelectItem>
                    <SelectItem value="UF">UF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="p-uom" className="text-xs">U. Medida</Label>
                <Input
                  id="p-uom"
                  placeholder="UN / KG / M"
                  className="h-8 text-xs font-mono mt-1 uppercase"
                  value={formUom}
                  onChange={(e) => setFormUom(e.target.value)}
                />
              </div>
            </div>
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
              {saveItemMutation.isPending ? "Guardando..." : editItem ? "Actualizar Ítem" : "Guardar Ítem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: CARGA MASIVA EXCEL CON REPORTE PRE-VALIDACIÓN          */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={excelImportOpen} onOpenChange={setExcelImportOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Carga Masiva de Catálogo (Excel / CSV)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Sube tu planilla para actualizar en lote tus productos y precios.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 border-2 border-dashed rounded-lg text-center bg-muted/20 space-y-2">
              <FileSpreadsheet className="h-8 w-8 mx-auto text-emerald-600/70" />
              <div className="text-xs font-medium">
                {fileName ? (
                  <span className="font-bold text-foreground">{fileName}</span>
                ) : (
                  <span>Selecciona tu archivo .csv, .tsv o exportado desde Excel</span>
                )}
              </div>
              <Input
                type="file"
                accept=".csv,.tsv,.txt,.xlsx"
                className="max-w-xs mx-auto text-xs"
                onChange={handleExcelFileSelect}
              />
              <p className="text-[11px] text-muted-foreground">
                Columnas requeridas: <code>supplier_sku</code>, <code>name</code>, <code>unit_price</code>. Opcionales: <code>item_type</code>, <code>uom</code>.
              </p>
            </div>

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
                      <span>Filas rechazadas (no se importarán):</span>
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
                    <span>{validRowsCount} filas correctas listas para guardar en tu catálogo.</span>
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
    </div>
  );
}
