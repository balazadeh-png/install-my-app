import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, Search, X, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AccountOption {
  id: string;
  code: string;
  name: string;
  account_type?: string;
  currency_code?: string | null;
  is_group?: boolean;
  is_current?: boolean | null;
  requires_cost_center?: boolean;
  requires_business_unit?: boolean;
  active?: boolean;
}

interface AccountSearchComboboxProps {
  accounts: AccountOption[];
  value?: string;
  onSelect: (accountId: string, account?: AccountOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function normalizeText(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function HighlightMatch({ text, term }: { text: string; term: string }) {
  if (!term || !text) return <>{text}</>;
  const clean = term.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (clean.length < 1) return <>{text}</>;

  try {
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
  } catch {
    return <>{text}</>;
  }
}

const TYPE_CONFIG: Record<string, { label: string; badgeClass: string; groupOrder: number }> = {
  Asset: {
    label: "Activo",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    groupOrder: 1,
  },
  Liability: {
    label: "Pasivo",
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
    groupOrder: 2,
  },
  Equity: {
    label: "Patrimonio",
    badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    groupOrder: 3,
  },
  Income: {
    label: "Ingreso",
    badgeClass: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20",
    groupOrder: 4,
  },
  "Cost of Goods Sold": {
    label: "Costo",
    badgeClass: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
    groupOrder: 5,
  },
  Expense: {
    label: "Gasto",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    groupOrder: 6,
  },
};

export function AccountSearchCombobox({
  accounts,
  value,
  onSelect,
  placeholder = "Seleccionar cuenta...",
  disabled = false,
  className,
}: AccountSearchComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  // Solo cuentas imputables (no grupos)
  const postableAccounts = React.useMemo(() => {
    return accounts.filter((a) => !a.is_group);
  }, [accounts]);

  // Cuenta seleccionada actualmente
  const selectedAccount = React.useMemo(() => {
    if (!value) return null;
    return postableAccounts.find((a) => a.id === value) || null;
  }, [value, postableAccounts]);

  // Filtrado y ordenamiento inteligente insensible a acentos
  const filteredAccounts = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return postableAccounts;
    }

    const q = normalizeText(searchTerm.trim());

    return postableAccounts
      .filter((acc) => {
        const normCode = normalizeText(acc.code || "");
        const normName = normalizeText(acc.name || "");
        const normType = normalizeText(acc.account_type || "");
        const typeCfg = TYPE_CONFIG[acc.account_type || ""];
        const normTypeLabel = typeCfg ? normalizeText(typeCfg.label) : "";

        return (
          normCode.includes(q) ||
          normName.includes(q) ||
          normType.includes(q) ||
          normTypeLabel.includes(q)
        );
      })
      .sort((a, b) => {
        const normCodeA = normalizeText(a.code || "");
        const normCodeB = normalizeText(b.code || "");
        const normNameA = normalizeText(a.name || "");
        const normNameB = normalizeText(b.name || "");

        // Coincidencia exacta de código primero
        if (normCodeA === q && normCodeB !== q) return -1;
        if (normCodeB === q && normCodeA !== q) return 1;

        // Código comienza con el término
        if (normCodeA.startsWith(q) && !normCodeB.startsWith(q)) return -1;
        if (normCodeB.startsWith(q) && !normCodeA.startsWith(q)) return 1;

        // Nombre comienza con el término
        if (normNameA.startsWith(q) && !normNameB.startsWith(q)) return -1;
        if (normNameB.startsWith(q) && !normNameA.startsWith(q)) return 1;

        // Orden natural por código
        return (a.code || "").localeCompare(b.code || "", undefined, { numeric: true });
      });
  }, [postableAccounts, searchTerm]);

  // Agrupar cuentas si no hay búsqueda activa
  const groupedAccounts = React.useMemo(() => {
    if (searchTerm.trim()) {
      return { "Resultados de búsqueda": filteredAccounts };
    }

    const groups: Record<string, AccountOption[]> = {};

    filteredAccounts.forEach((acc) => {
      const typeKey = acc.account_type || "Otro";
      const cfg = TYPE_CONFIG[typeKey];
      const groupName = cfg ? `${cfg.label}s` : typeKey;

      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(acc);
    });

    return groups;
  }, [filteredAccounts, searchTerm]);

  const handleSelectAccount = (acc: AccountOption) => {
    onSelect(acc.id, acc);
    setOpen(false);
    setSearchTerm("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between text-left font-normal h-8 py-1 px-2.5 text-xs font-mono border-border/80 bg-background hover:bg-accent/40 transition-colors",
            !selectedAccount && "text-muted-foreground",
            className
          )}
        >
          {selectedAccount ? (
            <span className="truncate flex items-center gap-1.5 pr-1">
              <span className="font-bold text-foreground shrink-0">{selectedAccount.code}</span>
              <span className="text-muted-foreground">-</span>
              <span className="truncate text-foreground font-sans">{selectedAccount.name}</span>
              {selectedAccount.currency_code && selectedAccount.currency_code !== "CLP" && (
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-semibold shrink-0">
                  ({selectedAccount.currency_code})
                </span>
              )}
            </span>
          ) : (
            <span className="truncate text-muted-foreground font-sans">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[420px] p-0 shadow-xl border bg-popover" align="start" sideOffset={4}>
        <Command shouldFilter={false} className="w-full">
          {/* Input de Búsqueda con Foco Automático y Limpieza */}
          <div className="flex items-center border-b px-3 py-1 bg-muted/20">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              className="flex h-9 w-full rounded-md bg-transparent py-2 text-xs outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Buscar por código (ej. 1101) o nombre (ej. banco, iva)..."
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
                aria-label="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          <CommandList className="max-h-[320px] overflow-y-auto p-1">
            {/* Sin Resultados */}
            {filteredAccounts.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                <BookOpen className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
                <p className="font-semibold text-foreground">No se encontraron cuentas</p>
                <p className="text-[11px] mt-0.5">
                  No hay cuentas que coincidan con &ldquo;{searchTerm}&rdquo;
                </p>
              </div>
            )}

            {/* Listado de Cuentas */}
            {Object.entries(groupedAccounts).map(([groupTitle, accList]) => (
              <CommandGroup
                key={groupTitle}
                heading={groupTitle}
                className="[&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
              >
                {accList.map((acc) => {
                  const isSelected = selectedAccount?.id === acc.id;
                  const typeCfg = TYPE_CONFIG[acc.account_type || ""];

                  return (
                    <CommandItem
                      key={acc.id}
                      value={acc.id}
                      onSelect={() => handleSelectAccount(acc)}
                      className={cn(
                        "flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs",
                        isSelected && "bg-accent/80 font-medium"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <Check
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 text-primary transition-opacity",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="font-mono font-bold text-xs text-foreground shrink-0">
                          <HighlightMatch text={acc.code} term={searchTerm} />
                        </span>
                        <span className="text-xs text-foreground truncate font-sans">
                          <HighlightMatch text={acc.name} term={searchTerm} />
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {acc.currency_code && acc.currency_code !== "CLP" && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono px-1 py-0 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                          >
                            {acc.currency_code}
                          </Badge>
                        )}
                        {acc.is_current !== null && acc.is_current !== undefined && (
                          <span className="text-[10px] text-muted-foreground px-1 py-0 rounded bg-muted/60 font-sans">
                            {acc.is_current ? "Cte." : "No Cte."}
                          </span>
                        )}
                        {typeCfg && (
                          <span
                            className={cn(
                              "text-[10px] font-medium px-1.5 py-0.2 rounded border",
                              typeCfg.badgeClass
                            )}
                          >
                            {typeCfg.label}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
