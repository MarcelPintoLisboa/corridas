import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
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
      .from('st_registrations')
      .select('*, event:st_events(*), distance:st_event_distances(*)')
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

  // a corrida fecha X horas após a largada: recarrega ao voltar para o app e no minuto exato do fechamento
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') reload();
    });
    return () => sub.remove();
  }, [reload]);
  useEffect(() => {
    const now = Date.now();
    const closes = registrations
      .map((r) => (r.event?.acesso_horas_apos ? new Date(r.event.event_date).getTime() + r.event.acesso_horas_apos * 3600_000 : NaN))
      .filter((t) => t > now);
    if (!closes.length) return;
    const wait = Math.min(Math.min(...closes) - now + 5_000, 2 ** 31 - 1);
    const timer = setTimeout(() => reload(), wait);
    return () => clearTimeout(timer);
  }, [registrations, reload]);

  const value = useMemo<EventCtx>(() => {
    const active = registrations.find((r) => r.event_id === activeId) ?? null;
    return {
      registrations,
      active,
      event: active?.event ?? null,
      // destaque do app sempre no verde Corre+ (as cores da corrida não mudam mais a interface)
      accent: colors.primary,
      accent2: colors.secondary,
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
