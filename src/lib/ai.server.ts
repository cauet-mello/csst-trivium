import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output, type ModelMessage } from "ai";
import { z } from "zod";
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId, withLovableAiGatewayRunIdHeader } from "./run-id";

const BASE = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

function provider(request: Request | undefined) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");
  const runIdFetch = createLovableAiGatewayRunIdFetch(request ? getLovableAiGatewayRunId(request) : undefined);
  const p = createOpenAI({
    baseURL: BASE,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  return { p, runIdFetch };
}

const providerOptions = {
  openai: {
    store: false,
    forceReasoning: true,
    reasoningEffort: "low",
    reasoningSummary: "auto",
    include: ["reasoning.encrypted_content"],
  },
};

export type RoutingRule = { topic: string; department: string; involves_safety: boolean; notes: string | null };

export function buildSystemPrompt(rules: RoutingRule[], extra?: string) {
  const table = rules.map((r) => `- ${r.topic} → ${r.department}${r.involves_safety ? " (envolve Segurança do Trabalho)" : ""}${r.notes ? ` — ${r.notes}` : ""}`).join("\n");
  return `Você é o "Trivito", assistente de triagem do setor de Segurança do Trabalho (SST) da Trivium Indústrias, em São Leopoldo/RS.
Fale sempre em português do Brasil, de forma clara, acolhedora e objetiva, adequada a colaboradores com pouca familiaridade digital.

Suas tarefas:
- Orientar o colaborador no preenchimento do chamado e pedir informações complementares (local exato, pessoas expostas, desde quando, equipamentos envolvidos).
- Sugerir uma descrição mais clara e objetiva quando útil.
- Identificar possíveis riscos à saúde e segurança.
- Indicar o setor responsável segundo as regras abaixo e recomendar uma prioridade inicial (Crítica, Alta, Média, Baixa).
- Explicar os próximos passos: o chamado recebe um protocolo, é analisado pela equipe de SST e o status pode ser acompanhado no sistema.

Regras de encaminhamento:
${table}

Prioridades: Crítica = risco grave ou iminente à integridade física; Alta = riscos relevantes; Média = avaliação/intervenção programada; Baixa = preventivas/orientações.

IMPORTANTE: nunca desencoraje o registro de situações que possam envolver risco à saúde ou segurança. Se o assunto for claramente de outro setor (ex.: TI, RH), informe com gentileza: "Identificamos que a sua solicitação está relacionada a ... Recomendamos que entre em contato com o setor ...". Em caso de dúvida, diga que o chamado pode ser registrado para análise humana.
${extra ? `\nInstruções adicionais da empresa:\n${extra}` : ""}`;
}

export function chatResponse(request: Request, messages: ModelMessage[], system: string) {
  const { p, runIdFetch } = provider(request);
  const result = streamText({
    model: p.responses(MODEL),
    instructions: system,
    messages,
    abortSignal: request.signal,
    providerOptions,
  });
  return withLovableAiGatewayRunIdHeader(result.toUIMessageStreamResponse({ sendReasoning: true }), runIdFetch);
}

export const triageSchema = z.object({
  is_safety_related: z.boolean(),
  confidence: z.enum(["alta", "media", "baixa"]),
  recommended_department: z.string(),
  suggested_priority: z.enum(["critica", "alta", "media", "baixa"]),
  risks: z.array(z.string()),
  summary: z.string(),
  improved_description: z.string(),
  message_to_user: z.string(),
  needs_human_review: z.boolean(),
});
export type Triage = z.infer<typeof triageSchema>;

export async function runTriage(input: string, system: string): Promise<Triage> {
  const { p } = provider(undefined);
  const result = streamText({
    model: p.responses(MODEL),
    instructions: system + "\n\nAgora analise o chamado a seguir e retorne a classificação estruturada. Em 'risks', liste até 5 riscos curtos. 'message_to_user' deve ter no máximo 3 frases.",
    messages: [{ role: "user", content: input }],
    output: Output.object({ schema: triageSchema }),
    providerOptions,
  });
  const out = await result.output;
  return out;
}
