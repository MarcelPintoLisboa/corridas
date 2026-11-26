import * as Clipboard from 'expo-clipboard';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { Alert, Linking, Platform, Switch, Text, useWindowDimensions, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { BackHeader } from '@/components/Header';
import { ShareCard, type ShareCardRef, type ShareMetric } from '@/components/ShareCard';
import { Card, Chip, FadeIn, GradientButton, IconButton, Loading, Muted, Screen, SectionHeader } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { daysUntil, formatDuration, formatKm, formatPace } from '@/lib/format';
import { buildHistory } from '@/lib/plan';
import { supabase } from '@/lib/supabase';
import { pickImage } from '@/lib/upload';
import { useAuth } from '@/providers/AuthProvider';
import { useActiveEvent } from '@/providers/EventProvider';
import { colors } from '@/theme';
import { t, tn } from '@/i18n';

export default function WorkoutShare() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const { profile, session } = useAuth();
  const { registrations, accent, accent2 } = useActiveEvent();
  const cardRef = useRef<ShareCardRef>(null);
  const [show, setShow] = useState<Record<ShareMetric, boolean>>({ distance: true, time: true, pace: true, chart: true });
  const [chartMode, setChartMode] = useState<'pace' | 'km'>('pace');
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState<'share' | 'save' | null>(null);
  const [postedToFeed, setPostedToFeed] = useState(false);

  const q = useAsync(async () => {
    const workout = await api.workout(id);
    const all = await api.workouts(session!.user.id, workout.event_id);
    // histórico até este treino (o gráfico vai "incrementando" a cada post)
    const history = all.filter((w) => new Date(w.performed_at) <= new Date(workout.performed_at));
    return { workout, history };
  }, [id]);

  if (q.loading || !q.data) return <Loading />;
  const { workout, history } = q.data;
  const event = registrations.find((r) => r.event_id === workout.event_id)?.event ?? null;
  const cardWidth = Math.min(width - 64, 340);

  const caption = [
    `${workout.is_race ? '🏆' : '🏃'} ${workout.title ?? t('Treino')} — ${formatKm(workout.distance_km, 2)} km ${t('em')} ${formatDuration(workout.duration_seconds)} (${formatPace(workout.avg_pace_seconds)}/km)`,
    event ? `${t('Rumo à {name}', { name: event.name })}${daysUntil(event.event_date) > 0 ? ` — ${tn(daysUntil(event.event_date), 'falta {n} dia!', 'faltam {n} dias!')}` : ''}` : '',
    [event?.hashtag, event?.instagram_handle, t('#corrida #running #treino')].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join('\n');

  async function capture() {
    return captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile', width: 1080, height: 1920 });
  }

  async function onShare() {
    setBusy('share');
    try {
      const uri = await capture();
      await Clipboard.setStringAsync(caption);
      if (!(await Sharing.isAvailableAsync())) throw new Error(t('Compartilhamento indisponível neste dispositivo'));
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: t('Postar no Instagram') });
      await supabase.from('st_workouts').update({ shared_instagram: true }).eq('id', workout.id);
      q.setData({ ...q.data!, workout: { ...workout, shared_instagram: true } });
    } catch (e) {
      Alert.alert(t('Ops'), (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onSave() {
    setBusy('save');
    try {
      const { status } = await requestPermissionsAsync(true);
      if (status !== 'granted') throw new Error(t('Permita o acesso à galeria para salvar a imagem'));
      const uri = await capture();
      await Asset.create(uri);
      await Clipboard.setStringAsync(caption);
      Alert.alert(t('Salvo na galeria! 📸'), t('A legenda foi copiada. Abra o Instagram e poste nos Stories ou no Feed.'), [
        { text: t('Depois') },
        { text: t('Abrir Instagram'), onPress: () => Linking.openURL(Platform.OS === 'ios' ? 'instagram://story-camera' : 'instagram://camera').catch(() => {}) },
      ]);
    } catch (e) {
      Alert.alert(t('Ops'), (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onPostToFeed() {
    const { error } = await supabase.from('st_community_posts').insert({
      event_id: workout.event_id,
      body: `${workout.is_race ? '🏆' : '🏃'} ${workout.title ?? t('Treino')}${workout.notes ? ` — ${workout.notes}` : ''}`,
      image_url: workout.photo_url,
      workout_id: workout.id,
    });
    if (error) return Alert.alert(t('Não foi possível publicar'), error.message);
    setPostedToFeed(true);
    Alert.alert(t('Publicado! 🎉'), t('Seu treino está no mural da corrida.'), [{ text: 'OK' }, { text: t('Ver mural'), onPress: () => router.push('/community') }]);
  }

  async function onDelete() {
    Alert.alert(t('Excluir treino?'), t('Essa ação não pode ser desfeita.'), [
      { text: t('Cancelar'), style: 'cancel' },
      {
        text: t('Excluir'),
        style: 'destructive',
        onPress: async () => {
          await supabase.from('st_workouts').delete().eq('id', workout.id);
          router.back();
        },
      },
    ]);
  }

  const toggles: { key: ShareMetric; label: string }[] = [
    { key: 'distance', label: 'Distância' },
    { key: 'time', label: 'Tempo' },
    { key: 'pace', label: 'Pace' },
    { key: 'chart', label: 'Gráfico de evolução' },
  ];

  return (
    <Screen bottomInset={false}>
      <BackHeader title="Post do treino" right={<IconButton icon="trash-outline" color={colors.danger} onPress={onDelete} />} />

      <FadeIn>
        <View style={{ alignItems: 'center' }}>
          <ShareCard
            ref={cardRef}
            workout={workout}
            event={event}
            history={buildHistory(history, chartMode)}
            photoUri={localPhoto ?? workout.photo_url}
            width={cardWidth}
            athleteName={profile?.instagram ?? profile?.full_name}
            daysToRace={event ? daysUntil(event.event_date) : null}
            show={show}
            chartMode={chartMode}
          />
        </View>
      </FadeIn>

      <GradientButton title="Postar no Instagram" icon="logo-instagram" colorsPair={['#F58529', '#DD2A7B']} onPress={onShare} loading={busy === 'share'} style={{ marginTop: 20 }} />
      <GradientButton title="Salvar imagem na galeria" icon="download" variant="ghost" colorsPair={[accent, accent2]} onPress={onSave} loading={busy === 'save'} style={{ marginTop: 10 }} />
      {workout.event_id ? (
        <GradientButton
          title={postedToFeed ? 'Publicado no mural ✓' : 'Publicar no mural da corrida'}
          icon="people"
          variant="ghost"
          colorsPair={[colors.lime, colors.cyan]}
          disabled={postedToFeed}
          onPress={onPostToFeed}
          style={{ marginTop: 10 }}
        />
      ) : null}
      {workout.shared_instagram ? <Muted style={{ textAlign: 'center', marginTop: 8, color: colors.success }}>✓ Já compartilhado</Muted> : null}

      <SectionHeader title="Personalizar" />
      <Card animated={false}>
        {toggles.map((tg) => (
          <View key={tg.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>{t(tg.label)}</Text>
            <Switch value={show[tg.key]} onValueChange={(v) => setShow({ ...show, [tg.key]: v })} trackColor={{ true: accent }} />
          </View>
        ))}
        {show.chart ? (
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <Chip label="Evolução do pace" active={chartMode === 'pace'} color={accent} onPress={() => setChartMode('pace')} />
            <Chip label="Km acumulados" active={chartMode === 'km'} color={accent} onPress={() => setChartMode('km')} />
          </View>
        ) : null}
        <GradientButton
          small
          title="Trocar foto de fundo"
          icon="image"
          variant="ghost"
          colorsPair={[accent, accent2]}
          style={{ marginTop: 14 }}
          onPress={async () => {
            const a = await pickImage([9, 16]);
            if (a) setLocalPhoto(a.uri);
          }}
        />
      </Card>

      <Card animated={false}>
        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>{t('LEGENDA (copiada automaticamente)')}</Text>
        <Text style={{ color: colors.text }}>{caption}</Text>
      </Card>
      <View style={{ height: 30 }} />
    </Screen>
  );
}
