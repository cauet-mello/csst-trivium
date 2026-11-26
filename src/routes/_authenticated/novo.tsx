import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, Paperclip, Sparkles, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { AppShell } from "@/components/app-shell";
import { AiAssistant } from "@/components/ai-assistant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PriorityBadge } from "@/components/badges";
import { PRIORITIES, type Priority } from "@/lib/domain";
import { triageTicket } from "@/lib/ai.functions";
import { saveTicketAttachment, validateAttachment } from "@/lib/attachments";
import { readData } from "@/lib/query-result";

export const Route = createFileRoute("/_authenticated/novo")({
  head: () => ({ meta: [{ title: "Abrir chamado — Trivium SST" }, { name: "description", content: "Registre um novo chamado de Segurança do Trabalho." }, { property: "og:title", content: "Abrir chamado — Trivium SST" }, { property: "og:description", content: "Registre um novo chamado de Segurança do Trabalho." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: NovoChamado,
});

const schema = z.object({
  requester_name: z.string().trim().min(2, "Informe seu nome").max(120),
  registration: z.string().trim().min(1, "Informe a matrícula").max(40),
  department: z.string().trim().min(1, "Informe o setor").max(80),
  location: z.string().trim().min(2, "Informe o local").max(200),
  category: z.string().min(1, "Escolha a categoria"),
  title: z.string().trim().min(5, "Título muito curto").max(200),
  description: z.string().trim().min(15, "Descreva com mais detalhes (mín. 15 caracteres)").max(5000),
  observations: z.string().max(2000).optional(),
});

type Triage = { is_safety_related: boolean; confidence: string; recommended_department: string; suggested_priority: Priority; risks: string[]; summary: string; improved_description: string; message_to_user: string; needs_human_review: boolean };

function NovoChamado() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const triage = useServerFn(triageTicket);
  const [f, setF] = useState({ requester_name: "", registration: "", department: "", location: "", category: "", title: "", description: "", observations: "" });
  const [priority, setPriority] = useState<Priority>("media");
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ai, setAi] = useState<Triage | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (me) setF((s) => ({ ...s, requester_name: s.requester_name || me.full_name, registration: s.registration || me.registration || "", department: s.department || me.department || "" }));
  }, [me]);

  const { data: cats = [], error: catsError } = useQuery({ queryKey: ["categories"], queryFn: async () => readData(await supabase.from("categories").select("*").eq("active", true).order("name")) ?? [] });
  const { data: deps = [], error: depsError } = useQuery({ queryKey: ["departments"], queryFn: async () => readData(await supabase.from("departments").select("*").eq("active", true).order("name")) ?? [] });

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function analyze() {
    if (f.description.trim().length < 10) { toast.info("Descreva a situação primeiro (mín. 10 caracteres)."); return; }
    setAiLoading(true);
    const r = await triage({ data: { title: f.title, description: f.description, category: f.category, location: f.location } }).catch(() => null);
    setAiLoading(false);
    if (!r || !r.ok) { toast.error(r && !r.ok ? r.error : "Falha na análise"); return; }
    setAi(r.triage as Triage);
    setPriority(r.triage.suggested_priority);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!me) { toast.error("Aguarde o carregamento da sua conta e tente novamente."); return; }
    try { files.forEach(validateAttachment); } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verifique os anexos."); return;
    }
    const parsed = schema.safeParse(f);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
      setErrors(errs);
      { toast.error("Verifique os campos obrigatórios."); return; }
    }
    setErrors({});
    setSaving(true);
    try {
    const v = parsed.data;
    const { data: t, error } = await supabase
      .from("tickets")
      .insert({
        requester_id: me.id, requester_name: v.requester_name, registration: v.registration, department: v.department,
        location: v.location, category: v.category, title: v.title, description: v.description, observations: v.observations || null,
        priority,
        ai_suggested_priority: ai?.suggested_priority ?? null,
        ai_suggested_department: ai?.recommended_department ?? null,
        ai_is_safety: ai?.is_safety_related ?? null,
        ai_summary: ai ? `${ai.summary}${ai.risks.length ? " Riscos: " + ai.risks.join("; ") : ""}` : null,
        ai_redirected: ai ? !ai.is_safety_related : false,
      })
      .select("id, protocol")
      .single();
    if (error || !t) {
      setSaving(false);
      { toast.error("Não foi possível registrar o chamado."); return; }
    }
    let failedAttachments = 0;
    for (const file of files) {
      try { await saveTicketAttachment(file, me.id, t.id); }
      catch { failedAttachments++; }
    }
    toast.success(`Chamado ${t.protocol} registrado!`);
    if (failedAttachments) toast.error(`${failedAttachments} anexo(s) não foram enviados. O chamado foi salvo; tente anexá-los novamente no detalhe.`);
    await navigate({ to: "/chamados/$id", params: { id: t.id } });
    } catch {
      toast.error("Não foi possível registrar o chamado. Tente novamente.");
    } finally { setSaving(false); }
  }

  const Err = ({ k }: { k: string }) => (errors[k] ? <p className="text-xs text-destructive">{errors[k]}</p> : null);

  return (
    <AppShell title="Abrir chamado" subtitle="Preencha as informações. Campos com * são obrigatórios.">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <form onSubmit={submit} className="min-w-0 space-y-6 rounded-2xl bg-card p-5 shadow-card md:p-7">
          {(catsError || depsError) && <p role="alert" className="text-sm text-destructive">Não foi possível carregar as opções. Atualize a página para tentar novamente.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome do colaborador *"><Input value={f.requester_name} onChange={set("requester_name")} /><Err k="requester_name" /></Field>
            <Field label="Matrícula *"><Input value={f.registration} onChange={set("registration")} /><Err k="registration" /></Field>
            <Field label="Setor / departamento *">
              <Select value={f.department} onValueChange={(v) => setF((s) => ({ ...s, department: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{deps.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
              <Err k="department" />
            </Field>
            <Field label="Local da ocorrência *"><Input placeholder="Ex.: Pavilhão 2, linha de envase" value={f.location} onChange={set("location")} /><Err k="location" /></Field>
            <Field label="Categoria *">
              <Select value={f.category} onValueChange={(v) => { setF((s) => ({ ...s, category: v })); const c = cats.find((x) => x.name === v); if (c && !ai) setPriority(c.default_priority as Priority); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              <Err k="category" />
            </Field>
            <Field label="Prioridade inicial">
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label} — {p.desc}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Título da solicitação *"><Input value={f.title} onChange={set("title")} placeholder="Resumo em poucas palavras" /><Err k="title" /></Field>
          <Field label="Descrição detalhada *">
            <Textarea rows={6} value={f.description} onChange={set("description")} placeholder="O que está acontecendo? Quem está exposto? Desde quando?" />
            <Err k="description" />
          </Field>

          <div className="rounded-xl border border-dashed border-primary/30 bg-secondary/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-primary-deep"><Sparkles className="size-4 text-brand-amber" /> Triagem inteligente</div>
              <Button type="button" variant="outline" size="sm" onClick={analyze} disabled={aiLoading}>
                {aiLoading ? <Loader2 className="animate-spin" /> : <Sparkles />} Analisar com IA
              </Button>
            </div>
            {ai && (
              <div className="mt-4 space-y-3 text-sm animate-fade-up">
                <div className={`flex gap-2 rounded-lg p-3 ${ai.is_safety_related ? "bg-success/10 text-success" : "bg-p-alta/10 text-p-alta"}`}>
                  {ai.is_safety_related ? <CheckCircle2 className="size-5 shrink-0" /> : <AlertTriangle className="size-5 shrink-0" />}
                  <p>{ai.message_to_user}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-muted-foreground">Setor sugerido:</span> <b>{ai.recommended_department}</b>
                  <span className="text-muted-foreground">Prioridade:</span> <PriorityBadge p={ai.suggested_priority} />
                </div>
                {ai.risks.length > 0 && <ul className="list-disc pl-5 text-muted-foreground">{ai.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>}
                {ai.improved_description && (
                  <div className="rounded-lg bg-card p-3">
                    <div className="mb-1 text-xs font-semibold text-muted-foreground">Descrição sugerida</div>
                    <p>{ai.improved_description}</p>
                    <Button type="button" size="sm" variant="ghost" className="mt-1 px-0 text-primary" onClick={() => setF((s) => ({ ...s, description: ai.improved_description }))}>Usar esta descrição</Button>
                  </div>
                )}
                {(!ai.is_safety_related || ai.needs_human_review) && (
                  <p className="flex gap-2 text-xs text-muted-foreground"><Info className="size-4 shrink-0" /> Você ainda pode registrar o chamado: ele será avaliado por um profissional de Segurança do Trabalho.</p>
                )}
              </div>
            )}
          </div>

          <Field label="Observações"><Textarea rows={2} value={f.observations} onChange={set("observations")} /></Field>
          <Field label="Anexos (imagens e documentos)">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:bg-muted/50">
              <Paperclip className="size-4" /> {files.length ? `${files.length} arquivo(s) selecionado(s)` : "Clique para anexar (até 20 MB cada)"}
              <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" className="hidden" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
            </label>
          </Field>
          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={saving || !me || !!catsError || !!depsError}>{saving && <Loader2 className="animate-spin" />} Registrar chamado</Button>
          </div>
        </form>
        <div className="min-w-0 xl:sticky xl:top-24 xl:self-start"><AiAssistant /></div>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
