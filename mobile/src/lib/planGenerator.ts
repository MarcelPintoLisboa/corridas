/**
 * Gera o plano de treino pessoal a partir da anamnese (+ histórico do relógio).
 *
 * Princípios (conservadores, para corredores amadores):
 *  - parte do volume atual (relógio ou informado) e progride ~7–13%/semana conforme a preferência;
 *  - semana de recuperação a cada 4 semanas (−20%) e polimento antes da prova;
 *  - 1 treino longo no dia preferido, 1–2 treinos de qualidade (tiros/ritmo) só para quem já corre;
 *  - quem ainda não corre 10 min seguidos começa com corrida + caminhada;
 *  - nenhuma sessão passa dos minutos disponíveis naquele dia.
 * As datas seguem o mesmo esquema dos planos da corrida: semana N, dia 7 = dia da prova.
 */
import { t } from '@/i18n';

import { DAY_JS, list, targetKm, type Answers } from './anamnese';
import { formatKm, formatPace } from './format';
import type { HealthSummary } from './health.types';
import type { RunnerLevel, SessionStep, SessionType } from './types';

export interface GeneratedSession {
  week: number;
  day_of_week: number;
  title: string;
  type: SessionType;
  distance_km: number | null;
  duration_min: number | null;
  duration_max_min: number | null;
  target_pace: string | null;
  description: string | null;
  warmup: string | null;
  steps: SessionStep[];
  treadmill_notes: string | null;
}

export interface GeneratedPlan {
  plan: { name: string; description: string; level: RunnerLevel; weeks: number };
  sessions: GeneratedSession[];
}

const s = (v: Answers[string]) => (typeof v === 'string' ? v : '');
const num = (v: Answers[string]) => Number(s(v).replace(',', '.')) || 0;
const r1 = (x: number) => Math.round(x * 10) / 10;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const pace = (sec: number) => formatPace(sec);
const range = (a: number, b: number) => `${pace(a)}-${pace(b)}`;
const kmLabel = (km: number) => `${formatKm(km, Number.isInteger(r1(km)) ? 0 : 1)} km`;

