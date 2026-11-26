import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from 'react-native';

import { BackHeader } from '@/components/Header';
import { Card, EmptyState, GradientButton, Muted, Screen } from '@/components/ui';
import { useTraining } from '@/hooks/useTraining';
import { t, tn } from '@/i18n';
import { formatDate, formatDuration, formatKm, formatPace, formatTime } from '@/lib/format';
import { health, type HealthRun, type HealthStatus } from '@/lib/health';
import { isSameDay, type ScheduledSession } from '@/lib/plan';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useActiveEvent } from '@/providers/EventProvider';
import { alpha, colors, font, radius } from '@/theme';

const CONNECTED_KEY = 'health-connected';
const DAYS = 60;

/** Importa as corridas gravadas no relógio (Apple Saúde / Health Connect) para os treinos do corredor */
export default function HealthImportScreen() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const { event, accent, accent2 } = useActiveEvent();
  const training = useTraining();
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [runs, setRuns] = useState<HealthRun[] | null>(null);
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [list, existing] = await Promise.all([
        health.listRuns(DAYS),
        supabase.from('st_workouts').select('external_id').eq('user_id', uid!).not('external_id', 'is', null),
      ]);
      setRuns(list);
      setImported(new Set(((existing.data ?? []) as { external_id: string }[]).map((w) => w.external_id)));
    } catch (e) {
      Alert.alert(t('Não foi possível ler os treinos'), (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      const s = await health.status();
      setStatus(s);
      const was = await AsyncStorage.getItem(CONNECTED_KEY).catch(() => null);
      if (s === 'available' && was === '1') {
        setConnected(true);
        await load();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect() {
    setBusy('connect');
    try {
      const ok = await health.requestAccess();
      if (!ok) {
        setBusy(null);
        return Alert.alert(t('Permissão necessária'), t('Permita a leitura dos treinos para importar suas corridas.'), [
          { text: t('Cancelar'), style: 'cancel' },
          { text: t('Abrir ajustes'), onPress: () => health.openSettings() },
        ]);
      }
      await AsyncStorage.setItem(CONNECTED_KEY, '1').catch(() => {});
      setConnected(true);
      await load();
    } catch (e) {
      const msg = (e as Error).message ?? '';
      Alert.alert(
        t('Não foi possível conectar'),
        Platform.OS === 'ios' && /entitlement|not authorized|authorization/i.test(msg)
          ? t('Esta instalação do app não tem acesso ao Apple Saúde. A integração funciona quando o app é instalado assinado com uma conta de desenvolvedor Apple (ou pela App Store).')
          : msg,
      );
    } finally {
      setBusy(null);
    }
  }

  /** treino do plano no mesmo dia (para ligar a corrida à sessão) */
  function matchSession(r: HealthRun): ScheduledSession | undefined {
    return training.scheduled.find((s) => s.type !== 'rest' && !s.workout && isSameDay(s.date, r.start));
  }

  async function importRun(r: HealthRun) {
    const s = matchSession(r);
    const { error } = await supabase.from('st_workouts').insert({
      user_id: uid,
      event_id: event?.id ?? null,
      session_id: s?.id ?? null,
      title: s?.title ?? t(r.treadmill ? 'Corrida na esteira' : 'Corrida na rua'),
      distance_km: Math.round(r.distanceKm * 100) / 100,
      duration_seconds: r.durationSec,
      performed_at: r.start.toISOString(),
      avg_hr: r.avgHr,
      max_hr: r.maxHr,
      calories: r.calories,
      elevation_m: r.elevationM,
      source: r.source,
      external_id: r.externalId,
      notes: r.deviceName ? t('Importado de {device}', { device: r.deviceName }) : null,
    });
    if (error) {
      if (/duplicate|unique/i.test(error.message)) return true; // já importado antes
      throw new Error(
        /column|schema cache|source_valida/i.test(error.message)
          ? t('Rode o arquivo supabase/migrations/20261126000008_st_relogio.sql no SQL Editor do Supabase.')
          : error.message,
      );
    }
    return true;
  }

  async function importOne(r: HealthRun) {
    setBusy(r.externalId);
    try {
      await importRun(r);
      setImported(new Set([...imported, r.externalId]));
      training.reload();
    } catch (e) {
      Alert.alert(t('Não foi possível importar'), (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function importAll() {
    const pending = (runs ?? []).filter((r) => !imported.has(r.externalId) && r.distanceKm >= 0.05);
    if (!pending.length) return;
    setBusy('all');
    const done = new Set(imported);
    try {
      for (const r of pending) {
        await importRun(r);
        done.add(r.externalId);
      }
      Alert.alert(t('Treinos importados ✓'), tn(pending.length, '{n} corrida importada.', '{n} corridas importadas.'), [
        { text: 'OK' },
        { text: t('Ver evolução'), onPress: () => router.replace('/results') },
      ]);
    } catch (e) {
      Alert.alert(t('Não foi possível importar'), (e as Error).message);
    } finally {
      setImported(done);
      training.reload();
      setBusy(null);
    }
  }

  const pendingCount = (runs ?? []).filter((r) => !imported.has(r.externalId) && r.distanceKm >= 0.05).length;
  const sourceIcon = Platform.OS === 'ios' ? 'watch' : 'fitness';

  return (
    <Screen bottomInset={false} onRefresh={connected ? load : undefined} refreshing={loading && !!runs}>
      <BackHeader title="Importar do relógio" />

      {/* Cabeçalho */}
      <Card animated={false} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: alpha(accent, 0.18), alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={sourceIcon} size={26} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[font.h3, { color: colors.text }]}>{t(health.name)}</Text>
          <Muted style={{ fontSize: 13 }}>
            {Platform.OS === 'ios'
              ? t('Corridas gravadas no Apple Watch ou no iPhone (e em apps que salvam no Saúde).')
              : t('Corridas do Galaxy Watch, Pixel Watch, Garmin e outros apps que salvam no Health Connect.')}
          </Muted>
        </View>
      </Card>

      {status === null ? <ActivityIndicator color={accent} style={{ marginTop: 30 }} /> : null}

      {status === 'unavailable' ? (
        <EmptyState
          icon="watch-outline"
          title="Indisponível neste aparelho"
          message={Platform.OS === 'web' ? 'A importação do relógio funciona no app do iPhone ou do Android.' : 'Este aparelho não tem o app de saúde necessário para a importação.'}
        />
      ) : null}

      {status === 'needs_install' ? (
        <View style={{ marginTop: 10 }}>
          <Muted style={{ marginBottom: 12 }}>{t('Instale ou atualize o Health Connect (Google) para importar as corridas do seu relógio.')}</Muted>
          <GradientButton title="Instalar Health Connect" icon="download" onPress={() => health.openSettings()} colorsPair={[accent, accent2]} />
        </View>
      ) : null}

      {status === 'available' && !connected ? (
        <View style={{ marginTop: 10 }}>
          {[
            { icon: 'stats-chart', text: 'Distância, tempo e pace de cada corrida' },
            { icon: 'heart', text: 'Frequência cardíaca média e máxima' },
            { icon: 'flame', text: 'Calorias gastas' },
            { icon: 'link', text: 'Ligação automática com o treino do plano do mesmo dia' },
          ].map((b) => (
            <View key={b.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Ionicons name={b.icon as 'heart'} size={18} color={accent} />
              <Text style={{ color: colors.text, flex: 1 }}>{t(b.text)}</Text>
            </View>
          ))}
          <Muted style={{ fontSize: 12, marginTop: 4, marginBottom: 16 }}>{t('O app só lê suas corridas. Nada é gravado no seu relógio, e só você vê os seus treinos.')}</Muted>
          <GradientButton title={t('Conectar {name}', { name: t(health.name) })} icon="link" onPress={connect} loading={busy === 'connect'} colorsPair={[accent, accent2]} />
        </View>
      ) : null}

      {connected ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 10 }}>
            <Text style={[font.h2, { color: colors.text }]}>{t('Últimos {n} dias', { n: DAYS })}</Text>
            {loading ? <ActivityIndicator color={accent} /> : null}
          </View>

          {runs && pendingCount > 1 ? (
            <GradientButton title={t('Importar todas ({n})', { n: pendingCount })} icon="cloud-download" onPress={importAll} loading={busy === 'all'} disabled={!!busy} colorsPair={[accent, accent2]} style={{ marginBottom: 14 }} />
          ) : null}

          {runs && !runs.length ? (
            <EmptyState icon="walk-outline" title="Nenhuma corrida encontrada" message="Grave uma corrida no relógio (atividade Corrida) e puxe esta tela para baixo para atualizar." />
          ) : null}

          {(runs ?? []).map((r) => {
            const done = imported.has(r.externalId);
            const s = done ? undefined : matchSession(r);
            const tooShort = r.distanceKm < 0.05;
            return (
              <Card key={r.externalId} animated={false} style={done ? { opacity: 0.6 } : undefined}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: colors.textMuted, fontWeight: '700', fontSize: 12, flex: 1 }}>
                    {formatDate(r.start, true)} · {formatTime(r.start)}
                    {r.treadmill ? ` · ${t('Esteira')}` : ''}
                  </Text>
                  {r.deviceName ? <Text style={{ color: colors.textDim, fontSize: 11 }} numberOfLines={1}>{r.deviceName}</Text> : null}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 6 }}>
                  <Big value={`${formatKm(r.distanceKm, 2)}`} unit="km" color={accent} />
                  <Big value={formatDuration(r.durationSec)} />
                  <Big value={r.distanceKm > 0 ? formatPace(r.durationSec / r.distanceKm) : '--'} unit="/km" />
                  {r.avgHr ? <Big value={`♥ ${r.avgHr}`} unit="bpm" color={colors.danger} /> : null}
                  {r.calories ? <Big value={`${r.calories}`} unit="kcal" /> : null}
                </View>
                {s ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: alpha(accent, 0.1), borderRadius: radius.sm, padding: 8 }}>
                    <Ionicons name="link" size={14} color={accent} />
                    <Text style={{ color: colors.text, fontSize: 12, flex: 1 }} numberOfLines={1}>
                      {t('Vai contar como: {title}', { title: s.title })}
                    </Text>
                  </View>
                ) : null}
                <View style={{ marginTop: 10 }}>
                  {done ? (
                    <Text style={{ color: colors.success, fontWeight: '800' }}>{t('Importado ✓')}</Text>
                  ) : tooShort ? (
                    <Muted style={{ fontSize: 12 }}>{t('Sem distância registrada — não dá para importar.')}</Muted>
                  ) : (
                    <Pressable
                      onPress={() => importOne(r)}
                      disabled={!!busy}
                      style={({ pressed }) => ({ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: accent, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 9, opacity: pressed || (busy && busy !== r.externalId) ? 0.6 : 1 })}>
                      {busy === r.externalId ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="cloud-download" size={16} color="#fff" />}
                      <Text style={{ color: '#fff', fontWeight: '800' }}>{t('Importar')}</Text>
                    </Pressable>
                  )}
                </View>
              </Card>
            );
          })}
        </>
      ) : null}
    </Screen>
  );
}

function Big({ value, unit, color = colors.text }: { value: string; unit?: string; color?: string }) {
  return (
    <Text style={{ color, fontWeight: '900', fontSize: 18 }}>
      {value}
      {unit ? <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}> {unit}</Text> : null}
    </Text>
  );
}
