-- =====================================================================================
-- STREET RUNNING — schema completo (todas as tabelas, funções e tipos com prefixo st_)
-- Como aplicar: Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Pode rodar mais de uma vez. Depois rode supabase/st_seed.sql (dados de teste).
--
-- Controle de acesso (mesmo modelo do assistencia_usuarios):
--  * st_usuarios: um registro por pessoa que usa o app (e-mail, nome, papel, ativo).
--  * Administrador geral fixo: mapl11@hotmail.com (sempre admin).
--  * O admin pode cadastrar um acesso pelo e-mail ANTES de a pessoa criar a conta;
--    quando ela entra no app, st_minha_conta() liga o registro ao login.
--  * Corredores podem criar conta sozinhos (entram como papel 'athlete').
--  * ativo = false => a pessoa não acessa nada.
--  * Papéis: athlete (corredor: só a área do corredor) | admin (organiza as corridas e gerencia tudo).
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- 0) LIMPEZA da versão anterior (tabelas sem prefixo criadas pelo app, se existirem)
--    Não toca em nada do assistencia-ml.
-- -------------------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;

drop table if exists public.community_likes, public.community_posts, public.lead_interactions, public.leads,
  public.posts, public.sponsor_interactions, public.sponsors, public.tips, public.workouts,
  public.training_sessions, public.training_plans, public.registrations, public.kit_pickups,
  public.kit_purchases, public.event_distances, public.event_staff, public.events, public.profiles cascade;

drop function if exists public.set_updated_at() cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.can_manage_event(uuid) cascade;
drop function if exists public.is_registered(uuid) cascade;
drop function if exists public.is_organizer() cascade;
drop function if exists public.protect_profile_role() cascade;
drop function if exists public.protect_registration_fields() cascade;
drop function if exists public.register_for_event(uuid, uuid, public.runner_level, int, int, text, text) cascade;
drop function if exists public.capture_lead(uuid, text, text, text, text, public.lead_source, boolean) cascade;
drop function if exists public.event_metrics(uuid) cascade;
drop function if exists public.generate_training_plans(uuid, int, text, boolean) cascade;
drop function if exists public.admin_exists() cascade;
drop function if exists public.claim_first_admin() cascade;
drop function if exists public.set_user_role(uuid, public.user_role) cascade;
drop function if exists public.fill_community_post() cascade;

drop type if exists public.user_role, public.event_status, public.runner_level, public.session_type,
  public.tip_category, public.sponsor_tier, public.post_type, public.lead_status, public.lead_source cascade;

drop policy if exists "media: public read" on storage.objects;
drop policy if exists "media: auth upload" on storage.objects;
drop policy if exists "media: owner update" on storage.objects;
drop policy if exists "media: owner delete" on storage.objects;

-- -------------------------------------------------------------------------------------
-- 1) TIPOS
-- -------------------------------------------------------------------------------------
do $$ begin create type public.st_papel as enum ('athlete', 'admin'); exception when duplicate_object then null; end $$;
do $$ begin create type public.st_event_status as enum ('draft', 'published', 'finished', 'canceled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.st_runner_level as enum ('beginner', 'intermediate', 'advanced'); exception when duplicate_object then null; end $$;
do $$ begin create type public.st_session_type as enum ('easy', 'long', 'tempo', 'interval', 'fartlek', 'recovery', 'strength', 'rest', 'race'); exception when duplicate_object then null; end $$;
do $$ begin create type public.st_tip_category as enum ('training', 'nutrition', 'hydration', 'recovery', 'mindset', 'race_day'); exception when duplicate_object then null; end $$;
do $$ begin create type public.st_sponsor_tier as enum ('master', 'gold', 'silver', 'support'); exception when duplicate_object then null; end $$;
do $$ begin create type public.st_post_type as enum ('news', 'alert', 'promo', 'schedule'); exception when duplicate_object then null; end $$;
do $$ begin create type public.st_lead_status as enum ('new', 'contacted', 'qualified', 'converted', 'lost'); exception when duplicate_object then null; end $$;
do $$ begin create type public.st_lead_source as enum ('app', 'instagram', 'sponsor', 'landing', 'referral', 'event', 'import'); exception when duplicate_object then null; end $$;

create or replace function public.st_set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- -------------------------------------------------------------------------------------
-- 2) ST_USUARIOS — controle de acesso
-- -------------------------------------------------------------------------------------
create table if not exists public.st_usuarios (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users(id) on delete set null,   -- preenchido no 1º login
  email       text not null unique check (email = lower(email)),
  full_name   text not null default '',
  role        public.st_papel not null default 'athlete',
  ativo       boolean not null default true,
  phone       text,
  avatar_url  text,
  birth_date  date,
  gender      text,
  city        text,
  instagram   text,
  criado_por  uuid references auth.users(id) on delete set null,
  criado_em   timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.st_usuarios is 'Controle de acesso do Street Running: quem pode entrar e com qual papel';
comment on column public.st_usuarios.role is 'athlete = corredor | admin = administrador (organiza as corridas e gerencia tudo)';
comment on column public.st_usuarios.ativo is 'false = acesso bloqueado';
drop trigger if exists trg_st_usuarios_updated on public.st_usuarios;
create trigger trg_st_usuarios_updated before update on public.st_usuarios for each row execute function public.st_set_updated_at();

-- Administrador geral (se a conta já existir no auth)
insert into public.st_usuarios (user_id, email, full_name, role)
select u.id, lower(u.email), coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'nome', 'Marcel Lisboa'), 'admin'
from auth.users u where lower(u.email) = 'mapl11@hotmail.com'
on conflict (email) do update set role = 'admin', ativo = true, user_id = coalesce(public.st_usuarios.user_id, excluded.user_id);

