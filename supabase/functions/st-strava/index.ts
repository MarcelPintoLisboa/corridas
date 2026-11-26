// Supabase Edge Function: integração com o Strava (corridas do Apple Watch, Garmin, Coros…)
//
// Publicada SEM verificação de JWT (--no-verify-jwt), porque o Strava chama o retorno
// do login (GET ?code&state) sem token. As ações do app (POST) conferem o token do
// usuário aqui dentro.
//
// App → POST { action: 'start', return_url }   → { url } (página de login do Strava)
// Strava → GET ?code&state                       → troca o código, grava os tokens e
//                                                  redireciona para return_url?ok=1
// App → POST { action: 'status' }                → { connected, athlete }
// App → POST { action: 'activities', days }      → { runs: [...] } (só corridas)
// App → POST { action: 'disconnect' }            → { ok: true }
//
// Segredos (Supabase → Edge Functions → Secrets):
//   STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET  (strava.com/settings/api)
// No app do Strava, "Authorization Callback Domain" = <ref>.supabase.co
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET') ?? '';
const CALLBACK = `${SUPABASE_URL}/functions/v1/st-strava`;
const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

/** só volta para o próprio app (evita redirecionamento aberto) */
const safeReturn = (u: string) => /^(streetrunning|exp|exps):\/\//i.test(u);

