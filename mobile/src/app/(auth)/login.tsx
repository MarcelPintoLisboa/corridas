import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { AuthHero } from '@/components/AuthHero';
import { FadeIn, GradientButton, Input } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onLogin() {
    if (!email || !password) return Alert.alert('Preencha e-mail e senha');
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (e) {
      Alert.alert('Não foi possível entrar', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function onForgot() {
    if (!email) return Alert.alert('Informe seu e-mail acima para recuperar a senha');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    Alert.alert(error ? 'Erro' : 'Pronto!', error ? error.message : 'Enviamos um link de recuperação para seu e-mail.');
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
              Esqueci minha senha
            </Text>
            <GradientButton title="Entrar" icon="arrow-forward" onPress={onLogin} loading={loading} />
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
              <Text style={{ color: colors.textMuted }}>Ainda não tem conta? </Text>
              <Link href="/signup" style={{ color: colors.lime, fontWeight: '800' }}>
                Criar conta
              </Link>
            </View>
          </FadeIn>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
