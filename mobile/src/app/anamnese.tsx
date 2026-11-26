import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui';
import { t } from '@/i18n';
import {
  DAYS,
  DEPENDENT,
  OPT,
  STEPS,
  YN,
  YNU,
  distanceOption,
  list,
  safetyState,
  summaryRows,
  validate,
  type Answers,
  type Route,
} from '@/lib/anamnese';
import { formatKm, formatPace, maskDateBR, parseDateTimeBR, toDateInputBR } from '@/lib/format';
import { health, type HealthSummary } from '@/lib/health';
import { strava } from '@/lib/strava';
import { generatePlan } from '@/lib/planGenerator';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useActiveEvent } from '@/providers/EventProvider';
import { alpha, colors, font, radius } from '@/theme';

/** Anamnese do corredor (6 etapas) → plano de treino pessoal gerado automaticamente */
export default function AnamneseScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { event, active, accent } = useActiveEvent();
  const [stage, setStage] = useState(0);
  const [route, setRoute] = useState<Route>('');
  const [data, setData] = useState<Answers>({});
  const [healthSum, setHealthSum] = useState<HealthSummary | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'connect' | 'strava' | 'save' | null>(null);
  const [loaded, setLoaded] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);

  // retoma a anamnese anterior (refazer) ou pré-preenche com a inscrição
  useEffect(() => {
    if (!event || !session) return;
    supabase
      .from('st_anamneses')
      .select('answers, route, health')
      .eq('event_id', event.id)
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data: row }) => {
        if (row?.answers) {
          setData(row.answers as Answers);
          setRoute((row.route as Route) === 'connected' && row.health ? 'connected' : '');
          setHealthSum((row.health as HealthSummary) ?? null);
        } else {
          setData({
            ...distanceOption(active?.distance?.distance_km),
            race: 'Sim',
            date: event.event_date.slice(0, 10),
            goal: 'Completar uma prova',
          });
        }
        setLoaded(true);
      });
  }, [event, session, active]);

  const go = (n: number) => {
    setError('');
    setStage(n);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  function set(key: string, value: string | string[]) {
    setData((prev) => {
      const next: Answers = { ...prev, [key]: value };
      if (DEPENDENT[key] && prev[key] !== value) delete next[DEPENDENT[key]];
      if (key === 'days') {
        const chosen = value as string[];
        for (const d of DAYS) if (!chosen.includes(d)) delete next['minutes' + d];
        if (typeof next.longDay === 'string' && !chosen.includes(next.longDay)) delete next.longDay;
      }
      if (key === 'recent' && !['Sim', 'Estou retomando'].includes(value as string)) for (const k of ['sessions', 'weeklyKm', 'longest', 'lastRun']) delete next[k];
      return next;
    });
    // urgência: interrompe o fluxo e vai direto para a orientação
    if (key === 'warningWhen' && value === 'Agora') go(5);
  }

  async function connectStrava() {
    setBusy('strava');
    try {
      const s = await strava.status();
      if (!s.connected && !(await strava.connect())) return;
      setHealthSum(await strava.summary(30));
      setRoute('connected');
    } catch (e) {
      Alert.alert(t('Não foi possível conectar'), `${(e as Error).message}\n\n${t('Você pode continuar sem conectar e informar seu histórico manualmente.')}`);
    } finally {
      setBusy(null);
    }
  }

  async function connect() {
    setBusy('connect');
    try {
      const status = await health.status();
      if (status !== 'available') {
        setBusy(null);
        return Alert.alert(t('Indisponível neste aparelho'), t('Continue sem conectar e informe seu histórico manualmente.'));
      }
      if (!(await health.requestAccess())) throw new Error(t('Permita a leitura dos treinos para importar suas corridas.'));
      const sum = await health.summary(30);
      setHealthSum(sum);
      setRoute('connected');
    } catch (e) {
      const msg = (e as Error).message ?? '';
      if (Platform.OS === 'ios' && /entitlement|not authorized|authorization/i.test(msg)) {
        // instalação sem HealthKit (Sideloadly): oferece o Strava
        Alert.alert(t('Não foi possível conectar'), t('Instalado pelo Sideloadly, o iPhone não libera o Apple Saúde para o app. Use o Strava: o Apple Watch sincroniza com ele e o app importa as corridas.'), [
          { text: t('Cancelar'), style: 'cancel' },
          { text: t('Usar Strava'), onPress: () => connectStrava() },
        ]);
      } else Alert.alert(t('Não foi possível conectar'), `${msg}\n\n${t('Você pode continuar sem conectar e informar seu histórico manualmente.')}`);
    } finally {
      setBusy(null);
    }
  }

  function next() {
    const msg = validate(stage, data, route);
    if (msg) return setError(t(msg));
    if (stage === 2 && safetyState(data) === 'urgency') return go(5);
    go(stage + 1);
  }

  async function finish() {
    if (!event || !session) return;
    const state = safetyState(data);
    setBusy('save');
    try {
      const { error: e1 } = await supabase.from('st_anamneses').upsert(
        { user_id: session.user.id, event_id: event.id, answers: data, route: route === 'connected' ? 'connected' : 'manual', health: route === 'connected' ? healthSum : null, safety_state: state },
        { onConflict: 'user_id,event_id' },
      );
      if (e1) throw new Error(/relation|schema cache|does not exist/i.test(e1.message) ? t('Rode o arquivo supabase/migrations/20261126000009_st_anamnese.sql no SQL Editor do Supabase.') : e1.message);
      if (state !== 'eligible') {
        setBusy(null);
        return Alert.alert(t('Anamnese salva'), t('Seu plano fica bloqueado até a triagem de saúde ser liberada. A organização da corrida pode ver suas respostas.'), [{ text: 'OK', onPress: () => router.back() }]);
      }
      const gen = generatePlan(data, route === 'connected' ? healthSum : null, event.event_date);
      const { error: e2 } = await supabase.rpc('st_salvar_plano_pessoal', { p_event_id: event.id, p_plan: gen.plan, p_sessions: gen.sessions });
      if (e2) throw new Error(t(e2.message));
      setBusy(null);
      Alert.alert(t('Plano gerado! 🏃'), t('Seu plano de {w} semanas com {n} treinos está pronto, ajustado à sua rotina e ao seu histórico.', { w: gen.plan.weeks, n: gen.sessions.length }), [
        { text: t('Ver meu plano'), onPress: () => router.replace('/training') },
      ]);
    } catch (e) {
      setBusy(null);
      Alert.alert(t('Não foi possível salvar'), (e as Error).message);
    }
  }

  if (!event) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: colors.text, textAlign: 'center' }}>{t('Quando o organizador associar você a uma corrida, ela aparece aqui. O plano de treino vem junto.')}</Text>
      </View>
    );
  }
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}><ActivityIndicator color={accent} /></View>;

  const chosenDays = DAYS.filter((d) => list(data.days).includes(d));
  const state = safetyState(data);

  // ------------------------------------------------ etapas
  let content: ReactNode;
  if (stage === 0) {
    content = !route || route === 'manual' ? (
      <>
        <Title h="Seu histórico é nosso ponto de partida." p="Conecte o app de saúde do seu relógio para aproveitar suas corridas anteriores e reduzir perguntas no cadastro." />
        <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ width: 54, height: 54, borderRadius: 14, backgroundColor: alpha('#FF2D55', 0.15), alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Ionicons name={Platform.OS === 'ios' ? 'heart' : 'fitness'} size={28} color="#FF2D55" />
          </View>
          <Text style={[font.h3, { color: colors.text }]}>{t(health.name)}</Text>
          <Text style={{ color: colors.textMuted, marginTop: 4 }}>
            {t('Lemos suas corridas dos últimos 30 dias, a frequência cardíaca de repouso e o VO₂ máx., com a sua permissão. Nada é gravado no relógio.')}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
          <Btn label={Platform.OS === 'ios' ? 'Conectar ao app Saúde' : 'Conectar ao Health Connect'} primary onPress={connect} loading={busy === 'connect'} />
          <Btn label="Conectar Strava" onPress={connectStrava} loading={busy === 'strava'} />
          <Btn label="Continuar sem conectar" onPress={() => { setRoute('manual'); go(1); }} />
        </View>
      </>
    ) : (
      <>
        <Title h="Confira seu histórico." p="Resumo das corridas lidas do seu relógio nos últimos 30 dias." />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Stat v={String(healthSum?.runs ?? 0)} l="corridas em 30 dias" />
          <Stat v={`${formatKm(healthSum?.totalKm ?? 0)} km`} l="distância observada" />
          <Stat v={`${formatKm(healthSum?.longestKm ?? 0)} km`} l="corrida mais longa" />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
          {healthSum?.avgPaceSec ? <Stat v={`${formatPace(healthSum.avgPaceSec)}/km`} l="pace médio" /> : null}
          {healthSum?.restingHr ? <Stat v={`${healthSum.restingHr} bpm`} l="FC de repouso" /> : null}
          {healthSum?.vo2max ? <Stat v={String(healthSum.vo2max)} l="VO₂ máx." /> : null}
        </View>
        {healthSum && healthSum.runs === 0 ? (
          <Text style={{ color: colors.warning, marginTop: 12 }}>{t('Nenhuma corrida encontrada nos últimos 30 dias. Você pode continuar mesmo assim.')}</Text>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
          <Btn label="Usar este histórico" primary onPress={() => go(1)} />
          <Btn label="Continuar sem conectar" onPress={() => { setRoute('manual'); go(1); }} />
          <Btn label="Voltar" onPress={() => { setRoute(''); setHealthSum(null); }} />
        </View>
      </>
    );
  } else if (stage === 1) {
    content = (
      <>
        <Title h="Qual é seu objetivo?" p="Conte o que você quer alcançar com o plano." />
        <Options k="goal" label="01 · Qual é seu principal objetivo?" values={OPT.goal} />
        <Options k="distance" label="02 · Qual distância deseja alcançar?" values={OPT.distance} />
        {data.distance === 'Outra' ? <Sub><Field k="customDistance" label="Distância em km" numeric /></Sub> : null}
        <Options k="race" label="03 · Já possui uma prova marcada?" values={YN} />
        {data.race ? <DateField k="date" label={data.race === 'Sim' ? '04 · Qual é a data da prova?' : '04 · Qual é seu prazo desejado? (opcional)'} /> : null}
        <Options k="outcome" label="05 · Qual é sua meta?" values={OPT.outcome} />
        {data.outcome === 'Atingir um tempo específico' ? (
          <Sub>
            <Field k="targetTime" label="Tempo desejado (hh:mm:ss)" placeholder="00:55:00" mask={(v) => { const n = v.replace(/\D/g, '').slice(0, 6); return [n.slice(0, 2), n.slice(2, 4), n.slice(4, 6)].filter(Boolean).join(':'); }} />
          </Sub>
        ) : null}
      </>
    );
  } else if (stage === 2) {
    content = (
      <>
        <Title h="Antes de começar" p="Triagem de saúde: responda com sinceridade. Ela protege você e define se o plano pode ser liberado." />
        <Options k="condition" label="06 · Possui alguma condição de saúde diagnosticada?" values={YNU} />
        <Options k="restriction" label="07 · Possui alguma restrição médica ou usa medicamentos contínuos?" values={YNU} />
        {data.restriction === 'Sim' ? <Sub><Options k="restrictionType" label="Qual é a situação?" values={OPT.restrictionType} /></Sub> : null}
        <Options k="warning" label="08 · Já teve dor no peito, desmaio, tontura ou falta de ar incomum durante atividade ou em repouso?" values={YNU} />
        {data.warning === 'Sim' ? <Sub><Options k="warningWhen" label="Quando aconteceu?" values={OPT.warningWhen} /></Sub> : null}
        <Options k="injury" label="09 · Já sofreu alguma lesão que pode interferir na corrida?" values={YNU} />
        {data.injury === 'Sim' ? <Sub><Options k="injuryState" label="Como está essa lesão?" values={OPT.injuryState} /></Sub> : null}
        <Options k="pain" label="10 · Atualmente sente dor ou limitação física?" values={YNU} />
        {data.pain === 'Sim' ? <Sub><Options k="painLimit" label="A dor interfere no movimento ou piora com esforço?" values={YNU} /></Sub> : null}
      </>
    );
  } else if (stage === 3) {
    content = (
      <>
        <Title h="Quando você pode treinar?" p="Escolha os dias e o tempo que cabe na sua rotina." />
        <Options k="frequency" label="11 · Quantos dias por semana deseja correr?" values={OPT.frequency} />
        <Options k="days" label="12 · Quais dias estão disponíveis?" values={DAYS} multiple />
        {chosenDays.length ? <Text style={{ color: colors.text, fontWeight: '800', marginBottom: 10 }}>{t('13 · Quanto tempo você tem em cada dia?')}</Text> : null}
        {chosenDays.map((d) => <Field key={d} k={'minutes' + d} label={`${t(d)} (${t('minutos')})`} numeric />)}
        {chosenDays.length > 1 ? <Options k="longDay" label="14 · Qual dia prefere para o treino mais longo?" values={[...chosenDays, 'Sem preferência']} /> : null}
        <Options k="surface" label="15 · Onde costuma correr? (opcional)" values={OPT.surface} />
        <Options k="cross" label="16 · Pratica musculação ou outra atividade? (opcional)" values={YN} />
        {data.cross === 'Sim' ? <Sub><Field k="crossType" label="Qual atividade? (opcional)" /></Sub> : null}
      </>
    );
  } else if (stage === 4) {
    content = (
      <>
        <Title h="Como está sua corrida hoje?" />
        {route === 'manual' ? (
          <Options k="recent" label="Você tem corrido recentemente?" values={OPT.recent} />
        ) : (
          <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.textMuted }}>{t('As corridas do seu relógio já preenchem seu histórico. Você pode complementar o perfil abaixo.')}</Text>
          </View>
        )}
        {route === 'manual' && ['Sim', 'Estou retomando'].includes(data.recent as string) ? (
          <Sub>
            <Field k="sessions" label="Corridas por semana (opcional)" numeric />
            <Field k="weeklyKm" label="Quilômetros por semana (opcional)" numeric />
            <Field k="longest" label="Maior distância nos últimos 30 dias em km (opcional)" numeric />
            <DateField k="lastRun" label="Data da última corrida (opcional)" />
          </Sub>
        ) : null}
        <Options k="level" label="17 · Como considera seu condicionamento? (opcional)" values={OPT.level} />
        {route === 'manual' ? <Options k="continuous" label="18 · Quanto tempo consegue correr sem caminhar? (opcional)" values={OPT.continuous} /> : null}
        <Options k="unit" label="19 · Prefere treino por tempo ou distância? (opcional)" values={OPT.unit} />
        <Options k="progression" label="20 · Como prefere evoluir? (opcional)" values={OPT.progression} />
      </>
    );
  } else {
    const msg = {
      urgency: 'Procure atendimento médico imediatamente. Se os sintomas estão acontecendo agora, ligue para o SAMU (192). Não comece a treinar.',
      review: 'Pela triagem, você precisa de uma avaliação médica antes de começar. O plano fica bloqueado até a liberação.',
      pending: 'Algumas respostas da triagem ficaram como "Não sei". Esclareça com um profissional de saúde e refaça a triagem para liberar o plano.',
      eligible: 'Tudo certo! Seu plano personalizado será gerado agora, até o dia da prova.',
    }[state];
    content = (
      <>
        <Title h="Revise seu cadastro" />
        <View style={{ borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, backgroundColor: state === 'eligible' ? alpha(colors.success, 0.1) : alpha(colors.danger, 0.1), borderColor: state === 'eligible' ? alpha(colors.success, 0.5) : alpha(colors.danger, 0.5) }}>
          <Text style={[font.h2, { color: colors.text }]}>{t(state === 'eligible' ? 'Cadastro pronto' : state === 'urgency' ? 'Atenção: procure ajuda' : 'Plano bloqueado')}</Text>
          <Text style={{ color: colors.text, marginTop: 6, lineHeight: 21 }}>{t(msg)}</Text>
          {state === 'urgency' ? (
            <Pressable onPress={() => Linking.openURL('tel:192')} style={{ marginTop: 12, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.danger, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 99 }}>
              <Ionicons name="call" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '900' }}>{t('Ligar para o SAMU (192)')}</Text>
            </Pressable>
          ) : null}
        </View>
        {summaryRows(data, route === 'connected' ? 'connected' : 'manual', healthSum).map((r) => (
          <View key={r.label} style={{ flexDirection: 'row', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ color: colors.textMuted, width: 140, fontSize: 13 }}>{t(r.label)}</Text>
            <Text style={{ color: colors.text, flex: 1, fontSize: 13, fontWeight: '600' }}>{r.value.split(', ').map((v) => t(v)).join(', ')}</Text>
          </View>
        ))}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
          {state === 'eligible' ? <Btn label="Gerar meu plano" primary onPress={finish} loading={busy === 'save'} /> : <Btn label="Salvar respostas" primary onPress={finish} loading={busy === 'save'} />}
          <Btn label="Rever triagem" onPress={() => go(2)} />
          <Btn label="Voltar" onPress={() => go(state === 'urgency' ? 2 : 4)} />
        </View>
      </>
    );
  }

  return (
    <Ctx.Provider value={{ data, set, setData, accent, busy }}>
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconButton icon="close" onPress={() => (router.canGoBack() ? router.back() : router.replace('/training'))} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '800' }}>
              {t('Etapa {n} de {total}', { n: stage + 1, total: STEPS.length })} · {t(STEPS[stage])}
            </Text>
            <Text style={{ color: colors.text, fontWeight: '900' }}>{t('Anamnese de corrida')}</Text>
          </View>
        </View>
        <View style={{ height: 8, borderRadius: 8, backgroundColor: colors.surface, overflow: 'hidden', marginTop: 12 }}>
          <View style={{ width: `${((stage + 1) / STEPS.length) * 100}%`, height: '100%', backgroundColor: accent }} />
        </View>
      </View>

      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 120 }}>
        {content}
        {error ? <Text style={{ color: colors.danger, fontWeight: '800', marginTop: 4 }} accessibilityRole="alert">{error}</Text> : null}
      </ScrollView>

      {stage > 0 && stage < 5 ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, padding: 16, paddingBottom: Math.max(insets.bottom, 14), backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Pressable onPress={() => go(stage - 1)} style={{ flex: 1, alignItems: 'center', paddingVertical: 15, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border }}>
            <Text style={{ color: colors.text, fontWeight: '800' }}>{t('Voltar')}</Text>
          </Pressable>
          <Pressable onPress={next} style={{ flex: 2, borderRadius: 14, overflow: 'hidden' }}>
            <View style={{ alignItems: 'center', paddingVertical: 15, backgroundColor: accent }}>
              <Text style={{ color: '#fff', fontWeight: '900' }}>{t('Continuar')}</Text>
            </View>
          </Pressable>
        </View>
      ) : null}
    </KeyboardAvoidingView>
    </Ctx.Provider>
  );
}

