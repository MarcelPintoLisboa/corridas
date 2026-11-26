// Supabase Edge Function: e-mail de boas-vindas quando o gestor associa um corredor a uma corrida.
//
// Chamada pelo app (Corredores da corrida → Associar) com o token do gestor:
//   supabase.functions.invoke('st-boas-vindas', { body: { event_id, email } })
//
// Segredos (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY   chave da API do Resend (https://resend.com)
//   EMAIL_FROM       remetente verificado no Resend, ex.: corridas@seudominio.com.br
// SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY já existem nas Edge Functions.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { welcomeHtml, welcomeSubject, welcomeText } from './template.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  const RESEND = Deno.env.get('RESEND_API_KEY');
  const FROM = Deno.env.get('EMAIL_FROM');
  if (!RESEND || !FROM) return json({ error: 'Configure os segredos RESEND_API_KEY e EMAIL_FROM' }, 500);

  let body: { event_id?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  const eventId = body.event_id;
  const email = (body.email ?? '').trim().toLowerCase();
  if (!eventId || !/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'Informe event_id e email' }, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  // 1) quem chamou precisa gerenciar a corrida (gestor dela ou admin geral)
  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: canManage, error: permError } = await asCaller.rpc('st_can_manage_event', { p_event_id: eventId });
  if (permError || !canManage) return json({ error: 'Sem permissão para esta corrida' }, 403);

  // 2) dados da corrida e do corredor (service role: leitura direta)
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: ev } = await admin
    .from('st_events')
    .select('id,name,event_date,location_name,city,logo_url,cover_image_url,primary_color,secondary_color,website_url')
    .eq('id', eventId)
    .single();
  if (!ev) return json({ error: 'Corrida não encontrada' }, 404);

  const { data: usuario } = await admin.from('st_usuarios').select('id,user_id,full_name').eq('email', email).maybeSingle();
  // distância: da inscrição (já tem conta) ou da associação pendente (1º acesso)
  let distance: string | null = null;
  if (usuario?.user_id) {
    const { data: reg } = await admin
      .from('st_registrations')
      .select('distance:st_event_distances(label)')
      .eq('event_id', eventId)
      .eq('user_id', usuario.user_id)
      .maybeSingle();
    distance = (reg?.distance as { label?: string } | null)?.label ?? null;
  } else if (usuario?.id) {
    const { data: pend } = await admin
      .from('st_inscricoes_pendentes')
      .select('distance:st_event_distances(label)')
      .eq('event_id', eventId)
      .eq('usuario_id', usuario.id)
      .maybeSingle();
    distance = (pend?.distance as { label?: string } | null)?.label ?? null;
  }

  const data = {
    runnerName: usuario?.full_name ?? null,
    runnerEmail: email,
    raceName: ev.name,
    raceDate: ev.event_date,
    location: ev.location_name,
    city: ev.city,
    distance,
    logoUrl: ev.logo_url,
    coverUrl: ev.cover_image_url,
    primary: ev.primary_color ?? '#FF4D2E',
    secondary: ev.secondary_color ?? '#7B2FF7',
    websiteUrl: ev.website_url,
    hasAccount: !!usuario?.user_id,
  };

  // 3) envio pelo Resend (remetente com o nome da corrida)
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${ev.name.replace(/[<>"]/g, '')} <${FROM}>`,
      to: [email],
      subject: welcomeSubject(data),
      html: welcomeHtml(data),
      text: welcomeText(data),
    }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) return json({ error: 'Falha no envio', detail: out }, 502);
  return json({ sent: true, id: (out as { id?: string }).id ?? null });
});
