CREATE POLICY "att staff delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'attachments' AND public.is_staff(auth.uid()) AND NOT EXISTS (SELECT 1 FROM public.ticket_attachments a WHERE a.storage_path = name));

CREATE OR REPLACE FUNCTION public.notify_staff(_ticket uuid, _kind text, _title text, _body text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  insert into public.notifications(user_id, ticket_id, kind, title, body)
  select distinct ur.user_id, _ticket, _kind, _title, _body from public.user_roles ur join public.profiles p on p.id = ur.user_id
  where ur.role in ('admin','developer') and p.active;
$$;