import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { accountPassword } from './account-rules';
import { readData } from './query-result';

export const changeInitialPassword = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ current_password: z.string().min(1).max(72), password: accountPassword }).parse(d))
  .handler(async ({ data, context }) => {
    const profile = readData(await context.supabase.from('profiles').select('active,must_change_password').eq('id', context.userId).single());
    if (!profile?.active || !profile.must_change_password) throw new Error('Esta conta não possui troca de senha pendente.');
    if (data.password === data.current_password) throw new Error('Escolha uma senha diferente da temporária.');
    // Revalidates the current password at the Auth provider; never clears the gate on an unverified token.
    const { error } = await context.supabase.auth.updateUser({ password: data.password, current_password: data.current_password });
    if (error) throw new Error('Não foi possível alterar a senha. Confira a senha temporária e escolha uma senha forte que não tenha sido vazada.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const result = await supabaseAdmin.from('profiles').update({ must_change_password: false }).eq('id', context.userId).select('id').single();
    if (result.error) throw new Error('A senha mudou, mas o acesso ainda está bloqueado. Solicite nova redefinição ao Administrador.');
    return { ok: true };
  });
