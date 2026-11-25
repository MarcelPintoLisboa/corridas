import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import type { IconName } from '@/components/ui';

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
    // RLS: admin vÃª tudo; organizador vÃª os que gerencia (+ publicados)
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

  function confirmDelete(e: RaceEvent) {
    Alert.alert(`Excluir "${e.name}"?`, 'InscriÃ§Ãµes, treinos, patrocinadores, publicaÃ§Ãµes e leads desta corrida serÃ£o removidos. NÃ£o dÃ¡ para desfazer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('events').delete().eq('id', e.id);
          if (error) return Alert.alert('Erro', error.message);
          q.reload();
        },
      },
    ]);
  }

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh} bottomInset={false}>
      <BackHeader title="Corridas de rua" />
      <Muted style={{ marginBottom: 16 }}>Gerencie suas corridas, publicaÃ§Ãµes, patrocinadores e leads.</Muted>
      <GradientButton title="Nova corrida" icon="add" colorsPair={[colors.lime, colors.cyan]} onPress={() => router.push('/admin/event-form')} style={{ marginBottom: 10 }} />
      {isAdmin ? (
        <GradientButton title="Administradores e acessos" icon="people" variant="ghost" colorsPair={[colors.lime, colors.cyan]} onPress={() => router.push('/admin/users')} style={{ marginBottom: 20 }} />
      ) : (
        <View style={{ height: 10 }} />
      )}

      {!q.data?.length ? <EmptyState icon="flag" title="Nenhuma corrida ainda" message="Crie sua primeira corrida e personalize com imagem, cores e informaÃ§Ãµes." /> : null}

      {q.data?.map((e, i) => (
        <FadeIn key={e.id} delay={i * 60}>
          <Pressable onPress={() => router.push(`/admin/event/${e.id}`)} style={{ height: 130, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, overflow: 'hidden' }}>
            {e.cover_image_url ? <Image source={e.cover_image_url} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" /> : null}
            <LinearGradient colors={[alpha(e.secondary_color, 0.5), alpha(e.primary_color, 0.95)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
              <Badge label={statusMeta[e.status].label} color={statusMeta[e.status].color} />
              <View>
                <Text style={[font.h2, { color: '#fff' }]}>{e.name}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.85)' }}>{formatDate(e.event_date, true)} Â· {e.city ?? ''}</Text>
              </View>
            </LinearGradient>
          </Pressable>
          <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, borderWidth: 1, borderTopWidth: 0, borderColor: colors.border, marginBottom: 14 }}>
            <RowAction icon="speedometer-outline" label="Painel" onPress={() => router.push(`/admin/event/${e.id}`)} />
            <RowAction icon="create-outline" label="Editar" onPress={() => router.push(`/admin/event-form?id=${e.id}`)} />
            <RowAction icon="trash-outline" label="Excluir" color={colors.danger} onPress={() => confirmDelete(e)} />
          </View>
        </FadeIn>
      ))}
    </Screen>
  );
}

function RowAction({ icon, label, onPress, color = colors.text }: { icon: IconName; label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}>
      <Ionicons name={icon} size={17} color={color} />
      <Text style={{ color, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}
