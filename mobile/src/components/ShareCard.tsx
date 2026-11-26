import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentRef, Ref } from 'react';
import { Text, View } from 'react-native';

import { formatDate, formatDuration, formatKm, formatPace } from '@/lib/format';
import type { RaceEvent, Workout } from '@/lib/types';

import { EvolutionChart, type ChartPoint } from './charts';
import { t, tn } from '@/i18n';

const APP_LOGO = require('../../assets/images/logo.png');

export type ShareMetric = 'distance' | 'time' | 'pace' | 'chart';

export type ShareCardRef = ComponentRef<typeof View>;

interface Props {
  ref?: Ref<ShareCardRef>;
  workout: Workout;
  event: RaceEvent | null;
  history: ChartPoint[];
  photoUri?: string | null;
  width: number;
  athleteName?: string | null;
  daysToRace?: number | null;
  show: Record<ShareMetric, boolean>;
  chartMode: 'pace' | 'km';
}

/**
 * Arte 9:16 (formato Stories) capturada pelo react-native-view-shot.
 * Foto de fundo + métricas + gráfico da evolução até a prova.
 */
export function ShareCard({ ref, workout, event, history, photoUri, width, athleteName, daysToRace, show, chartMode }: Props) {
  const height = width * (16 / 9);
  const c1 = event?.primary_color ?? '#FF4D2E';
  const c2 = event?.secondary_color ?? '#7B2FF7';
  const s = width / 360; // escala tipográfica

  return (
    <View ref={ref} collapsable={false} style={{ width, height, backgroundColor: '#000', overflow: 'hidden', borderRadius: 18 * s }}>
      {photoUri ? (
        <Image source={photoUri} style={{ position: 'absolute', width, height }} contentFit="cover" />
      ) : (
        <LinearGradient colors={[c2, '#0A0A12', c1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', width, height }} />
      )}
      <LinearGradient colors={['rgba(0,0,0,0.55)', 'transparent', 'rgba(0,0,0,0.92)']} locations={[0, 0.35, 0.7]} style={{ position: 'absolute', width, height }} />

      {/* Topo: evento */}
      <View style={{ padding: 20 * s, flexDirection: 'row', alignItems: 'center', gap: 10 * s }}>
        {/* ícone da corrida cadastrado no admin (sem ícone: logo do Street Running) */}
        <View style={{ width: 58 * s, height: 58 * s, borderRadius: 16 * s, backgroundColor: '#fff', padding: 4 * s, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 }}>
          <Image source={event?.logo_url ? { uri: event.logo_url } : APP_LOGO} style={{ width: '100%', height: '100%', borderRadius: 12 * s }} contentFit="contain" cachePolicy="memory-disk" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 * s }} numberOfLines={1}>
            {event?.name ?? t('Meu treino')}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 * s, fontWeight: '600' }}>
            {formatDate(workout.performed_at)}
            {daysToRace != null && daysToRace > 0 ? `  ·  ${tn(daysToRace, 'falta {n} dia', 'faltam {n} dias')}` : ''}
          </Text>
        </View>
        <View style={{ backgroundColor: c1, paddingHorizontal: 10 * s, paddingVertical: 5 * s, borderRadius: 99 }}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 10 * s, letterSpacing: 1 }}>{t(workout.is_race ? 'PROVA' : 'TREINO')}</Text>
        </View>
      </View>

      {/* Base: métricas */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 22 * s }}>
        {show.distance ? (
          <View style={{ marginBottom: 8 * s }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 * s, fontWeight: '800', letterSpacing: 2 }}>{t('DISTÂNCIA')}</Text>
            <Text style={{ color: '#fff', fontSize: 64 * s, fontWeight: '900', letterSpacing: -2, lineHeight: 68 * s }}>
              {formatKm(workout.distance_km, 2)}
              <Text style={{ fontSize: 22 * s, color: c1 }}> km</Text>
            </Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 24 * s, marginBottom: 14 * s }}>
          {show.time ? <Metric label={t('TEMPO')} value={formatDuration(workout.duration_seconds)} s={s} /> : null}
          {show.pace ? <Metric label="PACE" value={`${formatPace(workout.avg_pace_seconds)}/km`} s={s} /> : null}
        </View>

        {show.chart && history.length > 1 ? (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14 * s, padding: 10 * s, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10 * s, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 * s }}>
              {t(chartMode === 'pace' ? 'EVOLUÇÃO DO PACE' : 'KM ACUMULADOS')} · {t('{n} TREINOS', { n: history.length })}
            </Text>
            <EvolutionChart
              data={history}
              width={width - 64 * s}
              height={90 * s}
              color={c1}
              color2={c2}
              invert={chartMode === 'pace'}
              showLabels={false}
            />
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 * s }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 * s }}>{athleteName ?? ''}</Text>
          <Text style={{ color: c1, fontWeight: '900', fontSize: 12 * s }}>{event?.hashtag ?? '#RumoAProva'}</Text>
        </View>
      </View>
    </View>
  );
}

function Metric({ label, value, s }: { label: string; value: string; s: number }) {
  return (
    <View>
      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 * s, fontWeight: '800', letterSpacing: 2 }}>{label}</Text>
      <Text style={{ color: '#fff', fontSize: 28 * s, fontWeight: '900' }}>{value}</Text>
    </View>
  );
}
