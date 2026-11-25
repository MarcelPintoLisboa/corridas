-- =====================================================================
-- ST_SEED — dados de teste do Street Running (corrida demo completa)
-- Execute após a migration. Idempotente (usa IDs fixos + on conflict).
-- =====================================================================

-- EVENTO DEMO -----------------------------------------------------------
insert into public.st_events (id, name, slug, tagline, description, cover_image_url, logo_url,
  primary_color, secondary_color, event_date, location_name, address, city, state,
  hashtag, instagram_handle, website_url, require_order_code, status)
values (
  '11111111-1111-1111-1111-111111111111',
  'Night Run Sunset 2027', 'night-run-sunset-2027',
  'Corra sob as luzes da cidade',
  'A corrida noturna mais vibrante do ano! Percursos de 5K, 10K e 21K com DJ na largada, pontos de hidratação a cada 2,5 km e medalha finisher exclusiva.',
  'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?w=1200',
  null,
  '#FF4D2E', '#7B2FF7',
  (date_trunc('day', now()) + interval '56 days' + interval '19 hours'),
  'Parque Ibirapuera — Portão 3', 'Av. Pedro Álvares Cabral, s/n', 'São Paulo', 'SP',
  '#NightRunSunset', '@nightrunsunset', 'https://example.com', false, 'published'
) on conflict (id) do update set event_date = excluded.event_date;

insert into public.st_events (id, name, slug, tagline, description, cover_image_url,
  primary_color, secondary_color, event_date, location_name, city, state, hashtag, status)
values (
  '22222222-2222-2222-2222-222222222222',
  'Maratona das Praias', 'maratona-das-praias',
  '42K à beira-mar', 'Percurso plano pela orla com 42K, 21K e 10K.',
  'https://images.unsplash.com/photo-1530143311094-34d807799e8f?w=1200',
  '#00C2FF', '#00E676',
  (date_trunc('day', now()) + interval '120 days' + interval '6 hours'),
  'Orla de Santos', 'Santos', 'SP', '#MaratonaDasPraias', 'published'
) on conflict (id) do update set event_date = excluded.event_date;

-- DISTÂNCIAS ------------------------------------------------------------
insert into public.st_event_distances (id, event_id, label, distance_km, start_time, sort_order) values
  ('a0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', '5K', 5, null, 1),
  ('a0000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', '10K', 10, null, 2),
  ('a0000000-0000-0000-0000-000000000021', '11111111-1111-1111-1111-111111111111', '21K', 21.1, null, 3),
  ('b0000000-0000-0000-0000-000000000010', '22222222-2222-2222-2222-222222222222', '10K', 10, null, 1),
  ('b0000000-0000-0000-0000-000000000021', '22222222-2222-2222-2222-222222222222', '21K', 21.1, null, 2),
  ('b0000000-0000-0000-0000-000000000042', '22222222-2222-2222-2222-222222222222', '42K', 42.195, null, 3)
on conflict (id) do nothing;

-- RETIRADA DE KITS ------------------------------------------------------
insert into public.st_kit_pickups (event_id, location_name, address, maps_url, starts_at, ends_at, required_docs, notes)
select '11111111-1111-1111-1111-111111111111', x.loc, x.addr, x.maps,
       e.event_date - x.d_start, e.event_date - x.d_end,
       'Documento com foto + comprovante de inscrição (QR Code no app)', x.notes
from public.st_events e,
(values
  ('Shopping Ibirapuera — Piso 1', 'Av. Ibirapuera, 3103 - Moema', 'https://maps.google.com/?q=Shopping+Ibirapuera', interval '2 days 9 hours', interval '1 day 22 hours', 'Retirada por terceiros com autorização assinada'),
  ('Loja Parceira RunFast', 'R. Augusta, 1500 - Consolação', 'https://maps.google.com/?q=Rua+Augusta+1500', interval '1 day 10 hours', interval '1 day 3 hours', 'Kit Premium apenas neste local'),
  ('Arena do Evento (Portão 3)', 'Parque Ibirapuera', 'https://maps.google.com/?q=Parque+Ibirapuera+Portao+3', interval '4 hours', interval '1 hour 30 minutes', 'Somente para atletas de outras cidades')
) as x(loc, addr, maps, d_start, d_end, notes)
where e.id = '11111111-1111-1111-1111-111111111111'
  and not exists (select 1 from public.st_kit_pickups where event_id = e.id);

