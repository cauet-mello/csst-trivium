import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { format, addDays } from "date-fns";
import { toast } from "sonner";
import { RotateCcw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/badges";
import { readData } from "@/lib/query-result";

export const Route = createFileRoute("/_authenticated/lixeira")({
  head: () => ({ meta: [{ title: "Lixeira — Trivium SST" }, { name: "description", content: "Chamados excluídos que ainda podem ser restaurados." }, { property: "og:title", content: "Lixeira — Trivium SST" }, { property: "og:description", content: "Chamados excluídos que ainda podem ser restaurados." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Trash,
});

async function removeFiles(paths: string[] | null) {
  if (!paths?.length) return true;
  const { error } = await supabase.storage.from("attachments").remove(paths);
  return !error;
}

function Trash() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { data = [], error, isPending } = useQuery({
    queryKey: ["trash"],
    enabled: !!me?.isStaff,
    queryFn: async () => readData(await supabase.from("tickets").select("id, protocol, title, status, deleted_at, deleted_by_name").not("deleted_at", "is", null).order("deleted_at", { ascending: false })) ?? [],
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["trash"] }); qc.invalidateQueries({ queryKey: ["tickets"] }); qc.invalidateQueries({ queryKey: ["dash-tickets"] }); };

  useEffect(() => {
    if (!me?.isStaff) return;
    (async () => {
      const { data: paths, error } = await supabase.rpc("purge_tickets", {});
      if (!error && paths?.length) { await removeFiles(paths); refresh(); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.isStaff]);

  async function restore(id: string) {
    setBusy(true);
    const { error } = await supabase.rpc("restore_ticket", { _ticket: id });
    setBusy(false);
    if (error) { toast.error(error.message || "Não foi possível restaurar."); return; }
    toast.success("Chamado restaurado."); refresh();
  }
  async function purge(id: string) {
    setBusy(true);
    const { data: paths, error } = await supabase.rpc("purge_tickets", { _ticket: id });
    if (!error && !(await removeFiles(paths))) toast.warning("Chamado apagado, mas alguns anexos não puderam ser removidos.");
    setBusy(false);
    if (error) { toast.error(error.message || "Não foi possível apagar."); return; }
    toast.success("Chamado apagado de vez."); refresh();
  }

  if (!me) return <AppShell title="Lixeira"><p>Carregando acesso…</p></AppShell>;
  if (!me.isStaff) return <AppShell title="Lixeira"><p>Acesso restrito à administração.</p></AppShell>;
  return (
    <AppShell title="Lixeira" subtitle="Chamados excluídos ficam aqui por 30 dias e depois são apagados de vez.">
      <div className="overflow-hidden rounded-2xl bg-card shadow-card">
        {error ? <p role="alert" className="p-6 text-destructive">Não foi possível carregar a lixeira.</p> : isPending ? <p className="p-6 text-muted-foreground">Carregando…</p> : data.length === 0 ? <p className="p-6 text-muted-foreground">A lixeira está vazia.</p> : (
          <ul className="divide-y">
            {data.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="font-mono text-xs text-muted-foreground">{t.protocol}</span>
                <div className="min-w-0 flex-1">
                  <Link to="/chamados/$id" params={{ id: t.id }} className="truncate font-medium hover:underline">{t.title}</Link>
                  <div className="text-xs text-muted-foreground">Excluído por {t.deleted_by_name ?? "-"} em {format(new Date(t.deleted_at!), "dd/MM/yyyy HH:mm")} · apagado de vez em {format(addDays(new Date(t.deleted_at!), 30), "dd/MM/yyyy")}</div>
                </div>
                <StatusBadge s={t.status} />
                <Button size="sm" variant="outline" disabled={busy} onClick={() => restore(t.id)}><RotateCcw /> Restaurar</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button size="sm" variant="destructive" disabled={busy}><Trash2 /> Apagar de vez</Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Apagar {t.protocol} de vez?</AlertDialogTitle><AlertDialogDescription>O chamado, o histórico e os anexos serão apagados definitivamente. Não dá para desfazer.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Voltar</AlertDialogCancel><AlertDialogAction onClick={() => purge(t.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Apagar</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
