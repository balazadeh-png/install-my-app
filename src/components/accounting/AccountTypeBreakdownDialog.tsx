import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Loader2, ArrowUpRight, PieChart, Layers } from "lucide-react";

export interface BreakdownAccountItem {
  account_id: string;
  account_code: string;
  account_name: string;
  amount: number;
}

interface AccountTypeBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  accountType: "Income" | "Cost of Goods Sold" | "Expense" | string;
  categoryLabel: string;
  periodStart: string;
  periodEnd: string;
  baseCurrency?: string;
  onSelectAccount: (
    account: { id: string; code: string; name: string; account_type: string },
    periodStart: string,
    periodEnd: string
  ) => void;
}

export function AccountTypeBreakdownDialog({
  open,
  onOpenChange,
  entityId,
  accountType,
  categoryLabel,
  periodStart,
  periodEnd,
  baseCurrency = "CLP",
  onSelectAccount,
}: AccountTypeBreakdownDialogProps) {
  const breakdownQuery = useQuery({
    queryKey: ["account_type_breakdown", entityId, accountType, periodStart, periodEnd],
    enabled: open && !!entityId && !!accountType && !!periodStart && !!periodEnd,
    queryFn: async (): Promise<BreakdownAccountItem[]> => {
      const { data, error } = await supabase.rpc("get_account_type_breakdown", {
        _entity_id: entityId,
        _account_type: accountType,
        _period_start: periodStart,
        _period_end: periodEnd,
      });

      if (error) {
        console.error("Error fetching account breakdown:", error);
        throw error;
      }

      return (data as any[]) ?? [];
    },
  });

  const items = breakdownQuery.data ?? [];
  const totalAmount = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  // Formatear mes representativo para el título
  const monthTitle = periodStart ? periodStart.substring(0, 7) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <PieChart className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <span>Desglose: {categoryLabel}</span>
                <Badge variant="outline" className="text-xs font-mono">
                  {monthTitle}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Cuentas contables imputadas entre el {periodStart} y el {periodEnd}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {breakdownQuery.isLoading ? (
            <div className="py-16 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>Cargando cuentas que componen la partida...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs space-y-2">
              <Layers className="h-8 w-8 mx-auto opacity-40 text-primary" />
              <p className="font-medium">No se registraron movimientos en esta categoría para el período.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="w-[120px]">Código</TableHead>
                      <TableHead>Nombre de la Cuenta</TableHead>
                      <TableHead className="text-right">Monto Período</TableHead>
                      <TableHead className="w-[80px] text-right">% Participación</TableHead>
                      <TableHead className="text-center w-[90px]">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const amount = Number(item.amount || 0);
                      const pct = totalAmount !== 0 ? Math.round((amount / totalAmount) * 100) : 0;

                      return (
                        <TableRow
                          key={item.account_id}
                          className="text-xs cursor-pointer hover:bg-primary/5 transition-colors group"
                          onClick={() => {
                            onSelectAccount(
                              {
                                id: item.account_id,
                                code: item.account_code,
                                name: item.account_name,
                                account_type: accountType,
                              },
                              periodStart,
                              periodEnd
                            );
                            onOpenChange(false);
                          }}
                        >
                          <TableCell className="font-mono font-bold text-primary group-hover:underline">
                            {item.account_code}
                          </TableCell>
                          <TableCell className="font-medium">{item.account_name}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            $ {amount.toLocaleString("es-CL")} {baseCurrency}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {pct}%
                          </TableCell>
                          <TableCell className="text-center p-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs gap-1 text-primary hover:bg-primary/10"
                              onClick={() => {
                                onSelectAccount(
                                  {
                                    id: item.account_id,
                                    code: item.account_code,
                                    name: item.account_name,
                                    account_type: accountType,
                                  },
                                  periodStart,
                                  periodEnd
                                );
                                onOpenChange(false);
                              }}
                            >
                              <BookOpen className="h-3.5 w-3.5" />
                              <span>Mayor</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Totalizador del Desglose */}
              <div className="flex justify-between items-center bg-muted/40 p-3 rounded-lg border text-xs font-mono">
                <span className="font-semibold text-muted-foreground">
                  Total Acumulado ({items.length} {items.length === 1 ? "cuenta" : "cuentas"}):
                </span>
                <span className="font-bold text-sm text-foreground">
                  $ {totalAmount.toLocaleString("es-CL")} {baseCurrency}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
