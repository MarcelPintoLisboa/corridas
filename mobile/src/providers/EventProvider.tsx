import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';
import type { RaceEvent, Registration } from '@/lib/types';
import { colors } from '@/theme';

import { useAuth } from './AuthProvider';

const STORAGE_KEY = 'active-event-id';

interface EventCtx {
  registrations: Registration[];
  active: Registration | null;
  event: RaceEvent | null;
  accent: string;
  accent2: string;
  loading: boolean;
  setActiveEventId: (id: string) => void;
  reload: () => Promise<void>;
}

const Ctx = createContext<EventCtx | null>(null);

/** Mantém as inscrições do usuário e a corrida "ativa" (tema do app segue a corrida) */
export function EventProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    await Promise.resolve(); // evita setState síncrono dentro do effect
    if (!session) {
      setRegistrations([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('registrations')
      .select('*, event:events(*), distance:event_distances(*)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    const regs = ((data ?? []) as Registration[]).filter((r) => r.event);
    setRegistrations(regs);
    let stored: string | null = null;
    try {
      stored = await AsyncStorage.getItem(STORAGE_KEY);
    } catch {}
    const upcoming = [...regs].sort(
      (a, b) => new Date(a.event!.event_date).getTime() - new Date(b.event!.event_date).getTime(),
    );
    const next = upcoming.find((r) => new Date(r.event!.event_date) > new Date()) ?? upcoming[0];
    setActiveId(regs.some((r) => r.event_id === stored) ? stored : (next?.event_id ?? null));
    setLoading(false);
  }, [session]);

  useEffect(() => {
    // busca de dados quando a sessão muda: setState só ocorre após o await
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const value = useMemo<EventCtx>(() => {
    const active = registrations.find((r) => r.event_id === activeId) ?? null;
    return {
      registrations,
      active,
      event: active?.event ?? null,
      accent: active?.event?.primary_color ?? colors.primary,
      accent2: active?.event?.secondary_color ?? colors.secondary,
      loading,
      setActiveEventId: (id) => {
        setActiveId(id);
        AsyncStorage.setItem(STORAGE_KEY, id).catch(() => {});
      },
      reload,
    };
  }, [registrations, activeId, loading, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActiveEvent() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useActiveEvent must be used inside EventProvider');
  return ctx;
}
