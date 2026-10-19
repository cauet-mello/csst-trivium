import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, type UIMessage } from "ai";

function userClient(token: string) {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        h.set("apikey", key);
        h.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Não autenticado", { status: 401 });
        const sb = userClient(token);
        const { data: u, error } = await sb.auth.getUser(token);
        if (error || !u.user) return new Response("Não autenticado", { status: 401 });

        const body = (await request.json()) as { messages?: UIMessage[] };
        const messages = Array.isArray(body.messages) ? body.messages.slice(-30) : [];
        if (!messages.length) return new Response("Sem mensagens", { status: 400 });

        const { data: rules } = await sb.from("routing_rules").select("topic, department, involves_safety, notes").eq("active", true);
        const { buildSystemPrompt, chatResponse } = await import("@/lib/ai.server");
        try {
          return await chatResponse(request, await convertToModelMessages(messages), buildSystemPrompt(rules ?? []));
        } catch (e: any) {
          const status = e?.statusCode ?? 500;
          return new Response(status === 402 ? "Créditos de IA esgotados." : status === 429 ? "Muitas solicitações. Aguarde." : "Falha no assistente", { status });
        }
      },
    },
  },
});
