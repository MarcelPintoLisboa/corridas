-- =====================================================================
-- Street Running — ANAMNESE DO CORREDOR + PLANO DE TREINO PESSOAL
--
-- 1) O corredor responde a anamnese (objetivo, triagem de saúde, rotina,
--    experiência e, se quiser, dados do relógio) na aba Treino.
-- 2) Se a triagem liberar, o app gera um plano de treino só dele, até o dia
--    da prova, e grava com st_salvar_plano_pessoal().
-- 3) O plano pessoal fica nas mesmas tabelas de planos (coluna user_id) e
--    tem prioridade sobre o plano geral da distância/nível.
--
-- Privacidade: a anamnese e o plano pessoal só são vistos pelo próprio
-- corredor e pelo(s) gestor(es) da corrida.
--
-- Rode no SQL Editor depois do 0005 e do 0007. Pode rodar de novo.
-- =====================================================================

-- ------------------------------------------------------------------ plano pessoal
alter table public.st_training_plans add column if not exists user_id uuid references auth.users(id) on delete cascade;
comment on column public.st_training_plans.user_id is 'Preenchido = plano pessoal (anamnese) daquele corredor; vazio = plano geral da corrida';
create index if not exists idx_st_plans_pessoal on public.st_training_plans(event_id, user_id);
create unique index if not exists idx_st_plans_um_pessoal on public.st_training_plans(event_id, user_id) where user_id is not null;

drop policy if exists "st_training_plans: ler" on public.st_training_plans;
create policy "st_training_plans: ler" on public.st_training_plans for select using (
  public.st_can_manage_event(event_id)
  or (user_id is null and public.st_is_registered(event_id))
  or user_id = auth.uid()
);

drop policy if exists "st_training_sessions: ler" on public.st_training_sessions;
create policy "st_training_sessions: ler" on public.st_training_sessions for select using (
  exists (select 1 from public.st_training_plans p where p.id = plan_id and (
    public.st_can_manage_event(p.event_id)
    or (p.user_id is null and public.st_is_registered(p.event_id))
    or p.user_id = auth.uid()))
);

-- ------------------------------------------------------------------ anamnese
create table if not exists public.st_anamneses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  event_id      uuid not null references public.st_events(id) on delete cascade,
  answers       jsonb not null default '{}'::jsonb,
  health        jsonb,            -- resumo do relógio (corridas, km, maior distância, pace, FC repouso, VO2 máx.)
  route         text not null default 'manual' check (route in ('manual', 'connected')),
  safety_state  text not null check (safety_state in ('eligible', 'pending', 'review', 'urgency')),
  plan_id       uuid references public.st_training_plans(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, event_id)
);
comment on table public.st_anamneses is 'Anamnese do corredor por corrida (base do plano de treino pessoal)';

alter table public.st_anamneses enable row level security;
drop policy if exists "st_anamneses: ler" on public.st_anamneses;
drop policy if exists "st_anamneses: inserir" on public.st_anamneses;
drop policy if exists "st_anamneses: editar" on public.st_anamneses;
drop policy if exists "st_anamneses: apagar" on public.st_anamneses;
create policy "st_anamneses: ler" on public.st_anamneses for select
  using (user_id = auth.uid() or public.st_can_manage_event(event_id));
create policy "st_anamneses: inserir" on public.st_anamneses for insert
  with check (user_id = auth.uid() and public.st_is_registered(event_id));
create policy "st_anamneses: editar" on public.st_anamneses for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "st_anamneses: apagar" on public.st_anamneses for delete using (user_id = auth.uid());
grant select, insert, update, delete on public.st_anamneses to authenticated;

create or replace function public.st_anamnese_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_st_anamnese_touch on public.st_anamneses;
create trigger trg_st_anamnese_touch before update on public.st_anamneses for each row execute function public.st_anamnese_touch();

