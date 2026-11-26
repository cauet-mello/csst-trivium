import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function ensureStaff(client: SupabaseClient<Database>, userId: string, targetUserId?: string) {
  const { data, error } = await client.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error("Não foi possível verificar as permissões.");
  const roles = (data ?? []).map((r) => r.role);
  if (!roles.includes("admin") && !roles.includes("developer")) throw new Error("Acesso negado");
  if (targetUserId && !roles.includes("developer")) {
    const { data: target, error: targetError } = await client.from("user_roles").select("role").eq("user_id", targetUserId);
    if (targetError) throw new Error("Não foi possível verificar o perfil do usuário.");
    if (target?.some((r) => r.role === "developer")) throw new Error("Somente Desenvolvedor pode alterar uma conta de Desenvolvedor.");
  }
  return roles;
}