-- -------------------------------------------------------------------------------------
-- 3) FUNÇÕES DE ACESSO
-- -------------------------------------------------------------------------------------
create or replace function public.st_email()
returns text language sql stable set search_path = public as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.st_is_admin_geral()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from auth.users u where u.id = auth.uid() and lower(u.email) = 'mapl11@hotmail.com')
$$;

create or replace function public.st_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.st_is_admin_geral()
      or exists (select 1 from public.st_usuarios where user_id = auth.uid() and role = 'admin' and ativo)
$$;


-- Acesso ativo (registro existente e ativo)
create or replace function public.st_is_active()
returns boolean language sql stable security definer set search_path = public as $$
  select public.st_is_admin_geral()
      or exists (select 1 from public.st_usuarios where user_id = auth.uid() and ativo)
$$;

-- Chamado pelo app ao entrar: liga o cadastro feito pelo admin ao login (ou cria o de corredor)
-- e devolve a conta. situacao: ok | desativado
create or replace function public.st_minha_conta(p_full_name text default null, p_phone text default null)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  r public.st_usuarios;
  v_email text := public.st_email();
begin
  if auth.uid() is null then return null; end if;

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
    -- novo corredor (cadastro pelo próprio app)
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

-- Usuário comum não altera o próprio papel/ativo/e-mail
create or replace function public.st_protect_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.st_is_admin() then
    new.role := old.role;
    new.ativo := old.ativo;
    new.email := old.email;
    -- única mudança permitida em user_id: ligar um cadastro sem login ao próprio login (mesmo e-mail)
    if not (old.user_id is null and new.user_id = auth.uid() and old.email = public.st_email()) then
      new.user_id := old.user_id;
    end if;
  end if;
  -- o administrador geral nunca perde o acesso
  if new.email = 'mapl11@hotmail.com' then
    new.role := 'admin';
    new.ativo := true;
  end if;
  new.email := lower(new.email);
  return new;
end $$;
drop trigger if exists trg_st_protect_usuario on public.st_usuarios;
create trigger trg_st_protect_usuario before update on public.st_usuarios for each row execute function public.st_protect_usuario();

