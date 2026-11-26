-- =====================================================================
-- Street Running — INTEGRAÇÃO COM O STRAVA
--
-- Alternativa ao Apple Saúde para quem instala o app pelo Sideloadly (sem conta
-- de desenvolvedor paga, o iPhone não libera o HealthKit). O Apple Watch, Garmin,
-- Coros, Polar etc. sincronizam com o Strava, e o app puxa as corridas de lá.
--
-- Os tokens do Strava ficam só no banco e só a Edge Function st-strava (service
-- role) lê/grava: sem policies de RLS, o app nunca vê os tokens.
--
-- Rode no SQL Editor depois do 0008. Pode rodar de novo.
-- =====================================================================

-- conexão de cada corredor com o Strava
create table if not exists public.st_strava_conexoes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  athlete_id bigint not null,
  athlete_name text,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.st_strava_conexoes enable row level security;
revoke all on public.st_strava_conexoes from anon, authenticated;

-- "state" do login OAuth (liga o retorno do Strava ao corredor que pediu)
create table if not exists public.st_strava_estados (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  return_url text not null,
  created_at timestamptz not null default now()
);
alter table public.st_strava_estados enable row level security;
revoke all on public.st_strava_estados from anon, authenticated;

-- treinos importados do Strava
alter table public.st_workouts drop constraint if exists st_workouts_source_valida;
alter table public.st_workouts add constraint st_workouts_source_valida
  check (source in ('manual', 'apple_health', 'health_connect', 'strava'));

comment on column public.st_workouts.source is 'manual | apple_health (Apple Watch/Saúde) | health_connect (Android) | strava';
