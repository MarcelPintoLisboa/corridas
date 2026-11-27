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
import { alpha, brand, colors, font, radius, themed } from '@/theme';
import { t } from '@/i18n';

const statusMeta = themed(() => ({
  draft: { label: 'Rascunho', color: colors.warning },
  published: { label: 'Publicado', color: colors.success },
  finished: { label: 'Finalizado', color: colors.textMuted },
  canceled: { label: 'Cancelado', color: colors.textDim },
}));

export default function AdminHome() {
  const { isAdmin } = useAuth();
  // Admin organiza e vê todas as corridas (rascunhos inclusive)
  const q = useAsync(
    async () => unwrap(await supabase.from('st_events').select('*').order('event_date', { ascending: false })) as RaceEvent[],
    [isAdmin],
  );

  const { reload } = q;
  useFocusEffect(
    useCallback(() => {
      reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  if (q.loading) return <Loading />;

  function confirmDelete(e: RaceEvent) {
    Alert.alert(t('Excluir "{name}"?', { name: e.name }), t('Inscrições, treinos, patrocinadores, publicações e leads desta corrida serão removidos. Não dá para desfazer.'), [
      { text: t('Cancelar'), style: 'cancel' },
      {
        text: t('Excluir'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('st_events').delete().eq('id', e.id);
          if (error) return Alert.alert(t('Erro'), error.message);
          q.reload();
        },
      },
    ]);
  }

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh} bottomInset={false}>
      <BackHeader title="Corridas de rua" />
      <Muted style={{ marginBottom: 16 }}>Gerencie suas corridas, publicações, patrocinadores e leads.</Muted>
      <GradientButton title="Nova corrida" icon="add" onPress={() => router.push('/admin/event-form')} style={{ marginBottom: 10 }} />
      {isAdmin ? (
        <GradientButton title="Controle de acesso" icon="people" variant="ghost" onPress={() => router.push('/admin/users')} style={{ marginBottom: 20 }} />
      ) : (
        <View style={{ height: 10 }} />
      )}

      {!q.data?.length ? <EmptyState icon="flag" title="Nenhuma corrida ainda" message="Crie sua primeira corrida e personalize com imagem, cores e informações." /> : null}

      {q.data?.map((e, i) => (
        <FadeIn key={e.id} delay={i * 60}>
          <Pressable onPress={() => router.push(`/admin/event/${e.id}`)} style={{ height: 130, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, overflow: 'hidden' }}>
            {e.cover_image_url ? <Image source={e.cover_image_url} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" /> : null}
            <LinearGradient colors={[alpha(brand.pine, 0.5), alpha(brand.deep, 0.95)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
              <Badge label={statusMeta[e.status].label} color={statusMeta[e.status].color} />
              <View>
                <Text style={[font.h2, { color: '#fff' }]}>{e.name}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.85)' }}>{formatDate(e.event_date, true)} · {e.city ?? ''}</Text>
              </View>
            </LinearGradient>
          </Pressable>
          <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, borderWidth: 1, borderTopWidth: 0, borderColor: colors.border, marginBottom: 14 }}>
            <RowAction icon="speedometer-outline" label="Painel" onPress={() => router.push(`/admin/event/${e.id}`)} />
            <RowAction icon="create-outline" label="Editar" onPress={() => router.push(`/admin/event-form?id=${e.id}`)} />
            <RowAction icon="trash-outline" label="Excluir" color={colors.textMuted} onPress={() => confirmDelete(e)} />
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
      <Text style={{ color, fontWeight: '700', fontSize: 13 }}>{t(label)}</Text>
    </Pressable>
  );
}
