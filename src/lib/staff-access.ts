import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function ensureStaff(client: SupabaseClient<Database>, userId: string, targetUserId?: string) {
  const { data: ready, error: readyError } = await client.rpc('account_ready', { _user_id: userId });
  if (readyError || !ready) throw new Error('Acesso negado. Conta desativada ou troca de senha pendente.');
  const { data, error } = await client.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error("Não foi possível verificar as permissões.");
  const roles = (data ?? []).map((r) => r.role);
  if (!roles.includes("admin")) throw new Error("Acesso negado");
  if (targetUserId) {
    const { data: target, error: targetError } = await client.from("user_roles").select("role").eq("user_id", targetUserId);
    if (targetError) throw new Error("Não foi possível verificar o perfil do usuário.");
    if (target?.some((r) => r.role === "developer")) throw new Error("Esta conta legada não pode ser alterada por este módulo.");
  }
  return roles;
}