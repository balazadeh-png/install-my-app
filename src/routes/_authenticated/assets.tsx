import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
  Building2,
  Plus,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Layers,
  FileText,
  Trash2,
  TrendingDown,
  CheckCircle,
  Ban,
  Calculator,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/assets")({
  component: AssetsPage,
  head: () => ({
    meta: [
      { title: "Activos Fijos & Depreciación | EasyERP" },
      { name: "description", content: "Catálogo de bienes de uso, depreciación mensual automática y bajas de activos." },
    ],
  }),
});

function AssetsPage() {
  const queryClient = useQueryClient();
  const { activeEntity, activeEntityId } = useActiveEntity();

  const [newAssetOpen, setNewAssetOpen] = useState(false);
  const [depreciateOpen, setDepreciateOpen] = useState(false);
  const [disposeOpen, setDisposeOpen] = useState(false);
  const [selectedAssetForDisposal, setSelectedAssetForDisposal] = useState<any>(null);

  // Form State Nuevo Activo
  const [assetCode, setAssetCode] = useState("");
  const [assetName, setAssetName] = useState("");
  const [acqDate, setAcqDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [acqValue, setAcqValue] = useState("");
  const [residualValue, setResidualValue] = useState("0");
  const [lifeMonths, setLifeMonths] = useState("36");
  const [depMethod, setDepMethod] = useState<"linea_recta" | "acelerada">("linea_recta");
  const [assetAccId, setAssetAccId] = useState("");
  const [accumDepAccId, setAccumDepAccId] = useState("");
  const [depExpAccId, setDepExpAccId] = useState("");
  const [costCenterId, setCostCenterId] = useState<string>("");
  const [businessUnitId, setBusinessUnitId] = useState<string>("");
  const [memo, setMemo] = useState("");

  // Form State Depreciación Mensual
  const [depPeriodDate, setDepPeriodDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Form State Baja / Disposición
  const [dispDate, setDispDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [dispValue, setDispValue] = useState("0");
  const [gainLossAccId, setGainLossAccId] = useState("");
  const [dispBankAccId, setDispBankAccId] = useState("");

  const baseCurrency = activeEntity?.base_currency_code || "CLP";

  // Queries
  const accountsQuery = useQuery({
    queryKey: ["accounts", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("entity_id", activeEntityId)
        .order("code");
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

  const fixedAssetsQuery = useQuery({
    queryKey: ["fixed_assets", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("fixed_assets" as any)
        .select(`
          *,
          asset_account:asset_account_id(code, name),
          accum_account:accumulated_depreciation_account_id(code, name),
          expense_account:depreciation_expense_account_id(code, name),
          cost_centers(code, name),
          business_units(code, name)
        `)
        .eq("entity_id", activeEntityId)
        .order("acquisition_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!activeEntityId,
  });

  const depreciationEntriesQuery = useQuery({
    queryKey: ["fixed_asset_depreciation_entries", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("fixed_asset_depreciation_entries" as any)
        .select(`
          *,
          fixed_assets!inner(entity_id, asset_code, name),
          journal_entries(entry_number)
        `)
        .eq("fixed_assets.entity_id", activeEntityId)
        .order("period_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!activeEntityId,
  });

  const accounts = accountsQuery.data ?? [];
  const costCenters = costCentersQuery.data ?? [];
  const businessUnits = businessUnitsQuery.data ?? [];
  const fixedAssets = fixedAssetsQuery.data ?? [];
  const depreciationEntries = depreciationEntriesQuery.data ?? [];

  // Mutations
  const createAssetMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Selecciona una empresa primero");
      const val = parseFloat(acqValue);
      const resVal = parseFloat(residualValue || "0");
      const months = parseInt(lifeMonths, 10);

      if (!assetCode.trim() || !assetName.trim()) throw new Error("Complete código y nombre del activo");
      if (isNaN(val) || val <= 0) throw new Error("El valor de adquisición debe ser mayor a cero");
      if (isNaN(months) || months <= 0) throw new Error("La vida útil en meses debe ser mayor a cero");
      if (!assetAccId || !accumDepAccId || !depExpAccId) throw new Error("Seleccione las tres cuentas contables requeridas");

      const { error } = await supabase.from("fixed_assets" as any).insert({
        entity_id: activeEntityId,
        cost_center_id: costCenterId || null,
        business_unit_id: businessUnitId || null,
        asset_code: assetCode.trim().toUpperCase(),
        name: assetName.trim(),
        acquisition_date: acqDate,
        acquisition_value: val,
        currency_code: baseCurrency,
        residual_value: resVal,
        useful_life_months: months,
        depreciation_method: depMethod,
        asset_account_id: assetAccId,
        accumulated_depreciation_account_id: accumDepAccId,
        depreciation_expense_account_id: depExpAccId,
        memo: memo.trim() || null,
        status: "active",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixed_assets", activeEntityId] });
      toast.success("Activo fijo registrado con éxito");
      setNewAssetOpen(false);
      setAssetCode("");
      setAssetName("");
      setAcqValue("");
      setMemo("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al registrar activo fijo");
    },
  });

  const runDepreciationMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntityId) throw new Error("Selecciona una empresa primero");
      const { data, error } = await supabase.rpc("run_monthly_depreciation", {
        _entity_id: activeEntityId,
        _period_date: depPeriodDate,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["fixed_assets", activeEntityId] });
      queryClient.invalidateQueries({ queryKey: ["fixed_asset_depreciation_entries", activeEntityId] });
      queryClient.invalidateQueries({ queryKey: ["journal_entries", activeEntityId] });
      queryClient.invalidateQueries({ queryKey: ["financial_reports_data", activeEntityId] });
      toast.success(`Depreciación ejecutada: ${res?.assets_processed || 0} activos depreciados por un total de $ ${Number(res?.total_depreciation || 0).toLocaleString("es-CL")}`);
      setDepreciateOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al ejecutar depreciación mensual");
    },
  });

  const disposeAssetMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAssetForDisposal) throw new Error("Seleccione un activo");
      if (!gainLossAccId) throw new Error("Seleccione la cuenta de resultado (Ganancia/Pérdida en baja)");
      const dVal = parseFloat(dispValue || "0");

      const disposeArgs: {
        _asset_id: string;
        _disposal_date: string;
        _disposal_value: number;
        _gain_loss_account_id: string;
        _bank_account_id?: string;
      } = {
        _asset_id: selectedAssetForDisposal.id,
        _disposal_date: dispDate,
        _disposal_value: dVal,
        _gain_loss_account_id: gainLossAccId,
      };
      if (dVal > 0 && dispBankAccId) disposeArgs._bank_account_id = dispBankAccId;

      const { data, error } = await supabase.rpc("dispose_fixed_asset", disposeArgs);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixed_assets", activeEntityId] });
      queryClient.invalidateQueries({ queryKey: ["journal_entries", activeEntityId] });
      queryClient.invalidateQueries({ queryKey: ["financial_reports_data", activeEntityId] });
      toast.success("Activo fijo dado de baja correctamente y asiento contable posteado");
      setDisposeOpen(false);
      setDispValue("0");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al dar de baja el activo");
    },
  });

  const totalHistoricalCost = fixedAssets.reduce((s, a) => s + Number(a.acquisition_value || 0), 0);
  const totalAccumulatedDep = fixedAssets.reduce((s, a) => s + Number(a.accumulated_depreciation || 0), 0);
  const totalNetBookValue = totalHistoricalCost - totalAccumulatedDep;

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
            fixedAssetsQuery.refetch();
            depreciationEntriesQuery.refetch();
            accountsQuery.refetch();
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
              <Building2 className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Módulo de Activos Fijos & Depreciación</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión de bienes de uso, amortización mensual automática (Línea Recta / Acelerada) y bajas de activos.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Dialog Depreciación Mensual */}
          <Dialog open={depreciateOpen} onOpenChange={setDepreciateOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" size="sm">
                <Calculator className="mr-1.5 h-3.5 w-3.5 text-primary" />
                Ejecutar Depreciación del Mes
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Ejecutar Depreciación Mensual Automática</DialogTitle>
                <DialogDescription>
                  Calcula y postea los comprobantes de depreciación para todos los activos activos a la fecha indicada.
                </DialogDescription>
              </DialogHeader>
              <div className="py-3 space-y-3">
                <div>
                  <Label className="text-xs">Fecha de Corte del Período</Label>
                  <Input
                    type="date"
                    value={depPeriodDate}
                    onChange={(e) => setDepPeriodDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => runDepreciationMutation.mutate()}
                  disabled={runDepreciationMutation.isPending}
                >
                  {runDepreciationMutation.isPending ? "Procesando..." : "Ejecutar y Postear al Mayor"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Dialog Registrar Activo Fijo */}
          <Dialog open={newAssetOpen} onOpenChange={setNewAssetOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Nuevo Activo Fijo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Registrar Ficha de Activo Fijo</DialogTitle>
                <DialogDescription>
                  Ingresa las características del bien de uso y sus cuentas contables asociadas.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-3 border-b">
                <div>
                  <Label className="text-xs font-semibold">Código / Placa *</Label>
                  <Input
                    placeholder="ej. AF-VEH-001"
                    value={assetCode}
                    onChange={(e) => setAssetCode(e.target.value)}
                    className="mt-1 font-mono uppercase"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs font-semibold">Nombre / Descripción del Activo *</Label>
                  <Input
                    placeholder="ej. Camioneta Toyota Hilux 4x4 2024"
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Fecha de Adquisición *</Label>
                  <Input
                    type="date"
                    value={acqDate}
                    onChange={(e) => setAcqDate(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Valor de Adquisición ($ {baseCurrency}) *</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="ej. 25000000"
                    value={acqValue}
                    onChange={(e) => setAcqValue(e.target.value)}
                    className="mt-1 font-mono"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Valor Residual ($)</Label>
                  <Input
                    type="number"
                    step="any"
                    value={residualValue}
                    onChange={(e) => setResidualValue(e.target.value)}
                    className="mt-1 font-mono"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Vida Útil (Meses) *</Label>
                  <Input
                    type="number"
                    value={lifeMonths}
                    onChange={(e) => setLifeMonths(e.target.value)}
                    className="mt-1 font-mono"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Método de Depreciación</Label>
                  <Select value={depMethod} onValueChange={(val: any) => setDepMethod(val)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Método" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="linea_recta">Línea Recta (Normal)</SelectItem>
                      <SelectItem value="acelerada">Acelerada (1/3 Vida Útil SII)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Centro de Costo</Label>
                  <Select value={costCenterId} onValueChange={setCostCenterId}>
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
                  <Select value={businessUnitId} onValueChange={setBusinessUnitId}>
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

                <div className="md:col-span-2">
                  <Label className="text-xs font-semibold">Observaciones / Ubicación Física</Label>
                  <Input
                    placeholder="ej. Asignada a Operaciones Planta Norte"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Mapeo de Cuentas Contables */}
              <div className="py-3 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Mapeo Contable de Depreciación
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Cuenta Activo Fijo (Asset) *</Label>
                    <Select value={assetAccId} onValueChange={setAssetAccId}>
                      <SelectTrigger className="mt-1 text-xs font-mono">
                        <SelectValue placeholder="Cuenta de Activo" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.filter((a) => a.account_type === "Asset" && !a.is_group).map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.code} - {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Deprec. Acumulada (Contra-Activo) *</Label>
                    <Select value={accumDepAccId} onValueChange={setAccumDepAccId}>
                      <SelectTrigger className="mt-1 text-xs font-mono">
                        <SelectValue placeholder="Deprec. Acumulada" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.filter((a) => !a.is_group).map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.code} - {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Gasto Depreciación (Expense) *</Label>
                    <Select value={depExpAccId} onValueChange={setDepExpAccId}>
                      <SelectTrigger className="mt-1 text-xs font-mono">
                        <SelectValue placeholder="Gasto Depreciación" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.filter((a) => a.account_type === "Expense" && !a.is_group).map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.code} - {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  onClick={() => createAssetMutation.mutate()}
                  disabled={createAssetMutation.isPending || !assetCode || !assetName || !acqValue}
                >
                  Guardar Ficha de Activo
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Dialog Dar de Baja */}
          <Dialog open={disposeOpen} onOpenChange={setDisposeOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Baja / Disposición de Activo Fijo</DialogTitle>
                <DialogDescription>
                  Dar de baja el activo {selectedAssetForDisposal?.asset_code} ({selectedAssetForDisposal?.name}).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-3">
                <div className="p-3 bg-muted/40 rounded border text-xs font-mono space-y-1">
                  <div>Valor Adquisición: $ {Number(selectedAssetForDisposal?.acquisition_value || 0).toLocaleString("es-CL")}</div>
                  <div>Depreciación Acumulada: $ {Number(selectedAssetForDisposal?.accumulated_depreciation || 0).toLocaleString("es-CL")}</div>
                  <div className="font-bold text-foreground">
                    Valor Libro Neto: $ {(Number(selectedAssetForDisposal?.acquisition_value || 0) - Number(selectedAssetForDisposal?.accumulated_depreciation || 0)).toLocaleString("es-CL")}
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Fecha de Baja</Label>
                  <Input
                    type="date"
                    value={dispDate}
                    onChange={(e) => setDispDate(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs">Valor de Venta / Rescate ($ {baseCurrency})</Label>
                  <Input
                    type="number"
                    step="any"
                    value={dispValue}
                    onChange={(e) => setDispValue(e.target.value)}
                    className="mt-1 font-mono"
                  />
                </div>

                <div>
                  <Label className="text-xs">Cuenta de Resultado (Ganancia/Pérdida en Disposición)</Label>
                  <Select value={gainLossAccId} onValueChange={setGainLossAccId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Seleccione cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.filter((a) => ["Income", "Expense"].includes(a.account_type) && !a.is_group).map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.code} - {a.name} ({a.account_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {parseFloat(dispValue || "0") > 0 && (
                  <div>
                    <Label className="text-xs">Cuenta de Caja / Banco Receptora</Label>
                    <Select value={dispBankAccId} onValueChange={setDispBankAccId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Seleccione banco" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.filter((a) => a.account_type === "Asset" && !a.is_group).map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.code} - {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  onClick={() => disposeAssetMutation.mutate()}
                  disabled={disposeAssetMutation.isPending || !gainLossAccId}
                >
                  Ejecutar Baja
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
              Valor Histórico Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              $ {totalHistoricalCost.toLocaleString("es-CL")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Costo de adquisición ({baseCurrency})</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Depreciación Acumulada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-destructive">
              $ {totalAccumulatedDep.toLocaleString("es-CL")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Amortización a la fecha ({baseCurrency})</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Valor Libro Neto (Net Book Value)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              $ {totalNetBookValue.toLocaleString("es-CL")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Valor residual financiero ({baseCurrency})</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="assets" className="space-y-4">
        <TabsList>
          <TabsTrigger value="assets" className="flex items-center gap-1.5">
            <Building2 className="h-4 w-4" />
            <span>Fichas de Activos Fijos ({fixedAssets.length})</span>
          </TabsTrigger>
          <TabsTrigger value="ledger" className="flex items-center gap-1.5">
            <Layers className="h-4 w-4" />
            <span>Libro de Depreciaciones ({depreciationEntries.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab Activos Fijos */}
        <TabsContent value="assets">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Registro Maestro de Activos Fijos</CardTitle>
              <CardDescription>
                Bienes de uso con vida útil, método de depreciación y valor libro en tiempo real.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {fixedAssets.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Building2 className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No hay activos fijos registrados en la empresa.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setNewAssetOpen(true)}
                  >
                    Registrar primer activo
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">Código</TableHead>
                        <TableHead>Nombre del Activo</TableHead>
                        <TableHead>Adquisición</TableHead>
                        <TableHead className="text-right">Valor Inicial</TableHead>
                        <TableHead className="text-center">Método</TableHead>
                        <TableHead className="text-right">Deprec. Acumulada</TableHead>
                        <TableHead className="text-right">Valor Libro Neto</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                        <TableHead className="text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fixedAssets.map((asset) => {
                        const nbv = Number(asset.acquisition_value) - Number(asset.accumulated_depreciation);
                        const isActive = asset.status === "active";
                        const isDisposed = asset.status === "disposed";
                        const isFullyDepreciated = asset.status === "fully_depreciated";

                        return (
                          <TableRow key={asset.id}>
                            <TableCell className="font-mono font-bold text-xs text-primary">
                              {asset.asset_code}
                            </TableCell>
                            <TableCell className="text-xs font-semibold">
                              <div>{asset.name}</div>
                              {asset.memo && <div className="text-[11px] text-muted-foreground font-normal">{asset.memo}</div>}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{asset.acquisition_date}</TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              $ {Number(asset.acquisition_value).toLocaleString("es-CL")}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="text-[10px]">
                                {asset.depreciation_method === "acelerada" ? "Acelerada (1/3)" : "Línea Recta"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-destructive">
                              $ {Number(asset.accumulated_depreciation).toLocaleString("es-CL")}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              $ {nbv.toLocaleString("es-CL")}
                            </TableCell>
                            <TableCell className="text-center">
                              {isActive && <Badge className="bg-emerald-600 text-white text-[11px]">Activo</Badge>}
                              {isFullyDepreciated && <Badge variant="outline" className="border-amber-500 text-amber-600 text-[11px]">Depreciado</Badge>}
                              {isDisposed && <Badge variant="secondary" className="text-[11px]">Dado de Baja</Badge>}
                            </TableCell>
                            <TableCell className="text-right">
                              {!isDisposed && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    setSelectedAssetForDisposal(asset);
                                    setDisposeOpen(true);
                                  }}
                                >
                                  <Ban className="h-3 w-3 mr-1" />
                                  Dar de Baja
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

        {/* Tab Libro de Depreciaciones */}
        <TabsContent value="ledger">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Historial de Depreciaciones Mensuales</CardTitle>
              <CardDescription>
                Registro de cuotas mensuales calculadas y comprobantes posteados al Libro Diario.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {depreciationEntries.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <p className="text-sm">No hay corridas de depreciación registradas.</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha Período</TableHead>
                        <TableHead>Código Activo</TableHead>
                        <TableHead>Nombre Activo</TableHead>
                        <TableHead className="text-right">Cuota Depreciación</TableHead>
                        <TableHead className="text-right">N° Comprobante Contable</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {depreciationEntries.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="font-mono text-xs">{e.period_date}</TableCell>
                          <TableCell className="font-mono text-xs font-bold text-primary">
                            {e.fixed_assets?.asset_code}
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {e.fixed_assets?.name}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-bold text-destructive">
                            $ {Number(e.amount).toLocaleString("es-CL")}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {e.journal_entries?.entry_number || "-"}
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
      </Tabs>
    </div>
  );
}