-- COMPRAS DE KIT (para testar vínculo por código) -----------------------
insert into public.st_kit_purchases (event_id, order_code, buyer_name, buyer_email, distance_id, shirt_size, kit_type) values
  ('11111111-1111-1111-1111-111111111111', 'NRS-1001', 'Ana Souza',    'ana@teste.com',    'a0000000-0000-0000-0000-000000000005', 'P',  'standard'),
  ('11111111-1111-1111-1111-111111111111', 'NRS-1002', 'Bruno Lima',   'bruno@teste.com',  'a0000000-0000-0000-0000-000000000010', 'M',  'premium'),
  ('11111111-1111-1111-1111-111111111111', 'NRS-1003', 'Carla Mendes', 'carla@teste.com',  'a0000000-0000-0000-0000-000000000021', 'G',  'premium'),
  ('11111111-1111-1111-1111-111111111111', 'NRS-1004', 'Diego Rocha',  'diego@teste.com',  'a0000000-0000-0000-0000-000000000010', 'GG', 'standard')
on conflict (event_id, order_code) do nothing;

-- PLANOS DE TREINO (3 distâncias x 3 níveis) ----------------------------
insert into public.st_training_plans (id, event_id, distance_id, level, name, description, coach_name, weeks)
select
  md5(d.id::text || l.level::text)::uuid,
  d.event_id, d.id, l.level,
  d.label || ' — ' || case l.level when 'beginner' then 'Iniciante' when 'intermediate' then 'Intermediário' else 'Avançado' end,
  'Plano de 8 semanas montado pela assessoria oficial para você chegar voando no dia da prova.',
  case l.level when 'beginner' then 'Coach Marina Alves' when 'intermediate' then 'Coach Rafael Torres' else 'Coach Júlia Prado' end,
  8
from public.st_event_distances d
cross join (values ('beginner'::public.st_runner_level), ('intermediate'), ('advanced')) as l(level)
on conflict (id) do nothing;

-- Sessões: geradas por semana/dia, escaladas pela distância e nível
insert into public.st_training_sessions (plan_id, week, day_of_week, title, type, distance_km, duration_min, target_pace, description)
select p.id, w.week, s.dow, s.title, s.type::public.st_session_type,
  case when s.type in ('rest','strength') then null
       when s.type = 'race' then d.distance_km
       else round((s.base * least(d.distance_km, 21.1) / 10.0
             * (case p.level when 'beginner' then 0.8 when 'intermediate' then 1.0 else 1.25 end)
             * (case when w.week = 8 then 0.5 when w.week = 7 then 0.8 else 0.7 + w.week * 0.06 end))::numeric, 1)
  end,
  case when s.type = 'strength' then 40 when s.type = 'rest' then null else null end,
  case s.type
    when 'easy' then case p.level when 'beginner' then '7:00-7:40 /km' when 'intermediate' then '6:00-6:30 /km' else '5:15-5:40 /km' end
    when 'long' then case p.level when 'beginner' then '7:20-8:00 /km' when 'intermediate' then '6:15-6:45 /km' else '5:30-5:50 /km' end
    when 'tempo' then case p.level when 'beginner' then '6:30 /km' when 'intermediate' then '5:30 /km' else '4:45 /km' end
    when 'interval' then case p.level when 'beginner' then '6:00 /km' when 'intermediate' then '5:00 /km' else '4:15 /km' end
    else null end,
  case s.type
    when 'easy' then 'Rodagem leve, conversando. Foque na cadência e respiração.'
    when 'long' then 'Longão do fim de semana. Hidrate-se a cada 20 min e teste o gel que vai usar na prova.'
    when 'tempo' then 'Aquecimento 10 min + bloco em ritmo forte e controlado + 10 min desaquecimento.'
    when 'interval' then 'Aquecimento + 6x400m forte com 1:30 de trote + desaquecimento.'
    when 'strength' then 'Fortalecimento: agachamento, afundo, panturrilha, prancha e glúteo (3x12).'
    when 'rest' then 'Descanso total ou mobilidade leve. Recuperar também é treinar!'
    when 'race' then 'DIA DA PROVA! Largue controlado, curta cada quilômetro e acelere no final.'
  end
