import { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type T = { id: string; rating: number | null; rating_comment: string | null; rated_at: string | null };

export function RatingCard({ ticket, canRate, onDone }: { ticket: T; canRate: boolean; onDone: () => void }) {
  const [value, setValue] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const shown = canRate ? value : ticket.rating ?? 0;

  async function submit() {
    if (!value || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc("rate_ticket", { _ticket: ticket.id, _rating: value, _comment: comment });
    setBusy(false);
    if (error) { toast.error(error.message || "Não foi possível enviar a avaliação."); return; }
    toast.success("Obrigado pela avaliação!");
    onDone();
  }

  return (
    <section className="rounded-2xl bg-card p-5 shadow-card">
      <h2 className="font-display font-semibold text-primary-deep">{canRate ? "Como foi o atendimento?" : "Avaliação do solicitante"}</h2>
      <div className="mt-3 flex gap-1" role={canRate ? "radiogroup" : undefined} aria-label="Nota de 1 a 5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" disabled={!canRate} aria-label={`${n} estrela(s)`} onClick={() => setValue(n)} className={cn("rounded p-0.5", canRate && "hover:scale-110 transition-transform")}>
            <Star className={cn("size-7", n <= shown ? "fill-brand-amber text-brand-amber" : "text-border")} />
          </button>
        ))}
      </div>
      {canRate ? (
        <>
          <Textarea className="mt-3" rows={2} maxLength={1000} placeholder="Comentário (opcional)" value={comment} onChange={(e) => setComment(e.target.value)} />
          <div className="mt-3 flex justify-end"><Button onClick={submit} disabled={!value || busy}>{busy && <Loader2 className="animate-spin" />} Enviar avaliação</Button></div>
        </>
      ) : ticket.rating_comment ? <p className="mt-2 text-sm text-muted-foreground">“{ticket.rating_comment}”</p> : null}
    </section>
  );
}
