import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITIES, priorityLabel, type Priority } from "@/lib/domain";
import { readData } from "@/lib/query-result";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Trivium SST" }, { name: "description", content: "Categorias, setores, regras do Trivito e prazos de atendimento." }, { property: "og:title", content: "Configurações — Trivium SST" }, { property: "og:description", content: "Categorias, setores, regras do Trivito e prazos de atendimento." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Settings,
});

const BLOCKED_DEPARTMENTS = ["facilities"];

function Settings() {
  const { data: me } = useMe();
  if (!me) return <AppShell title="Configurações"><p>Carregando acesso…</p></AppShell>;
  if (!me.isStaff) return <AppShell title="Configurações"><p>Acesso restrito à administração.</p></AppShell>;
  return (
    <AppShell title="Configurações" subtitle="Ajuste categorias, setores, as regras que o Trivito segue e os prazos.">
      <Tabs defaultValue="cat">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="cat">Categorias</TabsTrigger>
          <TabsTrigger value="dep">Setores</TabsTrigger>
          <TabsTrigger value="rules">Regras do Trivito</TabsTrigger>
          <TabsTrigger value="sla">Prazos</TabsTrigger>
        </TabsList>
        <TabsContent value="cat"><Categories /></TabsContent>
        <TabsContent value="dep"><Departments /></TabsContent>
        <TabsContent value="rules"><Rules /></TabsContent>
        <TabsContent value="sla"><Sla /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

const card = "rounded-2xl bg-card p-5 shadow-card";
function useInvalidate(keys: string[]) { const qc = useQueryClient(); return () => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); }
function done(error: unknown, ok: string) { if (error) { toast.error("Não foi possível salvar."); return false; } toast.success(ok); return true; }

function Categories() {
  const inv = useInvalidate(["cfg-cat", "categories"]);
  const { data = [], error } = useQuery({ queryKey: ["cfg-cat"], queryFn: async () => readData(await supabase.from("categories").select("*").order("name")) ?? [] });
  const [name, setName] = useState(""); const [prio, setPrio] = useState<Priority>("media");
  async function add() {
    if (!name.trim()) return;
    if (data.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) { toast.error("Essa categoria já existe."); return; }
    const { error } = await supabase.from("categories").insert({ name: name.trim().slice(0, 120), default_priority: prio });
    if (done(error, "Categoria adicionada.")) { setName(""); inv(); }
  }
  if (error) return <p role="alert">Não foi possível carregar as categorias.</p>;
  return (
    <div className={card}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Nova categoria" value={name} onChange={(e) => setName(e.target.value)} />
        <PrioSelect v={prio} set={setPrio} />
        <Button onClick={add}><Plus /> Adicionar</Button>
      </div>
      <ul className="divide-y">
        {data.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 py-2">
            <span className="flex-1 font-medium">{c.name}</span>
            <PrioSelect v={c.default_priority} set={async (p) => { const { error } = await supabase.from("categories").update({ default_priority: p }).eq("id", c.id); if (done(error, "Prioridade padrão atualizada.")) inv(); }} />
            <Toggle checked={c.active} onChange={async (v) => { const { error } = await supabase.from("categories").update({ active: v }).eq("id", c.id); if (done(error, v ? "Categoria ativada." : "Categoria desativada.")) inv(); }} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Departments() {
  const inv = useInvalidate(["cfg-dep", "departments"]);
  const { data = [], error } = useQuery({ queryKey: ["cfg-dep"], queryFn: async () => readData(await supabase.from("departments").select("*").order("name")) ?? [] });
  const [name, setName] = useState("");
  async function add() {
    const n = name.trim();
    if (!n) return;
    if (BLOCKED_DEPARTMENTS.includes(n.toLowerCase())) { toast.error("Facilities foi unificado em Manutenção."); return; }
    if (data.some((d) => d.name.toLowerCase() === n.toLowerCase())) { toast.error("Esse setor já existe."); return; }
    const { error } = await supabase.from("departments").insert({ name: n.slice(0, 120) });
    if (done(error, "Setor adicionado.")) { setName(""); inv(); }
  }
  if (error) return <p role="alert">Não foi possível carregar os setores.</p>;
  return (
    <div className={card}>
      <div className="mb-4 flex gap-2"><Input placeholder="Novo setor" value={name} onChange={(e) => setName(e.target.value)} /><Button onClick={add}><Plus /> Adicionar</Button></div>
      <ul className="divide-y">
        {data.map((d) => {
          const blocked = BLOCKED_DEPARTMENTS.includes(d.name.toLowerCase());
          return (
            <li key={d.id} className="flex items-center gap-3 py-2">
              <span className="flex-1 font-medium">{d.name}{blocked && <span className="ml-2 text-xs text-muted-foreground">unificado em Manutenção</span>}</span>
              <Toggle checked={d.active} disabled={blocked && !d.active} onChange={async (v) => { const { error } = await supabase.from("departments").update({ active: v }).eq("id", d.id); if (done(error, v ? "Setor ativado." : "Setor desativado.")) inv(); }} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Rules() {
  const inv = useInvalidate(["cfg-rules"]);
  const { data = [], error } = useQuery({ queryKey: ["cfg-rules"], queryFn: async () => readData(await supabase.from("routing_rules").select("*").order("topic")) ?? [] });
  const { data: deps = [] } = useQuery({ queryKey: ["cfg-dep"], queryFn: async () => readData(await supabase.from("departments").select("*").order("name")) ?? [] });
  const active = deps.filter((d) => d.active);
  const [topic, setTopic] = useState(""); const [dep, setDep] = useState(""); const [notes, setNotes] = useState(""); const [safety, setSafety] = useState(false);
  async function add() {
    if (!topic.trim() || !dep) { toast.error("Informe o assunto e o setor."); return; }
    const { error } = await supabase.from("routing_rules").insert({ topic: topic.trim().slice(0, 200), department: dep, notes: notes.trim().slice(0, 500) || null, involves_safety: safety });
    if (done(error, "Regra adicionada. O Trivito já passa a seguir.")) { setTopic(""); setNotes(""); setSafety(false); inv(); }
  }
  if (error) return <p role="alert">Não foi possível carregar as regras.</p>;
  return (
    <div className={card}>
      <p className="mb-3 text-sm text-muted-foreground">O Trivito usa estas regras para sugerir o setor certo de cada chamado.</p>
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_200px]">
        <Input placeholder="Assunto (ex.: vazamento de água)" value={topic} onChange={(e) => setTopic(e.target.value)} />
        <Select value={dep} onValueChange={setDep}><SelectTrigger><SelectValue placeholder="Setor" /></SelectTrigger><SelectContent>{active.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent></Select>
        <Input placeholder="Observação (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex items-center justify-between gap-2"><label className="flex items-center gap-2 text-sm"><Switch checked={safety} onCheckedChange={setSafety} /> Envolve segurança</label><Button onClick={add}><Plus /> Adicionar</Button></div>
      </div>
      <ul className="divide-y">
        {data.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 py-2">
            <div className="min-w-0 flex-1"><div className="font-medium">{r.topic} → {r.department}</div><div className="text-xs text-muted-foreground">{r.involves_safety ? "Envolve segurança · " : ""}{r.notes ?? ""}</div></div>
            <Toggle checked={r.active} onChange={async (v) => { const { error } = await supabase.from("routing_rules").update({ active: v }).eq("id", r.id); if (done(error, v ? "Regra ativada." : "Regra desativada.")) inv(); }} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Sla() {
  const inv = useInvalidate(["cfg-sla"]);
  const { data = [], error } = useQuery({ queryKey: ["cfg-sla"], queryFn: async () => readData(await supabase.from("sla_settings").select("*")) ?? [] });
  const [draft, setDraft] = useState<Record<string, string>>({});
  async function save(p: Priority) {
    const h = Number(draft[p]);
    if (!Number.isInteger(h) || h < 1 || h > 2160) { toast.error("Informe um prazo entre 1 e 2160 horas."); return; }
    const { error } = await supabase.from("sla_settings").upsert({ priority: p, hours: h });
    if (done(error, `Prazo de ${priorityLabel(p)} atualizado.`)) inv();
  }
  if (error) return <p role="alert">Não foi possível carregar os prazos.</p>;
  return (
    <div className={card}>
      <p className="mb-3 text-sm text-muted-foreground">Vale para chamados novos e para chamados que mudarem de prioridade.</p>
      <ul className="divide-y">
        {PRIORITIES.map((p) => {
          const cur = data.find((s) => s.priority === p.value)?.hours;
          return (
            <li key={p.value} className="flex items-center gap-3 py-2">
              <span className="flex-1 font-medium">{p.label}</span>
              <Input type="number" min={1} max={2160} className="w-28" value={draft[p.value] ?? String(cur ?? "")} onChange={(e) => setDraft((d) => ({ ...d, [p.value]: e.target.value }))} />
              <span className="text-sm text-muted-foreground">horas</span>
              <Button size="sm" variant="outline" onClick={() => save(p.value)}><Save /> Salvar</Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PrioSelect({ v, set }: { v: Priority; set: (p: Priority) => void }) {
  return <Select value={v} onValueChange={(x) => set(x as Priority)}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select>;
}
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={checked} disabled={disabled} onCheckedChange={onChange} /> {checked ? "Ativo" : "Inativo"}</label>;
}