// ====================================================================== componentes do formulário
// Ficam fora da tela (componentes estáveis): assim os campos não perdem o foco a cada letra digitada.
interface AnamCtx {
  data: Answers;
  set: (key: string, value: string | string[]) => void;
  setData: (fn: (prev: Answers) => Answers) => void;
  accent: string;
  busy: string | null;
}
const Ctx = createContext<AnamCtx | null>(null);
const useAnam = () => useContext(Ctx)!;

function Options({ k, label, values, multiple }: { k: string; label: string; values: string[]; multiple?: boolean }) {
  const { data, set, accent } = useAnam();
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ color: colors.text, fontWeight: '800', marginBottom: 8 }}>{t(label)}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {values.map((v) => {
          const on = multiple ? list(data[k]).includes(v) : data[k] === v;
          return (
            <Pressable
              key={v}
              accessibilityRole={multiple ? 'checkbox' : 'radio'}
              accessibilityState={{ checked: on }}
              onPress={() => {
                if (multiple) {
                  const cur = list(data[k]);
                  // mantém a ordem da semana
                  set(k, on ? cur.filter((x) => x !== v) : values.filter((x) => cur.includes(x) || x === v));
                } else set(k, v);
              }}
              style={{ paddingHorizontal: 13, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: on ? accent : colors.border, backgroundColor: on ? alpha(accent, 0.18) : colors.surface }}>
              <Text style={{ color: on ? colors.text : colors.textMuted, fontWeight: on ? '800' : '600' }}>{t(v)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const inputStyle = { color: colors.text, backgroundColor: colors.bgElevated, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 } as const;

function Field({ k, label, placeholder, numeric, mask }: { k: string; label: string; placeholder?: string; numeric?: boolean; mask?: (v: string) => string }) {
  const { data, setData } = useAnam();
  const [value, setValue] = useState(typeof data[k] === 'string' ? (data[k] as string) : '');
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 6 }}>{t(label)}</Text>
      <TextInput
        value={value}
        onChangeText={(v) => {
          const next = mask ? mask(v) : v;
          setValue(next);
          setData((p) => ({ ...p, [k]: next }));
        }}
        placeholder={placeholder ? t(placeholder) : undefined}
        placeholderTextColor={colors.textDim}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        style={[inputStyle, { maxWidth: 380 }]}
      />
    </View>
  );
}

/** data guardada como AAAA-MM-DD, digitada como DD/MM/AAAA (ou MM/DD/YYYY em inglês) */
function DateField({ k, label }: { k: string; label: string }) {
  const { data, setData } = useAnam();
  const iso = typeof data[k] === 'string' ? (data[k] as string) : '';
  const [value, setValue] = useState(iso ? toDateInputBR(`${iso}T12:00:00`) : '');
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 6 }}>{t(label)}</Text>
      <TextInput
        value={value}
        onChangeText={(v) => {
          const masked = maskDateBR(v);
          setValue(masked);
          const parsed = masked.length === 10 ? parseDateTimeBR(masked, '12:00') : null;
          setData((p) => ({ ...p, [k]: parsed ? parsed.slice(0, 10) : '' }));
        }}
        placeholder={t('DD/MM/AAAA')}
        placeholderTextColor={colors.textDim}
        keyboardType="number-pad"
        maxLength={10}
        style={[inputStyle, { maxWidth: 220 }]}
      />
    </View>
  );
}

