import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
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
  Users,
  Plus,
  ArrowLeft,
  RefreshCw,
  Phone,
  Mail,
  FileText,
  DollarSign,
  Trash2,
  CheckCircle,
  Receipt,
  AlertCircle,
  CreditCard,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/sales")({
  component: SalesPage,
  head: () => ({
    meta: [
      { title: "Ventas & Facturación | EasyERP" },
      { name: "description", content: "Facturas de venta, posteo automático a contabilidad/inventario y cuentas por cobrar." },
    ],
  }),
});

interface InvoiceLineForm {
  item_id?: string;
  warehouse_id?: string;
  description: string;
  qty: string;
  unit_price: string;
  tax_rate: string;
}

function SalesPage() {
  const queryClient = useQueryClient();
  const { activeEntity, activeEntityId } = useActiveEntity();

  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<any>(null);

  // Form State Cliente
  const [customerName, setCustomerName] = useState("");
  const [commercialName, setCommercialName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Form State Factura de Venta
  const [invPartyId, setInvPartyId] = useState("");
  const [invWarehouseId, setInvWarehouseId] = useState<string>("");
  const [invCostCenterId, setInvCostCenterId] = useState<string>("");
  const [invBusinessUnitId, setInvBusinessUnitId] = useState<string>("");
  const [invCurrency, setInvCurrency] = useState("CLP");
  const [invRate, setInvRate] = useState("1.0");
  const [invDate, setInvDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [invDueDate, setInvDueDate] = useState("");
  const [invMemo, setInvMemo] = useState("");
  const [lines, setLines] = useState<InvoiceLineForm[]>([
    { item_id: "", description: "", qty: "1", unit_price: "0", tax_rate: "19" },
  ]);

  // Form State Cobranza
  const [payAmount, setPayAmount] = useState("");
  const [payBankAcc, setPayBankAcc] = useState("");
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [payMemo, setPayMemo] = useState("");

  const baseCurrency = activeEntity?.base_currency_code || "CLP";

  // Queries
  const currenciesQuery = useQuery({
    queryKey: ["currencies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("currencies").select("*").order("code");
      if (error) throw error;
      return data ?? [];
    },
  });

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

  const itemsQuery = useQuery({
    queryKey: ["items", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("entity_id", activeEntityId)
        .eq("active", true)
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

  const bankAccountsQuery = useQuery({
    queryKey: ["bank_accounts", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("entity_id", activeEntityId)
        .eq("account_type", "Asset")
        .order("code");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeEntityId,
  });

  const salesInvoicesQuery = useQuery({
    queryKey: ["sales_invoices", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("sales_invoices")
        .select(`
          *,
          parties(name, tax_id),
          warehouses(name),
          sales_invoice_lines(*, items(code, name))
        `)
        .eq("entity_id", activeEntityId)
        .order("issue_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!activeEntityId,
  });

  const balancesQuery = useQuery({
    queryKey: ["sales_invoice_balances", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("sales_invoice_balances" as any)
        .select("*")
        .eq("entity_id", activeEntityId);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!activeEntityId,
  });

  const customers = customersQuery.data ?? [];
  const items = itemsQuery.data ?? [];
  const warehouses = warehousesQuery.data ?? [];
  const costCenters = costCentersQuery.data ?? [];
  const businessUnits = businessUnitsQuery.data ?? [];
  const bankAccounts = bankAccountsQuery.data ?? [];
  const currencies = currenciesQuery.data ?? [];
  const salesInvoices = salesInvoicesQuery.data ?? [];
  const balances = balancesQuery.data ?? [];

  // Cálculos dinámicos de líneas de factura
  const computedInvoiceTotals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;

    const computed = lines.map((l) => {
      const q = parseFloat(l.qty || "0") || 0;
      const p = parseFloat(l.unit_price || "0") || 0;
      const tr = parseFloat(l.tax_rate || "0") || 0;
      const total = q * p;
      const tAmount = Math.round(total * (tr / 100));

      subtotal += total;
      tax += tAmount;

      return {
        ...l,
        numQty: q,
        numPrice: p,
        numTaxRate: tr,
        lineTotal: total,
        lineTax: tAmount,
      };
    });

    const grandTotal = subtotal + tax;
    return { computed, subtotal, tax, grandTotal };
  }, [lines]);

  // Manejo de líneas
  const handleAddLine = () => {
    setLines([...lines, { item_id: "", description: "", qty: "1", unit_price: "0", tax_rate: "19" }]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof InvoiceLineForm, value: string) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };

    if (field === "item_id") {
      const it = items.find((i) => i.id === value);
      if (it) {
        updated[index].description = it.name;
      }
    }

    setLines(updated);
  };

  // Mutations
  const createCustomerMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Selecciona una empresa primero");
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

  const createInvoiceMutation = useMutation({
    mutationFn: async (shouldPostNow: boolean) => {
      if (!activeEntityId) throw new Error("Selecciona una empresa primero");
      if (!invPartyId) throw new Error("Selecciona un cliente");
      if (computedInvoiceTotals.grandTotal <= 0) throw new Error("La factura debe tener un monto total mayor a cero");

      // 1. Crear cabecera
      const { data: inv, error: invError } = await supabase
        .from("sales_invoices")
        .insert({
          entity_id: activeEntityId,
          party_id: invPartyId,
          warehouse_id: invWarehouseId || null,
          cost_center_id: invCostCenterId || null,
          business_unit_id: invBusinessUnitId || null,
          currency_code: invCurrency,
          exchange_rate: parseFloat(invRate || "1.0") || 1.0,
          issue_date: invDate,
          due_date: invDueDate || null,
          subtotal_amount: computedInvoiceTotals.subtotal,
          tax_amount: computedInvoiceTotals.tax,
          total_amount: computedInvoiceTotals.grandTotal,
          memo: invMemo.trim() || null,
          status: "draft",
        })
        .select()
        .single();

      if (invError) throw invError;

      // 2. Crear líneas
      const linesToInsert = computedInvoiceTotals.computed.map((l) => ({
        sales_invoice_id: inv.id,
        item_id: l.item_id || null,
        warehouse_id: invWarehouseId || null,
        description: l.description.trim() || "Venta de productos o servicios",
        qty: l.numQty,
        unit_price: l.numPrice,
        tax_rate: l.numTaxRate,
        line_total: l.lineTotal,
      }));

      const { error: linesErr } = await supabase
        .from("sales_invoice_lines" as any)
        .insert(linesToInsert);

      if (linesErr) throw linesErr;

      // 3. Si se solicitó postear inmediatamente
      if (shouldPostNow) {
        const { data: postRes, error: postErr } = await supabase.rpc("post_sales_invoice", {
          _invoice_id: inv.id,
        });
        if (postErr) throw postErr;
        return postRes;
      }

      return inv;
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["sales_invoices", activeEntityId] });
      queryClient.invalidateQueries({ queryKey: ["sales_invoice_balances", activeEntityId] });
      queryClient.invalidateQueries({ queryKey: ["journal_entries", activeEntityId] });
      queryClient.invalidateQueries({ queryKey: ["stock_ledger_entries", activeEntityId] });
      queryClient.invalidateQueries({ queryKey: ["stock_balances", activeEntityId] });
      toast.success(res?.invoice_number ? `Factura ${res.invoice_number} posteada con éxito` : "Factura guardada en borrador");
      setNewInvoiceOpen(false);
      setInvPartyId("");
      setInvMemo("");
      setLines([{ item_id: "", description: "", qty: "1", unit_price: "0", tax_rate: "19" }]);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al procesar factura");
    },
  });

  const postInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data, error } = await supabase.rpc("post_sales_invoice", {
        _invoice_id: invoiceId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["sales_invoices", activeEntityId] });
      queryClient.invalidateQueries({ queryKey: ["sales_invoice_balances", activeEntityId] });
      queryClient.invalidateQueries({ queryKey: ["journal_entries", activeEntityId] });
      queryClient.invalidateQueries({ queryKey: ["stock_ledger_entries", activeEntityId] });
      queryClient.invalidateQueries({ queryKey: ["stock_balances", activeEntityId] });
      toast.success(`Factura ${res?.invoice_number || ""} confirmada y posteada al Libro Diario e Inventario`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al confirmar factura");
    },
  });

  const registerPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedInvoiceForPayment) throw new Error("Seleccione una factura");
      const amt = parseFloat(payAmount);
      if (isNaN(amt) || amt <= 0) throw new Error("Monto de pago inválido");
      if (!payBankAcc) throw new Error("Seleccione una cuenta de tesorería/banco");

      const { error } = await supabase.from("invoice_payments" as any).insert({
        entity_id: activeEntityId,
        sales_invoice_id: selectedInvoiceForPayment.id,
        amount: amt,
        currency_code: selectedInvoiceForPayment.currency_code || baseCurrency,
        payment_date: payDate,
        bank_account_id: payBankAcc,
        memo: payMemo.trim() || `Cobro Factura ${selectedInvoiceForPayment.invoice_number}`,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_invoices", activeEntityId] });
      queryClient.invalidateQueries({ queryKey: ["sales_invoice_balances", activeEntityId] });
      toast.success("Cobranza registrada correctamente");
      setPaymentOpen(false);
      setPayAmount("");
      setPayMemo("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al registrar cobranza");
    },
  });

  const totalInvoiced = balances.reduce((s, b) => s + Number(b.total_amount || 0), 0);
  const totalCollected = balances.reduce((s, b) => s + Number(b.paid_amount || 0), 0);
  const totalReceivable = balances.reduce((s, b) => s + Number(b.balance_due || 0), 0);

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
            customersQuery.refetch();
            salesInvoicesQuery.refetch();
            balancesQuery.refetch();
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
              <Users className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Módulo de Ventas & Facturación</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Ciclo transaccional completo: Emisión de facturas (DTE), IVA Débito (19%), costo de venta FIFO y cobranzas.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Dialog Crear Cliente */}
          <Dialog open={newCustomerOpen} onOpenChange={setNewCustomerOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Nuevo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Registrar Nuevo Cliente</DialogTitle>
                <DialogDescription>
                  Ingresa la información comercial y RUT del cliente.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-3">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="taxId" className="text-right">RUT / Tax ID</Label>
                  <Input
                    id="taxId"
                    placeholder="ej. 76.123.456-K"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    className="col-span-3 font-mono"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Razón Social</Label>
                  <Input
                    id="name"
                    placeholder="ej. Distribuidora del Norte SpA"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="commName" className="text-right">Nombre Fantasía</Label>
                  <Input
                    id="commName"
                    placeholder="ej. Del Norte Distribuciones"
                    value={commercialName}
                    onChange={(e) => setCommercialName(e.target.value)}
                    className="col-span-3"
                  />
                </div>
                <div className="border-t pt-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Contacto Principal
                  </h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="contactName" className="text-right text-xs">Nombre</Label>
                      <Input
                        id="contactName"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="contactEmail" className="text-right text-xs">Email</Label>
                      <Input
                        id="contactEmail"
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="contactPhone" className="text-right text-xs">Teléfono</Label>
                      <Input
                        id="contactPhone"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        className="col-span-3"
                      />
                    </div>
                  </div>
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

          {/* Dialog Crear Factura de Venta */}
          <Dialog open={newInvoiceOpen} onOpenChange={setNewInvoiceOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Receipt className="mr-1.5 h-3.5 w-3.5" />
                Nueva Factura de Venta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Emitir Factura de Venta</DialogTitle>
                <DialogDescription>
                  Genera el documento con cálculo automático de IVA 19%, asiento contable y rebaja de existencias FIFO.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-3 border-b">
                <div className="md:col-span-2">
                  <Label className="text-xs font-semibold">Cliente *</Label>
                  <Select value={invPartyId} onValueChange={setInvPartyId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Seleccione cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} {c.tax_id ? `(${c.tax_id})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Bodega de Despacho</Label>
                  <Select value={invWarehouseId} onValueChange={setInvWarehouseId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Bodega por defecto" />
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
                  <Label className="text-xs font-semibold">Moneda</Label>
                  <Select value={invCurrency} onValueChange={setInvCurrency}>
                    <SelectTrigger className="mt-1 font-mono">
                      <SelectValue placeholder="Moneda" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.code} ({c.symbol || "$"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Fecha de Emisión</Label>
                  <Input
                    type="date"
                    value={invDate}
                    onChange={(e) => setInvDate(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Centro de Costo</Label>
                  <Select value={invCostCenterId} onValueChange={setInvCostCenterId}>
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
                  <Select value={invBusinessUnitId} onValueChange={setInvBusinessUnitId}>
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

                <div>
                  <Label className="text-xs font-semibold">Tasa de Cambio ({baseCurrency})</Label>
                  <Input
                    type="number"
                    step="any"
                    value={invRate}
                    onChange={(e) => setInvRate(e.target.value)}
                    disabled={invCurrency === baseCurrency}
                    className="mt-1 font-mono"
                  />
                </div>
              </div>

              {/* Tabla de Líneas de Factura */}
              <div className="py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Detalle de Productos & Servicios
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddLine}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Agregar Ítem
                  </Button>
                </div>

                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[30%]">Artículo</TableHead>
                        <TableHead className="w-[30%]">Descripción</TableHead>
                        <TableHead className="w-[12%] text-right">Cantidad</TableHead>
                        <TableHead className="w-[14%] text-right">Precio Unitario</TableHead>
                        <TableHead className="w-[14%] text-right">Subtotal</TableHead>
                        <TableHead className="w-[4%] text-center"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((line, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="p-2">
                            <Select
                              value={line.item_id || ""}
                              onValueChange={(val) => handleLineChange(idx, "item_id", val)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Seleccionar producto" />
                              </SelectTrigger>
                              <SelectContent>
                                {items.map((it) => (
                                  <SelectItem key={it.id} value={it.id}>
                                    {it.code} - {it.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              value={line.description}
                              onChange={(e) => handleLineChange(idx, "description", e.target.value)}
                              className="h-8 text-xs"
                              placeholder="Glosa del producto"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              step="any"
                              value={line.qty}
                              onChange={(e) => handleLineChange(idx, "qty", e.target.value)}
                              className="h-8 text-right font-mono text-xs"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              step="any"
                              value={line.unit_price}
                              onChange={(e) => handleLineChange(idx, "unit_price", e.target.value)}
                              className="h-8 text-right font-mono text-xs"
                            />
                          </TableCell>
                          <TableCell className="p-2 text-right font-mono text-xs font-semibold">
                            $ {((parseFloat(line.qty || "0") || 0) * (parseFloat(line.unit_price || "0") || 0)).toLocaleString("es-CL")}
                          </TableCell>
                          <TableCell className="p-2 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveLine(idx)}
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Resumen de Totales e Impuestos */}
                <div className="mt-4 flex justify-end">
                  <div className="w-72 space-y-1.5 text-xs font-mono bg-muted/40 p-3 rounded border">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal Neto:</span>
                      <span className="font-semibold">$ {computedInvoiceTotals.subtotal.toLocaleString("es-CL")} {invCurrency}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IVA Débito Fiscal (19%):</span>
                      <span className="font-semibold text-primary">$ {computedInvoiceTotals.tax.toLocaleString("es-CL")} {invCurrency}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1 text-sm font-bold">
                      <span>Total Factura:</span>
                      <span className="text-foreground">$ {computedInvoiceTotals.grandTotal.toLocaleString("es-CL")} {invCurrency}</span>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => createInvoiceMutation.mutate(false)}
                  disabled={createInvoiceMutation.isPending || !invPartyId}
                >
                  Guardar como Borrador
                </Button>
                <Button
                  onClick={() => createInvoiceMutation.mutate(true)}
                  disabled={createInvoiceMutation.isPending || !invPartyId || computedInvoiceTotals.grandTotal <= 0}
                >
                  Confirmar y Postear a Contabilidad / Inventario
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Dialog Registrar Cobranza */}
          <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Registrar Cobranza de Factura</DialogTitle>
                <DialogDescription>
                  Aplica un cobro a la factura {selectedInvoiceForPayment?.invoice_number}.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-3">
                <div>
                  <Label className="text-xs">Monto a Cobrar ($)</Label>
                  <Input
                    type="number"
                    step="any"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs">Cuenta Corriente / Caja Receptora</Label>
                  <Select value={payBankAcc} onValueChange={setPayBankAcc}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Seleccione banco" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.code} - {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Fecha de Pago</Label>
                  <Input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Glosa / Comprobante de Transferencia</Label>
                  <Input
                    placeholder="ej. Transferencia Banco Santander #8492"
                    value={payMemo}
                    onChange={(e) => setPayMemo(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => registerPaymentMutation.mutate()}
                  disabled={registerPaymentMutation.isPending || !payAmount || !payBankAcc}
                >
                  Registrar Cobro
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
              Total Facturado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              $ {totalInvoiced.toLocaleString("es-CL")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ventas emitidas ({baseCurrency})</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Total Cobrado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              $ {totalCollected.toLocaleString("es-CL")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ingresos recaudados ({baseCurrency})</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Saldo Pendiente (CxC Clientes)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
              $ {totalReceivable.toLocaleString("es-CL")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Por recaudar ({baseCurrency})</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="invoices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="invoices" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            <span>Facturas de Venta ({salesInvoices.length})</span>
          </TabsTrigger>
          <TabsTrigger value="balances" className="flex items-center gap-1.5">
            <DollarSign className="h-4 w-4" />
            <span>Cuentas por Cobrar & Saldos</span>
          </TabsTrigger>
          <TabsTrigger value="customers" className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            <span>Directorio de Clientes ({customers.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab Facturas de Venta */}
        <TabsContent value="invoices">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Facturas Emitidas</CardTitle>
              <CardDescription>
                Documentos tributarios con posteo automático al mayor contable e inventario.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {salesInvoices.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Receipt className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No hay facturas de venta emitidas.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setNewInvoiceOpen(true)}
                  >
                    Emitir primera factura
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">N° Factura</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Neto</TableHead>
                        <TableHead className="text-right">IVA 19%</TableHead>
                        <TableHead className="text-right">Total Factura</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                        <TableHead className="text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesInvoices.map((inv) => {
                        const isConfirmed = inv.status === "confirmed";
                        const isDraft = inv.status === "draft";

                        return (
                          <TableRow key={inv.id}>
                            <TableCell className="font-mono font-bold text-xs text-primary">
                              {inv.invoice_number || "FVE-BORRADOR"}
                            </TableCell>
                            <TableCell className="text-xs font-medium">
                              <div>{inv.parties?.name}</div>
                              <div className="text-[11px] text-muted-foreground font-mono">{inv.parties?.tax_id}</div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{inv.issue_date}</TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              $ {Number(inv.subtotal_amount).toLocaleString("es-CL")}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">
                              $ {Number(inv.tax_amount).toLocaleString("es-CL")}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-bold">
                              $ {Number(inv.total_amount).toLocaleString("es-CL")} {inv.currency_code}
                            </TableCell>
                            <TableCell className="text-center">
                              {isConfirmed && (
                                <Badge className="bg-emerald-600 text-white text-xs">Confirmada</Badge>
                              )}
                              {isDraft && (
                                <Badge variant="secondary" className="text-xs">Borrador</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {isDraft && (
                                <Button
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => postInvoiceMutation.mutate(inv.id)}
                                  disabled={postInvoiceMutation.isPending}
                                >
                                  Confirmar
                                </Button>
                              )}
                              {isConfirmed && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    setSelectedInvoiceForPayment(inv);
                                    setPayAmount(String(inv.total_amount));
                                    setPaymentOpen(true);
                                  }}
                                >
                                  <CreditCard className="h-3 w-3 mr-1" />
                                  Cobrar
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

        {/* Tab Cuentas por Cobrar & Saldos */}
        <TabsContent value="balances">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Cuentas por Cobrar a Clientes (CxC)</CardTitle>
              <CardDescription>
                Control de saldos pendientes, facturado y pagos aplicados por cliente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {balances.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <p className="text-sm">No hay saldos de clientes pendientes.</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N° Factura</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>RUT</TableHead>
                        <TableHead>Emisión</TableHead>
                        <TableHead className="text-right">Total Facturado</TableHead>
                        <TableHead className="text-right">Total Cobrado</TableHead>
                        <TableHead className="text-right">Saldo Pendiente</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {balances.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="font-mono text-xs font-bold text-primary">
                            {b.invoice_number}
                          </TableCell>
                          <TableCell className="text-xs font-semibold">{b.party_name}</TableCell>
                          <TableCell className="font-mono text-xs">{b.party_tax_id || "-"}</TableCell>
                          <TableCell className="font-mono text-xs">{b.issue_date}</TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            $ {Number(b.total_amount).toLocaleString("es-CL")}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-emerald-600 font-medium">
                            $ {Number(b.paid_amount).toLocaleString("es-CL")}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-bold text-amber-600">
                            $ {Number(b.balance_due).toLocaleString("es-CL")}
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

        {/* Tab Directorio de Clientes */}
        <TabsContent value="customers">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Directorio de Clientes</CardTitle>
              <CardDescription>
                Registro de clientes con RUT y contactos para facturación.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {customers.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Users className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No hay clientes registrados aún.</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">RUT</TableHead>
                        <TableHead>Razón Social</TableHead>
                        <TableHead>Contacto</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Teléfono</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.map((c) => {
                        const primaryContact = c.contacts?.[0];
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="font-mono text-xs font-semibold">{c.tax_id || "-"}</TableCell>
                            <TableCell className="text-xs font-semibold">{c.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{primaryContact?.first_name || "-"}</TableCell>
                            <TableCell className="text-xs font-mono">{primaryContact?.email || "-"}</TableCell>
                            <TableCell className="text-xs font-mono">{primaryContact?.phone || "-"}</TableCell>
                            <TableCell className="text-center">
                              <span className={`inline-block h-2 w-2 rounded-full ${c.enabled ? "bg-emerald-500" : "bg-red-500"}`} />
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
      </Tabs>
    </div>
  );
}
