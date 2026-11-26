CREATE OR REPLACE FUNCTION public.prevent_event_changes() RETURNS trigger LANGUAGE plpgsql AS $$
begin
  if tg_op = 'DELETE' and current_setting('app.deleting_ticket', true) = old.ticket_id::text then return old; end if;
  raise exception 'O histórico de chamados é imutável';
end; $$;

CREATE OR REPLACE FUNCTION public.delete_closed_ticket(_ticket uuid) RETURNS text[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare st ticket_status; paths text[];
begin
  if not public.is_staff(auth.uid()) then raise exception 'Acesso negado'; end if;
  select status into st from public.tickets where id = _ticket for update;
  if not found then raise exception 'Chamado não encontrado'; end if;
  if st not in ('concluido','cancelado') then raise exception 'Só é possível excluir chamados concluídos ou cancelados'; end if;
  select coalesce(array_agg(storage_path), '{}') into paths from public.ticket_attachments where ticket_id = _ticket;
  perform set_config('app.deleting_ticket', _ticket::text, true);
  delete from public.ticket_events where ticket_id = _ticket;
  delete from public.ticket_attachments where ticket_id = _ticket;
  delete from public.notifications where ticket_id = _ticket;
  delete from public.tickets where id = _ticket;
  perform set_config('app.deleting_ticket', '', true);
  return paths;
end; $$;

REVOKE ALL ON FUNCTION public.delete_closed_ticket(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_closed_ticket(uuid) TO authenticated;