import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, EmptyState, IconButton, Loading, Muted, Screen, type IconName } from '@/components/ui';
import { useTraining } from '@/hooks/useTraining';
import { t, tn } from '@/i18n';
import { daysUntil, formatDate, formatDuration, formatKm, formatPace, sessionTypeMeta } from '@/lib/format';
import { isSameDay } from '@/lib/plan';
import { STEP_META, defaultWarmup, durationRange, sessionSteps, stepSummary } from '@/lib/steps';
import { useActiveEvent } from '@/providers/EventProvider';
import { alpha, colors, font, radius, onColor } from '@/theme';

/** Detalhe de uma sessão do plano: o que fazer, como aquecer, etapas (rua/esteira) e treinador */
export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { accent, accent2 } = useActiveEvent();
  const { scheduled, plan, loading } = useTraining();
  const [mode, setMode] = useState<'outdoor' | 'treadmill'>('outdoor');
  const [showWarmup, setShowWarmup] = useState(false);

  if (loading) return <Loading />;
  const s = scheduled.find((x) => x.id === id);
  if (!s) {
    return (
      <Screen bottomInset={false}>
        <IconButton icon="chevron-back" onPress={() => router.back()} />
        <EmptyState icon="barbell" title="Treino não encontrado" message="O plano pode ter sido alterado pela organização. Puxe a tela do plano para atualizar." />
      </Screen>
    );
  }

  const meta = sessionTypeMeta[s.type];
  const steps = sessionSteps(s);
  const range = durationRange(s);
  const isRest = s.type === 'rest';
  const today = isSameDay(s.date, new Date());
  const days = daysUntil(s.date.toISOString());
  const treadmill = mode === 'treadmill';

  const status = s.workout
    ? { icon: 'checkmark-circle' as IconName, color: colors.success, title: t('Treino realizado ✓'), text: `${formatKm(s.workout.distance_km, 2)} km · ${formatDuration(s.workout.duration_seconds)} · ${formatPace(s.workout.avg_pace_seconds)}/km` }
    : today
      ? { icon: 'today' as IconName, color: meta.color, title: t('Treino de hoje'), text: t('Bora! Registre quando terminar para acompanhar sua evolução.') }
      : days > 0
        ? { icon: 'calendar' as IconName, color: colors.cyan, title: t('Próximo treino'), text: tn(days, 'Disponível em {n} dia', 'Disponível em {n} dias') }
        : { icon: 'time' as IconName, color: colors.warning, title: t('Treino pendente'), text: t('Ainda dá para registrar se você fez este treino.') };

  const actions: { icon: IconName; label: string; onPress: () => void; on?: boolean }[] = [
    { icon: 'flame', label: 'Aquecimento', onPress: () => setShowWarmup(!showWarmup), on: showWarmup },
    { icon: 'add-circle', label: 'Registrar', onPress: () => logWorkout() },
    { icon: 'bulb', label: 'Dicas', onPress: () => router.push('/tips') },
    s.workout
      ? { icon: 'calendar', label: 'Plano', onPress: () => router.push('/training') }
      : { icon: 'watch', label: 'Relógio', onPress: () => router.push('/health-import') },
  ];

  function logWorkout() {
    if (s!.workout) return router.push(`/workout/${s!.workout.id}`);
    router.push({ pathname: '/workout/new', params: { sessionId: s!.id, title: s!.title, km: s!.distance_km ?? '' } });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
        {/* Cabeçalho na cor do tipo de treino */}
        <LinearGradient colors={[alpha(meta.color, 0.55), alpha(meta.color, 0.12), colors.bg]} style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconButton icon="chevron-back" bg="rgba(0,0,0,0.25)" onPress={() => (router.canGoBack() ? router.back() : router.replace('/training'))} />
            <Text style={[font.h2, { color: colors.text, flex: 1 }]}>{t('Semana {n}', { n: s.week })}</Text>
            <View style={{ width: 34, height: 34, borderRadius: 10, borderWidth: 2, borderColor: s.done ? colors.success : 'rgba(255,255,255,0.5)', backgroundColor: s.done ? colors.success : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {s.done ? <Ionicons name="checkmark" size={20} color="#000" /> : null}
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 26 }}>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13, letterSpacing: 0.5 }}>{(today ? t('HOJE') : formatDate(s.date, true)).toUpperCase()}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name={meta.icon as IconName} size={15} color={meta.color} />
              <Text style={{ color: meta.color, fontWeight: '900', fontSize: 13, letterSpacing: 0.5 }}>{meta.label.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={[font.hero, { color: colors.text, marginTop: 8 }]}>{s.title}</Text>
          {s.description ? <Text style={{ color: colors.textMuted, fontSize: 16, marginTop: 4 }}>{s.description}</Text> : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 18 }}>
            {range ? <Metric icon="timer-outline" value={range} /> : null}
            {s.distance_km ? <Metric icon="map-outline" value={`${formatKm(s.distance_km)} km`} /> : null}
            {s.target_pace ? <Metric icon="speedometer-outline" value={`${s.target_pace}/km`} /> : null}
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: 16 }}>
          {/* Situação do treino */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginTop: 16, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: alpha(status.color, 0.18), alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={status.icon} size={20} color={status.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>{status.title}</Text>
              <Muted style={{ fontSize: 13 }}>{status.text}</Muted>
            </View>
          </View>

          {/* Atalhos */}
          {!isRest ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 18, marginTop: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
              {actions.map((a) => (
                <Pressable key={a.label} onPress={a.onPress} style={({ pressed }) => ({ alignItems: 'center', width: 78, opacity: pressed ? 0.6 : 1 })}>
                  <View style={{ width: 54, height: 54, borderRadius: 27, borderWidth: 1.5, borderColor: a.on ? meta.color : colors.textMuted, backgroundColor: a.on ? alpha(meta.color, 0.18) : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={a.icon} size={22} color={a.on ? meta.color : colors.text} />
                  </View>
                  <Text style={{ color: colors.textMuted, fontWeight: '800', fontSize: 11, marginTop: 6, textAlign: 'center', letterSpacing: 0.3 }}>{t(a.label).toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* Aquecimento */}
          {showWarmup && !isRest ? (
            <View style={{ backgroundColor: alpha(STEP_META.warmup.color, 0.1), borderRadius: radius.lg, padding: 14, marginTop: 14, borderWidth: 1, borderColor: alpha(STEP_META.warmup.color, 0.4) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Ionicons name="flame" size={16} color={STEP_META.warmup.color} />
                <Text style={{ color: STEP_META.warmup.color, fontWeight: '900' }}>{t('Aquecimento')}</Text>
              </View>
              <Text style={{ color: colors.text, lineHeight: 21 }}>{s.warmup || defaultWarmup(s.type)}</Text>
            </View>
          ) : null}

          {isRest ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginTop: 16 }}>
              <Text style={{ color: colors.text, fontWeight: '800', marginBottom: 4 }}>{t('Dia de descanso 😴')}</Text>
              <Muted>{s.description || t('O descanso faz parte do treino: é quando o corpo se adapta e fica mais forte. Hidrate-se e durma bem.')}</Muted>
            </View>
          ) : (
            <>
              {/* Descrição: rua × esteira */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 22, marginBottom: 12 }}>
                <Ionicons name="document-text-outline" size={22} color={colors.text} />
                <Text style={[font.h2, { color: colors.text, flex: 1, marginLeft: 8 }]}>{t('Descrição')}</Text>
                <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 99, padding: 3 }}>
                  {(['outdoor', 'treadmill'] as const).map((m) => (
                    <Pressable key={m} onPress={() => setMode(m)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, backgroundColor: mode === m ? colors.text : 'transparent' }}>
                      <Text style={{ color: mode === m ? colors.bg : colors.textMuted, fontWeight: '800', fontSize: 12 }}>{t(m === 'outdoor' ? 'AO AR LIVRE' : 'ESTEIRA')}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
                <LinearGradient colors={[accent, accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingHorizontal: 14, paddingVertical: 8 }}>
                  <Text style={{ color: onColor(accent), fontWeight: '900' }}>{t(treadmill ? 'Treino na esteira' : 'Treino')}</Text>
                </LinearGradient>
                {steps.map((st, i) => {
                  const sm = STEP_META[st.kind] ?? STEP_META.run;
                  const summary = stepSummary(st, treadmill);
                  return (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingRight: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                      <Text style={{ width: 44, textAlign: 'center', color: colors.text, fontSize: 22, fontWeight: '900', fontStyle: 'italic' }}>{i + 1}</Text>
                      <View style={{ width: 2, alignSelf: 'stretch', backgroundColor: alpha(sm.color, 0.5), marginRight: 12, borderRadius: 1 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>
                          {st.repeat && st.repeat > 1 ? `${st.repeat}× ` : ''}
                          {st.title}
                        </Text>
                        {summary ? <Text style={{ color: sm.color, fontWeight: '700', marginTop: 2 }}>{summary}</Text> : null}
                        {st.note ? <Muted style={{ fontSize: 13, marginTop: 2 }}>{st.note}</Muted> : null}
                      </View>
                      <View style={{ alignItems: 'center', marginLeft: 8, width: 70 }}>
                        <Ionicons name={sm.icon as IconName} size={18} color={sm.color} />
                        <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800', marginTop: 2, textAlign: 'center' }}>{t(sm.label).toUpperCase()}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              {treadmill ? (
                <View style={{ flexDirection: 'row', gap: 10, backgroundColor: alpha(colors.cyan, 0.08), borderRadius: radius.md, padding: 12, marginTop: 10 }}>
                  <Ionicons name="information-circle" size={18} color={colors.cyan} />
                  <Muted style={{ flex: 1, fontSize: 13 }}>{s.treadmill_notes || t('Velocidades convertidas do pace da rua. Use 1% de inclinação para compensar a falta de vento.')}</Muted>
                </View>
              ) : null}
            </>
          )}

          {/* Treinador */}
          {plan?.coach_name ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 22, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Avatar uri={plan.coach_avatar_url} name={plan.coach_name} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{plan.coach_name}</Text>
                <Muted style={{ fontSize: 13 }}>{t('Treinador(a) responsável')}</Muted>
              </View>
            </View>
          ) : null}
          {plan?.description ? <Muted style={{ marginTop: 10, fontSize: 13 }}>{plan.description}</Muted> : null}
        </View>
      </ScrollView>

      {/* Botão fixo */}
      {!isRest ? (
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: Math.max(insets.bottom, 14) }}>
          <Pressable onPress={logWorkout} style={({ pressed }) => ({ borderRadius: 99, overflow: 'hidden', opacity: pressed ? 0.85 : 1 })}>
            <LinearGradient colors={s.workout ? [colors.success, colors.cyan] : [accent, accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 17 }}>
              <Ionicons name={s.workout ? 'logo-instagram' : 'play'} size={20} color={s.workout ? '#fff' : onColor(accent)} />
              <Text style={{ color: s.workout ? '#fff' : onColor(accent), fontWeight: '900', fontSize: 17 }}>{t(s.workout ? 'Ver post do treino' : 'Registrar este treino')}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Metric({ icon, value }: { icon: IconName; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Ionicons name={icon} size={22} color={colors.text} />
      <Text style={{ color: colors.text, fontWeight: '900', fontSize: 18 }}>{value}</Text>
    </View>
  );
}