function Sub({ children }: { children: ReactNode }) {
  const { accent } = useAnam();
  return <View style={{ borderLeftWidth: 3, borderLeftColor: alpha(accent, 0.6), paddingLeft: 14, marginBottom: 6 }}>{children}</View>;
}

function Title({ h, p }: { h: string; p?: string }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={[font.h1, { color: colors.text, fontSize: 30, lineHeight: 34 }]}>{t(h)}</Text>
      {p ? <Text style={{ color: colors.textMuted, marginTop: 6, fontSize: 15 }}>{t(p)}</Text> : null}
    </View>
  );
}

function Btn({ label, onPress, primary, loading }: { label: string; onPress: () => void; primary?: boolean; loading?: boolean }) {
  const { accent, busy } = useAnam();
  return (
    <Pressable
      onPress={onPress}
      disabled={!!busy}
      style={({ pressed }) => ({ paddingHorizontal: 18, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, borderColor: primary ? accent : colors.border, backgroundColor: primary ? accent : colors.surface, opacity: pressed || (busy && !loading) ? 0.7 : 1, flexDirection: 'row', gap: 8, alignItems: 'center' })}>
      {loading ? <ActivityIndicator color="#fff" size="small" /> : null}
      <Text style={{ color: primary ? '#fff' : colors.text, fontWeight: '800' }}>{t(label)}</Text>
    </Pressable>
  );
}

function Stat({ v, l }: { v: string; l: string }) {
  const { accent } = useAnam();
  return (
    <View style={{ flex: 1, minWidth: 90, backgroundColor: alpha(accent, 0.12), borderRadius: 12, padding: 12 }}>
      <Text style={{ color: colors.text, fontWeight: '900', fontSize: 20 }}>{v}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t(l)}</Text>
    </View>
  );
}
