import { router } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, Text, View } from 'react-native';

import { BackHeader } from '@/components/Header';
import { Avatar, Badge, Card, GradientButton, Input, ListRow, Muted, Screen, SectionHeader } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { pickAndUpload } from '@/lib/upload';
import { useAuth } from '@/providers/AuthProvider';
import { useActiveEvent } from '@/providers/EventProvider';
import { colors, radius, setThemeMode, useThemeMode, type ThemeMode } from '@/theme';
import { t } from '@/i18n';

export default function ProfileScreen() {
  const { profile, refreshProfile, signOut, isAdmin, isAdminGeral } = useAuth();
  const { registrations, setActiveEventId, active } = useActiveEvent();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [instagram, setInstagram] = useState(profile?.instagram ?? '');
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  async function changePassword() {
    if (newPassword.length < 6) return Alert.alert(t('A senha deve ter pelo menos 6 caracteres'));
    if (newPassword !== confirmPassword) return Alert.alert(t('As senhas não conferem'));
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) return Alert.alert(t('Não foi possível alterar a senha'), error.message);
    setNewPassword('');
    setConfirmPassword('');
    Alert.alert(t('Senha alterada ✓'));
  }

  async function save(extra: Record<string, unknown> = {}) {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from('st_usuarios')
      .update({ full_name: name, phone, city, instagram: instagram ? `@${instagram.replace('@', '')}` : null, ...extra })
      .eq('id', profile.id); // linha de st_usuarios
    setSaving(false);
    if (error) return Alert.alert(t('Erro'), error.message);
    await refreshProfile();
    if (!Object.keys(extra).length) Alert.alert(t('Perfil atualizado ✓'));
  }

  return (
    <Screen bottomInset={false}>
      <BackHeader title="Meu perfil" />
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <Pressable
          onPress={async () => {
            try {
              const url = await pickAndUpload('avatars', [1, 1]);
              if (url) await save({ avatar_url: url });
            } catch (e) {
              Alert.alert(t('Erro'), (e as Error).message);
            }
          }}>
          <Avatar uri={profile?.avatar_url} name={profile?.full_name} size={96} />
          <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 6, fontSize: 12 }}>{t('Trocar foto')}</Text>
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 8 }}>{profile?.full_name}</Text>
        <Muted>{profile?.email}</Muted>
        {isAdmin ? <View style={{ marginTop: 8 }}><Badge label={isAdminGeral ? 'Administrador geral' : 'Administrador'} color={colors.lime} /></View> : null}
      </View>

      <Input label="Nome" value={name} onChangeText={setName} icon="person-outline" />
      <Input label="WhatsApp" value={phone} onChangeText={setPhone} icon="logo-whatsapp" keyboardType="phone-pad" />
      <Input label="Cidade" value={city} onChangeText={setCity} icon="location-outline" />
      <Input label="Instagram" value={instagram} onChangeText={setInstagram} icon="logo-instagram" autoCapitalize="none" placeholder="@seuperfil" />
      <GradientButton title="Salvar" icon="checkmark" onPress={() => save()} loading={saving} />

      <SectionHeader title="Aparência" />
      <ThemePicker />

      <SectionHeader title="Alterar senha" />
      <Input label="Nova senha" value={newPassword} onChangeText={setNewPassword} icon="key-outline" secureTextEntry autoCapitalize="none" placeholder="mínimo 6 caracteres" />
      <Input label="Confirmar nova senha" value={confirmPassword} onChangeText={setConfirmPassword} icon="key-outline" secureTextEntry autoCapitalize="none" />
      <GradientButton title="Alterar senha" icon="lock-closed" variant="ghost" onPress={changePassword} loading={changingPassword} />

      <SectionHeader title="Minhas corridas" />
      <Card animated={false}>
        {registrations.length === 0 ? <Muted>Nenhuma corrida vinculada.</Muted> : null}
        {registrations.map((r) => (
          <ListRow
            key={r.id}
            icon={r.event_id === active?.event_id ? 'radio-button-on' : 'radio-button-off'}
            title={r.event?.name ?? ''}
            subtitle={`${r.distance?.label ?? ''} · ${r.event ? formatDate(r.event.event_date) : ''}`}
            onPress={() => setActiveEventId(r.event_id)}
          />
        ))}
      </Card>

      {isAdmin ? <GradientButton title="Painel do administrador" icon="construct" variant="ghost" onPress={() => router.push('/admin')} style={{ marginTop: 12 }} /> : null}
      <GradientButton title="Sair" icon="log-out-outline" variant="ghost" colorsPair={[colors.border, colors.border]} onPress={signOut} style={{ marginTop: 12, marginBottom: 30 }} />
    </Screen>
  );
}

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: 'moon' | 'sunny'; bg: string; fg: string }[] = [
  { mode: 'dark', label: 'Escuro', icon: 'moon', bg: '#0C1511', fg: '#C7F753' },
  { mode: 'light', label: 'Claro', icon: 'sunny', bg: '#D3E2C7', fg: '#24463A' },
];

/** Escolha do tema (escuro / claro); a escolha fica salva no aparelho */
function ThemePicker() {
  const mode = useThemeMode();
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {THEME_OPTIONS.map((o) => {
        const on = o.mode === mode;
        return (
          <Pressable
            key={o.mode}
            onPress={() => setThemeMode(o.mode)}
            style={{ flex: 1, borderRadius: radius.lg, borderWidth: 2, borderColor: on ? colors.primary : colors.border, backgroundColor: colors.surface, padding: 12, alignItems: 'center', gap: 8 }}>
            <View style={{ width: '100%', height: 56, borderRadius: radius.md, backgroundColor: o.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}>
              <Ionicons name={o.icon} size={24} color={o.fg} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={on ? colors.primary : colors.textDim} />
              <Text style={{ color: colors.text, fontWeight: '800' }}>{t(o.label)}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
