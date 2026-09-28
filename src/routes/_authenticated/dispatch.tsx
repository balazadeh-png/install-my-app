import { Textarea } from "@/components/ui/textarea";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEntity } from "@/context/ActiveEntityContext";
import { generateServiceInvoiceFn } from "@/lib/billing3pl.functions";
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
import { ArrowLeft, Plus, Trash2, Truck, Users, UserPlus, Globe, ShieldAlert, FileCheck, AlertCircle, ArrowDownToLine, MapPin, Box, CheckCircle2, ClipboardCheck, Layers, PackageCheck, Package, Search, Eye, Check, Clock, Navigation, Route as RouteIcon, Car, ArrowUp, ArrowDown, Play, CheckCheck, XCircle, Gauge, Edit, Calendar, ExternalLink, LocateFixed, Upload, Key, Copy, RefreshCw, ShoppingCart, FileText, Receipt, Zap, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dispatch")({
  head: () => ({
    meta: [
      { title: "Operaciones 3PL, WMS & TMS — EasyERP" },
      { name: "description", content: "Gestión de clientes 3PL, guías de despacho (Res. 154), WMS picking/packing, TMS rutas y flota propia, tracking de entregas, couriers y operaciones SICEX." },
      { property: "og:title", content: "Operaciones 3PL, WMS & TMS — EasyERP" },
      { property: "og:description", content: "Clientes 3PL, bodegas asignadas, guías de despacho, picking/packing, rutas TMS, flota, tracking de entregas y operaciones SICEX." },
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

// Sprint 25: Contratos y Tarifarios 3PL
type BillingFrequency = "mensual" | "quincenal";
const BILLING_FREQUENCY_LABELS: Record<BillingFrequency, string> = {
  mensual: "Mensual",
  quincenal: "Quincenal",
};

type ServiceRateType = "storage_pallet" | "storage_m2" | "picking_unit" | "transport_km" | "recargo_fijo";
const SERVICE_RATE_LABELS: Record<ServiceRateType, { label: string; unit: string; description: string }> = {
  storage_pallet: { label: "Almacenaje por Pallet", unit: "$/pallet/mes", description: "Tarifa por pallet estándar almacenado" },
  storage_m2: { label: "Almacenaje por m²", unit: "$/m²/mes", description: "Tarifa por metro cuadrado ocupado" },
  picking_unit: { label: "Picking por Unidad", unit: "$/unidad", description: "Costo por cada unidad pickeada y embalada" },
  transport_km: { label: "Transporte por Km", unit: "$/km", description: "Tarifa variable por kilómetro recorrido" },
  recargo_fijo: { label: "Recargo Fijo / Otros", unit: "$ fijo", description: "Recargo fijo (combustible, fds, administración)" },
};

type RouteStatus = "planificada" | "en_curso" | "finalizada" | "cancelada";
const ROUTE_STATUS_LABELS: Record<RouteStatus, string> = {
  planificada: "Planificada",
  en_curso: "En curso",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};
const ROUTE_STATUS_BADGES: Record<RouteStatus, { label: string; className: string }> = {
  planificada: { label: "Planificada", className: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  en_curso: { label: "En Curso", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  finalizada: { label: "Finalizada", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  cancelada: { label: "Cancelada", className: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30" },
};

type StopDeliveryStatus = "pendiente" | "en_ruta" | "entregado" | "no_entregado";
const STOP_DELIVERY_STATUS_LABELS: Record<StopDeliveryStatus, string> = {
  pendiente: "Pendiente",
  en_ruta: "En ruta",
  entregado: "Entregado",
  no_entregado: "No entregado",
};
const STOP_DELIVERY_STATUS_BADGES: Record<StopDeliveryStatus, { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30" },
  en_ruta: { label: "En Ruta", className: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  entregado: { label: "Entregado", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  no_entregado: { label: "No Entregado", className: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30" },
};

type OrderStatus = "pendiente" | "procesado" | "cancelado";
const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pendiente: "Pendiente",
  procesado: "Procesado",
  cancelado: "Cancelado",
};
const ORDER_STATUS_BADGES: Record<OrderStatus, { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  procesado: { label: "Procesado", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  cancelado: { label: "Cancelado", className: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30" },
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
    courier_name: "",
    courier_tracking_number: "",
    courier_status: "En preparación",
    distance_km: "",
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
          courier_name: form.courier_name.trim() || null,
          courier_tracking_number: form.courier_tracking_number.trim() || null,
          courier_status: form.courier_tracking_number.trim() ? form.courier_status.trim() || "En preparación" : null,
          distance_km: form.distance_km ? Number(form.distance_km) : null,
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
      setForm((f) => ({
        ...f,
        dispatch_number: "",
        departure_at: "",
        arrival_at: "",
        courier_name: "",
        courier_tracking_number: "",
        courier_status: "En preparación",
        distance_km: "",
      }));
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

  // ---------- TMS: Flota Propia (Sprint 21) ----------
  const calcGuideWeightAndVol = (note: any) => {
    let kg = 0;
    let m3 = 0;
    for (const l of note?.dispatch_note_lines || []) {
      if (l.weight_kg) kg += Number(l.weight_kg);
      if (l.volume_m3) m3 += Number(l.volume_m3);
    }
    return { kg, m3 };
  };

  const vehiclesQ = useQuery({
    queryKey: ["vehicles", activeEntityId],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles" as any)
        .select("*")
        .eq("entity_id", activeEntityId!)
        .order("plate");
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [vehicleForm, setVehicleForm] = useState({
    plate: "",
    vehicle_type: "Camión 3/4",
    capacity_kg: "",
    capacity_m3: "",
    active: true,
  });

  const openCreateVehicleModal = () => {
    setEditingVehicleId(null);
    setVehicleForm({
      plate: "",
      vehicle_type: "Camión 3/4",
      capacity_kg: "",
      capacity_m3: "",
      active: true,
    });
    setVehicleModalOpen(true);
  };

  const openEditVehicleModal = (v: any) => {
    setEditingVehicleId(v.id);
    setVehicleForm({
      plate: v.plate,
      vehicle_type: v.vehicle_type || "Camión 3/4",
      capacity_kg: v.capacity_kg ? String(v.capacity_kg) : "",
      capacity_m3: v.capacity_m3 ? String(v.capacity_m3) : "",
      active: v.active ?? true,
    });
    setVehicleModalOpen(true);
  };

  const saveVehicleM = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Sin empresa activa");
      const plate = vehicleForm.plate.trim().toUpperCase();
      if (!plate) throw new Error("Ingresa la patente del vehículo");
      const capKg = vehicleForm.capacity_kg ? Number(vehicleForm.capacity_kg) : null;
      const capM3 = vehicleForm.capacity_m3 ? Number(vehicleForm.capacity_m3) : null;

      if (editingVehicleId) {
        const { error } = await supabase
          .from("vehicles" as any)
          .update({
            plate,
            vehicle_type: vehicleForm.vehicle_type || null,
            capacity_kg: capKg,
            capacity_m3: capM3,
            active: vehicleForm.active,
          })
          .eq("id", editingVehicleId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vehicles" as any).insert({
          entity_id: activeEntityId,
          plate,
          vehicle_type: vehicleForm.vehicle_type || null,
          capacity_kg: capKg,
          capacity_m3: capM3,
          active: vehicleForm.active,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingVehicleId ? "Vehículo actualizado" : "Vehículo registrado en flota propia");
      setVehicleModalOpen(false);
      qc.invalidateQueries({ queryKey: ["vehicles", activeEntityId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleVehicleActiveM = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("vehicles" as any)
        .update({ active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicles", activeEntityId] });
      toast.success("Estado del vehículo actualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---------- TMS: Rutas de Reparto (Sprint 21) ----------
  const routesQ = useQuery({
    queryKey: ["routes", activeEntityId],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes" as any)
        .select(`
          *,
          vehicles(id, plate, vehicle_type, capacity_kg, capacity_m3),
          route_stops(
            id,
            stop_order,
            notes,
            dispatch_note_id,
            delivery_status,
            arrived_at,
            lat,
            lng,
            received_by,
            delivery_notes,
            dispatch_notes(
              id,
              dispatch_number,
              carrier_name,
              carrier_tax_id,
              vehicle_plate,
              courier_name,
              courier_tracking_number,
              courier_status,
              destination_address,
              departure_at,
              status,
              parties(id, name, tax_id),
              dispatch_note_lines(
                id,
                qty,
                uom,
                weight_kg,
                volume_m3,
                picked,
                packed,
                items(code, name)
              )
            )
          )
        `)
        .eq("entity_id", activeEntityId!)
        .order("route_date", { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const [routeModalOpen, setRouteModalOpen] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [routeForm, setRouteForm] = useState({
    name: "",
    route_date: new Date().toISOString().slice(0, 10),
    vehicle_id: "NONE",
    driver_name: "",
    notes: "",
  });
  const [routeStops, setRouteStops] = useState<{ dispatch_note_id: string; stop_order: number; noteData?: any }[]>([]);
  const [selectedRouteForView, setSelectedRouteForView] = useState<any | null>(null);

  const openCreateRouteModal = () => {
    setEditingRouteId(null);
    setRouteForm({
      name: `Ruta ${new Date().toISOString().slice(0, 10)}`,
      route_date: new Date().toISOString().slice(0, 10),
      vehicle_id: "NONE",
      driver_name: "",
      notes: "",
    });
    setRouteStops([]);
    setRouteModalOpen(true);
  };

  const openEditRouteModal = (route: any) => {
    setEditingRouteId(route.id);
    setRouteForm({
      name: route.name || "",
      route_date: route.route_date,
      vehicle_id: route.vehicle_id || "NONE",
      driver_name: route.driver_name || "",
      notes: route.notes || "",
    });
    const sorted = [...(route.route_stops || [])].sort((a: any, b: any) => a.stop_order - b.stop_order);
    setRouteStops(
      sorted.map((s: any) => ({
        dispatch_note_id: s.dispatch_note_id,
        stop_order: s.stop_order,
        noteData: s.dispatch_notes,
      }))
    );
    setRouteModalOpen(true);
  };

  const moveStopUp = (index: number) => {
    if (index === 0) return;
    setRouteStops((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index]!;
      copy[index] = temp!;
      return copy.map((s, i) => ({ ...s, stop_order: i + 1 }));
    });
  };

  const moveStopDown = (index: number) => {
    setRouteStops((prev) => {
      if (index >= prev.length - 1) return prev;
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index]!;
      copy[index] = temp!;
      return copy.map((s, i) => ({ ...s, stop_order: i + 1 }));
    });
  };

  const removeStop = (dispatchNoteId: string) => {
    setRouteStops((prev) =>
      prev
        .filter((s) => s.dispatch_note_id !== dispatchNoteId)
        .map((s, i) => ({ ...s, stop_order: i + 1 }))
    );
  };

  const addStop = (note: any) => {
    if (routeStops.some((s) => s.dispatch_note_id === note.id)) return;
    setRouteStops((prev) => [
      ...prev,
      {
        dispatch_note_id: note.id,
        stop_order: prev.length + 1,
        noteData: note,
      },
    ]);
  };

  const saveRouteM = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Sin empresa activa");
      if (!routeForm.route_date) throw new Error("Ingresa la fecha de la ruta");
      if (routeStops.length === 0) throw new Error("Asigna al menos una guía de despacho a la ruta");

      const vehId = routeForm.vehicle_id && routeForm.vehicle_id !== "NONE" ? routeForm.vehicle_id : null;
      let targetRouteId = editingRouteId;

      if (editingRouteId) {
        const { error } = await supabase
          .from("routes" as any)
          .update({
            name: routeForm.name.trim() || null,
            route_date: routeForm.route_date,
            vehicle_id: vehId,
            driver_name: routeForm.driver_name.trim() || null,
            notes: routeForm.notes.trim() || null,
          })
          .eq("id", editingRouteId);
        if (error) throw error;

        const { error: delErr } = await supabase.from("route_stops" as any).delete().eq("route_id", editingRouteId);
        if (delErr) throw delErr;
      } else {
        const { data: newRoute, error } = await supabase
          .from("routes" as any)
          .insert({
            entity_id: activeEntityId,
            name: routeForm.name.trim() || `Ruta ${routeForm.route_date}`,
            route_date: routeForm.route_date,
            vehicle_id: vehId,
            driver_name: routeForm.driver_name.trim() || null,
            status: "planificada",
            notes: routeForm.notes.trim() || null,
          })
          .select("id")
          .single();
        if (error) throw error;
        targetRouteId = (newRoute as any).id;
      }

      const stopsToInsert = routeStops.map((s, index) => ({
        route_id: targetRouteId,
        dispatch_note_id: s.dispatch_note_id,
        stop_order: index + 1,
      }));

      const { error: insErr } = await supabase.from("route_stops" as any).insert(stopsToInsert);
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      toast.success(editingRouteId ? "Ruta actualizada" : "Ruta planificada con éxito");
      setRouteModalOpen(false);
      qc.invalidateQueries({ queryKey: ["routes", activeEntityId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRouteStatusM = useMutation({
    mutationFn: async ({ routeId, status }: { routeId: string; status: RouteStatus }) => {
      const { error } = await supabase
        .from("routes" as any)
        .update({ status })
        .eq("id", routeId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(`Estado de la ruta actualizado a ${ROUTE_STATUS_LABELS[vars.status]}`);
      qc.invalidateQueries({ queryKey: ["routes", activeEntityId] });
      if (selectedRouteForView) {
        setSelectedRouteForView((prev: any) => (prev ? { ...prev, status: vars.status } : null));
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [markingStopDelivery, setMarkingStopDelivery] = useState<{
    stop: any;
    routeId: string;
  } | null>(null);

  const [deliveryForm, setDeliveryForm] = useState<{
    status: StopDeliveryStatus;
    received_by: string;
    delivery_notes: string;
    lat: number | null;
    lng: number | null;
    gpsCaptured: boolean;
    gpsLoading: boolean;
  }>({
    status: "entregado",
    received_by: "",
    delivery_notes: "",
    lat: null,
    lng: null,
    gpsCaptured: false,
    gpsLoading: false,
  });

  const openStopDeliveryDialog = (stop: any, routeId: string, initialStatus: StopDeliveryStatus = "entregado") => {
    setMarkingStopDelivery({ stop, routeId });
    setDeliveryForm({
      status: initialStatus,
      received_by: stop.received_by || "",
      delivery_notes: stop.delivery_notes || "",
      lat: stop.lat ?? null,
      lng: stop.lng ?? null,
      gpsCaptured: !!(stop.lat && stop.lng),
      gpsLoading: false,
    });
  };

  const captureGpsLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      toast.info("Geolocalización no disponible en este dispositivo");
      return;
    }
    setDeliveryForm((f) => ({ ...f, gpsLoading: true }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDeliveryForm((f) => ({
          ...f,
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          gpsCaptured: true,
          gpsLoading: false,
        }));
        toast.success("Coordenadas GPS capturadas");
      },
      (err) => {
        console.warn("GPS error", err);
        setDeliveryForm((f) => ({ ...f, gpsLoading: false }));
        toast.info("No se obtuvo GPS (permiso no concedido o no disponible). Se registrará la entrega sin coordenadas.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const updateStopDeliveryM = useMutation({
    mutationFn: async ({
      stopId,
      deliveryStatus,
      receivedBy,
      notes,
      lat,
      lng,
    }: {
      stopId: string;
      deliveryStatus: StopDeliveryStatus;
      receivedBy?: string;
      notes?: string;
      lat?: number | null;
      lng?: number | null;
    }) => {
      const isDelivered = deliveryStatus === "entregado";
      const { error } = await supabase
        .from("route_stops" as any)
        .update({
          delivery_status: deliveryStatus,
          arrived_at: isDelivered ? new Date().toISOString() : null,
          received_by: isDelivered ? (receivedBy?.trim() || null) : null,
          delivery_notes: notes?.trim() || null,
          lat: lat ?? null,
          lng: lng ?? null,
        })
        .eq("id", stopId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(`Parada marcada como ${STOP_DELIVERY_STATUS_LABELS[vars.deliveryStatus]}`);
      qc.invalidateQueries({ queryKey: ["routes", activeEntityId] });
      setMarkingStopDelivery(null);
      if (selectedRouteForView) {
        setSelectedRouteForView((prev: any) => {
          if (!prev) return null;
          const updatedStops = (prev.route_stops || []).map((s: any) => {
            if (s.id === vars.stopId) {
              return {
                ...s,
                delivery_status: vars.deliveryStatus,
                arrived_at: vars.deliveryStatus === "entregado" ? new Date().toISOString() : null,
                received_by: vars.receivedBy || null,
                delivery_notes: vars.notes || null,
                lat: vars.lat ?? null,
                lng: vars.lng ?? null,
              };
            }
            return s;
          });
          return { ...prev, route_stops: updatedStops };
        });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ==========================================================================
  // OMS: PEDIDOS MULTICANAL & WEBHOOKS (Sprint 23)
  // ==========================================================================
  const ordersQ = useQuery({
    queryKey: ["sales_orders", activeEntityId],
    enabled: !!activeEntityId,
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
          updated_at,
          parties(id, name, tax_id),
          sales_order_lines(
            id,
            item_id,
            external_sku,
            qty,
            items(id, code, name)
          ),
          dispatch_notes(id, dispatch_number, status)
        `)
        .eq("entity_id", activeEntityId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const webhookTokensQ = useQuery({
    queryKey: ["party_webhook_tokens", activeEntityId],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("party_webhook_tokens")
        .select(`
          id,
          party_id,
          token,
          name,
          is_active,
          created_at,
          parties(id, name, entity_id)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as any[]) ?? []).filter((t) => t.parties?.entity_id === activeEntityId);
    },
  });

  // Filtros OMS
  const [omsSearch, setOmsSearch] = useState("");
  const [omsStatusFilter, setOmsStatusFilter] = useState<string>("all");
  const [omsChannelFilter, setOmsChannelFilter] = useState<string>("all");
  const [omsClientFilter, setOmsClientFilter] = useState<string>("all");
  const [selectedOrderForView, setSelectedOrderForView] = useState<any>(null);

  // Formulario Pedido Manual
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [manualOrderForm, setManualOrderForm] = useState({
    party_id: "",
    channel: "manual",
    external_order_id: "",
    destination_address: "",
    notes: "",
  });
  const [manualOrderLines, setManualOrderLines] = useState<Array<{
    item_id: string;
    external_sku: string;
    qty: string;
  }>>([{ item_id: "", external_sku: "", qty: "1" }]);

  // Importador CSV
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [csvPartyId, setCsvPartyId] = useState("");
  const [csvChannel, setCsvChannel] = useState("csv");
  const [csvRawText, setCsvRawText] = useState("");
  const [csvParsedPreview, setCsvParsedPreview] = useState<Array<{
    external_order_id: string;
    destination_address: string;
    sku: string;
    qty: number;
  }>>([]);

  // Token Modal
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [generatedTokenData, setGeneratedTokenData] = useState<{
    token: string;
    clientName: string;
  } | null>(null);

  // Portal Cliente 3PL (Sprint 24)
  const [portalUserEmail, setPortalUserEmail] = useState("");

  const handleCsvTextChange = (raw: string) => {
    setCsvRawText(raw);
    const textLines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (!textLines.length) {
      setCsvParsedPreview([]);
      return;
    }

    let startIdx = 0;
    const headerLower = textLines[0]!.toLowerCase();
    if (headerLower.includes("order") || headerLower.includes("pedido") || headerLower.includes("sku")) {
      startIdx = 1;
    }

    const parsed: Array<{
      external_order_id: string;
      destination_address: string;
      sku: string;
      qty: number;
    }> = [];

    for (let i = startIdx; i < textLines.length; i++) {
      const parts = textLines[i]!.split(/[,;\t]/).map((p) => p.trim());
      if (parts.length >= 3) {
        const extId = parts[0];
        const dest = parts.length >= 4 ? parts[1] : "";
        const sku = parts.length >= 4 ? parts[2] : parts[1];
        const qtyVal = Number(parts.length >= 4 ? parts[3] : parts[2]) || 1;

        if (extId && sku) {
          parsed.push({
            external_order_id: extId,
            destination_address: dest ?? "",
            sku,
            qty: qtyVal > 0 ? qtyVal : 1,
          });
        }
      }
    }

    setCsvParsedPreview(parsed);
  };

  // Mutación: Crear Pedido Manual
  const createManualOrderM = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Sin empresa activa");
      if (!manualOrderForm.party_id) throw new Error("Selecciona un cliente 3PL");
      if (!manualOrderForm.external_order_id.trim()) throw new Error("Ingresa el identificador o número del pedido");
      const validLines = manualOrderLines.filter((l) => Number(l.qty) > 0 && (l.external_sku.trim() || l.item_id));
      if (!validLines.length) throw new Error("Agrega al menos una línea con producto y cantidad válida");

      // Inserción en sales_orders
      const { data: order, error: oErr } = await supabase
        .from("sales_orders")
        .insert({
          entity_id: activeEntityId,
          party_id: manualOrderForm.party_id,
          channel: manualOrderForm.channel.trim() || "manual",
          external_order_id: manualOrderForm.external_order_id.trim(),
          destination_address: manualOrderForm.destination_address.trim() || null,
          status: "pendiente",
          notes: manualOrderForm.notes.trim() || null,
        })
        .select("id")
        .single();

      if (oErr) {
        if (oErr.code === "23505" || oErr.message.includes("unique")) {
          throw new Error(`Ya existe un pedido con ID '${manualOrderForm.external_order_id}' para este cliente y canal.`);
        }
        throw oErr;
      }

      // Inserción de líneas
      const linesToInsert = validLines.map((l) => ({
        sales_order_id: order.id,
        item_id: l.item_id || null,
        external_sku: l.external_sku.trim() || (items.find((it) => it.id === l.item_id)?.code ?? null),
        qty: Number(l.qty),
      }));

      const { error: lErr } = await supabase.from("sales_order_lines").insert(linesToInsert);
      if (lErr) throw lErr;
    },
    onSuccess: () => {
      toast.success("Pedido OMS creado exitosamente");
      setIsNewOrderOpen(false);
      setManualOrderForm({
        party_id: "",
        channel: "manual",
        external_order_id: "",
        destination_address: "",
        notes: "",
      });
      setManualOrderLines([{ item_id: "", external_sku: "", qty: "1" }]);
      qc.invalidateQueries({ queryKey: ["sales_orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mutación: Importar CSV
  const importCsvOrdersM = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Sin empresa activa");
      if (!csvPartyId) throw new Error("Selecciona un cliente 3PL para los pedidos");
      if (!csvParsedPreview.length) throw new Error("No hay pedidos válidos para importar");

      const ordersMap = new Map<string, {
        destination_address: string;
        lines: Array<{ sku: string; qty: number }>;
      }>();

      for (const row of csvParsedPreview) {
        const id = row.external_order_id.trim();
        if (!ordersMap.has(id)) {
          ordersMap.set(id, {
            destination_address: row.destination_address,
            lines: [],
          });
        }
        ordersMap.get(id)!.lines.push({ sku: row.sku, qty: row.qty });
      }

      let importedCount = 0;
      for (const [extId, o] of ordersMap.entries()) {
        const { data: insertedOrder, error: oErr } = await supabase
          .from("sales_orders")
          .upsert({
            entity_id: activeEntityId,
            party_id: csvPartyId,
            channel: csvChannel.trim() || "csv",
            external_order_id: extId,
            destination_address: o.destination_address || null,
            status: "pendiente",
          }, { onConflict: "party_id,channel,external_order_id" })
          .select("id")
          .single();

        if (oErr) throw oErr;

        await supabase.from("sales_order_lines").delete().eq("sales_order_id", insertedOrder.id);

        const linesToInsert = o.lines.map((l) => {
          const matchedItem = items.find(
            (it) => it.code?.toLowerCase() === l.sku.toLowerCase() || it.name?.toLowerCase() === l.sku.toLowerCase()
          );
          return {
            sales_order_id: insertedOrder.id,
            item_id: matchedItem?.id || null,
            external_sku: l.sku,
            qty: l.qty,
          };
        });

        const { error: lErr } = await supabase.from("sales_order_lines").insert(linesToInsert);
        if (lErr) throw lErr;
        importedCount++;
      }

      return importedCount;
    },
    onSuccess: (count) => {
      toast.success(`${count} pedidos importados exitosamente`);
      setIsCsvImportOpen(false);
      setCsvRawText("");
      setCsvParsedPreview([]);
      qc.invalidateQueries({ queryKey: ["sales_orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mutación: Convertir Pedido a Guía de Despacho
  const convertOrderToDispatchNoteM = useMutation({
    mutationFn: async (order: any) => {
      if (!activeEntityId) throw new Error("Sin empresa activa");
      if (order.status !== "pendiente") throw new Error("Solo pedidos pendientes pueden convertirse a guía");

      const clientWhs = pws.filter((x) => x.party_id === order.party_id);
      const whId = clientWhs.length > 0 ? clientWhs[0]!.warehouse_id : (warehouses[0]?.id || "");
      if (!whId) {
        throw new Error("No hay bodegas disponibles en el sistema para asociar la guía");
      }

      const lines = order.sales_order_lines || [];
      if (!lines.length) {
        throw new Error("El pedido no contiene líneas para despachar");
      }

      // Crear despacho en borrador
      const { data: note, error: nErr } = await supabase
        .from("dispatch_notes")
        .insert({
          entity_id: activeEntityId,
          party_id: order.party_id,
          warehouse_id: whId,
          transfer_type: "venta",
          carrier_name: "Por asignar (OMS)",
          carrier_tax_id: "77777777-7",
          vehicle_plate: "OMS001",
          origin_address: "Bodega Principal / Despacho 3PL",
          destination_address: order.destination_address || "Dirección según pedido OMS",
          departure_at: new Date().toISOString(),
          status: "draft",
          notes: `Generado desde pedido OMS [${(order.channel || "").toUpperCase()}] ID: ${order.external_order_id || order.id.slice(0, 8)}`,
        })
        .select("id, dispatch_number")
        .single();

      if (nErr) throw nErr;

      // Crear líneas
      const noteLines = lines.map((l: any) => {
        let itemId = l.item_id;
        if (!itemId && l.external_sku) {
          const found = items.find(
            (it) => it.code?.toLowerCase() === l.external_sku.toLowerCase() || it.name?.toLowerCase() === l.external_sku.toLowerCase()
          );
          if (found) itemId = found.id;
        }
        return {
          dispatch_note_id: note.id,
          item_id: itemId || items[0]?.id,
          qty: Number(l.qty) || 1,
          uom: "UN",
        };
      });

      const { error: nlErr } = await supabase.from("dispatch_note_lines").insert(noteLines);
      if (nlErr) throw nlErr;

      // Actualizar pedido a 'procesado'
      const { error: updErr } = await supabase
        .from("sales_orders")
        .update({
          status: "procesado",
          dispatch_note_id: note.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (updErr) throw updErr;

      return { noteId: note.id, noteNumber: note.dispatch_number };
    },
    onSuccess: () => {
      toast.success("¡Pedido convertido exitosamente a Guía de Despacho (Borrador) para picking!");
      qc.invalidateQueries({ queryKey: ["sales_orders"] });
      qc.invalidateQueries({ queryKey: ["dispatch_notes"] });
      if (selectedOrderForView) setSelectedOrderForView(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mutación: Generar Token de Integración
  const generateWebhookTokenM = useMutation({
    mutationFn: async (targetPartyId: string) => {
      if (!targetPartyId) throw new Error("Selecciona un cliente");
      const client = parties.find((p) => p.id === targetPartyId);
      const rawUuid = crypto.randomUUID().replace(/-/g, "");
      const token = `tok_3pl_${rawUuid}`;

      const { data, error } = await supabase
        .from("party_webhook_tokens")
        .insert({
          party_id: targetPartyId,
          token: token,
          name: `Webhook ${client?.name || "Cliente 3PL"}`,
          is_active: true,
        })
        .select("token")
        .single();

      if (error) throw error;
      return { token: data.token, clientName: client?.name || "Cliente" };
    },
    onSuccess: (data) => {
      toast.success("Token de integración generado con éxito");
      setGeneratedTokenData(data);
      setIsTokenModalOpen(true);
      qc.invalidateQueries({ queryKey: ["party_webhook_tokens"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mutación: Toggle Token Activo/Inactivo
  const toggleTokenActiveM = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("party_webhook_tokens")
        .update({ is_active: !is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estado del token actualizado");
      qc.invalidateQueries({ queryKey: ["party_webhook_tokens"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mutación: Cancelar Pedido
  const cancelOrderM = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("sales_orders")
        .update({ status: "cancelado", updated_at: new Date().toISOString() })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido cancelado");
      qc.invalidateQueries({ queryKey: ["sales_orders"] });
      if (selectedOrderForView) setSelectedOrderForView(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Portal Cliente 3PL: Consultar usuarios vinculados al cliente seleccionado
  const partyPortalUsersQ = useQuery({
    queryKey: ["party_portal_users", editPartyId],
    enabled: !!editPartyId && !!edit3pl,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_party_portal_users", {
        p_party_id: editPartyId,
      });
      if (error) throw error;
      return (data as Array<{ id: string; user_id: string; email: string; created_at: string }>) || [];
    },
  });

  // Mutación: Asignar usuario al portal cliente
  const assignPartyPortalUserM = useMutation({
    mutationFn: async (email: string) => {
      if (!editPartyId) throw new Error("No hay cliente seleccionado");
      if (!email || !email.includes("@")) throw new Error("Ingresa un correo electrónico válido");
      const { error } = await supabase.rpc("assign_party_portal_user", {
        p_party_id: editPartyId,
        p_email: email.trim().toLowerCase(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuario vinculado al portal cliente");
      setPortalUserEmail("");
      qc.invalidateQueries({ queryKey: ["party_portal_users", editPartyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mutación: Desvincular usuario del portal cliente
  const unlinkPartyPortalUserM = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from("party_portal_users")
        .delete()
        .eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Acceso al portal revocado");
      qc.invalidateQueries({ queryKey: ["party_portal_users", editPartyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Sprint 25: Contratos y Tarifarios 3PL
  const [newRateType, setNewRateType] = useState<ServiceRateType>("storage_pallet");
  const [newRatePrice, setNewRatePrice] = useState("");
  const [newRateDesc, setNewRateDesc] = useState("");

  const contractQ = useQuery({
    queryKey: ["service_contract", editPartyId, activeEntityId],
    enabled: !!editPartyId && !!edit3pl && !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_contracts")
        .select(`
          id,
          entity_id,
          party_id,
          billing_frequency,
          active,
          notes,
          created_at,
          service_rate_lines(id, contract_id, rate_type, unit_price, description, created_at)
        `)
        .eq("entity_id", activeEntityId!)
        .eq("party_id", editPartyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const upsertContractM = useMutation({
    mutationFn: async (payload: { billing_frequency: BillingFrequency; active: boolean; notes?: string }) => {
      if (!activeEntityId || !editPartyId) throw new Error("Faltan datos de empresa o cliente");
      if (contractQ.data?.id) {
        const { error } = await supabase
          .from("service_contracts")
          .update({
            billing_frequency: payload.billing_frequency,
            active: payload.active,
            notes: payload.notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", contractQ.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("service_contracts")
          .insert({
            entity_id: activeEntityId,
            party_id: editPartyId,
            billing_frequency: payload.billing_frequency,
            active: payload.active,
            notes: payload.notes || null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Contrato de servicios actualizado");
      qc.invalidateQueries({ queryKey: ["service_contract", editPartyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addRateLineM = useMutation({
    mutationFn: async () => {
      if (!contractQ.data?.id) throw new Error("Primero debes activar el contrato");
      const priceNum = Number(newRatePrice);
      if (isNaN(priceNum) || priceNum <= 0) throw new Error("Ingresa un precio unitario mayor a cero");
      const { error } = await supabase
        .from("service_rate_lines")
        .insert({
          contract_id: contractQ.data.id,
          rate_type: newRateType,
          unit_price: priceNum,
          description: newRateDesc.trim() || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Línea de tarifa agregada");
      setNewRatePrice("");
      setNewRateDesc("");
      qc.invalidateQueries({ queryKey: ["service_contract", editPartyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteRateLineM = useMutation({
    mutationFn: async (rateLineId: string) => {
      const { error } = await supabase
        .from("service_rate_lines")
        .delete()
        .eq("id", rateLineId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Línea de tarifa eliminada");
      qc.invalidateQueries({ queryKey: ["service_contract", editPartyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateGuideDistanceM = useMutation({
    mutationFn: async ({ id, distance_km }: { id: string; distance_km: number | null }) => {
      const { error } = await supabase
        .from("dispatch_notes")
        .update({ distance_km, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success("Distancia recorrida actualizada");
      qc.invalidateQueries({ queryKey: ["dispatch_notes"] });
      void vars;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Sprint 26: Facturación de Servicios 3PL
  const generateInvoiceServerFn = useServerFn(generateServiceInvoiceFn);

  const [billingPeriodStart, setBillingPeriodStart] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
  });
  const [billingPeriodEnd, setBillingPeriodEnd] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [selectedInvoiceForAdjustment, setSelectedInvoiceForAdjustment] = useState<any | null>(null);
  const [selectedInvoiceForDetails, setSelectedInvoiceForDetails] = useState<any | null>(null);
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(0);
  const [adjustmentType, setAdjustmentType] = useState<"credit" | "debit">("credit");
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [singleGeneratingPartyId, setSingleGeneratingPartyId] = useState<string | null>(null);

  const allServiceContractsQ = useQuery({
    queryKey: ["all_service_contracts", activeEntityId],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_contracts")
        .select(`
          id,
          entity_id,
          party_id,
          billing_frequency,
          active,
          notes,
          created_at,
          parties:party_id (id, name, tax_id),
          service_rate_lines (id, contract_id, rate_type, unit_price, description)
        `)
        .eq("entity_id", activeEntityId!)
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const serviceInvoicesQ = useQuery({
    queryKey: ["service_invoices_3pl", activeEntityId],
    enabled: !!activeEntityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_invoices")
        .select(`
          id,
          entity_id,
          party_id,
          invoice_number,
          issue_date,
          due_date,
          currency_code,
          subtotal_amount,
          tax_amount,
          total_amount,
          memo,
          status,
          adjustment_of_invoice_id,
          created_at,
          parties:party_id (id, name, tax_id),
          sales_invoice_lines (id, description, qty, unit_price, tax_rate, line_total)
        `)
        .eq("entity_id", activeEntityId!)
        .or("memo.ilike.%Servicios 3PL%,adjustment_of_invoice_id.not.is.null")
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const generateSingleInvoiceM = useMutation({
    mutationFn: async (partyId: string) => {
      if (!activeEntityId) throw new Error("Entidad activa no seleccionada");
      setSingleGeneratingPartyId(partyId);
      return await generateInvoiceServerFn({
        data: {
          entity_id: activeEntityId,
          party_id: partyId,
          period_start: billingPeriodStart,
          period_end: billingPeriodEnd,
        },
      });
    },
    onSuccess: (res) => {
      setSingleGeneratingPartyId(null);
      toast.success(`Factura 3PL borrador generada para ${res.party_name} por $${res.total.toLocaleString("es-CL")}`);
      qc.invalidateQueries({ queryKey: ["service_invoices_3pl", activeEntityId] });
    },
    onError: (err: any) => {
      setSingleGeneratingPartyId(null);
      toast.error(err.message || "Error al liquidar servicio 3PL");
    },
  });

  const handleBatchGenerateInvoices = async () => {
    const contracts = allServiceContractsQ.data || [];
    if (contracts.length === 0) {
      toast.info("No hay contratos activos para facturar");
      return;
    }
    setIsGeneratingBatch(true);
    let successCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const c of contracts) {
      try {
        await generateInvoiceServerFn({
          data: {
            entity_id: activeEntityId!,
            party_id: c.party_id,
            period_start: billingPeriodStart,
            period_end: billingPeriodEnd,
          },
        });
        successCount++;
      } catch (e: any) {
        if (e.message?.includes("Ya existe una factura") || e.message?.includes("No se registró consumo")) {
          skippedCount++;
        } else {
          errors.push(`${(c.parties as any)?.name || c.party_id}: ${e.message}`);
        }
      }
    }

    setIsGeneratingBatch(false);
    qc.invalidateQueries({ queryKey: ["service_invoices_3pl", activeEntityId] });

    if (successCount > 0) {
      toast.success(`Facturación masiva completada: ${successCount} factura(s) borrador generada(s).`);
    }
    if (skippedCount > 0) {
      toast.info(`${skippedCount} cliente(s) omitido(s) (ya facturados o sin consumos en el período).`);
    }
    if (errors.length > 0) {
      toast.error(`Errores (${errors.length}): ${errors[0]}`);
    }
  };

  const createAdjustmentInvoiceM = useMutation({
    mutationFn: async () => {
      if (!activeEntityId || !selectedInvoiceForAdjustment) throw new Error("Faltan datos de la factura original");
      if (!adjustmentAmount || adjustmentAmount <= 0) throw new Error("El monto del ajuste debe ser mayor a 0");
      if (!adjustmentReason.trim()) throw new Error("Debe indicar el motivo del ajuste");

      const isCredit = adjustmentType === "credit";
      const subtotal = Number(adjustmentAmount);
      const tax = Math.round(subtotal * 0.19);
      const total = subtotal + tax;

      const todayStr = new Date().toISOString().split("T")[0];
      const prefix = isCredit ? "NC-AJUSTE" : "ND-AJUSTE";
      const folio = `${prefix}-${Date.now().toString().slice(-6)}`;

      const memoText = `Nota de Ajuste (${isCredit ? "Crédito / Descuento" : "Débito / Recargo"}) a Factura #${selectedInvoiceForAdjustment.invoice_number || selectedInvoiceForAdjustment.id.slice(0, 8)}: ${adjustmentReason.trim()}`;

      const { data: inv, error: invErr } = await supabase
        .from("sales_invoices")
        .insert({
          entity_id: activeEntityId,
          party_id: selectedInvoiceForAdjustment.party_id,
          invoice_number: folio,
          issue_date: todayStr!,
          status: "draft",
          currency_code: selectedInvoiceForAdjustment.currency_code || "CLP",
          exchange_rate: 1.0,
          subtotal_amount: subtotal,
          tax_amount: tax,
          total_amount: total,
          memo: memoText,
          adjustment_of_invoice_id: selectedInvoiceForAdjustment.id,
        })
        .select()
        .single();

      if (invErr) throw invErr;

      const { error: lineErr } = await supabase
        .from("sales_invoice_lines" as any)
        .insert({
          sales_invoice_id: inv.id,
          description: `Ajuste 3PL (${isCredit ? "Descuento / Crédito" : "Cargo Adicional / Débito"}): ${adjustmentReason.trim()}`,
          qty: 1,
          unit_price: subtotal,
          tax_rate: 19,
          line_total: subtotal,
        });

      if (lineErr) throw lineErr;

      return inv;
    },
    onSuccess: () => {
      toast.success("Nota de ajuste creada exitosamente en borrador");
      setSelectedInvoiceForAdjustment(null);
      setAdjustmentReason("");
      setAdjustmentAmount(0);
      qc.invalidateQueries({ queryKey: ["service_invoices_3pl", activeEntityId] });
    },
    onError: (err: any) => toast.error(err.message || "Error al crear nota de ajuste"),
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard"><ArrowLeft className="h-4 w-4 mr-1" />Volver</Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Truck className="h-6 w-6" />Operaciones 3PL, WMS & TMS</h1>
            <p className="text-sm text-muted-foreground">Guías de despacho (Res. 154 SII), OMS pedidos multicanal, WMS picking/packing, TMS rutas y flota propia, trazabilidad y Comercio Exterior (SICEX).</p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild className="gap-1.5 self-start sm:self-auto text-xs font-medium">
          <Link to="/dashboard-3pl">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            Dashboard BI 3PL
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="notes">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 h-auto gap-1">
          <TabsTrigger value="notes"><Truck className="h-4 w-4 mr-1" />Guías</TabsTrigger>
          <TabsTrigger value="new"><Plus className="h-4 w-4 mr-1" />Nueva guía</TabsTrigger>
          <TabsTrigger value="orders"><Package className="h-4 w-4 mr-1" />Pedidos OMS</TabsTrigger>
          <TabsTrigger value="routes"><Navigation className="h-4 w-4 mr-1" />Rutas TMS</TabsTrigger>
          <TabsTrigger value="fleet"><Car className="h-4 w-4 mr-1" />Flota Propia</TabsTrigger>
          <TabsTrigger value="reception"><ArrowDownToLine className="h-4 w-4 mr-1" />Recepción WMS</TabsTrigger>
          <TabsTrigger value="traceability"><Layers className="h-4 w-4 mr-1" />Trazabilidad</TabsTrigger>
          <TabsTrigger value="clients"><Users className="h-4 w-4 mr-1" />Clientes 3PL</TabsTrigger>
          <TabsTrigger value="billing"><Receipt className="h-4 w-4 mr-1" />Facturación 3PL</TabsTrigger>
          <TabsTrigger value="foreign_trade"><Globe className="h-4 w-4 mr-1" />Comex (SICEX)</TabsTrigger>
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
                            {n.courier_name && (
                              <div className="mt-1">
                                <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 gap-1 font-mono">
                                  <Truck className="h-2.5 w-2.5" />
                                  {n.courier_name} {n.courier_tracking_number ? `· ${n.courier_tracking_number}` : ""}
                                </Badge>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div>{new Date(n.departure_at).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}</div>
                            {n.distance_km != null && (
                              <div className="text-[10px] font-mono text-muted-foreground">{n.distance_km} km</div>
                            )}
                          </TableCell>
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
                <div className="space-y-1">
                  <Label>Distancia (km, opcional)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="ej. 45.0"
                    value={form.distance_km}
                    onChange={(e) => setF("distance_km", e.target.value)}
                  />
                </div>
                <div className="space-y-1 md:col-span-3 grid md:grid-cols-2 gap-4">
                  <div className="space-y-1"><Label>Dirección origen *</Label><Input value={form.origin_address} onChange={(e) => setF("origin_address", e.target.value)} /></div>
                  <div className="space-y-1"><Label>Dirección destino *</Label><Input value={form.destination_address} onChange={(e) => setF("destination_address", e.target.value)} /></div>
                </div>

                {/* Transporte vía Courier Externo (Sprint 22) */}
                <div className="space-y-2 md:col-span-3 rounded-lg border p-3.5 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-primary" />
                    <div>
                      <h4 className="text-xs font-semibold">Transporte vía Courier Externo (Opcional)</h4>
                      <p className="text-[11px] text-muted-foreground">Si el traslado se realiza mediante encomienda externa (Chilexpress, Blue Express, Starken, etc.), registra aquí su número de seguimiento.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    <div className="space-y-1">
                      <Label className="text-xs">Empresa Courier</Label>
                      <Input
                        placeholder="ej. Blue Express, Chilexpress, Starken"
                        className="h-8 text-xs"
                        value={form.courier_name}
                        onChange={(e) => setF("courier_name", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">N° Seguimiento / Tracking</Label>
                      <Input
                        placeholder="ej. BX-893120 o CHX-99210"
                        className="h-8 text-xs font-mono"
                        value={form.courier_tracking_number}
                        onChange={(e) => setF("courier_tracking_number", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Estado Inicial del Courier</Label>
                      <Input
                        placeholder="ej. En preparación, Recepcionado por courier"
                        className="h-8 text-xs"
                        value={form.courier_status}
                        onChange={(e) => setF("courier_status", e.target.value)}
                      />
                    </div>
                  </div>
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

        {/* ------------------------------------------------------------- */}
        {/* PESTAÑA OMS: PEDIDOS MULTICANAL (Sprint 23)                   */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="orders" className="space-y-6">
          {/* Header & Acciones */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                OMS — Pedidos Multicanal de Clientes 3PL
              </h2>
              <p className="text-xs text-muted-foreground">
                Recepción centralizada de pedidos desde canales de venta (Shopify, VTEX, Mercado Libre, API webhook, manual o CSV) y conversión a guías de despacho listas para picking.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => setIsCsvImportOpen(true)}
              >
                <Upload className="h-3.5 w-3.5" />
                Importar CSV
              </Button>
              <Button
                size="sm"
                className="gap-1 text-xs"
                onClick={() => setIsNewOrderOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Nuevo Pedido Manual
              </Button>
            </div>
          </div>

          {/* Banner explicativo del receptor de Webhooks */}
          <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 text-xs text-purple-700 dark:text-purple-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-purple-600 dark:text-purple-400" />
            <div className="space-y-1">
              <span className="font-semibold">Integración de E-Commerce (Webhooks):</span> Los pedidos pueden recibirse automáticamente desde cualquier tienda online enviando un POST a <code className="bg-purple-500/20 px-1 py-0.5 rounded font-mono text-[11px]">/api/webhooks/oms</code> con el token de cliente. Genera los tokens en la pestaña <strong>Clientes 3PL</strong>. La restricción anti-duplicados previene órdenes repetidas por reintentos de red.
            </div>
          </div>

          {/* Tarjetas de Resumen Métrico */}
          {(() => {
            const allOrders = ordersQ.data ?? [];
            const pendientes = allOrders.filter((o: any) => o.status === "pendiente").length;
            const procesados = allOrders.filter((o: any) => o.status === "procesado").length;
            const cancelados = allOrders.filter((o: any) => o.status === "cancelado").length;
            const channels = Array.from(new Set(allOrders.map((o: any) => o.channel))).length;

            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="p-4 border-l-4 border-l-primary">
                  <div className="text-xs text-muted-foreground font-medium">Total Pedidos OMS</div>
                  <div className="text-2xl font-bold mt-1">{allOrders.length}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{channels} canal(es) activo(s)</div>
                </Card>
                <Card className="p-4 border-l-4 border-l-amber-500">
                  <div className="text-xs text-amber-700 dark:text-amber-300 font-medium">Pendientes (Para Picking)</div>
                  <div className="text-2xl font-bold mt-1 text-amber-600">{pendientes}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Listos para convertir a guía</div>
                </Card>
                <Card className="p-4 border-l-4 border-l-emerald-500">
                  <div className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">Procesados</div>
                  <div className="text-2xl font-bold mt-1 text-emerald-600">{procesados}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Con guía de despacho generada</div>
                </Card>
                <Card className="p-4 border-l-4 border-l-slate-400">
                  <div className="text-xs text-muted-foreground font-medium">Cancelados</div>
                  <div className="text-2xl font-bold mt-1">{cancelados}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Descartados o anulados</div>
                </Card>
              </div>
            );
          })()}

          {/* Filtros de Búsqueda */}
          <Card>
            <CardContent className="p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por ID, cliente, dirección..."
                    value={omsSearch}
                    onChange={(e) => setOmsSearch(e.target.value)}
                    className="h-8 pl-8 text-xs bg-background"
                  />
                </div>
                <Select value={omsStatusFilter} onValueChange={setOmsStatusFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Estado de Pedido" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="pendiente">Solo Pendientes</SelectItem>
                    <SelectItem value="procesado">Solo Procesados</SelectItem>
                    <SelectItem value="cancelado">Solo Cancelados</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={omsChannelFilter} onValueChange={setOmsChannelFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Canal de Venta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los canales</SelectItem>
                    <SelectItem value="shopify">Shopify</SelectItem>
                    <SelectItem value="vtex">VTEX</SelectItem>
                    <SelectItem value="mercadolibre">Mercado Libre</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="webhook">Webhook genérico</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={omsClientFilter} onValueChange={setOmsClientFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Filtrar por Cliente 3PL" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los clientes</SelectItem>
                    {parties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} {p.is_3pl_client ? "· 3PL" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Tabla de Pedidos OMS */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Bandeja de Pedidos Multicanal</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(() => {
                const allOrders = ordersQ.data ?? [];
                const filtered = allOrders.filter((o: any) => {
                  if (omsStatusFilter !== "all" && o.status !== omsStatusFilter) return false;
                  if (omsChannelFilter !== "all" && o.channel?.toLowerCase() !== omsChannelFilter.toLowerCase()) return false;
                  if (omsClientFilter !== "all" && o.party_id !== omsClientFilter) return false;
                  if (omsSearch.trim()) {
                    const q = omsSearch.toLowerCase();
                    const matchExtId = o.external_order_id?.toLowerCase().includes(q);
                    const matchClient = o.parties?.name?.toLowerCase().includes(q);
                    const matchAddress = o.destination_address?.toLowerCase().includes(q);
                    const matchNotes = o.notes?.toLowerCase().includes(q);
                    if (!matchExtId && !matchClient && !matchAddress && !matchNotes) return false;
                  }
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
                      <Package className="h-8 w-8 mx-auto text-muted-foreground/50" />
                      <p>No se encontraron pedidos multicanal con los filtros seleccionados.</p>
                      <Button variant="outline" size="sm" onClick={() => setIsNewOrderOpen(true)} className="text-xs">
                        Crear primer pedido manual
                      </Button>
                    </div>
                  );
                }

                return (
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead>Canal</TableHead>
                        <TableHead>N° Pedido Ext.</TableHead>
                        <TableHead>Cliente 3PL</TableHead>
                        <TableHead>Dirección de Destino</TableHead>
                        <TableHead>Líneas / Unidades</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Guía Despacho</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((order: any) => {
                        const lines = order.sales_order_lines || [];
                        const totalUnits = lines.reduce((acc: number, l: any) => acc + (Number(l.qty) || 0), 0);
                        const statusBadge = ORDER_STATUS_BADGES[order.status as OrderStatus] || ORDER_STATUS_BADGES.pendiente;

                        // Estilo distintivo por canal
                        const channelBadgeStyle = (() => {
                          const ch = (order.channel || "").toLowerCase();
                          if (ch.includes("shopify")) return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
                          if (ch.includes("vtex")) return "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/30";
                          if (ch.includes("mercado") || ch.includes("meli")) return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30";
                          if (ch.includes("csv")) return "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30";
                          return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30";
                        })();

                        return (
                          <TableRow key={order.id} className="text-xs">
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] font-medium capitalize ${channelBadgeStyle}`}>
                                {order.channel || "manual"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono font-medium">
                              {order.external_order_id || order.id.slice(0, 8)}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{order.parties?.name || "—"}</div>
                              {order.parties?.tax_id && (
                                <div className="text-[10px] text-muted-foreground">{order.parties.tax_id}</div>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate" title={order.destination_address || ""}>
                              {order.destination_address || <span className="text-muted-foreground italic">Sin dirección</span>}
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold">{lines.length}</span> ítems ({totalUnits} un.)
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] ${statusBadge.className}`}>
                                {statusBadge.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {order.dispatch_note_id ? (
                                <Badge variant="secondary" className="text-[10px] gap-1 font-mono">
                                  <FileText className="h-3 w-3" />
                                  {order.dispatch_notes?.dispatch_number || `GD-${order.dispatch_note_id.slice(0, 6)}`}
                                </Badge>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                              {new Date(order.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {order.status === "pendiente" && (
                                  <Button
                                    size="sm"
                                    className="h-7 px-2 text-[11px] gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
                                    onClick={() => convertOrderToDispatchNoteM.mutate(order)}
                                    disabled={convertOrderToDispatchNoteM.isPending}
                                    title="Convertir a Guía de Despacho para Picking"
                                  >
                                    <Truck className="h-3 w-3" />
                                    Convertir a Guía
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setSelectedOrderForView(order)}
                                  title="Ver detalle de pedido"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                {order.status === "pendiente" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                                    onClick={() => cancelOrderM.mutate(order.id)}
                                    disabled={cancelOrderM.isPending}
                                    title="Cancelar pedido"
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
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
        {/* PESTAÑA 3: RUTAS DE REPARTO TMS (Sprint 21)                   */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="routes" className="space-y-6">
          {/* Header & Acciones */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Navigation className="h-5 w-5 text-primary" />
                Planificación de Rutas de Reparto (TMS)
              </h2>
              <p className="text-xs text-muted-foreground">
                Agrupa guías de despacho en rutas de entrega ordenadas, asigna conductor y vehículo de flota propia o externa.
              </p>
            </div>
            <Button size="sm" onClick={openCreateRouteModal} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Nueva Ruta
            </Button>
          </div>

          {/* Tarjetas KPI */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 space-y-1">
                <div className="text-xs text-muted-foreground">Total Rutas</div>
                <div className="text-2xl font-bold font-mono">{(routesQ.data ?? []).length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-1">
                <div className="text-xs text-muted-foreground">Planificadas</div>
                <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
                  {(routesQ.data ?? []).filter((r: any) => r.status === "planificada").length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-1">
                <div className="text-xs text-muted-foreground">En Curso (En Calle)</div>
                <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
                  {(routesQ.data ?? []).filter((r: any) => r.status === "en_curso").length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-1">
                <div className="text-xs text-muted-foreground">Finalizadas</div>
                <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {(routesQ.data ?? []).filter((r: any) => r.status === "finalizada").length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabla de Rutas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Rutas Programadas</CardTitle>
              <CardDescription>
                Lista de rutas planificadas, en curso y despachadas con sus paradas y asignación de transporte.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(routesQ.data ?? []).length === 0 ? (
                <div className="py-12 text-center text-muted-foreground border rounded-lg border-dashed p-8 space-y-3">
                  <Navigation className="h-8 w-8 mx-auto text-muted-foreground/60" />
                  <p className="text-sm font-medium">Aún no hay rutas de reparto creadas.</p>
                  <p className="text-xs">
                    Crea tu primera ruta para agrupar guías de despacho existentes y ordenar las paradas de entrega.
                  </p>
                  <Button size="sm" variant="outline" onClick={openCreateRouteModal}>
                    <Plus className="h-4 w-4 mr-1" />
                    Crear primera ruta
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Identificador / Nombre</TableHead>
                        <TableHead>Vehículo Asignado</TableHead>
                        <TableHead>Conductor</TableHead>
                        <TableHead className="text-center">Paradas (Guías)</TableHead>
                        <TableHead>Carga Total</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(routesQ.data ?? []).map((r: any) => {
                        const stops: any[] = r.route_stops || [];
                        let routeKg = 0;
                        let routeM3 = 0;
                        for (const s of stops) {
                          const w = calcGuideWeightAndVol(s.dispatch_notes);
                          routeKg += w.kg;
                          routeM3 += w.m3;
                        }
                        const badgeInfo = ROUTE_STATUS_BADGES[r.status as RouteStatus] || { label: r.status, className: "" };

                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-mono text-xs">
                              {r.route_date}
                            </TableCell>
                            <TableCell className="text-xs font-semibold">
                              {r.name || `Ruta #${r.id.slice(0, 8)}`}
                            </TableCell>
                            <TableCell className="text-xs">
                              {r.vehicles ? (
                                <div className="space-y-0.5">
                                  <Badge variant="secondary" className="font-mono text-[11px] gap-1">
                                    <Car className="h-3 w-3" />
                                    {r.vehicles.plate}
                                  </Badge>
                                  <div className="text-[10px] text-muted-foreground">{r.vehicles.vehicle_type}</div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground italic text-[11px]">Tercero / No asignado</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              {r.driver_name || <span className="text-muted-foreground italic">—</span>}
                            </TableCell>
                            <TableCell className="text-center font-mono font-bold text-xs">
                              <Badge variant="outline" className="text-xs">
                                {stops.length} {stops.length === 1 ? "parada" : "paradas"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="font-mono font-medium">
                                {routeKg > 0 ? `${routeKg.toLocaleString("es-CL")} kg` : "—"}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono">
                                {routeM3 > 0 ? `${routeM3.toLocaleString("es-CL")} m³` : ""}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={r.status}
                                onValueChange={(val: RouteStatus) =>
                                  updateRouteStatusM.mutate({ routeId: r.id, status: val })
                                }
                              >
                                <SelectTrigger className="h-7 text-xs w-[125px]">
                                  <SelectValue>
                                    <span className={badgeInfo.className.includes("emerald") ? "text-emerald-700 dark:text-emerald-300 font-medium" : badgeInfo.className.includes("amber") ? "text-amber-700 dark:text-amber-300 font-medium" : "font-medium"}>
                                      {ROUTE_STATUS_LABELS[r.status as RouteStatus]}
                                    </span>
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="planificada">Planificada</SelectItem>
                                  <SelectItem value="en_curso">En curso</SelectItem>
                                  <SelectItem value="finalizada">Finalizada</SelectItem>
                                  <SelectItem value="cancelada">Cancelada</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => setSelectedRouteForView(r)}
                                >
                                  <Eye className="h-3 w-3" />
                                  Paradas
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs"
                                  onClick={() => openEditRouteModal(r)}
                                >
                                  <Edit className="h-3 w-3" />
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
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* PESTAÑA 4: FLOTA PROPIA DE VEHÍCULOS (Sprint 21)              */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="fleet" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Car className="h-5 w-5 text-primary" />
                Flota Propia de Transporte
              </h2>
              <p className="text-xs text-muted-foreground">
                Registro de camiones y vehículos propios de la empresa, especificación de capacidades y control de disponibilidad.
              </p>
            </div>
            <Button size="sm" onClick={openCreateVehicleModal} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Nuevo Vehículo
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Vehículos Registrados ({vehiclesQ.data?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {(vehiclesQ.data ?? []).length === 0 ? (
                <div className="py-12 text-center text-muted-foreground border rounded-lg border-dashed p-8 space-y-3">
                  <Car className="h-8 w-8 mx-auto text-muted-foreground/60" />
                  <p className="text-sm font-medium">No hay vehículos registrados en la flota propia.</p>
                  <p className="text-xs">
                    Si tu empresa cuenta con camiones o furgones propios, regístralos aquí para controlar sus capacidades de peso y volumen.
                  </p>
                  <Button size="sm" variant="outline" onClick={openCreateVehicleModal}>
                    <Plus className="h-4 w-4 mr-1" />
                    Registrar vehículo
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patente</TableHead>
                        <TableHead>Tipo de Carrocería</TableHead>
                        <TableHead>Capacidad de Peso</TableHead>
                        <TableHead>Capacidad Volumétrica</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vehiclesQ.data?.map((v: any) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                            {v.plate}
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {v.vehicle_type || "General"}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {v.capacity_kg ? `${Number(v.capacity_kg).toLocaleString("es-CL")} kg` : <span className="text-muted-foreground italic">—</span>}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {v.capacity_m3 ? `${Number(v.capacity_m3).toLocaleString("es-CL")} m³` : <span className="text-muted-foreground italic">—</span>}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                v.active
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]"
                                  : "bg-slate-500/10 text-slate-700 dark:text-slate-300 text-[10px]"
                              }
                            >
                              {v.active ? "Activo" : "Inactivo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={() => openEditVehicleModal(v)}
                              >
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px]"
                                onClick={() => toggleVehicleActiveM.mutate({ id: v.id, active: !v.active })}
                              >
                                {v.active ? "Desactivar" : "Activar"}
                              </Button>
                            </div>
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

                    {edit3pl && (
                    <div className="space-y-4">
                      {/* Webhooks OMS */}
                      <div className="space-y-3 rounded-md border p-3 bg-muted/20">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <Label className="text-xs font-semibold flex items-center gap-1.5">
                              <Key className="h-3.5 w-3.5 text-primary" />
                              Integración Webhook OMS (E-Commerce)
                            </Label>
                            <p className="text-[11px] text-muted-foreground">
                              Tokens para recibir pedidos automáticos desde Shopify, VTEX o Mercado Libre.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 text-xs shrink-0"
                            onClick={() => generateWebhookTokenM.mutate(editPartyId)}
                            disabled={generateWebhookTokenM.isPending}
                          >
                            <Key className="h-3.5 w-3.5" />
                            Generar token de integración
                          </Button>
                        </div>

                        {(() => {
                          const partyTokens = (webhookTokensQ.data || []).filter((t: any) => t.party_id === editPartyId);
                          if (!partyTokens.length) {
                            return (
                              <p className="text-[11px] text-muted-foreground italic py-1">
                                Este cliente aún no posee tokens de integración generados.
                              </p>
                            );
                          }
                          return (
                            <div className="space-y-2 pt-1">
                              {partyTokens.map((t: any) => (
                                <div key={t.id} className="flex items-center justify-between text-xs p-2.5 rounded bg-background border">
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-xs font-medium text-primary">
                                        {t.token.slice(0, 14)}••••••••{t.token.slice(-4)}
                                      </span>
                                      <Badge variant={t.is_active ? "outline" : "secondary"} className="text-[10px]">
                                        {t.is_active ? "Activo" : "Inactivo"}
                                      </Badge>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">
                                      {t.name || "Webhook"} · Creado el {new Date(t.created_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-xs gap-1"
                                      onClick={() => {
                                        navigator.clipboard.writeText(t.token);
                                        toast.success("Token copiado al portapapeles");
                                      }}
                                    >
                                      <Copy className="h-3 w-3" />
                                      Copiar
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => toggleTokenActiveM.mutate({ id: t.id, is_active: t.is_active })}
                                      disabled={toggleTokenActiveM.isPending}
                                    >
                                      {t.is_active ? "Desactivar" : "Reactivar"}
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Usuarios con Acceso al Portal Cliente (Sprint 24) */}
                      <div className="space-y-3 rounded-md border p-3 bg-muted/20">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <Label className="text-xs font-semibold flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 text-primary" />
                              Acceso al Portal Cliente (3PL)
                            </Label>
                            <p className="text-[11px] text-muted-foreground">
                              Vincula cuentas de usuario registradas en el sistema para que consulten su inventario en custodia y guías desde <code className="text-primary font-mono font-medium">/portal</code>.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Input
                            type="email"
                            placeholder="correo@cliente.cl (debe estar registrado)"
                            value={portalUserEmail}
                            onChange={(e) => setPortalUserEmail(e.target.value)}
                            className="h-8 text-xs flex-1"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                if (portalUserEmail) assignPartyPortalUserM.mutate(portalUserEmail);
                              }
                            }}
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 text-xs gap-1 shrink-0"
                            disabled={!portalUserEmail || assignPartyPortalUserM.isPending}
                            onClick={() => assignPartyPortalUserM.mutate(portalUserEmail)}
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            {assignPartyPortalUserM.isPending ? "Vinculando..." : "Vincular Usuario"}
                          </Button>
                        </div>

                        {partyPortalUsersQ.isLoading ? (
                          <p className="text-[11px] text-muted-foreground">Cargando accesos al portal...</p>
                        ) : (partyPortalUsersQ.data || []).length === 0 ? (
                          <p className="text-[11px] text-muted-foreground italic py-1">
                            Este cliente aún no tiene usuarios vinculados. Vincula su correo para habilitar su acceso a <code className="text-foreground font-mono">/portal</code>.
                          </p>
                        ) : (
                          <div className="space-y-2 pt-1">
                            {(partyPortalUsersQ.data || []).map((u) => (
                              <div key={u.id} className="flex items-center justify-between text-xs p-2.5 rounded bg-background border">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-xs text-foreground">{u.email}</span>
                                    <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                                      Acceso Activo
                                    </Badge>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground">
                                    ID Auth: <span className="font-mono">{u.user_id.slice(0, 8)}...</span> · Vinculado el {new Date(u.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                                  disabled={unlinkPartyPortalUserM.isPending}
                                  onClick={() => unlinkPartyPortalUserM.mutate(u.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Desvincular
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Contrato de Servicios y Tarifario 3PL (Sprint 25) */}
                      <div className="space-y-3 rounded-md border p-3.5 bg-muted/20">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <Label className="text-xs font-semibold flex items-center gap-1.5">
                              <Receipt className="h-3.5 w-3.5 text-primary" />
                              Contrato de Servicios y Tarifario 3PL
                            </Label>
                            <p className="text-[11px] text-muted-foreground">
                              Define la frecuencia de facturación y las tarifas pactadas para almacenaje, picking y transporte.
                            </p>
                          </div>
                          {contractQ.data && (
                            <Badge variant={contractQ.data.active ? "default" : "secondary"} className={contractQ.data.active ? "bg-emerald-600 text-white" : ""}>
                              {contractQ.data.active ? "Contrato Activo" : "Inactivo"}
                            </Badge>
                          )}
                        </div>

                        {contractQ.isLoading ? (
                          <p className="text-[11px] text-muted-foreground">Cargando contrato...</p>
                        ) : !contractQ.data ? (
                          <div className="rounded border border-dashed p-3 text-center space-y-2 bg-background/50">
                            <p className="text-xs text-muted-foreground">Este cliente aún no tiene un contrato de servicios 3PL registrado.</p>
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 text-xs gap-1.5"
                              onClick={() => upsertContractM.mutate({ billing_frequency: "mensual", active: true })}
                              disabled={upsertContractM.isPending}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Crear Contrato de Servicios
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-3 pt-1">
                            {/* Configuración de Frecuencia y Estado */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2.5 rounded bg-background border text-xs">
                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">Frecuencia de Facturación</Label>
                                <Select
                                  value={contractQ.data.billing_frequency}
                                  onValueChange={(val: BillingFrequency) =>
                                    upsertContractM.mutate({
                                      billing_frequency: val,
                                      active: contractQ.data!.active,
                                      ...(contractQ.data!.notes ? { notes: contractQ.data!.notes as string } : {}),
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="mensual">Mensual</SelectItem>
                                    <SelectItem value="quincenal">Quincenal</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">Estado del Contrato</Label>
                                <div className="flex items-center gap-2 pt-1">
                                  <Button
                                    type="button"
                                    variant={contractQ.data.active ? "outline" : "default"}
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() =>
                                      upsertContractM.mutate({
                                        billing_frequency: contractQ.data!.billing_frequency,
                                        active: !contractQ.data!.active,
                                        ...(contractQ.data!.notes ? { notes: contractQ.data!.notes as string } : {}),
                                      })
                                    }
                                    disabled={upsertContractM.isPending}
                                  >
                                    {contractQ.data.active ? "Pausar Contrato" : "Reactivar Contrato"}
                                  </Button>
                                  <span className="text-[11px] text-muted-foreground">
                                    Creado el {new Date(contractQ.data.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Tabla de Tarifas Pactadas */}
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold">Tarifas Pactadas ({contractQ.data.service_rate_lines?.length || 0})</Label>

                              {(!contractQ.data.service_rate_lines || contractQ.data.service_rate_lines.length === 0) ? (
                                <p className="text-[11px] text-muted-foreground italic py-1">
                                  Aún no se han definido líneas tarifarias. Agrega las tarifas de almacenaje, picking o transporte a continuación.
                                </p>
                              ) : (
                                <div className="rounded border overflow-x-auto bg-background">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="text-[11px]">
                                        <TableHead className="py-2">Concepto / Tipo</TableHead>
                                        <TableHead className="py-2">Descripción</TableHead>
                                        <TableHead className="py-2 text-right">Precio Pactado</TableHead>
                                        <TableHead className="py-2 text-right w-12" />
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {contractQ.data.service_rate_lines.map((line: any) => {
                                        const meta = SERVICE_RATE_LABELS[line.rate_type as ServiceRateType] || { label: line.rate_type, unit: "$" };
                                        return (
                                          <TableRow key={line.id} className="text-xs">
                                            <TableCell className="py-2 font-medium">
                                              <Badge variant="outline" className="text-[10px] mr-1.5 font-normal">
                                                {meta.label}
                                              </Badge>
                                            </TableCell>
                                            <TableCell className="py-2 text-muted-foreground text-[11px]">
                                              {line.description || "—"}
                                            </TableCell>
                                            <TableCell className="py-2 text-right font-mono font-semibold">
                                              ${Number(line.unit_price).toLocaleString("es-CL", { minimumFractionDigits: 2 })}
                                              <span className="text-[10px] text-muted-foreground ml-1 font-sans">{meta.unit}</span>
                                            </TableCell>
                                            <TableCell className="py-2 text-right">
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                                                onClick={() => deleteRateLineM.mutate(line.id)}
                                                disabled={deleteRateLineM.isPending}
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}

                              {/* Formulario Agregar Línea de Tarifa */}
                              <div className="rounded border p-2.5 bg-background space-y-2">
                                <Label className="text-[11px] font-semibold text-muted-foreground">+ Agregar Nueva Tarifa</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Tipo de Tarifa</Label>
                                    <Select value={newRateType} onValueChange={(val: ServiceRateType) => setNewRateType(val)}>
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {(Object.keys(SERVICE_RATE_LABELS) as ServiceRateType[]).map((k) => (
                                          <SelectItem key={k} value={k} className="text-xs">
                                            {SERVICE_RATE_LABELS[k].label} ({SERVICE_RATE_LABELS[k].unit})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Precio Unitario ($)</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      placeholder="ej. 3500"
                                      value={newRatePrice}
                                      onChange={(e) => setNewRatePrice(e.target.value)}
                                      className="h-8 text-xs font-mono"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Glosa / Detalle (opcional)</Label>
                                    <div className="flex gap-1.5">
                                      <Input
                                        placeholder="ej. Tarifa mensual pallet seco"
                                        value={newRateDesc}
                                        onChange={(e) => setNewRateDesc(e.target.value)}
                                        className="h-8 text-xs flex-1"
                                      />
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="h-8 text-xs shrink-0"
                                        onClick={() => addRateLineM.mutate()}
                                        disabled={!newRatePrice || addRateLineM.isPending}
                                      >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Agregar
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <Button onClick={() => savePartyM.mutate()} disabled={savePartyM.isPending}>Guardar</Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* PESTAÑA: FACTURACIÓN DE SERVICIOS 3PL (SPRINT 26)             */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="billing" className="space-y-6">
          {/* Header y Control de Período */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border bg-card/60 backdrop-blur-sm shadow-sm">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Liquidación y Facturación de Servicios 3PL
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cálculo automatizado de consumos reales (almacenaje, picking y transporte) con emisión a facturas de venta SII.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs">
                <Label htmlFor="period_start" className="text-xs text-muted-foreground font-normal">Desde:</Label>
                <Input
                  id="period_start"
                  type="date"
                  value={billingPeriodStart}
                  onChange={(e) => setBillingPeriodStart(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <Label htmlFor="period_end" className="text-xs text-muted-foreground font-normal">Hasta:</Label>
                <Input
                  id="period_end"
                  type="date"
                  value={billingPeriodEnd}
                  onChange={(e) => setBillingPeriodEnd(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
              </div>
              <Button
                size="sm"
                onClick={handleBatchGenerateInvoices}
                disabled={isGeneratingBatch || !allServiceContractsQ.data?.length}
                className="gap-1.5 bg-primary text-primary-foreground h-8 text-xs font-medium shadow-sm hover:shadow"
              >
                <Zap className={`h-3.5 w-3.5 ${isGeneratingBatch ? "animate-spin text-amber-300" : "text-amber-400 fill-amber-400"}`} />
                {isGeneratingBatch ? "Liquidando..." : "Liquidar Período en Lote"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  qc.invalidateQueries({ queryKey: ["all_service_contracts", activeEntityId] });
                  qc.invalidateQueries({ queryKey: ["service_invoices_3pl", activeEntityId] });
                }}
                className="h-8 w-8 p-0"
                title="Actualizar datos"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Tarjetas KPI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border bg-card/50">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs">Contratos 3PL Vigentes</CardDescription>
                <CardTitle className="text-2xl font-bold flex items-center justify-between">
                  <span>{(allServiceContractsQ.data ?? []).length}</span>
                  <FileText className="h-5 w-5 text-muted-foreground/60" />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
                Clientes activos con tarifario configurado
              </CardContent>
            </Card>

            <Card className="border bg-card/50">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs">Documentos Emitidos (Total)</CardDescription>
                <CardTitle className="text-2xl font-bold flex items-center justify-between text-blue-600 dark:text-blue-400">
                  <span>{(serviceInvoicesQ.data ?? []).length}</span>
                  <Receipt className="h-5 w-5 text-blue-500/60" />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
                Facturas y notas de ajuste registradas
              </CardContent>
            </Card>

            <Card className="border bg-card/50">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs">Facturación Acumulada 3PL</CardDescription>
                <CardTitle className="text-2xl font-bold flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                  <span>
                    ${(serviceInvoicesQ.data ?? [])
                      .filter((i: any) => !i.adjustment_of_invoice_id)
                      .reduce((sum: number, i: any) => sum + (Number(i.total_amount) || 0), 0)
                      .toLocaleString("es-CL")}
                  </span>
                  <CheckCheck className="h-5 w-5 text-emerald-500/60" />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
                Monto bruto facturado en servicios logísticos
              </CardContent>
            </Card>

            <Card className="border bg-card/50">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs">Notas de Ajuste</CardDescription>
                <CardTitle className="text-2xl font-bold flex items-center justify-between text-amber-600 dark:text-amber-400">
                  <span>{(serviceInvoicesQ.data ?? []).filter((i: any) => i.adjustment_of_invoice_id).length}</span>
                  <Edit className="h-5 w-5 text-amber-500/60" />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
                Ajustes o notas de crédito/débito vinculadas
              </CardContent>
            </Card>
          </div>

          {/* Tabla 1: Estado de Liquidación por Cliente para el Período */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Clientes con Contrato 3PL y Estado en el Período [{billingPeriodStart} al {billingPeriodEnd}]
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Consulte el tarifario de cada cliente o ejecute la liquidación individual inmediata.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {allServiceContractsQ.isLoading ? (
                <p className="text-xs text-muted-foreground py-6 text-center">Cargando contratos 3PL...</p>
              ) : (allServiceContractsQ.data ?? []).length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <p className="text-sm font-medium">No hay clientes con contratos 3PL activos.</p>
                  <p className="text-xs text-muted-foreground">
                    Configure las tarifas en la pestaña <strong>"Clientes 3PL"</strong> habilitando la opción "Cliente 3PL".
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente / RUT</TableHead>
                      <TableHead>Frecuencia</TableHead>
                      <TableHead>Tarifas Configuradas</TableHead>
                      <TableHead>Estado Período</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(allServiceContractsQ.data ?? []).map((contract: any) => {
                      const party = contract.parties;
                      const periodKey = `[${billingPeriodStart} al ${billingPeriodEnd}]`;
                      const existingInv = (serviceInvoicesQ.data ?? []).find(
                        (inv: any) =>
                          inv.party_id === contract.party_id &&
                          inv.memo?.includes(periodKey) &&
                          inv.status !== "cancelled"
                      );
                      const isGeneratingThis = singleGeneratingPartyId === contract.party_id;

                      return (
                        <TableRow key={contract.id}>
                          <TableCell>
                            <div className="font-medium text-xs text-foreground">{party?.name || "Sin nombre"}</div>
                            {party?.tax_id && <div className="text-[11px] text-muted-foreground font-mono">{party.tax_id}</div>}
                          </TableCell>
                          <TableCell className="text-xs capitalize">
                            <Badge variant="outline" className="text-[11px] font-normal">
                              {BILLING_FREQUENCY_LABELS[contract.billing_frequency as BillingFrequency] || contract.billing_frequency}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-md">
                              {(contract.service_rate_lines || []).map((r: any) => (
                                <Badge key={r.id} variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
                                  {SERVICE_RATE_LABELS[r.rate_type as ServiceRateType]?.label || r.rate_type}: ${Number(r.unit_price).toLocaleString("es-CL")}
                                </Badge>
                              ))}
                              {(!contract.service_rate_lines || contract.service_rate_lines.length === 0) && (
                                <span className="text-[11px] text-amber-600 italic">Sin tarifas</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {existingInv ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 text-[11px]">
                                <CheckCircle2 className="h-3 w-3" />
                                Facturado ({existingInv.invoice_number ? `#${existingInv.invoice_number}` : "Borrador"})
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600 border-amber-500/30 bg-amber-500/10 text-[11px]">
                                Pendiente
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {existingInv ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => setSelectedInvoiceForDetails(existingInv)}
                              >
                                <Eye className="h-3 w-3" /> Ver Factura
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 text-xs gap-1"
                                onClick={() => generateSingleInvoiceM.mutate(contract.party_id)}
                                disabled={isGeneratingThis || generateSingleInvoiceM.isPending}
                              >
                                <Zap className={`h-3 w-3 text-amber-300 ${isGeneratingThis ? "animate-spin" : ""}`} />
                                {isGeneratingThis ? "Facturando..." : "Facturar Período"}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Tabla 2: Historial de Facturas de Servicio 3PL y Notas de Ajuste */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-primary" />
                    Historial de Facturas 3PL y Notas de Ajuste
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Registro de facturas en tabla unificada de ventas (EasyERP) con soporte para notas de ajuste y créditos.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {serviceInvoicesQ.isLoading ? (
                <p className="text-xs text-muted-foreground py-6 text-center">Cargando facturas de servicio...</p>
              ) : (serviceInvoicesQ.data ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">No se han emitido facturas de servicio 3PL aún.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Folio / Doc</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Fecha Emisión</TableHead>
                      <TableHead>Detalle / Glosa</TableHead>
                      <TableHead className="text-right">Neto</TableHead>
                      <TableHead className="text-right">IVA (19%)</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(serviceInvoicesQ.data ?? []).map((inv: any) => {
                      const isAdjustment = !!inv.adjustment_of_invoice_id;
                      const party = inv.parties;
                      return (
                        <TableRow key={inv.id} className={isAdjustment ? "bg-amber-500/[0.03]" : ""}>
                          <TableCell className="font-mono text-xs font-semibold">
                            {inv.invoice_number || `ID ${inv.id.slice(0, 8)}`}
                          </TableCell>
                          <TableCell>
                            {isAdjustment ? (
                              <Badge variant="outline" className="text-amber-600 border-amber-500/30 bg-amber-500/10 text-[10px]">
                                Nota de Ajuste
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">
                                Factura 3PL
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-xs">{party?.name || "—"}</div>
                            {party?.tax_id && <div className="text-[10px] text-muted-foreground font-mono">{party.tax_id}</div>}
                          </TableCell>
                          <TableCell className="text-xs">{inv.issue_date}</TableCell>
                          <TableCell className="text-xs max-w-xs truncate" title={inv.memo || ""}>
                            {inv.memo || "Servicios Logísticos 3PL"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            ${Number(inv.subtotal_amount || 0).toLocaleString("es-CL")}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            ${Number(inv.tax_amount || 0).toLocaleString("es-CL")}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                            ${Number(inv.total_amount || 0).toLocaleString("es-CL")}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                inv.status === "draft"
                                  ? "text-blue-600 border-blue-500/30 bg-blue-500/10 text-[10px]"
                                  : inv.status === "posted"
                                  ? "text-emerald-600 border-emerald-500/30 bg-emerald-500/10 text-[10px]"
                                  : "text-muted-foreground text-[10px]"
                              }
                            >
                              {inv.status === "draft" ? "Borrador" : inv.status === "posted" ? "Emitida" : inv.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs px-2"
                                onClick={() => setSelectedInvoiceForDetails(inv)}
                                title="Ver desglose y líneas"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              {!isAdjustment && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs px-2 gap-1 text-amber-600 hover:text-amber-700"
                                  onClick={() => {
                                    setSelectedInvoiceForAdjustment(inv);
                                    setAdjustmentAmount(0);
                                    setAdjustmentReason("");
                                    setAdjustmentType("credit");
                                  }}
                                  title="Emitir nota de crédito o ajuste"
                                >
                                  <Edit className="h-3 w-3" />
                                  Ajuste
                                </Button>
                              )}
                            </div>
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
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFtForm((f) => ({ ...f, notes: e.target.value }))}
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
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Distancia (km)</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="km"
                        defaultValue={selectedGuide.distance_km ?? ""}
                        id={`guide-dist-input-${selectedGuide.id}`}
                        className="h-7 w-20 text-xs font-mono"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2"
                        disabled={updateGuideDistanceM.isPending}
                        onClick={() => {
                          const input = document.getElementById(`guide-dist-input-${selectedGuide.id}`) as HTMLInputElement;
                          const val = input?.value ? Number(input.value) : null;
                          updateGuideDistanceM.mutate({ id: selectedGuide.id, distance_km: val });
                        }}
                      >
                        {updateGuideDistanceM.isPending ? "..." : "Guardar"}
                      </Button>
                    </div>
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
                    {confirmPickingM.isPending ? "Confirmando..." : "Confirmar Picking"}
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Modal Dialog: Crear/Editar Vehículo de Flota Propia (Sprint 21) */}
      <Dialog open={vehicleModalOpen} onOpenChange={setVehicleModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="h-5 w-5 text-primary" />
              {editingVehicleId ? "Editar Vehículo de Flota" : "Registrar Vehículo en Flota Propia"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Registra patentes y capacidades de carga de los vehículos propios de la empresa para control de cubicaje en rutas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs">Patente del Vehículo *</Label>
              <Input
                placeholder="ej. ABCD-12 o GHJK-99"
                className="font-mono uppercase tracking-wider text-sm font-semibold"
                value={vehicleForm.plate}
                onChange={(e) => setVehicleForm((f) => ({ ...f, plate: e.target.value.toUpperCase() }))}
              />
              <p className="text-[11px] text-muted-foreground">Formato estándar de patente chilena.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de Carrocería / Vehículo</Label>
              <Select
                value={vehicleForm.vehicle_type}
                onValueChange={(v) => setVehicleForm((f) => ({ ...f, vehicle_type: v }))}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Furgón">Furgón Utilitario</SelectItem>
                  <SelectItem value="Camioneta">Camioneta Pick-up</SelectItem>
                  <SelectItem value="Camión 3/4">Camión 3/4 (Ligero)</SelectItem>
                  <SelectItem value="Camión Mediano">Camión Mediano (2 ejes)</SelectItem>
                  <SelectItem value="Camión Rampla">Camión Pesado / Rampla / Articulado</SelectItem>
                  <SelectItem value="Camión Refrigerado">Camión Frigorífico / Refrigerado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                  Capacidad de Peso (kg)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="ej. 3500"
                  className="font-mono text-xs"
                  value={vehicleForm.capacity_kg}
                  onChange={(e) => setVehicleForm((f) => ({ ...f, capacity_kg: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Box className="h-3.5 w-3.5 text-muted-foreground" />
                  Capacidad Volumétrica (m³)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="ej. 18.5"
                  className="font-mono text-xs"
                  value={vehicleForm.capacity_m3}
                  onChange={(e) => setVehicleForm((f) => ({ ...f, capacity_m3: e.target.value }))}
                />
              </div>
            </div>

            <div className="pt-2 border-t">
              <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <Checkbox
                  checked={vehicleForm.active}
                  onCheckedChange={(c) => setVehicleForm((f) => ({ ...f, active: c === true }))}
                />
                <span className="font-medium">Vehículo activo y disponible para asignación en rutas</span>
              </label>
            </div>

            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVehicleModalOpen(false)}
                disabled={saveVehicleM.isPending}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => saveVehicleM.mutate()}
                disabled={saveVehicleM.isPending}
              >
                <Check className="h-3.5 w-3.5" />
                {saveVehicleM.isPending ? "Guardando..." : editingVehicleId ? "Actualizar Vehículo" : "Registrar en Flota"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Dialog: Planificar / Editar Ruta de Reparto TMS (Sprint 21) */}
      <Dialog open={routeModalOpen} onOpenChange={setRouteModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Navigation className="h-5 w-5 text-primary" />
              {editingRouteId ? "Editar Ruta de Reparto TMS" : "Planificar Nueva Ruta de Reparto TMS"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Asigna vehículo de flota propia, conductor y secuencia las paradas correspondientes a las guías de despacho.
            </DialogDescription>
          </DialogHeader>

          {(() => {
            const currentVehicle = (vehiclesQ.data ?? []).find((v: any) => v.id === routeForm.vehicle_id);
            let totalAssignedKg = 0;
            let totalAssignedM3 = 0;

            for (const stop of routeStops) {
              const guideData = stop.noteData || (notesQ.data ?? []).find((n: any) => n.id === stop.dispatch_note_id);
              const m = calcGuideWeightAndVol(guideData);
              totalAssignedKg += m.kg;
              totalAssignedM3 += m.m3;
            }

            const capKg = currentVehicle?.capacity_kg ? Number(currentVehicle.capacity_kg) : null;
            const capM3 = currentVehicle?.capacity_m3 ? Number(currentVehicle.capacity_m3) : null;
            const isWeightOverload = capKg ? totalAssignedKg > capKg : false;
            const isVolOverload = capM3 ? totalAssignedM3 > capM3 : false;

            // Guías disponibles para agregar (excluyendo las ya agregadas a esta ruta)
            const availableGuides = (notesQ.data ?? []).filter(
              (n: any) => !routeStops.some((s) => s.dispatch_note_id === n.id)
            );

            return (
              <div className="space-y-6 py-2">
                {/* Cabecera del Formulario de Ruta */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-lg bg-muted/40 border">
                  <div className="space-y-1">
                    <Label className="text-xs">Nombre o Identificador *</Label>
                    <Input
                      placeholder="ej. Ruta Santiago Oriente"
                      className="h-8 text-xs font-medium"
                      value={routeForm.name}
                      onChange={(e) => setRouteForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Fecha de Reparto *</Label>
                    <Input
                      type="date"
                      className="h-8 text-xs"
                      value={routeForm.route_date}
                      onChange={(e) => setRouteForm((f) => ({ ...f, route_date: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Vehículo (Flota Propia)</Label>
                    <Select
                      value={routeForm.vehicle_id}
                      onValueChange={(v) => setRouteForm((f) => ({ ...f, vehicle_id: v }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Sin vehículo asignado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">Sin vehículo / Tercerizado</SelectItem>
                        {(vehiclesQ.data ?? [])
                          .filter((v: any) => v.active || v.id === routeForm.vehicle_id)
                          .map((v: any) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.plate} ({v.vehicle_type || "General"})
                              {v.capacity_kg ? ` · ${Number(v.capacity_kg).toLocaleString("es-CL")} kg` : ""}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Nombre del Chofer / Conductor</Label>
                    <Input
                      placeholder="ej. Carlos Muñoz"
                      className="h-8 text-xs"
                      value={routeForm.driver_name}
                      onChange={(e) => setRouteForm((f) => ({ ...f, driver_name: e.target.value }))}
                    />
                  </div>

                  <div className="col-span-1 md:grid-cols-2 lg:col-span-4 space-y-1 pt-1">
                    <Label className="text-xs">Notas / Observaciones de la Hoja de Ruta</Label>
                    <Input
                      placeholder="Instrucciones al conductor, precauciones de carga o referencias de peajes/ruta..."
                      className="h-8 text-xs"
                      value={routeForm.notes}
                      onChange={(e) => setRouteForm((f) => ({ ...f, notes: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Medidores de Capacidad y Resumen */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg border bg-card flex flex-col justify-between">
                    <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                      <span>Total Paradas Programadas</span>
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="text-xl font-bold font-mono text-primary mt-1">
                      {routeStops.length} <span className="text-xs font-normal text-muted-foreground">guías</span>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg border flex flex-col justify-between ${isWeightOverload ? "bg-red-500/10 border-red-500/40" : "bg-card"}`}>
                    <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                      <span className={isWeightOverload ? "text-red-700 dark:text-red-300 font-semibold" : ""}>
                        Carga Total de Peso
                      </span>
                      <Gauge className={`h-3.5 w-3.5 ${isWeightOverload ? "text-red-600" : "text-muted-foreground"}`} />
                    </div>
                    <div className="mt-1">
                      <div className="flex items-baseline justify-between">
                        <span className={`text-xl font-bold font-mono ${isWeightOverload ? "text-red-600" : ""}`}>
                          {totalAssignedKg.toLocaleString("es-CL")} kg
                        </span>
                        {capKg && (
                          <span className="text-[11px] font-mono text-muted-foreground">
                            / {capKg.toLocaleString("es-CL")} kg max
                          </span>
                        )}
                      </div>
                      {capKg && (
                        <div className="mt-1.5 w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full transition-all ${isWeightOverload ? "bg-red-600" : "bg-primary"}`}
                            style={{ width: `${Math.min(100, Math.round((totalAssignedKg / capKg) * 100))}%` }}
                          />
                        </div>
                      )}
                      {isWeightOverload && (
                        <p className="text-[10px] text-red-600 font-semibold mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> ¡Sobrecarga de peso detectada!
                        </p>
                      )}
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg border flex flex-col justify-between ${isVolOverload ? "bg-red-500/10 border-red-500/40" : "bg-card"}`}>
                    <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                      <span className={isVolOverload ? "text-red-700 dark:text-red-300 font-semibold" : ""}>
                        Cubicaje Volumétrico
                      </span>
                      <Box className={`h-3.5 w-3.5 ${isVolOverload ? "text-red-600" : "text-muted-foreground"}`} />
                    </div>
                    <div className="mt-1">
                      <div className="flex items-baseline justify-between">
                        <span className={`text-xl font-bold font-mono ${isVolOverload ? "text-red-600" : ""}`}>
                          {totalAssignedM3.toLocaleString("es-CL", { maximumFractionDigits: 2 })} m³
                        </span>
                        {capM3 && (
                          <span className="text-[11px] font-mono text-muted-foreground">
                            / {capM3.toLocaleString("es-CL", { maximumFractionDigits: 2 })} m³ max
                          </span>
                        )}
                      </div>
                      {capM3 && (
                        <div className="mt-1.5 w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full transition-all ${isVolOverload ? "bg-red-600" : "bg-primary"}`}
                            style={{ width: `${Math.min(100, Math.round((totalAssignedM3 / capM3) * 100))}%` }}
                          />
                        </div>
                      )}
                      {isVolOverload && (
                        <p className="text-[10px] text-red-600 font-semibold mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> ¡Excede capacidad cúbica del vehículo!
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sección 1: Secuencia de Paradas Asignadas */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <RouteIcon className="h-4 w-4 text-primary" />
                        Secuencia de Paradas (En Orden de Entrega)
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        Utiliza las flechas para ordenar la hoja de ruta desde la primera entrega hasta la última.
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {routeStops.length} {routeStops.length === 1 ? "parada" : "paradas"}
                    </Badge>
                  </div>

                  {routeStops.length === 0 ? (
                    <div className="p-8 text-center border rounded-lg border-dashed text-muted-foreground text-xs space-y-1">
                      <p className="font-medium text-foreground">No hay guías de despacho asignadas a esta ruta.</p>
                      <p>Selecciona guías disponibles en la sección inferior para agregarlas al recorrido.</p>
                    </div>
                  ) : (
                    <div className="border rounded-md divide-y">
                      {routeStops.map((stop, index) => {
                        const guide = stop.noteData || (notesQ.data ?? []).find((n: any) => n.id === stop.dispatch_note_id);
                        const m = calcGuideWeightAndVol(guide);

                        return (
                          <div
                            key={stop.dispatch_note_id}
                            className="p-3 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center font-mono shrink-0">
                                {index + 1}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-xs">
                                    {guide?.dispatch_number ? `Guía #${guide.dispatch_number}` : "Guía s/n"}
                                  </span>
                                  <span className="text-xs font-medium text-foreground">
                                    {guide?.parties?.name || "Cliente 3PL"}
                                  </span>
                                  {guide?.parties?.tax_id && (
                                    <span className="text-[10px] text-muted-foreground">
                                      ({guide.parties.tax_id})
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                                  <span className="truncate">{guide?.destination_address || "Sin dirección especificada"}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right text-[11px] font-mono hidden sm:block">
                                <div>{m.kg ? `${m.kg.toLocaleString("es-CL")} kg` : "— kg"}</div>
                                <div className="text-muted-foreground">{m.m3 ? `${m.m3.toLocaleString("es-CL")} m³` : "— m³"}</div>
                              </div>

                              <div className="flex items-center gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  disabled={index === 0}
                                  onClick={() => moveStopUp(index)}
                                  title="Mover antes en la ruta"
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  disabled={index === routeStops.length - 1}
                                  onClick={() => moveStopDown(index)}
                                  title="Mover después en la ruta"
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => removeStop(stop.dispatch_note_id)}
                                  title="Quitar de la ruta"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Sección 2: Guías Disponibles para Asignar */}
                <div className="space-y-3 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        Guías de Despacho Disponibles para Ruta
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        Guías registradas que aún no han sido asignadas a esta ruta de entrega.
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {availableGuides.length} disponibles
                    </Badge>
                  </div>

                  {availableGuides.length === 0 ? (
                    <div className="p-6 text-center border rounded-lg text-muted-foreground text-xs">
                      No hay guías adicionales disponibles en esta empresa.
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto rounded-md border divide-y">
                      {availableGuides.map((guide: any) => {
                        const m = calcGuideWeightAndVol(guide);
                        return (
                          <div
                            key={guide.id}
                            className="p-2.5 flex items-center justify-between gap-3 text-xs hover:bg-muted/30 transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-primary">
                                  {guide.dispatch_number ? `#${guide.dispatch_number}` : "Guía s/n"}
                                </span>
                                <span className="font-medium text-foreground">{guide.parties?.name}</span>
                                <Badge variant="outline" className="text-[10px] py-0">
                                  {TRANSFER_LABELS[guide.transfer_type as TransferType] || guide.transfer_type}
                                </Badge>
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                                Destino: {guide.destination_address || "Sin dirección"}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right text-[10px] font-mono text-muted-foreground hidden sm:block">
                                <div>{m.kg ? `${m.kg.toLocaleString("es-CL")} kg` : "0 kg"}</div>
                                <div>{m.m3 ? `${m.m3.toLocaleString("es-CL")} m³` : "0 m³"}</div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1"
                                onClick={() => addStop(guide)}
                              >
                                <Plus className="h-3 w-3" />
                                Agregar a Ruta
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRouteModalOpen(false)}
                    disabled={saveRouteM.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => saveRouteM.mutate()}
                    disabled={saveRouteM.isPending || routeStops.length === 0}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {saveRouteM.isPending ? "Guardando..." : editingRouteId ? "Guardar Cambios de Ruta" : "Guardar y Planificar Ruta"}
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Modal Dialog: Ver Hoja de Ruta TMS y Secuencia de Entregas (Sprint 21) */}
      <Dialog open={!!selectedRouteForView} onOpenChange={(open) => !open && setSelectedRouteForView(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedRouteForView && (() => {
            const r = selectedRouteForView;
            const stops = [...(r.route_stops || [])].sort((a: any, b: any) => a.stop_order - b.stop_order);

            let totalRouteKg = 0;
            let totalRouteM3 = 0;
            for (const s of stops) {
              const m = calcGuideWeightAndVol(s.dispatch_notes);
              totalRouteKg += m.kg;
              totalRouteM3 += m.m3;
            }

            return (
              <div className="space-y-6 py-2">
                <DialogHeader>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <DialogTitle className="flex items-center gap-2 text-lg">
                        <Navigation className="h-5 w-5 text-primary" />
                        {r.name || "Hoja de Ruta TMS"}
                      </DialogTitle>
                      <DialogDescription className="text-xs">
                        Fecha Programada: <strong>{new Date(r.route_date + "T00:00:00").toLocaleDateString("es-CL")}</strong>
                      </DialogDescription>
                    </div>
                    <Badge variant="outline" className={`text-xs px-2.5 py-0.5 ${ROUTE_STATUS_BADGES[r.status as RouteStatus]?.className}`}>
                      {ROUTE_STATUS_LABELS[r.status as RouteStatus] || r.status}
                    </Badge>
                  </div>
                </DialogHeader>

                {/* Resumen de Transporte y Chofer */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-lg bg-muted/40 border text-xs">
                  <div>
                    <div className="text-[10px] text-muted-foreground">Vehículo Asignado</div>
                    <div className="font-mono font-bold text-primary mt-0.5">
                      {r.vehicles?.plate ? `${r.vehicles.plate} (${r.vehicles.vehicle_type || "Camión"})` : "Sin vehículo asignado"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Chofer / Conductor</div>
                    <div className="font-medium text-foreground mt-0.5">
                      {r.driver_name || "Sin conductor asignado"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Carga Total Transportada</div>
                    <div className="font-mono font-medium mt-0.5">
                      {totalRouteKg ? `${totalRouteKg.toLocaleString("es-CL")} kg` : "—"} · {totalRouteM3 ? `${totalRouteM3.toLocaleString("es-CL")} m³` : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Cantidad de Entregas</div>
                    <div className="font-mono font-bold text-primary mt-0.5">
                      {stops.length} {stops.length === 1 ? "parada" : "paradas"}
                    </div>
                  </div>
                  {r.notes && (
                    <div className="col-span-2 sm:col-span-4 pt-2 border-t text-[11px] text-muted-foreground">
                      <strong className="text-foreground">Notas de Ruta:</strong> {r.notes}
                    </div>
                  )}
                </div>

                {/* Barra de Control de Estado de la Ruta */}
                <div className="p-3.5 rounded-lg border bg-card space-y-2">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <span className="text-xs font-semibold">Gestión del Ciclo de Vida de la Ruta</span>
                      <p className="text-[11px] text-muted-foreground">
                        El estado de la ruta es independiente del estado individual de cada guía de despacho.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.status === "planificada" && (
                        <>
                          <Button
                            size="sm"
                            className="gap-1.5 h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={() => updateRouteStatusM.mutate({ routeId: r.id, status: "en_curso" })}
                            disabled={updateRouteStatusM.isPending}
                          >
                            <Play className="h-3.5 w-3.5" />
                            Iniciar Ruta (En Curso)
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs text-slate-600 hover:text-red-600"
                            onClick={() => updateRouteStatusM.mutate({ routeId: r.id, status: "cancelada" })}
                            disabled={updateRouteStatusM.isPending}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Cancelar
                          </Button>
                        </>
                      )}

                      {r.status === "en_curso" && (
                        <>
                          <Button
                            size="sm"
                            className="gap-1.5 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => updateRouteStatusM.mutate({ routeId: r.id, status: "finalizada" })}
                            disabled={updateRouteStatusM.isPending}
                          >
                            <CheckCheck className="h-3.5 w-3.5" />
                            Finalizar Ruta
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs text-slate-600 hover:text-red-600"
                            onClick={() => updateRouteStatusM.mutate({ routeId: r.id, status: "cancelada" })}
                            disabled={updateRouteStatusM.isPending}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Cancelar Ruta
                          </Button>
                        </>
                      )}

                      {(r.status === "finalizada" || r.status === "cancelada") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => updateRouteStatusM.mutate({ routeId: r.id, status: "planificada" })}
                          disabled={updateRouteStatusM.isPending}
                        >
                          Reabrir como Planificada
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Secuencia Detallada de Paradas */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <RouteIcon className="h-4 w-4 text-primary" />
                    Entregas Secuenciadas en Hoja de Ruta ({stops.length})
                  </h3>

                  {stops.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center border rounded-md">
                      Esta ruta no tiene paradas asignadas.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {stops.map((stop: any, index: number) => {
                        const note = stop.dispatch_notes;
                        const m = calcGuideWeightAndVol(note);
                        const linesCount = note?.dispatch_note_lines?.length || 0;
                        const pickedLines = (note?.dispatch_note_lines || []).filter((l: any) => l.picked).length;
                        const packedLines = (note?.dispatch_note_lines || []).filter((l: any) => l.packed).length;
                        const delStatus: StopDeliveryStatus = (stop.delivery_status as StopDeliveryStatus) || "pendiente";

                        return (
                          <div
                            key={stop.id}
                            className="p-3.5 rounded-lg border bg-card text-xs flex flex-col gap-3"
                          >
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                              <div className="flex items-start gap-3">
                                <span className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center font-mono shrink-0 mt-0.5">
                                  #{stop.stop_order || index + 1}
                                </span>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono font-bold text-primary">
                                      {note?.dispatch_number ? `Guía #${note.dispatch_number}` : "Guía s/n"}
                                    </span>
                                    <span className="font-semibold text-foreground">
                                      {note?.parties?.name || "Cliente 3PL"}
                                    </span>
                                    {note?.parties?.tax_id && (
                                      <span className="text-[10px] text-muted-foreground">
                                        · {note.parties.tax_id}
                                      </span>
                                    )}
                                    <Badge variant="outline" className="text-[10px] py-0">
                                      {TRANSFER_LABELS[note?.transfer_type as TransferType] || note?.transfer_type}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] px-2 py-0 ${STOP_DELIVERY_STATUS_BADGES[delStatus]?.className}`}
                                    >
                                      {STOP_DELIVERY_STATUS_LABELS[delStatus]}
                                    </Badge>
                                  </div>

                                  <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                                    <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                                    <span>{note?.destination_address || "Sin dirección"}</span>
                                  </div>

                                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1 flex-wrap">
                                    <span>Líneas: <strong>{linesCount}</strong></span>
                                    <span>Picking: <strong>{pickedLines}/{linesCount}</strong></span>
                                    <span>Packing: <strong>{packedLines}/{linesCount}</strong></span>
                                    {note?.courier_name && (
                                      <span className="font-mono text-blue-600 dark:text-blue-400">
                                        Courier: {note.courier_name} {note.courier_tracking_number ? `(#${note.courier_tracking_number})` : ""}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right text-[11px] font-mono shrink-0 self-end sm:self-center">
                                <div className="font-semibold">{m.kg ? `${m.kg.toLocaleString("es-CL")} kg` : "— kg"}</div>
                                <div className="text-muted-foreground">{m.m3 ? `${m.m3.toLocaleString("es-CL")} m³` : "— m³"}</div>
                              </div>
                            </div>

                            {/* Detalle de entrega / Tracking puntual de terreno (Sprint 22) */}
                            {(stop.delivery_status === "entregado" || stop.delivery_status === "no_entregado") && (
                              <div
                                className={`p-2.5 rounded-md border text-[11px] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 ${
                                  stop.delivery_status === "entregado"
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200"
                                    : "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200"
                                }`}
                              >
                                <div className="space-y-0.5">
                                  {stop.delivery_status === "entregado" ? (
                                    <>
                                      <div className="font-semibold flex items-center gap-1.5">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                        <span>Entregado a: <strong>{stop.received_by || "Receptor no especificado"}</strong></span>
                                        {stop.arrived_at && (
                                          <span className="font-normal text-muted-foreground text-[10px]">
                                            · {new Date(stop.arrived_at).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                                          </span>
                                        )}
                                      </div>
                                      {stop.delivery_notes && (
                                        <div className="text-[10px] italic text-muted-foreground">
                                          Nota: {stop.delivery_notes}
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <div className="flex items-center gap-1.5">
                                      <XCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                                      <span>No Entregado: <strong>{stop.delivery_notes || "Sin motivo registrado"}</strong></span>
                                    </div>
                                  )}
                                </div>

                                {stop.lat && stop.lng && (
                                  <a
                                    href={`https://www.google.com/maps?q=${stop.lat},${stop.lng}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1 font-mono text-[10px] underline hover:text-primary shrink-0"
                                  >
                                    <LocateFixed className="h-3 w-3" />
                                    <span>GPS: {Number(stop.lat).toFixed(4)}, {Number(stop.lng).toFixed(4)}</span>
                                    <ExternalLink className="h-2.5 w-2.5" />
                                  </a>
                                )}
                              </div>
                            )}

                            {/* Botones de acción operativa por parada */}
                            <div className="flex items-center justify-between pt-1 border-t text-[11px]">
                              <span className="text-[10px] text-muted-foreground">
                                Control de entrega:
                              </span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {delStatus !== "entregado" ? (
                                  <>
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                      onClick={() => openStopDeliveryDialog(stop, r.id, "entregado")}
                                    >
                                      <Check className="h-3 w-3" />
                                      Marcar Entregado
                                    </Button>
                                    {delStatus !== "en_ruta" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs gap-1 text-blue-600"
                                        onClick={() =>
                                          updateStopDeliveryM.mutate({
                                            stopId: stop.id,
                                            deliveryStatus: "en_ruta",
                                          })
                                        }
                                        disabled={updateStopDeliveryM.isPending}
                                      >
                                        <Truck className="h-3 w-3" />
                                        En Ruta
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs gap-1 text-rose-600 hover:bg-rose-50"
                                      onClick={() => openStopDeliveryDialog(stop, r.id, "no_entregado")}
                                    >
                                      <XCircle className="h-3 w-3" />
                                      No Entregado
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs gap-1"
                                      onClick={() => openStopDeliveryDialog(stop, r.id, "entregado")}
                                    >
                                      <Edit className="h-3 w-3" />
                                      Modificar Datos
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs text-muted-foreground"
                                      onClick={() =>
                                        updateStopDeliveryM.mutate({
                                          stopId: stop.id,
                                          deliveryStatus: "pendiente",
                                        })
                                      }
                                      disabled={updateStopDeliveryM.isPending}
                                    >
                                      Reabrir Parada
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <DialogFooter className="pt-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedRouteForView(null)}>
                    Cerrar Hoja de Ruta
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Modal Dialog: Confirmar / Actualizar Entrega de Parada TMS (Sprint 22) */}
      <Dialog open={!!markingStopDelivery} onOpenChange={(open) => !open && setMarkingStopDelivery(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Actualizar Estado de Entrega
            </DialogTitle>
            <DialogDescription className="text-xs">
              Registra el resultado de la visita en terreno para la parada seleccionada.
            </DialogDescription>
          </DialogHeader>

          {markingStopDelivery && (() => {
            const stop = markingStopDelivery.stop;
            const note = stop.dispatch_notes;

            return (
              <div className="space-y-4 py-2 text-xs">
                {/* Info de la parada */}
                <div className="p-3 rounded-lg bg-muted/40 border space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-bold text-primary">
                      Parada #{stop.stop_order} · {note?.dispatch_number ? `Guía #${note.dispatch_number}` : "Guía s/n"}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {note?.parties?.name || "Cliente 3PL"}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span>{note?.destination_address || "Sin dirección especificada"}</span>
                  </div>
                </div>

                {/* Selector de Estado de Entrega */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Resultado de la Parada *</Label>
                  <Select
                    value={deliveryForm.status}
                    onValueChange={(v: StopDeliveryStatus) => setDeliveryForm((f) => ({ ...f, status: v }))}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entregado">✓ Entregado con Éxito</SelectItem>
                      <SelectItem value="no_entregado">✗ No Entregado (Problema en terreno)</SelectItem>
                      <SelectItem value="en_ruta">🚚 En Ruta hacia este destino</SelectItem>
                      <SelectItem value="pendiente">⏳ Pendiente de visita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Campos condicionales para Entregado */}
                {deliveryForm.status === "entregado" && (
                  <div className="space-y-3 p-3 rounded-lg border bg-emerald-500/5 border-emerald-500/20">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                        Nombre o RUT de Quien Recepciona *
                      </Label>
                      <Input
                        placeholder="ej. Juan Pérez (Guardia / Recepción)"
                        className="h-8 text-xs bg-background"
                        value={deliveryForm.received_by}
                        onChange={(e) => setDeliveryForm((f) => ({ ...f, received_by: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Geolocalización GPS (Aproximación de Terreno)</Label>
                        {deliveryForm.gpsCaptured && (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1">
                            <LocateFixed className="h-3 w-3" />
                            GPS Capturado
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1.5 w-full justify-center"
                          onClick={captureGpsLocation}
                          disabled={deliveryForm.gpsLoading}
                        >
                          <LocateFixed className="h-3.5 w-3.5 text-primary" />
                          {deliveryForm.gpsLoading
                            ? "Obteniendo ubicación..."
                            : deliveryForm.gpsCaptured
                            ? "Actualizar coordenadas GPS"
                            : "Capturar ubicación GPS actual"}
                        </Button>
                      </div>

                      {deliveryForm.lat && deliveryForm.lng && (
                        <p className="text-[11px] font-mono text-muted-foreground text-center">
                          Coordenadas: {deliveryForm.lat}, {deliveryForm.lng}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        Utiliza el navegador del dispositivo para registrar el punto geográfico del evento sin interrumpir la operación si no hay señal.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Observaciones de entrega</Label>
                      <Input
                        placeholder="ej. Dejado en portería con firma en guía impresa..."
                        className="h-8 text-xs bg-background"
                        value={deliveryForm.delivery_notes}
                        onChange={(e) => setDeliveryForm((f) => ({ ...f, delivery_notes: e.target.value }))}
                      />
                    </div>
                  </div>
                )}

                {/* Campos para No Entregado */}
                {deliveryForm.status === "no_entregado" && (
                  <div className="space-y-2 p-3 rounded-lg border bg-rose-500/5 border-rose-500/20">
                    <Label className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                      Motivo o Justificación del Rechazo *
                    </Label>
                    <Input
                      placeholder="ej. Local cerrado, destinatario ausente, rechazo por embalaje..."
                      className="h-8 text-xs bg-background"
                      value={deliveryForm.delivery_notes}
                      onChange={(e) => setDeliveryForm((f) => ({ ...f, delivery_notes: e.target.value }))}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Esta observación quedará registrada en el historial del despacho para trazabilidad con el cliente 3PL.
                    </p>
                  </div>
                )}

                <DialogFooter className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMarkingStopDelivery(null)}
                    disabled={updateStopDeliveryM.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() =>
                      updateStopDeliveryM.mutate({
                        stopId: stop.id,
                        deliveryStatus: deliveryForm.status,
                        receivedBy: deliveryForm.received_by,
                        notes: deliveryForm.delivery_notes,
                        lat: deliveryForm.lat,
                        lng: deliveryForm.lng,
                      })
                    }
                    disabled={
                      updateStopDeliveryM.isPending ||
                      (deliveryForm.status === "entregado" && !deliveryForm.received_by.trim()) ||
                      (deliveryForm.status === "no_entregado" && !deliveryForm.delivery_notes.trim())
                    }
                  >
                    <Check className="h-3.5 w-3.5" />
                    {updateStopDeliveryM.isPending ? "Guardando..." : "Confirmar Estado"}
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: NUEVO PEDIDO OMS MANUAL                              */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={isNewOrderOpen} onOpenChange={setIsNewOrderOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Nuevo Pedido de Venta (OMS Manual)
            </DialogTitle>
            <DialogDescription>
              Registra un pedido recibido por canal manual, telefónico o correo para un cliente 3PL.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cliente 3PL *</Label>
                <Select
                  value={manualOrderForm.party_id}
                  onValueChange={(v) => setManualOrderForm((f) => ({ ...f, party_id: v }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {parties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {p.is_3pl_client ? "· 3PL" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Canal de Venta</Label>
                <Select
                  value={manualOrderForm.channel}
                  onValueChange={(v) => setManualOrderForm((f) => ({ ...f, channel: v }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Canal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual / Teléfono</SelectItem>
                    <SelectItem value="shopify">Shopify</SelectItem>
                    <SelectItem value="vtex">VTEX</SelectItem>
                    <SelectItem value="mercadolibre">Mercado Libre</SelectItem>
                    <SelectItem value="b2b">Venta Mayorista B2B</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">N° Pedido Ext. / ID Orden *</Label>
                <Input
                  placeholder="ej. #10492 o PED-2026-001"
                  className="h-8 text-xs bg-background"
                  value={manualOrderForm.external_order_id}
                  onChange={(e) => setManualOrderForm((f) => ({ ...f, external_order_id: e.target.value }))}
                />
                <p className="text-[10px] text-muted-foreground">Único por cliente y canal para evitar duplicados.</p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Dirección de Destino</Label>
                <Input
                  placeholder="ej. Av. Vitacura 2670, Las Condes"
                  className="h-8 text-xs bg-background"
                  value={manualOrderForm.destination_address}
                  onChange={(e) => setManualOrderForm((f) => ({ ...f, destination_address: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Notas / Instrucciones del Pedido</Label>
              <Input
                placeholder="ej. Entregar conserjería, horario 9:00 a 18:00 hrs"
                className="h-8 text-xs bg-background"
                value={manualOrderForm.notes}
                onChange={(e) => setManualOrderForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {/* Editor de Líneas del Pedido */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Productos / SKUs del Pedido</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setManualOrderLines((cur) => [...cur, { item_id: "", external_sku: "", qty: "1" }])}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar Producto
                </Button>
              </div>

              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead>Ítem Catálogo (Opcional)</TableHead>
                      <TableHead>SKU Externo</TableHead>
                      <TableHead className="w-[100px]">Cantidad</TableHead>
                      <TableHead className="w-[40px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {manualOrderLines.map((line, idx) => (
                      <TableRow key={idx} className="text-xs">
                        <TableCell>
                          <Select
                            value={line.item_id}
                            onValueChange={(val) => {
                              const matched = items.find((it) => it.id === val);
                              setManualOrderLines((cur) =>
                                cur.map((l, i) =>
                                  i === idx
                                    ? {
                                        ...l,
                                        item_id: val,
                                        external_sku: l.external_sku || (matched?.code ?? ""),
                                      }
                                    : l
                                )
                              );
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Seleccionar del catálogo..." />
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
                        <TableCell>
                          <Input
                            placeholder="ej. SKU-PROD-01"
                            className="h-7 text-xs bg-background"
                            value={line.external_sku}
                            onChange={(e) =>
                              setManualOrderLines((cur) =>
                                cur.map((l, i) => (i === idx ? { ...l, external_sku: e.target.value } : l))
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            className="h-7 text-xs bg-background"
                            value={line.qty}
                            onChange={(e) =>
                              setManualOrderLines((cur) =>
                                cur.map((l, i) => (i === idx ? { ...l, qty: e.target.value } : l))
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-rose-600"
                            onClick={() =>
                              setManualOrderLines((cur) =>
                                cur.length > 1 ? cur.filter((_, i) => i !== idx) : cur
                              )
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsNewOrderOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => createManualOrderM.mutate()}
              disabled={createManualOrderM.isPending}
            >
              {createManualOrderM.isPending ? "Guardando..." : "Crear Pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: IMPORTADOR MASIVO CSV                                */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={isCsvImportOpen} onOpenChange={setIsCsvImportOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Importador Masivo de Pedidos (CSV)
            </DialogTitle>
            <DialogDescription>
              Carga pedidos en lote para clientes que aún no tienen integración directa vía webhook.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cliente 3PL Destino *</Label>
                <Select value={csvPartyId} onValueChange={setCsvPartyId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {parties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {p.is_3pl_client ? "· 3PL" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Canal Etiqueta</Label>
                <Input
                  className="h-8 text-xs bg-background"
                  value={csvChannel}
                  onChange={(e) => setCsvChannel(e.target.value)}
                  placeholder="ej. csv, linio, falabella..."
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Pegar Contenido CSV o Archivo de Texto</Label>
              <p className="text-[11px] text-muted-foreground">
                Columnas requeridas separadas por coma o tabulación: <code>external_order_id, destination_address, sku, qty</code>
              </p>
              <textarea
                className="w-full h-32 p-2.5 font-mono text-[11px] rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder={`external_order_id, destination_address, sku, qty\n#10401, Av. Providencia 1234 Santiago, SKU-PROD-01, 2\n#10401, Av. Providencia 1234 Santiago, SKU-PROD-02, 1\n#10402, Calle Los Robles 55 Viña del Mar, SKU-PROD-03, 5`}
                value={csvRawText}
                onChange={(e) => handleCsvTextChange(e.target.value)}
              />
            </div>

            {/* Vista Previa de Pedidos Detectados */}
            {csvParsedPreview.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {csvParsedPreview.length} línea(s) detectada(s) · {new Set(csvParsedPreview.map((x) => x.external_order_id)).size} pedidos únicos
                  </span>
                </div>
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-[11px]">
                        <TableHead>N° Orden Ext.</TableHead>
                        <TableHead>Dirección</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvParsedPreview.slice(0, 10).map((row, idx) => (
                        <TableRow key={idx} className="text-[11px]">
                          <TableCell className="font-mono font-medium">{row.external_order_id}</TableCell>
                          <TableCell className="truncate max-w-[150px]">{row.destination_address || "—"}</TableCell>
                          <TableCell className="font-mono">{row.sku}</TableCell>
                          <TableCell className="text-right font-medium">{row.qty}</TableCell>
                        </TableRow>
                      ))}
                      {csvParsedPreview.length > 10 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-[10px] text-muted-foreground italic py-1">
                            ... y {csvParsedPreview.length - 10} filas más
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsCsvImportOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => importCsvOrdersM.mutate()}
              disabled={importCsvOrdersM.isPending || !csvParsedPreview.length || !csvPartyId}
            >
              {importCsvOrdersM.isPending ? "Importando..." : `Importar ${new Set(csvParsedPreview.map((x) => x.external_order_id)).size || 0} Pedidos`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: TOKEN DE INTEGRACIÓN GENERADO                        */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={isTokenModalOpen} onOpenChange={setIsTokenModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-emerald-600" />
              Token de Integración Webhook Generado
            </DialogTitle>
            <DialogDescription>
              Copia este token y configúralo en la tienda online o webhook del cliente{" "}
              <strong>{generatedTokenData?.clientName}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Token de Autenticación de Cliente</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={generatedTokenData?.token || ""}
                  className="font-mono text-xs bg-muted/40 font-semibold"
                />
                <Button
                  size="sm"
                  className="gap-1 shrink-0"
                  onClick={() => {
                    if (generatedTokenData?.token) {
                      navigator.clipboard.writeText(generatedTokenData.token);
                      toast.success("Token copiado al portapapeles");
                    }
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copiar
                </Button>
              </div>
            </div>

            <div className="space-y-1.5 p-3 rounded-lg border bg-muted/20">
              <Label className="text-xs font-semibold">Endpoint de Recepción (POST)</Label>
              <code className="block p-2 rounded bg-background border font-mono text-[11px] select-all">
                {typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/oms
              </code>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Ejemplo de Llamada (cURL / Payload)</Label>
              <pre className="p-3 rounded-md bg-slate-900 text-slate-100 font-mono text-[10px] overflow-x-auto whitespace-pre">
{`curl -X POST ${typeof window !== "undefined" ? window.location.origin : "https://mi-empresa.cl"}/api/webhooks/oms \\
  -H "Content-Type: application/json" \\
  -d '{
    "token": "${generatedTokenData?.token || "tok_3pl_..."}",
    "channel": "shopify",
    "external_order_id": "#10492",
    "destination_address": "Av. Vitacura 2670, Santiago",
    "lines": [
      { "external_sku": "SKU-PROD-01", "qty": 2 }
    ]
  }'`}
              </pre>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button size="sm" onClick={() => setIsTokenModalOpen(false)}>
              Entendido y Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: DETALLE DE PEDIDO OMS                                */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={!!selectedOrderForView} onOpenChange={(open) => !open && setSelectedOrderForView(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedOrderForView && (() => {
            const order = selectedOrderForView;
            const lines = order.sales_order_lines || [];
            const totalUnits = lines.reduce((acc: number, l: any) => acc + (Number(l.qty) || 0), 0);
            const statusBadge = ORDER_STATUS_BADGES[order.status as OrderStatus] || ORDER_STATUS_BADGES.pendiente;

            return (
              <div className="space-y-4">
                <DialogHeader>
                  <div className="flex items-center justify-between pr-4">
                    <DialogTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" />
                      Pedido OMS: {order.external_order_id || order.id.slice(0, 8)}
                    </DialogTitle>
                    <Badge variant="outline" className={`text-xs ${statusBadge.className}`}>
                      {statusBadge.label}
                    </Badge>
                  </div>
                  <DialogDescription>
                    Canal: <strong>{order.channel}</strong> · Registrado el {new Date(order.created_at).toLocaleString()}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-3 text-xs p-3 rounded-md bg-muted/20 border">
                  <div>
                    <span className="text-muted-foreground">Cliente 3PL:</span>
                    <div className="font-semibold">{order.parties?.name || "—"}</div>
                    {order.parties?.tax_id && <div className="text-[10px] text-muted-foreground">{order.parties.tax_id}</div>}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Destino de Entrega:</span>
                    <div className="font-semibold">{order.destination_address || "Sin dirección especificada"}</div>
                  </div>
                  {order.notes && (
                    <div className="col-span-2 pt-1 border-t">
                      <span className="text-muted-foreground">Observaciones / Notas:</span>
                      <div className="italic text-[11px]">{order.notes}</div>
                    </div>
                  )}
                  {order.dispatch_note_id && (
                    <div className="col-span-2 pt-1 border-t flex items-center justify-between">
                      <span className="text-muted-foreground">Guía de Despacho Vinculada:</span>
                      <Badge variant="secondary" className="font-mono text-xs gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        {order.dispatch_notes?.dispatch_number || `GD-${order.dispatch_note_id.slice(0, 8)}`}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Tabla de Productos / Líneas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <Label className="text-xs font-semibold">Productos del Pedido ({lines.length} ítems, {totalUnits} un.)</Label>
                  </div>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead>SKU Externo</TableHead>
                          <TableHead>Ítem del Catálogo</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.map((l: any) => (
                          <TableRow key={l.id} className="text-xs">
                            <TableCell className="font-mono font-medium">{l.external_sku || "—"}</TableCell>
                            <TableCell>
                              {l.items ? (
                                <div>
                                  <span className="font-medium">{l.items.name}</span>
                                  <span className="text-muted-foreground text-[10px] block font-mono">{l.items.code}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground italic text-[11px]">No vinculado a catálogo</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-semibold">{l.qty} un.</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <DialogFooter className="pt-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedOrderForView(null)}>
                    Cerrar
                  </Button>
                  {order.status === "pendiente" && (
                    <Button
                      size="sm"
                      className="gap-1.5 bg-primary text-primary-foreground"
                      onClick={() => convertOrderToDispatchNoteM.mutate(order)}
                      disabled={convertOrderToDispatchNoteM.isPending}
                    >
                      <Truck className="h-3.5 w-3.5" />
                      {convertOrderToDispatchNoteM.isPending ? "Convirtiendo..." : "Convertir a Guía de Despacho"}
                    </Button>
                  )}
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO: DETALLE DE FACTURA / LÍNEAS DE CONSUMO 3PL */}
      <Dialog open={!!selectedInvoiceForDetails} onOpenChange={(open) => !open && setSelectedInvoiceForDetails(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Detalle de Factura {selectedInvoiceForDetails?.invoice_number ? `#${selectedInvoiceForDetails.invoice_number}` : ""}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Glosa: {selectedInvoiceForDetails?.memo}
            </DialogDescription>
          </DialogHeader>

          {selectedInvoiceForDetails && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-muted/40 rounded-lg">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Cliente</span>
                  <span className="font-semibold text-foreground">{selectedInvoiceForDetails.parties?.name || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Fecha Emisión</span>
                  <span className="font-semibold text-foreground">{selectedInvoiceForDetails.issue_date}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Estado</span>
                  <Badge variant="outline" className="text-[10px] mt-0.5">
                    {selectedInvoiceForDetails.status === "draft" ? "Borrador (editable en Ventas)" : selectedInvoiceForDetails.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Moneda</span>
                  <span className="font-semibold text-foreground">{selectedInvoiceForDetails.currency_code || "CLP"}</span>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-xs mb-2">Desglose de Conceptos Facturados</h4>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Concepto / Servicio</TableHead>
                        <TableHead className="text-right">Cant.</TableHead>
                        <TableHead className="text-right">Tarifa Unit.</TableHead>
                        <TableHead className="text-right">Total Neto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selectedInvoiceForDetails.sales_invoice_lines || []).map((l: any) => (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium">{l.description}</TableCell>
                          <TableCell className="text-right font-mono">{Number(l.qty).toLocaleString("es-CL")}</TableCell>
                          <TableCell className="text-right font-mono">${Number(l.unit_price).toLocaleString("es-CL")}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">${Number(l.line_total).toLocaleString("es-CL")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex justify-end">
                <div className="w-56 space-y-1 text-right text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal Neto:</span>
                    <span className="font-mono">${Number(selectedInvoiceForDetails.subtotal_amount || 0).toLocaleString("es-CL")}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>IVA (19%):</span>
                    <span className="font-mono">${Number(selectedInvoiceForDetails.tax_amount || 0).toLocaleString("es-CL")}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-foreground pt-1 border-t">
                    <span>Total Factura:</span>
                    <span className="font-mono">${Number(selectedInvoiceForDetails.total_amount || 0).toLocaleString("es-CL")}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSelectedInvoiceForDetails(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO: CREAR NOTA DE AJUSTE (CRÉDITO O DÉBITO) */}
      <Dialog open={!!selectedInvoiceForAdjustment} onOpenChange={(open) => !open && setSelectedInvoiceForAdjustment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Edit className="h-5 w-5 text-amber-500" />
              Emitir Nota de Ajuste a Factura
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ajuste de tarifa o consumos vinculado a la Factura #{selectedInvoiceForAdjustment?.invoice_number || selectedInvoiceForAdjustment?.id.slice(0, 8)}.
            </DialogDescription>
          </DialogHeader>

          {selectedInvoiceForAdjustment && (
            <div className="space-y-4 text-xs py-2">
              <div className="p-3 bg-muted/40 rounded-lg space-y-1 text-xs">
                <div><span className="text-muted-foreground">Cliente: </span><strong>{selectedInvoiceForAdjustment.parties?.name}</strong></div>
                <div><span className="text-muted-foreground">Total Factura Original: </span><strong className="font-mono">${Number(selectedInvoiceForAdjustment.total_amount || 0).toLocaleString("es-CL")}</strong></div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de Ajuste</Label>
                <Select value={adjustmentType} onValueChange={(v: "credit" | "debit") => setAdjustmentType(v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Nota de Crédito (Descuento / Reintegro de tarifa)</SelectItem>
                    <SelectItem value="debit">Nota de Débito (Cobro Adicional / Consumo no liquidado)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adj_amount" className="text-xs">Monto Neto del Ajuste ($ CLP)</Label>
                <Input
                  id="adj_amount"
                  type="number"
                  min="1"
                  step="1"
                  value={adjustmentAmount || ""}
                  onChange={(e) => setAdjustmentAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  placeholder="Ej: 45000"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adj_reason" className="text-xs">Motivo o Justificación del Ajuste</Label>
                <Input
                  id="adj_reason"
                  type="text"
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="Ej: Descuento por 3 pallets no utilizados en semana 2"
                  className="h-8 text-xs"
                />
              </div>

              {adjustmentAmount > 0 && (
                <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs space-y-1">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Monto Neto:</span>
                    <span className="font-mono">${adjustmentAmount.toLocaleString("es-CL")}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>IVA (19%):</span>
                    <span className="font-mono">${Math.round(adjustmentAmount * 0.19).toLocaleString("es-CL")}</span>
                  </div>
                  <div className="flex justify-between font-bold text-foreground border-t pt-1">
                    <span>Total {adjustmentType === "credit" ? "Nota de Crédito" : "Nota de Débito"}:</span>
                    <span className="font-mono">${Math.round(adjustmentAmount * 1.19).toLocaleString("es-CL")}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedInvoiceForAdjustment(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => createAdjustmentInvoiceM.mutate()}
              disabled={createAdjustmentInvoiceM.isPending || !adjustmentAmount || !adjustmentReason.trim()}
            >
              {createAdjustmentInvoiceM.isPending ? "Generando..." : "Crear Nota de Ajuste"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