function back(returnUrl: string, params: Record<string, string>) {
  const sep = returnUrl.includes('?') ? '&' : '?';
  const url = returnUrl + sep + new URLSearchParams(params).toString();
  // 302 para o app + página de reserva caso o navegador não siga o esquema
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="font-family:sans-serif;text-align:center;padding:40px">` +
      `<p>${params.ok ? 'Strava conectado ✓' : 'Não foi possível conectar o Strava.'}</p><p><a href="${url}">Voltar para o app</a></p></body>`,
    { status: 302, headers: { Location: url, 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out?.message ?? `Strava HTTP ${res.status}`);
  return out as { access_token: string; refresh_token: string; expires_at: number; athlete?: { id: number; firstname?: string; lastname?: string } };
}

// ---------------------------------------------------------------- retorno do login (GET)
async function callback(url: URL) {
  const state = url.searchParams.get('state') ?? '';
  const { data: st } = await admin.from('st_strava_estados').select('user_id,return_url,created_at').eq('state', state).maybeSingle();
  if (!st) return new Response('Login expirado. Volte ao app e tente de novo.', { status: 400 });
  await admin.from('st_strava_estados').delete().eq('state', state);
  if (Date.now() - new Date(st.created_at).getTime() > 15 * 60_000) return back(st.return_url, { erro: 'Login expirado. Tente de novo.' });

  const err = url.searchParams.get('error');
  if (err) return back(st.return_url, { erro: err === 'access_denied' ? 'cancelado' : err });
  const scope = url.searchParams.get('scope') ?? '';
  if (!/activity:read/.test(scope)) return back(st.return_url, { erro: 'Marque a permissão de ver suas atividades para importar as corridas.' });

  try {
    const tok = await tokenRequest({ code: url.searchParams.get('code') ?? '', grant_type: 'authorization_code' });
    const name = [tok.athlete?.firstname, tok.athlete?.lastname].filter(Boolean).join(' ') || null;
    const { error } = await admin.from('st_strava_conexoes').upsert({
      user_id: st.user_id,
      athlete_id: tok.athlete?.id ?? 0,
      athlete_name: name,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_at: new Date(tok.expires_at * 1000).toISOString(),
      scope,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return back(st.return_url, { ok: '1' });
  } catch (e) {
    return back(st.return_url, { erro: (e as Error).message });
  }
}

// ---------------------------------------------------------------- token válido do corredor
async function accessToken(userId: string) {
  const { data: c } = await admin.from('st_strava_conexoes').select('*').eq('user_id', userId).maybeSingle();
  if (!c) return null;
  if (new Date(c.expires_at).getTime() - Date.now() > 120_000) return c.access_token as string;
  const tok = await tokenRequest({ refresh_token: c.refresh_token, grant_type: 'refresh_token' });
  await admin
    .from('st_strava_conexoes')
    .update({ access_token: tok.access_token, refresh_token: tok.refresh_token, expires_at: new Date(tok.expires_at * 1000).toISOString(), updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  return tok.access_token;
}

interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type?: string;
  start_date: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  kilojoules?: number;
  trainer?: boolean;
  device_name?: string;
}

const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);

async function activities(userId: string, days: number) {
  const token = await accessToken(userId);
  if (!token) return json({ error: 'Strava não conectado', code: 'not_connected' }, 409);
  const after = Math.floor(Date.now() / 1000) - Math.min(Math.max(days, 1), 365) * 86400;
  const all: StravaActivity[] = [];
  for (let page = 1; page <= 4; page++) {
    const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100&page=${page}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) {
      // acesso revogado no Strava: apaga a conexão para o app pedir de novo
      await admin.from('st_strava_conexoes').delete().eq('user_id', userId);
      return json({ error: 'O acesso ao Strava foi revogado. Conecte de novo.', code: 'not_connected' }, 409);
    }
    if (res.status === 429) return json({ error: 'O Strava limitou as consultas agora. Tente de novo em 15 minutos.' }, 429);
    if (!res.ok) return json({ error: `Strava HTTP ${res.status}` }, 502);
    const list = (await res.json()) as StravaActivity[];
    all.push(...list);
    if (list.length < 100) break;
  }
  const runs = all
    .filter((a) => RUN_TYPES.has(a.sport_type ?? a.type) || a.type === 'Run')
    .map((a) => {
      const start = new Date(a.start_date);
      return {
        externalId: String(a.id),
        source: 'strava',
        start: start.toISOString(),
        end: new Date(start.getTime() + (a.elapsed_time || a.moving_time) * 1000).toISOString(),
        distanceKm: (a.distance ?? 0) / 1000,
        durationSec: a.moving_time || a.elapsed_time,
        avgHr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
        maxHr: a.max_heartrate ? Math.round(a.max_heartrate) : null,
        // o Strava só dá kJ em algumas atividades; kJ ≈ kcal gastas para corrida não é confiável
        calories: null,
        elevationM: a.total_elevation_gain != null ? Math.round(a.total_elevation_gain) : null,
        treadmill: !!a.trainer || (a.sport_type ?? a.type) === 'VirtualRun',
        deviceName: a.device_name ?? 'Strava',
        name: a.name,
      };
    })
    .sort((x, y) => y.start.localeCompare(x.start));
  return json({ runs });
}

// ---------------------------------------------------------------- servidor
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = new URL(req.url);
  if (!CLIENT_ID || !CLIENT_SECRET) return json({ error: 'Configure os segredos STRAVA_CLIENT_ID e STRAVA_CLIENT_SECRET no Supabase.' }, 500);
  if (req.method === 'GET') return callback(url);
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  // quem está chamando (token do app)
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: u } = await admin.auth.getUser(jwt);
  const userId = u?.user?.id;
  if (!userId) return json({ error: 'Entre no app novamente.' }, 401);

  let body: { action?: string; return_url?: string; days?: number } = {};
  try {
    body = await req.json();
  } catch {
    /* corpo vazio */
  }

  switch (body.action) {
    case 'start': {
      const returnUrl = body.return_url ?? '';
      if (!safeReturn(returnUrl)) return json({ error: 'return_url inválida' }, 400);
      const state = crypto.randomUUID();
      // limpa tentativas antigas do mesmo corredor
      await admin.from('st_strava_estados').delete().eq('user_id', userId);
      const { error } = await admin.from('st_strava_estados').insert({ state, user_id: userId, return_url: returnUrl });
      if (error) return json({ error: /relation|does not exist/i.test(error.message) ? 'Rode o arquivo supabase/migrations/20261126000011_st_strava.sql no SQL Editor do Supabase.' : error.message }, 500);
      const auth = new URL('https://www.strava.com/oauth/authorize');
      auth.search = new URLSearchParams({ client_id: CLIENT_ID, response_type: 'code', redirect_uri: CALLBACK, approval_prompt: 'auto', scope: 'read,activity:read_all', state }).toString();
      return json({ url: auth.toString() });
    }
    case 'status': {
      const { data: c, error } = await admin.from('st_strava_conexoes').select('athlete_name').eq('user_id', userId).maybeSingle();
      if (error) return json({ error: /relation|does not exist/i.test(error.message) ? 'Rode o arquivo supabase/migrations/20261126000011_st_strava.sql no SQL Editor do Supabase.' : error.message }, 500);
      return json({ connected: !!c, athlete: c?.athlete_name ?? null });
    }
    case 'activities':
      try {
        return await activities(userId, Number(body.days) || 60);
      } catch (e) {
        return json({ error: (e as Error).message }, 502);
      }
    case 'disconnect': {
      const token = await accessToken(userId).catch(() => null);
      if (token) await fetch('https://www.strava.com/oauth/deauthorize', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
      await admin.from('st_strava_conexoes').delete().eq('user_id', userId);
      return json({ ok: true });
    }
    default:
      return json({ error: 'Ação inválida' }, 400);
  }
});
