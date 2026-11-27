import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { EvolutionChart, WeeklyBars } from '@/components/charts';
import { Card, Chip, EmptyState, GradientButton, IconButton, Loading, Muted, Screen, SectionHeader, Stat, Title } from '@/components/ui';
import { useTraining } from '@/hooks/useTraining';
import { formatDate, formatDuration, formatKm, formatPace } from '@/lib/format';
import { buildHistory, type HistoryMode as Mode } from '@/lib/plan';
import { useActiveEvent } from '@/providers/EventProvider';
import { alpha, colors, font, radius } from '@/theme';
import { t } from '@/i18n';


export default function ResultsScreen() {
  const { width } = useWindowDimensions();
  const { accent, accent2, event } = useActiveEvent();
  const { workouts, loading, refreshing, refresh } = useTraining();
  const [mode, setMode] = useState<Mode>('pace');

  const stats = useMemo(() => {
    const total = workouts.reduce((a, w) => a + Number(w.distance_km), 0);
    const time = workouts.reduce((a, w) => a + w.duration_seconds, 0);
    const paces = workouts.map((w) => w.avg_pace_seconds ?? Infinity);
    const best = Math.min(...paces);
    const longest = Math.max(0, ...workouts.map((w) => Number(w.distance_km)));
    const first = workouts[0]?.avg_pace_seconds;
    const last = workouts[workouts.length - 1]?.avg_pace_seconds;
    return { total, time, best: isFinite(best) ? best : null, longest, avg: total ? time / total : null, delta: first && last ? first - last : null };
  }, [workouts]);

  // km por semana (últimas 8)
  const weekly = useMemo(() => {
    const now = new Date();
    const arr = Array.from({ length: 8 }, () => 0);
    workouts.forEach((w) => {
      const diff = Math.floor((now.getTime() - new Date(w.performed_at).getTime()) / (7 * 86_400_000));
      if (diff >= 0 && diff < 8) arr[7 - diff] += Number(w.distance_km);
    });
    return arr;
  }, [workouts]);

  if (loading) return <Loading />;

  if (!workouts.length) {
    return (
      <Screen>
        <Title>Evolução</Title>
        <EmptyState icon="stats-chart" title="Comece a registrar" message="Registre seus treinos para acompanhar a evolução do pace e gerar posts incríveis para o Instagram." action="Registrar primeiro treino" onAction={() => router.push('/workout/new')} />
        <GradientButton title="Importar do relógio" icon="watch" variant="ghost" colorsPair={[accent, accent2]} onPress={() => router.push('/health-import')} style={{ marginTop: 12 }} />
      </Screen>
    );
  }

  const history = buildHistory(workouts, mode);
  const fmtY = mode === 'pace' ? (v: number) => formatPace(v * 60) : (v: number) => v.toFixed(0);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Title>Evolução</Title>
          <Muted>{event ? t('Rumo à {name}', { name: event.name }) : t('Seus treinos')}</Muted>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IconButton icon="watch" color={accent} onPress={() => router.push('/health-import')} />
          <GradientButton small title="Treino" icon="add" onPress={() => router.push('/workout/new')} colorsPair={[accent, accent2]} />
        </View>
      </View>

      <Card delay={50} style={{ marginTop: 16 }}>
        <View style={{ flexDirection: 'row', marginBottom: 16 }}>
          <Stat label="Total" value={formatKm(stats.total)} unit="km" color={accent} />
          <Stat label="Tempo" value={formatDuration(stats.time)} />
          <Stat label="Treinos" value={String(workouts.length)} />
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Stat label="Melhor pace" value={formatPace(stats.best)} unit="/km" color={colors.lime} />
          <Stat label="Pace médio" value={formatPace(stats.avg)} unit="/km" />
          <Stat label="Mais longo" value={formatKm(stats.longest)} unit="km" />
        </View>
        {stats.delta && stats.delta > 0 ? (
          <View style={{ marginTop: 14, backgroundColor: alpha(colors.success, 0.12), borderRadius: radius.md, padding: 10, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Ionicons name="trending-up" size={18} color={colors.success} />
            <Text style={{ color: colors.success, fontWeight: '700', flex: 1 }}>
              {t('Seu pace melhorou {pace} /km desde o primeiro treino! 🚀', { pace: formatPace(stats.delta) })}
            </Text>
          </View>
        ) : null}
      </Card>

      <Card delay={120}>
        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          <Chip label="Pace" active={mode === 'pace'} color={accent} onPress={() => setMode('pace')} />
          <Chip label="Km acumulado" active={mode === 'km'} color={accent} onPress={() => setMode('km')} />
          <Chip label="Distância" active={mode === 'distance'} color={accent} onPress={() => setMode('distance')} />
        </View>
        <EvolutionChart data={history} width={width - 66} height={190} color={accent} color2={accent2} invert={mode === 'pace'} formatY={fmtY} />
        <Muted style={{ fontSize: 12, marginTop: 6 }}>
          {t(mode === 'pace' ? 'Quanto mais alto, mais rápido ⚡' : mode === 'km' ? 'Volume acumulado até a prova' : 'Distância de cada treino')}
        </Muted>
      </Card>

      <Card delay={180}>
        <Text style={[font.h3, { color: colors.text, marginBottom: 12 }]}>{t('Km por semana')}</Text>
        <WeeklyBars values={weekly} labels={weekly.map((_, i) => (i === 7 ? t('Atual') : `-${7 - i}`))} width={width - 66} color={accent} />
      </Card>

      <SectionHeader title="Histórico" />
      {[...workouts].reverse().map((w, i) => (
        <Card key={w.id} delay={220 + i * 40} onPress={() => router.push(`/workout/${w.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {w.photo_url ? (
            <Image source={w.photo_url} style={{ width: 54, height: 54, borderRadius: 14 }} />
          ) : (
            <View style={{ width: 54, height: 54, borderRadius: 14, backgroundColor: alpha(accent, 0.15), alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={w.is_race ? 'trophy' : 'walk'} size={24} color={accent} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[font.h3, { color: colors.text }]}>{w.title ?? t('Treino')}</Text>
            <Muted style={{ fontSize: 12 }}>
              {formatDate(w.performed_at, true)}
              {w.source && w.source !== 'manual' ? ` · ⌚ ${(w.source === 'strava' ? 'Strava' : t(w.source === 'apple_health' ? 'Apple Watch / Saúde' : 'Relógio'))}` : ''}
            </Muted>
            <Text style={{ color: colors.text, fontWeight: '800', marginTop: 2 }}>
              {formatKm(w.distance_km, 2)} km · {formatDuration(w.duration_seconds)} · {formatPace(w.avg_pace_seconds)}/km
              {w.avg_hr ? <Text style={{ color: colors.primary }}>{`  ♥ ${w.avg_hr}`}</Text> : null}
            </Text>
          </View>
          <Pressable onPress={() => router.push(`/workout/${w.id}`)} hitSlop={10}>
            <Ionicons name={w.shared_instagram ? 'checkmark-circle' : 'logo-instagram'} size={24} color={w.shared_instagram ? colors.success : '#E1306C'} />
          </Pressable>
        </Card>
      ))}
    </Screen>
  );
}