function parseHms(v: string) {
  const m = v.match(/^(\d{1,}):([0-5]\d):([0-5]\d)$/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
}

export function generatePlan(a: Answers, health: HealthSummary | null, raceDateIso: string, now = new Date()): GeneratedPlan {
  const dist = targetKm(a);
  const freq = clamp(Number(s(a.frequency)) || 3, 1, 7);
  const chosenDays = list(a.days).filter((d) => d in DAY_JS);
  const minutesOf = (d: string) => num(a['minutes' + d]) || 45;
  const byTime = a.unit === 'Tempo';
  const treadmill = a.surface === 'Esteira' || a.surface === 'Misto';
  const growth = a.progression === 'Conservadora' ? 0.07 : a.progression === 'Desafiadora' ? 0.13 : 0.1;

  // ------------------------------------------------ ponto de partida
  let baseWeeklyKm: number;
  if (health && health.runs > 0) baseWeeklyKm = (health.totalKm / health.days) * 7;
  else if (num(a.weeklyKm) > 0) baseWeeklyKm = num(a.weeklyKm);
  else if (num(a.sessions) > 0) baseWeeklyKm = num(a.sessions) * 4;
  else {
    const byCont: Record<string, number> = { 'Ainda não consigo': 0, 'Até 10 min': 3, 'Mais de 10 até 30 min': 9, 'Mais de 30 até 60 min': 18, 'Mais de 60 min': 28 };
    const byRecent: Record<string, number> = { 'Nunca corri': 0, 'Estou retomando': 6, Sim: 12 };
    const byLevel: Record<string, number> = { Iniciante: 6, Intermediário: 18, Avançado: 32 };
    baseWeeklyKm = byCont[s(a.continuous)] ?? byRecent[s(a.recent)] ?? byLevel[s(a.level)] ?? 6;
  }
  const longestKnown = Math.max(health?.longestKm ?? 0, num(a.longest));

  const level: RunnerLevel =
    a.level === 'Avançado' ? 'advanced' : a.level === 'Intermediário' ? 'intermediate' : a.level === 'Iniciante' ? 'beginner'
      : baseWeeklyKm >= 30 ? 'advanced' : baseWeeklyKm >= 12 ? 'intermediate' : 'beginner';

  const walkRun =
    a.continuous === 'Ainda não consigo' || a.continuous === 'Até 10 min' || a.recent === 'Nunca corri' ||
    (a.goal === 'Começar a correr' && baseWeeklyKm < 6);

  // ------------------------------------------------ ritmos (s/km)
  const target = a.outcome === 'Atingir um tempo específico' ? parseHms(s(a.targetTime)) : 0;
  let easy: number;
  if (health?.avgPaceSec && health.runs >= 2) easy = health.avgPaceSec + 15;
  else if (target > 0) easy = (target / dist) * 1.22;
  else easy = level === 'advanced' ? 330 : level === 'intermediate' ? 380 : 450;
  easy = clamp(easy, 270, 600);
  const racePace = target > 0 ? target / dist : easy / 1.12;
  const tempoPace = Math.min(racePace + 12, easy * 0.92);
  const intervalPace = Math.min(racePace - 8, easy * 0.85);

  // ------------------------------------------------ semanas e dias
  const race = new Date(raceDateIso);
  const daysToRace = Math.floor((race.getTime() - now.getTime()) / 86_400_000);
  const weeks = clamp(Math.floor(daysToRace / 7), 1, 24);
  const raceWd = race.getDay();
  const dowOf = (day: string) => 7 - ((raceWd - DAY_JS[day] + 7) % 7);

  // dias de treino: o dia do longo + os demais bem espaçados entre os disponíveis
  const longDay = chosenDays.includes(s(a.longDay)) ? s(a.longDay) : chosenDays.find((d) => d === 'Domingo' || d === 'Sábado') ?? chosenDays[chosenDays.length - 1];
  const others = chosenDays.filter((d) => d !== longDay);
  const pickN = (arr: string[], n: number) => {
    if (n >= arr.length) return arr;
    const step = arr.length / n;
    return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)]);
  };
  const trainDays = longDay ? [longDay, ...pickN(others, freq - 1)] : pickN(chosenDays, freq);
  const qualityCount = walkRun || freq < 3 ? 0 : level === 'advanced' && freq >= 5 ? 2 : level === 'beginner' ? (freq >= 4 ? 1 : 0) : 1;

  // ------------------------------------------------ volume alvo no pico
  const peakTable: Record<number, number> = { 5: 20, 10: 30, 15: 36, 21.1: 44, 42.2: 60 };
  const keys = Object.keys(peakTable).map(Number);
  const nearest = keys.reduce((p, k) => (Math.abs(k - dist) < Math.abs(p - dist) ? k : p), keys[0]);
  const levelF = level === 'advanced' ? 1.3 : level === 'intermediate' ? 1 : 0.72;
  const weeklyMinutes = trainDays.reduce((acc, d) => acc + minutesOf(d), 0);
  const capByTime = (weeklyMinutes * 60 * 0.92) / easy;
  const peak = Math.max(baseWeeklyKm, Math.min(peakTable[nearest] * levelF * (dist / nearest) ** 0.5, capByTime));
  const longCap = dist <= 10 ? dist * 1.25 + 2 : dist <= 21.1 ? 19 : 32;

  const warmupTxt = t('10 min de trote bem leve + mobilidade dinâmica + 3 acelerações progressivas de 80 m.');
  const treadmillTxt = treadmill ? t('Na esteira, use 1% de inclinação. As velocidades em km/h aparecem na aba Esteira.') : null;

  const sessions: GeneratedSession[] = [];
  let vol = Math.max(baseWeeklyKm, peak * 0.45, walkRun ? 0 : 6);
  const startVol = vol;

  for (let w = 1; w <= weeks; w++) {
    const fromEnd = weeks - w; // 0 = semana da prova
    const isRaceWeek = fromEnd === 0;
    const isTaper = fromEnd === 1 && weeks >= 6;
    const isCutback = !isRaceWeek && !isTaper && w % 4 === 0;

    if (w > 1 && !isCutback && !isTaper && !isRaceWeek) vol = Math.min(peak, vol * (1 + growth));
    let weekVol = isRaceWeek ? vol * 0.45 : isTaper ? vol * 0.7 : isCutback ? vol * 0.8 : vol;

    if (walkRun && !isRaceWeek) {
      // ---------------- corrida + caminhada (minutos), progredindo até correr contínuo
      const prog = weeks > 1 ? (w - 1) / Math.max(1, weeks - 2) : 1;
      const runMin = Math.round(1 + prog * 9); // 1 → 10 min correndo
      const walkMin = Math.max(1, Math.round(2 - prog * 1.5));
      trainDays.forEach((day) => {
        const isLong = day === longDay;
        const avail = minutesOf(day);
        const total = clamp(Math.round((isLong ? 40 : 28) * (isCutback ? 0.8 : 1) + prog * 10), 15, avail);
        const reps = Math.max(2, Math.floor((total - 10) / (runMin + walkMin)));
        const continuous = runMin >= 10 && prog >= 0.9;
        const steps: SessionStep[] = continuous
          ? [
              { kind: 'walk', title: t('Caminhada para aquecer'), duration_min: 5 },
              { kind: 'run', title: t('Corrida contínua bem leve'), duration_min: total - 10, pace: range(easy + 30, easy + 60), note: t('Se precisar, caminhe 1 min e volte a correr.') },
              { kind: 'cooldown', title: t('Caminhada para desaquecer'), duration_min: 5 },
            ]
          : [
              { kind: 'walk', title: t('Caminhada para aquecer'), duration_min: 5 },
              { kind: 'run', title: t('{r} min correndo + {w} min caminhando', { r: runMin, w: walkMin }), repeat: reps, duration_min: runMin + walkMin, note: t('Corra num ritmo em que consiga conversar.') },
              { kind: 'cooldown', title: t('Caminhada para desaquecer'), duration_min: 5 },
            ];
        sessions.push({
          week: w,
          day_of_week: dowOf(day),
          title: continuous ? t('{n} min de corrida leve', { n: total - 10 }) : t('Corrida + caminhada · {n} min', { n: total }),
          type: isLong ? 'long' : 'easy',
          distance_km: null,
          duration_min: total,
          duration_max_min: null,
          target_pace: null,
          description: t(isLong ? 'Treino mais longo da semana' : 'Adaptação à corrida'),
          warmup: null,
          steps,
          treadmill_notes: treadmillTxt,
        });
      });
      continue;
    }

    // ---------------- semana de corrida
    const raceDay = isRaceWeek;
    // semana da prova: no máximo 2 trotes curtos, longe do dia da prova (nunca na véspera)
    const dayList = raceDay
      ? trainDays.filter((d) => dowOf(d) <= 5).sort((x, y) => dowOf(x) - dowOf(y)).slice(0, 2)
      : trainDays;
    // longão: parte do maior treino que a pessoa já faz (sem passar de metade do volume da semana)
    let longKm = raceDay ? 0 : Math.min(longCap, Math.max(weekVol * (freq <= 3 ? 0.42 : 0.33), longestKnown * 0.85 * (weekVol / startVol)), weekVol * 0.5 + 2);
    longKm = Math.min(longKm, (minutesOf(longDay) * 60) / (easy + 15));
    const qualityDays = raceDay ? [] : dayList.filter((d) => d !== longDay).slice(0, qualityCount);
    const easyDays = dayList.filter((d) => d !== longDay && !qualityDays.includes(d));
    const qualityKm = qualityDays.length ? Math.max(3, weekVol * 0.2) : 0;
    const restKm = Math.max(0, weekVol - longKm - qualityKm * qualityDays.length);
    const easyKmEach = easyDays.length ? Math.max(2, restKm / easyDays.length) : 0;

    for (const day of dayList) {
      const avail = minutesOf(day);
      const capKm = (avail * 60) / easy;
      let session: GeneratedSession;

      if (!raceDay && day === longDay && longKm >= 2) {
        const km = r1(Math.max(2, Math.min(longKm, capKm)));
        session = mk(w, day, 'long', km, easy + 10, easy + 40,
          byTime ? t('{n} min de longão', { n: Math.round((km * (easy + 25)) / 60) }) : t('Longão de {km}', { km: kmLabel(km) }),
          t('Treino longo em ritmo confortável'),
          [{ kind: 'run', title: t('{km} em ritmo de conversa', { km: kmLabel(km) }), distance_km: km, pace: range(easy + 10, easy + 40), note: t('Hidrate-se a cada 20–30 min. Termine com a sensação de que conseguiria correr mais.') }]);
      } else if (qualityDays.includes(day)) {
        const useIntervals = (w + qualityDays.indexOf(day)) % 2 === 1;
        const mainMin = Math.max(10, avail - 25);
        if (useIntervals) {
          const repM = dist <= 5 ? 400 : dist <= 10 ? (w > weeks / 2 ? 800 : 400) : 1000;
          const reps = clamp(Math.round((qualityKm * 1000 * 0.45) / repM), 3, Math.min(10, Math.floor((mainMin * 60) / ((repM / 1000) * intervalPace + 90))));
          const km = r1(4 + (reps * repM) / 1000);
          session = mk(w, day, 'interval', km, intervalPace, intervalPace + 10,
            t('{n}× {m} m · tiros', { n: reps, m: repM }), t('Treino intervalado'),
            [
              { kind: 'warmup', title: t('Aquecimento'), duration_min: 10, pace: range(easy + 20, easy + 50) },
              { kind: 'interval', title: t('{m} m forte', { m: repM }), repeat: reps, distance_km: repM / 1000, pace: range(intervalPace - 5, intervalPace + 10), note: t('Forte, mas controlado: a última repetição deve sair igual à primeira.') },
              { kind: 'recovery', title: t('Recuperação trotando ou caminhando'), repeat: reps, duration_min: 1.5 },
              { kind: 'cooldown', title: t('Desaquecimento leve'), duration_min: 8 },
            ], warmupTxt);
        } else {
          const tempoKm = r1(clamp(qualityKm * 0.5, 2, Math.min(dist <= 10 ? 6 : 10, ((mainMin * 60) / tempoPace) )));
          const km = r1(tempoKm + 3);
          session = mk(w, day, 'tempo', km, tempoPace, tempoPace + 10,
            t('{km} em ritmo forte', { km: kmLabel(tempoKm) }), t('Treino de ritmo'),
            [
              { kind: 'warmup', title: t('Aquecimento'), duration_min: 10, pace: range(easy + 20, easy + 50) },
              { kind: 'run', title: t('{km} em ritmo de prova controlado', { km: kmLabel(tempoKm) }), distance_km: tempoKm, pace: range(tempoPace - 5, tempoPace + 10), note: t('Ritmo "confortavelmente difícil": dá para falar frases curtas.') },
              { kind: 'cooldown', title: t('Desaquecimento leve'), duration_min: 8 },
            ], warmupTxt);
        }
      } else {
        const base = raceDay ? clamp(dist * 0.3, 2, 5) : easyKmEach;
        const km = r1(Math.max(2, Math.min(base, capKm)));
        const steps: SessionStep[] = [
          { kind: 'run', title: t('{km} em ritmo de conversa', { km: kmLabel(km) }), distance_km: km, pace: range(easy, easy + 30), note: t('Não mais rápido do que {p}/km. Este é um limite, não uma meta.', { p: pace(easy) }) },
        ];
        if (raceDay) steps.push({ kind: 'interval', title: t('Acelerações de 80 m'), repeat: 4, distance_km: 0.08, note: t('Soltas, para ativar as pernas. Caminhe de volta entre elas.') });
        session = mk(w, day, 'easy', km, easy, easy + 30,
          byTime ? t('{n} min leve', { n: Math.round((km * (easy + 15)) / 60) }) : t('{km} leve', { km: kmLabel(km) }),
          t(raceDay ? 'Soltura para a prova' : 'Corrida leve'), steps);
      }
      sessions.push(session);
    }

    if (raceDay) {
      sessions.push(mk(weeks, '', 'race', r1(dist), racePace, racePace + 15, t('Dia da prova! 🏁'), t('Confie no treino'),
        [
          { kind: 'warmup', title: t('Aquecimento curto'), duration_min: 10, note: t('Trote leve e 2–3 acelerações curtas antes da largada.') },
          { kind: 'run', title: t('{km} de prova', { km: kmLabel(dist) }), distance_km: r1(dist), pace: target > 0 ? range(racePace - 3, racePace + 5) : null, note: t('Largue contido nos primeiros 2 km e acelere aos poucos. Aproveite!') },
        ], t('Chegue cedo, aqueça com trote leve e acelerações curtas. Nada de novo hoje: mesmo tênis, roupa e café da manhã dos treinos.')));
    }
  }

  function mk(week: number, day: string, type: SessionType, km: number, p1: number, p2: number, title: string, description: string, steps: SessionStep[], warmup: string | null = null): GeneratedSession {
    return {
      week,
      day_of_week: day ? dowOf(day) : 7,
      title,
      type,
      distance_km: km,
      duration_min: Math.max(5, Math.round((km * p1) / 60) + (type === 'interval' || type === 'tempo' ? 15 : 0)),
      duration_max_min: Math.max(6, Math.round((km * p2) / 60) + (type === 'interval' || type === 'tempo' ? 20 : 0)),
      target_pace: type === 'race' && !target ? null : range(p1, p2),
      description,
      warmup,
      steps,
      treadmill_notes: treadmillTxt,
    };
  }

  // um treino por dia (se dois caírem no mesmo dia, fica o primeiro)
  const seen = new Set<string>();
  const unique = sessions.filter((x) => {
    const k = `${x.week}-${x.day_of_week}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const goalTxt = target > 0 ? t('meta de {t}', { t: s(a.targetTime) }) : t(s(a.outcome) || 'Completar').toLowerCase();
  return {
    plan: {
      name: t('Meu plano · {km}', { km: kmLabel(dist) }),
      description: t('Plano pessoal de {w} semanas, {f}x por semana, montado a partir da sua anamnese ({goal}).', { w: weeks, f: trainDays.length, goal: goalTxt }),
      level,
      weeks,
    },
    sessions: unique.sort((x, y) => x.week - y.week || x.day_of_week - y.day_of_week),
  };
}
