import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, ScrollView, Switch, Text, View } from 'react-native';

import { Chip, GradientButton, IconButton, Input, Muted } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { alpha, colors, font, radius } from '@/theme';

/**
 * Card principal do painel: o organizador gera os treinos preparatórios de todos os
 * participantes (cada distância × nível) com um toque, e depois pode editar sessão por sessão.
 */
export function GeneratePlansCard({ eventId, color, eventDate }: { eventId: string; color: string; eventDate: string }) {
  const [weeksToRace] = useState(() => Math.max(1, Math.floor((new Date(eventDate).getTime() - Date.now()) / (7 * 86_400_000))));
  const [open, setOpen] = useState(false);
  const [weeks, setWeeks] = useState(Math.min(12, Math.max(4, weeksToRace)));
  const [coach, setCoach] = useState('');
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);

  const stats = useAsync(async () => {
    const [{ count: plans }, { count: distances }, { count: regs }] = await Promise.all([
      supabase.from('training_plans').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
      supabase.from('event_distances').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
      supabase.from('registrations').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    ]);
    return { plans: plans ?? 0, distances: distances ?? 0, regs: regs ?? 0 };
  }, [eventId]);

  async function generate() {
    setBusy(true);
    const { data, error } = await supabase.rpc('generate_training_plans', {
      p_event_id: eventId,
      p_weeks: weeks,
      p_coach_name: coach.trim() || null,
      p_replace: replace,
    });
    setBusy(false);
    if (error) return Alert.alert('Não foi possível gerar', error.message);
    setOpen(false);
    stats.reload();
    Alert.alert(
      'Treinos gerados! 🏃',
      data
        ? `${data} planos criados (cada distância × iniciante, intermediário e avançado). Cada participante já recebe o plano da sua distância e nível, com as datas contadas até o dia da prova.`
        : 'Todos os planos já existiam. Marque "Substituir planos existentes" para gerar de novo.',
      [{ text: 'OK' }, { text: 'Ver e editar planos', onPress: () => router.push(`/admin/crud/plans?parentId=${eventId}`) }],
    );
  }

  const s = stats.data;
  const weekOptions = [4, 6, 8, 10, 12, 16].filter((w) => w <= Math.max(4, weeksToRace) || w === 4);

  return (
    <>
      <LinearGradient colors={[alpha(color, 0.35), alpha(colors.secondary, 0.25)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.lg, padding: 16, marginTop: 12, borderWidth: 1, borderColor: alpha(color, 0.5) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: alpha(color, 0.3), alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="barbell" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[font.h3, { color: '#fff' }]}>Treinos preparatórios</Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
              {s ? `${s.plans} planos · ${s.distances} distâncias · ${s.regs} inscritos` : 'carregando…'}
            </Text>
          </View>
        </View>
        <Text style={{ color: 'rgba(255,255,255,0.9)', marginTop: 10, fontSize: 13 }}>
          {s && s.plans === 0
            ? 'Nenhum plano ainda. Gere agora os treinos de todos os participantes até o dia da prova — por distância e nível.'
            : 'Cada participante recebe o plano da sua distância e nível. Você pode ajustar qualquer sessão.'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <GradientButton small title={s?.plans ? 'Gerar novamente' : 'Gerar treinos'} icon="flash" colorsPair={[color, colors.secondary]} onPress={() => setOpen(true)} style={{ flex: 1 }} />
          {s?.plans ? (
            <GradientButton small title="Editar" icon="create" variant="ghost" colorsPair={['#fff', '#fff']} onPress={() => router.push(`/admin/crud/plans?parentId=${eventId}`)} style={{ flex: 1 }} />
          ) : null}
        </View>
      </LinearGradient>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingTop: 24, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={[font.h2, { color: colors.text, flex: 1 }]}>Gerar treinos preparatórios</Text>
            <IconButton icon="close" onPress={() => setOpen(false)} />
          </View>
          <Muted style={{ marginBottom: 16 }}>
            Cria um plano para cada distância da corrida nos níveis iniciante, intermediário e avançado: rodagens, treinos de ritmo, tiros, longões, fortalecimento e descanso,
            com volume progressivo e polimento na semana da prova. As datas são calculadas a partir do dia da corrida.
          </Muted>

          {s && s.distances === 0 ? (
            <View style={{ backgroundColor: alpha(colors.warning, 0.12), padding: 12, borderRadius: radius.md, marginBottom: 16 }}>
              <Text style={{ color: colors.warning, fontWeight: '700' }}>Cadastre as distâncias da corrida primeiro (menu Distâncias).</Text>
            </View>
          ) : null}

          <Text style={[font.tiny, { color: colors.textMuted, marginBottom: 8 }]}>Duração do plano</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, marginBottom: 6 }}>
            {weekOptions.map((w) => (
              <Chip key={w} label={`${w} semanas`} active={weeks === w} color={color} onPress={() => setWeeks(w)} />
            ))}
          </View>
          <Muted style={{ fontSize: 12, marginBottom: 16 }}>Faltam ~{weeksToRace} semanas para a prova. Quem se inscrever depois entra na semana em andamento.</Muted>

          <Input label="Treinador(a) responsável (opcional)" placeholder="Ex.: Coach Marina Alves" value={coach} onChangeText={setCoach} icon="person" />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>Substituir planos existentes</Text>
              <Muted style={{ fontSize: 12 }}>Apaga os planos atuais desta corrida (inclusive edições) e gera de novo.</Muted>
            </View>
            <Switch value={replace} onValueChange={setReplace} trackColor={{ true: colors.danger }} />
          </View>

          <GradientButton title="Gerar agora" icon="flash" colorsPair={[color, colors.secondary]} loading={busy} disabled={s?.distances === 0} onPress={generate} />
        </ScrollView>
      </Modal>
    </>
  );
}
