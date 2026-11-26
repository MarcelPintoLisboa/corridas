-- =====================================================================
-- Street Running — GESTORES DE CORRIDA, CORREDORES ASSOCIADOS E COMENTÁRIOS
--
-- Modelo de venda:
--   • Administrador geral (mapl11@hotmail.com): vê e gerencia tudo; cadastra gestores.
--   • Gestor (role 'admin'): cria as PRÓPRIAS corridas e associa corredores a elas.
--     Não vê corridas, corredores nem leads de outros gestores.
--   • Corredor: vê SOMENTE as corridas em que está associado e todo o conteúdo
--     publicado nelas (treinos, dicas, kits, patrocinadores, publicações).
--   • Mural: posts com foto e comentários, visíveis só entre os associados
--     da mesma corrida (o gestor da corrida modera).
--
-- Rode no SQL Editor depois dos arquivos 0001, 0002 e 0003. Pode rodar de novo.
-- =====================================================================

-- ------------------------------------------------------------------ permissões
-- gestor só gerencia as corridas que criou; admin geral gerencia todas
create or replace function public.st_can_manage_event(p_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.st_is_admin_geral()
      or (public.st_is_admin()
          and exists (select 1 from public.st_events e where e.id = p_event_id and e.organizer_id = auth.uid()));
$$;

-- corridas já existentes sem dono passam a ser do administrador geral
update public.st_events e set organizer_id = u.id
from auth.users u
where e.organizer_id is null and lower(u.email) = 'mapl11@hotmail.com';

-- o gestor que cria a corrida é sempre o dono
create or replace function public.st_set_event_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.st_is_admin_geral() then
    new.organizer_id := auth.uid();
  elsif new.organizer_id is null then
    new.organizer_id := auth.uid();
  end if;
  return new;
end $$;
drop trigger if exists trg_st_set_event_owner on public.st_events;
create trigger trg_st_set_event_owner before insert on public.st_events for each row execute function public.st_set_event_owner();

-- o gestor enxerga as pessoas que cadastrou ou que estão nas corridas dele
create or replace function public.st_gestor_ve_usuario(p_usuario_id uuid, p_user_id uuid, p_criado_por uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.st_is_admin() and (
       p_criado_por = auth.uid()
    or exists (select 1 from public.st_registrations r join public.st_events e on e.id = r.event_id
               where r.user_id = p_user_id and e.organizer_id = auth.uid())
    or exists (select 1 from public.st_inscricoes_pendentes p join public.st_events e on e.id = p.event_id
               where p.usuario_id = p_usuario_id and e.organizer_id = auth.uid())
  );
$$;

-- ------------------------------------------------------------------ st_usuarios
drop policy if exists "st_usuarios: ler" on public.st_usuarios;
drop policy if exists "st_usuarios: editar" on public.st_usuarios;
drop policy if exists "st_usuarios: admin cadastra" on public.st_usuarios;
drop policy if exists "st_usuarios: admin remove" on public.st_usuarios;
create policy "st_usuarios: ler" on public.st_usuarios for select
  using (user_id = auth.uid() or public.st_is_admin_geral() or public.st_gestor_ve_usuario(id, user_id, criado_por));
create policy "st_usuarios: editar" on public.st_usuarios for update
  using (user_id = auth.uid() or public.st_is_admin_geral() or public.st_gestor_ve_usuario(id, user_id, criado_por));
create policy "st_usuarios: admin cadastra" on public.st_usuarios for insert with check (public.st_is_admin());
create policy "st_usuarios: admin remove" on public.st_usuarios for delete
  using (email <> 'mapl11@hotmail.com' and (public.st_is_admin_geral() or (public.st_is_admin() and criado_por = auth.uid() and role = 'athlete')));

-- só o administrador geral cria/promove gestores; gestor cadastra apenas corredores
create or replace function public.st_protect_usuario_gestor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and public.st_is_admin() and not public.st_is_admin_geral() then
    if tg_op = 'INSERT' then
      new.role := 'athlete';
      new.criado_por := auth.uid();
    elsif new.user_id is distinct from auth.uid() then
      new.role := old.role;  -- gestor não muda papel de ninguém
    end if;
  elsif tg_op = 'INSERT' and new.criado_por is null then
    new.criado_por := auth.uid();
  end if;
  if tg_op = 'INSERT' then new.email := lower(trim(new.email)); end if;
  return new;
end $$;
drop trigger if exists trg_st_protect_usuario_gestor on public.st_usuarios;
create trigger trg_st_protect_usuario_gestor before insert or update on public.st_usuarios
  for each row execute function public.st_protect_usuario_gestor();

-- ------------------------------------------------------------------ corridas e conteúdo
-- corredor vê só as corridas associadas; gestor vê as suas; admin geral vê todas
drop policy if exists "st_events: ler" on public.st_events;
drop policy if exists "st_events: excluir" on public.st_events;
create policy "st_events: ler" on public.st_events for select
  using (public.st_is_registered(id) or public.st_can_manage_event(id)
         -- linha recém-criada (insert ... returning): confere o dono direto na linha
         or (organizer_id = auth.uid() and public.st_is_admin()));
create policy "st_events: excluir" on public.st_events for delete using (public.st_can_manage_event(id));

drop policy if exists "st_event_distances: ler" on public.st_event_distances;
create policy "st_event_distances: ler" on public.st_event_distances for select
  using (public.st_is_registered(event_id) or public.st_can_manage_event(event_id));
drop policy if exists "st_kit_pickups: ler" on public.st_kit_pickups;
create policy "st_kit_pickups: ler" on public.st_kit_pickups for select
  using (public.st_is_registered(event_id) or public.st_can_manage_event(event_id));
drop policy if exists "st_sponsors: ler" on public.st_sponsors;
create policy "st_sponsors: ler" on public.st_sponsors for select
  using ((active and public.st_is_registered(event_id)) or public.st_can_manage_event(event_id));
drop policy if exists "st_posts: ler" on public.st_posts;
create policy "st_posts: ler" on public.st_posts for select
  using ((published and published_at <= now() and public.st_is_registered(event_id)) or public.st_can_manage_event(event_id));

-- ------------------------------------------------------------------ associação de corredores
drop policy if exists "st_inscricoes_pendentes: admin" on public.st_inscricoes_pendentes;
create policy "st_inscricoes_pendentes: admin" on public.st_inscricoes_pendentes
  for all using (public.st_can_manage_event(event_id)) with check (public.st_can_manage_event(event_id));

-- associa por e-mail: se a pessoa não existe no controle de acesso, é cadastrada como corredor
create or replace function public.st_associar_corredor_email(
  p_event_id uuid, p_email text, p_full_name text default null, p_distance_id uuid default null,
  p_level public.st_runner_level default 'beginner'
) returns text
language plpgsql security definer set search_path = public as $fn$
declare
  v_email text := lower(trim(p_email));
  v_u public.st_usuarios;
begin
  if not public.st_can_manage_event(p_event_id) then
    raise exception 'Você não gerencia esta corrida';
  end if;
  if v_email !~ '^\S+@\S+\.\S+$' then raise exception 'E-mail inválido'; end if;

  select * into v_u from public.st_usuarios where email = v_email;
  if not found then
    insert into public.st_usuarios (email, full_name, role, criado_por)
    values (v_email, coalesce(nullif(trim(p_full_name), ''), split_part(v_email, '@', 1)), 'athlete', auth.uid())
    returning * into v_u;
    -- se a pessoa já tem login (ex.: conta de outro app do mesmo Supabase), liga agora
    update public.st_usuarios set user_id = (select id from auth.users where lower(email) = v_email limit 1)
    where id = v_u.id and exists (select 1 from auth.users where lower(email) = v_email)
    returning * into v_u;
    if v_u.id is null then select * into v_u from public.st_usuarios where email = v_email; end if;
  end if;

  return public.st_associar_corredor(p_event_id, v_u.id, p_distance_id, p_level);
end;
$fn$;
revoke all on function public.st_associar_corredor_email(uuid, text, text, uuid, public.st_runner_level) from public, anon;
grant execute on function public.st_associar_corredor_email(uuid, text, text, uuid, public.st_runner_level) to authenticated;

-- a associação por id passa a exigir ser gestor DESTA corrida
create or replace function public.st_associar_corredor(
  p_event_id uuid, p_usuario_id uuid, p_distance_id uuid default null,
  p_level public.st_runner_level default 'beginner'
) returns text
language plpgsql security definer set search_path = public as $fn$
declare
  v_u public.st_usuarios;
begin
  if not public.st_can_manage_event(p_event_id) then
    raise exception 'Você não gerencia esta corrida';
  end if;
  if p_distance_id is not null and not exists (select 1 from public.st_event_distances where id = p_distance_id and event_id = p_event_id) then
    raise exception 'Distância não pertence a esta corrida';
  end if;

  select * into v_u from public.st_usuarios where id = p_usuario_id;
  if not found then raise exception 'Pessoa não encontrada no controle de acesso'; end if;
  if not v_u.ativo then raise exception 'Este acesso está desativado'; end if;

  if v_u.user_id is null then
    insert into public.st_inscricoes_pendentes (event_id, usuario_id, distance_id, level, criado_por)
    values (p_event_id, p_usuario_id, p_distance_id, p_level, auth.uid())
    on conflict (event_id, usuario_id) do update set distance_id = excluded.distance_id, level = excluded.level;
    return 'pendente';
  end if;

  insert into public.st_registrations (event_id, user_id, distance_id, level)
  values (p_event_id, v_u.user_id, p_distance_id, p_level)
  on conflict (event_id, user_id) do update set
    distance_id = coalesce(excluded.distance_id, public.st_registrations.distance_id),
    level = excluded.level;
  return 'inscrito';
end;
$fn$;

-- corredor não se inscreve sozinho: quem associa é o gestor da corrida
revoke execute on function public.st_register_for_event(uuid, uuid, public.st_runner_level, int, int, text, text) from public, anon, authenticated;

-- ------------------------------------------------------------------ mural: comentários
create table if not exists public.st_community_comments (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references public.st_community_posts(id) on delete cascade,
  event_id      uuid not null references public.st_events(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  author_name   text,
  author_avatar text,
  body          text not null check (length(trim(body)) between 1 and 1000),
  created_at    timestamptz not null default now()
);
create index if not exists idx_st_comments_post on public.st_community_comments(post_id, created_at);

-- autor e corrida são preenchidos pelo banco (não dá para comentar em nome de outro)
create or replace function public.st_fill_community_comment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  select event_id into new.event_id from public.st_community_posts where id = new.post_id;
  select nullif(full_name, ''), avatar_url into new.author_name, new.author_avatar from public.st_usuarios where user_id = new.user_id;
  return new;
end $$;
drop trigger if exists trg_st_fill_community_comment on public.st_community_comments;
create trigger trg_st_fill_community_comment before insert on public.st_community_comments
  for each row execute function public.st_fill_community_comment();

alter table public.st_community_comments enable row level security;
drop policy if exists "st_community_comments: ler" on public.st_community_comments;
drop policy if exists "st_community_comments: comentar" on public.st_community_comments;
drop policy if exists "st_community_comments: apagar" on public.st_community_comments;
create policy "st_community_comments: ler" on public.st_community_comments for select
  using (public.st_is_registered(event_id) or public.st_can_manage_event(event_id));
create policy "st_community_comments: comentar" on public.st_community_comments for insert
  with check (user_id = auth.uid() and (public.st_is_registered(event_id) or public.st_can_manage_event(event_id)));
create policy "st_community_comments: apagar" on public.st_community_comments for delete
  using (user_id = auth.uid() or public.st_can_manage_event(event_id));
grant select, insert, delete on public.st_community_comments to authenticated;

-- mural: inscritos da corrida leem e publicam; o gestor da corrida modera
drop policy if exists "st_community_posts: ler" on public.st_community_posts;
drop policy if exists "st_community_posts: publicar" on public.st_community_posts;
create policy "st_community_posts: ler" on public.st_community_posts for select
  using (public.st_is_registered(event_id) or public.st_can_manage_event(event_id));
create policy "st_community_posts: publicar" on public.st_community_posts for insert
  with check (user_id = auth.uid() and (public.st_is_registered(event_id) or public.st_can_manage_event(event_id)));
