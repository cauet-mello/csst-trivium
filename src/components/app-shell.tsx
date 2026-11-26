import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, ClipboardList, FilePlus2, Gauge, Home, LogOut, Menu, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { ROLE_LABEL } from "@/lib/domain";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import logo from "@/assets/logo-trivium.png.asset.json";
import symbolWhite from "@/assets/simbolo-branco.png.asset.json";
import { readData } from "@/lib/query-result";

const NAV = [
  { to: "/painel", label: "Início", icon: Home, staff: false },
  { to: "/novo", label: "Abrir chamado", icon: FilePlus2, staff: false },
  { to: "/chamados", label: "Chamados", icon: ClipboardList, staff: false },
  { to: "/dashboard", label: "Dashboard", icon: Gauge, staff: true },
] as const;

function Nav({ onNav }: { onNav?: (() => void) | undefined }) {
  const { data: me } = useMe();
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1">
      {NAV.filter((n) => !n.staff || me?.isStaff).map((n) => {
        const active = path === n.to || path.startsWith(n.to + "/");
        return (
          <Link
            key={n.to}
            to={n.to}
            onClick={onNav}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <n.icon className="size-4" />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBody({ onNav }: { onNav?: (() => void) | undefined }) {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) { toast.error("Não foi possível sair. Tente novamente."); return; }
    await qc.cancelQueries();
    qc.clear();
    navigate({ to: "/", replace: true });
  }
  return (
    <div className="flex h-full flex-col bg-sidebar p-4 text-sidebar-foreground">
      <div className="mb-8 flex items-center gap-3 px-2">
        <img src={symbolWhite.url} alt="" className="size-10 object-contain" />
        <div>
          <div className="font-display text-lg font-bold leading-none text-sidebar-accent-foreground">TRIVIUM</div>
          <div className="text-xs text-sidebar-foreground/70">Segurança do Trabalho</div>
        </div>
      </div>
      <Nav onNav={onNav} />
      <div className="mt-auto rounded-xl bg-sidebar-accent p-3">
        <div className="truncate text-sm font-semibold text-sidebar-accent-foreground">{me?.full_name || me?.username}</div>
        <div className="text-xs text-sidebar-foreground/70">{me?.roles.map((r) => ROLE_LABEL[r]).join(", ")}</div>
        <Button variant="ghost" size="sm" onClick={signOut} className="mt-3 h-auto justify-start p-0 text-xs font-medium text-sidebar-primary hover:underline">
          <LogOut className="size-3.5" /> Sair
        </Button>
      </div>
    </div>
  );
}

function Bellbutton() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const { data: count = 0 } = useQuery({
    queryKey: ["notif-count", me?.id],
    enabled: !!me,
    queryFn: async () => {
      if (!me) return 0;
      const result = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("read", false).eq("user_id", me.id);
      readData(result);
      return result.count ?? 0;
    },
  });
  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel(`notif-${me.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${me.id}` }, (payload) => {
        const n = payload.new as { title: string; body: string | null; kind: string };
        if (n.kind === "critical") toast.error(n.title, { description: n.body ?? undefined });
        else toast(n.title, { description: n.body ?? undefined });
        qc.invalidateQueries({ queryKey: ["notif-count"] });
        qc.invalidateQueries({ queryKey: ["notifications"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me, qc]);
  return (
    <Link to="/notificacoes" className="relative inline-flex size-10 items-center justify-center rounded-full bg-card shadow-card" aria-label="Notificações">
      <Bell className="size-5 text-primary" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

export function AppShell({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { error: accountError, refetch } = useMe();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-screen lg:block">
        <SidebarBody />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-0 p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarBody onNav={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur md:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu />
          </Button>
          <img src={logo.url} alt="Trivium" className="h-7 lg:hidden" />
          <div className="ml-auto flex items-center gap-2">
            {actions}
            <Bellbutton />
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8 animate-fade-up">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-primary-deep md:text-3xl">{title}</h1>
            {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
          </div>
          {accountError ? <div role="alert"><p>Não foi possível carregar seu acesso.</p><Button variant="outline" className="mt-3" onClick={() => refetch()}>Tentar novamente</Button></div> : children}
        </main>
      </div>
    </div>
  );
}
