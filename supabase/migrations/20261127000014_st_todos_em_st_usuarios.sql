-- =====================================================================================
-- Todo cadastro do Corre+ vai para st_usuarios (e não para public.usuarios do Assistência ML)
--
--  1) gatilho em auth.users: quando um login com app = 'Corre+' tem o e-mail confirmado
--     (clique no link), entra em st_usuarios na hora. Os criados pelo admin já entram
--     por st_criar_usuario, por isso o gatilho não roda no INSERT;
--  2) st_minha_conta (roda a cada entrada no Corre+): marca o login como 'Corre+' e o tira
--     de public.usuarios se lá ele não for do Assistência ML — cobre cadastros feitos por
--     versões antigas do app, que ainda não enviavam a marca.
--  O admin geral (mapl11@hotmail.com) usa os dois sistemas e continua nas duas tabelas.
-- =====================================================================================

-- 1) cria o registro em st_usuarios assim que o e-mail do Corre+ estiver confirmado
create or replace function public.st_login_corre_confirmado()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if coalesce(new.raw_user_meta_data ->> 'app', '') = 'Corre+' and new.email_confirmed_at is not null then
    insert into public.st_usuarios (user_id, email, full_name, phone, role)
    values (new.id, lower(new.email),
            coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
            new.raw_user_meta_data ->> 'phone',
            'athlete'::public.st_papel)
    on conflict (email) do update set user_id = coalesce(public.st_usuarios.user_id, excluded.user_id);
  end if;
  return new;
end;
$function$;

drop trigger if exists st_login_corre_confirmado on auth.users;
create trigger st_login_corre_confirmado
  after update of email_confirmed_at, raw_user_meta_data on auth.users
  for each row execute function public.st_login_corre_confirmado();

-- 2) st_minha_conta: além do que já fazia, garante a marca Corre+ e tira de public.usuarios
create or replace function public.st_minha_conta(p_full_name text default null, p_phone text default null)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  r public.st_usuarios;
  v_email text := public.st_email();
begin
  if auth.uid() is null then return null; end if;

  -- e-mail ainda não confirmado: não entra no sistema
  if not exists (select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null) then
    return json_build_object('situacao', 'nao_confirmado');
  end if;

  -- quem entra pelo Corre+ é cadastro do Corre+: marca o login e tira da tabela do Assistência ML
  if lower(v_email) <> 'mapl11@hotmail.com' then
    update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"app":"Corre+"}'::jsonb
     where id = auth.uid() and coalesce(raw_user_meta_data ->> 'app', '') = '';
    delete from public.usuarios
     where id = auth.uid() and coalesce(app_cadastro, '') in ('', 'Corre+');
  end if;

  select * into r from public.st_usuarios where user_id = auth.uid();
  if not found then
    -- cadastro feito antes pelo admin (pelo e-mail)
    update public.st_usuarios set user_id = auth.uid(),
           full_name = case when full_name = '' then coalesce(p_full_name, full_name) else full_name end,
           phone = coalesce(phone, p_phone)
     where email = v_email and user_id is null
    returning * into r;
  end if;
  if r.id is null then
    -- novo corredor (cadastro pelo próprio app, e-mail já confirmado)
    insert into public.st_usuarios (user_id, email, full_name, phone, role)
    values (auth.uid(), v_email,
            coalesce(p_full_name, (select raw_user_meta_data->>'full_name' from auth.users where id = auth.uid()), split_part(v_email, '@', 1)),
            coalesce(p_phone, (select raw_user_meta_data->>'phone' from auth.users where id = auth.uid())),
            case when v_email = 'mapl11@hotmail.com' then 'admin'::public.st_papel else 'athlete'::public.st_papel end)
    on conflict (email) do update set user_id = excluded.user_id
    returning * into r;
  end if;

  return json_build_object(
    'situacao', case when r.ativo or public.st_is_admin_geral() then 'ok' else 'desativado' end,
    'usuario', row_to_json(r),
    'admin', public.st_is_admin(),
    'admin_geral', public.st_is_admin_geral()
  );
end $$;

grant execute on function public.st_minha_conta(text, text) to authenticated;
