import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { alpha, colors, font, radius } from '@/theme';

import { GradientButton, Input, Muted } from './ui';

/** 1º acesso com senha provisória: a pessoa cria a própria senha antes de usar o app */
export function ForcePasswordChange() {
  const { profile, refreshProfile, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (password.length < 6) return Alert.alert(t('A senha deve ter pelo menos 6 caracteres'));
    if (password !== confirm) return Alert.alert(t('As senhas não conferem'));
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSaving(false);
      // o Supabase recusa repetir a mesma senha
      return Alert.alert(t('Não foi possível alterar a senha'), /different|same/i.test(error.message) ? t('Escolha uma senha diferente da provisória.') : error.message);
    }
    await supabase.rpc('st_senha_trocada');
    await refreshProfile();
    setSaving(false);
    Alert.alert(t('Senha criada ✓'), t('Pronto! Use esta senha nos próximos acessos.'));
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingTop: insets.top + 40 }}>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: alpha(colors.primary, 0.18), alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Ionicons name="key" size={30} color={colors.primary} />
        </View>
        <Text style={[font.h1, { color: colors.text }]}>{t('Crie sua senha')}</Text>
        <Muted style={{ marginTop: 6, marginBottom: 20 }}>
          {t('Você entrou com uma senha provisória. Para continuar, crie uma senha só sua.')}
        </Muted>
        {profile?.email ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{t('SEU E-MAIL DE ACESSO')}</Text>
            <Text style={{ color: colors.text, fontWeight: '800', marginTop: 2 }}>{profile.email}</Text>
          </View>
        ) : null}
        <Input label="Nova senha" icon="key-outline" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" placeholder="mínimo 6 caracteres" />
        <Input label="Confirmar nova senha" icon="key-outline" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" onSubmitEditing={save} />
        <GradientButton title="Salvar minha senha" icon="checkmark" onPress={save} loading={saving} style={{ marginTop: 8 }} />
        <Text onPress={signOut} style={{ color: colors.textMuted, textAlign: 'center', marginTop: 24 }}>
          {t('Sair')}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