from public.st_training_plans p
join public.st_event_distances d on d.id = p.distance_id
cross join generate_series(1, 8) as w(week)
cross join (values
  (1, 'Fortalecimento', 'strength', 0),
  (2, 'Rodagem leve', 'easy', 5),
  (3, 'Descanso ativo', 'rest', 0),
  (4, 'Treino de ritmo', 'tempo', 6),
  (6, 'Longão', 'long', 9),
  (5, 'Tiros', 'interval', 5)
) as s(dow, title, type, base)
where not exists (select 1 from public.st_training_sessions ts where ts.plan_id = p.id)
  and not (w.week = 8 and s.dow in (5, 6))
  and not (p.level = 'beginner' and s.type = 'interval');

-- Dia da prova (domingo da semana 8)
insert into public.st_training_sessions (plan_id, week, day_of_week, title, type, distance_km, description)
select p.id, 8, 7, 'DIA DA PROVA 🏁', 'race', d.distance_km,
       'Chegou o grande dia! Café da manhã testado, aquecimento de 10 min e boa prova!'
from public.st_training_plans p join public.st_event_distances d on d.id = p.distance_id
where not exists (select 1 from public.st_training_sessions ts where ts.plan_id = p.id and ts.type = 'race');

-- DICAS DOS TREINADORES E NUTRIÇÃO --------------------------------------
insert into public.st_tips (event_id, category, title, body, author_name, author_role, image_url, days_before_race)
select '11111111-1111-1111-1111-111111111111', x.cat::public.st_tip_category, x.title, x.body, x.author, x.role, x.img, x.days
from (values
  ('training',  'Constância vence intensidade', 'Três treinos bem feitos por semana valem mais do que cinco treinos cansados. Respeite os dias leves do seu plano.', 'Rafael Torres', 'Treinador oficial', 'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800', null),
  ('nutrition', 'Carboidrato é seu combustível', 'Nas semanas de treino, priorize arroz, batata, mandioca, aveia e frutas. 5-7g de carboidrato por kg de peso nos dias de treino intenso.', 'Dra. Paula Nunes', 'Nutricionista esportiva', 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800', null),
  ('hydration', 'Hidratação começa 3 dias antes', 'Beba 35ml de água por kg de peso por dia. Na véspera, inclua isotônico e observe a cor da urina: amarelo claro é o ideal.', 'Dra. Paula Nunes', 'Nutricionista esportiva', 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=800', 10),
  ('nutrition', 'Carb loading na semana da prova', 'Para 21K: 2-3 dias antes aumente o carboidrato para 8g/kg, reduza fibras e gorduras. Nada de comida nova!', 'Dra. Paula Nunes', 'Nutricionista esportiva', null, 7),
  ('race_day',  'Café da manhã da prova', '2h30 antes: pão branco com mel ou geleia, banana e café. Evite lactose e alimentos gordurosos. Repita o que testou nos longões.', 'Dra. Paula Nunes', 'Nutricionista esportiva', 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800', 3),
  ('recovery',  'Sono é treino invisível', 'Durma 7-9h por noite. É no sono que o corpo repara as fibras e consolida a adaptação ao treino.', 'Júlia Prado', 'Treinadora oficial', null, null),
  ('mindset',   'Divida a prova em partes', 'Pense em blocos de 5K. Concentre-se apenas no bloco atual. No último, solte tudo!', 'Marina Alves', 'Treinadora oficial', null, 14),
  ('race_day',  'Polimento: menos é mais', 'Na última semana o volume cai pela metade. Você não vai perder condicionamento — vai chegar descansado.', 'Rafael Torres', 'Treinador oficial', null, 7)
) as x(cat, title, body, author, role, img, days)
where not exists (select 1 from public.st_tips where event_id = '11111111-1111-1111-1111-111111111111');

-- PATROCINADORES --------------------------------------------------------
insert into public.st_sponsors (event_id, name, tier, logo_url, banner_url, description, offer_title, coupon_code, website_url, instagram, sort_order)
select '11111111-1111-1111-1111-111111111111', x.name, x.tier::public.st_sponsor_tier, x.logo, x.banner, x.descr, x.offer, x.coupon, x.site, x.ig, x.ord
from (values
  ('RunFast Calçados', 'master', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300', 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=1200', 'O tênis oficial da Night Run. Amortecimento e retorno de energia para seu melhor tempo.', '20% OFF em tênis de corrida', 'NIGHTRUN20', 'https://example.com/runfast', '@runfast', 1),
  ('HidraMax Isotônico', 'gold', 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=300', 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=1200', 'Hidratação oficial em todos os postos do percurso.', 'Leve 3 pague 2', 'HIDRA3X2', 'https://example.com/hidramax', '@hidramax', 2),
  ('NutriGel Energy', 'gold', 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=300', null, 'Gel de carboidrato com cafeína. Energia rápida no km 10.', 'Kit 10 géis com 15% OFF', 'GEL15', 'https://example.com/nutrigel', '@nutrigel', 3),
  ('Clínica Movimento', 'silver', null, null, 'Fisioterapia esportiva e avaliação biomecânica.', 'Avaliação de pisada grátis', 'PISADA0', 'https://example.com/clinica', '@clinicamovimento', 4),
  ('Smart Watch Pulse', 'support', null, null, 'Relógio GPS com monitor cardíaco.', null, null, 'https://example.com/pulse', '@pulsewatch', 5)
) as x(name, tier, logo, banner, descr, offer, coupon, site, ig, ord)
where not exists (select 1 from public.st_sponsors where event_id = '11111111-1111-1111-1111-111111111111');

-- PUBLICAÇÕES -----------------------------------------------------------
insert into public.st_posts (event_id, type, title, body, image_url, pinned, cta_label, cta_url)
select '11111111-1111-1111-1111-111111111111', x.t::public.st_post_type, x.title, x.body, x.img, x.pin, x.cta, x.url
from (values
  ('alert', 'Retirada de kits liberada!', 'Confira os locais e horários na aba Evento. Leve documento com foto.', null, true, 'Ver locais', null),
  ('news', 'Percurso oficial divulgado', 'Largada e chegada no Portão 3 com passagem pelo Obelisco. Altimetria plana!', 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=1200', false, null, null),
  ('promo', 'Camiseta finisher em pré-venda', 'Garanta a camiseta oficial de finisher com 30% de desconto até sexta.', 'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=1200', false, 'Comprar', 'https://example.com'),
  ('schedule', 'Programação do dia', '17h — Abertura da arena\n18h30 — Aquecimento coletivo\n19h — Largada 21K\n19h15 — Largada 10K e 5K\n21h — Show e premiação', null, false, null, null)
) as x(t, title, body, img, pin, cta, url)
where not exists (select 1 from public.st_posts where event_id = '11111111-1111-1111-1111-111111111111');

-- LEADS -----------------------------------------------------------------
insert into public.st_leads (event_id, name, email, phone, city, source, status, interest, score, consent_marketing, tags)
select '11111111-1111-1111-1111-111111111111', x.n, x.e, x.p, 'São Paulo', x.src::public.st_lead_source, x.st::public.st_lead_status, x.i, x.sc, true, x.tags
from (values
  ('Fernanda Costa', 'fernanda@teste.com', '11999990001', 'instagram', 'new', '10K', 40, array['instagram','primeira-prova']),
  ('Gustavo Pires', 'gustavo@teste.com', '11999990002', 'sponsor', 'contacted', '21K', 60, array['runfast']),
  ('Helena Dias', 'helena@teste.com', '11999990003', 'landing', 'qualified', '5K', 75, array['grupo-corrida']),
  ('Igor Martins', 'igor@teste.com', '11999990004', 'referral', 'new', '10K', 35, array[]::text[]),
  ('Juliana Reis', 'juliana@teste.com', '11999990005', 'app', 'lost', '21K', 10, array['preco'])
) as x(n, e, p, src, st, i, sc, tags)
on conflict do nothing;

-- =====================================================================
-- COMO VIRAR ADMIN: depois de criar sua conta pelo app, rode:
--   O administrador geral (mapl11@hotmail.com) já é criado pelo st_schema. Outros: tela "Administradores e acessos".
-- =====================================================================
