import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
import { toast } from "sonner";
import { Users, Plus, ArrowLeft, RefreshCw, Phone, Mail, Building } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sales")({
  component: SalesPage,
  head: () => ({
    meta: [
      { title: "Ventas & Clientes | EasyERP" },
      { name: "description", content: "Gestión de clientes, contactos y operaciones comerciales." },
    ],
  }),
});

function SalesPage() {
  const queryClient = useQueryClient();
  const { activeEntityId } = useActiveEntity();
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);

  // Form State
  const [customerName, setCustomerName] = useState("");
  const [commercialName, setCommercialName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Query: Clientes
  const customersQuery = useQuery({
    queryKey: ["customers", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("parties")
        .select("*, contacts(*)")
        .eq("classification", "customer")
        .eq("entity_id", activeEntityId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeEntityId,
  });

  // Mutation: Crear Cliente
  const createCustomerMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Selecciona una empresa primero");
      // 1. Insert Party
      const { data: party, error: partyError } = await supabase
        .from("parties")
        .insert({
          entity_id: activeEntityId,
          name: customerName.trim(),
          commercial_name: commercialName.trim() || null,
          tax_id: taxId.trim() || null,
          classification: "customer",
          enabled: true,
        })
        .select()
        .single();

      if (partyError) throw partyError;

      // 2. Insert Contact if provided
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
      queryClient.invalidateQueries({ queryKey: ["customers", activeEntityId] });
      toast.success("Cliente registrado con éxito");
      setNewCustomerOpen(false);
      setCustomerName("");
      setCommercialName("");
      setTaxId("");
      setContactName("");
      setContactEmail("");
      setContactPhone("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al registrar cliente");
    },
  });

  const customers = customersQuery.data ?? [];

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
        <Button variant="outline" size="sm" onClick={() => customersQuery.refetch()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Actualizar
        </Button>
      </div>

      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Módulo de Ventas & Clientes</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Administración del directorio de clientes, personas de contacto, RUC y cuentas por cobrar.
          </p>
        </div>

        {/* Dialog Crear Cliente */}
        <Dialog open={newCustomerOpen} onOpenChange={setNewCustomerOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Nuevo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Registrar Nuevo Cliente</DialogTitle>
              <DialogDescription>
                Ingresa la información general y de contacto del cliente.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-3">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Razón Social</Label>
                <Input
                  id="name"
                  placeholder="ej. Distribuidora del Norte S.A."
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="commercial" className="text-right">Nombre Comercial</Label>
                <Input
                  id="commercial"
                  placeholder="ej. MaxiDistribuidora"
                  value={commercialName}
                  onChange={(e) => setCommercialName(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="taxId" className="text-right">RUT</Label>
                <Input
                  id="taxId"
                  placeholder="ej. 76.123.456-K"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className="col-span-3 font-mono"
                />
              </div>

              <div className="pt-2 border-t text-xs font-semibold text-muted-foreground">
                Información de Contacto Principal
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="contact" className="text-right">Contacto</Label>
                <Input
                  id="contact"
                  placeholder="Nombre de la persona"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">Correo</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="cliente@empresa.cl"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phone" className="text-right">Teléfono</Label>
                <Input
                  id="phone"
                  placeholder="+56 9 1234 5678"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createCustomerMutation.mutate()}
                disabled={createCustomerMutation.isPending || !customerName}
              >
                Guardar Cliente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Clientes Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Directorio de Clientes ({customers.length})</CardTitle>
          <CardDescription>
            Terceros registrados con perfil de clientes para facturación y cuentas por cobrar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Users className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No hay clientes registrados aún.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setNewCustomerOpen(true)}
              >
                Registrar primer cliente
              </Button>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Razón Social / Cliente</TableHead>
                    <TableHead>Nombre Comercial</TableHead>
                    <TableHead>RUT</TableHead>
                    <TableHead>Contacto Principal</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((c) => {
                    const primaryContact = c.contacts?.[0];
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-semibold text-foreground">
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            <span>{c.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{c.commercial_name || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{c.tax_id || "No especificado"}</TableCell>
                        <TableCell className="text-xs">
                          {primaryContact ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-foreground">{primaryContact.first_name} {primaryContact.last_name || ""}</span>
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
                          <Badge variant={c.enabled ? "outline" : "secondary"} className="text-xs">
                            {c.enabled ? "Activo" : "Inactivo"}
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
