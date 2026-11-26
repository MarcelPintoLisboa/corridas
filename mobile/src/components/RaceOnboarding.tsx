import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';
import { alpha, colors, font, radius } from '@/theme';

import { FadeIn, Muted, SectionHeader, type IconName } from './ui';
import { t } from '@/i18n';

const BENEFITS: { icon: IconName; color: string; title: string; text: string }[] = [
  { icon: 'barbell', color: colors.primary, title: 'Treino até o dia da prova', text: 'Plano dos treinadores para a sua distância e nível' },
  { icon: 'nutrition', color: colors.success, title: 'Dicas e alimentação', text: 'O que comer e como se preparar semana a semana' },
  { icon: 'logo-instagram', color: '#E1306C', title: 'Post pronto para o Instagram', text: 'Foto, distância, tempo, pace e gráfico da sua evolução' },
  { icon: 'cube', color: colors.cyan, title: 'Retirada do kit', text: 'Locais, datas, horários e documentos' },
  { icon: 'chatbubbles', color: colors.secondary, title: 'Stories da corrida', text: 'Fotos e comentários com quem vai correr com você' },
  { icon: 'gift', color: colors.lime, title: 'Ofertas dos patrocinadores', text: 'Cupons e materiais exclusivos' },
];

/** Quem ainda não foi associado a nenhuma corrida pelo organizador */
export function RaceOnboarding() {
  const { profile, session } = useAuth();
  const email = profile?.email ?? session?.user.email;
  return (
    <View>
      <FadeIn>
        <LinearGradient colors={[colors.primary, colors.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.xl, padding: 20 }}>
          <Ionicons name="hourglass-outline" size={28} color="#fff" />
          <Text style={[font.h1, { color: '#fff', marginTop: 8 }]}>{t('Aguardando sua corrida')}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.92)', marginTop: 6 }}>
            {t('O organizador da corrida associa você pelo seu e-mail. Assim que isso acontecer, tudo aparece aqui automaticamente.')}
          </Text>
          {email ? (
            <View style={{ marginTop: 14, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: radius.md, padding: 10 }}>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{t('INFORME ESTE E-MAIL AO ORGANIZADOR')}</Text>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16, marginTop: 2 }} selectable>
                {email}
              </Text>
            </View>
          ) : null}
        </LinearGradient>
      </FadeIn>

      <SectionHeader title="O que você recebe" />
      {BENEFITS.map((b, i) => (
        <FadeIn key={b.title} delay={150 + i * 60}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: alpha(b.color, 0.18), alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={b.icon} size={20} color={b.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '800' }}>{t(b.title)}</Text>
              <Muted style={{ fontSize: 12 }}>{b.text}</Muted>
            </View>
          </View>
        </FadeIn>
      ))}
    </View>
  );
}
