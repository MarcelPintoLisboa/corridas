import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAsync } from '@/hooks/useAsync';
import { formatDate, formatTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Registration } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { useActiveEvent } from '@/providers/EventProvider';
import { alpha, colors, radius, themed } from '@/theme';

import { Badge, FadeIn, Muted, type IconName } from './ui';
import { t, tn } from '@/i18n';

export interface Atualizacao {
  id: string;
  event_id: string;
  tipo: 'publicacao' | 'patrocinador' | 'kit' | 'distancia' | 'dica' | 'plano' | 'corrida';
  acao: 'novo' | 'atualizado';
  titulo: string;
  detalhe: string | null;
  quando: string;
}

const META: Record<Atualizacao['tipo'], { label: string; icon: IconName; color: string; href: Href }> = themed(() => ({
  publicacao: { label: 'Publicação', icon: 'megaphone', color: colors.cyan, href: '/event' },
  patrocinador: { label: 'Patrocinador', icon: 'diamond', color: colors.lime, href: '/sponsors' },
  kit: { label: 'Retirada de kit', icon: 'cube', color: colors.warning, href: '/event' },
  distancia: { label: 'Distância', icon: 'trail-sign', color: colors.primary, href: '/event' },
  dica: { label: 'Dica', icon: 'bulb', color: colors.success, href: '/tips' },
  plano: { label: 'Plano de treino', icon: 'barbell', color: colors.secondary, href: '/training' },
  corrida: { label: 'Corrida', icon: 'flag', color: colors.primary, href: '/event' },
}));

const seenKey = (uid?: string) => `updates-seen-${uid ?? 'anon'}`;

/** Atualizações (novo/alterado) de todas as corridas associadas + controle do que já foi visto */
export function useUpdates(registrations: Registration[], limit = 30) {
  const { session } = useAuth();
  const uid = session?.user.id;
  const ids = registrations.map((r) => r.event_id);
  const [seenAt, setSeenAt] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(seenKey(uid))
        .then((v) => setSeenAt(v ?? '1970-01-01T00:00:00Z'))
        .catch(() => setSeenAt('1970-01-01T00:00:00Z'));
    }, [uid, setSeenAt]),
  );

  const q = useAsync(async () => {
    if (!ids.length) return [] as Atualizacao[];
    const { data, error } = await supabase.from('st_atualizacoes').select('*').in('event_id', ids).order('quando', { ascending: false }).limit(limit);
    return error ? ([] as Atualizacao[]) : (data as Atualizacao[]);
  }, [ids.join(','), limit]);

  const { reload } = q;
  useFocusEffect(
    useCallback(() => {
      reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const markSeen = useCallback(() => {
    const now = new Date().toISOString();
    setSeenAt(now);
    AsyncStorage.setItem(seenKey(uid), now).catch(() => {});
  }, [uid, setSeenAt]);

  const items = q.data ?? [];
  const unread = seenAt ? items.filter((u) => u.quando > seenAt).length : 0;
  return { items, unread, seenAt, markSeen, reload: q.reload, refresh: q.refresh, loading: q.loading };
}

export function UpdatesList({ items, seenAt, registrations, onOpen }: {
  items: Atualizacao[];
  seenAt: string | null;
  registrations: Registration[];
  onOpen?: () => void;
}) {
  const { setActiveEventId } = useActiveEvent();
  const byId = new Map(registrations.map((r) => [r.event_id, r.event]));
  const multi = registrations.length > 1;

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: 12 }}>
      {items.map((u, i) => {
        const m = META[u.tipo];
        const e = byId.get(u.event_id);
        const fresh = !!seenAt && u.quando > seenAt;
        return (
          <FadeIn key={u.id} delay={Math.min(i, 8) * 40}>
            <Pressable
              onPress={() => {
                setActiveEventId(u.event_id);
                onOpen?.();
                router.push(m.href);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: colors.border,
                backgroundColor: fresh ? alpha(m.color, 0.07) : 'transparent',
                opacity: pressed ? 0.7 : 1,
              })}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: alpha(m.color, 0.18), alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={m.icon} size={19} color={m.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: m.color, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                  {t(u.acao === 'novo' ? 'Novo' : 'Atualizado')} · {t(m.label)}
                  {multi && e ? ` · ${e.name}` : ''}
                </Text>
                <Text style={{ color: colors.text, fontWeight: '800' }} numberOfLines={1}>
                  {t(u.titulo)}
                </Text>
                {u.detalhe ? (
                  <Muted style={{ fontSize: 12 }} numberOfLines={1}>
                    {translateDetail(u.detalhe)}
                  </Muted>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                {fresh ? <Badge label="Novo" color={colors.primary} /> : null}
                <Text style={{ color: colors.textDim, fontSize: 11 }}>{whenLabel(u.quando)}</Text>
              </View>
            </Pressable>
          </FadeIn>
        );
      })}
    </View>
  );
}

/** detalhes gerados no banco (ex.: "8 semanas · Coach") */
function translateDetail(d: string) {
  return t(d).replace(/^(d+) semanas/, (_, n) => tn(Number(n), '{n} semana', '{n} semanas'));
}

function whenLabel(iso: string) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 60000;
  if (diff < 1) return t('agora');
  if (diff < 60) return `${Math.floor(diff)} min`;
  if (diff < 60 * 24 && d.getDate() === new Date().getDate()) return formatTime(d);
  return formatDate(d, true);
}
