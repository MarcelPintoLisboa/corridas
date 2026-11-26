import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { AuthHero } from '@/components/AuthHero';
import { FadeIn, GradientButton, Input } from '@/components/ui';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme';
import { t } from '@/i18n';

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSignup() {
    if (!name || !email || password.length < 6) {
      return Alert.alert(t('Confira os dados'), t('Nome, e-mail e senha (mín. 6 caracteres) são obrigatórios.'));
    }
    setLoading(true);
    try {
      const { needsConfirmation } = await signUp(email, password, name, phone);
      if (needsConfirmation) {
        Alert.alert(t('Confirme seu e-mail 📩'), t('Enviamos um link de confirmação. Depois é só entrar!'));
        router.back();
      }
    } catch (e) {
      Alert.alert(t('Não foi possível cadastrar'), (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        <AuthHero title="Crie sua conta" subtitle="Depois é só vincular sua inscrição na corrida." />
        <View style={{ paddingHorizontal: 24 }}>
          <FadeIn delay={350}>
            <Input label="Nome completo" icon="person-outline" value={name} onChangeText={setName} placeholder="Seu nome" />
            <Input label="WhatsApp" icon="logo-whatsapp" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="(11) 99999-9999" />
            <Input label="E-mail" icon="mail-outline" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="voce@email.com" />
            <Input label="Senha" icon="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry placeholder="mínimo 6 caracteres" />
            <GradientButton title="Criar conta" icon="rocket" onPress={onSignup} loading={loading} style={{ marginTop: 8 }} />
            <Text onPress={() => router.back()} style={{ color: colors.textMuted, textAlign: 'center', marginTop: 24 }}>
              {t('Já tenho conta')} · <Text style={{ color: colors.lime, fontWeight: '800' }}>{t('Entrar')}</Text>
            </Text>
          </FadeIn>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
