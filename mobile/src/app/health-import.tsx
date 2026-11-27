import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from 'react-native';

import { BackHeader } from '@/components/Header';
import { Card, Chip, EmptyState, GradientButton, Muted, Screen } from '@/components/ui';
import { useTraining } from '@/hooks/useTraining';
import { t, tn } from '@/i18n';
import { formatDate, formatDuration, formatKm, formatPace, formatTime } from '@/lib/format';
import { health, type HealthRun, type HealthStatus } from '@/lib/health';
import { isSameDay, type ScheduledSession } from '@/lib/plan';
import { strava } from '@/lib/strava';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useActiveEvent } from '@/providers/EventProvider';
import { alpha, colors, font, radius, onColor } from '@/theme';

const CONNECTED_KEY = 'health-connected';
const SOURCE_KEY = 'import-source';
const DAYS = 60;
const STRAVA = '#FC4C02';

type Source = 'device' | 'strava';

/** Importa as corridas do relógio (Apple Saúde / Health Connect ou Strava) para os treinos do corredor */
export default function HealthImportScreen() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const { event, accent, accent2 } = useActiveEvent();
  const training = useTraining();
  const [src, setSrc] = useState<Source | null>(null);
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [athlete, setAthlete] = useState<string | null>(null);
  const [runs, setRuns] = useState<HealthRun[] | null>(null);
  const [imported, setImported] = useState<Set<string>>(new Set());
  /** horários dos treinos já registrados (evita duplicar a mesma corrida vinda de outra fonte) */
  const [existingTimes, setExistingTimes] = useState<number[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const key = (r: HealthRun) => `${r.source}:${r.externalId}`;
  const color = src === 'strava' ? STRAVA : accent;

  async function load(source: Source = src!) {
    setLoading(true);
    try {
      const since = new Date(Date.now() - (DAYS + 1) * 86400_000).toISOString();
      const [list, existing] = await Promise.all([
        source === 'strava' ? strava.listRuns(DAYS) : health.listRuns(DAYS),
        supabase.from('st_workouts').select('source,external_id,performed_at').eq('user_id', uid!).gte('performed_at', since),
      ]);
      const rows = (existing.data ?? []) as { source: string | null; external_id: string | null; performed_at: string }[];
      setRuns(list);
      setImported(new Set(rows.filter((w) => w.external_id).map((w) => `${w.source}:${w.external_id}`)));
      setExistingTimes(rows.map((w) => new Date(w.performed_at).getTime()));
    } catch (e) {
      if ((e as { code?: string }).code === 'not_connected') {
        setConnected(false);
        setRuns(null);
      } else Alert.alert(t('Não foi possível ler os treinos'), (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function select(source: Source) {
    setSrc(source);
    setRuns(null);
    setConnected(false);
    setStatus(null);
    AsyncStorage.setItem(SOURCE_KEY, source).catch(() => {});
    if (source === 'strava') {
      setStatus('available');
      try {
        const s = await strava.status();
        setAthlete(s.athlete);
        if (s.connected) {
          setConnected(true);
          await load('strava');
        }
      } catch (e) {
        Alert.alert('Strava', (e as Error).message);
      }
    } else {
      const s = await health.status();
      setStatus(s);
      const was = await AsyncStorage.getItem(CONNECTED_KEY).catch(() => null);
      if (s === 'available' && was === '1') {
        setConnected(true);
        await load('device');
      }
    }
  }

  useEffect(() => {
    (async () => {
      const saved = (await AsyncStorage.getItem(SOURCE_KEY).catch(() => null)) as Source | null;
      // no iPhone o padrão é o Strava: instalado pelo Sideloadly, o app não recebe acesso ao Apple Saúde
      await select(saved ?? (Platform.OS === 'ios' ? 'strava' : 'device'));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect() {
    setBusy('connect');
    try {
      if (src === 'strava') {
        if (!(await strava.connect())) return;
        const s = await strava.status();
        setAthlete(s.athlete);
        setConnected(true);
        await load('strava');
        return;
      }
      const ok = await health.requestAccess();
      if (!ok) {
        return Alert.alert(t('Permissão necessária'), t('Permita a leitura dos treinos para importar suas corridas.'), [
          { text: t('Cancelar'), style: 'cancel' },
          { text: t('Abrir ajustes'), onPress: () => health.openSettings() },
        ]);
      }
      await AsyncStorage.setItem(CONNECTED_KEY, '1').catch(() => {});
      setConnected(true);
      await load('device');
    } catch (e) {
      const msg = (e as Error).message ?? '';
      if (src === 'device' && Platform.OS === 'ios' && /entitlement|not authorized|authorization/i.test(msg)) {
        // instalação sem HealthKit (Sideloadly): oferece o Strava
        Alert.alert(t('Não foi possível conectar'), t('Instalado pelo Sideloadly, o iPhone não libera o Apple Saúde para o app. Use o Strava: o Apple Watch sincroniza com ele e o app importa as corridas.'), [
          { text: t('Cancelar'), style: 'cancel' },
          { text: t('Usar Strava'), onPress: () => select('strava') },
        ]);
      } else Alert.alert(t('Não foi possível conectar'), msg || t('Erro desconhecido'));
    } finally {
      setBusy(null);
    }
  }

  function disconnect() {
    Alert.alert(t('Desconectar o Strava?'), t('Os treinos já importados continuam no app.'), [
      { text: t('Cancelar'), style: 'cancel' },
      {
        text: t('Desconectar'),
        style: 'destructive',
        onPress: async () => {
          await strava.disconnect().catch(() => {});
          setConnected(false);
          setRuns(null);
          setAthlete(null);
        },
      },
    ]);
  }

  /** treino do plano no mesmo dia (para ligar a corrida à sessão) */
  function matchSession(r: HealthRun): ScheduledSession | undefined {
    return training.scheduled.find((s) => s.type !== 'rest' && !s.workout && isSameDay(s.date, r.start));
  }

  /** a mesma corrida já foi registrada por outra fonte (mesmo horário, ±15 min) */
  const duplicate = (r: HealthRun) => !imported.has(key(r)) && existingTimes.some((ms) => Math.abs(ms - r.start.getTime()) < 15 * 60_000);

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
        /source_valida/i.test(error.message) && r.source === 'strava'
          ? t('Rode o arquivo supabase/migrations/20261126000011_st_strava.sql no SQL Editor do Supabase.')
          : /column|schema cache|source_valida/i.test(error.message)
            ? t('Rode o arquivo supabase/migrations/20261126000008_st_relogio.sql no SQL Editor do Supabase.')
            : error.message,
      );
    }
    return true;
  }

  async function importOne(r: HealthRun) {
    setBusy(key(r));
    try {
      await importRun(r);
      setImported(new Set([...imported, key(r)]));
      setExistingTimes([...existingTimes, r.start.getTime()]);
      training.reload();
    } catch (e) {
      Alert.alert(t('Não foi possível importar'), (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const importable = (r: HealthRun) => !imported.has(key(r)) && !duplicate(r) && r.distanceKm >= 0.05;

  async function importAll() {
    const pending = (runs ?? []).filter(importable);
    if (!pending.length) return;
    setBusy('all');
    const done = new Set(imported);
    try {
      for (const r of pending) {
        await importRun(r);
        done.add(key(r));
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

  const pendingCount = (runs ?? []).filter(importable).length;
  const deviceName = t(health.name);

  return (
    <Screen bottomInset={false} onRefresh={connected ? () => load() : undefined} refreshing={loading && !!runs}>
      <BackHeader title="Importar do relógio" />

      {/* Fonte */}
      {Platform.OS !== 'web' ? (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <Chip label={deviceName} active={src === 'device'} onPress={() => select('device')} color={accent} />
          <Chip label="Strava" active={src === 'strava'} onPress={() => select('strava')} color={STRAVA} />
        </View>
      ) : null}

      {/* Cabeçalho */}
      {src ? (
        <Card animated={false} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: alpha(color, 0.18), alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={src === 'strava' ? 'pulse' : Platform.OS === 'ios' ? 'watch' : 'fitness'} size={26} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[font.h3, { color: colors.text }]}>{src === 'strava' ? 'Strava' : deviceName}</Text>
            <Muted style={{ fontSize: 13 }}>
              {src === 'strava'
                ? connected && athlete
                  ? t('Conectado como {name}', { name: athlete })
                  : t('Corridas do Apple Watch, Garmin, Coros, Polar e outros relógios que sincronizam com o Strava.')
                : Platform.OS === 'ios'
                  ? t('Corridas gravadas no Apple Watch ou no iPhone (e em apps que salvam no Saúde).')
                  : t('Corridas do Galaxy Watch, Pixel Watch, Garmin e outros apps que salvam no Health Connect.')}
            </Muted>
          </View>
          {src === 'strava' && connected ? (
            <Pressable onPress={disconnect} hitSlop={10}>
              <Ionicons name="log-out-outline" size={22} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </Card>
      ) : null}

      {status === null ? <ActivityIndicator color={color} style={{ marginTop: 30 }} /> : null}

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
          {(src === 'strava'
            ? [
                { icon: 'watch', text: 'No Apple Watch: instale o Strava no iPhone e ative a sincronização com o app Saúde (ou grave a corrida pelo Strava no relógio)' },
                { icon: 'stats-chart', text: 'Distância, tempo e pace de cada corrida' },
                { icon: 'heart', text: 'Frequência cardíaca média e máxima' },
                { icon: 'link', text: 'Ligação automática com o treino do plano do mesmo dia' },
              ]
            : [
                { icon: 'stats-chart', text: 'Distância, tempo e pace de cada corrida' },
                { icon: 'heart', text: 'Frequência cardíaca média e máxima' },
                { icon: 'flame', text: 'Calorias gastas' },
                { icon: 'link', text: 'Ligação automática com o treino do plano do mesmo dia' },
              ]
          ).map((b) => (
            <View key={b.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Ionicons name={b.icon as 'heart'} size={18} color={color} />
              <Text style={{ color: colors.text, flex: 1 }}>{t(b.text)}</Text>
            </View>
          ))}
          <Muted style={{ fontSize: 12, marginTop: 4, marginBottom: 16 }}>{t('O app só lê suas corridas. Nada é gravado no seu relógio, e só você vê os seus treinos.')}</Muted>
          <GradientButton
            title={t('Conectar {name}', { name: src === 'strava' ? 'Strava' : deviceName })}
            icon="link"
            onPress={connect}
            loading={busy === 'connect'}
            colorsPair={src === 'strava' ? [STRAVA, '#E03E00'] : [accent, accent2]}
          />
        </View>
      ) : null}

      {connected ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 10 }}>
            <Text style={[font.h2, { color: colors.text }]}>{t('Últimos {n} dias', { n: DAYS })}</Text>
            {loading ? <ActivityIndicator color={color} /> : null}
          </View>

          {runs && pendingCount > 1 ? (
            <GradientButton title={t('Importar todas ({n})', { n: pendingCount })} icon="cloud-download" onPress={importAll} loading={busy === 'all'} disabled={!!busy} colorsPair={[accent, accent2]} style={{ marginBottom: 14 }} />
          ) : null}

          {runs && !runs.length ? (
            <EmptyState
              icon="walk-outline"
              title="Nenhuma corrida encontrada"
              message={src === 'strava' ? 'Grave uma corrida no relógio, espere ela aparecer no Strava e puxe esta tela para baixo para atualizar.' : 'Grave uma corrida no relógio (atividade Corrida) e puxe esta tela para baixo para atualizar.'}
            />
          ) : null}

          {(runs ?? []).map((r) => {
            const done = imported.has(key(r));
            const dup = duplicate(r);
            const s = done || dup ? undefined : matchSession(r);
            const tooShort = r.distanceKm < 0.05;
            return (
              <Card key={key(r)} animated={false} style={done || dup ? { opacity: 0.6 } : undefined}>
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
                  {r.avgHr ? <Big value={`♥ ${r.avgHr}`} unit="bpm" color={colors.primary} /> : null}
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
                  ) : dup ? (
                    <Muted style={{ fontSize: 12 }}>{t('Já registrado (mesmo horário).')}</Muted>
                  ) : tooShort ? (
                    <Muted style={{ fontSize: 12 }}>{t('Sem distância registrada — não dá para importar.')}</Muted>
                  ) : (
                    <Pressable
                      onPress={() => importOne(r)}
                      disabled={!!busy}
                      style={({ pressed }) => ({ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: accent, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 9, opacity: pressed || (busy && busy !== key(r)) ? 0.6 : 1 })}>
                      {busy === key(r) ? <ActivityIndicator color={onColor(accent)} size="small" /> : <Ionicons name="cloud-download" size={16} color={onColor(accent)} />}
                      <Text style={{ color: onColor(accent), fontWeight: '800' }}>{t('Importar')}</Text>
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
