import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertOctagon, Bell, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  head: () => ({ meta: [{ title: "Notificações — Trivium SST" }, { name: "description", content: "Atualizações dos seus chamados." }, { property: "og:title", content: "Notificações — Trivium SST" }, { property: "og:description", content: "Atualizações dos seus chamados." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Notificacoes,
});

function Notificacoes() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["notifications", me?.id],
    enabled: !!me,
    queryFn: async () => (await supabase.from("notifications").select("*").eq("user_id", me!.id).order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  async function markAll() {
    await supabase.from("notifications").update({ read: true }).eq("user_id", me!.id).eq("read", false);
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["notif-count"] });
  }
  async function markOne(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notif-count"] });
  }
  return (
    <AppShell title="Notificações" actions={<Button variant="outline" size="sm" onClick={markAll}><CheckCheck /> Marcar todas como lidas</Button>}>
      <div className="overflow-hidden rounded-2xl bg-card shadow-card">
        {items.length === 0 ? <p className="p-6 text-muted-foreground">Sem notificações.</p> : (
          <ul className="divide-y">
            {items.map((n) => {
              const Icon = n.kind === "critical" ? AlertOctagon : Bell;
              const inner = (
                <div className={cn("flex gap-3 p-4", !n.read && "bg-secondary/50")}>
                  <Icon className={cn("mt-0.5 size-5 shrink-0", n.kind === "critical" ? "text-destructive" : "text-primary")} />
                  <div className="min-w-0 flex-1">
                    <div className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</div>
                    {n.body && <div className="text-sm text-muted-foreground">{n.body}</div>}
                    <div className="mt-1 text-xs text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}</div>
                  </div>
                </div>
              );
              return <li key={n.id} onClick={() => !n.read && markOne(n.id)}>{n.ticket_id ? <Link to="/chamados/$id" params={{ id: n.ticket_id }}>{inner}</Link> : inner}</li>;
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