-- -------------------------------------------------------------------------------------
-- 4) CORRIDAS
-- -------------------------------------------------------------------------------------
create table if not exists public.st_events (
  id                  uuid primary key default gen_random_uuid(),
  organizer_id        uuid references auth.users(id) on delete set null,
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
  status              public.st_event_status not null default 'draft',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_st_events_date on public.st_events(event_date);
drop trigger if exists trg_st_events_updated on public.st_events;
create trigger trg_st_events_updated before update on public.st_events for each row execute function public.st_set_updated_at();

drop table if exists public.st_event_staff cascade;

create table if not exists public.st_event_distances (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.st_events(id) on delete cascade,
  label            text not null,
  distance_km      numeric(6,2) not null,
  start_time       timestamptz,
  max_participants int,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists idx_st_distances_event on public.st_event_distances(event_id);

create table if not exists public.st_kit_purchases (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.st_events(id) on delete cascade,
  order_code     text not null,
  buyer_name     text,
  buyer_email    text,
  buyer_document text,
  distance_id    uuid references public.st_event_distances(id) on delete set null,
  shirt_size     text,
  kit_type       text default 'standard',
  claimed_by     uuid references auth.users(id) on delete set null,
  claimed_at     timestamptz,
  created_at     timestamptz not null default now(),
  unique (event_id, order_code)
);

create table if not exists public.st_kit_pickups (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.st_events(id) on delete cascade,
  location_name  text not null,
  address        text,
  maps_url       text,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  required_docs  text,
  notes          text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_st_pickups_event on public.st_kit_pickups(event_id);

create table if not exists public.st_registrations (
  id                    uuid primary key default gen_random_uuid(),
  event_id              uuid not null references public.st_events(id) on delete cascade,
  user_id               uuid not null references auth.users(id) on delete cascade,
  distance_id           uuid references public.st_event_distances(id) on delete set null,
  kit_purchase_id       uuid references public.st_kit_purchases(id) on delete set null,
  bib_number            text,
  shirt_size            text,
  level                 public.st_runner_level not null default 'beginner',
  goal_time_seconds     int,
  weekly_runs           int default 3,
  kit_picked_up         boolean not null default false,
  kit_picked_up_at      timestamptz,
  official_time_seconds int,
  created_at            timestamptz not null default now(),
  unique (event_id, user_id)
);
create index if not exists idx_st_reg_user on public.st_registrations(user_id);

create table if not exists public.st_training_plans (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.st_events(id) on delete cascade,
  distance_id      uuid references public.st_event_distances(id) on delete cascade,
  level            public.st_runner_level not null default 'beginner',
  name             text not null,
  description      text,
  coach_name       text,
  coach_avatar_url text,
  weeks            int not null default 8,
  created_at       timestamptz not null default now()
);
create index if not exists idx_st_plans_event on public.st_training_plans(event_id);

create table if not exists public.st_training_sessions (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references public.st_training_plans(id) on delete cascade,
  week          int not null,
  day_of_week   int not null,
  title         text not null,
  type          public.st_session_type not null default 'easy',
  distance_km   numeric(6,2),
  duration_min  int,
  target_pace   text,
  description   text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_st_sessions_plan on public.st_training_sessions(plan_id, week, day_of_week);

create table if not exists public.st_workouts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  event_id          uuid references public.st_events(id) on delete set null,
  session_id        uuid references public.st_training_sessions(id) on delete set null,
  performed_at      timestamptz not null default now(),
  title             text,
  distance_km       numeric(6,2) not null,
  duration_seconds  int not null,
  avg_pace_seconds  int generated always as (case when distance_km > 0 then round(duration_seconds / distance_km)::int else null end) stored,
  elevation_m       int,
  avg_hr            int,
  feeling           int check (feeling between 1 and 5),
  photo_url         text,
  notes             text,
  is_race           boolean not null default false,
  shared_instagram  boolean not null default false,
  created_at        timestamptz not null default now()
);
create index if not exists idx_st_workouts_user on public.st_workouts(user_id, performed_at desc);

create table if not exists public.st_tips (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.st_events(id) on delete cascade,
  category          public.st_tip_category not null default 'training',
  title             text not null,
  body              text not null,
  author_name       text,
  author_role       text,
  image_url         text,
  days_before_race  int,
  published         boolean not null default true,
  created_at        timestamptz not null default now()
);
create index if not exists idx_st_tips_event on public.st_tips(event_id);

create table if not exists public.st_sponsors (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.st_events(id) on delete cascade,
  name            text not null,
  tier            public.st_sponsor_tier not null default 'support',
  logo_url        text,
  banner_url      text,
  description     text,
  offer_title     text,
  coupon_code     text,
  website_url     text,
  instagram       text,
  material_url    text,
  material_label  text,
  sort_order      int not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
create index if not exists idx_st_sponsors_event on public.st_sponsors(event_id);

create table if not exists public.st_sponsor_interactions (
  id          uuid primary key default gen_random_uuid(),
  sponsor_id  uuid not null references public.st_sponsors(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  kind        text not null check (kind in ('impression', 'click', 'coupon_copy')),
  created_at  timestamptz not null default now()
);
create index if not exists idx_st_sponsor_int on public.st_sponsor_interactions(sponsor_id, kind);

create table if not exists public.st_posts (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.st_events(id) on delete cascade,
  type          public.st_post_type not null default 'news',
  title         text not null,
  body          text,
  image_url     text,
  cta_label     text,
  cta_url       text,
  pinned        boolean not null default false,
  published     boolean not null default true,
  published_at  timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_st_posts_event on public.st_posts(event_id, published_at desc);

create table if not exists public.st_leads (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid references public.st_events(id) on delete cascade,
  user_id           uuid references auth.users(id) on delete set null,
  name              text not null,
  email             text,
  phone             text,
  city              text,
  source            public.st_lead_source not null default 'app',
  status            public.st_lead_status not null default 'new',
  interest          text,
  score             int not null default 0,
  consent_marketing boolean not null default false,
  tags              text[] not null default '{}',
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index if not exists uq_st_leads_event_email on public.st_leads(event_id, lower(email)) where email is not null;
create index if not exists idx_st_leads_event_status on public.st_leads(event_id, status);
drop trigger if exists trg_st_leads_updated on public.st_leads;
create trigger trg_st_leads_updated before update on public.st_leads for each row execute function public.st_set_updated_at();

create table if not exists public.st_lead_interactions (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.st_leads(id) on delete cascade,
  type        text not null check (type in ('note', 'email', 'whatsapp', 'call', 'status_change')),
  content     text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_st_lead_int on public.st_lead_interactions(lead_id, created_at desc);

create table if not exists public.st_community_posts (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.st_events(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  author_name     text,
  author_avatar   text,
  body            text,
  image_url       text,
  workout_id      uuid references public.st_workouts(id) on delete set null,
  workout_km      numeric(6,2),
  workout_seconds int,
  workout_pace    int,
  created_at      timestamptz not null default now(),
  constraint st_community_post_not_empty check (coalesce(nullif(trim(body), ''), image_url, workout_id::text) is not null)
);
create index if not exists idx_st_community_event on public.st_community_posts(event_id, created_at desc);

create table if not exists public.st_community_likes (
  post_id    uuid not null references public.st_community_posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- -------------------------------------------------------------------------------------
-- 5) FUNÇÕES DE NEGÓCIO
-- -------------------------------------------------------------------------------------
-- Quem organiza as corridas é o administrador
create or replace function public.st_can_manage_event(p_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.st_is_admin();
$$;

create or replace function public.st_is_registered(p_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.st_is_active()
     and exists (select 1 from public.st_registrations r where r.event_id = p_event_id and r.user_id = auth.uid());
$$;

-- Participante não altera nº de peito, retirada de kit nem tempo oficial
create or replace function public.st_protect_registration()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.st_can_manage_event(new.event_id) then
    new.bib_number := old.bib_number;
    new.kit_picked_up := old.kit_picked_up;
    new.kit_picked_up_at := old.kit_picked_up_at;
    new.official_time_seconds := old.official_time_seconds;
  end if;
  return new;
end $$;
drop trigger if exists trg_st_protect_registration on public.st_registrations;
create trigger trg_st_protect_registration before update on public.st_registrations for each row execute function public.st_protect_registration();

-- Inscrição do corredor na corrida (valida o código do kit quando exigido)
create or replace function public.st_register_for_event(
  p_event_id uuid, p_distance_id uuid,
  p_level public.st_runner_level default 'beginner', p_goal_time_seconds int default null,
  p_weekly_runs int default 3, p_shirt_size text default null, p_order_code text default null
) returns public.st_registrations
language plpgsql security definer set search_path = public as $$
declare
  v_event public.st_events; v_kit public.st_kit_purchases; v_reg public.st_registrations; v_user public.st_usuarios;
begin
  if auth.uid() is null then raise exception 'Faça login para se inscrever'; end if;
  if not public.st_is_active() then raise exception 'Seu acesso está desativado. Fale com a organização.'; end if;

  select * into v_event from public.st_events where id = p_event_id and status = 'published';
  if not found then raise exception 'Corrida não encontrada ou não publicada'; end if;

  if v_event.require_order_code or nullif(trim(p_order_code), '') is not null then
    select * into v_kit from public.st_kit_purchases where event_id = p_event_id and upper(order_code) = upper(trim(p_order_code));
    if not found then raise exception 'Código do pedido/kit inválido'; end if;
    if v_kit.claimed_by is not null and v_kit.claimed_by <> auth.uid() then raise exception 'Este kit já foi vinculado a outro participante'; end if;
    update public.st_kit_purchases set claimed_by = auth.uid(), claimed_at = now() where id = v_kit.id;
  end if;

  insert into public.st_registrations (event_id, user_id, distance_id, kit_purchase_id, shirt_size, level, goal_time_seconds, weekly_runs)
  values (p_event_id, auth.uid(), coalesce(v_kit.distance_id, p_distance_id), v_kit.id, coalesce(v_kit.shirt_size, p_shirt_size), p_level, p_goal_time_seconds, p_weekly_runs)
  on conflict (event_id, user_id) do update set
    distance_id = excluded.distance_id, level = excluded.level, goal_time_seconds = excluded.goal_time_seconds,
    weekly_runs = excluded.weekly_runs,
    shirt_size = coalesce(excluded.shirt_size, public.st_registrations.shirt_size),
    kit_purchase_id = coalesce(excluded.kit_purchase_id, public.st_registrations.kit_purchase_id)
  returning * into v_reg;

  select * into v_user from public.st_usuarios where user_id = auth.uid();
  insert into public.st_leads (event_id, user_id, name, email, phone, city, source, status, interest, score, consent_marketing)
  values (p_event_id, auth.uid(), coalesce(nullif(v_user.full_name, ''), public.st_email()), public.st_email(), v_user.phone, v_user.city,
          'app', 'converted', (select label from public.st_event_distances where id = v_reg.distance_id), 100, true)
  on conflict (event_id, lower(email)) where email is not null
  do update set status = 'converted', user_id = excluded.user_id, score = 100, interest = excluded.interest;

  return v_reg;
end $$;

-- Captura de lead (interessado ainda sem inscrição)
create or replace function public.st_capture_lead(
  p_event_id uuid, p_name text, p_email text, p_phone text default null, p_interest text default null,
  p_source public.st_lead_source default 'app', p_consent boolean default true
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.st_leads (event_id, user_id, name, email, phone, interest, source, consent_marketing, score)
  values (p_event_id, auth.uid(), p_name, lower(trim(p_email)), p_phone, p_interest, p_source, p_consent, 30)
  on conflict (event_id, lower(email)) where email is not null
  do update set score = least(public.st_leads.score + 10, 99),
                phone = coalesce(excluded.phone, public.st_leads.phone),
                interest = coalesce(excluded.interest, public.st_leads.interest)
  returning id into v_id;
  return v_id;
end $$;

-- Métricas do painel do organizador
create or replace function public.st_event_metrics(p_event_id uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare result json;
begin
  if not public.st_can_manage_event(p_event_id) then raise exception 'Sem permissão'; end if;
  select json_build_object(
    'registrations',       (select count(*) from public.st_registrations where event_id = p_event_id),
    'kits_picked_up',      (select count(*) from public.st_registrations where event_id = p_event_id and kit_picked_up),
    'leads_total',         (select count(*) from public.st_leads where event_id = p_event_id),
    'leads_new',           (select count(*) from public.st_leads where event_id = p_event_id and status = 'new'),
    'leads_converted',     (select count(*) from public.st_leads where event_id = p_event_id and status = 'converted'),
    'workouts',            (select count(*) from public.st_workouts where event_id = p_event_id),
    'km_total',            (select coalesce(sum(distance_km), 0) from public.st_workouts where event_id = p_event_id),
    'instagram_shares',    (select count(*) from public.st_workouts where event_id = p_event_id and shared_instagram),
    'sponsor_impressions', (select count(*) from public.st_sponsor_interactions si join public.st_sponsors s on s.id = si.sponsor_id where s.event_id = p_event_id and si.kind = 'impression'),
    'sponsor_clicks',      (select count(*) from public.st_sponsor_interactions si join public.st_sponsors s on s.id = si.sponsor_id where s.event_id = p_event_id and si.kind in ('click','coupon_copy')),
    'by_distance',         (select coalesce(json_agg(x), '[]'::json) from (
                              select d.label, count(r.id) as total from public.st_event_distances d
                              left join public.st_registrations r on r.distance_id = d.id
                              where d.event_id = p_event_id group by d.label, d.sort_order order by d.sort_order) x)
  ) into result;
  return result;
end $$;

-- Gera os treinos preparatórios: 1 plano por distância × nível, N semanas até a prova
create or replace function public.st_generate_training_plans(
  p_event_id uuid, p_weeks int default 8, p_coach_name text default null, p_replace boolean default false
) returns int language plpgsql security definer set search_path = public as $$
declare
  v_weeks int := greatest(4, least(coalesce(p_weeks, 8), 20));
  v_plan_id uuid; v_count int := 0; d record; l record;
begin
  if not public.st_can_manage_event(p_event_id) then raise exception 'Sem permissão para gerar treinos desta corrida'; end if;
  if not exists (select 1 from public.st_event_distances where event_id = p_event_id) then
    raise exception 'Cadastre as distâncias da corrida antes de gerar os treinos';
  end if;
  if p_replace then delete from public.st_training_plans where event_id = p_event_id; end if;

  for d in select * from public.st_event_distances where event_id = p_event_id order by sort_order loop
    for l in select * from (values
        ('beginner'::public.st_runner_level, 'Iniciante', 0.8),
        ('intermediate'::public.st_runner_level, 'Intermediário', 1.0),
        ('advanced'::public.st_runner_level, 'Avançado', 1.25)) as x(level, label, factor) loop
      if exists (select 1 from public.st_training_plans where event_id = p_event_id and distance_id = d.id and level = l.level) then continue; end if;

      insert into public.st_training_plans (event_id, distance_id, level, name, description, coach_name, weeks)
      values (p_event_id, d.id, l.level, d.label || ' — ' || l.label,
              format('Plano de %s semanas até o dia da prova, montado pela organização para você completar os %s com o melhor rendimento.', v_weeks, d.label),
              p_coach_name, v_weeks)
      returning id into v_plan_id;

      insert into public.st_training_sessions (plan_id, week, day_of_week, title, type, distance_km, duration_min, target_pace, description)
      select v_plan_id, w.week, s.dow, s.title, s.type::public.st_session_type,
        case when s.type in ('rest', 'strength') then null
             else round((s.base * least(d.distance_km, 21.1) / 10.0 * l.factor
                   * case when w.week = v_weeks then 0.5 when w.week = v_weeks - 1 then 0.8
                          else 0.7 + (w.week::numeric / greatest(v_weeks - 2, 1)) * 0.45 end)::numeric, 1) end,
        case when s.type = 'strength' then 40 end,
        case s.type
          when 'easy' then case l.level when 'beginner' then '7:00-7:40 /km' when 'intermediate' then '6:00-6:30 /km' else '5:15-5:40 /km' end
          when 'long' then case l.level when 'beginner' then '7:20-8:00 /km' when 'intermediate' then '6:15-6:45 /km' else '5:30-5:50 /km' end
          when 'tempo' then case l.level when 'beginner' then '6:30 /km' when 'intermediate' then '5:30 /km' else '4:45 /km' end
          when 'interval' then case l.level when 'beginner' then '6:00 /km' when 'intermediate' then '5:00 /km' else '4:15 /km' end
        end,
        case s.type
          when 'easy' then 'Rodagem leve, conversando. Foque na cadência e na respiração.'
          when 'long' then 'Longão da semana. Hidrate-se a cada 20 min e teste o gel/alimentação que vai usar na prova.'
          when 'tempo' then 'Aquecimento 10 min + bloco em ritmo forte e controlado + 10 min de desaquecimento.'
          when 'interval' then 'Aquecimento + 6x400m forte com 1:30 de trote + desaquecimento.'
          when 'strength' then 'Fortalecimento: agachamento, afundo, panturrilha, prancha e glúteo (3x12).'
          when 'rest' then 'Descanso total ou mobilidade leve. Recuperar também é treinar!'
        end
      from generate_series(1, v_weeks) as w(week)
      cross join (values (1, 'Fortalecimento', 'strength', 0), (2, 'Rodagem leve', 'easy', 5), (3, 'Descanso ativo', 'rest', 0),
                         (4, 'Treino de ritmo', 'tempo', 6), (5, 'Tiros', 'interval', 5), (6, 'Longão', 'long', 9)) as s(dow, title, type, base)
      where not (w.week = v_weeks and s.dow in (5, 6))
        and not (l.level = 'beginner' and s.type = 'interval');

      insert into public.st_training_sessions (plan_id, week, day_of_week, title, type, distance_km, description)
      values (v_plan_id, v_weeks, 7, 'DIA DA PROVA 🏁', 'race', d.distance_km, 'Chegou o grande dia! Café da manhã testado, aquecimento de 10 min e boa prova!');
      v_count := v_count + 1;
    end loop;
  end loop;
  return v_count;
end $$;

-- Autor e dados do treino das publicações vêm do banco (não dá para falsificar)
create or replace function public.st_fill_community_post()
returns trigger language plpgsql security definer set search_path = public as $$
declare w public.st_workouts;
begin
  new.user_id := auth.uid();
  select nullif(full_name, ''), avatar_url into new.author_name, new.author_avatar from public.st_usuarios where user_id = new.user_id;
  if new.workout_id is not null then
    select * into w from public.st_workouts where id = new.workout_id and user_id = new.user_id;
    if found then
      new.workout_km := w.distance_km; new.workout_seconds := w.duration_seconds; new.workout_pace := w.avg_pace_seconds;
    else
      new.workout_id := null;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_st_fill_community_post on public.st_community_posts;
create trigger trg_st_fill_community_post before insert on public.st_community_posts for each row execute function public.st_fill_community_post();

-- -------------------------------------------------------------------------------------
-- 6) RLS
-- -------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['st_usuarios','st_events','st_event_distances','st_kit_purchases','st_kit_pickups',
    'st_registrations','st_training_plans','st_training_sessions','st_workouts','st_tips','st_sponsors','st_sponsor_interactions',
    'st_posts','st_leads','st_lead_interactions','st_community_posts','st_community_likes'] loop
    execute format('alter table public.%I enable row level security', t);
    -- recria as policies do zero (script pode rodar mais de uma vez)
    execute (select coalesce(string_agg(format('drop policy if exists %I on public.%I;', policyname, t), ' '), 'select 1')
             from pg_policies where schemaname = 'public' and tablename = t);
  end loop;
end $$;

-- st_usuarios: cada um vê/edita o próprio; organizador vê todos; admin gerencia todos
create policy "st_usuarios: ler" on public.st_usuarios for select using (user_id = auth.uid() or public.st_is_admin());
create policy "st_usuarios: editar" on public.st_usuarios for update using (user_id = auth.uid() or public.st_is_admin());
create policy "st_usuarios: admin cadastra" on public.st_usuarios for insert with check (public.st_is_admin());
create policy "st_usuarios: admin remove" on public.st_usuarios for delete using (public.st_is_admin() and email <> 'mapl11@hotmail.com');

-- corridas: todos veem as publicadas; gestores veem/editam as suas
create policy "st_events: ler" on public.st_events for select using (status in ('published','finished') or public.st_can_manage_event(id));
create policy "st_events: criar" on public.st_events for insert with check (public.st_is_admin());
create policy "st_events: editar" on public.st_events for update using (public.st_can_manage_event(id));
create policy "st_events: excluir" on public.st_events for delete using (public.st_is_admin());


-- conteúdo público da corrida
create policy "st_event_distances: ler" on public.st_event_distances for select using (true);
create policy "st_event_distances: gerir" on public.st_event_distances for all using (public.st_can_manage_event(event_id)) with check (public.st_can_manage_event(event_id));
create policy "st_kit_pickups: ler" on public.st_kit_pickups for select using (true);
create policy "st_kit_pickups: gerir" on public.st_kit_pickups for all using (public.st_can_manage_event(event_id)) with check (public.st_can_manage_event(event_id));
create policy "st_sponsors: ler" on public.st_sponsors for select using (active or public.st_can_manage_event(event_id));
create policy "st_sponsors: gerir" on public.st_sponsors for all using (public.st_can_manage_event(event_id)) with check (public.st_can_manage_event(event_id));
create policy "st_posts: ler" on public.st_posts for select using ((published and published_at <= now()) or public.st_can_manage_event(event_id));
create policy "st_posts: gerir" on public.st_posts for all using (public.st_can_manage_event(event_id)) with check (public.st_can_manage_event(event_id));

-- treinos e dicas: só inscritos (ou gestores)
create policy "st_training_plans: ler" on public.st_training_plans for select using (public.st_is_registered(event_id) or public.st_can_manage_event(event_id));
create policy "st_training_plans: gerir" on public.st_training_plans for all using (public.st_can_manage_event(event_id)) with check (public.st_can_manage_event(event_id));
create policy "st_training_sessions: ler" on public.st_training_sessions for select
  using (exists (select 1 from public.st_training_plans p where p.id = plan_id and (public.st_is_registered(p.event_id) or public.st_can_manage_event(p.event_id))));
create policy "st_training_sessions: gerir" on public.st_training_sessions for all
  using (exists (select 1 from public.st_training_plans p where p.id = plan_id and public.st_can_manage_event(p.event_id)))
  with check (exists (select 1 from public.st_training_plans p where p.id = plan_id and public.st_can_manage_event(p.event_id)));
create policy "st_tips: ler" on public.st_tips for select using ((published and public.st_is_registered(event_id)) or public.st_can_manage_event(event_id));
create policy "st_tips: gerir" on public.st_tips for all using (public.st_can_manage_event(event_id)) with check (public.st_can_manage_event(event_id));

-- compras de kit: só gestores (o corredor vincula pela função de inscrição)
create policy "st_kit_purchases: ler" on public.st_kit_purchases for select using (claimed_by = auth.uid() or public.st_can_manage_event(event_id));
create policy "st_kit_purchases: gerir" on public.st_kit_purchases for all using (public.st_can_manage_event(event_id)) with check (public.st_can_manage_event(event_id));

-- inscrições
create policy "st_registrations: ler" on public.st_registrations for select using (user_id = auth.uid() or public.st_can_manage_event(event_id));
create policy "st_registrations: editar" on public.st_registrations for update using (user_id = auth.uid() or public.st_can_manage_event(event_id));
create policy "st_registrations: excluir" on public.st_registrations for delete using (user_id = auth.uid() or public.st_can_manage_event(event_id));

-- treinos realizados: dono (ativo); gestores da corrida leem
create policy "st_workouts: dono" on public.st_workouts for all using (user_id = auth.uid() and public.st_is_active()) with check (user_id = auth.uid() and public.st_is_active());
create policy "st_workouts: gestor le" on public.st_workouts for select using (event_id is not null and public.st_can_manage_event(event_id));

create policy "st_sponsor_interactions: registrar" on public.st_sponsor_interactions for insert with check (auth.uid() is not null);
create policy "st_sponsor_interactions: ler" on public.st_sponsor_interactions for select
  using (exists (select 1 from public.st_sponsors s where s.id = sponsor_id and public.st_can_manage_event(s.event_id)));

-- leads: só gestores
create policy "st_leads: gerir" on public.st_leads for all using (public.st_can_manage_event(event_id)) with check (public.st_can_manage_event(event_id));
create policy "st_lead_interactions: gerir" on public.st_lead_interactions for all
  using (exists (select 1 from public.st_leads l where l.id = lead_id and public.st_can_manage_event(l.event_id)))
  with check (exists (select 1 from public.st_leads l where l.id = lead_id and public.st_can_manage_event(l.event_id)));

-- mural dos corredores: inscritos e gestores
create policy "st_community_posts: ler" on public.st_community_posts for select using (public.st_is_registered(event_id) or public.st_can_manage_event(event_id));
create policy "st_community_posts: publicar" on public.st_community_posts for insert with check (public.st_is_registered(event_id) or public.st_can_manage_event(event_id));
create policy "st_community_posts: apagar" on public.st_community_posts for delete using (user_id = auth.uid() or public.st_can_manage_event(event_id));
create policy "st_community_likes: ler" on public.st_community_likes for select
  using (exists (select 1 from public.st_community_posts p where p.id = post_id and (public.st_is_registered(p.event_id) or public.st_can_manage_event(p.event_id))));
create policy "st_community_likes: proprio" on public.st_community_likes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- -------------------------------------------------------------------------------------
-- 7) PERMISSÕES DAS FUNÇÕES
-- -------------------------------------------------------------------------------------
grant execute on function public.st_minha_conta(text, text) to authenticated;
grant execute on function public.st_register_for_event(uuid, uuid, public.st_runner_level, int, int, text, text) to authenticated;
grant execute on function public.st_capture_lead(uuid, text, text, text, text, public.st_lead_source, boolean) to anon, authenticated;
grant execute on function public.st_event_metrics(uuid) to authenticated;
grant execute on function public.st_generate_training_plans(uuid, int, text, boolean) to authenticated;

-- -------------------------------------------------------------------------------------
-- 8) STORAGE: bucket público para imagens (capas, logos, fotos de treino)
-- -------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('st_media', 'st_media', true) on conflict (id) do nothing;
drop policy if exists "st_media: ler" on storage.objects;
drop policy if exists "st_media: enviar" on storage.objects;
drop policy if exists "st_media: editar" on storage.objects;
drop policy if exists "st_media: apagar" on storage.objects;
create policy "st_media: ler" on storage.objects for select using (bucket_id = 'st_media');
create policy "st_media: enviar" on storage.objects for insert
  with check (bucket_id = 'st_media' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text);
create policy "st_media: editar" on storage.objects for update using (bucket_id = 'st_media' and owner = auth.uid());
create policy "st_media: apagar" on storage.objects for delete using (bucket_id = 'st_media' and owner = auth.uid());
