import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { usernameToEmail, normalizeUsername } from './domain';
import { ensureStaff } from './staff-access';
import { userInput, accountPassword } from './account-rules';
import { readData } from './query-result';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

async function audit(client: SupabaseClient<Database>, actorId: string, targetId: string, targetName: string, action: 'created' | 'password_reset' | 'activated' | 'deactivated' | 'deleted' | 'centralized') {
  const actor = readData(await client.from('profiles').select('full_name').eq('id', actorId).single());
  const { error } = await client.from('admin_audit').insert({ actor_id: actorId, actor_name: actor?.full_name || 'Administrador', target_id: targetId, target_name: targetName, action });
  if (error) throw new Error('A operação foi executada, mas o histórico não foi salvo. Verifique a situação antes de tentar novamente.');
}
const targetInput = z.object({ userId: z.string().uuid() });

export const listAppUsers = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await ensureStaff(context.supabase, context.userId);
  const [profiles, roles, history] = await Promise.all([
    context.supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    context.supabase.from('user_roles').select('user_id,role'),
    context.supabase.from('admin_audit').select('*').order('created_at', { ascending: false }).limit(200),
  ]);
  const roleRows = readData(roles) ?? [];
  return { users: (readData(profiles) ?? []).map(p => ({ ...p, role: roleRows.find(r => r.user_id === p.id)?.role ?? 'requester' })), history: readData(history) ?? [] };
});

export const createAppUser = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => userInput.parse(d)).handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId);
    const username = normalizeUsername(data.username);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const duplicate = readData(await supabaseAdmin.from('profiles').select('id').eq('username', username).maybeSingle());
    if (duplicate) throw new Error('Login já está em uso.');
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email: usernameToEmail(username), password: data.password, email_confirm: true, user_metadata: { username, full_name: data.full_name } });
    if (error || !created.user) throw new Error(error?.code === 'email_exists' ? 'Login já está em uso.' : 'Não foi possível criar a conta. Use uma senha forte que não tenha sido vazada.');
    const id = created.user.id;
    const profileResult = await supabaseAdmin.from('profiles').insert({ id, username, full_name: data.full_name, registration: data.registration || null, department: data.department || null, must_change_password: true });
    const roleResult = profileResult.error ? profileResult : await supabaseAdmin.from('user_roles').insert({ user_id: id, role: data.role });
    if (roleResult.error) { await supabaseAdmin.auth.admin.deleteUser(id); throw new Error('Não foi possível configurar a conta.'); }
    await audit(supabaseAdmin, context.userId, id, username, 'created');
    return { id };
  });

export const resetUserPassword = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => targetInput.extend({ password: accountPassword }).parse(d)).handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, data.userId);
    if (data.userId === context.userId) throw new Error('Não redefina sua própria senha por este módulo.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    // Fail closed before the external password mutation, blocking every old session through RLS.
    const p = readData(await supabaseAdmin.from('profiles').update({ must_change_password: true, access_after: new Date().toISOString() }).eq('id', data.userId).select('username').single());
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error('A conta ficou bloqueada para troca de senha, mas a redefinição falhou. Tente novamente com uma senha forte e não vazada.');
    await audit(supabaseAdmin, context.userId, data.userId, p?.username ?? '', 'password_reset');
    return { ok: true };
  });

export const setUserActive = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => targetInput.extend({ active: z.boolean() }).parse(d)).handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, data.userId);
    if (data.userId === context.userId) throw new Error('Você não pode desativar sua própria conta.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    if (!data.active) readData(await supabaseAdmin.from('profiles').update({ active: false, access_after: new Date().toISOString() }).eq('id', data.userId).select('id').single());
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: data.active ? 'none' : '876000h' });
    if (error) throw new Error('Não foi possível alterar o acesso. Confira a situação da conta antes de repetir.');
    const p = readData(await supabaseAdmin.from('profiles').update({ active: data.active }).eq('id', data.userId).select('username').single());
    await audit(supabaseAdmin, context.userId, data.userId, p?.username ?? '', data.active ? 'activated' : 'deactivated');
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => targetInput.extend({ role: z.enum(['admin', 'requester']) }).parse(d)).handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, data.userId);
    if (data.userId === context.userId) throw new Error('Você não pode alterar o próprio perfil.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error } = await supabaseAdmin.rpc('replace_app_user_role', { _actor_id: context.userId, _target_id: data.userId, _role: data.role });
    if (error) throw new Error('Não foi possível alterar o perfil. O acesso anterior foi preservado.');
    return { ok: true };
  });

