-- =====================================================================================
-- Apagar um cadastro do Corre+ apaga também o login (auth.users)
--
-- Antes: removendo a pessoa de st_usuarios, o login continuava em auth.users e o
-- e-mail não podia ser cadastrado de novo ("Este e-mail já possui cadastro").
-- Agora, ao apagar de st_usuarios, o login também é apagado — desde que seja um
-- login do Corre+ (app = 'Corre+') e não esteja em uso por outro sistema do projeto
-- (Assistência ML / Imobiliário). Os dados do Corre+ ligados ao login saem junto.
-- =====================================================================================

create or replace function public.st_login_corre_eh_exclusivo(p_uid uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from auth.users a where a.id = p_uid and a.raw_user_meta_data ->> 'app' = 'Corre+')
     and not exists (select 1 from public.usuarios u where u.id = p_uid)
     and not exists (select 1 from public.assistencia_usuarios x where x.user_id = p_uid or x.owner_id = p_uid)
     and not exists (select 1 from public.imobiliario_usuario y where y.user_id = p_uid or y.owner_id = p_uid);
$$;

create or replace function public.st_apagar_login_corre()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if old.user_id is not null and public.st_login_corre_eh_exclusivo(old.user_id) then
    delete from auth.users where id = old.user_id;
  end if;
  return old;
end;
$function$;

drop trigger if exists st_apagar_login_corre on public.st_usuarios;
create trigger st_apagar_login_corre
  after delete on public.st_usuarios
  for each row execute function public.st_apagar_login_corre();

-- limpa logins do Corre+ que ficaram sem cadastro em st_usuarios (apagados antes desta regra)
delete from auth.users a
 where a.raw_user_meta_data ->> 'app' = 'Corre+'
   and not exists (select 1 from public.st_usuarios s where s.user_id = a.id or lower(s.email) = lower(a.email))
   and public.st_login_corre_eh_exclusivo(a.id);
