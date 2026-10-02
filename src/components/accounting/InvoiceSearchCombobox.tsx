import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, ChevronsUpDown, Sparkles, FileText, AlertCircle, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PendingInvoiceItem {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date?: string;
  party_name: string;
  party_tax_id: string;
  currency_code: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  is_exact_amount_match?: boolean;
  relevance_score?: number;
}

interface InvoiceSearchComboboxProps {
  entityId: string;
  invoiceType?: "sale" | "purchase";
  targetAmount?: number;
  value?: string;
  onSelect: (invoice: PendingInvoiceItem | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

function HighlightMatch({ text, term }: { text: string; term: string }) {
  if (!term || !text) return <>{text}</>;

  // Remover caracteres especiales de regex
  const clean = term.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (clean.length < 2) return <>{text}</>;

  const regex = new RegExp(`(${clean})`, "gi");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <strong key={i} className="font-extrabold text-foreground bg-primary/20 px-0.5 rounded">
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export function InvoiceSearchCombobox({
  entityId,
  invoiceType = "sale",
  targetAmount,
  value,
  onSelect,
  placeholder = "Buscar factura por N° folio, cliente, RUT o monto...",
  disabled = false,
}: InvoiceSearchComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [selectedItem, setSelectedItem] = React.useState<PendingInvoiceItem | null>(null);

  // Consulta Asíncrona con React Query
  const searchQuery = useQuery({
    queryKey: [
      "search_pending_invoices",
      entityId,
      invoiceType,
      debouncedSearch.trim(),
      targetAmount || null,
    ],
    queryFn: async (): Promise<PendingInvoiceItem[]> => {
      if (!entityId) return [];

      try {
        const { data, error } = await supabase.rpc("search_pending_invoices", {
          term: debouncedSearch.trim(),
          tenant_id: entityId,
          limit: 50,
          target_amount: targetAmount ? Number(targetAmount) : null,
          invoice_type: invoiceType,
        });

        if (!error && Array.isArray(data)) {
          return data as PendingInvoiceItem[];
        }
        if (error) {
          console.warn("RPC search_pending_invoices warning, using direct view fallback:", error.message);
        }
      } catch (rpcErr) {
        console.warn("RPC execution error, using fallback view:", rpcErr);
      }

      // Fallback resiliente directo a la vista
      const viewName = invoiceType === "sale" ? "sales_invoice_balances" : "purchase_invoice_balances";
      let query = supabase
        .from(viewName as any)
        .select("*")
        .eq("entity_id", entityId)
        .gt("balance_due", 0);

      const term = debouncedSearch.trim();
      if (term) {
        query = query.or(
          `invoice_number.ilike.%${term}%,party_name.ilike.%${term}%,party_tax_id.ilike.%${term}%`
        );
      }

      const { data: fallbackData, error: fallbackError } = await query
        .order("issue_date", { ascending: false })
        .limit(50);

      if (fallbackError) throw fallbackError;

      const items = (fallbackData as any[]) || [];
      return items.map((item) => {
        const isMatch = targetAmount && Math.abs(Number(item.balance_due) - Number(targetAmount)) < 1.0;
        return {
          id: item.id,
          invoice_number: item.invoice_number,
          issue_date: item.issue_date,
          due_date: item.due_date,
          party_name: item.party_name,
          party_tax_id: item.party_tax_id,
          currency_code: item.currency_code || "CLP",
          total_amount: Number(item.total_amount || 0),
          paid_amount: Number(item.paid_amount || 0),
          balance_due: Number(item.balance_due || 0),
          is_exact_amount_match: !!isMatch,
          relevance_score: isMatch ? 500 : 0,
        };
      });
    },
    enabled: !!entityId && open,
    staleTime: 1000 * 30, // 30s cache
  });

  const invoices = searchQuery.data || [];

  // Sincronizar el item seleccionado si el valor coincide
  React.useEffect(() => {
    if (value && !selectedItem) {
      const found = invoices.find((inv) => inv.id === value);
      if (found) setSelectedItem(found);
    }
  }, [value, invoices, selectedItem]);

  const handleSelect = (inv: PendingInvoiceItem) => {
    setSelectedItem(inv);
    onSelect(inv);
    setOpen(false);
  };

  // Separar facturas sugeridas ("Posible match" por monto del movimiento) de las demás
  const matchedInvoices = React.useMemo(() => {
    return invoices.filter((i) => i.is_exact_amount_match);
  }, [invoices]);

  const otherInvoices = React.useMemo(() => {
    return invoices.filter((i) => !i.is_exact_amount_match);
  }, [invoices]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between text-left font-normal h-auto min-h-9 py-2 px-3",
            !selectedItem && "text-muted-foreground"
          )}
        >
          {selectedItem ? (
            <div className="flex flex-col gap-0.5 text-left truncate w-full pr-2">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs text-foreground">
                  {selectedItem.invoice_number}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {selectedItem.party_name} ({selectedItem.party_tax_id})
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>Fecha: {selectedItem.issue_date}</span>
                <span>•</span>
                <span className="font-mono font-semibold text-emerald-600">
                  Saldo: ${Math.round(selectedItem.balance_due).toLocaleString("es-CL")}
                </span>
                <span>(Total: ${Math.round(selectedItem.total_amount).toLocaleString("es-CL")})</span>
              </div>
            </div>
          ) : (
            <span className="text-xs truncate">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[480px] p-0 shadow-lg border" align="start" sideOffset={5}>
        <Command shouldFilter={false} className="w-full">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-xs outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Escribe folio (ej. 1025), cliente, RUT o monto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchTerm("")}
              >
                ✕
              </Button>
            )}
          </div>

          <CommandList className="max-h-[340px] overflow-y-auto">
            {/* Estado de Carga */}
            {searchQuery.isLoading && (
              <div className="p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            )}

            {/* Estado de Error */}
            {searchQuery.isError && (
              <div className="py-6 px-4 text-center">
                <AlertCircle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-rose-600">Error al buscar facturas pendientes</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">
                  {(searchQuery.error as any)?.message || "Ocurrió un problema de comunicación"}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => searchQuery.refetch()}
                >
                  <RefreshCw className="mr-1.5 h-3 w-3" />
                  Reintentar
                </Button>
              </div>
            )}

            {/* Sin Resultados */}
            {!searchQuery.isLoading && !searchQuery.isError && invoices.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                <FileText className="h-7 w-7 text-muted-foreground/40 mx-auto mb-1.5" />
                <p className="font-semibold text-foreground">No se encontraron facturas pendientes</p>
                <p className="text-[11px] mt-0.5">
                  {searchTerm.trim().length > 0
                    ? `No hay facturas que coincidan con "${searchTerm}"`
                    : "No hay facturas con saldo mayor a cero"}
                </p>
              </div>
            )}

            {/* Grupo 1: Sugerencias automáticas por coincidencia exacta de monto ("Posible match") */}
            {!searchQuery.isLoading && matchedInvoices.length > 0 && (
              <CommandGroup
                heading={
                  <div className="flex items-center justify-between text-emerald-700 font-semibold px-1 py-0.5">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-600 fill-emerald-600" />
                      Sugerencia automática por monto del movimiento
                    </span>
                    <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 text-[10px]">
                      {matchedInvoices.length} {matchedInvoices.length === 1 ? "coincidencia" : "coincidencias"}
                    </Badge>
                  </div>
                }
              >
                {matchedInvoices.map((inv) => (
                  <CommandItem
                    key={inv.id}
                    value={inv.id}
                    onSelect={() => handleSelect(inv)}
                    className="p-2.5 cursor-pointer aria-selected:bg-emerald-50/70 border-b border-emerald-100 last:border-b-0"
                  >
                    <div className="flex items-start justify-between w-full gap-2">
                      <div className="space-y-1 truncate">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-foreground">
                            <HighlightMatch text={inv.invoice_number} term={searchTerm} />
                          </span>
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] h-4 px-1.5 flex items-center gap-1">
                            <Sparkles className="h-2.5 w-2.5" />
                            Posible match
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          <HighlightMatch text={inv.party_name} term={searchTerm} /> •{" "}
                          <span className="font-mono">
                            <HighlightMatch text={inv.party_tax_id} term={searchTerm} />
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Emisión: {inv.issue_date}
                        </div>
                      </div>

                      <div className="text-right whitespace-nowrap pl-2">
                        <div className="font-mono font-bold text-xs text-emerald-700">
                          ${Math.round(inv.balance_due).toLocaleString("es-CL")}
                        </div>
                        <div className="text-[10px] text-muted-foreground line-through">
                          Orig: ${Math.round(inv.total_amount).toLocaleString("es-CL")}
                        </div>
                      </div>
                    </div>
                    {selectedItem?.id === inv.id && (
                      <Check className="ml-2 h-4 w-4 text-emerald-600 shrink-0" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Grupo 2: Otras facturas pendientes */}
            {!searchQuery.isLoading && otherInvoices.length > 0 && (
              <CommandGroup heading={matchedInvoices.length > 0 ? "Otras facturas pendientes" : "Facturas pendientes"}>
                {otherInvoices.map((inv) => (
                  <CommandItem
                    key={inv.id}
                    value={inv.id}
                    onSelect={() => handleSelect(inv)}
                    className="p-2.5 cursor-pointer aria-selected:bg-muted/70 border-b last:border-b-0"
                  >
                    <div className="flex items-start justify-between w-full gap-2">
                      <div className="space-y-1 truncate">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-foreground">
                            <HighlightMatch text={inv.invoice_number} term={searchTerm} />
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {inv.issue_date}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          <HighlightMatch text={inv.party_name} term={searchTerm} /> •{" "}
                          <span className="font-mono">
                            <HighlightMatch text={inv.party_tax_id} term={searchTerm} />
                          </span>
                        </div>
                      </div>

                      <div className="text-right whitespace-nowrap pl-2">
                        <div className="font-mono font-bold text-xs text-foreground">
                          ${Math.round(inv.balance_due).toLocaleString("es-CL")}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Total: ${Math.round(inv.total_amount).toLocaleString("es-CL")}
                        </div>
                      </div>
                    </div>
                    {selectedItem?.id === inv.id && (
                      <Check className="ml-2 h-4 w-4 text-primary shrink-0" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
