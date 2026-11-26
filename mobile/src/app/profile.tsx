import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { BackHeader } from '@/components/Header';
import { Avatar, Badge, Card, GradientButton, Input, ListRow, Muted, Screen, SectionHeader } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { pickAndUpload } from '@/lib/upload';
import { useAuth } from '@/providers/AuthProvider';
import { useActiveEvent } from '@/providers/EventProvider';
import { colors } from '@/theme';

export default function ProfileScreen() {
  const { profile, refreshProfile, signOut, isAdmin, isAdminGeral } = useAuth();
  const { registrations, setActiveEventId, active } = useActiveEvent();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [instagram, setInstagram] = useState(profile?.instagram ?? '');
  const [saving, setSaving] = useState(false);

  async function save(extra: Record<string, unknown> = {}) {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from('st_usuarios')
      .update({ full_name: name, phone, city, instagram: instagram ? `@${instagram.replace('@', '')}` : null, ...extra })
      .eq('id', profile.id); // linha de st_usuarios
    setSaving(false);
    if (error) return Alert.alert('Erro', error.message);
    await refreshProfile();
    if (!Object.keys(extra).length) Alert.alert('Perfil atualizado ✓');
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
              Alert.alert('Erro', (e as Error).message);
            }
          }}>
          <Avatar uri={profile?.avatar_url} name={profile?.full_name} size={96} />
          <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 6, fontSize: 12 }}>Trocar foto</Text>
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

      <SectionHeader title="Minhas corridas" />
      <Card animated={false}>
        {registrations.length === 0 ? <Muted>Nenhuma corrida vinculada.</Muted> : null}
        {registrations.map((r) => (
          <ListRow
            key={r.id}
            icon={r.event_id === active?.event_id ? 'radio-button-on' : 'radio-button-off'}
            color={r.event?.primary_color}
            title={r.event?.name ?? ''}
            subtitle={`${r.distance?.label ?? ''} · ${r.event ? formatDate(r.event.event_date) : ''}`}
            onPress={() => setActiveEventId(r.event_id)}
          />
        ))}
      </Card>

      {isAdmin ? <GradientButton title="Painel do administrador" icon="construct" variant="ghost" colorsPair={[colors.lime, colors.cyan]} onPress={() => router.push('/admin')} style={{ marginTop: 12 }} /> : null}
      <GradientButton title="Sair" icon="log-out-outline" variant="ghost" colorsPair={[colors.danger, colors.danger]} onPress={signOut} style={{ marginTop: 12, marginBottom: 30 }} />
    </Screen>
  );
}
