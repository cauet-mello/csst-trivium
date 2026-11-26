import { createFileRoute, redirect } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, KeyRound, Trash2, Power, Shield, RefreshCw, Copy, Eye, EyeOff, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ensureStaff } from '@/lib/staff-access';
import { userInput, accountPassword, generateTemporaryPassword } from '@/lib/account-rules';
import { listAppUsers, createAppUser, resetUserPassword, setUserActive, setUserRole, deleteAppUser } from '@/lib/users.functions';
import { useMe } from '@/hooks/use-me';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export const Route = createFileRoute('/_authenticated/usuarios')({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: '/auth' });
    try { await ensureStaff(supabase, data.user.id); } catch { throw redirect({ to: '/painel' }); }
  },
  head: () => ({ meta: [{ title: 'Gestão de Usuários — Trivium SST' }, { name: 'description', content: 'Administração de contas, permissões e histórico de acesso do Trivium SST.' }, { property: 'og:title', content: 'Gestão de Usuários — Trivium SST' }, { property: 'og:description', content: 'Gestão centralizada de usuários e auditoria administrativa.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: UserManagement,
});
type User = Awaited<ReturnType<typeof listAppUsers>>['users'][number];
type Action = 'reset' | 'active' | 'delete' | 'role';
const ACTION_LABEL: Record<string, string> = { created: 'Usuário criado', password_reset: 'Senha redefinida', activated: 'Conta ativada', deactivated: 'Conta desativada', deleted: 'Conta excluída', role_changed: 'Perfil alterado', centralized: 'Acesso centralizado' };
const dateLabel = (d: string) => new Date(d).toLocaleString('pt-BR');

function UserManagement() {
  const list = useServerFn(listAppUsers), create = useServerFn(createAppUser), reset = useServerFn(resetUserPassword), active = useServerFn(setUserActive), role = useServerFn(setUserRole), remove = useServerFn(deleteAppUser);
  const qc = useQueryClient(); const { data: me } = useMe();
  const query = useQuery({ queryKey: ['managed-users'], queryFn: () => list() });
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [target, setTarget] = useState<{ user: User; action: Action } | null>(null);
  const [form, setForm] = useState({ full_name: '', username: '', registration: '', department: '', role: 'requester' as 'admin' | 'requester' });
  const [password, setPassword] = useState(''); const [show, setShow] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<{ username: string; password: string } | null>(null);
  const [newRole, setNewRole] = useState<'admin' | 'requester'>('requester');
  function openCreate() { setForm({ full_name: '', username: '', registration: '', department: '', role: 'requester' }); setPassword(generateTemporaryPassword()); setError(''); setShow(false); setCreating(true); }
  function openAction(user: User, action: Action) { setTarget({ user, action }); setPassword(action === 'reset' ? generateTemporaryPassword() : ''); setNewRole(user.role === 'admin' ? 'admin' : 'requester'); setError(''); setShow(false); }
  async function execute(e: React.FormEvent) {
    e.preventDefault(); setError('');
    if (creating) { const p = userInput.safeParse({ ...form, password }); if (!p.success) { setError(p.error.issues[0]?.message ?? 'Confira os campos.'); return; } }
    if (target?.action === 'reset') { const p = accountPassword.safeParse(password); if (!p.success) { setError(p.error.issues[0]?.message ?? 'Senha inválida.'); return; } }
    setBusy(true);
    try {
      if (creating) { await create({ data: { ...form, password } }); setReceipt({ username: form.username.toLowerCase(), password }); }
      else if (target) {
        const userId = target.user.id;
        if (target.action === 'reset') { await reset({ data: { userId, password } }); setReceipt({ username: target.user.username, password }); }
        if (target.action === 'active') await active({ data: { userId, active: !target.user.active } });
        if (target.action === 'delete') await remove({ data: { userId } });
        if (target.action === 'role') await role({ data: { userId, role: newRole } });
      }
      setCreating(false); setTarget(null); setPassword('');
      await qc.invalidateQueries({ queryKey: ['managed-users'] }); toast.success('Operação concluída.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível concluir a operação.'); }
    finally { setBusy(false); }
  }
  const users = (query.data?.users ?? []).filter(u => `${u.full_name} ${u.username}`.toLowerCase().includes(search.toLowerCase()));
  const title = creating ? 'Adicionar usuário' : target?.action === 'reset' ? 'Redefinir senha' : target?.action === 'active' ? (target.user.active ? 'Desativar conta' : 'Ativar conta') : target?.action === 'role' ? 'Alterar perfil' : 'Excluir usuário';
  const passwordFields = <div className="space-y-2"><Label htmlFor="managed-password">Senha temporária</Label><div className="flex gap-2"><Input id="managed-password" type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required /><Button type="button" variant="outline" size="icon" aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} title={show ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShow(!show)}>{show ? <EyeOff /> : <Eye />}</Button><Button type="button" variant="outline" size="icon" title="Gerar senha temporária" aria-label="Gerar senha temporária" onClick={() => setPassword(generateTemporaryPassword())}><RefreshCw /></Button></div><p className="text-xs text-muted-foreground">Troca obrigatória no próximo acesso.</p></div>;
  return <AppShell title="Gestão de Usuários" actions={<Button onClick={openCreate}><Plus /> <span className="hidden sm:inline">Adicionar usuário</span></Button>}>
    <Tabs defaultValue="accounts"><TabsList><TabsTrigger value="accounts"><Users className="size-4" />Contas</TabsTrigger><TabsTrigger value="audit">Auditoria</TabsTrigger></TabsList>
      <TabsContent value="accounts"><div className="my-5 flex flex-wrap items-center justify-between gap-3"><Input className="max-w-sm" aria-label="Buscar usuários" placeholder="Buscar por nome ou login" value={search} onChange={e => setSearch(e.target.value)} /><p className="text-sm text-muted-foreground">{query.data?.users.filter(u => u.active).length ?? 0} ativas · {query.data?.users.filter(u => !u.active).length ?? 0} inativas</p></div>
        {query.isPending ? <p role="status">Carregando usuários…</p> : query.error ? <div role="alert"><p>Não foi possível carregar as contas.</p><Button variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button></div> : <div className="overflow-x-auto rounded-md border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr>{['Usuário', 'Perfil', 'Situação', 'Cadastro', 'Ações'].map(h => <th className="whitespace-nowrap px-4 py-3 font-medium" key={h}>{h}</th>)}</tr></thead><tbody>{users.map(u => <tr key={u.id} className="border-t" data-login={u.username}><td className="px-4 py-4"><div className="font-semibold">{u.full_name}</div><div className="text-muted-foreground">{u.username}</div></td><td className="whitespace-nowrap px-4 py-4">{u.role === 'admin' ? 'Administrador' : 'Usuário'}</td><td className="px-4 py-4"><span className={u.active ? 'text-primary' : 'text-muted-foreground'}>{u.active ? 'Ativa' : 'Inativa'}</span>{u.must_change_password && <p className="whitespace-nowrap text-xs text-muted-foreground">Troca de senha pendente</p>}</td><td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{dateLabel(u.created_at)}</td><td className="px-3 py-3"><div className="flex gap-1">{[{ action: 'reset' as const, icon: KeyRound, label: 'Redefinir senha' }, { action: 'role' as const, icon: Shield, label: 'Alterar perfil' }, { action: 'active' as const, icon: Power, label: u.active ? 'Desativar conta' : 'Ativar conta' }, { action: 'delete' as const, icon: Trash2, label: 'Excluir usuário' }].map(a => <Button key={a.action} variant="ghost" size="icon" title={a.label} aria-label={`${a.label}: ${u.username}`} disabled={u.id === me?.id} onClick={() => openAction(u, a.action)}><a.icon className={a.action === 'delete' ? 'text-destructive' : ''} /></Button>)}</div></td></tr>)}</tbody></table>{users.length === 0 && <p className="p-6 text-center text-muted-foreground">Nenhum usuário encontrado.</p>}</div>}
      </TabsContent>
      <TabsContent value="audit"><div className="mt-5 divide-y border-y">{query.data?.history.map(h => <div key={h.id} className="grid gap-1 py-4 md:grid-cols-[1fr_1fr_auto]"><div className="font-semibold">{ACTION_LABEL[h.action] ?? h.action}<p className="text-sm font-normal text-muted-foreground">{h.target_name}</p></div><p className="text-sm">{h.actor_name}</p><time className="text-sm text-muted-foreground">{dateLabel(h.created_at)}</time></div>)}{!query.data?.history.length && <p className="py-5 text-muted-foreground">Nenhuma atividade registrada.</p>}</div></TabsContent>
    </Tabs>
    <Dialog open={creating || !!target} onOpenChange={open => { if (!open && !busy) { setCreating(false); setTarget(null); setPassword(''); setError(''); } }}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{creating ? 'Cada pessoa terá uma conta e uma senha individual.' : `Conta: ${target?.user.username ?? ''}`}</DialogDescription></DialogHeader><form onSubmit={execute} className="space-y-4">
      {creating && <><div className="space-y-2"><Label htmlFor="full-name">Nome completo</Label><Input id="full-name" required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="user-login">Login</Label><Input id="user-login" autoComplete="off" required value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} /></div><div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="registration">Matrícula</Label><Input id="registration" value={form.registration} onChange={e => setForm({ ...form, registration: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="department">Setor</Label><Input id="department" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></div></div><div className="space-y-2"><Label>Perfil de acesso</Label><Select value={form.role} onValueChange={v => setForm({ ...form, role: v === 'admin' ? 'admin' : 'requester' })}><SelectTrigger aria-label="Perfil de acesso"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="requester">Usuário</SelectItem><SelectItem value="admin">Administrador</SelectItem></SelectContent></Select></div></>}
      {(creating || target?.action === 'reset') && passwordFields}
      {target?.action === 'delete' && <p className="text-sm">A conta e suas credenciais serão excluídas permanentemente. Chamados e histórico serão preservados.</p>}
      {target?.action === 'active' && <p className="text-sm">{target.user.active ? 'O usuário perderá o acesso imediatamente, incluindo sessões já abertas.' : 'O usuário poderá entrar novamente com sua senha atual.'}</p>}
      {target?.action === 'role' && <Select value={newRole} onValueChange={v => setNewRole(v === 'admin' ? 'admin' : 'requester')}><SelectTrigger aria-label="Novo perfil"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="requester">Usuário</SelectItem><SelectItem value="admin">Administrador</SelectItem></SelectContent></Select>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => { setCreating(false); setTarget(null); setPassword(''); }}>Cancelar</Button><Button type="submit" variant={target?.action === 'delete' ? 'destructive' : 'default'} disabled={busy}>{busy && <Loader2 className="animate-spin" />}{creating ? 'Criar usuário' : 'Confirmar'}</Button></DialogFooter>
    </form></DialogContent></Dialog>
    <Dialog open={!!receipt} onOpenChange={open => { if (!open) setReceipt(null); }}><DialogContent><DialogHeader><DialogTitle>Senha temporária disponível</DialogTitle><DialogDescription>Entregue a senha somente ao titular da conta.</DialogDescription></DialogHeader><div className="space-y-3"><p>Login: <strong>{receipt?.username}</strong></p><div className="flex gap-2"><Input aria-label="Senha temporária criada" value={receipt?.password ?? ''} readOnly /><Button variant="outline" size="icon" aria-label="Copiar senha temporária" onClick={async () => { try { await navigator.clipboard.writeText(receipt?.password ?? ''); toast.success('Senha copiada.'); } catch { toast.error('Não foi possível copiar.'); } }}><Copy /></Button></div></div><DialogFooter><Button onClick={() => setReceipt(null)}>Concluir</Button></DialogFooter></DialogContent></Dialog>
  </AppShell>;
}
