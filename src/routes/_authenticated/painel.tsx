import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FilePlus2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import { OPEN_STATUSES } from "@/lib/domain";
import mascot from "@/assets/mascote_trivium_sem_fundo.png.asset.json";
import checklist from "@/assets/icone_checklist_trivium.png.asset.json";
import { readData } from "@/lib/query-result";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({ meta: [{ title: "Início — Trivium SST" }, { name: "description", content: "Seus chamados de Segurança do Trabalho." }, { property: "og:title", content: "Início — Trivium SST" }, { property: "og:description", content: "Seus chamados de Segurança do Trabalho." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Painel,
});

function Painel() {
  const { data: me } = useMe();
  const { data: tickets = [], error } = useQuery({
    queryKey: ["my-tickets", me?.id],
    enabled: !!me,
    queryFn: async () => {
      if (!me) return [];
      return readData(await supabase.from("tickets").select("id, protocol, title, status, priority, created_at").eq("requester_id", me.id).is("deleted_at", null).order("created_at", { ascending: false }).limit(8)) ?? [];
    },
  });
  const { data: counts, error: countsError } = useQuery({
    queryKey: ["my-ticket-counts", me?.id], enabled: !!me,
    queryFn: async () => {
      if (!me) return { total: 0, open: 0 };
      const [total, open] = await Promise.all([
        supabase.from("tickets").select("id", { count: "exact", head: true }).eq("requester_id", me.id),
        supabase.from("tickets").select("id", { count: "exact", head: true }).eq("requester_id", me.id).in("status", OPEN_STATUSES),
      ]);
      readData(total); readData(open);
      return { total: total.count ?? 0, open: open.count ?? 0 };
    },
  });
  const first = (me?.full_name || me?.username || "").split(" ")[0];

  return (
    <AppShell title={`Olá, ${first}!`} subtitle="Juntos por um ambiente de trabalho mais seguro.">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl bg-hero p-6 text-primary-foreground shadow-card lg:col-span-2 md:p-8">
          <div className="relative z-10 max-w-md">
            <h2 className="text-2xl font-bold">Viu algum risco? Avise a SST.</h2>
            <p className="mt-2 opacity-85">Abra um chamado em poucos minutos. Nosso assistente de IA ajuda você a descrever a situação.</p>
            <Button asChild variant="secondary" className="mt-5">
              <Link to="/novo"><FilePlus2 /> Abrir chamado</Link>
            </Button>
          </div>
          <img src={mascot.url} alt="" className="absolute -bottom-6 right-0 hidden w-56 animate-float sm:block" />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
          <Stat label="Meus chamados abertos" value={counts?.open ?? "—"} />
          <Stat label="Total registrados" value={counts?.total ?? "—"} />
        </div>
      </div>

      <section className="mt-8 rounded-2xl bg-card p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary-deep">Chamados recentes</h2>
          <Link to="/chamados" className="text-sm font-medium text-primary hover:underline">Ver todos</Link>
        </div>
        {(error || countsError) ? <p role="alert" className="text-destructive">Não foi possível carregar seus chamados. Atualize a página para tentar novamente.</p> : tickets.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <img src={checklist.url} alt="" className="size-20" />
            <p className="mt-3 text-muted-foreground">Você ainda não registrou chamados.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link to="/chamados/$id" params={{ id: t.id }} className="flex flex-wrap items-center gap-3 py-3 hover:bg-muted/50 rounded-md px-2">
                  <span className="font-mono text-xs text-muted-foreground">{t.protocol}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{t.title}</span>
                  <PriorityBadge p={t.priority} />
                  <StatusBadge s={t.status} />
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-card p-5 shadow-card">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-3xl font-bold text-primary">{value}</div>
    </div>
  );
}
