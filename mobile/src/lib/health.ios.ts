import {
  WorkoutActivityType,
  getMostRecentQuantitySample,
  isHealthDataAvailable,
  queryWorkoutSamples,
  requestAuthorization,
  type ObjectTypeIdentifier,
} from '@kingstinct/react-native-healthkit';
import { Linking } from 'react-native';

import { summarize, type HealthProvider, type HealthRun } from './health.types';

export type { HealthRun, HealthStatus, HealthProvider, HealthSummary } from './health.types';

const READ: ObjectTypeIdentifier[] = [
  'HKWorkoutTypeIdentifier',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierVO2Max',
];

/** quantidade de distância → km (o Saúde pode devolver m, km ou mi) */
function toKm(q?: { unit: string; quantity: number }) {
  if (!q) return 0;
  if (q.unit === 'km') return q.quantity;
  if (q.unit === 'mi') return q.quantity * 1.609344;
  return q.quantity / 1000; // m
}

function toSeconds(q?: { unit: string; quantity: number }) {
  if (!q) return 0;
  if (q.unit === 'min') return q.quantity * 60;
  if (q.unit === 'hr' || q.unit === 'h') return q.quantity * 3600;
  return q.quantity; // s
}

function toKcal(q?: { unit: string; quantity: number }) {
  if (!q) return null;
  if (q.unit === 'kJ') return Math.round(q.quantity / 4.184);
  return Math.round(q.quantity); // kcal / Cal
}

export const health: HealthProvider = {
  name: 'Apple Saúde',
  source: 'apple_health',

  async status() {
    try {
      return isHealthDataAvailable() ? 'available' : 'unavailable';
    } catch {
      return 'unavailable';
    }
  },

  async requestAccess() {
    // sem a permissão de HealthKit no app (ex.: instalado com Apple ID gratuito) o pedido falha
    await requestAuthorization({ toRead: READ });
    return true;
  },

  async listRuns(days) {
    const since = new Date(Date.now() - days * 86_400_000);
    const workouts = await queryWorkoutSamples({
      limit: 60,
      ascending: false,
      filter: { workoutActivityType: WorkoutActivityType.running, date: { startDate: since } },
    });
    const runs: HealthRun[] = [];
    for (const w of workouts) {
      try {
        const [hr, elev] = await Promise.all([
          w.getStatistic('HKQuantityTypeIdentifierHeartRate', 'count/min').catch(() => undefined),
          Promise.resolve(w.metadata?.HKElevationAscended as { quantity?: number } | number | undefined),
        ]);
        const meta = (w.metadata ?? {}) as Record<string, unknown>;
        runs.push({
          externalId: w.uuid,
          source: 'apple_health',
          start: new Date(w.startDate),
          end: new Date(w.endDate),
          distanceKm: toKm(w.totalDistance),
          durationSec: Math.round(toSeconds(w.duration)),
          avgHr: hr?.averageQuantity ? Math.round(hr.averageQuantity.quantity) : null,
          maxHr: hr?.maximumQuantity ? Math.round(hr.maximumQuantity.quantity) : null,
          calories: toKcal(w.totalEnergyBurned),
          elevationM: typeof elev === 'number' ? Math.round(elev) : elev?.quantity != null ? Math.round(elev.quantity) : null,
          treadmill: meta.HKIndoorWorkout === true || meta.HKIndoorWorkout === 1,
          deviceName: w.sourceRevision?.source?.name ?? null,
        });
      } finally {
        w.dispose();
      }
    }
    return runs;
  },

  async summary(days) {
    const [runs, rhr, vo2] = await Promise.all([
      this.listRuns(days),
      getMostRecentQuantitySample('HKQuantityTypeIdentifierRestingHeartRate', 'count/min').catch(() => undefined),
      getMostRecentQuantitySample('HKQuantityTypeIdentifierVO2Max', 'ml/(kg*min)').catch(() => undefined),
    ]);
    return summarize(runs, days, {
      restingHr: rhr?.quantity ? Math.round(rhr.quantity) : null,
      vo2max: vo2?.quantity ? Math.round(vo2.quantity * 10) / 10 : null,
    });
  },

  openSettings() {
    Linking.openURL('x-apple-health://').catch(() => Linking.openSettings());
  },
};
