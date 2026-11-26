ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS deleted_by_name text, ADD COLUMN IF NOT EXISTS rating smallint CHECK (rating BETWEEN 1 AND 5), ADD COLUMN IF NOT EXISTS rating_comment text, ADD COLUMN IF NOT EXISTS rated_at timestamptz;

DROP POLICY IF EXISTS "tickets read" ON public.tickets;
CREATE POLICY "tickets read" ON public.tickets FOR SELECT TO authenticated USING ((requester_id = auth.uid() AND deleted_at IS NULL) OR public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.tickets_guard_special() RETURNS trigger LANGUAGE plpgsql AS $$
begin
  if coalesce(current_setting('app.rating', true),'') <> new.id::text then
    new.rating := old.rating; new.rating_comment := old.rating_comment; new.rated_at := old.rated_at;
  end if;
  if coalesce(current_setting('app.trash', true),'') <> new.id::text then
    new.deleted_at := old.deleted_at; new.deleted_by_name := old.deleted_by_name;
  end if;
  return new;
end; $$;
DROP TRIGGER IF EXISTS tickets_guard ON public.tickets;
CREATE TRIGGER tickets_guard BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.tickets_guard_special();

CREATE OR REPLACE FUNCTION public.delete_closed_ticket(_ticket uuid) RETURNS text[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare st ticket_status;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Acesso negado'; end if;
  select status into st from public.tickets where id = _ticket and deleted_at is null for update;
  if not found then raise exception 'Chamado não encontrado'; end if;
  if st not in ('concluido','cancelado') then raise exception 'Só é possível excluir chamados concluídos ou cancelados'; end if;
  perform set_config('app.trash', _ticket::text, true);
  update public.tickets set deleted_at = now(), deleted_by_name = public.actor_name() where id = _ticket;
  perform set_config('app.trash', '', true);
  return '{}'::text[];
end; $$;

CREATE OR REPLACE FUNCTION public.restore_ticket(_ticket uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'Acesso negado'; end if;
  perform set_config('app.trash', _ticket::text, true);
  update public.tickets set deleted_at = null, deleted_by_name = null where id = _ticket and deleted_at is not null;
  if not found then raise exception 'Chamado não está na lixeira'; end if;
  perform set_config('app.trash', '', true);
end; $$;

CREATE OR REPLACE FUNCTION public.purge_tickets(_ticket uuid DEFAULT NULL) RETURNS text[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare ids uuid[]; paths text[]; i uuid;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Acesso negado'; end if;
  select coalesce(array_agg(id), '{}') into ids from public.tickets
   where deleted_at is not null and ((_ticket is not null and id = _ticket) or (_ticket is null and deleted_at < now() - interval '30 days'));
  select coalesce(array_agg(storage_path), '{}') into paths from public.ticket_attachments where ticket_id = any(ids);
  foreach i in array ids loop
    perform set_config('app.deleting_ticket', i::text, true);
    delete from public.ticket_events where ticket_id = i;
  end loop;
  perform set_config('app.deleting_ticket', '', true);
  delete from public.ticket_attachments where ticket_id = any(ids);
  delete from public.notifications where ticket_id = any(ids);
  delete from public.tickets where id = any(ids);
  return paths;
end; $$;

CREATE OR REPLACE FUNCTION public.rate_ticket(_ticket uuid, _rating smallint, _comment text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if not public.account_ready(auth.uid()) then raise exception 'Acesso negado'; end if;
  if _rating is null or _rating < 1 or _rating > 5 then raise exception 'Nota inválida'; end if;
  perform set_config('app.rating', _ticket::text, true);
  update public.tickets set rating = _rating, rating_comment = nullif(left(trim(coalesce(_comment,'')), 1000), ''), rated_at = now()
   where id = _ticket and requester_id = auth.uid() and status = 'concluido' and rated_at is null and deleted_at is null;
  if not found then raise exception 'Este chamado não pode ser avaliado'; end if;
  perform set_config('app.rating', '', true);
end; $$;

REVOKE ALL ON FUNCTION public.restore_ticket(uuid), public.purge_tickets(uuid), public.rate_ticket(uuid, smallint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_ticket(uuid), public.purge_tickets(uuid), public.rate_ticket(uuid, smallint, text) TO authenticated;