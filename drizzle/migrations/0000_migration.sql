
create type public.app_role as enum ('admin','developer','requester');
create type public.ticket_priority as enum ('critica','alta','media','baixa');
create type public.ticket_status as enum ('enviado','recebido','em_analise','em_andamento','concluido','aguardando_info','encaminhado','cancelado');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text not null default '',
  registration text,
  department text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','developer'))
$$;

create policy "profiles read own or staff" on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff(auth.uid()));
create policy "profiles staff update" on public.profiles for update to authenticated using (public.is_staff(auth.uid()));
create policy "roles read own or staff" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));

create table public.departments (id uuid primary key default gen_random_uuid(), name text not null unique, description text, active boolean not null default true, created_at timestamptz not null default now());
create table public.categories (id uuid primary key default gen_random_uuid(), name text not null unique, default_priority public.ticket_priority not null default 'media', active boolean not null default true, created_at timestamptz not null default now());
create table public.routing_rules (id uuid primary key default gen_random_uuid(), topic text not null, department text not null, involves_safety boolean not null default false, notes text, active boolean not null default true, created_at timestamptz not null default now());
create table public.sla_settings (priority public.ticket_priority primary key, hours integer not null);
create table public.app_settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now());
grant select, insert, update, delete on public.departments, public.categories, public.routing_rules, public.sla_settings, public.app_settings to authenticated;
grant all on public.departments, public.categories, public.routing_rules, public.sla_settings, public.app_settings to service_role;
alter table public.departments enable row level security;
alter table public.categories enable row level security;
alter table public.routing_rules enable row level security;
alter table public.sla_settings enable row level security;
alter table public.app_settings enable row level security;
create policy "read" on public.departments for select to authenticated using (true);
create policy "staff write" on public.departments for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "read" on public.categories for select to authenticated using (true);
create policy "staff write" on public.categories for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "read" on public.routing_rules for select to authenticated using (true);
create policy "staff write" on public.routing_rules for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "read" on public.sla_settings for select to authenticated using (true);
create policy "staff write" on public.sla_settings for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "staff read" on public.app_settings for select to authenticated using (public.is_staff(auth.uid()));
create policy "dev write" on public.app_settings for all to authenticated using (public.has_role(auth.uid(),'developer')) with check (public.has_role(auth.uid(),'developer'));

create sequence public.ticket_seq;
grant usage on sequence public.ticket_seq to authenticated, service_role;
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  number bigint not null default nextval('public.ticket_seq') unique,
  protocol text unique,
  requester_id uuid not null,
  requester_name text not null,
  registration text not null,
  department text not null,
  location text not null,
  category text not null,
  title text not null,
  description text not null,
  priority public.ticket_priority not null default 'media',
  status public.ticket_status not null default 'enviado',
  assignee_id uuid,
  assignee_name text,
  observations text,
  solution text,
  ai_suggested_priority public.ticket_priority,
  ai_suggested_department text,
  ai_is_safety boolean,
  ai_summary text,
  ai_redirected boolean not null default false,
  due_at timestamptz,
  received_at timestamptz,
  started_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.tickets(requester_id);
create index on public.tickets(status);
grant select, insert, update on public.tickets to authenticated;
grant all on public.tickets to service_role;
alter table public.tickets enable row level security;
create policy "tickets read" on public.tickets for select to authenticated using (requester_id = auth.uid() or public.is_staff(auth.uid()));
create policy "tickets insert own" on public.tickets for insert to authenticated with check (requester_id = auth.uid());
create policy "tickets staff update" on public.tickets for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create table public.ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete restrict,
  actor_id uuid,
  actor_name text,
  event_type text not null,
  from_status public.ticket_status,
  to_status public.ticket_status,
  from_priority public.ticket_priority,
  to_priority public.ticket_priority,
  note text,
  created_at timestamptz not null default now()
);
create index on public.ticket_events(ticket_id, created_at);
grant select, insert on public.ticket_events to authenticated;
grant all on public.ticket_events to service_role;
alter table public.ticket_events enable row level security;
create policy "events read" on public.ticket_events for select to authenticated using (exists (select 1 from public.tickets t where t.id = ticket_id and (t.requester_id = auth.uid() or public.is_staff(auth.uid()))));
create policy "events comment" on public.ticket_events for insert to authenticated with check (
  event_type = 'comment' and actor_id = auth.uid() and exists (select 1 from public.tickets t where t.id = ticket_id and (t.requester_id = auth.uid() or public.is_staff(auth.uid()))));

