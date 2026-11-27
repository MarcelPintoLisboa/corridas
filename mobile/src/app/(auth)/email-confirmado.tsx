import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { AuthHero } from '@/components/AuthHero';
import { FadeIn, GradientButton } from '@/components/ui';
import { alpha, colors, radius } from '@/theme';
import { t } from '@/i18n';

/** Aberta pelo link de confirmação do e-mail (streetrunning://email-confirmado) */
export default function EmailConfirmed() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      <AuthHero title="E-mail confirmado!" subtitle="Sua conta no Corre+ está pronta." />
      <View style={{ paddingHorizontal: 24 }}>
        <FadeIn delay={300}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 18, alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: alpha(colors.success, 0.18), alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark-circle" size={34} color={colors.success} />
            </View>
            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 18, marginTop: 12, textAlign: 'center' }}>{t('Tudo certo! 🎉')}</Text>
            <Text style={{ color: colors.textMuted, marginTop: 8, textAlign: 'center', lineHeight: 21 }}>
              {t('Agora é só entrar com o seu e-mail e a senha que você criou.')}
            </Text>
          </View>
          <GradientButton title="Entrar" icon="arrow-forward" onPress={() => router.replace('/login')} style={{ marginTop: 18 }} />
        </FadeIn>
      </View>
    </ScrollView>
  );
}
