import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { AuthHero } from '@/components/AuthHero';
import { FadeIn, GradientButton, Input } from '@/components/ui';
import { biometriaDisponivel, confirmarBiometria, emailComBiometria, lerComBiometria, removerBiometria, salvarBiometria } from '@/lib/biometria';
import { supabase } from '@/lib/supabase';
import { resendConfirmation, useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme';
import { t } from '@/i18n';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  /** nome do recurso (Face ID, digital...) quando já existe login guardado para entrar com biometria */
  const [bio, setBio] = useState<string | null>(null);
  const autoTried = useRef(false);

  useEffect(() => {
    (async () => {
      const [tipo, salvo] = await Promise.all([biometriaDisponivel(), emailComBiometria()]);
      if (tipo && salvo) {
        setBio(tipo);
        setEmail(salvo);
        if (!autoTried.current) {
          autoTried.current = true;
          onBiometria();
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** depois de entrar com senha, oferece guardar o login na biometria do celular */
  async function oferecerBiometria(mail: string, senha: string) {
    const tipo = await biometriaDisponivel();
    if (!tipo || (await emailComBiometria()) === mail.trim().toLowerCase()) return;
    Alert.alert(t('Entrar com {x}?').replace('{x}', tipo), t('Da próxima vez você entra sem digitar a senha. Ela fica guardada com segurança no seu celular.'), [
      { text: t('Agora não'), style: 'cancel' },
      { text: t('Ativar'), onPress: async () => { if (await confirmarBiometria()) await salvarBiometria(mail, senha); } },
    ]);
  }

  async function onBiometria() {
    try {
      const cred = await lerComBiometria();
      if (!cred) return;
      setLoading(true);
      try {
        await signIn(cred.email, cred.password);
      } catch (e) {
        const msg = (e as Error).message;
        if (/senha|password|credenciais|credentials/i.test(msg)) {
          // a senha mudou: apaga o login guardado e pede a senha nova
          await removerBiometria();
          setBio(null);
          Alert.alert(t('Digite sua senha'), t('Sua senha mudou. Entre com a senha nova para ativar a biometria de novo.'));
        } else Alert.alert(t('Não foi possível entrar'), msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function onLogin() {
    if (!email || !password) return Alert.alert(t('Preencha e-mail e senha'));
    setLoading(true);
    try {
      await signIn(email, password);
      oferecerBiometria(email, password);
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
            {bio && (
              <GradientButton title={t('Entrar com {x}').replace('{x}', bio)} icon={/face|facial/i.test(bio) ? 'scan-outline' : 'finger-print'} variant="ghost" onPress={onBiometria} style={{ marginTop: 12 }} />
            )}
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
