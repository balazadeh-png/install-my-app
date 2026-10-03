import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEntity } from "@/context/ActiveEntityContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  ArrowLeft,
  RefreshCw,
  Phone,
  Mail,
  FileText,
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
  ShoppingCart,
  Search,
  Package,
  ShieldCheck,
  Building,
} from "lucide-react";
import { SupplierContractManagerDialog } from "@/components/purchases/SupplierContractManagerDialog";
import { SupplierCatalogManagerDialog } from "@/components/purchases/SupplierCatalogManagerDialog";
import { CreatePurchaseOrderDialog } from "@/components/purchases/CreatePurchaseOrderDialog";
import { ViewPurchaseOrderDialog } from "@/components/purchases/ViewPurchaseOrderDialog";

export const Route = createFileRoute("/_authenticated/suppliers")({
  component: SuppliersPage,
  head: () => ({
    meta: [
      { title: "Gestión de Proveedores & Catálogo | EasyERP" },
      { name: "description", content: "Directorio de proveedores, contratos PDF versionados y catálogo comercial de productos y servicios." },
    ],
  }),
});

function SuppliersPage() {
  const queryClient = useQueryClient();
  const { activeEntity, activeEntityId } = useActiveEntity();

  // Filtros de búsqueda
  const [searchQuery, setSearchQuery] = useState("");
  const [filterContract, setFilterContract] = useState<string>("all");

  // Diálogo para nuevo proveedor
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [commercialName, setCommercialName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [supplierRequiresContract, setSupplierRequiresContract] = useState(false);

  // Diálogos de Gestión (Contratos y Catálogos - Sprint 37)
  const [contractSupplier, setContractSupplier] = useState<any>(null);
  const [catalogSupplier, setCatalogSupplier] = useState<any>(null);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false);

  // Diálogos de Órdenes de Compra (Sprint 38)
  const [createPOOpen, setCreatePOOpen] = useState(false);
  const [viewPOId, setViewPOId] = useState<string | null>(null);
  const [viewPOOpen, setViewPOOpen] = useState(false);

  // Queries
  const suppliersQuery = useQuery({
    queryKey: ["suppliers", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("parties")
        .select("*, contacts(*), supplier_contracts(id, version_number, is_current, file_name)")
        .eq("classification", "supplier")
        .eq("entity_id", activeEntityId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeEntityId,
  });

  const catalogCountQuery = useQuery({
    queryKey: ["supplier_catalog_count", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return 0;
      const { count, error } = await supabase
        .from("supplier_catalog_items" as any)
        .select("id", { count: "exact", head: true })
        .eq("entity_id", activeEntityId);
      if (error) {
        console.warn("Could not query catalog count:", error);
        return 0;
      }
      return count ?? 0;
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
        .eq("active", true)
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

  const currenciesQuery = useQuery({
    queryKey: ["currencies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("currencies").select("*").order("code");
      if (error) throw error;
      return data ?? [];
    },
  });

  const suppliers = suppliersQuery.data ?? [];
  const warehouses = warehousesQuery.data ?? [];
  const costCenters = costCentersQuery.data ?? [];
  const currencies = currenciesQuery.data ?? [];
  const totalCatalogItems = catalogCountQuery.data ?? 0;

  // Filtrado de proveedores
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s: any) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        s.name?.toLowerCase().includes(query) ||
        s.commercial_name?.toLowerCase().includes(query) ||
        s.tax_id?.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      const hasContract = s.supplier_contracts?.some((c: any) => c.is_current);

      if (filterContract === "with_contract") {
        return s.requires_contract && hasContract;
      }
      if (filterContract === "pending_contract") {
        return s.requires_contract && !hasContract;
      }
      if (filterContract === "no_contract_required") {
        return !s.requires_contract;
      }

      return true;
    });
  }, [suppliers, searchQuery, filterContract]);

  // Métricas
  const totalSuppliersCount = suppliers.length;
  const withValidContractCount = suppliers.filter((s: any) =>
    s.requires_contract && s.supplier_contracts?.some((c: any) => c.is_current)
  ).length;
  const pendingContractCount = suppliers.filter((s: any) =>
    s.requires_contract && !s.supplier_contracts?.some((c: any) => c.is_current)
  ).length;

  // Mutación: Crear nuevo proveedor
  const createSupplierMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Selecciona una empresa primero");
      const { data: party, error: partyError } = await supabase
        .from("parties")
        .insert({
          entity_id: activeEntityId,
          name: supplierName.trim(),
          commercial_name: commercialName.trim() || null,
          tax_id: taxId.trim() || null,
          classification: "supplier",
          requires_contract: supplierRequiresContract,
          enabled: true,
        })
        .select()
        .single();

      if (partyError) throw partyError;

      if (contactName || contactEmail || contactPhone) {
        const { error: contactError } = await supabase.from("contacts").insert({
          entity_id: activeEntityId,
          party_id: party.id,
          first_name: contactName.trim(),
          email: contactEmail.trim() || null,
          phone: contactPhone.trim() || null,
          is_primary: true,
        });
        if (contactError) throw contactError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers", activeEntityId] });
      toast.success("Proveedor registrado exitosamente");
      setNewSupplierOpen(false);
      setSupplierName("");
      setCommercialName("");
      setTaxId("");
      setContactName("");
      setContactEmail("");
      setContactPhone("");
      setSupplierRequiresContract(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al crear el proveedor");
    },
  });

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              <span>Gestión de Proveedores y Catálogo</span>
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1 ml-10">
            Administración centralizada de proveedores, contratos PDF versionados y catálogo comercial de productos/servicios.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              suppliersQuery.refetch();
              catalogCountQuery.refetch();
            }}
            disabled={suppliersQuery.isFetching}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${suppliersQuery.isFetching ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
          >
            <Link to="/purchases">
              <ShoppingCart className="h-3.5 w-3.5 text-primary" />
              <span>Ir a Compras</span>
            </Link>
          </Button>

          {/* Modal Crear Proveedor */}
          <Dialog open={newSupplierOpen} onOpenChange={setNewSupplierOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                <span>Nuevo Proveedor</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Registrar Nuevo Proveedor</DialogTitle>
                <DialogDescription>
                  Ingresa los antecedentes comerciales y de contacto del proveedor.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2 text-xs">
                <div>
                  <Label className="text-xs">Razón Social *</Label>
                  <Input
                    placeholder="ej. Distribuidora Central SpA"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Nombre de Fantasía (Opcional)</Label>
                  <Input
                    placeholder="ej. Central Insumos"
                    value={commercialName}
                    onChange={(e) => setCommercialName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">RUT Proveedor</Label>
                  <Input
                    placeholder="76.123.456-7"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    className="mt-1 font-mono"
                  />
                </div>
                <div className="border-t pt-3 space-y-3">
                  <h4 className="font-semibold text-foreground">Contacto Principal</h4>
                  <div>
                    <Label className="text-xs">Nombre Contacto</Label>
                    <Input
                      placeholder="Juan Pérez"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Email</Label>
                      <Input
                        type="email"
                        placeholder="contacto@proveedor.cl"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Teléfono</Label>
                      <Input
                        placeholder="+56 9 1234 5678"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Switch de Contrato Requerido (Sprint 37) */}
                <div className="flex items-center justify-between border-t pt-3 p-2 bg-muted/40 rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold">Exigir Contrato Formal</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Activa alertas si este proveedor no posee un contrato en PDF vigente.
                    </p>
                  </div>
                  <Switch
                    checked={supplierRequiresContract}
                    onCheckedChange={setSupplierRequiresContract}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createSupplierMutation.mutate()}
                  disabled={createSupplierMutation.isPending || !supplierName.trim()}
                >
                  Guardar Proveedor
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-primary shadow-xs">
          <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>Total Proveedores</span>
            <Building className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-bold mt-2 font-mono">{totalSuppliersCount}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Registrados en la empresa activa</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500 shadow-xs">
          <div className="text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center justify-between">
            <span>Contratos Vigentes</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold mt-2 font-mono text-emerald-600 dark:text-emerald-400">
            {withValidContractCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Acuerdos formales firmados</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500 shadow-xs">
          <div className="text-xs text-amber-700 dark:text-amber-300 font-medium flex items-center justify-between">
            <span>Contratos Pendientes</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold mt-2 font-mono text-amber-600 dark:text-amber-400">
            {pendingContractCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Requieren contrato formal</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-purple-500 shadow-xs">
          <div className="text-xs text-purple-700 dark:text-purple-300 font-medium flex items-center justify-between">
            <span>Ítems en Catálogos</span>
            <Package className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold mt-2 font-mono text-purple-600 dark:text-purple-400">
            {totalCatalogItems}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Productos y servicios parametrizados</p>
        </Card>
      </div>

      {/* Tabla Principal y Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <CardTitle className="text-base font-semibold">Directorio de Proveedores y Acuerdos</CardTitle>
              <CardDescription>
                Administra contratos vigentes en PDF, catálogos comerciales con carga Excel y emisión de órdenes de compra.
              </CardDescription>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-3 text-muted-foreground" />
                <Input
                  placeholder="Buscar por RUT o razón social..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>

              <Select value={filterContract} onValueChange={setFilterContract}>
                <SelectTrigger className="h-8 text-xs w-full sm:w-44">
                  <SelectValue placeholder="Estado de contrato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los contratos</SelectItem>
                  <SelectItem value="with_contract">Con contrato vigente</SelectItem>
                  <SelectItem value="pending_contract">Pendiente de contrato</SelectItem>
                  <SelectItem value="no_contract_required">No requerido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredSuppliers.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Building2 className="mx-auto h-9 w-9 mb-2 opacity-40 text-primary" />
              <p className="text-sm font-medium">No se encontraron proveedores.</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {searchQuery || filterContract !== "all"
                  ? "Prueba cambiando los criterios del filtro de búsqueda."
                  : "Registra tu primer proveedor para comenzar a gestionar sus contratos y catálogos."}
              </p>
              {(!searchQuery && filterContract === "all") && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 text-xs gap-1.5"
                  onClick={() => setNewSupplierOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Registrar primer proveedor
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="w-[120px]">RUT</TableHead>
                    <TableHead>Razón Social / Fantasía</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Email / Fono</TableHead>
                    <TableHead className="text-center">Contrato Formal</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Acciones de Gestión</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((s: any) => {
                    const primaryContact = s.contacts?.[0];
                    const currentContract = s.supplier_contracts?.find((c: any) => c.is_current);

                    return (
                      <TableRow key={s.id} className="text-xs">
                        <TableCell className="font-mono text-xs font-semibold">{s.tax_id || "-"}</TableCell>
                        <TableCell>
                          <div className="font-semibold text-xs">{s.name}</div>
                          {s.commercial_name && (
                            <div className="text-[11px] text-muted-foreground italic">
                              {s.commercial_name}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {primaryContact?.first_name || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-mono">{primaryContact?.email || "—"}</div>
                          {primaryContact?.phone && (
                            <div className="text-[10px] text-muted-foreground font-mono">{primaryContact.phone}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {s.requires_contract ? (
                            currentContract ? (
                              <Badge
                                variant="outline"
                                className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] gap-1 cursor-pointer hover:bg-emerald-500/20"
                                onClick={() => {
                                  setContractSupplier(s);
                                  setContractDialogOpen(true);
                                }}
                              >
                                <CheckCircle className="h-3 w-3" />
                                <span>Vigente (v{currentContract.version_number})</span>
                              </Badge>
                            ) : (
                              <Badge
                                variant="destructive"
                                className="text-[10px] gap-1 cursor-pointer hover:opacity-90"
                                onClick={() => {
                                  setContractSupplier(s);
                                  setContractDialogOpen(true);
                                }}
                              >
                                <AlertTriangle className="h-3 w-3" />
                                <span>Pendiente</span>
                              </Badge>
                            )
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Opcional</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={s.enabled ? "default" : "secondary"} className="text-[10px]">
                            {s.enabled ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Botón Catálogo de Ítems */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => {
                                setCatalogSupplier(s);
                                setCatalogDialogOpen(true);
                              }}
                            >
                              <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600" />
                              <span>Catálogo</span>
                            </Button>

                            {/* Botón Contratos PDF */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => {
                                setContractSupplier(s);
                                setContractDialogOpen(true);
                              }}
                            >
                              <FileText className="h-3.5 w-3.5 text-purple-600" />
                              <span>Contratos</span>
                            </Button>
                          </div>
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

      {/* Diálogos de Gestión de Proveedores (Sprint 37) */}
      <SupplierContractManagerDialog
        open={contractDialogOpen}
        onOpenChange={setContractDialogOpen}
        supplier={contractSupplier}
        entityId={activeEntityId || ""}
      />
      <SupplierCatalogManagerDialog
        open={catalogDialogOpen}
        onOpenChange={setCatalogDialogOpen}
        supplier={catalogSupplier}
        entityId={activeEntityId || ""}
      />

      {/* Diálogos de Órdenes de Compra (Sprint 38) */}
      <CreatePurchaseOrderDialog
        open={createPOOpen}
        onOpenChange={setCreatePOOpen}
        entityId={activeEntityId || ""}
        suppliers={suppliers}
        warehouses={warehouses}
        costCenters={costCenters}
        currencies={currencies}
        onSuccess={(newId) => {
          setViewPOId(newId);
          setViewPOOpen(true);
        }}
      />
      <ViewPurchaseOrderDialog
        open={viewPOOpen}
        onOpenChange={setViewPOOpen}
        purchaseOrderId={viewPOId}
      />
    </div>
  );
}
