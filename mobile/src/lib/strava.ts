import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { t } from '@/i18n';

import { summarize, type HealthRun, type HealthSummary } from './health.types';
import { supabase } from './supabase';

/**
 * Strava: alternativa ao Apple Saúde/Health Connect.
 * Funciona em qualquer instalação (inclusive Sideloadly), porque não depende de
 * permissão do sistema: o relógio sincroniza com o Strava e a Edge Function
 * st-strava busca as corridas com o token do corredor (guardado só no servidor).
 */

/** endereço de volta para o app depois do login no Strava */
const RETURN_URL = Linking.createURL('strava-conectado');

async function call<T>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('st-strava', { body: { action, ...extra } });
  if (error) {
    let msg = '';
    let status = 0;
    try {
      const ctx = (error as { context?: Response }).context;
      status = ctx?.status ?? 0;
      msg = (await ctx?.json())?.error ?? '';
    } catch {}
    if (status === 404 || (!status && !msg)) msg = t('Publique a função st-strava no Supabase (veja o README).');
    const e = new Error(msg ? t(msg) : error.message) as Error & { code?: string };
    if (status === 409) e.code = 'not_connected';
    throw e;
  }
  return data as T;
}

function toRun(r: Omit<HealthRun, 'start' | 'end'> & { start: string; end: string }): HealthRun {
  return { ...r, start: new Date(r.start), end: new Date(r.end) };
}

export const strava = {
  name: 'Strava',
  source: 'strava' as const,

  /** está conectado? (e nome do atleta no Strava) */
  async status(): Promise<{ connected: boolean; athlete: string | null }> {
    return call('status');
  },

  /** abre o login do Strava; true quando conectou */
  async connect(): Promise<boolean> {
    const { url } = await call<{ url: string }>('start', { return_url: RETURN_URL });
    const res = await WebBrowser.openAuthSessionAsync(url, RETURN_URL);
    if (res.type !== 'success') return false;
    const q = Linking.parse(res.url).queryParams ?? {};
    if (q.erro) {
      if (q.erro === 'cancelado') return false;
      throw new Error(t(String(q.erro)));
    }
    return q.ok === '1';
  },

  async listRuns(days: number): Promise<HealthRun[]> {
    const { runs } = await call<{ runs: (Omit<HealthRun, 'start' | 'end'> & { start: string; end: string })[] }>('activities', { days });
    return runs.map(toRun);
  },

  async summary(days: number): Promise<HealthSummary> {
    return summarize(await strava.listRuns(days), days, { restingHr: null, vo2max: null });
  },

  async disconnect(): Promise<void> {
    await call('disconnect');
  },
};
