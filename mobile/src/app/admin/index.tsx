import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BackHeader } from '@/components/Header';
import { Badge, EmptyState, FadeIn, GradientButton, Loading, Muted, Screen } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { formatDate } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';
import type { RaceEvent } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { alpha, colors, font, radius } from '@/theme';

const statusMeta = {
  draft: { label: 'Rascunho', color: colors.warning },
  published: { label: 'Publicado', color: colors.success },
  finished: { label: 'Finalizado', color: colors.textMuted },
  canceled: { label: 'Cancelado', color: colors.danger },
};

export default function AdminHome() {
  const { session, isAdmin } = useAuth();
  const q = useAsync(async () => {
    // RLS: admin vê tudo; organizador vê os que gerencia (+ publicados)
    const rows = unwrap(await supabase.from('events').select('*').order('event_date', { ascending: false })) as RaceEvent[];
    if (isAdmin) return rows;
    const { data: staff } = await supabase.from('event_staff').select('event_id').eq('user_id', session!.user.id);
    const ids = new Set((staff ?? []).map((s) => s.event_id));
    return rows.filter((e) => e.organizer_id === session!.user.id || ids.has(e.id));
  }, [isAdmin]);

  const { reload } = q;
  useFocusEffect(
    useCallback(() => {
      reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  if (q.loading) return <Loading />;

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh} bottomInset={false}>
      <BackHeader title="Painel do organizador" />
      <Muted style={{ marginBottom: 16 }}>Gerencie suas corridas, publicações, patrocinadores e leads.</Muted>
      <GradientButton title="Nova corrida" icon="add" colorsPair={[colors.lime, colors.cyan]} onPress={() => router.push('/admin/event-form')} style={{ marginBottom: 20 }} />

      {!q.data?.length ? <EmptyState icon="flag" title="Nenhuma corrida ainda" message="Crie sua primeira corrida e personalize com imagem, cores e informações." /> : null}

      {q.data?.map((e, i) => (
        <FadeIn key={e.id} delay={i * 60}>
          <Pressable onPress={() => router.push(`/admin/event/${e.id}`)} style={{ height: 130, borderRadius: radius.lg, overflow: 'hidden', marginBottom: 12 }}>
            {e.cover_image_url ? <Image source={e.cover_image_url} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" /> : null}
            <LinearGradient colors={[alpha(e.secondary_color, 0.5), alpha(e.primary_color, 0.95)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
              <Badge label={statusMeta[e.status].label} color={statusMeta[e.status].color} />
              <View>
                <Text style={[font.h2, { color: '#fff' }]}>{e.name}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.85)' }}>{formatDate(e.event_date, true)} · {e.city ?? ''}</Text>
              </View>
            </LinearGradient>
          </Pressable>
        </FadeIn>
      ))}
    </Screen>
  );
}
