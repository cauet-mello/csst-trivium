import { supabase } from "@/integrations/supabase/client";
import { usernameToEmail } from "./domain";
import { accountDestination } from './account-rules';
import { readData } from './query-result';

export async function resolveAccountDestination(userId: string) {
  const [profile, roles] = await Promise.all([
    supabase.from('profiles').select('active,must_change_password').eq('id', userId).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', userId),
  ]);
  return accountDestination(readData(profile), (readData(roles) ?? []).map(r => r.role));
}

export async function signInToApp(username: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
  if (error?.status === 429) throw new Error('Muitas tentativas de acesso. Aguarde alguns minutos antes de tentar novamente.');
  if (error || !data.user) throw new Error("Login ou senha inválidos, ou conta desativada.");
  try {
    return await resolveAccountDestination(data.user.id);
  } catch (cause) {
    await supabase.auth.signOut();
    throw cause;
  }
}