-- =====================================================================================
-- Cadastro pelo app só vira usuário do Corre+ depois que a pessoa confirma o e-mail
-- (clicando no link enviado pelo Supabase Auth).
--
-- Além de ligar "Confirm email" em Authentication → Sign In / Providers → Email,
-- esta trava garante no banco: st_minha_conta() não cria nem liga o registro em
-- st_usuarios enquanto auth.users.email_confirmed_at estiver vazio.
-- Contas criadas pelo admin/gestor já nascem confirmadas (st_senha_inicial).
-- =====================================================================================

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
