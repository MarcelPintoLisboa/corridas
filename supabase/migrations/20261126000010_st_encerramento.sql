-- =====================================================================
-- Street Running — ENCERRAMENTO AUTOMÁTICO DA CORRIDA
--
-- X horas depois da largada (padrão: 24 h) a corrida fecha para os corredores:
--   • eles deixam de ver a corrida e tudo dela: publicações, kits, distâncias,
--     patrocinadores, dicas, planos de treino, Stories e atualizações;
--   • não conseguem mais publicar nem comentar nos Stories da corrida;
--   • os TREINOS de cada corredor continuam dele (aba Evolução e posts);
--   • o gestor e o admin geral continuam vendo e editando tudo normalmente;
--   • o status da corrida passa para "Finalizada".
-- O gestor pode mudar o prazo por corrida (campo "Acesso após a largada"),
-- ou deixar vazio para nunca fechar. Para reabrir, basta aumentar o prazo.
--
-- O fechamento é na hora exata (regra de acesso no banco), sem depender de
-- rotina agendada. Se o pg_cron estiver disponível, ele só atualiza o status.
--
-- Rode no SQL Editor depois do 0004. Pode rodar de novo.
-- =====================================================================

alter table public.st_events add column if not exists acesso_horas_apos int default 24;
alter table public.st_events drop constraint if exists st_events_acesso_horas_valido;
alter table public.st_events add constraint st_events_acesso_horas_valido check (acesso_horas_apos is null or acesso_horas_apos between 1 and 8760);
comment on column public.st_events.acesso_horas_apos is 'Horas após a largada em que os corredores perdem o acesso (vazio = nunca fecha)';

-- corrida aberta para os corredores?
create or replace function public.st_corrida_aberta(p_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.st_events e
     where e.id = p_event_id
       and (e.acesso_horas_apos is null or now() < e.event_date + make_interval(hours => e.acesso_horas_apos))
  )
$$;

-- inscrito E corrida ainda aberta (todas as regras de acesso do corredor usam esta função)
create or replace function public.st_is_registered(p_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.st_is_active()
     and exists (select 1 from public.st_registrations r where r.event_id = p_event_id and r.user_id = auth.uid())
     and public.st_corrida_aberta(p_event_id)
$$;

-- corridas encerradas do corredor (para o app avisar "corrida encerrada" em vez de sumir sem explicação)
create or replace function public.st_minhas_corridas_encerradas()
returns table (event_id uuid, name text, event_date timestamptz, logo_url text, primary_color text, fechou_em timestamptz)
language sql stable security definer set search_path = public as $$
  select e.id, e.name, e.event_date, e.logo_url, e.primary_color,
         e.event_date + make_interval(hours => e.acesso_horas_apos)
    from public.st_registrations r
    join public.st_events e on e.id = r.event_id
   where r.user_id = auth.uid()
     and not public.st_corrida_aberta(e.id)
   order by e.event_date desc
   limit 10
$$;
revoke all on function public.st_minhas_corridas_encerradas() from public, anon;
grant execute on function public.st_minhas_corridas_encerradas() to authenticated;

-- marca como "Finalizada" as corridas publicadas cujo prazo passou
create or replace function public.st_fechar_corridas_vencidas()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.st_events set status = 'finished'
   where status = 'published' and not public.st_corrida_aberta(id);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.st_fechar_corridas_vencidas() from public, anon;
grant execute on function public.st_fechar_corridas_vencidas() to authenticated;
select public.st_fechar_corridas_vencidas();

-- agenda de hora em hora (se o pg_cron existir no projeto; senão, segue sem ele)
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'st_fechar_corridas';
  perform cron.schedule('st_fechar_corridas', '7 * * * *', 'select public.st_fechar_corridas_vencidas()');
exception when others then
  raise notice 'pg_cron indisponível (%): o acesso fecha na hora certa mesmo assim; só o status não muda sozinho.', sqlerrm;
end $$;
