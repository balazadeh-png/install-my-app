import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEntity } from "@/context/ActiveEntityContext";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { SourceDocumentDialog } from "@/components/accounting/SourceDocumentDialog";
import {
  BookOpen,
  Calendar,
  Filter,
  ArrowUpRight,
  FileText,
  DollarSign,
  Building2,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

interface AccountLedgerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: {
    id: string;
    code: string;
    name: string;
    account_type: string;
  } | null;
  defaultCostCenterId?: string;
  defaultBusinessUnitId?: string;
}

export function AccountLedgerDrawer({
  open,
  onOpenChange,
  account,
  defaultCostCenterId = "ALL",
  defaultBusinessUnitId = "ALL",
}: AccountLedgerDrawerProps) {
  const { activeEntityId, activeEntity } = useActiveEntity();
  const baseCurrency = activeEntity?.base_currency_code || "CLP";

  const currentYear = new Date().getFullYear();
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(`${currentYear}-12-31`);
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>(defaultCostCenterId);
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>(defaultBusinessUnitId);

  // Sincronizar filtros cuando cambian por props
  useEffect(() => {
    if (defaultCostCenterId) setSelectedCostCenter(defaultCostCenterId);
    if (defaultBusinessUnitId) setSelectedBusinessUnit(defaultBusinessUnitId);
  }, [defaultCostCenterId, defaultBusinessUnitId]);

  // Estado para el modal de Documento Fuente
  const [selectedJournalEntryId, setSelectedJournalEntryId] = useState<string | null>(null);
  const [sourceDocModalOpen, setSourceDocModalOpen] = useState(false);

  // Query: Centros de Costo
  const costCentersQuery = useQuery({
    queryKey: ["cost_centers", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("cost_centers")
        .select("*")
        .eq("entity_id", activeEntityId)
        .order("code");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!activeEntityId,
  });

  // Query: Sucursales
  const businessUnitsQuery = useQuery({
    queryKey: ["business_units", activeEntityId],
    queryFn: async () => {
      if (!activeEntityId) return [];
      const { data, error } = await supabase
        .from("business_units")
        .select("*")
        .eq("entity_id", activeEntityId)
        .order("code");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!activeEntityId,
  });

  // Query: Movimientos del Libro Mayor para esta cuenta
  const ledgerQuery = useQuery({
    queryKey: [
      "account_ledger_movements",
      activeEntityId,
      account?.id,
      startDate,
      endDate,
    ],
    queryFn: async () => {
      if (!activeEntityId || !account?.id) return { movements: [], priorLines: [] };

      // 1. Movimientos en el rango de fechas
      const { data: movementsData, error: movError } = await supabase
        .from("journal_entry_lines")
        .select(`
          id,
          journal_entry_id,
          account_id,
          debit,
          credit,
          memo,
          cost_center_id,
          business_unit_id,
          cost_centers(code, name),
          business_units(code, name),
          parties(name, tax_id),
          journal_entries!inner(
            id,
            entry_number,
            posting_date,
            voucher_type,
            memo,
            status,
            entity_id
          )
        `)
        .eq("account_id", account.id)
        .eq("journal_entries.entity_id", activeEntityId)
        .eq("journal_entries.status", "posted")
        .gte("journal_entries.posting_date", startDate)
        .lte("journal_entries.posting_date", endDate);

      if (movError) throw movError;

      // 2. Movimientos anteriores a startDate para Saldo Inicial
      const { data: priorData, error: priorError } = await supabase
        .from("journal_entry_lines")
        .select(`
          debit,
          credit,
          cost_center_id,
          business_unit_id,
          journal_entries!inner(posting_date, status, entity_id)
        `)
        .eq("account_id", account.id)
        .eq("journal_entries.entity_id", activeEntityId)
        .eq("journal_entries.status", "posted")
        .lt("journal_entries.posting_date", startDate);

      if (priorError) throw priorError;

      return {
        movements: movementsData ?? [],
        priorLines: priorData ?? [],
      };
    },
    enabled: open && !!activeEntityId && !!account?.id,
  });

  const costCenters = costCentersQuery.data ?? [];
  const businessUnits = businessUnitsQuery.data ?? [];
  const { movements = [], priorLines = [] } = ledgerQuery.data ?? {};

  // Cálculo reactivo de saldo inicial, movimientos filtrados y saldo progresivo
  const {
    initialBalance,
    totalPeriodDebit,
    totalPeriodCredit,
    finalBalance,
    calculatedMovements,
  } = useMemo(() => {
    if (!account) {
      return {
        initialBalance: 0,
        totalPeriodDebit: 0,
        totalPeriodCredit: 0,
        finalBalance: 0,
        calculatedMovements: [],
      };
    }

    const isDebitNature = ["Asset", "Expense", "Cost of Goods Sold"].includes(account.account_type);

    // 1. Filtrar líneas anteriores según filtros analíticos
    const filteredPrior = priorLines.filter((l: any) => {
      if (selectedCostCenter !== "ALL" && l.cost_center_id !== selectedCostCenter) return false;
      if (selectedBusinessUnit !== "ALL" && l.business_unit_id !== selectedBusinessUnit) return false;
      return true;
    });

    const initBal = filteredPrior.reduce((sum: number, l: any) => {
      const d = Number(l.debit || 0);
      const c = Number(l.credit || 0);
      return sum + (isDebitNature ? d - c : c - d);
    }, 0);

    // 2. Filtrar movimientos del período
    const filteredMovs = movements.filter((m: any) => {
      if (selectedCostCenter !== "ALL" && m.cost_center_id !== selectedCostCenter) return false;
      if (selectedBusinessUnit !== "ALL" && m.business_unit_id !== selectedBusinessUnit) return false;
      return true;
    });

    // Ordenar cronológicamente ascendente por posting_date y entry_number
    filteredMovs.sort((a: any, b: any) => {
      const dateA = a.journal_entries?.posting_date || "";
      const dateB = b.journal_entries?.posting_date || "";
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return (a.journal_entries?.entry_number || "").localeCompare(b.journal_entries?.entry_number || "");
    });

    // 3. Calcular saldo progresivo acumulado fila a fila
    let runningBalance = initBal;
    let periodDebit = 0;
    let periodCredit = 0;

    const withRunningBalance = filteredMovs.map((m: any) => {
      const d = Number(m.debit || 0);
      const c = Number(m.credit || 0);
      periodDebit += d;
      periodCredit += c;

      if (isDebitNature) {
        runningBalance += d - c;
      } else {
        runningBalance += c - d;
      }

      return {
        ...m,
        debitNum: d,
        creditNum: c,
        runningBalance,
      };
    });

    return {
      initialBalance: initBal,
      totalPeriodDebit: periodDebit,
      totalPeriodCredit: periodCredit,
      finalBalance: runningBalance,
      calculatedMovements: withRunningBalance,
    };
  }, [account, movements, priorLines, selectedCostCenter, selectedBusinessUnit]);

  function handleOpenSourceDoc(journalEntryId: string) {
    setSelectedJournalEntryId(journalEntryId);
    setSourceDocModalOpen(true);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="sm:max-w-4xl w-full p-0 flex flex-col h-full bg-background border-l shadow-2xl z-50"
        >
          {/* Header */}
          <SheetHeader className="p-6 border-b bg-card/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <SheetTitle className="text-xl font-bold font-mono tracking-tight text-foreground">
                      {account?.code}
                    </SheetTitle>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-lg font-semibold text-foreground">{account?.name}</span>
                    {account?.account_type && (
                      <Badge variant="outline" className="text-xs">
                        {account.account_type}
                      </Badge>
                    )}
                  </div>
                  <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                    Libro Mayor Analítico con desglose de comprobantes y trazabilidad a documento de origen.
                  </SheetDescription>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs shrink-0 gap-1.5"
                onClick={() => ledgerQuery.refetch()}
                disabled={ledgerQuery.isFetching}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${ledgerQuery.isFetching ? "animate-spin" : ""}`} />
                <span>Actualizar</span>
              </Button>
            </div>
          </SheetHeader>

          {/* Body con Scroll */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Barra de Filtros del Mayor */}
            <Card className="border bg-muted/20 shadow-none">
              <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1 block">Fecha Desde</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                </div>

                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1 block">Fecha Hasta</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                </div>

                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1 block">Centro de Costo</Label>
                  <Select value={selectedCostCenter} onValueChange={setSelectedCostCenter}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos los CC</SelectItem>
                      {costCenters.map((cc) => (
                        <SelectItem key={cc.id} value={cc.id}>
                          {cc.code} - {cc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1 block">Sucursal / Unidad</Label>
                  <Select value={selectedBusinessUnit} onValueChange={setSelectedBusinessUnit}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todas las Sucursales</SelectItem>
                      {businessUnits.map((bu) => (
                        <SelectItem key={bu.id} value={bu.id}>
                          {bu.code} - {bu.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Tarjetas KPI de Saldos */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border bg-card shadow-sm">
                <span className="text-[11px] font-medium text-muted-foreground block">Saldo Inicial</span>
                <span className="font-mono text-base font-bold text-foreground mt-0.5 block">
                  $ {initialBalance.toLocaleString("es-CL")}
                </span>
                <span className="text-[10px] text-muted-foreground">Antes del {startDate}</span>
              </div>

              <div className="p-3 rounded-lg border bg-card shadow-sm">
                <span className="text-[11px] font-medium text-muted-foreground block">Total Débitos</span>
                <span className="font-mono text-base font-bold text-foreground mt-0.5 block">
                  $ {totalPeriodDebit.toLocaleString("es-CL")}
                </span>
                <span className="text-[10px] text-muted-foreground">Período seleccionado</span>
              </div>

              <div className="p-3 rounded-lg border bg-card shadow-sm">
                <span className="text-[11px] font-medium text-muted-foreground block">Total Créditos</span>
                <span className="font-mono text-base font-bold text-foreground mt-0.5 block">
                  $ {totalPeriodCredit.toLocaleString("es-CL")}
                </span>
                <span className="text-[10px] text-muted-foreground">Período seleccionado</span>
              </div>

              <div className="p-3 rounded-lg border bg-primary/5 border-primary/20 shadow-sm">
                <span className="text-[11px] font-medium text-primary block">Saldo Final Actual</span>
                <span className="font-mono text-lg font-bold text-primary mt-0.5 block">
                  $ {finalBalance.toLocaleString("es-CL")}
                </span>
                <span className="text-[10px] text-primary/70">{baseCurrency}</span>
              </div>
            </div>

            {/* Tabla de Movimientos del Libro Mayor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Movimientos Contables ({calculatedMovements.length})
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    (Haz clic en cualquier fila para inspeccionar el documento que lo generó)
                  </span>
                </div>
              </div>

              {ledgerQuery.isLoading ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  Cargando libro mayor...
                </div>
              ) : calculatedMovements.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground border rounded-lg bg-card p-6">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">No existen movimientos en el período seleccionado</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Modifica los filtros de fecha o centros de costo para ampliar la búsqueda.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-x-auto shadow-sm bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 text-[11px]">
                        <TableHead className="w-24">Fecha</TableHead>
                        <TableHead className="w-28">N° Comprobante</TableHead>
                        <TableHead className="w-32">Tipo</TableHead>
                        <TableHead>Glosa / Tercero</TableHead>
                        <TableHead className="text-right w-28">Débito ($)</TableHead>
                        <TableHead className="text-right w-28">Crédito ($)</TableHead>
                        <TableHead className="text-right w-32 font-bold">Saldo Progresivo</TableHead>
                        <TableHead className="text-center w-28">Doc. Origen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calculatedMovements.map((m: any, idx: number) => {
                        const je = m.journal_entries;
                        const party = m.parties;
                        const memoText = m.memo || je?.memo || "-";

                        return (
                          <TableRow
                            key={m.id || idx}
                            className="text-xs cursor-pointer hover:bg-primary/5 transition-colors group"
                            onClick={() => handleOpenSourceDoc(m.journal_entry_id)}
                          >
                            <TableCell className="font-mono text-muted-foreground">
                              {je?.posting_date || "-"}
                            </TableCell>

                            <TableCell className="font-mono font-bold text-primary">
                              {je?.entry_number || "ASI-POST"}
                            </TableCell>

                            <TableCell>
                              <Badge
                                variant="outline"
                                className="text-[10px] font-normal truncate max-w-[120px]"
                              >
                                {je?.voucher_type || "Diario"}
                              </Badge>
                            </TableCell>

                            <TableCell>
                              <div className="text-foreground line-clamp-1">{memoText}</div>
                              {party && (
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  {party.name} ({party.tax_id})
                                </div>
                              )}
                            </TableCell>

                            <TableCell className="text-right font-mono text-foreground">
                              {m.debitNum > 0 ? `$ ${m.debitNum.toLocaleString("es-CL")}` : "-"}
                            </TableCell>

                            <TableCell className="text-right font-mono text-foreground">
                              {m.creditNum > 0 ? `$ ${m.creditNum.toLocaleString("es-CL")}` : "-"}
                            </TableCell>

                            <TableCell className="text-right font-mono font-bold text-primary bg-primary/[0.02]">
                              $ {m.runningBalance.toLocaleString("es-CL")}
                            </TableCell>

                            <TableCell className="text-center p-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-[11px] px-2 gap-1 text-primary hover:text-primary hover:bg-primary/10"
                                onClick={() => handleOpenSourceDoc(m.journal_entry_id)}
                              >
                                <FileText className="h-3.5 w-3.5" />
                                <span>Ver Doc</span>
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
          </div>
        </SheetContent>
      </Sheet>

      {/* Visor Modal de Documento Fuente */}
      <SourceDocumentDialog
        open={sourceDocModalOpen}
        onOpenChange={setSourceDocModalOpen}
        journalEntryId={selectedJournalEntryId}
      />
    </>
  );
}
