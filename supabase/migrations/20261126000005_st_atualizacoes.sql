-- =====================================================================
-- Street Running — ATUALIZAÇÕES DA CORRIDA (feed da tela Início)
--
-- Tudo o que o gestor adiciona ou altera numa corrida vira uma "atualização"
-- que aparece no Início dos corredores associados a ela:
--   publicações, patrocinadores, retirada de kits, distâncias, dicas,
--   planos de treino (e suas sessões) e os dados da própria corrida.
-- Cada item aparece uma vez (o registro mais recente: "novo" ou "atualizado").
-- Publicações agendadas e dicas liberadas em D-x só aparecem na data certa.
-- Itens despublicados, inativos ou excluídos saem do feed.
--
-- Rode no SQL Editor depois do 0004. Pode rodar de novo.
-- =====================================================================

create table if not exists public.st_atualizacoes (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid not null references public.st_events(id) on delete cascade,
  tabela    text not null,
  ref_id    uuid not null,
  tipo      text not null check (tipo in ('publicacao', 'patrocinador', 'kit', 'distancia', 'dica', 'plano', 'corrida')),
  acao      text not null check (acao in ('novo', 'atualizado')),
  titulo    text not null,
  detalhe   text,
  quando    timestamptz not null default now(),
  unique (tabela, ref_id)
);
create index if not exists idx_st_atualizacoes_evento on public.st_atualizacoes(event_id, quando desc);

alter table public.st_atualizacoes enable row level security;
drop policy if exists "st_atualizacoes: ler" on public.st_atualizacoes;
create policy "st_atualizacoes: ler" on public.st_atualizacoes for select
  using (quando <= now() and (public.st_is_registered(event_id) or public.st_can_manage_event(event_id)));
grant select on public.st_atualizacoes to authenticated;

-- registra/atualiza (ou remove) a atualização de um item
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

do $$
declare t text;
begin
  foreach t in array array['st_posts','st_sponsors','st_kit_pickups','st_event_distances','st_tips','st_training_plans','st_training_sessions'] loop
    execute format('drop trigger if exists trg_st_atualizacao on public.%I', t);
    execute format('create trigger trg_st_atualizacao after insert or update or delete on public.%I for each row execute function public.st_registrar_atualizacao()', t);
  end loop;
  drop trigger if exists trg_st_atualizacao on public.st_events;
  create trigger trg_st_atualizacao after update on public.st_events for each row execute function public.st_registrar_atualizacao();
end $$;

-- conteúdo que já existe entra no feed uma vez (sem duplicar)
insert into public.st_atualizacoes (event_id, tabela, ref_id, tipo, acao, titulo, detalhe, quando)
select event_id, 'st_posts', id, 'publicacao', 'novo', title, left(body, 140), published_at from public.st_posts where published
union all select event_id, 'st_sponsors', id, 'patrocinador', 'novo', name, offer_title, created_at from public.st_sponsors where active
union all select event_id, 'st_kit_pickups', id, 'kit', 'novo', location_name, address, created_at from public.st_kit_pickups
union all select event_id, 'st_event_distances', id, 'distancia', 'novo', label, distance_km || ' km', created_at from public.st_event_distances
union all select event_id, 'st_tips', id, 'dica', 'novo', title, left(body, 140), created_at from public.st_tips where published
union all select event_id, 'st_training_plans', id, 'plano', 'novo', name, weeks || ' semanas', created_at from public.st_training_plans
on conflict (tabela, ref_id) do nothing;
