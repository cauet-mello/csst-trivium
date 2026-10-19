import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const triageTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      title: z.string().max(200),
      description: z.string().min(10).max(5000),
      category: z.string().max(100),
      location: z.string().max(200),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { runTriage, buildSystemPrompt } = await import("./ai.server");
    const { data: rules } = await context.supabase.from("routing_rules").select("topic, department, involves_safety, notes").eq("active", true);
    const system = buildSystemPrompt(rules ?? []);
    const input = `Título: ${data.title}\nCategoria: ${data.category}\nLocal: ${data.location}\nDescrição: ${data.description}`;
    try {
      return { ok: true as const, triage: await runTriage(input, system) };
    } catch (e: any) {
      const status = e?.statusCode ?? e?.status;
      const msg = status === 429 ? "Muitas solicitações à IA. Aguarde alguns instantes." : status === 402 ? "Créditos de IA esgotados. Avise o administrador." : "Não foi possível analisar agora. Você pode registrar o chamado mesmo assim.";
      return { ok: false as const, error: msg };
    }
  });
