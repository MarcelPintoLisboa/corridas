import type { TrainingSession, Workout } from './types';

export interface ScheduledSession extends TrainingSession {
  date: Date;
  done: boolean;
  workout?: Workout;
}

/**
 * Calcula a data de cada sessão contando de trás pra frente a partir do dia
 * da prova: semana `weeks`, dia 7 = dia da prova.
 */
export function scheduleSessions(
  sessions: TrainingSession[],
  weeks: number,
  raceDateIso: string,
  workouts: Workout[],
): ScheduledSession[] {
  const race = new Date(raceDateIso);
  race.setHours(0, 0, 0, 0);
  const bySession = new Map(workouts.filter((w) => w.session_id).map((w) => [w.session_id!, w]));

  return sessions
    .map((s) => {
      const offsetDays = (weeks - s.week) * 7 + (7 - s.day_of_week);
      const date = new Date(race);
      date.setDate(race.getDate() - offsetDays);
      const workout = bySession.get(s.id);
      return { ...s, date, done: !!workout || (s.type === 'rest' && date < new Date()), workout };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function currentWeek(scheduled: ScheduledSession[], weeks: number) {
  const today = new Date();
  const next = scheduled.find((s) => s.date >= new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  return next ? next.week : weeks;
}

export type HistoryMode = 'pace' | 'km' | 'distance';

/** Série para os gráficos de evolução (pace em min/km, km acumulado ou distância) */
export function buildHistory(workouts: Workout[], mode: HistoryMode) {
  let acc = 0;
  return workouts.map((w, i) => {
    acc += Number(w.distance_km);
    const y = mode === 'pace' ? (w.avg_pace_seconds ?? 0) / 60 : mode === 'km' ? acc : Number(w.distance_km);
    return { x: i, y };
  });
}

export function planProgress(scheduled: ScheduledSession[]) {
  const trainable = scheduled.filter((s) => s.type !== 'rest');
  if (!trainable.length) return 0;
  return trainable.filter((s) => s.done).length / trainable.length;
}
