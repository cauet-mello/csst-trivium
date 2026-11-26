export const EMAIL_DOMAIN = "trivium.local";

export function normalizeUsername(u: string) {
  return u.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
}
export function usernameToEmail(u: string) {
  return `${normalizeUsername(u)}@${EMAIL_DOMAIN}`;
}

export type Priority = "critica" | "alta" | "media" | "baixa";
export type Status =
  | "enviado" | "recebido" | "em_analise" | "em_andamento" | "concluido"
  | "aguardando_info" | "encaminhado" | "cancelado";
export type Role = "admin" | "developer" | "requester";

export const PRIORITIES: { value: Priority; label: string; desc: string }[] = [
  { value: "critica", label: "Crítica", desc: "Risco grave ou iminente à integridade física" },
  { value: "alta", label: "Alta", desc: "Riscos relevantes, atendimento prioritário" },
  { value: "media", label: "Média", desc: "Avaliação ou intervenção programada" },
  { value: "baixa", label: "Baixa", desc: "Preventivas, orientações, administrativas" },
];
export const priorityLabel = (p?: string | null) => PRIORITIES.find((x) => x.value === p)?.label ?? "-";

export const FLOW: Status[] = ["enviado", "recebido", "em_analise", "em_andamento", "concluido"];
export const STATUSES: { value: Status; label: string }[] = [
  { value: "enviado", label: "Chamado enviado" },
  { value: "recebido", label: "Chamado recebido" },
  { value: "em_analise", label: "Em análise" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluido", label: "Concluído" },
  { value: "aguardando_info", label: "Aguardando informações" },
  { value: "encaminhado", label: "Encaminhado" },
  { value: "cancelado", label: "Cancelado" },
];
export const statusLabel = (s?: string | null) => STATUSES.find((x) => x.value === s)?.label ?? "-";
export const OPEN_STATUSES: Status[] = ["enviado", "recebido", "em_analise", "em_andamento", "aguardando_info", "encaminhado"];

export const DUE_SOON_HOURS = 24;
export function isDueSoon(t: { due_at: string | null; status: string; closed_at: string | null }, now: Date = new Date()) {
  if (!t.due_at || t.closed_at || !OPEN_STATUSES.includes(t.status as Status)) return false;
  const left = new Date(t.due_at).getTime() - now.getTime();
  return left > 0 && left <= DUE_SOON_HOURS * 3600_000;
}

export function isOverdue(t: { due_at: string | null; status: string; closed_at: string | null }) {
  if (!t.due_at) return false;
  const end = t.closed_at ? new Date(t.closed_at) : new Date();
  return end > new Date(t.due_at);
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  developer: "Desenvolvedor",
  requester: "Usuário",
};
