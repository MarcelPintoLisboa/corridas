import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { daysUntil, formatDate } from '@/lib/format';
import { alpha, colors, font, radius } from '@/theme';

import { Badge, FadeIn, Loading, Muted, SectionHeader, type IconName } from './ui';

const BENEFITS: { icon: IconName; color: string; title: string; text: string }[] = [
  { icon: 'barbell', color: colors.primary, title: 'Treino até o dia da prova', text: 'Plano dos treinadores para a sua distância e nível' },
  { icon: 'nutrition', color: colors.success, title: 'Dicas e alimentação', text: 'O que comer e como se preparar semana a semana' },
  { icon: 'logo-instagram', color: '#E1306C', title: 'Post pronto para o Instagram', text: 'Foto, distância, tempo, pace e gráfico da sua evolução' },
  { icon: 'cube', color: colors.cyan, title: 'Retirada do kit', text: 'Locais, datas, horários e documentos' },
  { icon: 'gift', color: colors.lime, title: 'Ofertas dos patrocinadores', text: 'Cupons exclusivos para inscritos' },
];

/** Tela inicial de quem ainda não vinculou uma corrida: mostra as corridas e o que ganha ao entrar */
export function RaceOnboarding() {
  const q = useAsync(() => api.publishedEvents(), []);
  const upcoming = (q.data ?? []).filter((e) => daysUntil(e.event_date) >= 0);

  return (
    <View>
      <FadeIn>
        <LinearGradient colors={[colors.primary, colors.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.xl, padding: 20 }}>
          <Text style={[font.tiny, { color: 'rgba(255,255,255,0.85)' }]}>Comprou o kit?</Text>
          <Text style={[font.h1, { color: '#fff', marginTop: 4 }]}>Escolha sua corrida e receba seu treino</Text>
          <Text style={{ color: 'rgba(255,255,255,0.9)', marginTop: 6 }}>
            Toque na sua corrida abaixo, informe o código do pedido do kit, a distância e o seu nível.
          </Text>
        </LinearGradient>
      </FadeIn>

      <SectionHeader title="Corridas disponíveis" action="Ver todas" onAction={() => router.push('/events')} />
      {q.loading ? <Loading /> : null}
      {!q.loading && !upcoming.length ? <Muted>Nenhuma corrida aberta no momento.</Muted> : null}
      {upcoming.map((e, i) => (
        <FadeIn key={e.id} delay={i * 80}>
          <Pressable onPress={() => router.push(`/events/${e.id}`)} style={({ pressed }) => ({ height: 170, borderRadius: radius.lg, overflow: 'hidden', marginBottom: 12, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
            {e.cover_image_url ? <Image source={e.cover_image_url} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" transition={300} /> : null}
            <LinearGradient colors={[alpha(e.secondary_color, 0.35), alpha(e.primary_color, 0.95)]} style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
              <Badge label={`Faltam ${daysUntil(e.event_date)} dias`} color="#fff" />
              <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[font.tiny, { color: 'rgba(255,255,255,0.85)' }]}>{formatDate(e.event_date, true)} · {e.city ?? ''}</Text>
                  <Text style={[font.h2, { color: '#fff' }]}>{e.name}</Text>
                </View>
                <View style={{ backgroundColor: '#fff', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: '#000', fontWeight: '900' }}>Participar</Text>
                  <Ionicons name="arrow-forward" size={14} color="#000" />
                </View>
              </View>
            </LinearGradient>
          </Pressable>
        </FadeIn>
      ))}

      <SectionHeader title="O que você recebe" />
      {BENEFITS.map((b, i) => (
        <FadeIn key={b.title} delay={150 + i * 60}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: alpha(b.color, 0.18), alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={b.icon} size={20} color={b.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '800' }}>{b.title}</Text>
              <Muted style={{ fontSize: 12 }}>{b.text}</Muted>
            </View>
          </View>
        </FadeIn>
      ))}
    </View>
  );
}
