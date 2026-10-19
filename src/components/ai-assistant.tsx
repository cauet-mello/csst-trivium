import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputBody, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import symbol from "@/assets/gpt.png.asset.json";

export function AiAssistant() {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
        },
      }),
    [],
  );
  const { messages, sendMessage, status, stop } = useChat({
    transport,
    onError: (e) => toast.error(e.message || "Falha no assistente"),
  });
  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="flex h-[560px] flex-col overflow-hidden rounded-2xl bg-card shadow-card">
      <div className="flex items-center gap-3 border-b bg-secondary/60 px-4 py-3">
        <img src={symbol.url} alt="" className="size-9 rounded-full bg-card object-contain p-1" />
        <div>
          <div className="font-display font-semibold text-primary-deep">Trivinho · Assistente SST</div>
          <div className="text-xs text-muted-foreground">Inteligência Artificial para orientar seu chamado</div>
        </div>
      </div>
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<img src={symbol.url} alt="" className="size-12 object-contain" />}
              title="Como posso ajudar?"
              description="Descreva o que está acontecendo. Eu ajudo a identificar riscos, prioridade e o setor certo."
            />
          ) : (
            messages.map((m) => (
              <Message from={m.role} key={m.id}>
                <MessageContent>
                  {m.parts.map((p, i) => (p.type === "text" ? <MessageResponse key={i}>{p.text}</MessageResponse> : null))}
                </MessageContent>
              </Message>
            ))
          )}
          {status === "submitted" && <Shimmer>Analisando…</Shimmer>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="border-t p-3">
        <PromptInput
          onSubmit={(msg) => {
            if (!msg.text.trim() || busy) return;
            sendMessage({ text: msg.text });
          }}
        >
          <PromptInputBody>
            <PromptInputTextarea autoFocus placeholder="Ex.: Falta protetor auricular na linha 3…" />
          </PromptInputBody>
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onClick={busy ? (e) => { e.preventDefault(); stop(); } : undefined} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
