import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { AuthHero } from '@/components/AuthHero';
import { FadeIn, GradientButton, Input } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { resendConfirmation, useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme';
import { t } from '@/i18n';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onLogin() {
    if (!email || !password) return Alert.alert(t('Preencha e-mail e senha'));
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (e) {
      const msg = (e as Error).message;
      if (/confirme seu e-mail|confirm your email/i.test(msg)) {
        // conta criada mas e-mail ainda não confirmado: oferece reenviar o link
        Alert.alert(t('Confirme seu e-mail 📩'), msg, [
          { text: t('OK'), style: 'cancel' },
          { text: t('Reenviar e-mail'), onPress: () => resendConfirmation(email).then(() => Alert.alert(t('E-mail reenviado 📩'), t('Confira sua caixa de entrada e o spam.'))).catch((err) => Alert.alert(t('Não foi possível reenviar'), (err as Error).message)) },
        ]);
      } else Alert.alert(t('Não foi possível entrar'), msg);
    } finally {
      setLoading(false);
    }
  }

  async function onForgot() {
    if (!email) return Alert.alert(t('Informe seu e-mail acima para recuperar a senha'));
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    Alert.alert(t(error ? 'Erro' : 'Pronto!'), error ? error.message : t('Enviamos um link de recuperação para seu e-mail.'));
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        <AuthHero title="Bora correr?" subtitle="Seu treino, sua prova, sua evolução." />
        <View style={{ paddingHorizontal: 24 }}>
          <FadeIn delay={350}>
            <Input label="E-mail" icon="mail-outline" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="voce@email.com" />
            <Input label="Senha" icon="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••" />
            <Text onPress={onForgot} style={{ color: colors.textMuted, textAlign: 'right', marginTop: -6, marginBottom: 20 }}>
              {t('Esqueci minha senha')}
            </Text>
            <GradientButton title="Entrar" icon="arrow-forward" onPress={onLogin} loading={loading} />
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
              <Text style={{ color: colors.textMuted }}>{t('Ainda não tem conta?')} </Text>
              <Link href="/signup" style={{ color: colors.primary, fontWeight: '800' }}>
                {t('Criar conta')}
              </Link>
            </View>
          </FadeIn>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
