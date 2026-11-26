-- =====================================================================
-- Street Running — SESSÃO DE TREINO DETALHADA
--
-- Campos extras para o gestor parametrizar cada sessão do plano:
--   duration_max_min  faixa de duração (ex.: 35 a 40 min, junto com duration_min)
--   warmup            instruções de aquecimento
--   steps             etapas do treino (aquecimento, corrida, tiros, recuperação…)
--   treadmill_notes   instruções extras para quem treina na esteira
--
-- steps é uma lista JSON, cada etapa:
--   { "kind": "warmup|run|interval|recovery|walk|cooldown|strength",
--     "title": "3,5 km em ritmo de conversa", "distance_km": 3.5,
--     "duration_min": 20, "pace": "6:00-6:30", "repeat": 6, "note": "..." }
--
-- Rode no SQL Editor depois do 0001. Pode rodar de novo.
-- =====================================================================

alter table public.st_training_sessions add column if not exists duration_max_min int check (duration_max_min is null or duration_max_min > 0);
alter table public.st_training_sessions add column if not exists warmup text;
alter table public.st_training_sessions add column if not exists steps jsonb not null default '[]'::jsonb;
alter table public.st_training_sessions add column if not exists treadmill_notes text;

comment on column public.st_training_sessions.duration_max_min is 'Duração máxima (min) — com duration_min forma a faixa exibida ao corredor';
comment on column public.st_training_sessions.warmup is 'Instruções de aquecimento';
comment on column public.st_training_sessions.steps is 'Etapas do treino (lista JSON: kind, title, distance_km, duration_min, pace, repeat, note)';
comment on column public.st_training_sessions.treadmill_notes is 'Instruções extras para a esteira';

alter table public.st_training_sessions drop constraint if exists st_training_sessions_steps_lista;
alter table public.st_training_sessions add constraint st_training_sessions_steps_lista check (jsonb_typeof(steps) = 'array');
