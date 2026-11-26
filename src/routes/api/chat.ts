import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, validateUIMessages } from "ai";

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
        const { data: ready, error: readinessError } = await sb.rpc('account_ready', { _user_id: u.user.id });
        if (readinessError || !ready) return new Response('Acesso bloqueado. Defina sua senha pessoal.', { status: 403 });

        let messages;
        try {
          const body = await request.json();
          if (!body || !Array.isArray(body.messages) || !body.messages.length) return new Response("Sem mensagens", { status: 400 });
          messages = await validateUIMessages({ messages: body.messages.slice(-30) });
        } catch {
          return new Response("Mensagens inválidas", { status: 400 });
        }

        const { data: rules, error: rulesError } = await sb.from("routing_rules").select("topic, department, involves_safety, notes").eq("active", true);
        if (rulesError) return new Response("Não foi possível carregar as orientações. Tente novamente.", { status: 503 });
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
