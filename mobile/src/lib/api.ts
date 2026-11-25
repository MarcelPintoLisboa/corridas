import { supabase, unwrap } from './supabase';
import type {
  EventDistance,
  KitPickup,
  Post,
  RaceEvent,
  Registration,
  RunnerLevel,
  Sponsor,
  Tip,
  TrainingPlan,
  TrainingSession,
  Workout,
} from './types';

export const api = {
  async publishedEvents() {
    return unwrap(
      await supabase.from('st_events').select('*').eq('status', 'published').order('event_date', { ascending: true }),
    ) as RaceEvent[];
  },

  async event(id: string) {
    return unwrap(await supabase.from('st_events').select('*').eq('id', id).single()) as RaceEvent;
  },

  async distances(eventId: string) {
    return unwrap(
      await supabase.from('st_event_distances').select('*').eq('event_id', eventId).order('sort_order'),
    ) as EventDistance[];
  },

  async pickups(eventId: string) {
    return unwrap(
      await supabase.from('st_kit_pickups').select('*').eq('event_id', eventId).order('starts_at'),
    ) as KitPickup[];
  },

  async sponsors(eventId: string) {
    const rows = unwrap(
      await supabase.from('st_sponsors').select('*').eq('event_id', eventId).eq('active', true).order('sort_order'),
    ) as Sponsor[];
    const order = { master: 0, gold: 1, silver: 2, support: 3 };
    return rows.sort((a, b) => order[a.tier] - order[b.tier] || a.sort_order - b.sort_order);
  },

  async posts(eventId: string) {
    return unwrap(
      await supabase
        .from('st_posts')
        .select('*')
        .eq('event_id', eventId)
        .eq('published', true)
        .order('pinned', { ascending: false })
        .order('published_at', { ascending: false }),
    ) as Post[];
  },

  async tips(eventId: string, raceDate?: string) {
    const rows = unwrap(
      await supabase.from('st_tips').select('*').eq('event_id', eventId).eq('published', true).order('created_at'),
    ) as Tip[];
    if (!raceDate) return rows;
    const days = Math.ceil((new Date(raceDate).getTime() - Date.now()) / 86_400_000);
    // Dicas com days_before_race só aparecem quando faltar esse número de dias ou menos
    return rows.filter((t) => t.days_before_race == null || days <= t.days_before_race);
  },

  /** Plano do participante: mesma distância + nível; cai para qualquer plano da distância */
  async planFor(reg: Pick<Registration, 'event_id' | 'distance_id' | 'level'>) {
    let q = supabase.from('st_training_plans').select('*').eq('event_id', reg.event_id);
    if (reg.distance_id) q = q.eq('distance_id', reg.distance_id);
    const plans = unwrap(await q) as TrainingPlan[];
    const plan = plans.find((p) => p.level === reg.level) ?? plans[0];
    if (!plan) return null;
    const sessions = unwrap(
      await supabase.from('st_training_sessions').select('*').eq('plan_id', plan.id).order('week').order('day_of_week'),
    ) as TrainingSession[];
    return { plan, sessions };
  },

  async workouts(userId: string, eventId?: string | null) {
    let q = supabase.from('st_workouts').select('*').eq('user_id', userId).order('performed_at', { ascending: true });
    if (eventId) q = q.eq('event_id', eventId);
    return unwrap(await q) as Workout[];
  },

  async workout(id: string) {
    return unwrap(await supabase.from('st_workouts').select('*').eq('id', id).single()) as Workout;
  },

  async register(params: {
    eventId: string;
    distanceId: string | null;
    level: RunnerLevel;
    goalSeconds: number | null;
    weeklyRuns: number;
    shirtSize: string | null;
    orderCode: string | null;
  }) {
    return unwrap(
      await supabase.rpc('st_register_for_event', {
        p_event_id: params.eventId,
        p_distance_id: params.distanceId,
        p_level: params.level,
        p_goal_time_seconds: params.goalSeconds,
        p_weekly_runs: params.weeklyRuns,
        p_shirt_size: params.shirtSize,
        p_order_code: params.orderCode || null,
      }),
    ) as Registration;
  },

  async captureLead(params: { eventId: string; name: string; email: string; phone?: string; interest?: string }) {
    return unwrap(
      await supabase.rpc('st_capture_lead', {
        p_event_id: params.eventId,
        p_name: params.name,
        p_email: params.email,
        p_phone: params.phone ?? null,
        p_interest: params.interest ?? null,
        p_source: 'app',
        p_consent: true,
      }),
    ) as string;
  },
};
