import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn as RFadeIn, FadeOut } from 'react-native-reanimated';

import { AnamneseCard } from '@/components/AnamneseCard';
import { SessionCard } from '@/components/SessionCard';
import { Avatar, Badge, Card, Chip, EmptyState, Loading, Muted, Screen, SectionHeader, Title } from '@/components/ui';
import { useTraining } from '@/hooks/useTraining';
import { formatDuration, formatKm, levelLabel } from '@/lib/format';
import { currentWeek } from '@/lib/plan';
import { useActiveEvent } from '@/providers/EventProvider';
import { alpha, colors, font, radius } from '@/theme';
import { t, tn } from '@/i18n';

export default function TrainingScreen() {
  const { event, active, accent, accent2 } = useActiveEvent();
  const { plan, scheduled, loading, refreshing, refresh } = useTraining();
  const [week, setWeek] = useState<number | null>(null);

  const nowWeek = plan ? currentWeek(scheduled, plan.weeks) : 1;

  if (loading) return <Loading />;

  if (!event || !active) {
    return (
      <Screen>
        <Title>Treino</Title>
        <EmptyState icon="barbell" title="Sem corrida ainda" message="Quando o organizador associar você a uma corrida, ela aparece aqui. O plano de treino vem junto." />
      </Screen>
    );
  }

  if (!plan) {
    return (
      <Screen refreshing={refreshing} onRefresh={refresh}>
        <Title>Treino</Title>
        <View style={{ height: 12 }} />
        <AnamneseCard />
        <EmptyState icon="time" title="Plano em preparação" message="Responda a anamnese para gerar agora um plano só seu, ou aguarde o plano dos treinadores da prova." />
      </Screen>
    );
  }

  const selected = week ?? nowWeek;
  const weekSessions = scheduled.filter((s) => s.week === selected);
  const weekKm = weekSessions.reduce((a, s) => a + Number(s.distance_km ?? 0), 0);
  const weekDone = weekSessions.filter((s) => s.done && s.type !== 'rest').length;
  const weekTotal = weekSessions.filter((s) => s.type !== 'rest').length;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Title>Seu plano</Title>
      <Muted style={{ marginBottom: 16 }}>{t('Personalizado para {name}', { name: event.name })}</Muted>
      <AnamneseCard compact={!!plan.user_id} />

      <Card animated={false} style={{ padding: 0, overflow: 'hidden' }}>
        <LinearGradient colors={[alpha(accent, 0.35), alpha(accent2, 0.25)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <Badge label={active.distance?.label ?? 'Distância'} color={colors.lime} />
            <Badge label={plan.user_id ? t('Plano pessoal') : levelLabel[active.level]} color={colors.text} />
            <Badge label={tn(plan.weeks, '{n} semana', '{n} semanas')} color={colors.cyan} />
          </View>
          <Text style={[font.h2, { color: colors.text }]}>{plan.name}</Text>
          {plan.description ? <Text style={{ color: colors.textMuted, marginTop: 4 }}>{plan.description}</Text> : null}
          {plan.coach_name ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
              <Avatar uri={plan.coach_avatar_url} name={plan.coach_name} size={34} />
              <View>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{plan.coach_name}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('Treinador(a) responsável')}</Text>
              </View>
            </View>
          ) : null}
          {active.goal_time_seconds ? (
            <Text style={{ color: colors.lime, fontWeight: '800', marginTop: 10 }}>🎯 {t('Meta')}: {formatDuration(active.goal_time_seconds)}</Text>
          ) : null}
        </LinearGradient>
      </Card>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
        {Array.from({ length: plan.weeks }, (_, i) => i + 1).map((w) => (
          <Chip key={w} label={w === plan.weeks ? t('🏁 Prova') : `${t('Sem')} ${w}${w === nowWeek ? ' •' : ''}`} active={w === selected} color={accent} onPress={() => setWeek(w)} />
        ))}
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
        <MiniStat icon="map" label="Volume" value={`${formatKm(weekKm)} km`} color={accent} />
        <MiniStat icon="checkmark-done" label="Feitos" value={`${weekDone}/${weekTotal}`} color={colors.success} />
      </View>

      <SectionHeader title={selected === plan.weeks ? t('Semana da prova') : t('Semana {n}', { n: selected })} action="Dicas" onAction={() => router.push('/tips')} />
      <Animated.View key={selected} entering={RFadeIn.duration(300)} exiting={FadeOut.duration(150)}>
        {weekSessions.map((s) => (
          <SessionCard key={s.id} s={s} />
        ))}
      </Animated.View>
    </Screen>
  );
}

function MiniStat({ icon, label, value, color }: { icon: 'map' | 'checkmark-done'; label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.border }}>
      <Ionicons name={icon} size={20} color={color} />
      <View>
        <Text style={[font.tiny, { color: colors.textMuted, fontSize: 9 }]}>{t(label)}</Text>
        <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16 }}>{value}</Text>
      </View>
    </View>
  );
}
