import { supabase } from "@/integrations/supabase/client";
import { usernameToEmail } from "./domain";

export async function signInToApp(username: string, password: string, mode: "requester" | "admin") {
  const { data, error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
  if (error || !data.user) throw new Error("Login ou senha inválidos, ou conta desativada.");
  if (mode === "requester") return "/painel" as const;
  const { data: roles, error: rolesError } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
  if (rolesError) throw new Error("Não foi possível verificar o acesso administrativo. Tente novamente.");
  if (!(roles ?? []).some((r) => r.role === "admin" || r.role === "developer")) {
    await supabase.auth.signOut();
    throw new Error("Esta conta não possui acesso administrativo. Use o Acesso Solicitante.");
  }
  return "/dashboard" as const;
}