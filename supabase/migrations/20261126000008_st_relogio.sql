-- =====================================================================
-- Street Running — TREINOS IMPORTADOS DO RELÓGIO
--
-- O corredor importa as corridas gravadas no relógio:
--   • iPhone: app Saúde (Apple Watch, iPhone e apps que gravam no Saúde)
--   • Android: Health Connect (Galaxy Watch, Pixel Watch, Garmin Connect…)
-- Cada treino guarda a origem e o identificador do relógio, para não importar
-- duas vezes, além de frequência cardíaca máxima e calorias.
-- Cada corredor só importa e vê os próprios treinos (RLS de st_workouts).
--
-- Rode no SQL Editor depois do 0001. Pode rodar de novo.
-- =====================================================================

alter table public.st_workouts add column if not exists source text not null default 'manual';
alter table public.st_workouts add column if not exists external_id text;
alter table public.st_workouts add column if not exists max_hr int;
alter table public.st_workouts add column if not exists calories int;

alter table public.st_workouts drop constraint if exists st_workouts_source_valida;
alter table public.st_workouts add constraint st_workouts_source_valida
  check (source in ('manual', 'apple_health', 'health_connect'));

comment on column public.st_workouts.source is 'manual | apple_health (Apple Watch/Saúde) | health_connect (Android)';
comment on column public.st_workouts.external_id is 'Identificador do treino no Saúde/Health Connect (evita importar duas vezes)';

-- o mesmo treino do relógio não entra duas vezes para a mesma pessoa
create unique index if not exists idx_st_workouts_externo on public.st_workouts(user_id, source, external_id)
  where external_id is not null;
