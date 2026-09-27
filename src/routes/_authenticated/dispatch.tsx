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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Truck, Users, Globe, ShieldAlert, FileCheck, AlertCircle, ArrowDownToLine, MapPin, Box, CheckCircle2, ClipboardCheck, Layers, PackageCheck, Package, Search, Eye, Check, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dispatch")({
  head: () => ({
    meta: [
      { title: "Guías de Despacho 3PL & Comercio Exterior — EasyERP" },
      { name: "description", content: "Gestión de clientes 3PL, guías de despacho (Res. 154), WMS picking/packing, trazabilidad y operaciones SICEX." },
      { property: "og:title", content: "Guías de Despacho 3PL & Comercio Exterior — EasyERP" },
      { property: "og:description", content: "Clientes 3PL, bodegas asignadas, guías de despacho, picking/packing y operaciones SICEX." },
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
        .select(`
          *,
          parties(id, name, tax_id),
          warehouses(id, code, name),
          dispatch_note_lines(
            id,
            dispatch_note_id,
            item_id,
            qty,
            uom,
            weight_kg,
            volume_m3,
            unit_value,
            location_id,
            lot_number,
            picked,
            packed,
            picked_at,
            packed_at,
            items(id, code, name),
            warehouse_locations(id, code, name)
          )
        `)
        .eq("entity_id", activeEntityId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
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

  // WMS: Queries para ubicaciones y recepciones recientes
  const locationsQ = useQuery({
    queryKey: ["warehouse_locations", activeEntityId],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouse_locations" as any)
        .select("id, warehouse_id, code, name, is_active, created_at")
        .eq("entity_id", activeEntityId!)
        .order("code");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const receiptsQ = useQuery({
    queryKey: ["wms_receipts", activeEntityId],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_ledger_entries" as any)
        .select("id, posting_date, qty_change, valuation_rate, memo, lot_number, qc_notes, items(id, code, name), warehouses(id, code, name), warehouse_locations(id, code, name), parties(id, name, tax_id)")
        .eq("entity_id", activeEntityId!)
        .eq("movement_type", "receipt")
        .not("party_id", "is", null)
        .order("posting_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // WMS: State Formulario de Recepción
  const [receptionForm, setReceptionForm] = useState({
    party_id: "",
    warehouse_id: "",
    location_id: "NONE",
    item_id: "",
    qty: "",
    rate: "",
    lot_number: "",
    qc_notes: "",
    posting_date: new Date().toISOString().slice(0, 10),
  });

  // WMS: Modal para crear nueva ubicación rápidamente
  const [newLocModalOpen, setNewLocModalOpen] = useState(false);
  const [newLocWarehouseId, setNewLocWarehouseId] = useState("");
  const [newLocCode, setNewLocCode] = useState("");
  const [newLocName, setNewLocName] = useState("");

  const createLocM = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Selecciona una empresa primero");
      const targetWh = newLocWarehouseId || receptionForm.warehouse_id;
      if (!targetWh) throw new Error("Selecciona la bodega a la que pertenecerá la ubicación");
      if (!newLocCode.trim()) throw new Error("Ingresa el código de la ubicación (ej: A-01-01)");

      const { data, error } = await supabase
        .from("warehouse_locations" as any)
        .insert({
          entity_id: activeEntityId,
          warehouse_id: targetWh,
          code: newLocCode.trim().toUpperCase(),
          name: newLocName.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`Ubicación ${data.code} creada correctamente`);
      qc.invalidateQueries({ queryKey: ["warehouse_locations", activeEntityId] });
      setNewLocModalOpen(false);
      setNewLocCode("");
      setNewLocName("");
      setReceptionForm((prev) => ({ ...prev, location_id: data.id }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createReceiptM = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Selecciona una empresa primero");
      if (!receptionForm.party_id) throw new Error("Selecciona un cliente 3PL");
      if (!receptionForm.warehouse_id) throw new Error("Selecciona una bodega autorizada");
      if (!receptionForm.item_id) throw new Error("Selecciona un artículo");

      const qty = parseFloat(receptionForm.qty);
      if (isNaN(qty) || qty <= 0) throw new Error("Ingresa una cantidad mayor a cero");
      const rate = parseFloat(receptionForm.rate || "0");

      const { error } = await supabase.from("stock_ledger_entries" as any).insert({
        entity_id: activeEntityId,
        item_id: receptionForm.item_id,
        warehouse_id: receptionForm.warehouse_id,
        party_id: receptionForm.party_id,
        location_id: receptionForm.location_id && receptionForm.location_id !== "NONE" ? receptionForm.location_id : null,
        lot_number: receptionForm.lot_number.trim() || null,
        qc_notes: receptionForm.qc_notes.trim() || null,
        movement_type: "receipt",
        qty_change: qty,
        valuation_rate: rate,
        posting_date: receptionForm.posting_date,
        memo: `Recepción WMS 3PL${receptionForm.lot_number ? ` · Lote ${receptionForm.lot_number}` : ""}`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recepción WMS registrada e ingresada al inventario en custodia");
      setReceptionForm({
        party_id: "",
        warehouse_id: "",
        location_id: "NONE",
        item_id: "",
        qty: "",
        rate: "",
        lot_number: "",
        qc_notes: "",
        posting_date: new Date().toISOString().slice(0, 10),
      });
      qc.invalidateQueries({ queryKey: ["wms_receipts", activeEntityId] });
      qc.invalidateQueries({ queryKey: ["stock_ledger_entries", activeEntityId] });
      qc.invalidateQueries({ queryKey: ["stock_balances", activeEntityId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const receptionAllowedWhIds = new Set(
    (pwQ.data ?? []).filter((r: any) => r.party_id === receptionForm.party_id).map((r: any) => r.warehouse_id)
  );
  const receptionAllowedWh = (warehousesQ.data ?? []).filter((w: any) => receptionAllowedWhIds.has(w.id));
  const receptionWhLocations = (locationsQ.data ?? []).filter(
    (l: any) => l.warehouse_id === receptionForm.warehouse_id
  );

  // ---------- WMS: Picking & Packing (Sprint 20) ----------
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null);
  const selectedGuide = (notesQ.data ?? []).find((n: any) => n.id === selectedGuideId);

  const [pickingLine, setPickingLine] = useState<{ line: any; guide: any } | null>(null);
  const [pickLocationId, setPickLocationId] = useState<string>("NONE");
  const [pickLotNumber, setPickLotNumber] = useState<string>("");

  const openPickingDialog = (line: any, guide: any) => {
    setPickingLine({ line, guide });
    setPickLocationId(line.location_id || "NONE");
    setPickLotNumber(line.lot_number || "");
  };

  const confirmPickingM = useMutation({
    mutationFn: async () => {
      if (!pickingLine || !activeEntityId) throw new Error("No hay línea seleccionada");
      const { line, guide } = pickingLine;
      const lot = pickLotNumber.trim();
      const locId = pickLocationId && pickLocationId !== "NONE" ? pickLocationId : null;

      // 1. Actualizar dispatch_note_lines: picked=true, location_id, lot_number
      const { error: lineError } = await supabase
        .from("dispatch_note_lines")
        .update({
          picked: true,
          picked_at: new Date().toISOString(),
          location_id: locId,
          lot_number: lot || null,
        })
        .eq("id", line.id);
      if (lineError) throw lineError;

      // 2. Insertar stock_ledger_entries: salida ('issue')
      const { error: sleError } = await supabase.from("stock_ledger_entries" as any).insert({
        entity_id: activeEntityId,
        warehouse_id: guide.warehouse_id,
        party_id: guide.party_id,
        item_id: line.item_id,
        location_id: locId,
        lot_number: lot || null,
        movement_type: "issue",
        qty_change: -Number(line.qty),
        valuation_rate: 0, // FIFO trigger calcula costo en salidas
        posting_date: new Date().toISOString().split("T")[0],
        voucher_type: "dispatch_note",
        voucher_id: guide.id,
        memo: `Picking Guía #${guide.dispatch_number || guide.id.slice(0, 8)} - Lote ${lot || "S/L"}`,
      });
      if (sleError) throw sleError;
    },
    onSuccess: () => {
      toast.success("Línea pickeada con éxito y salida de inventario registrada en Kardex");
      setPickingLine(null);
      setPickLocationId("NONE");
      setPickLotNumber("");
      qc.invalidateQueries({ queryKey: ["dispatch_notes"] });
      qc.invalidateQueries({ queryKey: ["stock_ledger_entries"] });
      qc.invalidateQueries({ queryKey: ["stock_balances"] });
      qc.invalidateQueries({ queryKey: ["wms_receipts"] });
      qc.invalidateQueries({ queryKey: ["lot_traceability"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePackedM = useMutation({
    mutationFn: async ({ lineId, packed }: { lineId: string; packed: boolean }) => {
      const { error } = await supabase
        .from("dispatch_note_lines")
        .update({
          packed,
          packed_at: packed ? new Date().toISOString() : null,
        })
        .eq("id", lineId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["dispatch_notes"] });
      qc.invalidateQueries({ queryKey: ["lot_traceability"] });
      if (vars.packed) {
        toast.success("Línea marcada como empacada");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---------- Trazabilidad de Lotes (Sprint 20) ----------
  const [traceLotSearch, setTraceLotSearch] = useState<string>("");
  const lotTraceQ = useQuery({
    queryKey: ["lot_traceability", activeEntityId, traceLotSearch],
    enabled: !!activeEntityId && traceLotSearch.trim().length > 0,
    queryFn: async () => {
      const term = traceLotSearch.trim();
      const { data: linesData, error: linesErr } = await supabase
        .from("dispatch_note_lines")
        .select(`
          id,
          dispatch_note_id,
          item_id,
          qty,
          uom,
          location_id,
          lot_number,
          picked,
          packed,
          picked_at,
          packed_at,
          items(id, code, name),
          warehouse_locations(id, code, name),
          dispatch_notes!inner(
            id,
            entity_id,
            dispatch_number,
            departure_at,
            destination_address,
            carrier_name,
            carrier_tax_id,
            vehicle_plate,
            transfer_type,
            status,
            parties(id, name, tax_id),
            warehouses(id, code, name)
          )
        `)
        .eq("dispatch_notes.entity_id", activeEntityId!)
        .ilike("lot_number", `%${term}%`);

      if (linesErr) throw linesErr;

      const { data: ledgerData, error: ledgerErr } = await supabase
        .from("stock_ledger_entries" as any)
        .select(`
          id,
          posting_date,
          qty_change,
          movement_type,
          lot_number,
          memo,
          qc_notes,
          items(id, code, name),
          warehouses(id, code, name),
          warehouse_locations(id, code, name),
          parties(id, name, tax_id)
        `)
        .eq("entity_id", activeEntityId!)
        .ilike("lot_number", `%${term}%`)
        .order("posting_date", { ascending: false });

      if (ledgerErr) throw ledgerErr;

      return {
        dispatches: (linesData as any[]) ?? [],
        ledger: (ledgerData as any[]) ?? [],
      };
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/dashboard"><ArrowLeft className="h-4 w-4 mr-1" />Volver</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Truck className="h-6 w-6" />Operaciones 3PL & Logística</h1>
          <p className="text-sm text-muted-foreground">Guías de despacho (Res. 154 SII), Picking & Packing WMS, Trazabilidad de lotes y Comercio Exterior (SICEX).</p>
        </div>
      </div>

      <Tabs defaultValue="notes">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 h-auto">
          <TabsTrigger value="notes"><Truck className="h-4 w-4 mr-1" />Guías</TabsTrigger>
          <TabsTrigger value="new"><Plus className="h-4 w-4 mr-1" />Nueva guía</TabsTrigger>
          <TabsTrigger value="clients"><Users className="h-4 w-4 mr-1" />Clientes 3PL</TabsTrigger>
          <TabsTrigger value="foreign_trade"><Globe className="h-4 w-4 mr-1" />Comercio Exterior</TabsTrigger>
          <TabsTrigger value="reception"><ArrowDownToLine className="h-4 w-4 mr-1" />Recepción WMS</TabsTrigger>
          <TabsTrigger value="traceability"><Layers className="h-4 w-4 mr-1" />Trazabilidad</TabsTrigger>
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
                      <TableHead>N°</TableHead>
                      <TableHead>Cliente 3PL</TableHead>
                      <TableHead>Bodega</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Transportista</TableHead>
                      <TableHead>Salida</TableHead>
                      <TableHead>Picking</TableHead>
                      <TableHead>Packing</TableHead>
                      <TableHead>Estado WMS</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(notesQ.data ?? []).map((n: any) => {
                      const totalLines = n.dispatch_note_lines?.length || 0;
                      const pickedCount = (n.dispatch_note_lines || []).filter((l: any) => l.picked).length;
                      const packedCount = (n.dispatch_note_lines || []).filter((l: any) => l.packed).length;
                      const isAllPicked = totalLines > 0 && pickedCount === totalLines;
                      const isAllPacked = totalLines > 0 && packedCount === totalLines;

                      return (
                        <TableRow key={n.id}>
                          <TableCell className="font-mono text-xs font-semibold">
                            {n.dispatch_number ? `#${n.dispatch_number}` : <span className="text-muted-foreground italic">Borrador</span>}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="font-medium">{n.parties?.name}</div>
                            {n.parties?.tax_id && <div className="text-[10px] text-muted-foreground">{n.parties.tax_id}</div>}
                          </TableCell>
                          <TableCell className="text-xs">{n.warehouses?.code} - {n.warehouses?.name}</TableCell>
                          <TableCell className="text-xs">{TRANSFER_LABELS[n.transfer_type as TransferType]}</TableCell>
                          <TableCell className="text-xs">
                            <div>{n.carrier_name}</div>
                            <div className="font-mono text-[10px] text-muted-foreground">{n.vehicle_plate}</div>
                          </TableCell>
                          <TableCell className="text-xs">{new Date(n.departure_at).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}</TableCell>
                          <TableCell>
                            <Badge variant={isAllPicked ? "default" : pickedCount > 0 ? "secondary" : "outline"} className={isAllPicked ? "bg-emerald-600 text-white hover:bg-emerald-700 text-[11px]" : "text-[11px]"}>
                              {pickedCount}/{totalLines}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={isAllPacked ? "default" : packedCount > 0 ? "secondary" : "outline"} className={isAllPacked ? "bg-emerald-600 text-white hover:bg-emerald-700 text-[11px]" : "text-[11px]"}>
                              {packedCount}/{totalLines}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1 items-start">
                              {isAllPacked ? (
                                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 text-[10px]">
                                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                  Lista despacho
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground text-[10px]">
                                  En preparación
                                </Badge>
                              )}
                              <span className="text-[9px] text-muted-foreground">
                                DTE: {n.status === "draft" ? "Borrador" : n.status}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 text-xs"
                              onClick={() => setSelectedGuideId(n.id)}
                            >
                              <Box className="h-3.5 w-3.5" />
                              Detalle & Picking
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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

        {/* Tab 5: Recepción WMS (Slotting / Racks / Calidad / Lotes) */}
        <TabsContent value="reception" className="space-y-6">
          {/* KPI Cards WMS */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                  Recepciones 3PL
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-foreground">
                  {(receiptsQ.data ?? []).length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Ingresos registrados en custodia</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                  Unidades Recibidas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {(receiptsQ.data ?? []).reduce((sum: number, r: any) => sum + Number(r.qty_change || 0), 0).toLocaleString("es-CL")}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Existencias 3PL ingresadas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                  Ubicaciones WMS
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {(locationsQ.data ?? []).length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Pasillos, racks y posiciones</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                  Bodegas de Acopio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {(warehousesQ.data ?? []).length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Almacenes autorizados</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            {/* Formulario de Recepción WMS */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowDownToLine className="h-4 w-4 text-emerald-600" />
                  Nueva Recepción en Custodia
                </CardTitle>
                <CardDescription>
                  Ingresa mercadería de un cliente 3PL a una bodega y asigna su ubicación física (slotting).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Cliente 3PL Propietario *</Label>
                  <Select
                    value={receptionForm.party_id}
                    onValueChange={(v) => setReceptionForm((f) => ({ ...f, party_id: v, warehouse_id: "", location_id: "NONE" }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder={clients3pl.length ? "Seleccionar cliente 3PL" : "No hay clientes 3PL registrados"} />
                    </SelectTrigger>
                    <SelectContent>
                      {clients3pl.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} {p.tax_id ? `(${p.tax_id})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Bodega Autorizada *</Label>
                  <Select
                    value={receptionForm.warehouse_id}
                    onValueChange={(v) => setReceptionForm((f) => ({ ...f, warehouse_id: v, location_id: "NONE" }))}
                    disabled={!receptionForm.party_id}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue
                        placeholder={
                          !receptionForm.party_id
                            ? "Selecciona un cliente primero"
                            : receptionAllowedWh.length
                            ? "Seleccionar bodega"
                            : "Cliente sin bodegas asignadas"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {receptionAllowedWh.map((w: any) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.code} - {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-500" />
                      Ubicación (Pasillo / Rack / Posición)
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-[11px] text-primary"
                      onClick={() => {
                        setNewLocWarehouseId(receptionForm.warehouse_id);
                        setNewLocModalOpen(true);
                      }}
                      disabled={!receptionForm.warehouse_id}
                    >
                      <Plus className="h-3 w-3 mr-0.5" />
                      Nueva Ubicación
                    </Button>
                  </div>
                  <Select
                    value={receptionForm.location_id}
                    onValueChange={(v) => setReceptionForm((f) => ({ ...f, location_id: v }))}
                    disabled={!receptionForm.warehouse_id}
                  >
                    <SelectTrigger className="h-8 text-xs font-mono">
                      <SelectValue placeholder="Sin ubicación / General" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Sin ubicación (General / Entrada)</SelectItem>
                      {receptionWhLocations.map((loc: any) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.code} {loc.name ? `- ${loc.name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Artículo / SKU *</Label>
                  <Select
                    value={receptionForm.item_id}
                    onValueChange={(v) => setReceptionForm((f) => ({ ...f, item_id: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Seleccionar artículo" />
                    </SelectTrigger>
                    <SelectContent>
                      {(itemsQ.data ?? []).map((i: any) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.code} - {i.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Cantidad a Ingresar *</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="0"
                      className="h-8 text-xs font-mono"
                      value={receptionForm.qty}
                      onChange={(e) => setReceptionForm((f) => ({ ...f, qty: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Costo Valorización ($)</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="ej. 1500"
                      className="h-8 text-xs font-mono"
                      value={receptionForm.rate}
                      onChange={(e) => setReceptionForm((f) => ({ ...f, rate: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">N° Lote (Opcional)</Label>
                    <Input
                      placeholder="ej. LOT-2026-X01"
                      className="h-8 text-xs font-mono"
                      value={receptionForm.lot_number}
                      onChange={(e) => setReceptionForm((f) => ({ ...f, lot_number: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fecha de Ingreso</Label>
                    <Input
                      type="date"
                      className="h-8 text-xs font-mono"
                      value={receptionForm.posting_date}
                      onChange={(e) => setReceptionForm((f) => ({ ...f, posting_date: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Control de Calidad (QC) / Observaciones</Label>
                  <Input
                    placeholder="ej. Embalaje óptimo, sin humedad, temperatura 4.2°C"
                    className="h-8 text-xs"
                    value={receptionForm.qc_notes}
                    onChange={(e) => setReceptionForm((f) => ({ ...f, qc_notes: e.target.value }))}
                  />
                </div>

                <Button
                  onClick={() => createReceiptM.mutate()}
                  disabled={
                    createReceiptM.isPending ||
                    !receptionForm.party_id ||
                    !receptionForm.warehouse_id ||
                    !receptionForm.item_id ||
                    !receptionForm.qty
                  }
                  className="w-full text-xs h-9 mt-2"
                >
                  {createReceiptM.isPending ? "Registrando ingreso..." : "Confirmar Recepción WMS"}
                </Button>
              </CardContent>
            </Card>

            {/* Historial de Recepciones WMS Recientes */}
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Box className="h-4 w-4 text-primary" />
                  Recepciones Recientes en Custodia
                </CardTitle>
                <CardDescription>
                  Últimos movimientos de ingreso físico con asignación de slotting, lote y control de calidad.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(receiptsQ.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">
                    Aún no hay recepciones WMS registradas para clientes 3PL.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {(receiptsQ.data ?? []).map((r: any) => (
                      <div key={r.id} className="p-3.5 rounded-lg border bg-card space-y-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-muted-foreground">{r.posting_date}</span>
                            <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30">
                              3PL: {r.parties?.name || "Cliente"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[11px]">
                              {r.warehouses?.name || "Bodega"}
                            </Badge>
                            {r.warehouse_locations ? (
                              <Badge variant="secondary" className="font-mono text-[10px] gap-1 bg-slate-500/10 text-slate-700 dark:text-slate-300">
                                <MapPin className="h-2.5 w-2.5 text-slate-500" />
                                {r.warehouse_locations.code}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground italic text-[10px]">Sin ubicación</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="font-mono font-semibold text-primary mr-1.5">{r.items?.code}</span>
                            <span className="font-medium text-foreground">{r.items?.name}</span>
                          </div>
                          <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                            +{Number(r.qty_change).toLocaleString("es-CL")} un.
                          </div>
                        </div>

                        {(r.lot_number || r.qc_notes) && (
                          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-muted-foreground bg-muted/30 p-1.5 rounded">
                            {r.lot_number && (
                              <span className="font-mono bg-background px-1.5 py-0.5 rounded border">
                                Lote: <strong>{r.lot_number}</strong>
                              </span>
                            )}
                            {r.qc_notes && (
                              <span className="flex items-center gap-1 italic">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                QC: {r.qc_notes}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* PESTAÑA 6: TRAZABILIDAD DE LOTES (Sprint 20)                 */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="traceability" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                Auditoría y Trazabilidad por Lote
              </CardTitle>
              <CardDescription>
                Rastrea el ciclo de vida completo de un lote: consulta en qué guías de despacho salió, destinatarios, fechas, transportistas y recepciones en bodega.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar lote (ej. LOTE-2026-X, L-0102...)"
                    className="pl-8 text-xs font-mono"
                    value={traceLotSearch}
                    onChange={(e) => setTraceLotSearch(e.target.value)}
                  />
                </div>
                {traceLotSearch && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => setTraceLotSearch("")}
                  >
                    Limpiar
                  </Button>
                )}
              </div>

              {!traceLotSearch.trim() ? (
                <div className="py-12 text-center text-muted-foreground border rounded-lg border-dashed p-8 space-y-2">
                  <Layers className="h-8 w-8 mx-auto text-muted-foreground/60" />
                  <p className="text-sm font-medium">Ingresa un número de lote para auditar su trazabilidad</p>
                  <p className="text-xs">
                    El sistema buscará todas las salidas en Guías de Despacho 3PL y movimientos de ingreso/custodia en Kardex.
                  </p>
                </div>
              ) : lotTraceQ.isLoading ? (
                <p className="text-xs text-muted-foreground py-8 text-center">Buscando registros del lote...</p>
              ) : ((lotTraceQ.data?.dispatches?.length ?? 0) === 0 && (lotTraceQ.data?.ledger?.length ?? 0) === 0) ? (
                <div className="py-12 text-center text-muted-foreground border rounded-lg border-dashed p-8">
                  <p className="text-sm font-medium">No se encontraron movimientos registrados para el lote "{traceLotSearch}".</p>
                  <p className="text-xs mt-1">Verifica que el número de lote coincida con las recepciones o pickings de bodega.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Sección 1: Guías de Despacho donde salió el lote */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Truck className="h-4 w-4 text-primary" />
                      Salidas en Guías de Despacho ({lotTraceQ.data?.dispatches?.length || 0})
                    </h3>
                    {(lotTraceQ.data?.dispatches?.length ?? 0) === 0 ? (
                      <p className="text-xs text-muted-foreground italic border rounded p-4">
                        Este lote no ha sido despachado en ninguna guía registrada aún.
                      </p>
                    ) : (
                      <div className="rounded-md border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Lote</TableHead>
                              <TableHead>N° Guía</TableHead>
                              <TableHead>Cliente 3PL</TableHead>
                              <TableHead>Artículo</TableHead>
                              <TableHead>Cant. Despachada</TableHead>
                              <TableHead>Ubicación WMS</TableHead>
                              <TableHead>Fecha Salida</TableHead>
                              <TableHead>Destino</TableHead>
                              <TableHead>Transportista</TableHead>
                              <TableHead>Estado Físico</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lotTraceQ.data?.dispatches?.map((l: any) => {
                              const note = l.dispatch_notes;
                              return (
                                <TableRow key={l.id}>
                                  <TableCell className="font-mono text-xs font-semibold text-primary">
                                    {l.lot_number}
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">
                                    {note?.dispatch_number ? `#${note.dispatch_number}` : <span className="italic text-muted-foreground">Borrador</span>}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <div className="font-medium">{note?.parties?.name}</div>
                                    {note?.parties?.tax_id && <div className="text-[10px] text-muted-foreground">{note.parties.tax_id}</div>}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <div className="font-semibold">{l.items?.code}</div>
                                    <div className="text-muted-foreground">{l.items?.name}</div>
                                  </TableCell>
                                  <TableCell className="font-mono text-xs font-bold">
                                    {Number(l.qty).toLocaleString("es-CL")} {l.uom || "un."}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {l.warehouse_locations ? (
                                      <Badge variant="secondary" className="font-mono text-[10px] gap-1">
                                        <MapPin className="h-2.5 w-2.5" />
                                        {l.warehouse_locations.code}
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground italic text-[11px]">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {note?.departure_at ? new Date(note.departure_at).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }) : "—"}
                                  </TableCell>
                                  <TableCell className="text-xs max-w-[180px] truncate" title={note?.destination_address}>
                                    {note?.destination_address || "—"}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <div>{note?.carrier_name}</div>
                                    <div className="font-mono text-[10px] text-muted-foreground">{note?.vehicle_plate}</div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col gap-1">
                                      {l.picked ? (
                                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
                                          ✓ Pickeado
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-[10px]">Pendiente pick</Badge>
                                      )}
                                      {l.packed && (
                                        <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[10px]">
                                          ✓ Empacado
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  {/* Sección 2: Historial Kardex de este lote (Recepciones, Salidas, Ajustes) */}
                  <div className="space-y-3 pt-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                      Historial Kardex / Entradas y Salidas ({lotTraceQ.data?.ledger?.length || 0})
                    </h3>
                    {(lotTraceQ.data?.ledger?.length ?? 0) === 0 ? (
                      <p className="text-xs text-muted-foreground italic border rounded p-4">
                        Sin movimientos directos en Kardex para este lote.
                      </p>
                    ) : (
                      <div className="rounded-md border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Tipo Movimiento</TableHead>
                              <TableHead>Bodega</TableHead>
                              <TableHead>Ubicación</TableHead>
                              <TableHead>Cliente / Tercero</TableHead>
                              <TableHead>Artículo</TableHead>
                              <TableHead className="text-right">Cantidad</TableHead>
                              <TableHead>Glosa / Notas</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lotTraceQ.data?.ledger?.map((e: any) => (
                              <TableRow key={e.id}>
                                <TableCell className="font-mono text-xs">{e.posting_date}</TableCell>
                                <TableCell className="text-xs">
                                  <Badge
                                    variant="outline"
                                    className={
                                      e.movement_type === "receipt"
                                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                        : e.movement_type === "issue"
                                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                        : "bg-slate-500/10 text-slate-700 dark:text-slate-300"
                                    }
                                  >
                                    {e.movement_type === "receipt" ? "Recepción" : e.movement_type === "issue" ? "Salida / Despacho" : e.movement_type}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs">{e.warehouses?.name || "—"}</TableCell>
                                <TableCell className="text-xs">
                                  {e.warehouse_locations ? (
                                    <span className="font-mono">{e.warehouse_locations.code}</span>
                                  ) : (
                                    <span className="text-muted-foreground italic">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs">{e.parties?.name || "General"}</TableCell>
                                <TableCell className="text-xs">
                                  <span className="font-mono font-medium">{e.items?.code}</span> · {e.items?.name}
                                </TableCell>
                                <TableCell className={`font-mono text-xs text-right font-bold ${Number(e.qty_change) > 0 ? "text-emerald-600" : "text-amber-600"}`}>
                                  {Number(e.qty_change) > 0 ? `+${Number(e.qty_change).toLocaleString("es-CL")}` : Number(e.qty_change).toLocaleString("es-CL")}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={e.memo || e.qc_notes}>
                                  {e.memo || e.qc_notes || "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Dialog: Crear Ubicación WMS Rápida */}
      <Dialog open={newLocModalOpen} onOpenChange={setNewLocModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Nueva Ubicación de Bodega (Slotting)
            </DialogTitle>
            <DialogDescription>
              Crea una posición física dentro de la bodega (ejemplo: pasillo, rack, nivel o casillero).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs">Bodega *</Label>
              <Select
                value={newLocWarehouseId}
                onValueChange={setNewLocWarehouseId}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Seleccionar bodega" />
                </SelectTrigger>
                <SelectContent>
                  {(warehousesQ.data ?? []).map((w: any) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.code} - {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Código de Ubicación (SKU Físico) *</Label>
              <Input
                placeholder="ej. PAS-01-RACK-02-NIV-01 o A-01-01"
                className="h-8 text-xs font-mono uppercase"
                value={newLocCode}
                onChange={(e) => setNewLocCode(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Identificador único de la posición dentro de la bodega.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Descripción / Referencia (Opcional)</Label>
              <Input
                placeholder="ej. Pasillo A, Rack 1, Nivel 1 (Frío)"
                className="h-8 text-xs"
                value={newLocName}
                onChange={(e) => setNewLocName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNewLocModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => createLocM.mutate()}
              disabled={createLocM.isPending || !newLocCode.trim()}
            >
              {createLocM.isPending ? "Guardando..." : "Crear Ubicación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Dialog: Detalle de Guía, Picking y Packing (Sprint 20) */}
      <Dialog open={!!selectedGuideId} onOpenChange={(open) => !open && setSelectedGuideId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedGuide && (() => {
            const linesList: any[] = selectedGuide.dispatch_note_lines || [];
            const totalLines = linesList.length;
            const pickedCount = linesList.filter((l) => l.picked).length;
            const packedCount = linesList.filter((l) => l.packed).length;
            const isAllPicked = totalLines > 0 && pickedCount === totalLines;
            const isAllPacked = totalLines > 0 && packedCount === totalLines;

            return (
              <div className="space-y-5">
                <DialogHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <DialogTitle className="flex items-center gap-2 text-lg">
                      <Truck className="h-5 w-5 text-primary" />
                      Guía de Despacho {selectedGuide.dispatch_number ? `#${selectedGuide.dispatch_number}` : <span className="italic text-muted-foreground text-sm font-normal">Borrador (#{selectedGuide.id.slice(0, 8)})</span>}
                    </DialogTitle>
                    <div className="flex items-center gap-2">
                      {isAllPacked ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          Lista para despacho
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          En preparación ({packedCount}/{totalLines} empacadas)
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs uppercase">
                        DTE: {selectedGuide.status}
                      </Badge>
                    </div>
                  </div>
                  <DialogDescription className="text-xs">
                    Revisión de avance operativo: picking desde ubicaciones de bodega y embalaje (packing) de la carga.
                  </DialogDescription>
                </DialogHeader>

                {/* Banner de estado */}
                {isAllPacked ? (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-sm block">¡Guía 100% Empacada y Lista para Despacho!</span>
                      <span>Todas las líneas físicas han sido retiradas de su ubicación y embaladas. La mercadería puede ser cargada al transporte ({selectedGuide.carrier_name}, patente {selectedGuide.vehicle_plate}).</span>
                    </div>
                  </div>
                ) : !isAllPicked ? (
                  <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
                    <Box className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Fase 1 - Picking pendiente: </span>
                      Haz clic en "Pickear" en cada línea para indicar la sub-ubicación física de retiro y el número de lote. Al confirmar, el stock saldrá automáticamente del inventario (Kardex).
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                    <PackageCheck className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Fase 2 - Packing en curso: </span>
                      El picking está completado. A medida que embale cada producto, marque el checkbox "Empacada" para autorizar la salida de la guía.
                    </div>
                  </div>
                )}

                {/* Información de cabecera */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-muted/40 p-3 rounded-lg border">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Cliente 3PL</span>
                    <span className="font-semibold text-foreground">{selectedGuide.parties?.name}</span>
                    {selectedGuide.parties?.tax_id && <span className="block text-[10px] text-muted-foreground">{selectedGuide.parties.tax_id}</span>}
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Bodega Origen</span>
                    <span className="font-semibold text-foreground">{selectedGuide.warehouses?.code} - {selectedGuide.warehouses?.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Transportista</span>
                    <span className="font-semibold text-foreground">{selectedGuide.carrier_name}</span>
                    <span className="block font-mono text-[10px] text-muted-foreground">Pat: {selectedGuide.vehicle_plate}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Fecha Salida</span>
                    <span className="font-semibold text-foreground">{new Date(selectedGuide.departure_at).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground block text-[11px]">Dirección Origen</span>
                    <span className="truncate block text-foreground" title={selectedGuide.origin_address}>{selectedGuide.origin_address}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground block text-[11px]">Dirección Destino</span>
                    <span className="truncate block text-foreground" title={selectedGuide.destination_address}>{selectedGuide.destination_address}</span>
                  </div>
                </div>

                {/* Tabla de líneas para Picking y Packing */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Líneas de la Guía ({totalLines})</h4>
                    <span className="text-xs text-muted-foreground">
                      Picking: <strong>{pickedCount}/{totalLines}</strong> · Packing: <strong>{packedCount}/{totalLines}</strong>
                    </span>
                  </div>

                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ítem / Artículo</TableHead>
                          <TableHead>Cantidad</TableHead>
                          <TableHead>Ubicación WMS</TableHead>
                          <TableHead>Lote</TableHead>
                          <TableHead>Picking (Retiro)</TableHead>
                          <TableHead className="text-center">Packing (Embalaje)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {linesList.map((l: any) => (
                          <TableRow key={l.id}>
                            <TableCell className="text-xs">
                              <div className="font-mono font-semibold text-primary">{l.items?.code}</div>
                              <div className="text-foreground">{l.items?.name}</div>
                            </TableCell>
                            <TableCell className="font-mono text-xs font-bold">
                              {Number(l.qty).toLocaleString("es-CL")} {l.uom || "un."}
                            </TableCell>
                            <TableCell className="text-xs">
                              {l.warehouse_locations ? (
                                <Badge variant="secondary" className="font-mono text-[10px] gap-1">
                                  <MapPin className="h-2.5 w-2.5" />
                                  {l.warehouse_locations.code}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground italic text-[11px]">Pendiente de pick</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              {l.lot_number ? (
                                <Badge variant="outline" className="font-mono text-[10px]">
                                  {l.lot_number}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-[11px]">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              {l.picked ? (
                                <div className="space-y-0.5">
                                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] gap-1">
                                    <Check className="h-3 w-3 text-emerald-600" />
                                    Pickeado
                                  </Badge>
                                  {l.picked_at && (
                                    <span className="text-[10px] text-muted-foreground block font-mono">
                                      {new Date(l.picked_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10"
                                  onClick={() => openPickingDialog(l, selectedGuide)}
                                >
                                  <Box className="h-3 w-3" />
                                  Pickear
                                </Button>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center justify-center gap-1">
                                <label className={`flex items-center gap-1.5 cursor-pointer ${!l.picked ? "opacity-40 cursor-not-allowed" : ""}`}>
                                  <Checkbox
                                    checked={l.packed}
                                    disabled={!l.picked || togglePackedM.isPending}
                                    onCheckedChange={(c) => togglePackedM.mutate({ lineId: l.id, packed: !!c })}
                                  />
                                  <span className="text-[11px] font-medium">
                                    {l.packed ? "Empacada" : "Pendiente"}
                                  </span>
                                </label>
                                {!l.picked && (
                                  <span className="text-[9px] text-muted-foreground">Requiere pick</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <DialogFooter className="pt-2 flex justify-between items-center sm:justify-between">
                  <div className="text-xs text-muted-foreground">
                    {isAllPacked ? (
                      <span className="text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Guía lista para retiro y transporte
                      </span>
                    ) : (
                      <span>Completa el picking y packing de todas las líneas para habilitar despacho</span>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelectedGuideId(null)}>
                    Cerrar
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Modal Dialog: Confirmar Picking de Línea y Salida de Stock (Sprint 20) */}
      <Dialog open={!!pickingLine} onOpenChange={(open) => !open && setPickingLine(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Box className="h-5 w-5 text-primary" />
              Confirmar Picking de Línea
            </DialogTitle>
            <DialogDescription className="text-xs">
              Registra el retiro físico de mercadería desde la ubicación de bodega. Se generará automáticamente la salida de inventario (Kardex).
            </DialogDescription>
          </DialogHeader>

          {pickingLine && (() => {
            const { line, guide } = pickingLine;
            const whLocations = (locationsQ.data ?? []).filter((loc: any) => loc.warehouse_id === guide.warehouse_id);

            return (
              <div className="space-y-4 py-2 text-xs">
                {/* Info del ítem */}
                <div className="p-3 rounded-lg bg-muted/40 border space-y-1.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono font-bold text-primary mr-1.5">{line.items?.code}</span>
                      <span className="font-medium text-foreground">{line.items?.name}</span>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">
                      {Number(line.qty).toLocaleString("es-CL")} {line.uom || "un."}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <span>Bodega: <strong>{guide.warehouses?.code} - {guide.warehouses?.name}</strong></span>
                    <span>·</span>
                    <span>Cliente: <strong>{guide.parties?.name}</strong></span>
                  </div>
                </div>

                {/* Sub-ubicación WMS */}
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-500" />
                    Ubicación Física de Retiro (Slotting)
                  </Label>
                  <Select
                    value={pickLocationId}
                    onValueChange={setPickLocationId}
                  >
                    <SelectTrigger className="h-8 text-xs font-mono">
                      <SelectValue placeholder="Seleccionar ubicación de retiro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Sin ubicación específica (Piso / General)</SelectItem>
                      {whLocations.map((loc: any) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.code} {loc.name ? `- ${loc.name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Posición física dentro de la bodega desde donde el operario retira el producto.
                  </p>
                </div>

                {/* Lote */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Número de Lote (Trazabilidad)</Label>
                  <Input
                    placeholder="ej. LOTE-2026-03 o LOT-A12"
                    className="h-8 text-xs font-mono"
                    value={pickLotNumber}
                    onChange={(e) => setPickLotNumber(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Registrar el lote garantiza la trazabilidad completa ante consultas de clientes o inspecciones.
                  </p>
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPickingLine(null)}
                    disabled={confirmPickingM.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => confirmPickingM.mutate()}
                    disabled={confirmPickingM.isPending}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {confirmPickingM.isPending ? "Confirmando..." : "Confirmar Picking & Salida"}
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
