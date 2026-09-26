import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEntity } from "@/context/ActiveEntityContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Truck, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dispatch")({
  head: () => ({
    meta: [
      { title: "Guías de Despacho 3PL — EasyERP" },
      { name: "description", content: "Gestión de clientes 3PL y guías de despacho (Res. 154) en borrador." },
      { property: "og:title", content: "Guías de Despacho 3PL — EasyERP" },
      { property: "og:description", content: "Clientes 3PL, bodegas asignadas y guías de despacho." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DispatchPage,
});

type TransferType = "venta" | "traslado_interno" | "consignacion" | "exportacion" | "otro";
const TRANSFER_LABELS: Record<TransferType, string> = {
  venta: "Venta",
  traslado_interno: "Traslado interno",
  consignacion: "Consignación",
  exportacion: "Exportación",
  otro: "Otro",
};

interface Line {
  item_id: string;
  qty: string;
  uom: string;
  weight_kg: string;
  volume_m3: string;
  unit_value: string;
}
const emptyLine = (): Line => ({ item_id: "", qty: "", uom: "", weight_kg: "", volume_m3: "", unit_value: "" });
const num = (v: string) => (v.trim() === "" ? null : Number(v));

function DispatchPage() {
  const { activeEntityId } = useActiveEntity();
  const qc = useQueryClient();

  const partiesQ = useQuery({
    queryKey: ["dispatch_parties", activeEntityId],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parties")
        .select("id, name, tax_id, is_3pl_client")
        .eq("entity_id", activeEntityId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const warehousesQ = useQuery({
    queryKey: ["dispatch_wh", activeEntityId],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("id, code, name").eq("entity_id", activeEntityId!).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const itemsQ = useQuery({
    queryKey: ["dispatch_items", activeEntityId],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase.from("items").select("id, code, name").eq("entity_id", activeEntityId!).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const pwQ = useQuery({
    queryKey: ["party_warehouses", activeEntityId],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase.from("party_warehouses").select("id, party_id, warehouse_id");
      if (error) throw error;
      return data ?? [];
    },
  });
  const notesQ = useQuery({
    queryKey: ["dispatch_notes", activeEntityId],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dispatch_notes")
        .select("*, parties(name), warehouses(code, name), dispatch_note_lines(id)")
        .eq("entity_id", activeEntityId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const parties = partiesQ.data ?? [];
  const warehouses = warehousesQ.data ?? [];
  const items = itemsQ.data ?? [];
  const pws = pwQ.data ?? [];
  const clients3pl = parties.filter((p) => p.is_3pl_client);

  // ---------- Clientes 3PL ----------
  const [editPartyId, setEditPartyId] = useState<string>("");
  const [edit3pl, setEdit3pl] = useState(false);
  const [editWh, setEditWh] = useState<string[]>([]);
  useEffect(() => {
    const p = parties.find((x) => x.id === editPartyId);
    setEdit3pl(!!p?.is_3pl_client);
    setEditWh(pws.filter((x) => x.party_id === editPartyId).map((x) => x.warehouse_id));
  }, [editPartyId, partiesQ.data, pwQ.data]);

  const savePartyM = useMutation({
    mutationFn: async () => {
      if (!editPartyId) throw new Error("Selecciona un tercero");
      const { error } = await supabase.from("parties").update({ is_3pl_client: edit3pl }).eq("id", editPartyId);
      if (error) throw error;
      const desired = edit3pl ? editWh : [];
      const current = pws.filter((x) => x.party_id === editPartyId);
      const toDelete = current.filter((c) => !desired.includes(c.warehouse_id)).map((c) => c.id);
      const toAdd = desired.filter((w) => !current.some((c) => c.warehouse_id === w));
      if (toDelete.length) {
        const { error: e } = await supabase.from("party_warehouses").delete().in("id", toDelete);
        if (e) throw e;
      }
      if (toAdd.length) {
        const { error: e } = await supabase
          .from("party_warehouses")
          .insert(toAdd.map((w) => ({ party_id: editPartyId, warehouse_id: w, entity_id: activeEntityId })));
        if (e) throw e;
      }
    },
    onSuccess: () => {
      toast.success("Tercero actualizado");
      qc.invalidateQueries({ queryKey: ["dispatch_parties"] });
      qc.invalidateQueries({ queryKey: ["party_warehouses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---------- Guía de despacho ----------
  const [partyId, setPartyId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [form, setForm] = useState({
    dispatch_number: "",
    transfer_type: "venta" as TransferType,
    carrier_name: "",
    carrier_tax_id: "",
    vehicle_plate: "",
    origin_address: "",
    destination_address: "",
    departure_at: "",
    arrival_at: "",
  });
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const allowedWh = warehouses.filter((w) => pws.some((p) => p.party_id === partyId && p.warehouse_id === w.id));

  const setF = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setLine = (i: number, k: keyof Line, v: string) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));

  const saveNoteM = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Sin empresa activa");
      if (!partyId || !warehouseId) throw new Error("Selecciona cliente y bodega");
      const req: (keyof typeof form)[] = ["carrier_name", "carrier_tax_id", "vehicle_plate", "origin_address", "destination_address", "departure_at"];
      for (const k of req) if (!form[k].trim()) throw new Error("Completa todos los campos obligatorios");
      const valid = lines.filter((l) => l.item_id && Number(l.qty) > 0);
      if (!valid.length) throw new Error("Agrega al menos una línea con ítem y cantidad");
      const { data: note, error } = await supabase
        .from("dispatch_notes")
        .insert({
          entity_id: activeEntityId,
          party_id: partyId,
          warehouse_id: warehouseId,
          dispatch_number: form.dispatch_number || null,
          transfer_type: form.transfer_type,
          carrier_name: form.carrier_name,
          carrier_tax_id: form.carrier_tax_id,
          vehicle_plate: form.vehicle_plate,
          origin_address: form.origin_address,
          destination_address: form.destination_address,
          departure_at: new Date(form.departure_at).toISOString(),
          arrival_at: form.arrival_at ? new Date(form.arrival_at).toISOString() : null,
          status: "draft",
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: le } = await supabase.from("dispatch_note_lines").insert(
        valid.map((l) => ({
          dispatch_note_id: note.id,
          item_id: l.item_id,
          qty: Number(l.qty),
          uom: l.uom || null,
          weight_kg: num(l.weight_kg),
          volume_m3: num(l.volume_m3),
          unit_value: num(l.unit_value),
        })),
      );
      if (le) throw le;
    },
    onSuccess: () => {
      toast.success("Guía guardada en borrador");
      setLines([emptyLine()]);
      setForm((f) => ({ ...f, dispatch_number: "", departure_at: "", arrival_at: "" }));
      qc.invalidateQueries({ queryKey: ["dispatch_notes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/dashboard"><ArrowLeft className="h-4 w-4 mr-1" />Volver</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Truck className="h-6 w-6" />Guías de Despacho 3PL</h1>
          <p className="text-sm text-muted-foreground">Mercadería en custodia de clientes 3PL. Las guías quedan en borrador hasta resolver la emisión DTE.</p>
        </div>
      </div>

      <Tabs defaultValue="notes">
        <TabsList>
          <TabsTrigger value="notes"><Truck className="h-4 w-4 mr-1" />Guías</TabsTrigger>
          <TabsTrigger value="new"><Plus className="h-4 w-4 mr-1" />Nueva guía</TabsTrigger>
          <TabsTrigger value="clients"><Users className="h-4 w-4 mr-1" />Clientes 3PL</TabsTrigger>
        </TabsList>

        <TabsContent value="notes">
          <Card>
            <CardHeader><CardTitle className="text-base">Guías registradas</CardTitle></CardHeader>
            <CardContent>
              {(notesQ.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Aún no hay guías de despacho.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N°</TableHead><TableHead>Cliente</TableHead><TableHead>Bodega</TableHead>
                      <TableHead>Tipo</TableHead><TableHead>Transportista</TableHead><TableHead>Salida</TableHead>
                      <TableHead>Líneas</TableHead><TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(notesQ.data ?? []).map((n: any) => (
                      <TableRow key={n.id}>
                        <TableCell className="font-mono text-xs">{n.dispatch_number ?? "—"}</TableCell>
                        <TableCell className="text-xs">{n.parties?.name}</TableCell>
                        <TableCell className="text-xs">{n.warehouses?.code} - {n.warehouses?.name}</TableCell>
                        <TableCell className="text-xs">{TRANSFER_LABELS[n.transfer_type as TransferType]}</TableCell>
                        <TableCell className="text-xs">{n.carrier_name} · {n.vehicle_plate}</TableCell>
                        <TableCell className="text-xs">{new Date(n.departure_at).toLocaleString("es-CL")}</TableCell>
                        <TableCell className="text-xs">{n.dispatch_note_lines?.length ?? 0}</TableCell>
                        <TableCell><Badge variant="outline">{n.status === "draft" ? "Borrador" : n.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="new">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nueva guía de despacho</CardTitle>
              <CardDescription>Se guarda en estado borrador.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <Label>Cliente 3PL *</Label>
                  <Select value={partyId} onValueChange={(v) => { setPartyId(v); setWarehouseId(""); }}>
                    <SelectTrigger><SelectValue placeholder={clients3pl.length ? "Seleccionar" : "No hay clientes 3PL"} /></SelectTrigger>
                    <SelectContent>
                      {clients3pl.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} {p.tax_id ? `(${p.tax_id})` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Bodega *</Label>
                  <Select value={warehouseId} onValueChange={setWarehouseId} disabled={!partyId}>
                    <SelectTrigger><SelectValue placeholder={partyId && !allowedWh.length ? "Cliente sin bodegas asignadas" : "Seleccionar"} /></SelectTrigger>
                    <SelectContent>
                      {allowedWh.map((w) => <SelectItem key={w.id} value={w.id}>{w.code} - {w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Tipo de traslado *</Label>
                  <Select value={form.transfer_type} onValueChange={(v) => setF("transfer_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TRANSFER_LABELS) as TransferType[]).map((k) => <SelectItem key={k} value={k}>{TRANSFER_LABELS[k]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>N° guía (opcional)</Label><Input value={form.dispatch_number} onChange={(e) => setF("dispatch_number", e.target.value)} /></div>
                <div className="space-y-1"><Label>Transportista *</Label><Input value={form.carrier_name} onChange={(e) => setF("carrier_name", e.target.value)} /></div>
                <div className="space-y-1"><Label>RUT transportista *</Label><Input placeholder="12.345.678-9" value={form.carrier_tax_id} onChange={(e) => setF("carrier_tax_id", e.target.value)} /></div>
                <div className="space-y-1"><Label>Patente *</Label><Input value={form.vehicle_plate} onChange={(e) => setF("vehicle_plate", e.target.value.toUpperCase())} /></div>
                <div className="space-y-1"><Label>Salida *</Label><Input type="datetime-local" value={form.departure_at} onChange={(e) => setF("departure_at", e.target.value)} /></div>
                <div className="space-y-1"><Label>Llegada</Label><Input type="datetime-local" value={form.arrival_at} onChange={(e) => setF("arrival_at", e.target.value)} /></div>
                <div className="space-y-1 md:col-span-3 grid md:grid-cols-2 gap-4">
                  <div className="space-y-1"><Label>Dirección origen *</Label><Input value={form.origin_address} onChange={(e) => setF("origin_address", e.target.value)} /></div>
                  <div className="space-y-1"><Label>Dirección destino *</Label><Input value={form.destination_address} onChange={(e) => setF("destination_address", e.target.value)} /></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Líneas</Label>
                  <Button size="sm" variant="outline" onClick={() => setLines((l) => [...l, emptyLine()])}><Plus className="h-4 w-4 mr-1" />Agregar línea</Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ítem</TableHead><TableHead>Cantidad</TableHead><TableHead>Unidad</TableHead>
                      <TableHead>Peso (kg)</TableHead><TableHead>Volumen (m³)</TableHead><TableHead>Valor unit.</TableHead><TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell className="min-w-[200px]">
                          <Select value={l.item_id} onValueChange={(v) => setLine(i, "item_id", v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Ítem" /></SelectTrigger>
                            <SelectContent>{items.map((it) => <SelectItem key={it.id} value={it.id}>{it.code} - {it.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        {(["qty", "uom", "weight_kg", "volume_m3", "unit_value"] as const).map((k) => (
                          <TableCell key={k}>
                            <Input className="h-8 text-xs" type={k === "uom" ? "text" : "number"} value={l[k]} onChange={(e) => setLine(i, k, e.target.value)} />
                          </TableCell>
                        ))}
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => setLines((ls) => ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => saveNoteM.mutate()} disabled={saveNoteM.isPending}>Guardar borrador</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Terceros como Cliente 3PL</CardTitle>
              <CardDescription>Marca un tercero como cliente 3PL y asigna las bodegas donde guarda mercadería.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-xl">
              <div className="space-y-1">
                <Label>Tercero</Label>
                <Select value={editPartyId} onValueChange={setEditPartyId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar tercero" /></SelectTrigger>
                  <SelectContent>
                    {parties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} {p.is_3pl_client ? "· 3PL" : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {editPartyId && (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={edit3pl} onCheckedChange={(v) => setEdit3pl(v === true)} />
                    Cliente 3PL
                  </label>
                  {edit3pl && (
                    <div className="space-y-2 rounded-md border p-3">
                      <Label className="text-xs text-muted-foreground">Bodegas con mercadería del cliente</Label>
                      {warehouses.map((w) => (
                        <label key={w.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={editWh.includes(w.id)}
                            onCheckedChange={(v) => setEditWh((cur) => v === true ? [...cur, w.id] : cur.filter((x) => x !== w.id))}
                          />
                          {w.code} - {w.name}
                        </label>
                      ))}
                      {!warehouses.length && <p className="text-xs text-muted-foreground">No hay bodegas creadas.</p>}
                    </div>
                  )}
                  <Button onClick={() => savePartyM.mutate()} disabled={savePartyM.isPending}>Guardar</Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
