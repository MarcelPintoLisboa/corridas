import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';

import { api } from '@/lib/api';
import { scheduleSessions } from '@/lib/plan';
import { useAuth } from '@/providers/AuthProvider';
import { useActiveEvent } from '@/providers/EventProvider';

import { useAsync } from './useAsync';

/** Plano do participante para a corrida ativa + treinos realizados */
export function useTraining() {
  const { session } = useAuth();
  const { active, event } = useActiveEvent();
  const uid = session?.user.id;

  const q = useAsync(async () => {
    if (!uid) return null;
    const [planData, workouts] = await Promise.all([
      active ? api.planFor(active) : Promise.resolve(null),
      api.workouts(uid, active?.event_id),
    ]);
    return { planData, workouts };
  }, [uid, active?.event_id, active?.distance_id, active?.level]);

  // recarrega ao voltar para a tela (ex.: após registrar um treino)
  const { reload } = q;
  useFocusEffect(
    useCallback(() => {
      reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const scheduled = useMemo(() => {
    if (!q.data?.planData || !event) return [];
    return scheduleSessions(q.data.planData.sessions, q.data.planData.plan.weeks, event.event_date, q.data.workouts);
  }, [q.data, event]);

  return {
    loading: q.loading,
    refreshing: q.refreshing,
    refresh: q.refresh,
    reload: q.reload,
    plan: q.data?.planData?.plan ?? null,
    scheduled,
    workouts: q.data?.workouts ?? [],
  };
}
