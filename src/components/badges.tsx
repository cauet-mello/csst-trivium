import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { priorityLabel, statusLabel } from "@/lib/domain";

const pri = cva("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", {
  variants: {
    p: {
      critica: "bg-p-critica/15 text-p-critica ring-1 ring-p-critica/30",
      alta: "bg-p-alta/15 text-p-alta ring-1 ring-p-alta/30",
      media: "bg-p-media/20 text-accent-foreground ring-1 ring-p-media/40",
      baixa: "bg-p-baixa/15 text-p-baixa ring-1 ring-p-baixa/30",
    },
  },
});

export function PriorityBadge({ p, className }: { p: string | null | undefined; className?: string }) {
  if (!p) return null;
  return (
    <span className={cn(pri({ p: p as any }), className)}>
      <span className="size-1.5 rounded-full bg-current" />
      {priorityLabel(p)}
    </span>
  );
}

const st = cva("inline-flex rounded-md px-2 py-0.5 text-xs font-medium", {
  variants: {
    s: {
      enviado: "bg-secondary text-secondary-foreground",
      recebido: "bg-secondary text-secondary-foreground",
      em_analise: "bg-accent text-accent-foreground",
      em_andamento: "bg-primary/10 text-primary",
      concluido: "bg-success/15 text-success",
      aguardando_info: "bg-p-alta/15 text-p-alta",
      encaminhado: "bg-muted text-muted-foreground",
      cancelado: "bg-muted text-muted-foreground line-through",
    },
  },
});
export function StatusBadge({ s }: { s: string }) {
  return <span className={st({ s: s as any })}>{statusLabel(s)}</span>;
}
