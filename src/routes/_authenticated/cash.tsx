import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { DollarSign, Plus, ArrowLeft, RefreshCw, TrendingUp, Landmark } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cash")({
  component: CashPage,
  head: () => ({
    meta: [
      { title: "Bancos & Tesorería | Cacao Accounting" },
      { name: "description", content: "Tasas de cambio oficiales NIO/USD y libros de tesorería." },
    ],
  }),
});

function CashPage() {
  const queryClient = useQueryClient();
  const [newRateOpen, setNewRateOpen] = useState(false);
  const [newBookOpen, setNewBookOpen] = useState(false);

  // Form State Rate
  const [rateDate, setRateDate] = useState(new Date().toISOString().split("T")[0]);
  const [rateValue, setRateValue] = useState("");

  // Form State Book
  const [bookCode, setBookCode] = useState("");
  const [bookName, setBookName] = useState("");

  // Query: Exchange Rates
  const ratesQuery = useQuery({
    queryKey: ["exchange_rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exchange_rates")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Query: Books (Cajas y Bancos)
  const booksQuery = useQuery({
    queryKey: ["books"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .order("code", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Mutation: Crear Tasa de Cambio
  const createRateMutation = useMutation({
    mutationFn: async () => {
      const numRate = parseFloat(rateValue);
      if (isNaN(numRate) || numRate <= 0) throw new Error("Ingrese una tasa válida");

      const { error } = await supabase.from("exchange_rates").insert({
        origin: "USD",
        destination: "NIO",
        date: rateDate,
        rate: numRate,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange_rates"] });
      toast.success("Tasa de cambio registrada");
      setNewRateOpen(false);
      setRateValue("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al guardar tasa");
    },
  });

  // Mutation: Crear Libro
  const createBookMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("books").insert({
        code: bookCode.trim(),
        name: bookName.trim(),
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      toast.success("Libro / Caja registrada");
      setNewBookOpen(false);
      setBookCode("");
      setBookName("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al registrar libro");
    },
  });

  const rates = ratesQuery.data ?? [];
  const books = booksQuery.data ?? [];
  const latestRate = rates[0]?.rate;

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
            ratesQuery.refetch();
            booksQuery.refetch();
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
              <DollarSign className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Módulo de Bancos & Tesorería</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión de tipos de cambio multimoneda (USD / NIO) y libros de caja y bancos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Dialog Tasa de Cambio */}
          <Dialog open={newRateOpen} onOpenChange={setNewRateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Registrar Tasa Oficial
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva Tasa de Cambio Oficial</DialogTitle>
                <DialogDescription>
                  Registra el tipo de cambio oficial USD a NIO para una fecha determinada.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-3">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="rDate" className="text-right">Fecha</Label>
                  <Input
                    id="rDate"
                    type="date"
                    value={rateDate}
                    onChange={(e) => setRateDate(e.target.value)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="rValue" className="text-right">Tasa (NIO)</Label>
                  <Input
                    id="rValue"
                    type="number"
                    step="0.0001"
                    placeholder="ej. 36.6241"
                    value={rateValue}
                    onChange={(e) => setRateValue(e.target.value)}
                    className="col-span-3 font-mono"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createRateMutation.mutate()}
                  disabled={createRateMutation.isPending || !rateValue}
                >
                  Guardar Tasa
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Dialog Crear Libro */}
          <Dialog open={newBookOpen} onOpenChange={setNewBookOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Landmark className="mr-1.5 h-3.5 w-3.5" />
                Nuevo Libro / Caja
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Libro Contable / Banco</DialogTitle>
                <DialogDescription>
                  Define un nuevo libro o cuenta bancaria auxiliar.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-3">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="bCode" className="text-right">Código</Label>
                  <Input
                    id="bCode"
                    placeholder="ej. BANCO-BAC-NIO"
                    value={bookCode}
                    onChange={(e) => setBookCode(e.target.value)}
                    className="col-span-3 font-mono"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="bName" className="text-right">Nombre</Label>
                  <Input
                    id="bName"
                    placeholder="ej. BAC Cta Cte Córdobas"
                    value={bookName}
                    onChange={(e) => setBookName(e.target.value)}
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createBookMutation.mutate()}
                  disabled={createBookMutation.isPending || !bookCode || !bookName}
                >
                  Guardar Libro
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Tasa de Cambio Vigente (USD a NIO)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <div className="text-2xl font-bold font-mono">
                {latestRate ? `C$ ${Number(latestRate).toFixed(4)}` : "No registrada"}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {rates[0]?.date ? `Fecha: ${rates[0].date}` : "Agrega la tasa de hoy"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Libros y Cuentas Bancarias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{books.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Libros auxiliares configurados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tables Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Exchange Rates History */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Historial de Tasas de Cambio</CardTitle>
            <CardDescription>
              Tipos de cambio oficiales aplicados para conversiones contables.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rates.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No hay tipos de cambio registrados aún.
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Par</TableHead>
                      <TableHead className="text-right">Tasa Oficial</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rates.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.date}</TableCell>
                        <TableCell className="text-xs font-semibold">{r.origin} / {r.destination}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                          C$ {Number(r.rate).toFixed(4)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Books & Bank Accounts */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Libros Auxiliares / Cuentas Bancarias</CardTitle>
            <CardDescription>
              Cajas chicas y cuentas bancarias para tesorería.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {books.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No hay libros registrados aún.
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {books.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono font-medium text-xs">{b.code}</TableCell>
                        <TableCell className="text-xs">{b.name}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={b.active ? "outline" : "secondary"} className="text-xs">
                            {b.active ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
