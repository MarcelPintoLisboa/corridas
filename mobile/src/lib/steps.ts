import { t } from '@/i18n';

import { formatKm } from './format';
import type { SessionStep, StepKind, TrainingSession } from './types';

export const STEP_META: Record<StepKind, { label: string; icon: string; color: string }> = {
  warmup: { label: 'Aquecimento', icon: 'flame', color: '#FFC400' },
  run: { label: 'Corrida', icon: 'walk', color: '#00E676' },
  interval: { label: 'Tiro', icon: 'flash', color: '#FF4D2E' },
  recovery: { label: 'Recuperação', icon: 'leaf', color: '#00E5FF' },
  walk: { label: 'Caminhada', icon: 'footsteps', color: '#B388FF' },
  cooldown: { label: 'Desaquecimento', icon: 'snow', color: '#2979FF' },
  strength: { label: 'Fortalecimento', icon: 'barbell', color: '#7B2FF7' },
};
export const STEP_KINDS = Object.keys(STEP_META) as StepKind[];

const toSeconds = (p: string) => {
  const m = p.trim().match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** "6:00" → "10,0 km/h" ; "5:30-6:00" → "10,0–10,9 km/h" (velocidade para a esteira) */
export function paceToSpeed(pace?: string | null) {
  if (!pace) return null;
  const parts = pace.replace(/\s|\/km/g, '').split(/[-–]/).map(toSeconds);
  if (parts.some((p) => !p)) return null;
  const speeds = parts.map((s) => 3600 / s!).sort((a, b) => a - b);
  return `${speeds.map((v) => formatKm(v)).join('–')} km/h`;
}

/** "35m - 40m" / "35 min" / null */
export function durationRange(s: Pick<TrainingSession, 'duration_min' | 'duration_max_min'>) {
  if (s.duration_min && s.duration_max_min && s.duration_max_min > s.duration_min) return `${s.duration_min}–${s.duration_max_min} min`;
  if (s.duration_min) return `${s.duration_min} min`;
  return null;
}

/** Etapas da sessão; se o gestor não detalhou, monta uma etapa a partir dos campos básicos */
export function sessionSteps(s: TrainingSession): SessionStep[] {
  if (s.steps && s.steps.length) return s.steps;
  if (s.type === 'rest') return [];
  const kind: StepKind =
    s.type === 'interval' ? 'interval' : s.type === 'recovery' ? 'recovery' : s.type === 'strength' ? 'strength' : 'run';
  return [{ kind, title: s.title, distance_km: s.distance_km, duration_min: s.duration_min, pace: s.target_pace, note: s.description }];
}

/** Aquecimento padrão quando o gestor não escreveu um */
export function defaultWarmup(type: string) {
  if (type === 'strength') return t('5 min de mobilidade articular (tornozelos, quadril e ombros) e 2 séries leves de cada exercício antes da carga.');
  if (type === 'interval' || type === 'tempo' || type === 'race' || type === 'fartlek')
    return t('10 min de trote bem leve + mobilidade dinâmica (balanço de pernas, skipping, anfersen) + 3 acelerações progressivas de 80 m.');
  return t('5 min de caminhada rápida + mobilidade dinâmica (balanço de pernas, giro de quadril, panturrilha) e comece a correr bem devagar.');
}

/** Texto resumo de uma etapa: "6× 400 m · 4:50–5:00/km · 2 min" */
export function stepSummary(st: SessionStep, treadmill = false) {
  const parts: string[] = [];
  if (st.distance_km) parts.push(st.distance_km < 1 ? `${Math.round(st.distance_km * 1000)} m` : `${formatKm(st.distance_km)} km`);
  if (st.duration_min) parts.push(`${st.duration_min} min`);
  if (st.pace) parts.push(treadmill ? (paceToSpeed(st.pace) ?? `${st.pace}/km`) : `${st.pace}/km`);
  return parts.join(' · ');
}
