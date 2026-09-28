import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePortal } from "./route";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, Truck, ShoppingCart, Search, Printer, Eye, MapPin, Building2, AlertTriangle, ExternalLink, Calendar } from "lucide-react";

export const Route = createFileRoute("/_portal/portal")({
  head: () => ({
    meta: [
      { title: "Portal de Clientes 3PL — EasyERP" },
      { name: "description", content: "Consulta de inventario en custodia, guías de despacho y pedidos multicanal en tiempo real." },
    ],
  }),
  component: CustomerPortalPage,
});

function CustomerPortalPage() {
  const { activeParty } = usePortal();
  const partyId = activeParty?.id;

  // Estados de búsqueda
  const [stockSearch, setStockSearch] = useState("");
  const [dispatchSearch, setDispatchSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [selectedNoteForPdf, setSelectedNoteForPdf] = useState<any>(null);
  const [selectedOrderForView, setSelectedOrderForView] = useState<any>(null);

  // 1. Inventario en Custodia (stock_balances - RLS protegido por user_has_party_access)
  const balancesQ = useQuery({
    queryKey: ["portal_stock_balances", partyId],
    enabled: !!partyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_balances")
        .select("*")
        .eq("party_id", partyId!);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  // 2. Guías de Despacho (dispatch_notes + lines)
  const dispatchNotesQ = useQuery({
    queryKey: ["portal_dispatch_notes", partyId],
    enabled: !!partyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dispatch_notes")
        .select(`
          id,
          entity_id,
          party_id,
          warehouse_id,
          dispatch_number,
          transfer_type,
          carrier_name,
          carrier_tax_id,
          vehicle_plate,
          origin_address,
          destination_address,
          departure_at,
          arrival_at,
          courier_name,
          courier_tracking_number,
          courier_status,
          status,
          notes,
          created_at,
          warehouses(code, name),
          dispatch_note_lines(
            id,
            item_id,
            qty,
            uom,
            weight_kg,
            volume_m3,
            unit_value,
            items(code, name)
          )
        `)
        .eq("party_id", partyId!)
        .order("departure_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  // 3. Pedidos Multicanal (sales_orders + lines)
  const salesOrdersQ = useQuery({
    queryKey: ["portal_sales_orders", partyId],
    enabled: !!partyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_orders")
        .select(`
          id,
          entity_id,
          party_id,
          channel,
          external_order_id,
          destination_address,
          status,
          dispatch_note_id,
          notes,
          created_at,
          dispatch_notes(dispatch_number, status),
          sales_order_lines(
            id,
            item_id,
            external_sku,
            qty,
            items(code, name)
          )
        `)
        .eq("party_id", partyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const balances = balancesQ.data ?? [];
  const dispatches = dispatchNotesQ.data ?? [];
  const orders = salesOrdersQ.data ?? [];

  // Cálculos de Resumen
  const totalStockUnits = balances.reduce((sum, b) => sum + (Number(b.qty_on_hand) || 0), 0);
  const totalSkus = balances.length;
  const pendingOrdersCount = orders.filter((o) => o.status === "pendiente").length;
  const dispatchesCount = dispatches.length;

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Banner de Bienvenida */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card border rounded-xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Bienvenido, {activeParty?.name}
            </h1>
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
              Cliente 3PL
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            RUT: {activeParty?.tax_id || "Sin RUT"} · Operador Logístico:{" "}
            <strong>{activeParty?.entities?.business_name || "EasyERP Logistics"}</strong>
          </p>
        </div>
      </div>

      {/* Tarjetas Métricas de Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-primary shadow-xs">
          <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>SKUs en Custodia</span>
            <Package className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-bold mt-2">{totalSkus}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Productos con registro de stock</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500 shadow-xs">
          <div className="text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center justify-between">
            <span>Unidades Almacenadas</span>
            <Building2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold mt-2 text-emerald-600 dark:text-emerald-400">
            {totalStockUnits.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Existencias físicas disponibles</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-blue-500 shadow-xs">
          <div className="text-xs text-blue-700 dark:text-blue-300 font-medium flex items-center justify-between">
            <span>Guías de Despacho</span>
            <Truck className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold mt-2 text-blue-600 dark:text-blue-400">
            {dispatchesCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Despachos registrados</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500 shadow-xs">
          <div className="text-xs text-amber-700 dark:text-amber-300 font-medium flex items-center justify-between">
            <span>Pedidos en Proceso</span>
            <ShoppingCart className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold mt-2 text-amber-600 dark:text-amber-400">
            {pendingOrdersCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Órdenes pendientes de picking</p>
        </Card>
      </div>

      {/* Tabs Principales del Portal */}
      <Tabs defaultValue="stock" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-lg h-auto p-1 bg-muted/60">
          <TabsTrigger value="stock" className="gap-1.5 text-xs py-2">
            <Package className="h-4 w-4" />
            <span>Mi Inventario</span>
          </TabsTrigger>
          <TabsTrigger value="dispatch" className="gap-1.5 text-xs py-2">
            <Truck className="h-4 w-4" />
            <span>Guías de Despacho</span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5 text-xs py-2">
            <ShoppingCart className="h-4 w-4" />
            <span>Mis Pedidos OMS</span>
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------- */}
        {/* PESTAÑA 1: INVENTARIO EN CUSTODIA                             */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="stock" className="space-y-4">
          <Card>
            <CardHeader className="py-4 px-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    Existencias en Tiempo Real
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Saldos de mercadería en custodia dentro de las bodegas del operador logístico.
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar SKU, producto, rack..."
                    className="h-8 pl-8 text-xs bg-background"
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {(() => {
                const filtered = balances.filter((b) => {
                  if (!stockSearch.trim()) return true;
                  const q = stockSearch.toLowerCase();
                  return (
                    b.item_code?.toLowerCase().includes(q) ||
                    b.item_name?.toLowerCase().includes(q) ||
                    b.warehouse_name?.toLowerCase().includes(q) ||
                    b.location_code?.toLowerCase().includes(q)
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
                      <Package className="h-8 w-8 mx-auto text-muted-foreground/40" />
                      <p>No se encontraron existencias con el término de búsqueda ingresado.</p>
                    </div>
                  );
                }

                return (
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead>Código SKU</TableHead>
                        <TableHead>Descripción del Producto</TableHead>
                        <TableHead>Bodega Asignada</TableHead>
                        <TableHead>Ubicación (Slotting)</TableHead>
                        <TableHead className="text-right">Stock Disponible</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((item, idx) => (
                        <TableRow key={idx} className="text-xs">
                          <TableCell className="font-mono font-semibold text-primary">
                            {item.item_code}
                          </TableCell>
                          <TableCell className="font-medium">
                            {item.item_name}
                          </TableCell>
                          <TableCell>
                            {item.warehouse_name} ({item.warehouse_code})
                          </TableCell>
                          <TableCell>
                            {item.location_code ? (
                              <Badge variant="outline" className="font-mono text-[10px] gap-1">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                {item.location_code}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">General</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold text-sm">
                            {Number(item.qty_on_hand).toLocaleString()} un.
                          </TableCell>
                          <TableCell className="text-center">
                            {Number(item.qty_on_hand) > 0 ? (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
                                En Stock
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30 text-[10px]">
                                Agotado
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* PESTAÑA 2: GUÍAS DE DESPACHO                                  */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="dispatch" className="space-y-4">
          <Card>
            <CardHeader className="py-4 px-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Truck className="h-4 w-4 text-primary" />
                    Historial de Despachos y Envíos
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Guías de despacho con seguimiento de transportista y couriers en tiempo real.
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por N° guía, destino, courier..."
                    className="h-8 pl-8 text-xs bg-background"
                    value={dispatchSearch}
                    onChange={(e) => setDispatchSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {(() => {
                const filtered = dispatches.filter((d) => {
                  if (!dispatchSearch.trim()) return true;
                  const q = dispatchSearch.toLowerCase();
                  return (
                    d.dispatch_number?.toLowerCase().includes(q) ||
                    d.destination_address?.toLowerCase().includes(q) ||
                    d.carrier_name?.toLowerCase().includes(q) ||
                    d.courier_name?.toLowerCase().includes(q) ||
                    d.courier_tracking_number?.toLowerCase().includes(q)
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
                      <Truck className="h-8 w-8 mx-auto text-muted-foreground/40" />
                      <p>No se registran guías de despacho coincidentes.</p>
                    </div>
                  );
                }

                return (
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead>N° Guía</TableHead>
                        <TableHead>Fecha Salida</TableHead>
                        <TableHead>Destino</TableHead>
                        <TableHead>Transporte / Courier</TableHead>
                        <TableHead>Bultos / Ítems</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Comprobante</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((note) => {
                        const lines = note.dispatch_note_lines || [];
                        const totalUnits = lines.reduce((acc: number, l: any) => acc + (Number(l.qty) || 0), 0);

                        return (
                          <TableRow key={note.id} className="text-xs">
                            <TableCell className="font-mono font-bold">
                              {note.dispatch_number || `GD-${note.id.slice(0, 6)}`}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {new Date(note.departure_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="max-w-[180px] truncate" title={note.destination_address || ""}>
                              {note.destination_address}
                            </TableCell>
                            <TableCell>
                              {note.courier_name ? (
                                <div className="space-y-0.5">
                                  <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30 text-[10px]">
                                    {note.courier_name}
                                  </Badge>
                                  {note.courier_tracking_number && (
                                    <div className="font-mono text-[10px] text-muted-foreground">
                                      OT: {note.courier_tracking_number}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <span className="font-medium">{note.carrier_name || "Flota Propia"}</span>
                                  {note.vehicle_plate && (
                                    <span className="text-[10px] text-muted-foreground font-mono block">
                                      {note.vehicle_plate}
                                    </span>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold">{lines.length}</span> ítems ({totalUnits} un.)
                            </TableCell>
                            <TableCell>
                              {note.status === "issued" ? (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
                                  Despachada
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px]">
                                  Borrador Operativo
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1.5"
                                onClick={() => setSelectedNoteForPdf(note)}
                              >
                                <Printer className="h-3.5 w-3.5" />
                                <span>Ver / PDF</span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* PESTAÑA 3: MIS PEDIDOS OMS                                    */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader className="py-4 px-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-primary" />
                    Órdenes Recibidas de tus Canales
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Pedidos sincronizados desde Shopify, VTEX, Mercado Libre o cargados manualmente.
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por N° orden, canal..."
                    className="h-8 pl-8 text-xs bg-background"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {(() => {
                const filtered = orders.filter((o) => {
                  if (!orderSearch.trim()) return true;
                  const q = orderSearch.toLowerCase();
                  return (
                    o.external_order_id?.toLowerCase().includes(q) ||
                    o.channel?.toLowerCase().includes(q) ||
                    o.destination_address?.toLowerCase().includes(q)
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
                      <ShoppingCart className="h-8 w-8 mx-auto text-muted-foreground/40" />
                      <p>No se registran pedidos multicanal.</p>
                    </div>
                  );
                }

                return (
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead>Canal</TableHead>
                        <TableHead>N° Orden Externa</TableHead>
                        <TableHead>Fecha Ingreso</TableHead>
                        <TableHead>Destino</TableHead>
                        <TableHead>Líneas</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Guía Asociada</TableHead>
                        <TableHead className="text-right">Detalle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((order) => {
                        const lines = order.sales_order_lines || [];
                        const isProcessed = order.status === "procesado";

                        return (
                          <TableRow key={order.id} className="text-xs">
                            <TableCell>
                              <Badge variant="outline" className="capitalize text-[10px]">
                                {order.channel}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono font-semibold">
                              {order.external_order_id || order.id.slice(0, 8)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {new Date(order.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate" title={order.destination_address || ""}>
                              {order.destination_address || <span className="text-muted-foreground italic">Sin dirección</span>}
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold">{lines.length}</span> ítems
                            </TableCell>
                            <TableCell>
                              {isProcessed ? (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
                                  Procesado (Guía Lista)
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px]">
                                  Pendiente en Bodega
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {order.dispatch_notes?.dispatch_number ? (
                                <Badge variant="secondary" className="font-mono text-[10px]">
                                  {order.dispatch_notes.dispatch_number}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-[10px]">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setSelectedOrderForView(order)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: COMPROBANTE DE GUÍA DE DESPACHO (PDF / IMPRESIÓN)       */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={!!selectedNoteForPdf} onOpenChange={(open) => !open && setSelectedNoteForPdf(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedNoteForPdf && (() => {
            const note = selectedNoteForPdf;
            const lines = note.dispatch_note_lines || [];
            const totalKg = lines.reduce((acc: number, l: any) => acc + (Number(l.weight_kg) || 0), 0);
            const totalM3 = lines.reduce((acc: number, l: any) => acc + (Number(l.volume_m3) || 0), 0);
            const totalUnits = lines.reduce((acc: number, l: any) => acc + (Number(l.qty) || 0), 0);

            return (
              <div className="space-y-6 py-2 print:p-0">
                {/* Banner de Advertencia Legal SII */}
                <div className="rounded-lg border-2 border-dashed border-amber-500/50 bg-amber-500/10 p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                    <AlertTriangle className="h-4 w-4" />
                    Documento Interno de Traslado 3PL — Borrador Operativo
                  </div>
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
                    Este comprobante acredita la custodia y movimiento físico en bodega. No constituye Documento Tributario Electrónico (DTE) con folio fiscal del SII.
                  </p>
                </div>

                {/* Encabezado del Comprobante */}
                <div className="border rounded-xl p-5 bg-card space-y-4">
                  <div className="flex justify-between items-start border-b pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">
                        {activeParty?.entities?.business_name || "Servicio Logístico 3PL"}
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Operador de Bodegaje, Custodia y Transporte 3PL
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold uppercase text-primary border border-primary/30 px-3 py-1.5 rounded-lg bg-primary/5 inline-block">
                        Guía N° {note.dispatch_number || `GD-${note.id.slice(0, 8)}`}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Fecha: {new Date(note.departure_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Cuadrícula Cliente y Ruta */}
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-muted-foreground font-semibold uppercase text-[10px]">Cliente Propietario (3PL):</span>
                      <div className="font-bold text-sm">{activeParty?.name}</div>
                      <div className="text-muted-foreground">RUT: {activeParty?.tax_id || "Sin RUT"}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground font-semibold uppercase text-[10px]">Destino de Entrega:</span>
                      <div className="font-bold">{note.destination_address}</div>
                    </div>
                    <div className="space-y-1 pt-2 border-t">
                      <span className="text-muted-foreground font-semibold uppercase text-[10px]">Origen / Despacho:</span>
                      <div>{note.origin_address || note.warehouses?.name || "Bodega Central"}</div>
                    </div>
                    <div className="space-y-1 pt-2 border-t">
                      <span className="text-muted-foreground font-semibold uppercase text-[10px]">Transportista / Courier:</span>
                      <div>
                        {note.courier_name ? (
                          <span>{note.courier_name} (Seguimiento: {note.courier_tracking_number || "—"})</span>
                        ) : (
                          <span>{note.carrier_name || "Transporte Propio"} {note.vehicle_plate ? `· Patente: ${note.vehicle_plate}` : ""}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabla de Mercadería */}
                <div className="border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow className="text-xs font-semibold">
                        <TableHead>Código SKU</TableHead>
                        <TableHead>Descripción de la Mercadería</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">Peso Total</TableHead>
                        <TableHead className="text-right">Volumen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((l: any, i: number) => (
                        <TableRow key={l.id || i} className="text-xs">
                          <TableCell className="font-mono font-medium">{l.items?.code || "—"}</TableCell>
                          <TableCell>{l.items?.name || "Ítem de carga"}</TableCell>
                          <TableCell className="text-right font-bold">{l.qty} {l.uom || "UN"}</TableCell>
                          <TableCell className="text-right">{l.weight_kg ? `${l.weight_kg} kg` : "—"}</TableCell>
                          <TableCell className="text-right">{l.volume_m3 ? `${l.volume_m3} m³` : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Resumen Métrico */}
                <div className="flex justify-between items-center bg-muted/20 p-3 rounded-lg text-xs font-medium">
                  <span>Totales de la Carga:</span>
                  <div className="flex gap-4">
                    <span><strong>{totalUnits}</strong> unidades</span>
                    {totalKg > 0 && <span><strong>{totalKg.toFixed(2)}</strong> kg</span>}
                    {totalM3 > 0 && <span><strong>{totalM3.toFixed(3)}</strong> m³</span>}
                  </div>
                </div>

                {/* Firmas */}
                <div className="grid grid-cols-2 gap-8 pt-8">
                  <div className="text-center">
                    <div className="border-t border-dashed pt-2 text-xs text-muted-foreground">
                      Firma y Timbre Operador Logístico
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="border-t border-dashed pt-2 text-xs text-muted-foreground">
                      Firma y RUT Receptor de Mercadería
                    </div>
                  </div>
                </div>

                <DialogFooter className="pt-4">
                  <Button variant="outline" size="sm" onClick={() => setSelectedNoteForPdf(null)}>
                    Cerrar
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => window.print()}
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir / Guardar como PDF
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: DETALLE DE PEDIDO OMS                                  */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={!!selectedOrderForView} onOpenChange={(open) => !open && setSelectedOrderForView(null)}>
        <DialogContent className="max-w-xl">
          {selectedOrderForView && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  Detalle del Pedido #{selectedOrderForView.external_order_id || selectedOrderForView.id.slice(0, 8)}
                </DialogTitle>
                <DialogDescription>
                  Canal: <strong className="capitalize">{selectedOrderForView.channel}</strong> · Registrado el {new Date(selectedOrderForView.created_at).toLocaleString()}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 text-xs border rounded-lg p-3 bg-muted/20">
                <div>
                  <span className="text-muted-foreground">Dirección de Destino:</span>
                  <div className="font-semibold">{selectedOrderForView.destination_address || "Sin dirección especificada"}</div>
                </div>
                {selectedOrderForView.notes && (
                  <div>
                    <span className="text-muted-foreground">Notas:</span>
                    <div className="italic">{selectedOrderForView.notes}</div>
                  </div>
                )}
                {selectedOrderForView.dispatch_notes?.dispatch_number && (
                  <div className="pt-1 border-t flex items-center justify-between">
                    <span className="text-muted-foreground">Guía de Despacho Vinculada:</span>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {selectedOrderForView.dispatch_notes.dispatch_number}
                    </Badge>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold">Productos del Pedido</span>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead>SKU</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selectedOrderForView.sales_order_lines || []).map((l: any, idx: number) => (
                        <TableRow key={l.id || idx} className="text-xs">
                          <TableCell className="font-mono font-medium">{l.external_sku || l.items?.code || "—"}</TableCell>
                          <TableCell>{l.items?.name || "Producto"}</TableCell>
                          <TableCell className="text-right font-bold">{l.qty} un.</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <DialogFooter>
                <Button size="sm" onClick={() => setSelectedOrderForView(null)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
