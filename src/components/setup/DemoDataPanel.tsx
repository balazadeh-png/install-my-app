import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Database, Trash2, Loader2 } from "lucide-react";

const rpc = supabase.rpc.bind(supabase) as unknown as (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: any; error: { message: string } | null }>;

export function DemoDataPanel() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: demo, refetch } = useQuery({
    queryKey: ["demo_entity"],
    queryFn: async () => {
      const { data } = await supabase
        .from("entities")
        .select("id, name")
        .eq("code", "DEMO-3PL")
        .maybeSingle();
      return data;
    },
  });

  const finish = async () => {
    await refetch();
    await queryClient.invalidateQueries();
    setTimeout(() => window.location.reload(), 800);
  };

  const load = async () => {
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const iso = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      setBusy("Creando empresa demo...");
      const { data: entityId, error } = await rpc("seed_demo_base", { p_start: iso(start) });
      if (error) throw error;
      for (let i = 0; i < 12; i++) {
        const m = new Date(start.getFullYear(), start.getMonth() + i, 1);
        setBusy(`Generando mes ${i + 1} de 12...`);
        const { error: e2 } = await rpc("seed_demo_month", { p_entity: entityId, p_month: iso(m) });
        if (e2) throw e2;
      }
      toast.success("Datos de ejemplo cargados. Selecciona 'Logística Austral Demo SpA' en el selector de empresa.");
      await finish();
    } catch (e: any) {
      toast.error(e.message ?? "Error al cargar datos de ejemplo");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    try {
      setBusy("Eliminando datos de ejemplo...");
      const { error } = await rpc("delete_demo_data");
      if (error) throw error;
      toast.success("Datos de ejemplo eliminados. La base quedó limpia.");
      await finish();
    } catch (e: any) {
      toast.error(e.message ?? "Error al eliminar datos de ejemplo");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">Datos de ejemplo</h3>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
            Empresa ficticia "Logística Austral Demo SpA": transporte de Arica a Punta Arenas para farmacias y
            retail, bodegaje 3PL de electrónica, congelados y secos, e importaciones desde China. 12 meses de
            movimientos (~$100 millones mensuales en ventas). Tus empresas reales no se modifican.
          </p>
        </div>
        {demo ? <Badge>Cargados</Badge> : <Badge variant="secondary">No cargados</Badge>}
      </div>

      {busy && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {busy}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={load} disabled={!!busy || !!demo}>
          <Database className="h-4 w-4 mr-1.5" /> Cargar datos de ejemplo
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={!!busy || !demo}>
              <Trash2 className="h-4 w-4 mr-1.5" /> Eliminar todos los datos de ejemplo
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar los datos de ejemplo?</AlertDialogTitle>
              <AlertDialogDescription>
                Se borrará la empresa "Logística Austral Demo SpA" con todas sus facturas, asientos, guías,
                inventario, rutas y demás registros. Tus empresas reales no se tocan. No se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={remove}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
