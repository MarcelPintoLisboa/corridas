-- =====================================================================
-- RUN APP — Plataforma para organizadores de corridas
-- Schema completo: perfis, eventos, inscrições, kits, treinos, dicas,
-- patrocinadores, publicações, leads (CRM) e métricas.
-- Execute no SQL Editor do Supabase (projeto de testes).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('athlete', 'organizer', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.event_status as enum ('draft', 'published', 'finished', 'canceled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.runner_level as enum ('beginner', 'intermediate', 'advanced');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.session_type as enum ('easy', 'long', 'tempo', 'interval', 'fartlek', 'recovery', 'strength', 'rest', 'race');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tip_category as enum ('training', 'nutrition', 'hydration', 'recovery', 'mindset', 'race_day');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.sponsor_tier as enum ('master', 'gold', 'silver', 'support');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.post_type as enum ('news', 'alert', 'promo', 'schedule');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_status as enum ('new', 'contacted', 'qualified', 'converted', 'lost');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_source as enum ('app', 'instagram', 'sponsor', 'landing', 'referral', 'event', 'import');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- HELPER: updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- PROFILES (1:1 com auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  email         text,
  phone         text,
  avatar_url    text,
  birth_date    date,
  gender        text,
  city          text,
  instagram     text,
  role          public.user_role not null default 'athlete',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cria o perfil automaticamente no signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- EVENTS (cada corrida, customizável pelo organizador)
-- ---------------------------------------------------------------------
create table if not exists public.events (
  id                  uuid primary key default gen_random_uuid(),
  organizer_id        uuid references public.profiles(id) on delete set null,
  name                text not null,
  slug                text unique,
  tagline             text,
  description         text,
  cover_image_url     text,
  logo_url            text,
  primary_color       text not null default '#FF4D2E',
  secondary_color     text not null default '#7B2FF7',
  event_date          timestamptz not null,
  location_name       text,
  address             text,
  city                text,
  state               text,
  latitude            double precision,
  longitude           double precision,
  hashtag             text,
  instagram_handle    text,
  website_url         text,
  registration_url    text,
  regulation_url      text,
  route_map_url       text,
  require_order_code  boolean not null default false,
  status              public.event_status not null default 'draft',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_events_date on public.events(event_date);
create trigger trg_events_updated before update on public.events
  for each row execute function public.set_updated_at();

-- Equipe com acesso administrativo a um evento específico
create table if not exists public.event_staff (
  event_id    uuid not null references public.events(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        text not null default 'editor', -- owner | editor | viewer
  created_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- Distâncias/percursos (5K, 10K, 21K...)
create table if not exists public.event_distances (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.events(id) on delete cascade,
  label            text not null,
  distance_km      numeric(6,2) not null,
  start_time       timestamptz,
  max_participants int,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists idx_distances_event on public.event_distances(event_id);

-- ---------------------------------------------------------------------
-- KITS: compras importadas, locais/horários de retirada
-- ---------------------------------------------------------------------
create table if not exists public.kit_purchases (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  order_code    text not null,
  buyer_name    text,
  buyer_email   text,
  buyer_document text,
  distance_id   uuid references public.event_distances(id) on delete set null,
  shirt_size    text,
  kit_type      text default 'standard',
  claimed_by    uuid references public.profiles(id) on delete set null,
  claimed_at    timestamptz,
  created_at    timestamptz not null default now(),
  unique (event_id, order_code)
);

create table if not exists public.kit_pickups (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events(id) on delete cascade,
  location_name  text not null,
  address        text,
  maps_url       text,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  required_docs  text,
  notes          text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_pickups_event on public.kit_pickups(event_id);

-- ---------------------------------------------------------------------
-- REGISTRATIONS (participante vinculado à corrida)
-- ---------------------------------------------------------------------
create table if not exists public.registrations (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references public.events(id) on delete cascade,
  user_id            uuid not null references public.profiles(id) on delete cascade,
  distance_id        uuid references public.event_distances(id) on delete set null,
  kit_purchase_id    uuid references public.kit_purchases(id) on delete set null,
  bib_number         text,
  shirt_size         text,
  level              public.runner_level not null default 'beginner',
  goal_time_seconds  int,
  weekly_runs        int default 3,
  kit_picked_up      boolean not null default false,
  kit_picked_up_at   timestamptz,
  official_time_seconds int,
  created_at         timestamptz not null default now(),
  unique (event_id, user_id)
);
create index if not exists idx_reg_user on public.registrations(user_id);
-- trigger criada após a função protect_registration_fields (ver abaixo)

-- ---------------------------------------------------------------------
-- TRAINING PLANS (planos dos treinadores por distância/nível)
-- ---------------------------------------------------------------------
create table if not exists public.training_plans (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  distance_id   uuid references public.event_distances(id) on delete cascade,
  level         public.runner_level not null default 'beginner',
  name          text not null,
  description   text,
  coach_name    text,
  coach_avatar_url text,
  weeks         int not null default 8,
  created_at    timestamptz not null default now()
);
create index if not exists idx_plans_event on public.training_plans(event_id);

create table if not exists public.training_sessions (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references public.training_plans(id) on delete cascade,
  week            int not null,            -- 1..weeks (última semana = semana da prova)
  day_of_week     int not null,            -- 1=seg .. 7=dom
  title           text not null,
  type            public.session_type not null default 'easy',
  distance_km     numeric(6,2),
  duration_min    int,
  target_pace     text,                    -- ex: "6:00-6:30 /km"
  description     text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_sessions_plan on public.training_sessions(plan_id, week, day_of_week);

-- ---------------------------------------------------------------------
-- USER WORKOUTS (treinos realizados / resultados até a prova)
-- ---------------------------------------------------------------------
create table if not exists public.workouts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  event_id           uuid references public.events(id) on delete set null,
  session_id         uuid references public.training_sessions(id) on delete set null,
  performed_at       timestamptz not null default now(),
  title              text,
  distance_km        numeric(6,2) not null,
  duration_seconds   int not null,
  avg_pace_seconds   int generated always as (
                       case when distance_km > 0 then round(duration_seconds / distance_km)::int else null end
                     ) stored,
  elevation_m        int,
  avg_hr             int,
  feeling            int check (feeling between 1 and 5),
  photo_url          text,
  notes              text,
  is_race            boolean not null default false,
  shared_instagram   boolean not null default false,
  created_at         timestamptz not null default now()
);
create index if not exists idx_workouts_user on public.workouts(user_id, performed_at desc);

-- ---------------------------------------------------------------------
-- TIPS (treinadores / nutrição / hidratação ...)
-- ---------------------------------------------------------------------
create table if not exists public.tips (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.events(id) on delete cascade,
  category          public.tip_category not null default 'training',
  title             text not null,
  body              text not null,
  author_name       text,
  author_role       text,
  image_url         text,
  days_before_race  int,                -- exibe a partir de X dias antes (null = sempre)
  published         boolean not null default true,
  created_at        timestamptz not null default now()
);
create index if not exists idx_tips_event on public.tips(event_id);

-- ---------------------------------------------------------------------
-- SPONSORS (publicidade) + métricas de impressão/clique
-- ---------------------------------------------------------------------
create table if not exists public.sponsors (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  name          text not null,
  tier          public.sponsor_tier not null default 'support',
  logo_url      text,
  banner_url    text,
  description   text,
  offer_title   text,
  coupon_code   text,
  website_url   text,
  instagram     text,
  sort_order    int not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists idx_sponsors_event on public.sponsors(event_id);

create table if not exists public.sponsor_interactions (
  id          uuid primary key default gen_random_uuid(),
  sponsor_id  uuid not null references public.sponsors(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete set null,
  kind        text not null check (kind in ('impression', 'click', 'coupon_copy')),
  created_at  timestamptz not null default now()
);
create index if not exists idx_sponsor_int on public.sponsor_interactions(sponsor_id, kind);

-- ---------------------------------------------------------------------
-- POSTS (publicações do admin para a corrida)
-- ---------------------------------------------------------------------
create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  type          public.post_type not null default 'news',
  title         text not null,
  body          text,
  image_url     text,
  cta_label     text,
  cta_url       text,
  pinned        boolean not null default false,
  published     boolean not null default true,
  published_at  timestamptz not null default now(),
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_posts_event on public.posts(event_id, published_at desc);

-- ---------------------------------------------------------------------
-- LEADS (CRM / tratamento de leads)
-- ---------------------------------------------------------------------
create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid references public.events(id) on delete cascade,
  user_id       uuid references public.profiles(id) on delete set null,
  name          text not null,
  email         text,
  phone         text,
  city          text,
  source        public.lead_source not null default 'app',
  status        public.lead_status not null default 'new',
  interest      text,                         -- ex: "21K", "kit premium"
  score         int not null default 0,
  consent_marketing boolean not null default false,
  tags          text[] not null default '{}',
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists uq_leads_event_email on public.leads(event_id, lower(email)) where email is not null;
create index if not exists idx_leads_event_status on public.leads(event_id, status);
create trigger trg_leads_updated before update on public.leads
  for each row execute function public.set_updated_at();

create table if not exists public.lead_interactions (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  type        text not null check (type in ('note', 'email', 'whatsapp', 'call', 'status_change')),
  content     text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_lead_int on public.lead_interactions(lead_id, created_at desc);

-- =====================================================================
-- ACCESS HELPERS
-- =====================================================================
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.can_manage_event(p_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from public.events e where e.id = p_event_id and e.organizer_id = auth.uid())
      or exists (select 1 from public.event_staff s where s.event_id = p_event_id and s.user_id = auth.uid() and s.role in ('owner','editor'));
$$;

create or replace function public.is_registered(p_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.registrations r where r.event_id = p_event_id and r.user_id = auth.uid());
$$;

create or replace function public.is_organizer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('organizer','admin'));
$$;

-- Impede que o usuário eleve o próprio papel
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() nulo = SQL Editor / service role: permitido
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end $$;
drop trigger if exists trg_protect_role on public.profiles;
create trigger trg_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- Participante não altera nº de peito, retirada de kit nem tempo oficial
create or replace function public.protect_registration_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.can_manage_event(new.event_id) then
    new.bib_number := old.bib_number;
    new.kit_picked_up := old.kit_picked_up;
    new.kit_picked_up_at := old.kit_picked_up_at;
    new.official_time_seconds := old.official_time_seconds;
  end if;
  return new;
end $$;
drop trigger if exists trg_protect_registration on public.registrations;
create trigger trg_protect_registration before update on public.registrations
  for each row execute function public.protect_registration_fields();

-- =====================================================================
-- RPC: inscrição do participante na corrida
-- =====================================================================
create or replace function public.register_for_event(
  p_event_id uuid,
  p_distance_id uuid,
  p_level public.runner_level default 'beginner',
  p_goal_time_seconds int default null,
  p_weekly_runs int default 3,
  p_shirt_size text default null,
  p_order_code text default null
) returns public.registrations
language plpgsql security definer set search_path = public as $$
declare
  v_event public.events;
  v_kit public.kit_purchases;
  v_reg public.registrations;
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_event from public.events where id = p_event_id and status = 'published';
  if not found then
    raise exception 'Evento não encontrado ou não publicado';
  end if;

  if v_event.require_order_code or p_order_code is not null then
    select * into v_kit from public.kit_purchases
      where event_id = p_event_id and upper(order_code) = upper(trim(p_order_code));
    if not found then
      raise exception 'Código do pedido/kit inválido';
    end if;
    if v_kit.claimed_by is not null and v_kit.claimed_by <> auth.uid() then
      raise exception 'Este kit já foi vinculado a outro participante';
    end if;
    update public.kit_purchases set claimed_by = auth.uid(), claimed_at = now() where id = v_kit.id;
  end if;

  insert into public.registrations (event_id, user_id, distance_id, kit_purchase_id, shirt_size, level, goal_time_seconds, weekly_runs)
  values (
    p_event_id, auth.uid(),
    coalesce(v_kit.distance_id, p_distance_id),
    v_kit.id,
    coalesce(v_kit.shirt_size, p_shirt_size),
    p_level, p_goal_time_seconds, p_weekly_runs
  )
  on conflict (event_id, user_id) do update set
    distance_id = excluded.distance_id,
    level = excluded.level,
    goal_time_seconds = excluded.goal_time_seconds,
    weekly_runs = excluded.weekly_runs,
    shirt_size = coalesce(excluded.shirt_size, public.registrations.shirt_size),
    kit_purchase_id = coalesce(excluded.kit_purchase_id, public.registrations.kit_purchase_id)
  returning * into v_reg;

  -- Converte/gera o lead do participante
  select * into v_profile from public.profiles where id = auth.uid();
  insert into public.leads (event_id, user_id, name, email, phone, city, source, status, interest, score, consent_marketing)
  values (p_event_id, auth.uid(), coalesce(v_profile.full_name, v_profile.email), v_profile.email, v_profile.phone, v_profile.city,
          'app', 'converted', (select label from public.event_distances where id = v_reg.distance_id), 100, true)
  on conflict (event_id, lower(email)) where email is not null
  do update set status = 'converted', user_id = excluded.user_id, score = 100, interest = excluded.interest;

  return v_reg;
end $$;

-- RPC: captura de lead (pessoa interessada, ainda sem inscrição)
create or replace function public.capture_lead(
  p_event_id uuid,
  p_name text,
  p_email text,
  p_phone text default null,
  p_interest text default null,
  p_source public.lead_source default 'app',
  p_consent boolean default true
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.leads (event_id, user_id, name, email, phone, interest, source, consent_marketing, score)
  values (p_event_id, auth.uid(), p_name, lower(trim(p_email)), p_phone, p_interest, p_source, p_consent, 30)
  on conflict (event_id, lower(email)) where email is not null
  do update set score = least(public.leads.score + 10, 99),
                phone = coalesce(excluded.phone, public.leads.phone),
                interest = coalesce(excluded.interest, public.leads.interest)
  returning id into v_id;
  return v_id;
end $$;

-- Métricas do dashboard do organizador
create or replace function public.event_metrics(p_event_id uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare result json;
begin
  if not public.can_manage_event(p_event_id) then
    raise exception 'Sem permissão';
  end if;
  select json_build_object(
    'registrations',      (select count(*) from public.registrations where event_id = p_event_id),
    'kits_picked_up',     (select count(*) from public.registrations where event_id = p_event_id and kit_picked_up),
    'leads_total',        (select count(*) from public.leads where event_id = p_event_id),
    'leads_new',          (select count(*) from public.leads where event_id = p_event_id and status = 'new'),
    'leads_converted',    (select count(*) from public.leads where event_id = p_event_id and status = 'converted'),
    'workouts',           (select count(*) from public.workouts where event_id = p_event_id),
    'km_total',           (select coalesce(sum(distance_km),0) from public.workouts where event_id = p_event_id),
    'instagram_shares',   (select count(*) from public.workouts where event_id = p_event_id and shared_instagram),
    'sponsor_impressions',(select count(*) from public.sponsor_interactions si join public.sponsors s on s.id = si.sponsor_id where s.event_id = p_event_id and si.kind = 'impression'),
    'sponsor_clicks',     (select count(*) from public.sponsor_interactions si join public.sponsors s on s.id = si.sponsor_id where s.event_id = p_event_id and si.kind in ('click','coupon_copy')),
    'by_distance',        (select coalesce(json_agg(x), '[]'::json) from (
                             select d.label, count(r.id) as total
                             from public.event_distances d left join public.registrations r on r.distance_id = d.id
                             where d.event_id = p_event_id group by d.label, d.sort_order order by d.sort_order) x)
  ) into result;
  return result;
end $$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles             enable row level security;
alter table public.events               enable row level security;
alter table public.event_staff          enable row level security;
alter table public.event_distances      enable row level security;
alter table public.kit_purchases        enable row level security;
alter table public.kit_pickups          enable row level security;
alter table public.registrations        enable row level security;
alter table public.training_plans       enable row level security;
alter table public.training_sessions    enable row level security;
alter table public.workouts             enable row level security;
alter table public.tips                 enable row level security;
alter table public.sponsors             enable row level security;
alter table public.sponsor_interactions enable row level security;
alter table public.posts                enable row level security;
alter table public.leads                enable row level security;
alter table public.lead_interactions    enable row level security;

-- PROFILES
create policy "profiles: self read" on public.profiles for select
  using (id = auth.uid() or public.is_organizer());
create policy "profiles: self update" on public.profiles for update
  using (id = auth.uid() or public.is_admin());

-- EVENTS: público vê publicados; gestores veem e editam os seus
create policy "events: read" on public.events for select
  using (status in ('published','finished') or public.can_manage_event(id));
create policy "events: insert" on public.events for insert
  with check (public.is_organizer());
create policy "events: update" on public.events for update
  using (public.can_manage_event(id));
create policy "events: delete" on public.events for delete
  using (public.is_admin() or organizer_id = auth.uid());

-- EVENT STAFF
create policy "staff: read" on public.event_staff for select
  using (user_id = auth.uid() or public.can_manage_event(event_id));
create policy "staff: manage" on public.event_staff for all
  using (public.can_manage_event(event_id)) with check (public.can_manage_event(event_id));

-- Conteúdo público do evento (leitura livre; escrita por gestores)
create policy "distances: read" on public.event_distances for select using (true);
create policy "distances: manage" on public.event_distances for all
  using (public.can_manage_event(event_id)) with check (public.can_manage_event(event_id));

create policy "pickups: read" on public.kit_pickups for select using (true);
create policy "pickups: manage" on public.kit_pickups for all
  using (public.can_manage_event(event_id)) with check (public.can_manage_event(event_id));

create policy "sponsors: read" on public.sponsors for select using (active or public.can_manage_event(event_id));
create policy "sponsors: manage" on public.sponsors for all
  using (public.can_manage_event(event_id)) with check (public.can_manage_event(event_id));

create policy "posts: read" on public.posts for select
  using ((published and published_at <= now()) or public.can_manage_event(event_id));
create policy "posts: manage" on public.posts for all
  using (public.can_manage_event(event_id)) with check (public.can_manage_event(event_id));

-- Treinos e dicas: só inscritos (ou gestores)
create policy "plans: read" on public.training_plans for select
  using (public.is_registered(event_id) or public.can_manage_event(event_id));
create policy "plans: manage" on public.training_plans for all
  using (public.can_manage_event(event_id)) with check (public.can_manage_event(event_id));

create policy "sessions: read" on public.training_sessions for select
  using (exists (select 1 from public.training_plans p where p.id = plan_id
                 and (public.is_registered(p.event_id) or public.can_manage_event(p.event_id))));
create policy "sessions: manage" on public.training_sessions for all
  using (exists (select 1 from public.training_plans p where p.id = plan_id and public.can_manage_event(p.event_id)))
  with check (exists (select 1 from public.training_plans p where p.id = plan_id and public.can_manage_event(p.event_id)));

create policy "tips: read" on public.tips for select
  using ((published and public.is_registered(event_id)) or public.can_manage_event(event_id));
create policy "tips: manage" on public.tips for all
  using (public.can_manage_event(event_id)) with check (public.can_manage_event(event_id));

-- KIT PURCHASES: só gestores (participante vincula via RPC)
create policy "kit_purchases: read" on public.kit_purchases for select
  using (claimed_by = auth.uid() or public.can_manage_event(event_id));
create policy "kit_purchases: manage" on public.kit_purchases for all
  using (public.can_manage_event(event_id)) with check (public.can_manage_event(event_id));

-- REGISTRATIONS
create policy "registrations: read" on public.registrations for select
  using (user_id = auth.uid() or public.can_manage_event(event_id));
create policy "registrations: self update" on public.registrations for update
  using (user_id = auth.uid() or public.can_manage_event(event_id));
create policy "registrations: manage delete" on public.registrations for delete
  using (user_id = auth.uid() or public.can_manage_event(event_id));

-- WORKOUTS: dono; gestores do evento leem
create policy "workouts: owner all" on public.workouts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "workouts: manager read" on public.workouts for select
  using (event_id is not null and public.can_manage_event(event_id));

-- SPONSOR INTERACTIONS: qualquer autenticado registra; gestores leem
create policy "sponsor_int: insert" on public.sponsor_interactions for insert
  with check (auth.uid() is not null);
create policy "sponsor_int: read" on public.sponsor_interactions for select
  using (exists (select 1 from public.sponsors s where s.id = sponsor_id and public.can_manage_event(s.event_id)));

-- LEADS: só gestores (captura via RPC)
create policy "leads: manage" on public.leads for all
  using (public.can_manage_event(event_id)) with check (public.can_manage_event(event_id));
create policy "lead_int: manage" on public.lead_interactions for all
  using (exists (select 1 from public.leads l where l.id = lead_id and public.can_manage_event(l.event_id)))
  with check (exists (select 1 from public.leads l where l.id = lead_id and public.can_manage_event(l.event_id)));

-- =====================================================================
-- GRANTS para RPCs
-- =====================================================================
grant execute on function public.register_for_event(uuid, uuid, public.runner_level, int, int, text, text) to authenticated;
grant execute on function public.capture_lead(uuid, text, text, text, text, public.lead_source, boolean) to anon, authenticated;
grant execute on function public.event_metrics(uuid) to authenticated;

-- =====================================================================
-- STORAGE: bucket público para imagens (capas, logos, fotos de treino)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "media: public read" on storage.objects for select
  using (bucket_id = 'media');
create policy "media: auth upload" on storage.objects for insert
  with check (bucket_id = 'media' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media: owner update" on storage.objects for update
  using (bucket_id = 'media' and owner = auth.uid());
create policy "media: owner delete" on storage.objects for delete
  using (bucket_id = 'media' and owner = auth.uid());
