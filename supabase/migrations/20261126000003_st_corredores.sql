-- =====================================================================
-- Street Running — ASSOCIAR CORREDORES A UMA CORRIDA (admin)
--
-- O administrador escolhe, dentro da corrida, pessoas do controle de acesso
-- (st_usuarios) e as inscreve. Administradores também podem ser corredores.
--   • quem já fez o 1º acesso vira inscrito na hora (st_registrations)
--   • quem ainda não entrou no app fica "pendente" (st_inscricoes_pendentes)
--     e é inscrito automaticamente no 1º login
-- O mural (st_community_posts) segue restrito: só os inscritos daquela
-- corrida (e os administradores, que moderam) leem e publicam.
--
-- Rode uma vez no SQL Editor, depois do st_schema. Pode rodar de novo.
-- =====================================================================

create table if not exists public.st_inscricoes_pendentes (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.st_events(id) on delete cascade,
  usuario_id   uuid not null references public.st_usuarios(id) on delete cascade,
  distance_id  uuid references public.st_event_distances(id) on delete set null,
  level        public.st_runner_level not null default 'beginner',
  criado_por   uuid references auth.users(id) on delete set null,
  criado_em    timestamptz not null default now(),
  unique (event_id, usuario_id)
);

alter table public.st_inscricoes_pendentes enable row level security;
drop policy if exists "st_inscricoes_pendentes: admin" on public.st_inscricoes_pendentes;
create policy "st_inscricoes_pendentes: admin" on public.st_inscricoes_pendentes
  for all using (public.st_is_admin()) with check (public.st_is_admin());
grant select, insert, update, delete on public.st_inscricoes_pendentes to authenticated;

-- Admin associa uma pessoa do controle de acesso à corrida
create or replace function public.st_associar_corredor(
  p_event_id uuid, p_usuario_id uuid, p_distance_id uuid default null,
  p_level public.st_runner_level default 'beginner'
) returns text
language plpgsql security definer set search_path = public as $fn$
declare
  v_u public.st_usuarios;
begin
  if not public.st_is_admin() then
    raise exception 'Somente administradores associam corredores';
  end if;
  if not exists (select 1 from public.st_events where id = p_event_id) then
    raise exception 'Corrida não encontrada';
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

revoke all on function public.st_associar_corredor(uuid, uuid, uuid, public.st_runner_level) from public, anon;
grant execute on function public.st_associar_corredor(uuid, uuid, uuid, public.st_runner_level) to authenticated;

-- No 1º acesso (user_id ligado), as associações pendentes viram inscrições
create or replace function public.st_efetivar_pendentes()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if new.user_id is not null and old.user_id is null then
    insert into public.st_registrations (event_id, user_id, distance_id, level)
    select p.event_id, new.user_id, p.distance_id, p.level
    from public.st_inscricoes_pendentes p where p.usuario_id = new.id
    on conflict (event_id, user_id) do nothing;
    delete from public.st_inscricoes_pendentes where usuario_id = new.id;
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_st_efetivar_pendentes on public.st_usuarios;
create trigger trg_st_efetivar_pendentes after update of user_id on public.st_usuarios
  for each row execute function public.st_efetivar_pendentes();

-- Mural da corrida: leitura/publicação só por inscritos daquela corrida (ou admin)
drop policy if exists "st_community_posts: ler" on public.st_community_posts;
create policy "st_community_posts: ler" on public.st_community_posts
  for select using (public.st_is_registered(event_id) or public.st_is_admin());
drop policy if exists "st_community_posts: publicar" on public.st_community_posts;
create policy "st_community_posts: publicar" on public.st_community_posts
  for insert with check (user_id = auth.uid() and public.st_is_registered(event_id));