export const deleteAppUser = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => targetInput.parse(d)).handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, data.userId);
    if (data.userId === context.userId) throw new Error('Você não pode excluir sua própria conta.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const p = readData(await supabaseAdmin.from('profiles').select('username').eq('id', data.userId).single());
    // Preserve all ticket UUID references and immutable history. Only auth/profile/role records cascade.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error('Não foi possível excluir a conta. Os chamados foram preservados.');
    await audit(supabaseAdmin, context.userId, data.userId, p?.username ?? '', 'deleted');
    return { ok: true };
  });

// One-time authenticated handover, never an anonymous provisioning endpoint.
export const centralizeAdministrator = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const actor = readData(await context.supabase.from('profiles').select('username,active,must_change_password').eq('id', context.userId).single());
  const roles = readData(await context.supabase.from('user_roles').select('role').eq('user_id', context.userId)) ?? [];
  if (!actor?.active || actor.must_change_password || actor.username !== 'cauet.mello' || !roles.some(r => r.role === 'developer')) throw new Error('Acesso negado.');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const existing = readData(await supabaseAdmin.from('profiles').select('id').eq('username', 'administrador').maybeSingle());
  if (existing) throw new Error('A centralização já foi executada.');
  const password = process.env['ADMIN_PRIMARY_PASSWORD'];
  if (!password) throw new Error('A senha inicial não foi configurada.');
  const created = await supabaseAdmin.auth.admin.createUser({ email: usernameToEmail('administrador'), password, email_confirm: true, user_metadata: { username: 'administrador', full_name: 'Administrador' } });
  if (created.error || !created.data.user) {
    console.error('Administrator handover rejected', { code: created.error?.code, status: created.error?.status });
    throw new Error(created.error?.code === 'weak_password' ? 'A senha inicial foi rejeitada pela proteção de senhas. Cadastre uma senha mais forte para o Administrador. As contas antigas foram preservadas.' : 'A criação do Administrador falhou. As contas antigas foram preservadas.');
  }
  const id = created.data.user.id;
  const p = await supabaseAdmin.from('profiles').insert({ id, username: 'administrador', full_name: 'Administrador' });
  const r = p.error ? p : await supabaseAdmin.from('user_roles').insert({ user_id: id, role: 'admin' });
  if (r.error) { await supabaseAdmin.auth.admin.deleteUser(id); throw new Error('Não foi possível configurar o Administrador. As contas antigas foram preservadas.'); }
  await audit(supabaseAdmin, context.userId, id, 'administrador', 'centralized');
  const old = readData(await supabaseAdmin.from('profiles').select('id,username').neq('id', id)) ?? [];
  for (const u of old) {
    readData(await supabaseAdmin.from('profiles').update({ active: false }).eq('id', u.id).select('id').single());
    const banned = await supabaseAdmin.auth.admin.updateUserById(u.id, { ban_duration: '876000h' });
    if (banned.error) throw new Error('O Administrador foi criado, mas uma conta antiga ainda precisa ser bloqueada.');
    if (/^(cauet|ederson)([._-]|$)/.test(u.username)) {
      await supabaseAdmin.from('admin_audit').insert({ actor_id: id, actor_name: 'Administrador', target_id: u.id, target_name: u.username, action: 'deleted' });
      const deletion = await supabaseAdmin.auth.admin.deleteUser(u.id);
      if (deletion.error) throw new Error('Uma conta antiga foi desativada, mas não pôde ser excluída.');
    }
  }
  return { ok: true };
});
