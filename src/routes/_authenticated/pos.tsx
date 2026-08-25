import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEntity } from "@/context/ActiveEntityContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CreditCard,
  Banknote,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Lock,
  Unlock,
  RefreshCw,
  Search,
  ArrowLeft,
  DollarSign,
  Receipt,
  User,
  CheckCircle2,
  Store,
  Wallet,
  Coins,
  History,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/pos")({
  component: PosPage,
  head: () => ({
    meta: [
      { title: "Punto de Venta (POS) | EasyERP" },
      { name: "description", content: "Terminal de venta mostrador, boletas electrónicas, turnos y arqueo de caja." },
    ],
  }),
});

interface CartItem {
  item_id: string;
  sku: string;
  name: string;
  quantity: number;
  unit_price: number;
  is_exempt: boolean;
}

interface PaymentLine {
  payment_method: "efectivo" | "tarjeta_debito" | "tarjeta_credito" | "transferencia" | "otro";
  amount: number;
  reference_number?: string;
}

function PosPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activeEntity, activeEntityId } = useActiveEntity();

  // Tab State
  const [activeTab, setActiveTab] = useState<"pos" | "history">("pos");

  // Form State Apertura de Caja
  const [openWarehouseId, setOpenWarehouseId] = useState("");
  const [openBusinessUnitId, setOpenBusinessUnitId] = useState("");
  const [openInitialAmount, setOpenInitialAmount] = useState("0");
  const [openNotes, setOpenNotes] = useState("");

  // Form State Venta POS
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payModalOpen, setPayModalOpen] = useState(false);

  // Payment Lines in Checkout Modal
  const [payments, setPayments] = useState<PaymentLine[]>([{ payment_method: "efectivo", amount: 0 }]);
  const [cashTendered, setCashTendered] = useState<string>("0");

  // Form State Cierre de Caja
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [countedCash, setCountedCash] = useState("");

  const baseCurrency = activeEntity?.base_currency_code || "CLP";

  // Queries
  const activeSessionQuery = useQuery({
    queryKey: ["pos_active_session", activeEntityId, user?.id],
    queryFn: async () => {
      if (!activeEntityId || !user?.id) return null;
      const { data, error } = await supabase
        .from("pos_sessions" as any)
        .select("*, warehouses(name), business_units(name)")
        .eq("entity_id", activeEntityId)
        .eq("opened_by", user.id)
        .eq("status", "open")
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!activeEntityId && !!user?.id,
  });

  const sessionHistoryQuery = useQuery({
    queryKey: ["pos_session_history", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("pos_sessions" as any)
        .select("*, warehouses(name), business_units(name)")
        .eq("entity_id", activeEntityId)
        .order("opened_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
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

  const partiesQuery = useQuery({
    queryKey: ["parties_customers", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("parties")
        .select("*")
        .eq("entity_id", activeEntityId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeEntityId,
  });

  const itemsQuery = useQuery({
    queryKey: ["items_pos", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("items")
        .select("*, stock_balances(warehouse_id, current_stock)")
        .eq("entity_id", activeEntityId)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!activeEntityId,
  });

  const activeSession = activeSessionQuery.data;
  const warehouses = warehousesQuery.data ?? [];
  const businessUnits = businessUnitsQuery.data ?? [];
  const parties = partiesQuery.data ?? [];
  const items = itemsQuery.data ?? [];
  const sessionHistory = sessionHistoryQuery.data ?? [];

  // Default default customer party if none selected
  const defaultParty = parties.find((p) => p.party_type === "customer") || parties[0];

  // Filter items by search term
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(
      (it) => it.name.toLowerCase().includes(term) || (it.sku && it.sku.toLowerCase().includes(term))
    );
  }, [items, searchTerm]);

  // Cart calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  }, [cart]);

  const cartTax = useMemo(() => {
    return cart.reduce((sum, item) => {
      if (item.is_exempt) return sum;
      return sum + Math.round(item.quantity * item.unit_price * 0.19);
    }, 0);
  }, [cart]);

  const cartTotal = cartSubtotal + cartTax;

  const totalPaymentsAllocated = useMemo(() => {
    return payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [payments]);

  const remainingToPay = Math.max(0, cartTotal - totalPaymentsAllocated);
  const changeDue = Math.max(0, Number(cashTendered || 0) - (payments.find((p) => p.payment_method === "efectivo")?.amount || 0));

  // Mutations
  const openSessionMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId || !user?.id) throw new Error("Sin sesión de usuario");
      if (!openWarehouseId) throw new Error("Selecciona la bodega asignada a la caja");

      const initAmount = parseFloat(openInitialAmount || "0");
      if (isNaN(initAmount) || initAmount < 0) throw new Error("El fondo inicial no puede ser negativo");

      const { data, error } = await supabase
        .from("pos_sessions" as any)
        .insert({
          entity_id: activeEntityId,
          warehouse_id: openWarehouseId,
          business_unit_id: openBusinessUnitId || null,
          opened_by: user.id,
          opening_amount: initAmount,
          notes: openNotes.trim() || null,
          status: "open",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos_active_session"] });
      queryClient.invalidateQueries({ queryKey: ["pos_session_history"] });
      toast.success("Turno de caja abierto correctamente");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al abrir turno de caja");
    },
  });

  const createSaleMutation = useMutation({
    mutationFn: async () => {
      if (!activeSession) throw new Error("No hay turno de caja abierto");
      if (cart.length === 0) throw new Error("El carrito está vacío");
      if (Math.abs(totalPaymentsAllocated - cartTotal) > 0.01) {
        throw new Error("El total de los medios de pago debe ser exactamente igual al total de la venta");
      }

      const partyId = selectedPartyId || defaultParty?.id;
      if (!partyId) throw new Error("Seleccione un cliente");

      const payloadItems = cart.map((i) => ({
        item_id: i.item_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        is_exempt: i.is_exempt,
      }));

      const payloadPayments = payments.filter((p) => p.amount > 0).map((p) => ({
        payment_method: p.payment_method,
        amount: p.amount,
        reference_number: p.reference_number || null,
      }));

      const { data, error } = await supabase.rpc("create_pos_sale", {
        _session_id: activeSession.id,
        _party_id: partyId,
        _items: payloadItems,
        _payments: payloadPayments,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["pos_active_session"] });
      queryClient.invalidateQueries({ queryKey: ["stock_balances", activeEntityId] });
      queryClient.invalidateQueries({ queryKey: ["sales_invoices", activeEntityId] });
      queryClient.invalidateQueries({ queryKey: ["journal_entries", activeEntityId] });
      toast.success(`Venta completada: Boleta ${res?.invoice_number} emitida por $ ${Number(res?.total || 0).toLocaleString("es-CL")}`);
      setCart([]);
      setPayModalOpen(false);
      setPayments([{ payment_method: "efectivo", amount: 0 }]);
      setCashTendered("0");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al procesar la venta");
    },
  });

  const closeSessionMutation = useMutation({
    mutationFn: async () => {
      if (!activeSession) throw new Error("No hay sesión activa");
      const counted = parseFloat(countedCash || "0");
      if (isNaN(counted) || counted < 0) throw new Error("Ingrese el monto contado en gaveta");

      const { data, error } = await supabase.rpc("close_pos_session", {
        _session_id: activeSession.id,
        _counted_amount: counted,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["pos_active_session"] });
      queryClient.invalidateQueries({ queryKey: ["pos_session_history"] });
      const diff = Number(res?.cash_difference || 0);
      const diffMsg = diff === 0 ? "Cuadratura perfecta" : diff > 0 ? `Sobrante de $ ${diff.toLocaleString("es-CL")}` : `Faltante de $ ${Math.abs(diff).toLocaleString("es-CL")}`;
      toast.success(`Turno de caja cerrado con éxito. ${diffMsg}`);
      setCloseModalOpen(false);
      setCountedCash("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al cerrar turno de caja");
    },
  });

  function addToCart(item: any) {
    setCart((prev) => {
      const existing = prev.find((i) => i.item_id === item.id);
      if (existing) {
        return prev.map((i) => (i.item_id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          item_id: item.id,
          sku: item.sku,
          name: item.name,
          quantity: 1,
          unit_price: Number(item.selling_price || 0),
          is_exempt: false,
        },
      ];
    });
  }

  function updateQuantity(itemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.item_id === itemId) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  }

  function openCheckout() {
    if (cart.length === 0) return;
    setPayments([{ payment_method: "efectivo", amount: cartTotal }]);
    setCashTendered(cartTotal.toString());
    setPayModalOpen(true);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Navigation */}
      <div className="mb-4 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/dashboard">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Volver al Dashboard
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              activeSessionQuery.refetch();
              itemsQuery.refetch();
              partiesQuery.refetch();
            }}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Si no hay sesión de caja abierta, mostrar pantalla de apertura */}
      {!activeSession ? (
        <div className="max-w-xl mx-auto py-8">
          <Card className="border shadow-lg">
            <CardHeader className="text-center pb-4 border-b">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
                <Store className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl font-bold">Apertura de Turno de Caja (POS)</CardTitle>
              <CardDescription>
                Para comenzar a emitir boletas y realizar ventas de mostrador en {activeEntity?.name || "la empresa"}, abre una sesión de caja.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div>
                <Label className="text-xs font-semibold">Bodega de Despacho Asignada *</Label>
                <Select value={openWarehouseId} onValueChange={setOpenWarehouseId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Seleccione bodega para salida de stock" />
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
                <Label className="text-xs font-semibold">Sucursal / Unidad de Negocio</Label>
                <Select value={openBusinessUnitId} onValueChange={setOpenBusinessUnitId}>
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
                <Label className="text-xs font-semibold">Fondo Inicial en Gaveta ($ {baseCurrency}) *</Label>
                <Input
                  type="number"
                  step="any"
                  placeholder="ej. 50000"
                  value={openInitialAmount}
                  onChange={(e) => setOpenInitialAmount(e.target.value)}
                  className="mt-1 font-mono text-base"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Observaciones de Apertura</Label>
                <Input
                  placeholder="ej. Turno Mañana - Caja Central"
                  value={openNotes}
                  onChange={(e) => setOpenNotes(e.target.value)}
                  className="mt-1"
                />
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <Button
                className="w-full"
                size="lg"
                onClick={() => openSessionMutation.mutate()}
                disabled={openSessionMutation.isPending || !openWarehouseId}
              >
                <Unlock className="h-4 w-4 mr-2" />
                {openSessionMutation.isPending ? "Abriendo Turno..." : "Abrir Turno de Caja"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      ) : (
        /* Terminal POS Activo */
        <div className="space-y-4">
          {/* Active Session Header Bar */}
          <div className="rounded-lg border bg-card p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-foreground">Turno de Caja Activo</h2>
                  <Badge className="bg-emerald-600 text-white text-xs">Abierto</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Bodega: <strong className="text-foreground">{activeSession.warehouses?.name}</strong> | Fondo Inicial:{" "}
                  <strong className="text-foreground font-mono">$ {Number(activeSession.opening_amount || 0).toLocaleString("es-CL")}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setCloseModalOpen(true)}
              >
                <Lock className="mr-1.5 h-3.5 w-3.5" />
                Arqueo & Cerrar Caja
              </Button>
            </div>
          </div>

          {/* Grid: Catálogo de Productos (Izquierda) + Carrito de Venta (Derecha) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Catálogo de Productos */}
            <div className="lg:col-span-7 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar producto por nombre o código SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-1">
                {filteredItems.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-muted-foreground text-sm">
                    No se encontraron productos coincidentes.
                  </div>
                ) : (
                  filteredItems.map((item) => (
                    <Card
                      key={item.id}
                      className="cursor-pointer transition-all hover:border-primary hover:shadow-md active:scale-95 flex flex-col justify-between"
                      onClick={() => addToCart(item)}
                    >
                      <CardContent className="p-3">
                        <div className="font-mono text-[10px] text-muted-foreground">{item.sku}</div>
                        <div className="font-semibold text-xs text-foreground mt-1 line-clamp-2">{item.name}</div>
                      </CardContent>
                      <CardFooter className="p-3 pt-0 flex items-center justify-between border-t bg-muted/20">
                        <span className="font-mono font-bold text-xs text-primary">
                          $ {Number(item.selling_price || 0).toLocaleString("es-CL")}
                        </span>
                        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                      </CardFooter>
                    </Card>
                  ))
                )}
              </div>
            </div>

            {/* Carrito de Venta */}
            <div className="lg:col-span-5">
              <Card className="border shadow-md flex flex-col h-full">
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      Detalle de Venta
                    </CardTitle>
                    {cart.length > 0 && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => setCart([])}>
                        Limpiar
                      </Button>
                    )}
                  </div>
                  {/* Selector de Cliente */}
                  <div className="pt-2">
                    <Select
                      value={selectedPartyId || defaultParty?.id || ""}
                      onValueChange={setSelectedPartyId}
                    >
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue placeholder="Cliente / Consumidor Final" />
                      </SelectTrigger>
                      <SelectContent>
                        {parties.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.tax_id || "Sin RUT"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 p-3 overflow-y-auto max-h-[350px]">
                  {cart.length === 0 ? (
                    <div className="py-16 text-center text-muted-foreground text-xs">
                      Haz clic en los productos para agregarlos a la venta.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cart.map((line) => (
                        <div key={line.item_id} className="flex items-center justify-between p-2 rounded border bg-muted/10 text-xs">
                          <div className="flex-1 pr-2">
                            <div className="font-semibold text-foreground">{line.name}</div>
                            <div className="font-mono text-muted-foreground text-[11px]">
                              $ {line.unit_price.toLocaleString("es-CL")} c/u
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => updateQuantity(line.item_id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="font-mono font-bold w-6 text-center">{line.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => updateQuantity(line.item_id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="w-20 text-right font-mono font-bold text-foreground">
                            $ {(line.quantity * line.unit_price).toLocaleString("es-CL")}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>

                {/* Resumen & Botón Cobrar */}
                <CardFooter className="border-t p-4 flex flex-col space-y-3 bg-muted/20">
                  <div className="w-full space-y-1 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal Neto:</span>
                      <span className="font-mono">$ {cartSubtotal.toLocaleString("es-CL")}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>IVA (19%):</span>
                      <span className="font-mono">$ {cartTax.toLocaleString("es-CL")}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold text-foreground border-t pt-1">
                      <span>Total Boleta:</span>
                      <span className="font-mono text-primary">$ {cartTotal.toLocaleString("es-CL")}</span>
                    </div>
                  </div>

                  <Button
                    className="w-full text-sm font-bold"
                    size="lg"
                    disabled={cart.length === 0}
                    onClick={openCheckout}
                  >
                    <Receipt className="h-4 w-4 mr-2" />
                    Cobrar ($ {cartTotal.toLocaleString("es-CL")})
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>

          {/* Modal de Cobro y Medios de Pago Mixtos */}
          <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Cobro & Medios de Pago</DialogTitle>
                <DialogDescription>
                  Total a pagar: <strong className="text-foreground font-mono">$ {cartTotal.toLocaleString("es-CL")}</strong>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-3 border-b">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Medios de Pago Aplicados
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setPayments([...payments, { payment_method: "tarjeta_debito", amount: remainingToPay }])}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Agregar Medio
                    </Button>
                  </div>

                  {payments.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="w-44">
                        <Select
                          value={p.payment_method}
                          onValueChange={(val: any) => {
                            const updated = [...payments];
                            const current = updated[idx];
                            if (!current) return;
                            updated[idx] = { ...current, payment_method: val };
                            setPayments(updated);
                          }}
                        >
                          <SelectTrigger className="text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="efectivo">Efectivo</SelectItem>
                            <SelectItem value="tarjeta_debito">Tarjeta Débito (Redcompra)</SelectItem>
                            <SelectItem value="tarjeta_credito">Tarjeta Crédito</SelectItem>
                            <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>
                            <SelectItem value="otro">Otro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1">
                        <Input
                          type="number"
                          step="any"
                          value={p.amount}
                          onChange={(e) => {
                            const updated = [...payments];
                            const current = updated[idx];
                            if (!current) return;
                            updated[idx] = { ...current, amount: parseFloat(e.target.value || "0") };
                            setPayments(updated);
                          }}
                          className="font-mono text-xs"
                        />
                      </div>
                      {payments.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive"
                          onClick={() => setPayments(payments.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Si incluye efectivo, mostrar cálculo de vuelto */}
                {payments.some((p) => p.payment_method === "efectivo") && (
                  <div className="p-3 bg-muted/40 rounded border space-y-2 text-xs">
                    <Label className="font-semibold">Efectivo Entregado por Cliente</Label>
                    <Input
                      type="number"
                      step="any"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      className="font-mono text-base"
                    />
                    <div className="flex justify-between font-bold text-emerald-600 dark:text-emerald-400 pt-1">
                      <span>Vuelto / Cambio:</span>
                      <span className="font-mono">$ {changeDue.toLocaleString("es-CL")}</span>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  className="w-full font-bold"
                  size="lg"
                  onClick={() => createSaleMutation.mutate()}
                  disabled={createSaleMutation.isPending || Math.abs(totalPaymentsAllocated - cartTotal) > 0.01}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {createSaleMutation.isPending ? "Emitiendo Boleta..." : "Confirmar Venta & Emitir Boleta"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Modal Arqueo y Cierre de Caja */}
          <Dialog open={closeModalOpen} onOpenChange={setCloseModalOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Arqueo & Cierre de Caja</DialogTitle>
                <DialogDescription>
                  Ingresa el monto total de efectivo contado físicamente en gaveta.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-3 border-b">
                <div>
                  <Label className="text-xs font-semibold">Efectivo Contado en Gaveta ($ {baseCurrency}) *</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="ej. 150000"
                    value={countedCash}
                    onChange={(e) => setCountedCash(e.target.value)}
                    className="mt-1 font-mono text-lg font-bold"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="destructive"
                  className="w-full font-bold"
                  onClick={() => closeSessionMutation.mutate()}
                  disabled={closeSessionMutation.isPending || !countedCash}
                >
                  <Lock className="h-4 w-4 mr-2" />
                  {closeSessionMutation.isPending ? "Cerrando..." : "Confirmar Arqueo y Cerrar Caja"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Historial de Turnos de Caja */}
      <div className="mt-10">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <History className="h-4 w-4" />
              Historial de Turnos y Arqueos de Caja
            </CardTitle>
            <CardDescription>
              Registro histórico de aperturas, cierres, ventas y diferencias de arqueo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sessionHistory.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs">
                No hay turnos de caja registrados.
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Apertura</TableHead>
                      <TableHead>Cierre</TableHead>
                      <TableHead>Bodega</TableHead>
                      <TableHead className="text-right">Fondo Inicial</TableHead>
                      <TableHead className="text-right">Efectivo Esperado</TableHead>
                      <TableHead className="text-right">Efectivo Contado</TableHead>
                      <TableHead className="text-right">Diferencia</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessionHistory.map((s) => {
                      const diff = Number(s.cash_difference || 0);
                      const isClosed = s.status === "closed";

                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-mono text-xs">
                            {new Date(s.opened_at).toLocaleString("es-CL")}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {s.closed_at ? new Date(s.closed_at).toLocaleString("es-CL") : "-"}
                          </TableCell>
                          <TableCell className="text-xs font-semibold">{s.warehouses?.name}</TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            $ {Number(s.opening_amount || 0).toLocaleString("es-CL")}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {s.expected_amount !== null ? `$ ${Number(s.expected_amount).toLocaleString("es-CL")}` : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-bold">
                            {s.closing_amount !== null ? `$ ${Number(s.closing_amount).toLocaleString("es-CL")}` : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-bold">
                            {s.cash_difference !== null ? (
                              <span className={diff === 0 ? "text-emerald-600" : diff > 0 ? "text-blue-600" : "text-destructive"}>
                                $ {diff.toLocaleString("es-CL")}
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {isClosed ? (
                              <Badge variant="secondary" className="text-xs">Cerrado</Badge>
                            ) : (
                              <Badge className="bg-emerald-600 text-white text-xs">Abierto</Badge>
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
      </div>
    </div>
  );
}
