import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEntity } from "@/context/ActiveEntityContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Truck,
  Plus,
  Search,
  Calendar,
  Building2,
  Clock,
  MapPin,
  FileText,
  AlertCircle,
  Package,
  Layers,
  Scale,
  Box,
  Eye,
  Trash2,
  ShieldAlert,
  Globe,
  Ship,
  Plane,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  ArrowDownLeft,
  FileCheck,
  Award,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dispatch-notes")({
  component: DispatchNotesPage,
  head: () => ({
    meta: [
      { title: "Guías de Despacho y Logística 3PL | EasyERP" },
      {
        name: "description",
        content:
          "Gestión y registro de Guías de Despacho para clientes 3PL (Res. Ex. N°154 SII) y Operaciones de Comercio Exterior (SICEX / Aduanas).",
      },
    ],
  }),
});

interface DispatchLineDraft {
  item_id: string;
  qty: number;
  uom: string;
  weight_kg: number;
  volume_m3: number;
  unit_value: number;
}

export function DispatchNotesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activeEntity, activeEntityId } = useActiveEntity();

  // Active top tab
  const [activeTab, setActiveTab] = useState<"dispatch_notes" | "foreign_trade">("dispatch_notes");

  // --------------------------------------------------------------------------
  // Tab 1: Guías de Despacho State
  // --------------------------------------------------------------------------
  const [searchTerm, setSearchTerm] = useState("");
  const [filterParty, setFilterParty] = useState("ALL");
  const [filterType, setFilterType] = useState("ALL");

  const [newDispatchOpen, setNewDispatchOpen] = useState(false);
  const [viewDispatch, setViewDispatch] = useState<any | null>(null);

  const [partyId, setPartyId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [dispatchNumber, setDispatchNumber] = useState("");
  const [transferType, setTransferType] = useState<string>("venta");
  const [originAddress, setOriginAddress] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [carrierName, setCarrierName] = useState("");
  const [carrierTaxId, setCarrierTaxId] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [departureAt, setDepartureAt] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });
  const [arrivalAt, setArrivalAt] = useState(() => {
    const later = new Date(Date.now() + 3600000 * 4);
    return new Date(later.getTime() - later.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });
  const [notes, setNotes] = useState("");

  const [lines, setLines] = useState<DispatchLineDraft[]>([
    {
      item_id: "",
      qty: 1,
      uom: "UN",
      weight_kg: 0,
      volume_m3: 0,
      unit_value: 0,
    },
  ]);

  // --------------------------------------------------------------------------
  // Tab 2: Comercio Exterior (SICEX) State
  // --------------------------------------------------------------------------
  const [ftSearchTerm, setFtSearchTerm] = useState("");
  const [ftFilterParty, setFtFilterParty] = useState("ALL");
  const [ftFilterType, setFtFilterType] = useState("ALL");
  const [ftFilterStatus, setFtFilterStatus] = useState("ALL");

  const [newFTOpen, setNewFTOpen] = useState(false);
  const [viewFT, setViewFT] = useState<any | null>(null);
  const [manageCertsFT, setManageCertsFT] = useState<any | null>(null);

  // Formulario Nueva Operación Comex
  const [ftPartyId, setFtPartyId] = useState("");
  const [ftOperationType, setFtOperationType] = useState<"exportacion" | "importacion">("exportacion");
  const [ftCountryCode, setFtCountryCode] = useState("");
  const [ftDusNumber, setFtDusNumber] = useState("");
  const [ftBookingNumber, setFtBookingNumber] = useState("");
  const [ftDispatchNoteId, setFtDispatchNoteId] = useState("");
  const [ftNotes, setFtNotes] = useState("");

  // Certificado Inicial Opcional
  const [ftAddInitialCert, setFtAddInitialCert] = useState(false);
  const [ftCertType, setFtCertType] = useState("Fitosanitario SAG");
  const [ftCertNumber, setFtCertNumber] = useState("");
  const [ftCertIssuer, setFtCertIssuer] = useState("SAG");
  const [ftCertValidUntil, setFtCertValidUntil] = useState("");

  // Sub-formulario Agregar Certificado en Modal de Certificados
  const [newCertType, setNewCertType] = useState("Fitosanitario SAG");
  const [newCertNumber, setNewCertNumber] = useState("");
  const [newCertIssuer, setNewCertIssuer] = useState("SAG");
  const [newCertValidUntil, setNewCertValidUntil] = useState("");

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------
  // 1. Clientes 3PL
  const parties3plQuery = useQuery({
    queryKey: ["parties_3pl", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("parties")
        .select("*")
        .eq("entity_id", activeEntityId)
        .eq("is_3pl_client", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeEntityId,
  });

  // 2. Bodegas de la empresa
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

  // 3. Relación party_warehouses
  const partyWarehousesQuery = useQuery({
    queryKey: ["party_warehouses", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("party_warehouses" as any)
        .select("*, warehouses(id, code, name)");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!activeEntityId,
  });

  // 4. Ítems para líneas de carga
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

  // 5. Guías de Despacho
  const dispatchNotesQuery = useQuery({
    queryKey: ["dispatch_notes", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("dispatch_notes" as any)
        .select(
          `
          *,
          parties (id, name, tax_id),
          warehouses (id, code, name),
          dispatch_note_lines (
            id,
            qty,
            uom,
            weight_kg,
            volume_m3,
            unit_value,
            items (id, code, name)
          )
        `
        )
        .eq("entity_id", activeEntityId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!activeEntityId,
  });

  // 6. Operaciones de Comercio Exterior (SICEX)
  const foreignTradeQuery = useQuery({
    queryKey: ["foreign_trade_operations", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("foreign_trade_operations" as any)
        .select(
          `
          *,
          parties (id, name, tax_id, is_3pl_client),
          dispatch_notes (id, dispatch_number, destination_address, transfer_type, departure_at),
          foreign_trade_certificates (*)
        `
        )
        .eq("entity_id", activeEntityId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!activeEntityId,
  });

  const parties3pl = parties3plQuery.data ?? [];
  const warehouses = warehousesQuery.data ?? [];
  const partyWarehouses = partyWarehousesQuery.data ?? [];
  const items = itemsQuery.data ?? [];
  const dispatchNotes = dispatchNotesQuery.data ?? [];
  const foreignTradeOps = foreignTradeQuery.data ?? [];

  // Filtrar bodegas disponibles según el cliente seleccionado
  const clientAuthorizedWarehouses = warehouses.filter((w) => {
    if (!partyId) return true;
    const assignments = partyWarehouses.filter((pw) => pw.party_id === partyId);
    if (assignments.length === 0) return true;
    return assignments.some((pw) => pw.warehouse_id === w.id);
  });

  // --------------------------------------------------------------------------
  // Mutations: Guía de Despacho
  // --------------------------------------------------------------------------
  const createDispatchMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Debes seleccionar una empresa");
      if (!partyId) throw new Error("Debes seleccionar el cliente 3PL dueño de la carga");
      if (!warehouseId) throw new Error("Debes seleccionar la bodega de despacho");
      if (!originAddress.trim()) throw new Error("La dirección de origen es obligatoria (Res. 154)");
      if (!destinationAddress.trim()) throw new Error("La dirección de destino es obligatoria (Res. 154)");
      if (!carrierName.trim()) throw new Error("El nombre o razón social del transportista es obligatorio (Res. 154)");
      if (!carrierTaxId.trim()) throw new Error("El RUT del transportista es obligatorio (Res. 154)");
      if (!vehiclePlate.trim()) throw new Error("La patente del vehículo es obligatoria (Res. 154)");
      if (!departureAt) throw new Error("La fecha y hora de salida es obligatoria (Res. 154)");

      const validLines = lines.filter((l) => l.item_id && l.qty > 0);
      if (validLines.length === 0) {
        throw new Error("Debes ingresar al menos un ítem con cantidad mayor a 0");
      }

      const { data: note, error: noteError } = await supabase
        .from("dispatch_notes" as any)
        .insert({
          entity_id: activeEntityId,
          party_id: partyId,
          warehouse_id: warehouseId,
          dispatch_number: dispatchNumber.trim() || null,
          transfer_type: transferType,
          origin_address: originAddress.trim(),
          destination_address: destinationAddress.trim(),
          carrier_name: carrierName.trim(),
          carrier_tax_id: carrierTaxId.trim(),
          vehicle_plate: vehiclePlate.trim().toUpperCase(),
          departure_at: new Date(departureAt).toISOString(),
          arrival_at: arrivalAt ? new Date(arrivalAt).toISOString() : null,
          status: "draft",
          notes: notes.trim() || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (noteError) throw noteError;

      const linesToInsert = validLines.map((l) => ({
        dispatch_note_id: (note as any).id,
        item_id: l.item_id,
        qty: Number(l.qty),
        uom: l.uom || "UN",
        weight_kg: Number(l.weight_kg || 0),
        volume_m3: Number(l.volume_m3 || 0),
        unit_value: Number(l.unit_value || 0),
      }));

      const { error: linesError } = await supabase
        .from("dispatch_note_lines" as any)
        .insert(linesToInsert);

      if (linesError) throw linesError;

      return note;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispatch_notes", activeEntityId] });
      toast.success("Guía de Despacho creada exitosamente en estado Borrador (Draft)");
      setNewDispatchOpen(false);
      resetDispatchForm();
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al crear la Guía de Despacho");
    },
  });

  const resetDispatchForm = () => {
    setPartyId("");
    setWarehouseId("");
    setDispatchNumber("");
    setTransferType("venta");
    setOriginAddress("");
    setDestinationAddress("");
    setCarrierName("");
    setCarrierTaxId("");
    setVehiclePlate("");
    setNotes("");
    setLines([
      {
        item_id: "",
        qty: 1,
        uom: "UN",
        weight_kg: 0,
        volume_m3: 0,
        unit_value: 0,
      },
    ]);
  };

  const handleAddLine = () => {
    setLines([
      ...lines,
      {
        item_id: "",
        qty: 1,
        uom: "UN",
        weight_kg: 0,
        volume_m3: 0,
        unit_value: 0,
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length === 1) {
      toast.info("Debe haber al menos una línea");
      return;
    }
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof DispatchLineDraft, value: any) => {
    const updated = [...lines];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setLines(updated);
  };

  // --------------------------------------------------------------------------
  // Mutations: Comercio Exterior (SICEX)
  // --------------------------------------------------------------------------
  const createFTMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Debes seleccionar una empresa");
      if (!ftPartyId) throw new Error("Debes seleccionar el cliente 3PL");
      if (!ftOperationType) throw new Error("Debes especificar el tipo de operación");

      // 1. Insertar foreign_trade_operations
      const { data: op, error: opError } = await supabase
        .from("foreign_trade_operations" as any)
        .insert({
          entity_id: activeEntityId,
          party_id: ftPartyId,
          operation_type: ftOperationType,
          country_code: ftCountryCode.trim().toUpperCase() || null,
          dus_number: ftDusNumber.trim() || null,
          booking_number: ftBookingNumber.trim() || null,
          dispatch_note_id: ftDispatchNoteId || null,
          notes: ftNotes.trim() || null,
          customs_status: "pendiente", // Siempre inicia pendiente (sin conexión real SICEX)
          created_by: user?.id,
        })
        .select()
        .single();

      if (opError) throw opError;

      // 2. Si se solicitó adjuntar un certificado inicial
      if (ftAddInitialCert && ftCertType.trim()) {
        const { error: certError } = await supabase
          .from("foreign_trade_certificates" as any)
          .insert({
            operation_id: (op as any).id,
            certificate_type: ftCertType.trim(),
            certificate_number: ftCertNumber.trim() || null,
            issued_by: ftCertIssuer.trim() || null,
            valid_until: ftCertValidUntil || null,
          });

        if (certError) {
          console.error("Error adjuntando certificado inicial:", certError);
        }
      }

      return op;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foreign_trade_operations", activeEntityId] });
      toast.success("Operación de Comercio Exterior registrada exitosamente en estado Pendiente");
      setNewFTOpen(false);
      resetFTForm();
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al registrar la Operación de Comercio Exterior");
    },
  });

  const resetFTForm = () => {
    setFtPartyId("");
    setFtOperationType("exportacion");
    setFtCountryCode("");
    setFtDusNumber("");
    setFtBookingNumber("");
    setFtDispatchNoteId("");
    setFtNotes("");
    setFtAddInitialCert(false);
    setFtCertType("Fitosanitario SAG");
    setFtCertNumber("");
    setFtCertIssuer("SAG");
    setFtCertValidUntil("");
  };

  // Agregar Certificado a una operación existente
  const addCertificateMutation = useMutation({
    mutationFn: async () => {
      if (!manageCertsFT) throw new Error("No hay operación Comex seleccionada");
      if (!newCertType.trim()) throw new Error("Debes indicar el tipo de certificado");

      const { data, error } = await supabase
        .from("foreign_trade_certificates" as any)
        .insert({
          operation_id: manageCertsFT.id,
          certificate_type: newCertType.trim(),
          certificate_number: newCertNumber.trim() || null,
          issued_by: newCertIssuer.trim() || null,
          valid_until: newCertValidUntil || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (newCert) => {
      queryClient.invalidateQueries({ queryKey: ["foreign_trade_operations", activeEntityId] });
      toast.success("Certificado adjuntado correctamente");
      // Actualizar estado local del modal para visualización inmediata
      if (manageCertsFT) {
        setManageCertsFT({
          ...manageCertsFT,
          foreign_trade_certificates: [
            ...(manageCertsFT.foreign_trade_certificates || []),
            newCert,
          ],
        });
      }
      setNewCertType("Fitosanitario SAG");
      setNewCertNumber("");
      setNewCertIssuer("SAG");
      setNewCertValidUntil("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al agregar el certificado");
    },
  });

  // Eliminar Certificado
  const deleteCertificateMutation = useMutation({
    mutationFn: async (certId: string) => {
      const { error } = await supabase
        .from("foreign_trade_certificates" as any)
        .delete()
        .eq("id", certId);

      if (error) throw error;
      return certId;
    },
    onSuccess: (certId) => {
      queryClient.invalidateQueries({ queryKey: ["foreign_trade_operations", activeEntityId] });
      toast.success("Certificado eliminado");
      if (manageCertsFT) {
        setManageCertsFT({
          ...manageCertsFT,
          foreign_trade_certificates: (
            manageCertsFT.foreign_trade_certificates || []
          ).filter((c: any) => c.id !== certId),
        });
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al eliminar certificado");
    },
  });

  // Actualizar estado aduanero interno (sin llamada real a SICEX)
  const updateCustomsStatusMutation = useMutation({
    mutationFn: async ({ opId, status }: { opId: string; status: string }) => {
      const { error } = await supabase
        .from("foreign_trade_operations" as any)
        .update({
          customs_status: status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", opId);

      if (error) throw error;
      return { opId, status };
    },
    onSuccess: ({ status }) => {
      queryClient.invalidateQueries({ queryKey: ["foreign_trade_operations", activeEntityId] });
      toast.success(`Estado aduanero actualizado a "${status}"`);
      if (viewFT) {
        setViewFT({
          ...viewFT,
          customs_status: status,
        });
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al actualizar estado aduanero");
    },
  });

  // --------------------------------------------------------------------------
  // KPIs: Guías de Despacho
  // --------------------------------------------------------------------------
  const totalNotes = dispatchNotes.length;
  const draftNotesCount = dispatchNotes.filter((d) => d.status === "draft").length;
  const totalWeightKg = dispatchNotes.reduce((sum, d) => {
    const noteWeight = (d.dispatch_note_lines || []).reduce(
      (s: number, l: any) => s + Number(l.weight_kg || 0) * Number(l.qty || 1),
      0
    );
    return sum + noteWeight;
  }, 0);
  const totalVolumeM3 = dispatchNotes.reduce((sum, d) => {
    const noteVol = (d.dispatch_note_lines || []).reduce(
      (s: number, l: any) => s + Number(l.volume_m3 || 0) * Number(l.qty || 1),
      0
    );
    return sum + noteVol;
  }, 0);

  // Filtrado de la tabla de Guías
  const filteredNotes = dispatchNotes.filter((n) => {
    const matchSearch =
      n.carrier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.vehicle_plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.dispatch_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.parties?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchParty = filterParty === "ALL" || n.party_id === filterParty;
    const matchType = filterType === "ALL" || n.transfer_type === filterType;

    return matchSearch && matchParty && matchType;
  });

  // --------------------------------------------------------------------------
  // KPIs: Comercio Exterior (SICEX)
  // --------------------------------------------------------------------------
  const totalFTOps = foreignTradeOps.length;
  const totalFTExports = foreignTradeOps.filter((o) => o.operation_type === "exportacion").length;
  const totalFTImports = foreignTradeOps.filter((o) => o.operation_type === "importacion").length;
  const pendingCustomsCount = foreignTradeOps.filter((o) => o.customs_status === "pendiente").length;
  const totalCertsCount = foreignTradeOps.reduce(
    (sum, o) => sum + (o.foreign_trade_certificates?.length || 0),
    0
  );
  const totalFTWithDispatch = foreignTradeOps.filter((o) => !!o.dispatch_note_id).length;

  // Filtrado de la tabla de Comercio Exterior
  const filteredFTOps = foreignTradeOps.filter((op) => {
    const matchSearch =
      op.dus_number?.toLowerCase().includes(ftSearchTerm.toLowerCase()) ||
      op.booking_number?.toLowerCase().includes(ftSearchTerm.toLowerCase()) ||
      op.country_code?.toLowerCase().includes(ftSearchTerm.toLowerCase()) ||
      op.parties?.name?.toLowerCase().includes(ftSearchTerm.toLowerCase());

    const matchParty = ftFilterParty === "ALL" || op.party_id === ftFilterParty;
    const matchType = ftFilterType === "ALL" || op.operation_type === ftFilterType;
    const matchStatus = ftFilterStatus === "ALL" || op.customs_status === ftFilterStatus;

    return matchSearch && matchParty && matchType && matchStatus;
  });

  return (
    <div className="container mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Guías de Despacho y Logística 3PL</h1>
                <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                  Res. 154 SII
                </Badge>
                <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30">
                  SICEX Aduanas
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Control de traslados, carga de clientes 3PL, cumplimiento Res. Ex. N°154 SII y gestión aduanera de comercio exterior.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Principales: Guías de Despacho vs Comercio Exterior (SICEX) */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "dispatch_notes" | "foreign_trade")}
        className="space-y-6"
      >
        <div className="border-b pb-2">
          <TabsList className="grid w-full sm:w-[500px] grid-cols-2">
            <TabsTrigger value="dispatch_notes" className="gap-2">
              <Truck className="h-4 w-4" />
              Guías de Despacho (Res. 154)
            </TabsTrigger>
            <TabsTrigger value="foreign_trade" className="gap-2">
              <Globe className="h-4 w-4" />
              Comercio Exterior (SICEX)
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ================================================================== */}
        {/* TAB 1: GUÍAS DE DESPACHO (RES. 154)                                 */}
        {/* ================================================================== */}
        <TabsContent value="dispatch_notes" className="space-y-6 m-0">
          <div className="flex justify-end">
            <Dialog open={newDispatchOpen} onOpenChange={setNewDispatchOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nueva Guía de Despacho
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-lg">
                    <Truck className="h-5 w-5 text-primary" />
                    Crear Guía de Despacho (Res. 154 SII)
                  </DialogTitle>
                  <DialogDescription>
                    Registra la salida y traslado de mercadería para clientes 3PL con todos los campos normativos del SII.
                    El documento se guardará en estado <strong>Borrador (Draft)</strong>.
                  </DialogDescription>
                </DialogHeader>

                {/* Advertencia Res 154 / DTE */}
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <span className="font-semibold">Mecánica interna Res. 154:</span> Todos los datos de transportista,
                    patente, georreferenciación y detalle físico por ítem son capturados. La emisión formal DTE (folio CAF y
                    firma electrónica ante el SII) se habilitará una vez resuelto el emisor DTE (Sprint 6/16).
                  </div>
                </div>

                <div className="space-y-4 py-2">
                  {/* 1. Cliente 3PL y Bodega */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 text-primary" />
                        Cliente 3PL (Dueño de la carga) *
                      </Label>
                      {parties3pl.length === 0 ? (
                        <div className="text-xs text-amber-600 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                          No hay clientes marcados como "Cliente 3PL". Ve a{" "}
                          <Link to="/setup" className="underline font-semibold">
                            Configuración → Terceros
                          </Link>{" "}
                          para habilitar un cliente 3PL.
                        </div>
                      ) : (
                        <Select value={partyId} onValueChange={setPartyId}>
                          <SelectTrigger className="text-xs">
                            <SelectValue placeholder="Seleccionar cliente 3PL..." />
                          </SelectTrigger>
                          <SelectContent>
                            {parties3pl.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} ({p.tax_id || "Sin RUT"})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5 text-primary" />
                        Bodega de Despacho (Origen) *
                      </Label>
                      <Select value={warehouseId} onValueChange={setWarehouseId}>
                        <SelectTrigger className="text-xs">
                          <SelectValue placeholder="Seleccionar bodega origen..." />
                        </SelectTrigger>
                        <SelectContent>
                          {clientAuthorizedWarehouses.map((w) => (
                            <SelectItem key={w.id} value={w.id}>
                              {w.code} - {w.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* 2. Folio y Tipo de Traslado */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Folio / Número Interno (Opcional)</Label>
                      <Input
                        placeholder="Ej: GD-0001 (Automático si se deja vacío)"
                        value={dispatchNumber}
                        onChange={(e) => setDispatchNumber(e.target.value)}
                        className="text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Tipo de Traslado (Res. 154 SII) *</Label>
                      <Select value={transferType} onValueChange={setTransferType}>
                        <SelectTrigger className="text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="venta">1 - Operación Constituye Venta</SelectItem>
                          <SelectItem value="traslado_interno">2 - Traslado Interno (No Venta)</SelectItem>
                          <SelectItem value="consignacion">3 - Entrega en Consignación</SelectItem>
                          <SelectItem value="exportacion">4 - Traslado para Exportación</SelectItem>
                          <SelectItem value="otro">5 - Otro Traslado no Venta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* 3. Direcciones Res 154 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        Dirección de Origen (Res. 154) *
                      </Label>
                      <Input
                        placeholder="Av. Los Parques 450, Galpón 4, Pudahuel"
                        value={originAddress}
                        onChange={(e) => setOriginAddress(e.target.value)}
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        Dirección de Destino (Res. 154) *
                      </Label>
                      <Input
                        placeholder="Calle Comercio 1234, Santiago Centro"
                        value={destinationAddress}
                        onChange={(e) => setDestinationAddress(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>

                  {/* 4. Datos del Transportista y Vehículo (Res 154) */}
                  <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Truck className="h-4 w-4 text-primary" />
                      Identificación del Transportista y Vehículo (Obligatorio Res. 154 SII)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Nombre / Razón Social Transportista *</Label>
                        <Input
                          placeholder="Transportes Rápidos SpA"
                          value={carrierName}
                          onChange={(e) => setCarrierName(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">RUT Transportista *</Label>
                        <Input
                          placeholder="76.123.456-7"
                          value={carrierTaxId}
                          onChange={(e) => setCarrierTaxId(e.target.value)}
                          className="text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Patente del Vehículo *</Label>
                        <Input
                          placeholder="ABCD-12"
                          value={vehiclePlate}
                          onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                          className="text-xs font-mono uppercase"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1">
                        <Label className="text-[11px] flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Fecha y Hora de Salida *
                        </Label>
                        <Input
                          type="datetime-local"
                          value={departureAt}
                          onChange={(e) => setDepartureAt(e.target.value)}
                          className="text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Fecha y Hora Estimada Llegada
                        </Label>
                        <Input
                          type="datetime-local"
                          value={arrivalAt}
                          onChange={(e) => setArrivalAt(e.target.value)}
                          className="text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 5. Líneas de Carga */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        <Box className="h-4 w-4 text-primary" />
                        Detalle de Mercadería / Carga Despachada (Res. 154)
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddLine}
                        className="h-7 text-xs gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Agregar Ítem
                      </Button>
                    </div>

                    <div className="border rounded-md overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs">
                            <TableHead className="min-w-[180px]">Artículo / SKU *</TableHead>
                            <TableHead className="w-[100px]">Cantidad *</TableHead>
                            <TableHead className="w-[80px]">Unidad</TableHead>
                            <TableHead className="w-[100px]">Peso (kg)</TableHead>
                            <TableHead className="w-[100px]">Vol. (m³)</TableHead>
                            <TableHead className="w-[110px]">Val. Unit ($)</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lines.map((line, index) => (
                            <TableRow key={index} className="text-xs">
                              <TableCell className="p-2">
                                <Select
                                  value={line.item_id}
                                  onValueChange={(val) => handleLineChange(index, "item_id", val)}
                                >
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue placeholder="Seleccionar ítem..." />
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
                                  type="number"
                                  min="0.01"
                                  step="any"
                                  value={line.qty}
                                  onChange={(e) => handleLineChange(index, "qty", parseFloat(e.target.value) || 0)}
                                  className="h-7 text-xs text-right font-mono"
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <Input
                                  value={line.uom}
                                  onChange={(e) => handleLineChange(index, "uom", e.target.value.toUpperCase())}
                                  placeholder="UN"
                                  className="h-7 text-xs text-center font-mono"
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <Input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={line.weight_kg}
                                  onChange={(e) =>
                                    handleLineChange(index, "weight_kg", parseFloat(e.target.value) || 0)
                                  }
                                  placeholder="0.0"
                                  className="h-7 text-xs text-right font-mono"
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <Input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={line.volume_m3}
                                  onChange={(e) =>
                                    handleLineChange(index, "volume_m3", parseFloat(e.target.value) || 0)
                                  }
                                  placeholder="0.0"
                                  className="h-7 text-xs text-right font-mono"
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <Input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={line.unit_value}
                                  onChange={(e) =>
                                    handleLineChange(index, "unit_value", parseFloat(e.target.value) || 0)
                                  }
                                  placeholder="0"
                                  className="h-7 text-xs text-right font-mono"
                                />
                              </TableCell>
                              <TableCell className="p-2 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveLine(index)}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
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

                  {/* 6. Observaciones */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Observaciones / Instrucciones de Entrega</Label>
                    <Textarea
                      placeholder="Instrucciones al transportista, sellos de seguridad, condiciones de temperatura, etc."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="text-xs"
                    />
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="outline" size="sm" onClick={() => setNewDispatchOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => createDispatchMutation.mutate()}
                    disabled={createDispatchMutation.isPending || !partyId || !warehouseId}
                  >
                    {createDispatchMutation.isPending ? "Guardando..." : "Guardar Guía (Borrador)"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* KPI Cards Guías */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total Guías 3PL</CardTitle>
                <Truck className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{totalNotes}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {draftNotesCount} en estado Borrador (Draft)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground">Clientes 3PL Activos</CardTitle>
                <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{parties3pl.length}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Con mercadería en custodia</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground">Peso Despachado (Total)</CardTitle>
                <Scale className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold font-mono">
                  {totalWeightKg.toLocaleString("es-CL", { maximumFractionDigits: 1 })} kg
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Peso total reportado Res. 154</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground">Volumen Despachado (Total)</CardTitle>
                <Box className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold font-mono">
                  {totalVolumeM3.toLocaleString("es-CL", { maximumFractionDigits: 2 })} m³
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Capacidad volumétrica trasladada</p>
              </CardContent>
            </Card>
          </div>

          {/* Banner Res 154 */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">
                  Resolución Exenta N° 154 del SII (Vigente 1 de noviembre de 2026):
                </span>{" "}
                <span className="text-muted-foreground">
                  Este módulo registra de forma obligatoria las direcciones de origen y destino, identificación del
                  transportista (Nombre y RUT), patente vehicular, hora de salida y detalle métrico por ítem. Los
                  documentos quedan en borrador interno a la espera de la integración del motor de firma DTE.
                </span>
              </div>
            </div>
          </div>

          {/* Tabla de Guías de Despacho */}
          <Card>
            <CardHeader className="p-4 border-b">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-semibold">Registro de Guías de Despacho 3PL</CardTitle>
                  <CardDescription className="text-xs">
                    Historial de despachos y traslados de mercadería en custodia por cliente y transportista.
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-full sm:w-[220px]">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar patente, chofer, guía..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 text-xs h-8"
                    />
                  </div>

                  <Select value={filterParty} onValueChange={setFilterParty}>
                    <SelectTrigger className="w-[180px] h-8 text-xs">
                      <SelectValue placeholder="Todos los clientes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos los clientes 3PL</SelectItem>
                      {parties3pl.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-[150px] h-8 text-xs">
                      <SelectValue placeholder="Tipo de traslado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos los tipos</SelectItem>
                      <SelectItem value="venta">Venta</SelectItem>
                      <SelectItem value="traslado_interno">Traslado Interno</SelectItem>
                      <SelectItem value="consignacion">Consignación</SelectItem>
                      <SelectItem value="exportacion">Exportación</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {filteredNotes.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground space-y-3">
                  <Truck className="mx-auto h-10 w-10 opacity-40" />
                  <div>
                    <p className="text-sm font-medium">No se encontraron Guías de Despacho</p>
                    <p className="text-xs text-muted-foreground">
                      Registra la primera guía usando el botón "Nueva Guía de Despacho".
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setNewDispatchOpen(true)}>
                    Crear primera guía
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead className="w-[110px]">Folio / N°</TableHead>
                        <TableHead>Cliente 3PL</TableHead>
                        <TableHead>Bodega</TableHead>
                        <TableHead>Tipo Traslado</TableHead>
                        <TableHead>Transportista & Patente</TableHead>
                        <TableHead>Salida / Destino</TableHead>
                        <TableHead className="text-center">Líneas</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                        <TableHead className="w-[60px] text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredNotes.map((note) => {
                        const linesCount = note.dispatch_note_lines?.length || 0;
                        return (
                          <TableRow key={note.id} className="text-xs hover:bg-muted/30">
                            <TableCell className="font-mono font-medium text-primary">
                              {note.dispatch_number || "BORRADOR"}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-foreground">{note.parties?.name}</div>
                              <div className="text-[11px] text-muted-foreground font-mono">{note.parties?.tax_id}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">
                                {note.warehouses?.code}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className="capitalize text-[10px] font-normal"
                              >
                                {note.transfer_type?.replace("_", " ")}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{note.carrier_name}</div>
                              <div className="text-[11px] text-muted-foreground font-mono">
                                {note.carrier_tax_id} • Patente:{" "}
                                <span className="font-bold text-foreground">{note.vehicle_plate}</span>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[220px]">
                              <div className="truncate text-muted-foreground" title={note.destination_address}>
                                Hacia: {note.destination_address}
                              </div>
                              <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Clock className="h-3 w-3" />
                                {new Date(note.departure_at).toLocaleString("es-CL", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-mono">
                              <Badge variant="outline" className="text-[10px]">
                                {linesCount} {linesCount === 1 ? "ítem" : "ítems"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant={
                                  note.status === "issued"
                                    ? "default"
                                    : note.status === "cancelled"
                                    ? "destructive"
                                    : "secondary"
                                }
                                className="text-[10px] uppercase font-mono"
                              >
                                {note.status === "draft" ? "Borrador" : note.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => setViewDispatch(note)}
                                title="Ver detalle de la guía"
                              >
                                <Eye className="h-3.5 w-3.5 text-primary" />
                              </Button>
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

        {/* ================================================================== */}
        {/* TAB 2: COMERCIO EXTERIOR (SICEX)                                   */}
        {/* ================================================================== */}
        <TabsContent value="foreign_trade" className="space-y-6 m-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Operaciones de Comercio Exterior — SICEX
              </h2>
              <p className="text-xs text-muted-foreground">
                Gestión de DUS/DIN aduaneros, certificados fito/zoosanitarios y de origen para clientes 3PL.
              </p>
            </div>

            <Dialog open={newFTOpen} onOpenChange={setNewFTOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nueva Operación Comex
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-base">
                    <Globe className="h-5 w-5 text-primary" />
                    Registrar Operación de Comercio Exterior (SICEX)
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Crea una carpeta de comercio exterior vinculada a un cliente 3PL y opcionalmente a una Guía de Despacho existente.
                  </DialogDescription>
                </DialogHeader>

                {/* Banner Advertencia SICEX */}
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <span className="font-semibold">Mecánica interna y estado normativo:</span> Toda operación se
                    crea en estado <strong>Pendiente</strong>. La tramitación real con Aduanas de Chile requiere que
                    la empresa tramite la autorización de usuario y certificado digital en el portal SICEX.
                  </div>
                </div>

                <div className="space-y-4 py-2">
                  {/* Cliente 3PL y Tipo de Operación */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 text-primary" />
                        Cliente 3PL Propietario *
                      </Label>
                      {parties3pl.length === 0 ? (
                        <div className="text-xs text-amber-600 bg-amber-500/10 p-2 rounded">
                          No hay clientes 3PL configurados.
                        </div>
                      ) : (
                        <Select value={ftPartyId} onValueChange={setFtPartyId}>
                          <SelectTrigger className="text-xs">
                            <SelectValue placeholder="Seleccionar cliente 3PL..." />
                          </SelectTrigger>
                          <SelectContent>
                            {parties3pl.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} ({p.tax_id || "Sin RUT"})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold flex items-center gap-1">
                        <Globe className="h-3.5 w-3.5 text-primary" />
                        Tipo de Operación *
                      </Label>
                      <Select
                        value={ftOperationType}
                        onValueChange={(val) => setFtOperationType(val as "exportacion" | "importacion")}
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="exportacion">Exportación (Salida de Chile / DUS)</SelectItem>
                          <SelectItem value="importacion">Importación (Ingreso a Chile / DIN)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* País y N° DUS / DIN */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">
                        País de {ftOperationType === "exportacion" ? "Destino" : "Origen"} (Código o Nombre)
                      </Label>
                      <Input
                        placeholder="Ej: Estados Unidos (US), China (CN), Brasil (BR)"
                        value={ftCountryCode}
                        onChange={(e) => setFtCountryCode(e.target.value)}
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">
                        N° DUS / DIN (Documento Aduanero)
                      </Label>
                      <Input
                        placeholder="Ej: DUS-2026-987456"
                        value={ftDusNumber}
                        onChange={(e) => setFtDusNumber(e.target.value)}
                        className="text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* N° Booking / BL y Guía de Despacho Opcional */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">N° Booking / Bill of Lading (BL) / Carta de Porte</Label>
                      <Input
                        placeholder="Ej: MAEU-987654321 / LA-045-88"
                        value={ftBookingNumber}
                        onChange={(e) => setFtBookingNumber(e.target.value)}
                        className="text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1">
                        <Truck className="h-3.5 w-3.5 text-primary" />
                        Vincular Guía de Despacho (Opcional)
                      </Label>
                      <Select value={ftDispatchNoteId} onValueChange={setFtDispatchNoteId}>
                        <SelectTrigger className="text-xs">
                          <SelectValue placeholder="Seleccionar guía de despacho..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">-- Sin vincular a guía --</SelectItem>
                          {dispatchNotes
                            .filter((dn) => !ftPartyId || dn.party_id === ftPartyId)
                            .map((dn) => (
                              <SelectItem key={dn.id} value={dn.id}>
                                {dn.dispatch_number || "Guía Borrador"} • Hacia: {dn.destination_address?.slice(0, 30)}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Observaciones */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Observaciones de la Operación</Label>
                    <Textarea
                      placeholder="Agencia de aduanas, puerto de embarque/desembarque, condiciones especiales..."
                      value={ftNotes}
                      onChange={(e) => setFtNotes(e.target.value)}
                      rows={2}
                      className="text-xs"
                    />
                  </div>

                  {/* Certificado Inicial Opcional */}
                  <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        Adjuntar Certificado Inicial (Opcional)
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFtAddInitialCert(!ftAddInitialCert)}
                        className="h-6 text-xs text-primary"
                      >
                        {ftAddInitialCert ? "Quitar certificado" : "+ Añadir certificado"}
                      </Button>
                    </div>

                    {ftAddInitialCert && (
                      <div className="space-y-3 pt-2 border-t">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[11px]">Tipo de Certificado *</Label>
                            <Select value={ftCertType} onValueChange={setFtCertType}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Fitosanitario SAG">Fitosanitario (SAG)</SelectItem>
                                <SelectItem value="Zoosanitario SAG/SERNAPESCA">Zoosanitario (SAG/SERNAPESCA)</SelectItem>
                                <SelectItem value="Certificado de Origen">Certificado de Origen (SOFOFA / C. Comercio)</SelectItem>
                                <SelectItem value="Certificado ISP">Certificado de Registro / Uso (ISP)</SelectItem>
                                <SelectItem value="Certificado Libre Venta">Certificado de Libre Venta</SelectItem>
                                <SelectItem value="Otro">Otro Certificado</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px]">N° Certificado</Label>
                            <Input
                              placeholder="Ej: SAG-CL-2026-0045"
                              value={ftCertNumber}
                              onChange={(e) => setFtCertNumber(e.target.value)}
                              className="h-8 text-xs font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[11px]">Entidad Emisora</Label>
                            <Input
                              placeholder="Ej: SAG, SERNAPESCA, SOFOFA"
                              value={ftCertIssuer}
                              onChange={(e) => setFtCertIssuer(e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px]">Fecha de Vigencia / Vencimiento</Label>
                            <Input
                              type="date"
                              value={ftCertValidUntil}
                              onChange={(e) => setFtCertValidUntil(e.target.value)}
                              className="h-8 text-xs font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="outline" size="sm" onClick={() => setNewFTOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => createFTMutation.mutate()}
                    disabled={createFTMutation.isPending || !ftPartyId}
                  >
                    {createFTMutation.isPending ? "Guardando..." : "Guardar Operación (Pendiente)"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* KPI Cards Comercio Exterior */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total Operaciones Comex</CardTitle>
                <Globe className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{totalFTOps}</div>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
                    <ArrowUpRight className="h-3 w-3" />
                    {totalFTExports} Export.
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400 font-medium">
                    <ArrowDownLeft className="h-3 w-3" />
                    {totalFTImports} Import.
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground">Pendientes SICEX</CardTitle>
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {pendingCustomsCount}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  A la espera de autorización aduanera
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground">Certificados Registrados</CardTitle>
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold font-mono">{totalCertsCount}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  SAG, SERNAPESCA, ISP y Origen
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground">Guías Vinculadas</CardTitle>
                <Truck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold font-mono">{totalFTWithDispatch}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Despachos asociados a trámite aduanero
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Banner de Estado Normativo SICEX */}
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <Globe className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">
                  Preparado para conexión SICEX (Aduanas de Chile):
                </span>{" "}
                <span className="text-muted-foreground">
                  Este módulo administra las carpetas de comercio exterior (DUS / DIN), vinculación con Guías de Despacho Res. 154 y certificados sanitarios. Toda operación permanece en estado <strong>Pendiente</strong> internamente. La conexión real con el webservice de Aduanas se habilitará tras la acreditación institucional.
                </span>
              </div>
            </div>
          </div>

          {/* Tabla de Operaciones de Comercio Exterior */}
          <Card>
            <CardHeader className="p-4 border-b">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-semibold">Carpetas de Comercio Exterior</CardTitle>
                  <CardDescription className="text-xs">
                    Listado de operaciones de importación y exportación, documentos aduaneros y certificados adjuntos.
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-full sm:w-[220px]">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar DUS, país, cliente..."
                      value={ftSearchTerm}
                      onChange={(e) => setFtSearchTerm(e.target.value)}
                      className="pl-8 text-xs h-8"
                    />
                  </div>

                  <Select value={ftFilterParty} onValueChange={setFtFilterParty}>
                    <SelectTrigger className="w-[170px] h-8 text-xs">
                      <SelectValue placeholder="Todos los clientes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos los clientes 3PL</SelectItem>
                      {parties3pl.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={ftFilterType} onValueChange={setFtFilterType}>
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <SelectValue placeholder="Tipo Operación" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos los tipos</SelectItem>
                      <SelectItem value="exportacion">Exportación</SelectItem>
                      <SelectItem value="importacion">Importación</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={ftFilterStatus} onValueChange={setFtFilterStatus}>
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <SelectValue placeholder="Estado SICEX" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos los estados</SelectItem>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="tramitando">Tramitando</SelectItem>
                      <SelectItem value="autorizado">Autorizado</SelectItem>
                      <SelectItem value="rechazado">Rechazado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {filteredFTOps.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground space-y-3">
                  <Globe className="mx-auto h-10 w-10 opacity-40 text-primary" />
                  <div>
                    <p className="text-sm font-medium">No se encontraron Operaciones de Comercio Exterior</p>
                    <p className="text-xs text-muted-foreground">
                      Registra una nueva operación de exportación o importación para clientes 3PL.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setNewFTOpen(true)}>
                    Registrar primera operación
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead className="w-[130px]">N° DUS / DIN</TableHead>
                        <TableHead className="w-[110px]">Tipo</TableHead>
                        <TableHead>Cliente 3PL</TableHead>
                        <TableHead>País Destino / Origen</TableHead>
                        <TableHead>Guía Vinculada</TableHead>
                        <TableHead className="text-center">Certificados</TableHead>
                        <TableHead className="text-center">Estado SICEX</TableHead>
                        <TableHead className="w-[110px] text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFTOps.map((op) => {
                        const certsCount = op.foreign_trade_certificates?.length || 0;
                        const isExport = op.operation_type === "exportacion";

                        return (
                          <TableRow key={op.id} className="text-xs hover:bg-muted/30">
                            <TableCell className="font-mono font-medium text-primary">
                              {op.dus_number || "SIN DUS"}
                              {op.booking_number && (
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  BL: {op.booking_number}
                                </div>
                              )}
                            </TableCell>

                            <TableCell>
                              <Badge
                                variant={isExport ? "default" : "secondary"}
                                className={`text-[10px] uppercase font-mono flex items-center gap-1 w-fit ${
                                  isExport
                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                    : "bg-blue-600 hover:bg-blue-700 text-white"
                                }`}
                              >
                                {isExport ? (
                                  <>
                                    <ArrowUpRight className="h-3 w-3" />
                                    Export
                                  </>
                                ) : (
                                  <>
                                    <ArrowDownLeft className="h-3 w-3" />
                                    Import
                                  </>
                                )}
                              </Badge>
                            </TableCell>

                            <TableCell>
                              <div className="font-medium text-foreground">{op.parties?.name}</div>
                              <div className="text-[11px] text-muted-foreground font-mono">
                                {op.parties?.tax_id || "Sin RUT"}
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="font-medium">
                                {op.country_code || "No especificado"}
                              </div>
                            </TableCell>

                            <TableCell>
                              {op.dispatch_notes ? (
                                <Badge variant="outline" className="text-[10px] font-mono gap-1 text-primary">
                                  <Truck className="h-3 w-3" />
                                  {op.dispatch_notes.dispatch_number || "Guía"}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-[11px]">— Sin guía —</span>
                              )}
                            </TableCell>

                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setManageCertsFT(op)}
                                className="h-7 text-xs gap-1.5 px-2 hover:bg-primary/10"
                                title="Ver y agregar certificados sanitarios / de origen"
                              >
                                <ShieldCheck
                                  className={`h-3.5 w-3.5 ${
                                    certsCount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                                  }`}
                                />
                                <span className="font-mono">{certsCount}</span>
                              </Button>
                            </TableCell>

                            <TableCell className="text-center">
                              <Badge
                                variant={
                                  op.customs_status === "autorizado"
                                    ? "default"
                                    : op.customs_status === "rechazado"
                                    ? "destructive"
                                    : "secondary"
                                }
                                className={`text-[10px] uppercase font-mono ${
                                  op.customs_status === "pendiente"
                                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                    : op.customs_status === "tramitando"
                                    ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30"
                                    : op.customs_status === "autorizado"
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                    : ""
                                }`}
                              >
                                {op.customs_status}
                              </Badge>
                            </TableCell>

                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => setManageCertsFT(op)}
                                  title="Gestionar certificados"
                                >
                                  <FileCheck className="h-3.5 w-3.5 text-emerald-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => setViewFT(op)}
                                  title="Ver detalle de la operación"
                                >
                                  <Eye className="h-3.5 w-3.5 text-primary" />
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
      </Tabs>

      {/* ==================================================================== */}
      {/* MODAL: Detalle de Guía de Despacho (Tab 1)                           */}
      {/* ==================================================================== */}
      <Dialog open={!!viewDispatch} onOpenChange={(open) => !open && setViewDispatch(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {viewDispatch && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="flex items-center gap-2 text-base">
                    <Truck className="h-5 w-5 text-primary" />
                    Guía de Despacho 3PL — {viewDispatch.dispatch_number || "Borrador"}
                  </DialogTitle>
                  <Badge variant="secondary" className="uppercase font-mono text-[10px]">
                    {viewDispatch.status === "draft" ? "Borrador Interno" : viewDispatch.status}
                  </Badge>
                </div>
                <DialogDescription className="text-xs">
                  Cumplimiento tributario Res. 154 SII. Creada el{" "}
                  {new Date(viewDispatch.created_at).toLocaleDateString("es-CL")}.
                </DialogDescription>
              </DialogHeader>

              {/* Bloque Transportista y Vehículo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-lg border bg-muted/20 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Cliente 3PL Propietario</span>
                  <span className="font-semibold text-foreground text-sm">{viewDispatch.parties?.name}</span>
                  <span className="text-muted-foreground block font-mono text-[11px]">
                    RUT: {viewDispatch.parties?.tax_id || "Sin RUT"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Bodega y Tipo de Traslado</span>
                  <span className="font-semibold text-foreground">
                    {viewDispatch.warehouses?.code} - {viewDispatch.warehouses?.name}
                  </span>
                  <span className="text-muted-foreground block capitalize text-[11px]">
                    Tipo: {viewDispatch.transfer_type?.replace("_", " ")}
                  </span>
                </div>
              </div>

              {/* Bloque Res 154 Transportista */}
              <div className="p-3 rounded-lg border bg-muted/20 text-xs space-y-2">
                <div className="font-semibold flex items-center gap-1.5 text-primary">
                  <Truck className="h-4 w-4" />
                  Datos de Transporte y Patente (Res. 154)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Transportista:</span>
                    <span className="font-medium text-foreground">{viewDispatch.carrier_name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">RUT Transportista:</span>
                    <span className="font-mono text-foreground">{viewDispatch.carrier_tax_id}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Patente Vehículo:</span>
                    <span className="font-mono font-bold text-foreground">{viewDispatch.vehicle_plate}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Origen:</span>
                    <span className="text-foreground">{viewDispatch.origin_address}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Destino:</span>
                    <span className="text-foreground">{viewDispatch.destination_address}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Fecha y Hora de Salida:</span>
                    <span className="font-mono text-foreground">
                      {new Date(viewDispatch.departure_at).toLocaleString("es-CL")}
                    </span>
                  </div>
                  {viewDispatch.arrival_at && (
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Fecha y Hora Estimada Llegada:</span>
                      <span className="font-mono text-foreground">
                        {new Date(viewDispatch.arrival_at).toLocaleString("es-CL")}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Detalle de Mercadería */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold">Detalle de Mercadería (Líneas de la Guía)</h4>
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead>Artículo / SKU</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-center">Unidad</TableHead>
                        <TableHead className="text-right">Peso (kg)</TableHead>
                        <TableHead className="text-right">Volumen (m³)</TableHead>
                        <TableHead className="text-right">Valor Unit ($)</TableHead>
                        <TableHead className="text-right">Subtotal ($)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(viewDispatch.dispatch_note_lines || []).map((line: any, idx: number) => {
                        const subtotal = Number(line.qty || 0) * Number(line.unit_value || 0);
                        return (
                          <TableRow key={line.id || idx} className="text-xs">
                            <TableCell>
                              <div className="font-medium text-foreground">{line.items?.name}</div>
                              <div className="font-mono text-[11px] text-muted-foreground">{line.items?.code}</div>
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold">
                              {Number(line.qty).toLocaleString("es-CL")}
                            </TableCell>
                            <TableCell className="text-center font-mono">{line.uom || "UN"}</TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {Number(line.weight_kg || 0).toLocaleString("es-CL", { maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {Number(line.volume_m3 || 0).toLocaleString("es-CL", { maximumFractionDigits: 3 })}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              ${Number(line.unit_value || 0).toLocaleString("es-CL")}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold">
                              ${subtotal.toLocaleString("es-CL")}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {viewDispatch.notes && (
                <div className="p-2.5 rounded bg-muted/30 text-xs">
                  <span className="font-semibold text-muted-foreground block text-[11px]">Observaciones:</span>
                  <p className="text-foreground mt-0.5">{viewDispatch.notes}</p>
                </div>
              )}

              <DialogFooter>
                <Button size="sm" variant="outline" onClick={() => setViewDispatch(null)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ==================================================================== */}
      {/* MODAL: Gestión de Certificados Aduaneros (Tab 2)                      */}
      {/* ==================================================================== */}
      <Dialog
        open={!!manageCertsFT}
        onOpenChange={(open) => !open && setManageCertsFT(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {manageCertsFT && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  Certificados Aduaneros y Sanitarios
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Operación: <strong className="font-mono">{manageCertsFT.dus_number || "Sin DUS"}</strong> •{" "}
                  Cliente: <strong>{manageCertsFT.parties?.name}</strong> •{" "}
                  Tipo: <span className="capitalize">{manageCertsFT.operation_type}</span>
                </DialogDescription>
              </DialogHeader>

              {/* Formulario para agregar nuevo certificado */}
              <div className="p-3 rounded-lg border bg-muted/20 space-y-3">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5 text-primary" />
                  Adjuntar Nuevo Certificado
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Tipo de Certificado *</Label>
                    <Select value={newCertType} onValueChange={setNewCertType}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Fitosanitario SAG">Fitosanitario (SAG)</SelectItem>
                        <SelectItem value="Zoosanitario SAG/SERNAPESCA">Zoosanitario (SAG/SERNAPESCA)</SelectItem>
                        <SelectItem value="Certificado de Origen">Certificado de Origen (SOFOFA)</SelectItem>
                        <SelectItem value="Certificado ISP">Certificado de Registro / Uso (ISP)</SelectItem>
                        <SelectItem value="Certificado Libre Venta">Certificado de Libre Venta</SelectItem>
                        <SelectItem value="Certificado Calidad">Certificado de Calidad / Análisis</SelectItem>
                        <SelectItem value="Otro">Otro Certificado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px]">N° Certificado</Label>
                    <Input
                      placeholder="Ej: SAG-EXP-2026-1049"
                      value={newCertNumber}
                      onChange={(e) => setNewCertNumber(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Entidad Emisora</Label>
                    <Input
                      placeholder="Ej: SAG, SERNAPESCA, ISP, SOFOFA"
                      value={newCertIssuer}
                      onChange={(e) => setNewCertIssuer(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px]">Fecha de Vigencia / Vencimiento</Label>
                    <Input
                      type="date"
                      value={newCertValidUntil}
                      onChange={(e) => setNewCertValidUntil(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    size="sm"
                    onClick={() => addCertificateMutation.mutate()}
                    disabled={addCertificateMutation.isPending || !newCertType}
                    className="h-7 text-xs gap-1.5"
                  >
                    <Plus className="h-3 w-3" />
                    {addCertificateMutation.isPending ? "Guardando..." : "Agregar Certificado"}
                  </Button>
                </div>
              </div>

              {/* Lista de Certificados Existentes */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold">Certificados Adjuntos a esta Operación</h4>
                {(manageCertsFT.foreign_trade_certificates || []).length === 0 ? (
                  <div className="py-6 text-center text-muted-foreground border rounded-lg text-xs">
                    No hay certificados adjuntos todavía. Usa el formulario superior para registrar uno.
                  </div>
                ) : (
                  <div className="border rounded-md overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead>Tipo Certificado</TableHead>
                          <TableHead>N° Documento</TableHead>
                          <TableHead>Emisor</TableHead>
                          <TableHead>Vigencia</TableHead>
                          <TableHead className="w-[50px] text-right"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(manageCertsFT.foreign_trade_certificates || []).map((c: any) => {
                          const isExpired = c.valid_until && new Date(c.valid_until) < new Date();
                          return (
                            <TableRow key={c.id} className="text-xs">
                              <TableCell className="font-medium text-foreground">
                                {c.certificate_type}
                              </TableCell>
                              <TableCell className="font-mono text-primary">
                                {c.certificate_number || "S/N"}
                              </TableCell>
                              <TableCell>{c.issued_by || "—"}</TableCell>
                              <TableCell>
                                {c.valid_until ? (
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] font-mono ${
                                      isExpired
                                        ? "text-destructive border-destructive/30 bg-destructive/10"
                                        : "text-emerald-600 border-emerald-500/30 bg-emerald-500/10"
                                    }`}
                                  >
                                    {c.valid_until} {isExpired ? "(Vencido)" : "(Vigente)"}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground text-[11px]">Indefinida</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteCertificateMutation.mutate(c.id)}
                                  disabled={deleteCertificateMutation.isPending}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button size="sm" variant="outline" onClick={() => setManageCertsFT(null)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ==================================================================== */}
      {/* MODAL: Detalle de Operación de Comercio Exterior (Tab 2)              */}
      {/* ==================================================================== */}
      <Dialog open={!!viewFT} onOpenChange={(open) => !open && setViewFT(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewFT && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="flex items-center gap-2 text-base">
                    <Globe className="h-5 w-5 text-primary" />
                    Operación Comex — {viewFT.dus_number || "Sin DUS"}
                  </DialogTitle>
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase font-mono ${
                      viewFT.customs_status === "pendiente"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                        : viewFT.customs_status === "tramitando"
                        ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30"
                        : viewFT.customs_status === "autorizado"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                        : ""
                    }`}
                  >
                    {viewFT.customs_status}
                  </Badge>
                </div>
                <DialogDescription className="text-xs">
                  Expediente aduanero de {viewFT.operation_type}. Registrado el{" "}
                  {new Date(viewFT.created_at).toLocaleDateString("es-CL")}.
                </DialogDescription>
              </DialogHeader>

              {/* Ficha Resumen */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-lg border bg-muted/20 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Cliente 3PL</span>
                  <span className="font-semibold text-foreground text-sm">{viewFT.parties?.name}</span>
                  <span className="text-muted-foreground block font-mono text-[11px]">
                    RUT: {viewFT.parties?.tax_id || "Sin RUT"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Destino / Origen</span>
                  <span className="font-semibold text-foreground">
                    {viewFT.country_code || "No informado"}
                  </span>
                  {viewFT.booking_number && (
                    <span className="text-muted-foreground block font-mono text-[11px]">
                      BL/Booking: {viewFT.booking_number}
                    </span>
                  )}
                </div>
              </div>

              {/* Guía de Despacho Vinculada */}
              {viewFT.dispatch_notes && (
                <div className="p-3 rounded-lg border bg-muted/20 text-xs space-y-1.5">
                  <div className="font-semibold flex items-center gap-1.5 text-primary">
                    <Truck className="h-4 w-4" />
                    Guía de Despacho Vinculada
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Folio Guía:</span>
                      <span className="font-mono font-medium">{viewFT.dispatch_notes.dispatch_number || "Borrador"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Destino Traslado:</span>
                      <span className="text-foreground">{viewFT.dispatch_notes.destination_address}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Certificados */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Certificados Adjuntos ({viewFT.foreign_trade_certificates?.length || 0})
                  </h4>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs"
                    onClick={() => {
                      setManageCertsFT(viewFT);
                      setViewFT(null);
                    }}
                  >
                    Gestionar certificados
                  </Button>
                </div>
                {(viewFT.foreign_trade_certificates || []).length === 0 ? (
                  <div className="p-3 text-center text-muted-foreground border rounded text-xs">
                    Sin certificados registrados en este expediente.
                  </div>
                ) : (
                  <div className="border rounded-md overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead>Tipo</TableHead>
                          <TableHead>Número</TableHead>
                          <TableHead>Emisor</TableHead>
                          <TableHead>Vigencia</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewFT.foreign_trade_certificates.map((c: any) => (
                          <TableRow key={c.id} className="text-xs">
                            <TableCell className="font-medium">{c.certificate_type}</TableCell>
                            <TableCell className="font-mono">{c.certificate_number || "S/N"}</TableCell>
                            <TableCell>{c.issued_by || "—"}</TableCell>
                            <TableCell className="font-mono text-[11px]">{c.valid_until || "Indefinida"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Control de Estado Interno */}
              <div className="p-3 rounded-lg border bg-muted/10 space-y-2">
                <span className="text-xs font-semibold block">Control de Estado Aduanero Interno:</span>
                <p className="text-[11px] text-muted-foreground">
                  Actualiza el estado interno de tramitación aduanera (no envía datos al SII ni a SICEX):
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {(["pendiente", "tramitando", "autorizado", "rechazado"] as const).map((st) => (
                    <Button
                      key={st}
                      variant={viewFT.customs_status === st ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs capitalize"
                      disabled={updateCustomsStatusMutation.isPending || viewFT.customs_status === st}
                      onClick={() =>
                        updateCustomsStatusMutation.mutate({
                          opId: viewFT.id,
                          status: st,
                        })
                      }
                    >
                      {st}
                    </Button>
                  ))}
                </div>
              </div>

              {viewFT.notes && (
                <div className="p-2.5 rounded bg-muted/30 text-xs">
                  <span className="font-semibold text-muted-foreground block text-[11px]">Observaciones:</span>
                  <p className="text-foreground mt-0.5">{viewFT.notes}</p>
                </div>
              )}

              <DialogFooter>
                <Button size="sm" variant="outline" onClick={() => setViewFT(null)}>
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
