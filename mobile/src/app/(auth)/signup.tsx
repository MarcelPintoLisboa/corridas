import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { AuthHero } from '@/components/AuthHero';
import { FadeIn, GradientButton, Input } from '@/components/ui';
import { resendConfirmation, useAuth } from '@/providers/AuthProvider';
import { alpha, colors, radius } from '@/theme';
import { t } from '@/i18n';

/**
 * Cadastro pelo app: a conta só passa a existir no Corre+ depois que a pessoa
 * clica no link enviado para o e-mail (confirmação do Supabase Auth + trava em st_minha_conta).
 */
export default function SignupScreen() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  async function onSignup() {
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email.trim()) || password.length < 6) {
      return Alert.alert(t('Confira os dados'), t('Nome, e-mail válido e senha (mín. 6 caracteres) são obrigatórios.'));
    }
    setLoading(true);
    try {
      const { needsConfirmation } = await signUp(email, password, name.trim(), phone);
      if (needsConfirmation) setSentTo(email.trim().toLowerCase());
    } catch (e) {
      Alert.alert(t('Não foi possível cadastrar'), (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    if (!sentTo) return;
    setResending(true);
    try {
      await resendConfirmation(sentTo);
      Alert.alert(t('E-mail reenviado 📩'), t('Confira sua caixa de entrada e o spam.'));
    } catch (e) {
      Alert.alert(t('Não foi possível reenviar'), (e as Error).message);
    } finally {
      setResending(false);
    }
  }

  if (sentTo) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
        <AuthHero title="Confirme seu e-mail" subtitle="Falta só um passo para entrar no Corre+." />
        <View style={{ paddingHorizontal: 24 }}>
          <FadeIn delay={300}>
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 18, alignItems: 'center' }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: alpha(colors.primary, 0.18), alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="mail-unread" size={30} color={colors.primary} />
              </View>
              <Text style={{ color: colors.text, fontWeight: '900', fontSize: 18, marginTop: 12, textAlign: 'center' }}>{t('Enviamos um link para')}</Text>
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 16, marginTop: 4, textAlign: 'center' }} selectable>{sentTo}</Text>
              <Text style={{ color: colors.textMuted, marginTop: 12, textAlign: 'center', lineHeight: 21 }}>
                {t('Abra o e-mail e toque em "Confirmar meu e-mail". Sua conta só é criada depois disso — assim garantimos que o e-mail é seu. Não achou? Veja o spam.')}
              </Text>
            </View>
            <GradientButton title="Já confirmei · Entrar" icon="log-in-outline" onPress={() => router.replace('/login')} style={{ marginTop: 18 }} />
            <GradientButton title="Reenviar e-mail" icon="refresh" variant="ghost" onPress={onResend} loading={resending} style={{ marginTop: 12 }} />
            <Text onPress={() => setSentTo(null)} style={{ color: colors.textMuted, textAlign: 'center', marginTop: 20 }}>
              {t('Errou o e-mail?')} <Text style={{ color: colors.primary, fontWeight: '800' }}>{t('Corrigir')}</Text>
            </Text>
          </FadeIn>
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        <AuthHero title="Crie sua conta" subtitle="Vamos confirmar seu e-mail antes de liberar o acesso." />
        <View style={{ paddingHorizontal: 24 }}>
          <FadeIn delay={350}>
            <Input label="Nome completo" icon="person-outline" value={name} onChangeText={setName} placeholder="Seu nome" />
            <Input label="WhatsApp" icon="logo-whatsapp" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="(11) 99999-9999" />
            <Input label="E-mail" icon="mail-outline" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="voce@email.com" />
            <Input label="Senha" icon="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry placeholder="mínimo 6 caracteres" />
            <GradientButton title="Criar conta" icon="rocket" onPress={onSignup} loading={loading} style={{ marginTop: 8 }} />
            <Text onPress={() => router.back()} style={{ color: colors.textMuted, textAlign: 'center', marginTop: 24 }}>
              {t('Já tenho conta')} · <Text style={{ color: colors.primary, fontWeight: '800' }}>{t('Entrar')}</Text>
            </Text>
          </FadeIn>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
