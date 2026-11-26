CREATE OR REPLACE FUNCTION public.replace_app_user_role(_actor_id uuid, _target_id uuid, _role public.app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(_actor_id) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF _actor_id = _target_id THEN RAISE EXCEPTION 'Você não pode alterar o próprio perfil'; END IF;
  PERFORM id FROM public.profiles WHERE id = _target_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;
  IF NOT public.has_role(_actor_id, 'developer') AND (_role = 'developer' OR public.has_role(_target_id, 'developer')) THEN
    RAISE EXCEPTION 'Somente Desenvolvedor pode alterar esse perfil';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _target_id;
  INSERT INTO public.user_roles(user_id, role) VALUES (_target_id, _role);
END; $$;
REVOKE ALL ON FUNCTION public.replace_app_user_role(uuid, uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_app_user_role(uuid, uuid, public.app_role) TO service_role;