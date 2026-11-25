-- =====================================================================
-- Administradores, material de patrocinadores e publicações dos corredores
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) ADMINISTRADORES
-- ---------------------------------------------------------------------
-- Existe algum admin? (para o app oferecer "tornar-me administrador" no 1º acesso)
create or replace function public.admin_exists()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where role = 'admin');
$$;

-- O primeiro usuário a reivindicar vira admin. Depois disso, só um admin promove outros.
create or replace function public.claim_first_admin()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.profiles where role = 'admin') then
    raise exception 'Já existe um administrador. Peça para ele liberar seu acesso.';
  end if;
  -- grava direto (a trigger protect_profile_role bloquearia o próprio usuário)
  alter table public.profiles disable trigger trg_protect_role;
  update public.profiles set role = 'admin' where id = auth.uid();
  alter table public.profiles enable trigger trg_protect_role;
  return true;
end $$;

-- Admin define o papel de qualquer usuário (athlete | organizer | admin)
create or replace function public.set_user_role(p_user_id uuid, p_role public.user_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Apenas administradores podem alterar acessos'; end if;
  if p_user_id = auth.uid() and p_role <> 'admin' and
     (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'Você é o único administrador — promova outro antes de remover o seu acesso.';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
end $$;

grant execute on function public.admin_exists() to anon, authenticated;
grant execute on function public.claim_first_admin() to authenticated;
grant execute on function public.set_user_role(uuid, public.user_role) to authenticated;

-- ---------------------------------------------------------------------
-- 2) MATERIAL DOS PATROCINADORES
-- ---------------------------------------------------------------------
alter table public.sponsors add column if not exists material_url text;
alter table public.sponsors add column if not exists material_label text;

-- ---------------------------------------------------------------------
-- 3) PUBLICAÇÕES DOS CORREDORES (mural interno de cada corrida)
-- ---------------------------------------------------------------------
create table if not exists public.community_posts (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  author_name    text,
  author_avatar  text,
  body           text,
  image_url      text,
  workout_id     uuid references public.workouts(id) on delete set null,
  workout_km     numeric(6,2),
  workout_seconds int,
  workout_pace   int,
  created_at     timestamptz not null default now(),
  constraint community_post_not_empty check (coalesce(nullif(trim(body), ''), image_url, workout_id::text) is not null)
);
create index if not exists idx_community_event on public.community_posts(event_id, created_at desc);

create table if not exists public.community_likes (
  post_id    uuid not null references public.community_posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- Preenche autor e dados do treino a partir do banco (o cliente não consegue falsificar)
create or replace function public.fill_community_post()
returns trigger language plpgsql security definer set search_path = public as $$
declare w public.workouts;
begin
  new.user_id := auth.uid();
  select full_name, avatar_url into new.author_name, new.author_avatar from public.profiles where id = new.user_id;
  if new.workout_id is not null then
    select * into w from public.workouts where id = new.workout_id and user_id = new.user_id;
    if found then
      new.workout_km := w.distance_km;
      new.workout_seconds := w.duration_seconds;
      new.workout_pace := w.avg_pace_seconds;
    else
      new.workout_id := null;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_fill_community_post on public.community_posts;
create trigger trg_fill_community_post before insert on public.community_posts
  for each row execute function public.fill_community_post();

alter table public.community_posts enable row level security;
alter table public.community_likes enable row level security;

-- inscritos da corrida (e gestores) leem; inscritos publicam; autor ou gestor apaga
create policy "community: read" on public.community_posts for select
  using (public.is_registered(event_id) or public.can_manage_event(event_id));
create policy "community: insert" on public.community_posts for insert
  with check (public.is_registered(event_id) or public.can_manage_event(event_id));
create policy "community: delete" on public.community_posts for delete
  using (user_id = auth.uid() or public.can_manage_event(event_id));

create policy "likes: read" on public.community_likes for select
  using (exists (select 1 from public.community_posts p where p.id = post_id
                 and (public.is_registered(p.event_id) or public.can_manage_event(p.event_id))));
create policy "likes: own" on public.community_likes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
