import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { BackHeader } from '@/components/Header';
import { Avatar, Card, Chip, EmptyState, Input, Loading, Muted, Screen } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { supabase, unwrap } from '@/lib/supabase';
import type { Profile, UserRole } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { colors, font } from '@/theme';

const ROLES: { value: UserRole; label: string; help: string; color: string }[] = [
  { value: 'athlete', label: 'Corredor', help: 'Vê só a área do corredor', color: colors.textMuted },
  { value: 'organizer', label: 'Organizador', help: 'Gerencia as corridas que criar', color: colors.cyan },
  { value: 'admin', label: 'Administrador', help: 'Vê e gerencia tudo', color: colors.lime },
];

/** Somente administradores: define quem é corredor, organizador ou administrador */
export default function UsersScreen() {
  const { isAdmin, session, refreshProfile } = useAuth();
  const [search, setSearch] = useState('');
  const q = useAsync(async () => unwrap(await supabase.from('profiles').select('*').order('full_name')) as Profile[], []);

  if (!isAdmin) {
    return (
      <Screen bottomInset={false}>
        <BackHeader title="Administradores" />
        <EmptyState icon="lock-closed" title="Acesso restrito" message="Somente administradores podem gerenciar acessos." />
      </Screen>
    );
  }
  if (q.loading) return <Loading />;

  const users = (q.data ?? []).filter((u) => `${u.full_name ?? ''} ${u.email ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  const count = (r: UserRole) => (q.data ?? []).filter((u) => u.role === r).length;

  async function setRole(u: Profile, role: UserRole) {
    if (u.role === role) return;
    const { error } = await supabase.rpc('set_user_role', { p_user_id: u.id, p_role: role });
    if (error) return Alert.alert('Não foi possível alterar', error.message);
    q.setData((q.data ?? []).map((x) => (x.id === u.id ? { ...x, role } : x)));
    if (u.id === session?.user.id) refreshProfile();
  }

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh} bottomInset={false}>
      <BackHeader title="Administradores e acessos" />
      <Muted style={{ marginBottom: 12 }}>
        Quem criar conta no app entra como <Text style={{ color: colors.text, fontWeight: '700' }}>Corredor</Text>. Promova aqui quem vai cuidar do conteúdo das corridas.
      </Muted>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {ROLES.map((r) => (
          <View key={r.value} style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: r.color, fontWeight: '900', fontSize: 20 }}>{count(r.value)}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>{r.label}</Text>
          </View>
        ))}
      </View>
      <Input icon="search" placeholder="Buscar por nome ou e-mail" value={search} onChangeText={setSearch} autoCapitalize="none" />

      {users.map((u) => (
        <Card key={u.id} animated={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Avatar uri={u.avatar_url} name={u.full_name} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={[font.h3, { color: colors.text }]}>{u.full_name ?? '—'}{u.id === session?.user.id ? ' (você)' : ''}</Text>
              <Muted style={{ fontSize: 12 }}>{u.email}</Muted>
            </View>
          </View>
          <View style={{ flexDirection: 'row' }}>
            {ROLES.map((r) => (
              <Chip key={r.value} label={r.label} active={u.role === r.value} color={r.value === 'athlete' ? colors.surfaceAlt : r.color} onPress={() => setRole(u, r.value)} />
            ))}
          </View>
          <Muted style={{ fontSize: 11, marginTop: 6 }}>{ROLES.find((r) => r.value === u.role)?.help}</Muted>
        </Card>
      ))}
    </Screen>
  );
}
