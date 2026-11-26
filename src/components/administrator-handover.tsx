import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { centralizeAdministrator } from '@/lib/users.functions';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';
export function AdministratorHandover() {
  const run = useServerFn(centralizeAdministrator), navigate = useNavigate(), qc = useQueryClient();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit() {
    setBusy(true); setError('');
    try { await run(); await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); await navigate({ to: '/', replace: true }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível centralizar o acesso.'); }
    finally { setBusy(false); }
  }
  return <div className="mb-5 border-l-4 border-brand-amber bg-muted p-4"><p className="font-semibold">Centralização administrativa pendente</p><Button className="mt-3" onClick={() => setOpen(true)}>Centralizar no Administrador</Button><AlertDialog open={open} onOpenChange={setOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Substituir as contas antigas?</AlertDialogTitle><AlertDialogDescription>Será criada a conta Administrador. Cauet e Ederson serão excluídos e as demais contas desativadas. Todos os chamados e históricos serão preservados.</AlertDialogDescription></AlertDialogHeader>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<AlertDialogFooter><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={busy} onClick={submit}>{busy ? 'Aplicando…' : 'Confirmar centralização'}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog></div>;
}
