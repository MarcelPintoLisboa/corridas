import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { BackHeader } from '@/components/Header';
import { Card, Chip, FadeIn, GradientButton, Input, Loading, Muted, Screen, SectionHeader } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { formatDateTime, levelLabel, parseDuration } from '@/lib/format';
import type { RunnerLevel } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { useActiveEvent } from '@/providers/EventProvider';
import { alpha, colors, font, radius } from '@/theme';

const SIZES = ['PP', 'P', 'M', 'G', 'GG', 'XG'];

export default function EventJoin() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { registrations, reload, setActiveEventId } = useActiveEvent();
  const q = useAsync(async () => {
    const [event, distances] = await Promise.all([api.event(id), api.distances(id)]);
    return { event, distances };
  }, [id]);

  const existing = registrations.find((r) => r.event_id === id);
  const [distanceId, setDistanceId] = useState<string | null>(existing?.distance_id ?? null);
  const [level, setLevel] = useState<RunnerLevel>(existing?.level ?? 'beginner');
  const [goal, setGoal] = useState('');
  const [weekly, setWeekly] = useState(existing?.weekly_runs ?? 3);
  const [size, setSize] = useState<string | null>(existing?.shirt_size ?? null);
  const [orderCode, setOrderCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [interestSent, setInterestSent] = useState(false);

  if (q.loading || !q.data) return <Loading />;
  const { event, distances } = q.data;
  const c1 = event.primary_color;
  const c2 = event.secondary_color;

  async function onSubmit() {
    if (!event.require_order_code && !distanceId) return Alert.alert('Escolha sua distância');
    if (event.require_order_code && !orderCode.trim()) return Alert.alert('Informe o código do pedido do seu kit');
    setSaving(true);
    try {
      await api.register({
        eventId: event.id,
        distanceId,
        level,
        goalSeconds: goal ? parseDuration(goal) : null,
        weeklyRuns: weekly,
        shirtSize: size,
        orderCode: orderCode.trim() || null,
      });
      await reload();
      setActiveEventId(event.id);
      Alert.alert('Inscrição vinculada! 🎉', 'Seu plano de treino personalizado já está pronto.');
      router.replace('/');
    } catch (e) {
      Alert.alert('Não foi possível vincular', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function onInterest() {
    if (!profile?.email) return;
    try {
      await api.captureLead({ eventId: event.id, name: profile.full_name ?? profile.email, email: profile.email, phone: profile.phone ?? undefined, interest: distances.find((d) => d.id === distanceId)?.label });
      setInterestSent(true);
      Alert.alert('Combinado! 💪', 'O organizador vai te avisar sobre lotes e novidades.');
    } catch (e) {
      Alert.alert('Erro', (e as Error).message);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen bottomInset={false}>
        <BackHeader title={existing ? 'Minha inscrição' : 'Vincular inscrição'} />

        <FadeIn>
          <View style={{ height: 190, borderRadius: radius.xl, overflow: 'hidden' }}>
            {event.cover_image_url ? <Image source={event.cover_image_url} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" /> : null}
            <LinearGradient colors={[alpha(c2, 0.4), alpha(c1, 0.95)]} style={{ flex: 1, padding: 18, justifyContent: 'flex-end' }}>
              <Text style={[font.tiny, { color: 'rgba(255,255,255,0.85)' }]}>{formatDateTime(event.event_date)}</Text>
              <Text style={[font.h1, { color: '#fff' }]}>{event.name}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.9)' }}>{event.location_name}</Text>
            </LinearGradient>
          </View>
        </FadeIn>

        {event.description ? <Muted style={{ marginTop: 14 }}>{event.description}</Muted> : null}

        <SectionHeader title="Código do kit" />
        <Input
          icon="ticket"
          placeholder={event.require_order_code ? 'Obrigatório — ex: NRS-1001' : 'Opcional — nº do pedido da compra'}
          value={orderCode}
          onChangeText={setOrderCode}
          autoCapitalize="characters"
        />
        <Muted style={{ fontSize: 12, marginTop: -8 }}>Com o código, distância e camiseta são preenchidas automaticamente a partir da sua compra.</Muted>

        <SectionHeader title="Distância" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {distances.map((d) => (
            <Card key={d.id} animated={false} onPress={() => setDistanceId(d.id)} style={{ minWidth: 96, alignItems: 'center', borderColor: distanceId === d.id ? c1 : colors.border, backgroundColor: distanceId === d.id ? alpha(c1, 0.18) : colors.surface }}>
              <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900' }}>{d.label}</Text>
              <Muted style={{ fontSize: 12 }}>{d.distance_km} km</Muted>
            </Card>
          ))}
        </View>

        <SectionHeader title="Seu nível" />
        <View style={{ flexDirection: 'row' }}>
          {(['beginner', 'intermediate', 'advanced'] as RunnerLevel[]).map((l) => (
            <Chip key={l} label={levelLabel[l]} active={level === l} color={c1} onPress={() => setLevel(l)} />
          ))}
        </View>
        <Muted style={{ fontSize: 12, marginTop: 6 }}>Usamos isso para montar seu plano e os paces alvo.</Muted>

        <SectionHeader title="Treinos por semana" />
        <View style={{ flexDirection: 'row' }}>
          {[2, 3, 4, 5, 6].map((n) => (
            <Chip key={n} label={`${n}x`} active={weekly === n} color={c1} onPress={() => setWeekly(n)} />
          ))}
        </View>

        <SectionHeader title="Meta de tempo (opcional)" />
        <Input icon="timer" placeholder="ex: 55:00 ou 1:59:00" value={goal} onChangeText={setGoal} keyboardType="numbers-and-punctuation" />

        <SectionHeader title="Camiseta" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {SIZES.map((sz) => (
            <Chip key={sz} label={sz} active={size === sz} color={c1} onPress={() => setSize(sz)} />
          ))}
        </View>

        <GradientButton title={existing ? 'Atualizar inscrição' : 'Vincular e gerar meu plano'} icon="flash" colorsPair={[c1, c2]} onPress={onSubmit} loading={saving} style={{ marginTop: 28 }} />

        {!existing ? (
          <GradientButton
            title={interestSent ? 'Você será avisado ✓' : 'Ainda não comprei — quero ser avisado'}
            variant="ghost"
            colorsPair={[c1, c2]}
            disabled={interestSent}
            onPress={onInterest}
            style={{ marginTop: 12, marginBottom: 30 }}
          />
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
