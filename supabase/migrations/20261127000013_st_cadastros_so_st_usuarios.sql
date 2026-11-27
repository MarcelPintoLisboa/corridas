-- =====================================================================================
-- Cadastros do Corre+ ficam só em st_usuarios (não em public.usuarios).
--
-- Este projeto Supabase é compartilhado com o Assistência ML, que tem os gatilhos
-- ml_novo_usuario / ml_usuario_atualizado em auth.users copiando todo login novo
-- para public.usuarios. Agora:
--   1) todo login criado pelo Corre+ leva raw_user_meta_data.app = 'Corre+'
--      (cadastro pelo app: AuthProvider.signUp; cadastro pelo admin: st_criar_usuario);
--   2) ml_novo_usuario ignora logins com app = 'Corre+' (os do Assistência ML seguem iguais);
--   3) limpa de public.usuarios os registros que são só do Corre+.
-- =====================================================================================

-- 1) cadastro feito pelo admin/gestor marca o login como do Corre+
CREATE OR REPLACE FUNCTION public.st_criar_usuario(p_email text, p_full_name text, p_role st_papel, p_password text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_email text := lower(trim(p_email));
  v_name  text := coalesce(nullif(trim(p_full_name), ''), split_part(lower(trim(p_email)), '@', 1));
  v_role  public.st_papel := p_role;
  v_uid   uuid;
  v_status text := 'criado';
  v_u public.st_usuarios;
begin
  if not public.st_is_admin() then
    raise exception 'Somente administradores cadastram usuários';
  end if;
  if not public.st_is_admin_geral() then
    v_role := 'athlete';  -- gestor cadastra apenas corredores
  end if;
  if v_email !~ '^\S+@\S+\.\S+$' then raise exception 'E-mail inválido'; end if;
  if exists (select 1 from public.st_usuarios where email = v_email) then
    raise exception 'Este e-mail já está cadastrado.';
  end if;

  select id into v_uid from auth.users where lower(email) = v_email limit 1;

  if v_uid is null then
    if coalesce(length(p_password), 0) < 6 then
      raise exception 'A senha deve ter pelo menos 6 caracteres';
    end if;
    v_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
      extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', v_name, 'app', 'Corre+'),
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_uid, v_uid::text,
            jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
            'email', now(), now(), now());
  else
    v_status := 'ja_tinha_conta';  -- não mexe na senha de quem já tem login
  end if;

  insert into public.st_usuarios (email, full_name, role, criado_por, user_id, trocar_senha)
  values (v_email, v_name, v_role, auth.uid(), v_uid, v_status = 'criado')
  returning * into v_u;

  return json_build_object('status', v_status, 'usuario_id', v_u.id, 'role', v_u.role);
end;
$function$
;

-- 2) gatilho do Assistência ML: não copia logins do Corre+ para public.usuarios
create or replace function public.ml_novo_usuario()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if coalesce(new.raw_user_meta_data ->> 'app', '') = 'Corre+' then
    return new;  -- cadastro do Corre+: fica só em public.st_usuarios
  end if;
  insert into public.usuarios (id, email, app_cadastro, criado_em, ultimo_login)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'app', ''), new.created_at, new.last_sign_in_at)
  on conflict (id) do nothing;
  return new;
end;
$function$;

-- logins antigos do Corre+ (cadastrados pelo admin ou que já estão em st_usuarios) ganham a marca
update auth.users a
   set raw_user_meta_data = coalesce(a.raw_user_meta_data, '{}'::jsonb) || '{"app":"Corre+"}'::jsonb
  from public.st_usuarios s
 where s.user_id = a.id
   and coalesce(a.raw_user_meta_data ->> 'app', '') = ''
   and lower(a.email) <> 'mapl11@hotmail.com';  -- admin geral usa os dois sistemas

-- 3) remove de public.usuarios quem é só do Corre+
delete from public.usuarios u
 using auth.users a
 where a.id = u.id
   and a.raw_user_meta_data ->> 'app' = 'Corre+';