create or replace function public.prevent_event_changes() returns trigger language plpgsql as $$
begin raise exception 'O histórico de chamados é imutável'; end; $$;
create trigger ticket_events_immutable before update or delete on public.ticket_events for each row execute function public.prevent_event_changes();

create table public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete restrict,
  uploaded_by uuid not null,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
grant select, insert on public.ticket_attachments to authenticated;
grant all on public.ticket_attachments to service_role;
alter table public.ticket_attachments enable row level security;
create policy "att read" on public.ticket_attachments for select to authenticated using (exists (select 1 from public.tickets t where t.id = ticket_id and (t.requester_id = auth.uid() or public.is_staff(auth.uid()))));
create policy "att insert" on public.ticket_attachments for insert to authenticated with check (uploaded_by = auth.uid() and exists (select 1 from public.tickets t where t.id = ticket_id and (t.requester_id = auth.uid() or public.is_staff(auth.uid()))));

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  ticket_id uuid,
  kind text not null default 'info',
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.notifications(user_id, read);
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "notif own read" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notif own update" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.notify_staff(_ticket uuid, _kind text, _title text, _body text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, ticket_id, kind, title, body)
  select distinct ur.user_id, _ticket, _kind, _title, _body from public.user_roles ur where ur.role in ('admin','developer');
$$;

create or replace function public.actor_name() returns text language sql stable security definer set search_path = public as $$
  select coalesce((select nullif(full_name,'') from public.profiles where id = auth.uid()), (select username from public.profiles where id = auth.uid()), 'Sistema')
$$;

create or replace function public.tickets_before_insert() returns trigger language plpgsql security definer set search_path = public as $$
declare h integer;
begin
  new.protocol := 'SST-' || to_char(now() at time zone 'America/Sao_Paulo','YYYY') || '-' || lpad(new.number::text, 5, '0');
  new.status := 'enviado';
  select hours into h from public.sla_settings where priority = new.priority;
  new.due_at := now() + make_interval(hours => coalesce(h, 72));
  if not public.is_staff(auth.uid()) then
    new.assignee_id := null; new.assignee_name := null; new.solution := null;
  end if;
  return new;
end; $$;
create trigger tickets_bi before insert on public.tickets for each row execute function public.tickets_before_insert();

create or replace function public.tickets_after_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.ticket_events(ticket_id, actor_id, actor_name, event_type, to_status, to_priority, note)
  values (new.id, new.requester_id, new.requester_name, 'created', 'enviado', new.priority, 'Chamado registrado');
  if new.ai_summary is not null then
    insert into public.ticket_events(ticket_id, actor_id, actor_name, event_type, note)
    values (new.id, null, 'Assistente IA', 'ai_recommendation',
      'Setor sugerido: ' || coalesce(new.ai_suggested_department,'-') || ' | Prioridade sugerida: ' || coalesce(new.ai_suggested_priority::text,'-') || ' | ' || new.ai_summary);
  end if;
  perform public.notify_staff(new.id, case when new.priority = 'critica' then 'critical' else 'new' end,
    case when new.priority = 'critica' then 'CRÍTICO: ' else 'Novo chamado: ' end || new.protocol, new.title);
  insert into public.notifications(user_id, ticket_id, kind, title, body)
  values (new.requester_id, new.id, 'info', 'Chamado ' || new.protocol || ' enviado', 'Seu chamado foi registrado com sucesso.');
  return new;
end; $$;
create trigger tickets_ai after insert on public.tickets for each row execute function public.tickets_after_insert();

