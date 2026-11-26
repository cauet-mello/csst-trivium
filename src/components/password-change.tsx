import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changeInitialPassword } from '@/lib/account.functions';
import { accountPassword } from '@/lib/account-rules';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo-trivium.png.asset.json';

export function PasswordChangeForm() {
  const change = useServerFn(changeInitialPassword);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    const parsed = accountPassword.safeParse(password);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Senha inválida.'); return; }
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }
    if (password === current) { setError('Escolha uma senha diferente da temporária.'); return; }
    setBusy(true);
    try {
      await change({ data: { current_password: current, password } });
      await qc.cancelQueries(); qc.clear();
      await supabase.auth.signOut();
      setCurrent(''); setPassword(''); setConfirm(''); setDone(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível alterar a senha.'); }
    finally { setBusy(false); }
  }
  return <div className="flex min-h-screen items-center justify-center bg-background px-5 py-10"><div className="w-full max-w-sm">
    <img src={logo.url} alt="Trivium" className="mx-auto mb-8 h-20 object-contain" />
    <KeyRound className="mb-3 size-7 text-primary" />
    <h1 className="text-2xl font-bold text-primary-deep">{done ? 'Senha alterada' : 'Defina sua senha pessoal'}</h1>
    {done ? <><p className="mt-3 text-muted-foreground">A senha temporária não é mais válida.</p><Button className="mt-6 w-full" onClick={() => navigate({ to: '/', replace: true })}>Voltar ao login</Button></> : <form onSubmit={submit} className="mt-6 space-y-4">
      <div className="space-y-2"><Label htmlFor="temporary">Senha temporária</Label><Input id="temporary" type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="new-password">Nova senha</Label><Input id="new-password" type="password" autoComplete="new-password" required value={password} onChange={e => setPassword(e.target.value)} /><p className="text-xs text-muted-foreground">Mínimo de 10 caracteres, com maiúscula, minúscula, número e símbolo.</p></div>
      <div className="space-y-2"><Label htmlFor="confirm-password">Confirmar nova senha</Label><Input id="confirm-password" type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} /></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full">{busy && <Loader2 className="animate-spin" />}Salvar senha</Button>
      <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={async () => { await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); await navigate({ to: '/', replace: true }); }}>Sair</Button>
    </form>}
  </div></div>;
}
