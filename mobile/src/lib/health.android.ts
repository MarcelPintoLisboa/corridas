import { Linking } from 'react-native';
import {
  ExerciseType,
  SdkAvailabilityStatus,
  aggregateRecord,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
} from 'react-native-health-connect';

import { summarize, type HealthProvider, type HealthRun } from './health.types';

export type { HealthRun, HealthStatus, HealthProvider, HealthSummary } from './health.types';

const RUN_TYPES: number[] = [ExerciseType.RUNNING, ExerciseType.RUNNING_TREADMILL];

let ready = false;
async function ensureInit() {
  if (!ready) ready = await initialize();
  return ready;
}

export const health: HealthProvider = {
  name: 'Health Connect',
  source: 'health_connect',

  async status() {
    try {
      const s = await getSdkStatus();
      if (s === SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
      if (s === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'needs_install';
      return 'unavailable';
    } catch {
      return 'unavailable';
    }
  },

  async requestAccess() {
    if (!(await ensureInit())) return false;
    const granted = await requestPermission([
      { accessType: 'read', recordType: 'ExerciseSession' },
      { accessType: 'read', recordType: 'Distance' },
      { accessType: 'read', recordType: 'HeartRate' },
      { accessType: 'read', recordType: 'TotalCaloriesBurned' },
      { accessType: 'read', recordType: 'RestingHeartRate' },
      { accessType: 'read', recordType: 'Vo2Max' },
    ]);
    return granted.some((p) => 'recordType' in p && p.recordType === 'ExerciseSession');
  },

  async listRuns(days) {
    if (!(await ensureInit())) return [];
    const endTime = new Date().toISOString();
    const startTime = new Date(Date.now() - days * 86_400_000).toISOString();
    const { records } = await readRecords('ExerciseSession', { timeRangeFilter: { operator: 'between', startTime, endTime } });
    const sessions = records.filter((r) => RUN_TYPES.includes(r.exerciseType));

    const runs: HealthRun[] = [];
    for (const r of sessions) {
      const range = { operator: 'between' as const, startTime: r.startTime, endTime: r.endTime };
      const [dist, hr, cal] = await Promise.all([
        aggregateRecord({ recordType: 'Distance', timeRangeFilter: range }).catch(() => null),
        aggregateRecord({ recordType: 'HeartRate', timeRangeFilter: range }).catch(() => null),
        aggregateRecord({ recordType: 'TotalCaloriesBurned', timeRangeFilter: range }).catch(() => null),
      ]);
      const start = new Date(r.startTime);
      const end = new Date(r.endTime);
      runs.push({
        externalId: r.metadata?.id ?? `${r.startTime}`,
        source: 'health_connect',
        start,
        end,
        distanceKm: (dist?.DISTANCE?.inMeters ?? 0) / 1000,
        durationSec: Math.round((end.getTime() - start.getTime()) / 1000),
        avgHr: hr?.BPM_AVG ? Math.round(hr.BPM_AVG) : null,
        maxHr: hr?.BPM_MAX ? Math.round(hr.BPM_MAX) : null,
        calories: cal?.ENERGY_TOTAL?.inKilocalories ? Math.round(cal.ENERGY_TOTAL.inKilocalories) : null,
        elevationM: null,
        treadmill: r.exerciseType === ExerciseType.RUNNING_TREADMILL,
        deviceName: r.metadata?.dataOrigin ?? null,
      });
    }
    return runs.sort((a, b) => b.start.getTime() - a.start.getTime());
  },

  async summary(days) {
    const endTime = new Date().toISOString();
    const startTime = new Date(Date.now() - days * 86_400_000).toISOString();
    const range = { operator: 'between' as const, startTime, endTime };
    const [runs, rhr, vo2] = await Promise.all([
      this.listRuns(days),
      readRecords('RestingHeartRate', { timeRangeFilter: range }).catch(() => null),
      readRecords('Vo2Max', { timeRangeFilter: range }).catch(() => null),
    ]);
    const lastRhr = rhr?.records.length ? rhr.records[rhr.records.length - 1].beatsPerMinute : null;
    const lastVo2 = vo2?.records.length ? vo2.records[vo2.records.length - 1].vo2MillilitersPerMinuteKilogram : null;
    return summarize(runs, days, {
      restingHr: lastRhr ? Math.round(lastRhr) : null,
      vo2max: lastVo2 ? Math.round(lastVo2 * 10) / 10 : null,
    });
  },

  openSettings() {
    try {
      openHealthConnectSettings();
    } catch {
      Linking.openURL('market://details?id=com.google.android.apps.healthdata').catch(() => {});
    }
  },
};