-- ------------------------------------------------------------------ grava o plano pessoal gerado pelo app
-- p_plan:     { name, description, level, weeks }
-- p_sessions: [ { week, day_of_week, title, type, distance_km, duration_min, duration_max_min,
--                 target_pace, description, warmup, steps, treadmill_notes }, … ]
create or replace function public.st_salvar_plano_pessoal(p_event_id uuid, p_plan jsonb, p_sessions jsonb)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_uid uuid := auth.uid();
  v_state text;
  v_reg public.st_registrations;
  v_plan uuid;
  v_weeks int := greatest(1, least(coalesce((p_plan->>'weeks')::int, 8), 30));
begin
  if v_uid is null or not public.st_is_registered(p_event_id) then
    raise exception 'Você não está associado a esta corrida';
  end if;
  select safety_state into v_state from public.st_anamneses where user_id = v_uid and event_id = p_event_id;
  if v_state is null then raise exception 'Responda a anamnese antes de gerar o plano'; end if;
  if v_state <> 'eligible' then raise exception 'Plano bloqueado pela triagem de saúde'; end if;
  if jsonb_typeof(p_sessions) <> 'array' or jsonb_array_length(p_sessions) = 0 then
    raise exception 'Plano sem sessões';
  end if;

  select * into v_reg from public.st_registrations where user_id = v_uid and event_id = p_event_id limit 1;

  -- um plano pessoal por corredor/corrida: o novo substitui o anterior
  delete from public.st_training_plans where event_id = p_event_id and user_id = v_uid;

  insert into public.st_training_plans (event_id, distance_id, level, name, description, weeks, user_id)
  values (p_event_id, v_reg.distance_id,
          coalesce(nullif(p_plan->>'level', '')::public.st_runner_level, v_reg.level, 'beginner'),
          coalesce(nullif(p_plan->>'name', ''), 'Meu plano'),
          p_plan->>'description', v_weeks, v_uid)
  returning id into v_plan;

  insert into public.st_training_sessions (plan_id, week, day_of_week, title, type, distance_km, duration_min,
                                           duration_max_min, target_pace, description, warmup, steps, treadmill_notes)
  select v_plan, s.week, s.day_of_week, s.title, s.type::public.st_session_type, s.distance_km, s.duration_min,
         s.duration_max_min, s.target_pace, s.description, s.warmup, coalesce(s.steps, '[]'::jsonb), s.treadmill_notes
  from jsonb_to_recordset(p_sessions) as s(
    week int, day_of_week int, title text, type text, distance_km numeric, duration_min int,
    duration_max_min int, target_pace text, description text, warmup text, steps jsonb, treadmill_notes text)
  where s.week between 1 and v_weeks and s.day_of_week between 1 and 7;

  update public.st_anamneses set plan_id = v_plan where user_id = v_uid and event_id = p_event_id;
  return v_plan;
