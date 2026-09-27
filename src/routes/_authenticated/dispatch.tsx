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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Truck, Users, Globe, ShieldAlert, FileCheck, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dispatch")({
  head: () => ({
    meta: [
      { title: "Guías de Despacho 3PL & Comercio Exterior — EasyERP" },
      { name: "description", content: "Gestión de clientes 3PL, guías de despacho (Res. 154) y operaciones de comercio exterior (SICEX)." },
      { property: "og:title", content: "Guías de Despacho 3PL & Comercio Exterior — EasyERP" },
      { property: "og:description", content: "Clientes 3PL, bodegas asignadas, guías de despacho y operaciones SICEX." },
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

  // ---------- Comercio Exterior (SICEX - Sprint 17) ----------
  const ftOperationsQ = useQuery({
    queryKey: ["foreign_trade_operations", activeEntityId],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("foreign_trade_operations" as any)
        .select("*, parties(name, tax_id), dispatch_notes(dispatch_number), foreign_trade_certificates(*)")
        .eq("entity_id", activeEntityId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const [ftForm, setFtForm] = useState({
    party_id: "",
    operation_type: "exportacion" as "exportacion" | "importacion",
    country_code: "",
    dus_number: "",
    booking_number: "",
    dispatch_note_id: "",
    notes: "",
  });

  const [selectedOpForCert, setSelectedOpForCert] = useState<string>("");
  const [certForm, setCertForm] = useState({
    certificate_type: "Fitosanitario SAG",
    certificate_number: "",
    issued_by: "SAG",
    valid_until: "",
  });

  const saveFtOpM = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Sin empresa activa");
      if (!ftForm.party_id) throw new Error("Selecciona un cliente 3PL");
      const { error } = await supabase.from("foreign_trade_operations" as any).insert({
        entity_id: activeEntityId,
        party_id: ftForm.party_id,
        operation_type: ftForm.operation_type,
        country_code: ftForm.country_code.trim().toUpperCase() || null,
        dus_number: ftForm.dus_number.trim() || null,
        booking_number: ftForm.booking_number.trim() || null,
        dispatch_note_id: ftForm.dispatch_note_id || null,
        notes: ftForm.notes.trim() || null,
        customs_status: "pendiente", // Siempre 'pendiente'
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Operación Comex registrada en estado Pendiente");
      setFtForm({
        party_id: "",
        operation_type: "exportacion",
        country_code: "",
        dus_number: "",
        booking_number: "",
        dispatch_note_id: "",
        notes: "",
      });
      qc.invalidateQueries({ queryKey: ["foreign_trade_operations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addCertM = useMutation({
    mutationFn: async (opId: string) => {
      if (!certForm.certificate_type.trim()) throw new Error("Ingresa el tipo de certificado");
      const { error } = await supabase.from("foreign_trade_certificates" as any).insert({
        operation_id: opId,
        certificate_type: certForm.certificate_type.trim(),
        certificate_number: certForm.certificate_number.trim() || null,
        issued_by: certForm.issued_by.trim() || null,
        valid_until: certForm.valid_until || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Certificado agregado");
      setCertForm({
        certificate_type: "Fitosanitario SAG",
        certificate_number: "",
        issued_by: "SAG",
        valid_until: "",
      });
      qc.invalidateQueries({ queryKey: ["foreign_trade_operations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCertM = useMutation({
    mutationFn: async (certId: string) => {
      const { error } = await supabase.from("foreign_trade_certificates" as any).delete().eq("id", certId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Certificado eliminado");
      qc.invalidateQueries({ queryKey: ["foreign_trade_operations"] });
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
          <h1 className="text-2xl font-bold flex items-center gap-2"><Truck className="h-6 w-6" />Guías de Despacho 3PL & Comex</h1>
          <p className="text-sm text-muted-foreground">Mercadería en custodia de clientes 3PL (Res. 154 SII) y operaciones de comercio exterior (SICEX).</p>
        </div>
      </div>

      <Tabs defaultValue="notes">
        <TabsList>
          <TabsTrigger value="notes"><Truck className="h-4 w-4 mr-1" />Guías</TabsTrigger>
          <TabsTrigger value="new"><Plus className="h-4 w-4 mr-1" />Nueva guía</TabsTrigger>
          <TabsTrigger value="clients"><Users className="h-4 w-4 mr-1" />Clientes 3PL</TabsTrigger>
          <TabsTrigger value="foreign_trade"><Globe className="h-4 w-4 mr-1" />Comercio Exterior</TabsTrigger>
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

        {/* ------------------------------------------------------------- */}
        {/* PESTAÑA 4: COMERCIO EXTERIOR (SICEX)                          */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="foreign_trade" className="space-y-6">
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
            <div>
              <span className="font-semibold">Mecánica interna SICEX / Aduanas:</span> Toda operación de comercio exterior
              se registra en estado <strong>Pendiente</strong>. La habilitación de credenciales y certificado digital para
              SICEX corresponde a un trámite ante el Servicio Nacional de Aduanas. No se realiza ningún envío real a SICEX todavía.
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Formulario Nueva Operación Comex */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  Nueva Operación de Comercio Exterior
                </CardTitle>
                <CardDescription>Registra un expediente aduanero para un cliente 3PL.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label>Cliente 3PL *</Label>
                  <Select
                    value={ftForm.party_id}
                    onValueChange={(v) => setFtForm((f) => ({ ...f, party_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={clients3pl.length ? "Seleccionar cliente" : "No hay clientes 3PL"} />
                    </SelectTrigger>
                    <SelectContent>
                      {clients3pl.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} {p.tax_id ? `(${p.tax_id})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Tipo de Operación *</Label>
                    <Select
                      value={ftForm.operation_type}
                      onValueChange={(v: "exportacion" | "importacion") =>
                        setFtForm((f) => ({ ...f, operation_type: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="exportacion">Exportación (DUS)</SelectItem>
                        <SelectItem value="importacion">Importación (DIN)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>País (Código o Nombre)</Label>
                    <Input
                      placeholder="Ej: US, CN, Brasil"
                      value={ftForm.country_code}
                      onChange={(e) => setFtForm((f) => ({ ...f, country_code: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>N° DUS / DIN</Label>
                    <Input
                      placeholder="Ej: DUS-2026-987"
                      value={ftForm.dus_number}
                      onChange={(e) => setFtForm((f) => ({ ...f, dus_number: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Booking / BL (opcional)</Label>
                    <Input
                      placeholder="Ej: MAEU-12345"
                      value={ftForm.booking_number}
                      onChange={(e) => setFtForm((f) => ({ ...f, booking_number: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Guía de Despacho Asociada (opcional)</Label>
                  <Select
                    value={ftForm.dispatch_note_id}
                    onValueChange={(v) => setFtForm((f) => ({ ...f, dispatch_note_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="-- Sin vincular a guía --" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">-- Sin vincular --</SelectItem>
                      {(notesQ.data ?? [])
                        .filter((n) => !ftForm.party_id || n.party_id === ftForm.party_id)
                        .map((n) => (
                          <SelectItem key={n.id} value={n.id}>
                            {n.dispatch_number || "Borrador"} · {n.destination_address?.slice(0, 25)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Notas / Observaciones</Label>
                  <Textarea
                    placeholder="Instrucciones, aduana de salida, agencia..."
                    rows={2}
                    value={ftForm.notes}
                    onChange={(e) => setFtForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>

                <Button
                  onClick={() => saveFtOpM.mutate()}
                  disabled={saveFtOpM.isPending || !ftForm.party_id}
                  className="w-full"
                >
                  {saveFtOpM.isPending ? "Guardando..." : "Guardar Operación"}
                </Button>
              </CardContent>
            </Card>

            {/* Sub-formulario para agregar certificado a la operación seleccionada */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-emerald-600" />
                  Adjuntar Certificado a Operación
                </CardTitle>
                <CardDescription>
                  Certificados fitosanitarios (SAG), zoosanitarios, de origen o ISP.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label>Seleccionar Operación *</Label>
                  <Select value={selectedOpForCert} onValueChange={setSelectedOpForCert}>
                    <SelectTrigger>
                      <SelectValue placeholder={(ftOperationsQ.data ?? []).length ? "Selecciona operación..." : "No hay operaciones registradas"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(ftOperationsQ.data ?? []).map((op: any) => (
                        <SelectItem key={op.id} value={op.id}>
                          {op.dus_number || "Sin DUS"} · {op.parties?.name} ({op.operation_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedOpForCert && (
                  <div className="space-y-3 p-3 rounded-lg border bg-muted/20">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Tipo de Certificado *</Label>
                        <Select
                          value={certForm.certificate_type}
                          onValueChange={(v) => setCertForm((c) => ({ ...c, certificate_type: v }))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Fitosanitario SAG">Fitosanitario (SAG)</SelectItem>
                            <SelectItem value="Zoosanitario SAG/SERNAPESCA">Zoosanitario (SAG/SERNAPESCA)</SelectItem>
                            <SelectItem value="Certificado de Origen">Certificado de Origen (SOFOFA)</SelectItem>
                            <SelectItem value="Certificado ISP">Certificado ISP</SelectItem>
                            <SelectItem value="Otro">Otro Certificado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">N° Certificado</Label>
                        <Input
                          className="h-8 text-xs font-mono"
                          placeholder="Ej: SAG-2026-90"
                          value={certForm.certificate_number}
                          onChange={(e) => setCertForm((c) => ({ ...c, certificate_number: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Entidad Emisora</Label>
                        <Input
                          className="h-8 text-xs"
                          placeholder="Ej: SAG, SOFOFA"
                          value={certForm.issued_by}
                          onChange={(e) => setCertForm((c) => ({ ...c, issued_by: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Vigencia (Vencimiento)</Label>
                        <Input
                          className="h-8 text-xs font-mono"
                          type="date"
                          value={certForm.valid_until}
                          onChange={(e) => setCertForm((c) => ({ ...c, valid_until: e.target.value }))}
                        />
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => addCertM.mutate(selectedOpForCert)}
                      disabled={addCertM.isPending || !certForm.certificate_type}
                      className="w-full h-8 text-xs"
                    >
                      {addCertM.isPending ? "Guardando..." : "Adjuntar Certificado"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tabla de Operaciones de Comercio Exterior Registradas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Operaciones Registradas & Certificados Adjuntos
              </CardTitle>
              <CardDescription>
                Historial de expedientes aduaneros, vinculaciones con guías y certificados con fecha de vigencia.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(ftOperationsQ.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Aún no hay operaciones de comercio exterior registradas.
                </p>
              ) : (
                <div className="space-y-4">
                  {(ftOperationsQ.data ?? []).map((op: any) => (
                    <div key={op.id} className="rounded-lg border p-4 space-y-3 bg-card">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={op.operation_type === "exportacion" ? "default" : "secondary"}
                            className="text-[10px] uppercase font-mono"
                          >
                            {op.operation_type}
                          </Badge>
                          <span className="font-mono font-semibold text-sm text-primary">
                            {op.dus_number || "SIN DUS"}
                          </span>
                          <span className="text-xs text-muted-foreground">· Cliente:</span>
                          <span className="text-xs font-medium">{op.parties?.name}</span>
                          {op.country_code && (
                            <span className="text-xs text-muted-foreground">
                              (Destino/Origen: <strong>{op.country_code}</strong>)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {op.dispatch_notes && (
                            <Badge variant="outline" className="text-[10px] font-mono gap-1 text-primary">
                              <Truck className="h-3 w-3" />
                              Guía: {op.dispatch_notes.dispatch_number || "Borrador"}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px] uppercase font-mono bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
                            {op.customs_status}
                          </Badge>
                        </div>
                      </div>

                      {/* Lista de certificados de esta operación */}
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                          <FileCheck className="h-3.5 w-3.5 text-emerald-600" />
                          Certificados adjuntos ({(op.foreign_trade_certificates ?? []).length}):
                        </span>

                        {(op.foreign_trade_certificates ?? []).length === 0 ? (
                          <p className="text-xs text-muted-foreground italic pl-4">
                            Sin certificados adjuntos a esta operación.
                          </p>
                        ) : (
                          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 pl-2">
                            {op.foreign_trade_certificates.map((cert: any) => {
                              const isExpired = cert.valid_until && new Date(cert.valid_until) < new Date();
                              return (
                                <div
                                  key={cert.id}
                                  className="flex items-center justify-between p-2 rounded border bg-muted/30 text-xs"
                                >
                                  <div>
                                    <div className="font-medium">{cert.certificate_type}</div>
                                    <div className="font-mono text-[11px] text-muted-foreground">
                                      N° {cert.certificate_number || "S/N"} · {cert.issued_by || "—"}
                                    </div>
                                    <div className="text-[10px] font-mono mt-0.5">
                                      Vigencia:{" "}
                                      <span className={isExpired ? "text-destructive font-bold" : "text-emerald-600"}>
                                        {cert.valid_until || "Indefinida"}
                                      </span>
                                    </div>
                                  </div>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => deleteCertM.mutate(cert.id)}
                                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
