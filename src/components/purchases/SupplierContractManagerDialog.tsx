import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { FileText, Upload, Download, Loader2, CheckCircle2, History, AlertCircle } from "lucide-react";

interface SupplierContractManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: {
    id: string;
    name: string;
    tax_id?: string | null;
    requires_contract?: boolean | null;
  } | null;
  entityId: string;
}

export function SupplierContractManagerDialog({
  open,
  onOpenChange,
  supplier,
  entityId,
}: SupplierContractManagerDialogProps) {
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  const supplierId = supplier?.id;

  // 1. Cargar historial de contratos del proveedor
  const contractsQuery = useQuery({
    queryKey: ["supplier_contracts", supplierId],
    enabled: !!supplierId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_contracts" as any)
        .select("*")
        .eq("party_id", supplierId!)
        .order("version_number", { ascending: false });

      if (error) {
        console.error("Error loading contracts:", error);
        throw error;
      }
      return (data as any[]) ?? [];
    },
  });

  const contracts = contractsQuery.data ?? [];
  const currentContract = contracts.find((c) => c.is_current);

  // 2. Mutación para alternar requires_contract
  const toggleRequiresContractMutation = useMutation({
    mutationFn: async (newValue: boolean) => {
      if (!supplierId) return;
      const { error } = await supabase
        .from("parties")
        .update({ requires_contract: newValue })
        .eq("id", supplierId);
      if (error) throw error;
    },
    onSuccess: (_, newValue) => {
      queryClient.invalidateQueries({ queryKey: ["suppliers", entityId] });
      toast.success(
        newValue
          ? "El proveedor ahora requiere contrato formal vigente."
          : "El proveedor ya no requiere contrato obligatorio."
      );
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al actualizar requisito de contrato");
    },
  });

  // 3. Subir nuevo PDF de contrato
  async function handleUploadContract(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile || !supplierId || !entityId) {
      toast.error("Seleccione un archivo PDF válido");
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
      toast.error("El archivo de contrato debe ser formato PDF");
      return;
    }

    try {
      setUploading(true);

      const timestamp = Date.now();
      const sanitizedName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${entityId}/${supplierId}/${timestamp}-${sanitizedName}`;

      // a) Subir a bucket privado 'supplier-contracts'
      const { error: uploadErr } = await supabase.storage
        .from("supplier-contracts")
        .upload(storagePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadErr) {
        throw new Error(`Error en storage: ${uploadErr.message}`);
      }

      // b) Calcular version_number
      const nextVersion = contracts.length > 0 ? Math.max(...contracts.map((c) => c.version_number)) + 1 : 1;

      // c) Marcar contratos previos con is_current = false
      if (contracts.length > 0) {
        await supabase
          .from("supplier_contracts" as any)
          .update({ is_current: false })
          .eq("party_id", supplierId);
      }

      // d) Insertar registro en supplier_contracts
      const { data: authData } = await supabase.auth.getUser();
      const { error: insertErr } = await supabase.from("supplier_contracts" as any).insert({
        entity_id: entityId,
        party_id: supplierId,
        version_number: nextVersion,
        file_path: storagePath,
        file_name: selectedFile.name,
        notes: notes.trim() || null,
        is_current: true,
        uploaded_by: authData?.user?.id || null,
      });

      if (insertErr) {
        throw insertErr;
      }

      // e) Asegurar que requires_contract = true si no lo estaba
      if (!supplier?.requires_contract) {
        await supabase
          .from("parties")
          .update({ requires_contract: true })
          .eq("id", supplierId);
      }

      toast.success(`Contrato versión v${nextVersion} subido con éxito`);
      setSelectedFile(null);
      setNotes("");
      contractsQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ["suppliers", entityId] });
    } catch (err: any) {
      console.error("Contract upload error:", err);
      toast.error(err.message || "Error al subir contrato");
    } finally {
      setUploading(false);
    }
  }

  // 4. Descargar / Ver PDF con URL firmada
  async function handleDownloadContract(filePath: string, fileName: string) {
    try {
      const { data, error } = await supabase.storage
        .from("supplier-contracts")
        .createSignedUrl(filePath, 3600);

      if (error || !data?.signedUrl) {
        throw new Error(error?.message || "No se pudo generar la URL de descarga");
      }

      window.open(data.signedUrl, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Error al abrir documento");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Gestión de Contratos — {supplier?.name}</DialogTitle>
              <DialogDescription className="text-xs">
                RUT: {supplier?.tax_id || "Sin RUT"} · Control de versiones de contratos en PDF con almacenamiento seguro.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Toggle Requiere Contrato */}
          <div className="flex items-center justify-between p-3.5 rounded-lg border bg-muted/30">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold flex items-center gap-1.5">
                <span>¿Este proveedor requiere contrato formal?</span>
                {supplier?.requires_contract ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
                    Requerido
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">
                    Opcional
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Si está activo y no hay contrato vigente cargado, se señalará como pendiente en las alertas de compras.
              </p>
            </div>
            <Switch
              checked={Boolean(supplier?.requires_contract)}
              onCheckedChange={(checked) => toggleRequiresContractMutation.mutate(checked)}
              disabled={toggleRequiresContractMutation.isPending}
            />
          </div>

          {/* Formulario Subir Nueva Versión */}
          <div className="border rounded-xl p-4 bg-card space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Upload className="h-3.5 w-3.5 text-primary" />
              Subir Nueva Versión de Contrato (PDF)
            </h4>
            <form onSubmit={handleUploadContract} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="contract-pdf" className="text-xs">Archivo PDF del Contrato *</Label>
                  <Input
                    id="contract-pdf"
                    type="file"
                    accept=".pdf"
                    className="text-xs mt-1"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                </div>
                <div>
                  <Label htmlFor="contract-notes" className="text-xs">Notas de la versión</Label>
                  <Input
                    id="contract-notes"
                    placeholder="Ej. Contrato marco 2026 / Anexo renovación"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="text-xs mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!selectedFile || uploading}
                  className="gap-1.5 text-xs"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Subiendo contrato...
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5" />
                      Guardar como Versión Vigente {contracts.length > 0 ? `(v${Math.max(...contracts.map((c) => c.version_number)) + 1})` : "(v1)"}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>

          {/* Historial de Versiones */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-primary" />
                Historial de Versiones Cargadas ({contracts.length})
              </h4>
              {currentContract ? (
                <div className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Vigente: v{currentContract.version_number}</span>
                </div>
              ) : supplier?.requires_contract ? (
                <div className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 font-medium">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>Sin contrato cargado (Pendiente)</span>
                </div>
              ) : null}
            </div>

            {contractsQuery.isLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Cargando historial de contratos...
              </div>
            ) : contracts.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground border rounded-lg bg-muted/10">
                <FileText className="h-7 w-7 mx-auto mb-1.5 text-muted-foreground/40" />
                <p>No se registran contratos firmados para este proveedor.</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-muted/30">
                      <TableHead className="w-[80px]">Versión</TableHead>
                      <TableHead>Archivo</TableHead>
                      <TableHead>Fecha Carga</TableHead>
                      <TableHead>Notas</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map((c) => (
                      <TableRow key={c.id} className="text-xs">
                        <TableCell className="font-mono font-bold text-primary">
                          v{c.version_number}
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate" title={c.file_name}>
                          {c.file_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {new Date(c.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground italic text-[11px] max-w-[180px] truncate" title={c.notes || ""}>
                          {c.notes || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {c.is_current ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
                              Vigente
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                              Histórica
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleDownloadContract(c.file_path, c.file_name)}
                          >
                            <Download className="h-3 w-3" />
                            <span>PDF</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