create or replace function public.tickets_before_update() returns trigger language plpgsql security definer set search_path = public as $$
declare h integer; actor text := public.actor_name();
begin
  new.updated_at := now();
  new.number := old.number; new.protocol := old.protocol; new.requester_id := old.requester_id; new.created_at := old.created_at;
  if new.status is distinct from old.status then
    if new.received_at is null and new.status <> 'enviado' then new.received_at := now(); end if;
    if new.status = 'em_andamento' and old.started_at is null then new.started_at := now(); end if;
    if new.status in ('concluido','cancelado') then new.closed_at := now(); else new.closed_at := null; end if;
    insert into public.ticket_events(ticket_id, actor_id, actor_name, event_type, from_status, to_status, note)
    values (new.id, auth.uid(), actor, 'status', old.status, new.status, nullif(current_setting('app.change_note', true),''));
    insert into public.notifications(user_id, ticket_id, kind, title, body)
    values (new.requester_id, new.id, case when new.status='aguardando_info' then 'info_request' else 'status' end, 'Chamado ' || new.protocol, 'Status alterado para ' || new.status::text);
  end if;
  if new.priority is distinct from old.priority then
    select hours into h from public.sla_settings where priority = new.priority;
    new.due_at := new.created_at + make_interval(hours => coalesce(h, 72));
    insert into public.ticket_events(ticket_id, actor_id, actor_name, event_type, from_priority, to_priority)
    values (new.id, auth.uid(), actor, 'priority', old.priority, new.priority);
    insert into public.notifications(user_id, ticket_id, kind, title, body)
    values (new.requester_id, new.id, 'priority', 'Chamado ' || new.protocol, 'Prioridade alterada para ' || new.priority::text);
    if new.priority = 'critica' then perform public.notify_staff(new.id, 'critical', 'CRÍTICO: ' || new.protocol, new.title); end if;
  end if;
  if new.assignee_id is distinct from old.assignee_id then
    insert into public.ticket_events(ticket_id, actor_id, actor_name, event_type, note)
    values (new.id, auth.uid(), actor, 'assignee', 'Responsável: ' || coalesce(new.assignee_name, 'nenhum'));
    if new.assignee_id is not null then
      insert into public.notifications(user_id, ticket_id, kind, title, body)
      values (new.assignee_id, new.id, 'assigned', 'Chamado ' || new.protocol || ' atribuído a você', new.title);
    end if;
  end if;
  if new.department is distinct from old.department then
    insert into public.ticket_events(ticket_id, actor_id, actor_name, event_type, note)
    values (new.id, auth.uid(), actor, 'forward', 'Encaminhado de ' || old.department || ' para ' || new.department);
  end if;
  if new.solution is distinct from old.solution and new.solution is not null then
    insert into public.ticket_events(ticket_id, actor_id, actor_name, event_type, note)
    values (new.id, auth.uid(), actor, 'solution', new.solution);
  end if;
  return new;
end; $$;
create trigger tickets_bu before update on public.tickets for each row execute function public.tickets_before_update();

insert into public.departments(name) values ('Segurança do Trabalho'),('Tecnologia da Informação'),('Recursos Humanos'),('Manutenção'),('Facilities'),('Produção'),('Logística'),('Qualidade'),('Administrativo');
insert into public.categories(name, default_priority) values
 ('Falta de EPI','alta'),('Condição insegura','alta'),('Risco de acidente','critica'),('Acidente / Incidente','critica'),('Exposição ocupacional','alta'),('Máquina com risco','alta'),('Sinalização de segurança','media'),('Treinamento / Orientação','baixa'),('Inspeção solicitada','media'),('Outros','media');
insert into public.routing_rules(topic, department, involves_safety, notes) values
 ('Falta de Equipamento de Proteção Individual (EPI)','Segurança do Trabalho',true,null),
 ('Condições inseguras no ambiente de trabalho','Segurança do Trabalho',true,null),
 ('Risco de acidente ou exposição ocupacional','Segurança do Trabalho',true,null),
 ('Problemas com computadores e sistemas','Tecnologia da Informação',false,null),
 ('Solicitação de férias ou benefícios','Recursos Humanos',false,null),
 ('Defeitos em máquinas industriais','Manutenção',true,'Com participação da Segurança do Trabalho quando houver risco ocupacional'),
 ('Problemas estruturais nas instalações','Facilities',true,'Avaliação de Segurança do Trabalho quando necessário');
insert into public.sla_settings values ('critica',4),('alta',24),('media',72),('baixa',168);
insert into public.app_settings(key, value) values ('ai', '{"enabled": true, "extra_instructions": ""}'::jsonb), ('integrations', '{"m365_email": false, "teams": false}'::jsonb);

alter publication supabase_realtime add table public.notifications;

create policy "att upload own folder" on storage.objects for insert to authenticated with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "att read" on storage.objects for select to authenticated using (bucket_id = 'attachments' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff(auth.uid()) or exists (select 1 from public.ticket_attachments a join public.tickets t on t.id=a.ticket_id where a.storage_path = name and t.requester_id = auth.uid())));
