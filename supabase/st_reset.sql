-- =====================================================================
-- Street Running — APAGA TODOS OS DADOS do app (começar do zero)
--
-- Remove corridas, distâncias, kits, inscrições, planos, treinos, dicas,
-- patrocinadores, publicações, leads e o mural da comunidade.
-- Mantém apenas o administrador geral (mapl11@hotmail.com) no controle de acesso.
-- Também apaga as contas de teste criadas durante o desenvolvimento
-- (teste.streetrunning.*@example.com e teste.crash.*@example.com).
--
-- NÃO mexe em nada do assistencia-ml (assistencia_* e demais contas de login).
-- Estrutura (tabelas, regras de acesso, funções) continua intacta.
-- =====================================================================

begin;

-- conteúdo das corridas (as dependentes saem em cascata)
truncate table
  public.st_community_likes,
  public.st_community_posts,
  public.st_lead_interactions,
  public.st_leads,
  public.st_posts,
  public.st_sponsor_interactions,
  public.st_sponsors,
  public.st_tips,
  public.st_workouts,
  public.st_training_sessions,
  public.st_training_plans,
  public.st_registrations,
  public.st_kit_pickups,
  public.st_kit_purchases,
  public.st_event_distances,
  public.st_events
restart identity cascade;

-- controle de acesso: fica só o administrador geral
delete from public.st_usuarios where lower(email) <> 'mapl11@hotmail.com';

-- contas de login de teste (somente as criadas nos testes do Street Running)
delete from auth.users
where email ~* '^teste\.(streetrunning|crash)\.[0-9]+@example\.com$';

commit;

-- conferência: tudo zerado, só o admin geral
select 'st_events' tabela, count(*) from public.st_events
union all select 'st_registrations', count(*) from public.st_registrations
union all select 'st_workouts', count(*) from public.st_workouts
union all select 'st_leads', count(*) from public.st_leads
union all select 'st_usuarios', count(*) from public.st_usuarios;
