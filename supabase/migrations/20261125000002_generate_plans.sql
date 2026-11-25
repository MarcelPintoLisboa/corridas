-- =====================================================================
-- Geração automática dos treinos preparatórios pelo organizador
-- Cria 1 plano por distância × nível (iniciante / intermediário / avançado),
-- com N semanas terminando no dia da prova. O organizador pode editar depois.
-- =====================================================================

create or replace function public.generate_training_plans(
  p_event_id uuid,
  p_weeks int default 8,
  p_coach_name text default null,
  p_replace boolean default false
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_weeks int := greatest(4, least(coalesce(p_weeks, 8), 20));
  v_plan_id uuid;
  v_count int := 0;
  d record;
  l record;
begin
  if not public.can_manage_event(p_event_id) then
    raise exception 'Sem permissão para gerar treinos desta corrida';
  end if;
  if not exists (select 1 from public.event_distances where event_id = p_event_id) then
    raise exception 'Cadastre as distâncias da corrida antes de gerar os treinos';
  end if;

  if p_replace then
    delete from public.training_plans where event_id = p_event_id;
  end if;

  for d in select * from public.event_distances where event_id = p_event_id order by sort_order loop
    for l in select * from (values
        ('beginner'::public.runner_level, 'Iniciante', 0.8),
        ('intermediate'::public.runner_level, 'Intermediário', 1.0),
        ('advanced'::public.runner_level, 'Avançado', 1.25)) as x(level, label, factor) loop

      -- não duplica: se já existe plano para a distância+nível, pula
      if exists (select 1 from public.training_plans where event_id = p_event_id and distance_id = d.id and level = l.level) then
        continue;
      end if;

      insert into public.training_plans (event_id, distance_id, level, name, description, coach_name, weeks)
      values (p_event_id, d.id, l.level, d.label || ' — ' || l.label,
              format('Plano de %s semanas até o dia da prova, montado pela organização para você completar os %s com o melhor rendimento.', v_weeks, d.label),
              p_coach_name, v_weeks)
      returning id into v_plan_id;

      insert into public.training_sessions (plan_id, week, day_of_week, title, type, distance_km, duration_min, target_pace, description)
      select v_plan_id, w.week, s.dow, s.title, s.type::public.session_type,
        case when s.type in ('rest', 'strength') then null
             else round((s.base * least(d.distance_km, 21.1) / 10.0 * l.factor
                   -- progressão de volume, pico na penúltima-1 semana, polimento no fim
                   * case when w.week = v_weeks then 0.5
                          when w.week = v_weeks - 1 then 0.8
                          else 0.7 + (w.week::numeric / greatest(v_weeks - 2, 1)) * 0.45 end)::numeric, 1)
        end,
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
      cross join (values
        (1, 'Fortalecimento', 'strength', 0),
        (2, 'Rodagem leve', 'easy', 5),
        (3, 'Descanso ativo', 'rest', 0),
        (4, 'Treino de ritmo', 'tempo', 6),
        (5, 'Tiros', 'interval', 5),
        (6, 'Longão', 'long', 9)
      ) as s(dow, title, type, base)
      where not (w.week = v_weeks and s.dow in (5, 6))         -- semana da prova: sem tiros/longão
        and not (l.level = 'beginner' and s.type = 'interval'); -- iniciante não faz tiros

      insert into public.training_sessions (plan_id, week, day_of_week, title, type, distance_km, description)
      values (v_plan_id, v_weeks, 7, 'DIA DA PROVA 🏁', 'race', d.distance_km,
              'Chegou o grande dia! Café da manhã testado, aquecimento de 10 min e boa prova!');

      v_count := v_count + 1;
    end loop;
  end loop;

  return v_count;
end $$;

grant execute on function public.generate_training_plans(uuid, int, text, boolean) to authenticated;
