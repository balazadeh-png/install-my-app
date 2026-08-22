import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShoppingCart, Plus, ArrowLeft, RefreshCw, Phone, Mail, Building2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/purchases")({
  component: PurchasesPage,
  head: () => ({
    meta: [
      { title: "Compras & Proveedores | Cacao Accounting" },
      { name: "description", content: "Directorio de proveedores y control de compras y gastos." },
    ],
  }),
});

function PurchasesPage() {
  const queryClient = useQueryClient();
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);

  // Form State
  const [supplierName, setSupplierName] = useState("");
  const [commercialName, setCommercialName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Query: Proveedores
  const suppliersQuery = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parties")
        .select("*, contacts(*)")
        .eq("classification", "supplier")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Mutation: Crear Proveedor
  const createSupplierMutation = useMutation({
    mutationFn: async () => {
      // 1. Insert Party
      const { data: party, error: partyError } = await supabase
        .from("parties")
        .insert({
          name: supplierName.trim(),
          commercial_name: commercialName.trim() || null,
          tax_id: taxId.trim() || null,
          classification: "supplier",
          enabled: true,
        })
        .select()
        .single();

      if (partyError) throw partyError;

      // 2. Insert Contact if provided
      if (contactName || contactEmail || contactPhone) {
        const { error: contactError } = await supabase.from("contacts").insert({
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
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Proveedor registrado exitosamente");
      setNewSupplierOpen(false);
      setSupplierName("");
      setCommercialName("");
      setTaxId("");
      setContactName("");
      setContactEmail("");
      setContactPhone("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al registrar proveedor");
    },
  });

  const suppliers = suppliersQuery.data ?? [];

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
        <Button variant="outline" size="sm" onClick={() => suppliersQuery.refetch()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Actualizar
        </Button>
      </div>

      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShoppingCart className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Módulo de Compras & Proveedores</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Control de cuentas por pagar, directorio de suplidores, compras y registro de gastos.
          </p>
        </div>

        {/* Dialog Crear Proveedor */}
        <Dialog open={newSupplierOpen} onOpenChange={setNewSupplierOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Nuevo Proveedor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Registrar Nuevo Proveedor</DialogTitle>
              <DialogDescription>
                Ingresa la información comercial y de contacto del suplidor.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-3">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="sName" className="text-right">Razón Social</Label>
                <Input
                  id="sName"
                  placeholder="ej. Importaciones Centroamericanas S.A."
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="sCommercial" className="text-right">Nombre Comercial</Label>
                <Input
                  id="sCommercial"
                  placeholder="ej. ImporSur"
                  value={commercialName}
                  onChange={(e) => setCommercialName(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="sTaxId" className="text-right">RUC</Label>
                <Input
                  id="sTaxId"
                  placeholder="ej. J0310000005678"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className="col-span-3 font-mono"
                />
              </div>

              <div className="pt-2 border-t text-xs font-semibold text-muted-foreground">
                Persona de Contacto / Asesor
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="sContact" className="text-right">Contacto</Label>
                <Input
                  id="sContact"
                  placeholder="Nombre del ejecutivo de ventas"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="sEmail" className="text-right">Correo</Label>
                <Input
                  id="sEmail"
                  type="email"
                  placeholder="ventas@proveedor.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="sPhone" className="text-right">Teléfono</Label>
                <Input
                  id="sPhone"
                  placeholder="+505 2222-2222"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createSupplierMutation.mutate()}
                disabled={createSupplierMutation.isPending || !supplierName}
              >
                Guardar Proveedor
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Proveedores Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Directorio de Suplidores ({suppliers.length})</CardTitle>
          <CardDescription>
            Proveedores autorizados para compras de mercadería, materias primas y servicios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {suppliers.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <ShoppingCart className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No hay proveedores registrados aún.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setNewSupplierOpen(true)}
              >
                Registrar primer proveedor
              </Button>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Razón Social / Proveedor</TableHead>
                    <TableHead>Nombre Comercial</TableHead>
                    <TableHead>RUC</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((s) => {
                    const primaryContact = s.contacts?.[0];
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-semibold text-foreground">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span>{s.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{s.commercial_name || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{s.tax_id || "No especificado"}</TableCell>
                        <TableCell className="text-xs">
                          {primaryContact ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-foreground">{primaryContact.first_name}</span>
                              <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                                {primaryContact.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{primaryContact.email}</span>}
                                {primaryContact.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{primaryContact.phone}</span>}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Sin contacto</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={s.enabled ? "outline" : "secondary"} className="text-xs">
                            {s.enabled ? "Activo" : "Inactivo"}
                          </Badge>
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
    </div>
  );
}
