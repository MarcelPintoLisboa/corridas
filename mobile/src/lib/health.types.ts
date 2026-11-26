/** Corrida lida do relógio (Apple Saúde / Health Connect), já normalizada */
export interface HealthRun {
  externalId: string;
  source: 'apple_health' | 'health_connect';
  start: Date;
  end: Date;
  distanceKm: number;
  durationSec: number;
  avgHr: number | null;
  maxHr: number | null;
  calories: number | null;
  elevationM: number | null;
  treadmill: boolean;
  /** app/aparelho que gravou (ex.: "Apple Watch de Ana") */
  deviceName: string | null;
}

/** Resumo do histórico para a anamnese */
export interface HealthSummary {
  days: number;
  runs: number;
  totalKm: number;
  longestKm: number;
  /** pace médio (s/km) das corridas do período */
  avgPaceSec: number | null;
  /** corridas por semana no período */
  runsPerWeek: number;
  restingHr: number | null;
  vo2max: number | null;
  lastRun: string | null;
}

/** Monta o resumo a partir das corridas (comum às plataformas) */
export function summarize(runs: HealthRun[], days: number, extra: { restingHr: number | null; vo2max: number | null }): HealthSummary {
  const valid = runs.filter((r) => r.distanceKm >= 0.2 && r.durationSec > 0);
  const totalKm = valid.reduce((a, r) => a + r.distanceKm, 0);
  const totalSec = valid.reduce((a, r) => a + r.durationSec, 0);
  return {
    days,
    runs: valid.length,
    totalKm: Math.round(totalKm * 10) / 10,
    longestKm: Math.round(Math.max(0, ...valid.map((r) => r.distanceKm)) * 10) / 10,
    avgPaceSec: totalKm > 0 ? Math.round(totalSec / totalKm) : null,
    runsPerWeek: Math.round((valid.length / days) * 7 * 10) / 10,
    restingHr: extra.restingHr,
    vo2max: extra.vo2max,
    lastRun: valid.length ? valid[0].start.toISOString() : null,
  };
}

export type HealthStatus =
  | 'available'
  /** Android: Health Connect não instalado/desatualizado */
  | 'needs_install'
  /** aparelho/plataforma sem suporte (ex.: web, iPad) */
  | 'unavailable';

export interface HealthProvider {
  /** nome exibido: "Apple Saúde" / "Health Connect" */
  name: string;
  source: HealthRun['source'];
  status(): Promise<HealthStatus>;
  /** pede permissão de leitura; false se negada */
  requestAccess(): Promise<boolean>;
  /** corridas dos últimos `days` dias, mais recentes primeiro */
  listRuns(days: number): Promise<HealthRun[]>;
  /** resumo dos últimos `days` dias (corridas + FC de repouso + VO2 máx.) */
  summary(days: number): Promise<HealthSummary>;
  /** abre o app/loja para instalar ou ajustar permissões */
  openSettings(): void;
}
