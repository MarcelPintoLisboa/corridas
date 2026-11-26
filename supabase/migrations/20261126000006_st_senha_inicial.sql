-- =====================================================================
-- Street Running — CADASTRO DE USUÁRIO COM SENHA INICIAL
--
-- O administrador (geral ou gestor) cadastra a pessoa já com uma senha
-- inicial (digitada ou gerada no app). O login é criado confirmado, então
-- a pessoa entra direto com e-mail + senha, sem precisar criar conta.
--   • Admin geral: cadastra gestores ou corredores.
--   • Gestor: cadastra só corredores (ficam ligados a ele).
--   • Se o e-mail já tem login (ex.: conta de outro app do mesmo Supabase),
--     a senha atual é mantida e apenas o acesso é liberado.
--
--   • Quem recebe senha provisória precisa criar a própria senha no
--     primeiro acesso (coluna trocar_senha).
--
-- Rode no SQL Editor depois do 0004. Pode rodar de novo.
-- =====================================================================

alter table public.st_usuarios add column if not exists trocar_senha boolean not null default false;
comment on column public.st_usuarios.trocar_senha is 'true = entrou com senha provisória e precisa criar a própria senha';

create or replace function public.st_criar_usuario(
  p_email text,
  p_full_name text,
  p_role public.st_papel,
  p_password text
) returns json
language plpgsql security definer set search_path = public, extensions as $fn$
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
      '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', v_name),
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
$fn$;

revoke all on function public.st_criar_usuario(text, text, public.st_papel, text) from public, anon;
grant execute on function public.st_criar_usuario(text, text, public.st_papel, text) to authenticated;

-- chamado pelo app depois que a pessoa cria a própria senha
create or replace function public.st_senha_trocada()
returns void language sql security definer set search_path = public as $$
  update public.st_usuarios set trocar_senha = false where user_id = auth.uid();
$$;
revoke all on function public.st_senha_trocada() from public, anon;
grant execute on function public.st_senha_trocada() to authenticated;
