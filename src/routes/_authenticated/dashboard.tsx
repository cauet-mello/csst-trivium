import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertOctagon, Download, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PriorityBadge } from "@/components/badges";
import { PRIORITIES, STATUSES, isOverdue, priorityLabel, statusLabel, OPEN_STATUSES } from "@/lib/domain";
import mascot from "@/assets/mascote_trivium_sem_fundo.png.asset.json";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Trivium SST" }, { name: "description", content: "Indicadores de chamados de Segurança do Trabalho." }, { property: "og:title", content: "Dashboard — Trivium SST" }, { property: "og:description", content: "Indicadores de chamados de Segurança do Trabalho." }] }),
  component: Dashboard,
});

const PCOLOR: Record<string, string> = { critica: "var(--p-critica)", alta: "var(--p-alta)", media: "var(--p-media)", baixa: "var(--p-baixa)" };
const hours = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 36e5;
const fmtH = (h: number | null) => (h == null ? "-" : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} dias`);

function Dashboard() {
  const { data: me } = useMe();
  const [period, setPeriod] = useState("30");
  const [fDep, setFDep] = useState("all");
  const [fPri, setFPri] = useState("all");
  const [fSt, setFSt] = useState("all");
  const [fCat, setFCat] = useState("all");
  const [fResp, setFResp] = useState("all");
  const [fReq, setFReq] = useState("all");

  const { data: all = [] } = useQuery({
    queryKey: ["dash-tickets"],
    enabled: !!me?.isStaff,
    refetchInterval: 30_000,
    queryFn: async () => (await supabase.from("tickets").select("*").order("created_at", { ascending: false }).limit(5000)).data ?? [],
  });

  const uniq = (k: "department" | "category" | "assignee_name" | "requester_name") => Array.from(new Set(all.map((t) => t[k]).filter(Boolean))) as string[];

  const data = useMemo(() => {
    const since = period === "all" ? null : subDays(new Date(), Number(period));
    return all.filter((t) =>
      (!since || new Date(t.created_at) >= since) &&
      (fDep === "all" || t.department === fDep) && (fPri === "all" || t.priority === fPri) && (fSt === "all" || t.status === fSt) &&
      (fCat === "all" || t.category === fCat) && (fResp === "all" || t.assignee_name === fResp) && (fReq === "all" || t.requester_name === fReq));
  }, [all, period, fDep, fPri, fSt, fCat, fResp, fReq]);

  const k = useMemo(() => {
    const count = (fn: (t: (typeof data)[number]) => boolean) => data.filter(fn).length;
    const resp = data.filter((t) => t.received_at).map((t) => hours(t.created_at, t.received_at!));
    const reso = data.filter((t) => t.closed_at && t.status === "concluido").map((t) => hours(t.created_at, t.closed_at!));
    const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    const group = (key: "department" | "category" | "requester_name") => {
      const m = new Map<string, number>();
      data.forEach((t) => m.set(t[key], (m.get(t[key]) ?? 0) + 1));
      return Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
    };
    const days = new Map<string, number>();
    data.forEach((t) => { const d = format(new Date(t.created_at), "dd/MM"); days.set(d, (days.get(d) ?? 0) + 1); });
    return {
      total: data.length,
      abertos: count((t) => ["enviado", "recebido"].includes(t.status)),
      analise: count((t) => t.status === "em_analise"),
      andamento: count((t) => t.status === "em_andamento"),
      concluidos: count((t) => t.status === "concluido"),
      criticosPend: data.filter((t) => t.priority === "critica" && OPEN_STATUSES.includes(t.status as any)),
      ia: count((t) => t.ai_redirected || (t.ai_suggested_department != null && t.ai_suggested_department !== "Segurança do Trabalho")),
      atrasados: count((t) => isOverdue(t) && OPEN_STATUSES.includes(t.status as any)),
      avgResp: avg(resp), avgReso: avg(reso),
      porPrioridade: PRIORITIES.map((p) => ({ name: p.label, key: p.value, value: count((t) => t.priority === p.value) })),
      porSetor: group("department"), porCategoria: group("category"), porColab: group("requester_name"),
      linha: Array.from(days, ([name, value]) => ({ name, value })).reverse(),
    };
  }, [data]);

  function rowsForExport() {
    return data.map((t) => ({
      Protocolo: t.protocol, Título: t.title, Solicitante: t.requester_name, Matrícula: t.registration, Setor: t.department, Local: t.location,
      Categoria: t.category, Prioridade: priorityLabel(t.priority), Status: statusLabel(t.status), Responsável: t.assignee_name ?? "",
      Abertura: format(new Date(t.created_at), "dd/MM/yyyy HH:mm"), Encerramento: t.closed_at ? format(new Date(t.closed_at), "dd/MM/yyyy HH:mm") : "",
      "Fora do prazo": isOverdue(t) ? "Sim" : "Não", "Setor sugerido IA": t.ai_suggested_department ?? "",
    }));
  }
  async function exportXlsx() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsForExport()), "Chamados");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { Indicador: "Total", Valor: k.total }, { Indicador: "Abertos", Valor: k.abertos }, { Indicador: "Em análise", Valor: k.analise },
      { Indicador: "Em andamento", Valor: k.andamento }, { Indicador: "Concluídos", Valor: k.concluidos }, { Indicador: "Críticos pendentes", Valor: k.criticosPend.length },
      { Indicador: "Encaminhados pela IA", Valor: k.ia }, { Indicador: "Fora do prazo", Valor: k.atrasados },
      { Indicador: "Tempo médio de atendimento", Valor: fmtH(k.avgResp) }, { Indicador: "Tempo médio de resolução", Valor: fmtH(k.avgReso) },
    ]), "Indicadores");
    XLSX.writeFile(wb, `chamados-sst-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`);
  }
  async function exportPdf() {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16); doc.text("Trivium Indústrias — Relatório de Chamados SST", 14, 16);
    doc.setFontSize(10); doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")} · Total: ${k.total} · Concluídos: ${k.concluidos} · Críticos pendentes: ${k.criticosPend.length} · Fora do prazo: ${k.atrasados}`, 14, 23);
    const rows = rowsForExport();
    autoTable(doc, {
      startY: 28, styles: { fontSize: 7 }, headStyles: { fillColor: [42, 81, 117] },
      head: [["Protocolo", "Título", "Solicitante", "Setor", "Categoria", "Prioridade", "Status", "Responsável", "Abertura"]],
      body: rows.map((r) => [r.Protocolo, r.Título, r.Solicitante, r.Setor, r.Categoria, r.Prioridade, r.Status, r.Responsável, r.Abertura]),
    });
    doc.save(`chamados-sst-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`);
  }

  if (me && !me.isStaff) return <AppShell title="Dashboard"><p>Acesso restrito à administração.</p></AppShell>;

  const F = ({ v, set, ph, opts }: { v: string; set: (s: string) => void; ph: string; opts: { value: string; label: string }[] }) => (
    <Select value={v} onValueChange={set}>
      <SelectTrigger className="h-9 bg-card"><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="all">{ph}</SelectItem>{opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
    </Select>
  );
  const toOpts = (a: string[]) => a.map((x) => ({ value: x, label: x }));

  return (
    <AppShell title="Dashboard gerencial" actions={<><Button variant="outline" size="sm" onClick={exportXlsx}><FileSpreadsheet /> Excel</Button><Button variant="outline" size="sm" onClick={exportPdf}><Download /> PDF</Button></>}>
      <div className="relative mb-6 overflow-hidden rounded-2xl bg-hero p-6 text-primary-foreground shadow-card">
        <p className="text-sm opacity-80">Segurança do Trabalho · Trivium Indústrias</p>
        <p className="mt-1 font-display text-2xl font-bold">{k.total} chamados no período</p>
        <p className="mt-1 text-sm opacity-85">Atualizado automaticamente a cada 30 segundos.</p>
        <img src={mascot.url} alt="" className="absolute -bottom-10 right-2 hidden w-44 md:block" />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
        <F v={period} set={setPeriod} ph="Todo o período" opts={[{ value: "7", label: "Últimos 7 dias" }, { value: "30", label: "Últimos 30 dias" }, { value: "90", label: "Últimos 90 dias" }, { value: "365", label: "Último ano" }]} />
        <F v={fDep} set={setFDep} ph="Todos os setores" opts={toOpts(uniq("department"))} />
        <F v={fReq} set={setFReq} ph="Todos colaboradores" opts={toOpts(uniq("requester_name"))} />
        <F v={fResp} set={setFResp} ph="Todos responsáveis" opts={toOpts(uniq("assignee_name"))} />
        <F v={fPri} set={setFPri} ph="Todas prioridades" opts={PRIORITIES.map((p) => ({ value: p.value, label: p.label }))} />
        <F v={fSt} set={setFSt} ph="Todos os status" opts={STATUSES.map((p) => ({ value: p.value, label: p.label }))} />
        <F v={fCat} set={setFCat} ph="Todas categorias" opts={toOpts(uniq("category"))} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-5">
        <Kpi label="Total" v={k.total} />
        <Kpi label="Abertos" v={k.abertos} />
        <Kpi label="Em análise" v={k.analise} />
        <Kpi label="Em andamento" v={k.andamento} />
        <Kpi label="Concluídos" v={k.concluidos} tone="success" />
        <Kpi label="Críticos pendentes" v={k.criticosPend.length} tone="danger" />
        <Kpi label="Fora do prazo" v={k.atrasados} tone="danger" />
        <Kpi label="Encaminhados pela IA" v={k.ia} />
        <Kpi label="Tempo médio de atendimento" v={fmtH(k.avgResp)} />
        <Kpi label="Tempo médio de resolução" v={fmtH(k.avgReso)} />
      </div>

      {k.criticosPend.length > 0 && (
        <section className="mt-6 rounded-2xl border-2 border-p-critica/40 bg-p-critica/5 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-p-critica"><AlertOctagon className="size-5" /> Chamados críticos pendentes</h2>
          <ul className="mt-3 divide-y divide-p-critica/20">
            {k.criticosPend.slice(0, 8).map((t) => (
              <li key={t.id}><Link to="/chamados/$id" params={{ id: t.id }} className="flex flex-wrap items-center gap-3 py-2 hover:underline">
                <span className="font-mono text-xs">{t.protocol}</span><span className="flex-1 font-medium">{t.title}</span><span className="text-xs text-muted-foreground">{t.location}</span>
              </Link></li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Chart title="Chamados por prioridade">
          <BarChart data={k.porPrioridade}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} /><Tooltip />
            <Bar dataKey="value" name="Chamados" radius={[6, 6, 0, 0]}>{k.porPrioridade.map((p) => <Cell key={p.key} fill={PCOLOR[p.key]!} />)}</Bar></BarChart>
        </Chart>
        <Chart title="Evolução de abertura">
          <LineChart data={k.linha}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} /><Tooltip /><Line type="monotone" dataKey="value" name="Chamados" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} /></LineChart>
        </Chart>
        <Chart title="Solicitações por setor"><HBar data={k.porSetor} color="var(--chart-1)" /></Chart>
        <Chart title="Principais categorias"><HBar data={k.porCategoria} color="var(--chart-2)" /></Chart>
      </div>

      <section className="mt-6 rounded-2xl bg-card p-5 shadow-card">
        <h2 className="mb-3 font-semibold text-primary-deep">Solicitações por colaborador</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Colaborador</th><th className="py-2 text-right">Chamados</th></tr></thead>
            <tbody>{k.porColab.map((r) => <tr key={r.name} className="border-b last:border-0"><td className="py-2">{r.name}</td><td className="py-2 text-right font-semibold">{r.value}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-2xl bg-card p-5 shadow-card">
        <h2 className="mb-3 font-semibold text-primary-deep">Últimos chamados</h2>
        <ul className="divide-y">
          {data.slice(0, 10).map((t) => (
            <li key={t.id}><Link to="/chamados/$id" params={{ id: t.id }} className="flex flex-wrap items-center gap-3 py-2 hover:bg-muted/50">
              <span className="font-mono text-xs text-muted-foreground">{t.protocol}</span><span className="min-w-0 flex-1 truncate">{t.title}</span><PriorityBadge p={t.priority} /><span className="text-xs text-muted-foreground">{statusLabel(t.status)}</span>
            </Link></li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}

function Kpi({ label, v, tone }: { label: string; v: number | string; tone?: "danger" | "success" }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-card">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-2xl font-bold ${tone === "danger" ? "text-destructive" : tone === "success" ? "text-success" : "text-primary"}`}>{v}</div>
    </div>
  );
}
function Chart({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <section className="rounded-2xl bg-card p-5 shadow-card">
      <h2 className="mb-3 font-semibold text-primary-deep">{title}</h2>
      <div className="h-64"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>
    </section>
  );
}
function HBar({ data, color }: { data: { name: string; value: number }[]; color: string }) {
  return (
    <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
      <CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} fontSize={12} /><YAxis type="category" dataKey="name" width={130} fontSize={11} /><Tooltip />
      <Bar dataKey="value" name="Chamados" fill={color} radius={[0, 6, 6, 0]} />
    </BarChart>
  );
}