end;
$fn$;
revoke all on function public.st_salvar_plano_pessoal(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.st_salvar_plano_pessoal(uuid, jsonb, jsonb) to authenticated;

-- ------------------------------------------------------------------ gerador do gestor (sem tocar nos planos pessoais)
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
  if p_replace then delete from public.st_training_plans where event_id = p_event_id and user_id is null; end if;

  for d in select * from public.st_event_distances where event_id = p_event_id order by sort_order loop
    for l in select * from (values
        ('beginner'::public.st_runner_level, 'Iniciante', 0.8),
        ('intermediate'::public.st_runner_level, 'Intermediário', 1.0),
        ('advanced'::public.st_runner_level, 'Avançado', 1.25)) as x(level, label, factor) loop
      if exists (select 1 from public.st_training_plans where event_id = p_event_id and distance_id = d.id and level = l.level and user_id is null) then continue; end if;

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

-- ------------------------------------------------------------------ feed de atualizações (ignora planos pessoais)
create or replace function public.st_registrar_atualizacao()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  r jsonb;
  v_event uuid;
  v_ref uuid;
  v_tabela text := tg_table_name;
  v_tipo text;
  v_titulo text;
  v_detalhe text;
  v_quando timestamptz := now();
  v_visivel boolean := true;
  v_data timestamptz;
begin
  if tg_op = 'DELETE' then
    if tg_table_name = 'st_training_sessions' then return old; end if;
    delete from public.st_atualizacoes where tabela = tg_table_name and ref_id = old.id;
    return old;
  end if;

  r := to_jsonb(new);
  -- plano pessoal (gerado pela anamnese do corredor) não é anunciado para a corrida
  if tg_table_name = 'st_training_plans' and (r->>'user_id') is not null then return new; end if;
  if tg_table_name = 'st_training_sessions' and exists (
       select 1 from public.st_training_plans p where p.id = (r->>'plan_id')::uuid and p.user_id is not null) then
    return new;
  end if;
  v_ref := (r->>'id')::uuid;
  v_event := (r->>'event_id')::uuid;

  case tg_table_name
    when 'st_posts' then
      v_tipo := 'publicacao';
      v_titulo := r->>'title';
      v_detalhe := left(r->>'body', 140);
      v_visivel := (r->>'published')::boolean;
      v_quando := greatest(now(), (r->>'published_at')::timestamptz);
    when 'st_sponsors' then
      v_tipo := 'patrocinador';
      v_titulo := r->>'name';
      v_detalhe := coalesce(r->>'offer_title', r->>'description');
      v_visivel := (r->>'active')::boolean;
    when 'st_kit_pickups' then
      v_tipo := 'kit';
      v_titulo := r->>'location_name';
      v_detalhe := concat_ws(' · ', to_char((r->>'starts_at')::timestamptz at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'), r->>'address');
    when 'st_event_distances' then
      v_tipo := 'distancia';
      v_titulo := r->>'label';
      v_detalhe := (r->>'distance_km') || ' km';
    when 'st_tips' then
      v_tipo := 'dica';
      v_titulo := r->>'title';
      v_detalhe := left(r->>'body', 140);
      v_visivel := (r->>'published')::boolean;
      -- dica liberada em D-x só aparece a partir dessa data
      if (r->>'days_before_race') is not null then
        select event_date - make_interval(days => (r->>'days_before_race')::int) into v_data from public.st_events where id = v_event;
        v_quando := greatest(now(), v_data);
      end if;
    when 'st_training_plans' then
      v_tipo := 'plano';
      v_titulo := r->>'name';
      v_detalhe := (r->>'weeks') || ' semanas' || coalesce(' · ' || nullif(r->>'coach_name', ''), '');
    when 'st_training_sessions' then
      -- sessão alterada = plano atualizado
      v_tabela := 'st_training_plans';
      v_tipo := 'plano';
      v_ref := (r->>'plan_id')::uuid;
      select event_id, name, weeks || ' semanas' into v_event, v_titulo, v_detalhe from public.st_training_plans where id = v_ref;
      if v_event is null then return new; end if;
    when 'st_events' then
      v_tipo := 'corrida';
      v_event := v_ref;
      v_titulo := 'Informações da corrida';
      v_detalhe := concat_ws(' · ', to_char((r->>'event_date')::timestamptz at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'), r->>'location_name');
      -- só os dados que interessam ao corredor
      if tg_op = 'INSERT' or (to_jsonb(old) - 'updated_at' - 'status') = (r - 'updated_at' - 'status') then
        return new;
      end if;
  end case;

  if not v_visivel then
    delete from public.st_atualizacoes where tabela = v_tabela and ref_id = v_ref;
    return new;
  end if;

  insert into public.st_atualizacoes (event_id, tabela, ref_id, tipo, acao, titulo, detalhe, quando)
  values (v_event, v_tabela, v_ref, v_tipo,
          case when tg_op = 'INSERT' and tg_table_name <> 'st_training_sessions' then 'novo' else 'atualizado' end,
          coalesce(nullif(v_titulo, ''), 'Atualização'), v_detalhe, v_quando)
  on conflict (tabela, ref_id) do update set
    titulo = excluded.titulo, detalhe = excluded.detalhe, quando = excluded.quando,
    -- item criado e logo ajustado continua "novo"
    acao = case when public.st_atualizacoes.acao = 'novo' and public.st_atualizacoes.quando > now() - interval '10 minutes'
                then 'novo' else excluded.acao end;
  return new;
end;
$fn$;

-- planos pessoais que já tinham entrado no feed (não deve haver, mas por garantia)
delete from public.st_atualizacoes a using public.st_training_plans p
 where a.tabela = 'st_training_plans' and a.ref_id = p.id and p.user_id is not null;
