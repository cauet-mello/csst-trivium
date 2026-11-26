import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AlarmClock, Search } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import { PRIORITIES, STATUSES, isDueSoon, isOverdue, type Priority, type Status } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { readData } from "@/lib/query-result";

export const Route = createFileRoute("/_authenticated/chamados/")({
  head: () => ({ meta: [{ title: "Chamados — Trivium SST" }, { name: "description", content: "Consulta e histórico de chamados." }, { property: "og:title", content: "Chamados — Trivium SST" }, { property: "og:description", content: "Consulta e histórico de chamados." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Lista,
});

const PRI_ORDER: Record<string, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };

const PAGE = 25;

function Lista() {
  const { data: me } = useMe();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [prio, setPrio] = useState("all");
  const [page, setPage] = useState(0);
  useEffect(() => { const h = setTimeout(() => { setSearch(q.trim()); setPage(0); }, 350); return () => clearTimeout(h); }, [q]);
  const { data, isLoading, error } = useQuery({
    queryKey: ["tickets", me?.id, me?.isStaff, search, status, prio, page],
    enabled: !!me,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!me) return { rows: [], count: 0 };
      let qb = supabase.from("tickets").select("id, protocol, title, status, priority, department, requester_name, assignee_name, created_at, due_at, closed_at", { count: "exact" }).is("deleted_at", null);
      if (!me.isStaff) qb = qb.eq("requester_id", me.id);
      if (status !== "all") qb = qb.eq("status", status as Status);
      if (prio !== "all") qb = qb.eq("priority", prio as Priority);
      if (search) {
        const term = search.replace(/[,%()*\\]/g, " ").slice(0, 80);
        qb = qb.or(["protocol", "title", "requester_name", "department"].map((c) => `${c}.ilike.%${term}%`).join(","));
      }
      if (me.isStaff) qb = qb.order("priority", { ascending: true });
      const res = await qb.order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
      return { rows: readData(res) ?? [], count: res.count ?? 0 };
    },
  });
  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <AppShell title={me?.isStaff ? "Gestão de chamados" : "Meus chamados"} subtitle="Consulte protocolos, status e histórico.">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar protocolo, título, colaborador…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
          <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os status</SelectItem>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={prio} onValueChange={(v) => { setPrio(v); setPage(0); }}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas prioridades</SelectItem>{PRIORITIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="overflow-hidden rounded-2xl bg-card shadow-card">
        {error ? <p role="alert" className="p-6 text-destructive">Não foi possível carregar os chamados. Atualize a página para tentar novamente.</p> : isLoading ? <p className="p-6 text-muted-foreground">Carregando…</p> : rows.length === 0 ? <p className="p-6 text-muted-foreground">Nenhum chamado encontrado.</p> : (
          <ul className="divide-y">
            {rows.map((t) => (
              <li key={t.id}>
                <Link to="/chamados/$id" params={{ id: t.id }} className={`grid gap-2 px-4 py-3 hover:bg-muted/50 md:grid-cols-[130px_1fr_auto_auto] md:items-center ${t.priority === "critica" && t.status !== "concluido" && t.status !== "cancelado" ? "border-l-4 border-p-critica" : "border-l-4 border-transparent"}`}>
                  <span className="font-mono text-xs text-muted-foreground">{t.protocol}</span>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">{t.requester_name} · {t.department} · {format(new Date(t.created_at), "dd/MM/yyyy HH:mm")}{t.assignee_name ? ` · Resp.: ${t.assignee_name}` : ""}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOverdue(t) && t.status !== "cancelado" && <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive"><AlarmClock className="size-3.5" /> Fora do prazo</span>}
                    {isDueSoon(t) && <span className="inline-flex items-center gap-1 text-xs font-medium text-p-alta"><AlarmClock className="size-3.5" /> Vence em breve</span>}
                    <PriorityBadge p={t.priority} />
                  </div>
                  <StatusBadge s={t.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      {total > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} chamado(s) · página {page + 1} de {pages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
