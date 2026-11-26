REVOKE EXECUTE ON FUNCTION public.account_ready(uuid), public.has_role(uuid, public.app_role), public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_ready(uuid), public.has_role(uuid, public.app_role), public.is_staff(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_staff(uuid, text, text, text) FROM PUBLIC, anon, authenticated;