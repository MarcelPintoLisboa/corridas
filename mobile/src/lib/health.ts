// Web (e qualquer plataforma sem integração): o Metro usa health.ios.ts / health.android.ts nos celulares.
import { summarize, type HealthProvider } from './health.types';

export type { HealthRun, HealthStatus, HealthProvider, HealthSummary } from './health.types';

export const health: HealthProvider = {
  name: 'Apple Saúde / Health Connect',
  source: 'apple_health',
  status: async () => 'unavailable',
  requestAccess: async () => false,
  listRuns: async () => [],
  summary: async (days) => summarize([], days, { restingHr: null, vo2max: null }),
  openSettings: () => {},
};
