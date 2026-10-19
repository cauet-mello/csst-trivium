import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Sparkles, LineChart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usernameToEmail } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import mascot from "@/assets/mascote_trivium_sem_fundo.png.asset.json";
import logo from "@/assets/logo-trivium.png.asset.json";
import symbolWhite from "@/assets/simbolo-branco.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Entrar — Trivium SST Chamados" },
      { name: "description", content: "Acesse o sistema de chamados de Segurança do Trabalho da Trivium Indústrias, São Leopoldo/RS." },
      { property: "og:title", content: "Trivium SST — Chamados de Segurança do Trabalho" },
      { property: "og:description", content: "Registro, triagem inteligente e acompanhamento de chamados de Segurança do Trabalho." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Login,
});

const SLIDES = [
  { icon: ShieldCheck, title: "Segurança em primeiro lugar", text: "Registre condições inseguras, falta de EPI e riscos em poucos passos." },
  { icon: Sparkles, title: "Triagem com Inteligência Artificial", text: "O assistente orienta, sugere prioridade e identifica o setor responsável." },
  { icon: LineChart, title: "Acompanhamento transparente", text: "Linha do tempo completa de cada chamado, do envio à conclusão." },
];

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"requester" | "admin">("requester");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/painel", replace: true });
    });
    const t = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) return setError("Informe login e senha.");
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
    if (error || !data.user) {
      setLoading(false);
      return setError("Login ou senha inválidos, ou conta desativada.");
    }
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const staff = (roles ?? []).some((r) => r.role === "admin" || r.role === "developer");
    if (mode === "admin" && !staff) {
      await supabase.auth.signOut();
      setLoading(false);
      return setError("Esta conta não possui acesso administrativo. Use o Acesso Solicitante.");
    }
    navigate({ to: staff && mode === "admin" ? "/dashboard" : "/painel", replace: true });
  }

  const S = SLIDES[slide];
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-hero p-10 text-primary-foreground lg:flex lg:flex-col">
        <img src={symbolWhite.url} alt="" aria-hidden className="pointer-events-none absolute -right-40 -top-32 w-[640px] opacity-10" />
        <div className="flex items-center gap-3">
          <img src={symbolWhite.url} alt="" className="size-12 object-contain" />
          <div>
            <div className="font-display text-2xl font-bold">TRIVIUM</div>
            <div className="text-sm opacity-80">Indústrias · São Leopoldo/RS</div>
          </div>
        </div>
        <div className="relative z-10 mt-auto grid grid-cols-[1fr_auto] items-end gap-6">
          <div className="max-w-md pb-10">
            <span className="inline-block rounded-full bg-brand-amber px-3 py-1 text-xs font-bold text-brand-amber-foreground">Segurança do Trabalho</span>
            <h1 className="mt-4 text-4xl font-bold leading-tight">Central de Chamados SST</h1>
            <div key={slide} className="mt-6 animate-fade-up">
              <S.icon className="size-7 text-brand-amber" />
              <h2 className="mt-2 text-xl font-semibold">{S.title}</h2>
              <p className="mt-1 opacity-85">{S.text}</p>
            </div>
            <div className="mt-6 flex gap-2">
              {SLIDES.map((_, i) => (
                <button key={i} onClick={() => setSlide(i)} aria-label={`Slide ${i + 1}`} className={`h-1.5 rounded-full transition-all ${i === slide ? "w-8 bg-brand-amber" : "w-3 bg-primary-foreground/40"}`} />
              ))}
            </div>
          </div>
          <img src={mascot.url} alt="Mascote Trivium" className="w-72 animate-float object-contain xl:w-96" />
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <img src={logo.url} alt="Trivium" className="mx-auto h-20 object-contain" />
          <h2 className="mt-8 text-center text-2xl font-bold text-primary-deep">Bem-vindo(a)</h2>
          <p className="mt-1 text-center text-sm text-muted-foreground">Entre com o login fornecido pela Segurança do Trabalho.</p>

          <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="requester">Solicitante</TabsTrigger>
              <TabsTrigger value="admin">Administrador</TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="u">Login</Label>
              <Input id="u" autoComplete="username" placeholder="nome.sobrenome" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p">Senha</Label>
              <Input id="p" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <Button type="submit" className="h-11 w-full" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />} Entrar
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Não tem acesso? Solicite ao setor de Segurança do Trabalho. Seus dados são tratados conforme a LGPD.
          </p>
        </div>
      </section>
    </div>
  );
}
