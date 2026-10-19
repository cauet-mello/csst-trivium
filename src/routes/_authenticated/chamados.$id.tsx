import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, Bot, Check, FileText, MessageSquare, Paperclip, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import { FLOW, PRIORITIES, STATUSES, isOverdue, priorityLabel, statusLabel } from "@/lib/domain";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chamados/$id")({
  head: () => ({ meta: [{ title: "Detalhe do chamado — Trivium SST" }, { name: "description", content: "Linha do tempo e histórico do chamado." }, { property: "og:title", content: "Detalhe do chamado — Trivium SST" }, { property: "og:description", content: "Linha do tempo e histórico do chamado." }] }),
  component: Detalhe,
});

const dt = (s: string | null) => (s ? format(new Date(s), "dd/MM/yyyy HH:mm") : "-");

function Detalhe() {
  const { id } = Route.useParams();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const { data: t } = useQuery({ queryKey: ["ticket", id], queryFn: async () => (await supabase.from("tickets").select("*").eq("id", id).maybeSingle()).data });
  const { data: events = [] } = useQuery({ queryKey: ["events", id], queryFn: async () => (await supabase.from("ticket_events").select("*").eq("ticket_id", id).order("created_at")).data ?? [] });
  const { data: atts = [] } = useQuery({ queryKey: ["atts", id], queryFn: async () => (await supabase.from("ticket_attachments").select("*").eq("ticket_id", id).order("created_at")).data ?? [] });
  const { data: staff = [] } = useQuery({
    queryKey: ["staff-users"],
    enabled: !!me?.isStaff,
    queryFn: async () => {
      const { data: r } = await supabase.from("user_roles").select("user_id").in("role", ["admin", "developer"]);
      const ids = (r ?? []).map((x) => x.user_id);
      return (await supabase.from("profiles").select("id, full_name, username").in("id", ids)).data ?? [];
    },
  });
  const { data: deps = [] } = useQuery({ queryKey: ["departments"], enabled: !!me?.isStaff, queryFn: async () => (await supabase.from("departments").select("*").eq("active", true).order("name")).data ?? [] });
  const [comment, setComment] = useState("");
  const [solution, setSolution] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["ticket", id] });
    qc.invalidateQueries({ queryKey: ["events", id] });
    qc.invalidateQueries({ queryKey: ["tickets"] });
  };

  async function update(patch: any, okMsg: string) {
    setBusy(true);
    const { error } = await supabase.from("tickets").update(patch).eq("id", id);
    setBusy(false);
    if (error) { toast.error("Não foi possível atualizar."); return; }
    toast.success(okMsg);
    refresh();
  }

  async function addComment() {
    if (!comment.trim()) return;
    const { error } = await supabase.from("ticket_events").insert({ ticket_id: id, actor_id: me!.id, actor_name: me!.full_name || me!.username, event_type: "comment", note: comment.trim().slice(0, 3000) });
    if (error) { toast.error("Falha ao adicionar informação."); return; }
    setComment("");
    refresh();
  }

  async function upload(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      const path = `${me!.id}/${id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const up = await supabase.storage.from("attachments").upload(path, file);
      if (up.error) { toast.error(`Falha ao enviar ${file.name}`); continue; }
      await supabase.from("ticket_attachments").insert({ ticket_id: id, uploaded_by: me!.id, file_name: file.name, storage_path: path, mime_type: file.type, size_bytes: file.size });
    }
    qc.invalidateQueries({ queryKey: ["atts", id] });
    toast.success("Anexo(s) adicionado(s)");
  }

  async function openAtt(path: string) {
    const { data } = await supabase.storage.from("attachments").createSignedUrl(path, 120);
    if (data) window.open(data.signedUrl, "_blank", "noopener");
  }

  if (!t) return <AppShell title="Chamado"><p className="text-muted-foreground">Carregando…</p></AppShell>;
  const flowIdx = FLOW.indexOf(t.status as any);

  return (
    <AppShell title={t.title} subtitle={`${t.protocol} · aberto em ${dt(t.created_at)}`} actions={<Button asChild variant="ghost" size="sm"><Link to="/chamados"><ArrowLeft /> Voltar</Link></Button>}>
      {/* Stepper */}
      <div className="mb-6 rounded-2xl bg-card p-5 shadow-card">
        <ol className="grid grid-cols-5 gap-1">
          {FLOW.map((s, i) => {
            const done = flowIdx >= i;
            const current = flowIdx === i;
            return (
              <li key={s} className="flex flex-col items-center text-center">
                <div className="flex w-full items-center">
                  <div className={cn("h-1 flex-1 rounded", i === 0 ? "invisible" : done ? "bg-primary" : "bg-border")} />
                  <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-all", done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground", current && "ring-4 ring-brand-amber/40")}>
                    {done && !current ? <Check className="size-4" /> : i + 1}
                  </div>
                  <div className={cn("h-1 flex-1 rounded", i === FLOW.length - 1 ? "invisible" : flowIdx > i ? "bg-primary" : "bg-border")} />
                </div>
                <span className={cn("mt-2 text-[11px] leading-tight sm:text-xs", current ? "font-semibold text-primary-deep" : "text-muted-foreground")}>{statusLabel(s)}</span>
              </li>
            );
          })}
        </ol>
        {flowIdx === -1 && <p className="mt-4 text-center text-sm">Status atual: <StatusBadge s={t.status} /></p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="rounded-2xl bg-card p-5 shadow-card">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <PriorityBadge p={t.priority} /><StatusBadge s={t.status} />
              {isOverdue(t) && t.status !== "cancelado" && <span className="text-xs font-semibold text-destructive">Fora do prazo</span>}
            </div>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Info k="Solicitante" v={`${t.requester_name} (mat. ${t.registration})`} />
              <Info k="Setor" v={t.department} />
              <Info k="Local" v={t.location} />
              <Info k="Categoria" v={t.category} />
              <Info k="Responsável" v={t.assignee_name ?? "Não atribuído"} />
              <Info k="Prazo de atendimento" v={dt(t.due_at)} />
              {t.closed_at && <Info k="Encerrado em" v={dt(t.closed_at)} />}
            </dl>
            <h3 className="mt-5 text-sm font-semibold text-muted-foreground">Descrição</h3>
            <p className="mt-1 whitespace-pre-wrap">{t.description}</p>
            {t.observations && <><h3 className="mt-4 text-sm font-semibold text-muted-foreground">Observações</h3><p className="mt-1 whitespace-pre-wrap">{t.observations}</p></>}
            {t.solution && <div className="mt-4 rounded-lg bg-success/10 p-3"><h3 className="text-sm font-semibold text-success">Solução aplicada</h3><p className="mt-1 whitespace-pre-wrap">{t.solution}</p></div>}
            {t.ai_summary && (
              <div className="mt-4 rounded-lg bg-secondary p-3 text-sm">
                <div className="flex items-center gap-2 font-semibold text-primary-deep"><Bot className="size-4" /> Recomendação da IA</div>
                <p className="mt-1">Setor: <b>{t.ai_suggested_department}</b> · Prioridade sugerida: <b>{priorityLabel(t.ai_suggested_priority)}</b></p>
                <p className="mt-1 text-muted-foreground">{t.ai_summary}</p>
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-card p-5 shadow-card">
            <h2 className="mb-4 font-semibold text-primary-deep">Histórico</h2>
            <ol className="relative space-y-5 border-l-2 border-border pl-6">
              {events.map((e) => (
                <li key={e.id} className="relative">
                  <span className={cn("absolute -left-[33px] top-0.5 flex size-4 items-center justify-center rounded-full ring-4 ring-card", e.event_type === "ai_recommendation" ? "bg-brand-amber" : e.event_type === "comment" ? "bg-muted-foreground" : "bg-primary")} />
                  <div className="text-xs text-muted-foreground">{dt(e.created_at)} · {e.actor_name ?? "Sistema"}</div>
                  <div className="text-sm">
                    {e.event_type === "created" && "Chamado enviado"}
                    {e.event_type === "status" && <>Status: {statusLabel(e.from_status)} → <b>{statusLabel(e.to_status)}</b></>}
                    {e.event_type === "priority" && <>Prioridade: {priorityLabel(e.from_priority)} → <b>{priorityLabel(e.to_priority)}</b></>}
                    {e.event_type === "comment" && <span className="flex gap-1.5"><MessageSquare className="mt-0.5 size-3.5 shrink-0" />{e.note}</span>}
                    {["assignee", "forward", "solution", "ai_recommendation"].includes(e.event_type) && <span>{e.event_type === "solution" ? "Solução: " : ""}{e.note}</span>}
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-6 space-y-2">
              <Label>Adicionar informação</Label>
              <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Informações complementares, respostas, observações…" />
              <div className="flex justify-end"><Button size="sm" onClick={addComment} disabled={!comment.trim()}>Adicionar</Button></div>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          {me?.isStaff && (
            <section className="space-y-4 rounded-2xl bg-card p-5 shadow-card">
              <h2 className="font-semibold text-primary-deep">Gerenciar atendimento</h2>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={t.status} onValueChange={(v) => { if (v === "concluido" && !t.solution && !solution.trim()) { toast.error("Registre a solução aplicada antes de concluir."); return; } update(v === "concluido" && solution.trim() ? { status: v, solution: solution.trim() } : { status: v }, "Status atualizado"); }} disabled={busy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select value={t.priority} onValueChange={(v) => update({ priority: v }, "Prioridade atualizada")} disabled={busy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Responsável</Label>
                <Select value={t.assignee_id ?? "none"} onValueChange={(v) => { const p = staff.find((s) => s.id === v); update({ assignee_id: v === "none" ? null : v, assignee_name: p ? p.full_name || p.username : null }, "Responsável atualizado"); }} disabled={busy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Não atribuído</SelectItem>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name || s.username}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Encaminhar para setor</Label>
                <Select value={t.department} onValueChange={(v) => update({ department: v }, "Chamado encaminhado")} disabled={busy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{deps.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Solução aplicada</Label>
                <Textarea rows={3} value={solution} onChange={(e) => setSolution(e.target.value)} placeholder={t.solution ?? "Descreva a solução"} />
                <Button size="sm" variant="outline" className="w-full" disabled={!solution.trim() || busy} onClick={() => { update({ solution: solution.trim() }, "Solução registrada"); setSolution(""); }}>
                  {busy && <Loader2 className="animate-spin" />} Salvar solução
                </Button>
              </div>
            </section>
          )}
          <section className="rounded-2xl bg-card p-5 shadow-card">
            <h2 className="mb-3 font-semibold text-primary-deep">Anexos</h2>
            {atts.length === 0 && <p className="text-sm text-muted-foreground">Nenhum anexo.</p>}
            <ul className="space-y-2">
              {atts.map((a) => (
                <li key={a.id}><button onClick={() => openAtt(a.storage_path)} className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-muted"><FileText className="size-4 text-primary" /><span className="truncate">{a.file_name}</span></button></li>
              ))}
            </ul>
            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-2 text-sm text-muted-foreground hover:bg-muted/50">
              <Paperclip className="size-4" /> Adicionar anexo
              <input type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
            </label>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return <div><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>;
}
