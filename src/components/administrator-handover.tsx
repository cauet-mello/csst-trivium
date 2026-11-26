import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { centralizeAdministrator } from '@/lib/users.functions';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { accountPassword } from '@/lib/account-rules';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';
export function AdministratorHandover() {
  const run = useServerFn(centralizeAdministrator), navigate = useNavigate(), qc = useQueryClient();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [pw, setPw] = useState(''), [pw2, setPw2] = useState('');
  async function submit() {
    const check = accountPassword.safeParse(pw);
    if (!check.success) { setError(check.error.issues[0]?.message ?? 'Senha inválida.'); return; }
    if (pw !== pw2) { setError('As senhas não coincidem.'); return; }
    setBusy(true); setError('');
    try { await run({ data: { password: pw } }); setPw(''); setPw2(''); await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); await navigate({ to: '/', replace: true }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível centralizar o acesso.'); }
    finally { setBusy(false); }
  }
  return <div className="mb-5 border-l-4 border-brand-amber bg-muted p-4"><p className="font-semibold">Centralização administrativa pendente</p><Button className="mt-3" onClick={() => setOpen(true)}>Centralizar no Administrador</Button><AlertDialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setPw(''); setPw2(''); setError(''); } }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Substituir as contas antigas?</AlertDialogTitle><AlertDialogDescription>Será criada a conta Administrador. Cauet e Ederson serão excluídos e as demais contas desativadas. Todos os chamados e históricos serão preservados. A senha abaixo é temporária: o Administrador deverá trocá-la no primeiro acesso.</AlertDialogDescription></AlertDialogHeader><div className="space-y-2"><Input type="password" autoComplete="new-password" aria-label="Senha temporária do Administrador" placeholder="Senha temporária (mín. 10, maiúscula, número, símbolo)" value={pw} onChange={e => setPw(e.target.value)} /><Input type="password" autoComplete="new-password" aria-label="Confirmar senha" placeholder="Confirmar senha" value={pw2} onChange={e => setPw2(e.target.value)} /></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<AlertDialogFooter><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={busy} onClick={submit}>{busy ? 'Aplicando…' : 'Confirmar centralização'}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog></div>;
}
