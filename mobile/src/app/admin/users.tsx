import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { BackHeader } from '@/components/Header';
import { Avatar, Badge, Card, Chip, EmptyState, GradientButton, IconButton, Input, Loading, Muted, Screen } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { supabase, unwrap } from '@/lib/supabase';
import type { Profile, UserRole } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { colors, font } from '@/theme';

const ADMIN_GERAL = 'mapl11@hotmail.com';
const ROLES: { value: UserRole; label: string; help: string; color: string }[] = [
  { value: 'athlete', label: 'Corredor', help: 'Inscreve-se nas corridas, registra treinos e publica no mural', color: colors.surfaceAlt },
  { value: 'admin', label: 'Administrador', help: 'Organiza as corridas e gerencia todo o conteúdo e os acessos', color: colors.lime },
];

/** Controle de acesso (st_usuarios) — somente administradores */
export default function UsersScreen() {
  const { isAdmin, session, refreshProfile } = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | UserRole | 'inativos'>('all');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ email: '', full_name: '', role: 'admin' as UserRole });
  const q = useAsync(async () => unwrap(await supabase.from('st_usuarios').select('*').order('criado_em', { ascending: false })) as Profile[], []);

  if (!isAdmin) {
    return (
      <Screen bottomInset={false}>
        <BackHeader title="Controle de acesso" />
        <EmptyState icon="lock-closed" title="Acesso restrito" message="Somente administradores podem gerenciar acessos." />
      </Screen>
    );
  }
  if (q.loading) return <Loading />;

  const all = q.data ?? [];
  const users = all
    .filter((u) => (filter === 'all' ? true : filter === 'inativos' ? !u.ativo : u.role === filter && u.ativo))
    .filter((u) => `${u.full_name ?? ''} ${u.email ?? ''}`.toLowerCase().includes(search.toLowerCase()));

  async function update(u: Profile, patch: Partial<Profile>) {
    const { error } = await supabase.from('st_usuarios').update(patch).eq('id', u.id);
    if (error) return Alert.alert('Não foi possível alterar', error.message);
    q.setData(all.map((x) => (x.id === u.id ? { ...x, ...patch } : x)));
    if (u.user_id === session?.user.id) refreshProfile();
  }

  function remove(u: Profile) {
    Alert.alert('Remover acesso?', `${u.email} deixa de acessar o Street Running.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('st_usuarios').delete().eq('id', u.id);
          if (error) return Alert.alert('Erro', error.message);
          q.setData(all.filter((x) => x.id !== u.id));
        },
      },
    ]);
  }

  async function add() {
    const email = form.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return Alert.alert('Informe um e-mail válido');
    const { error } = await supabase.from('st_usuarios').insert({ email, full_name: form.full_name.trim(), role: form.role });
    if (error) return Alert.alert('Não foi possível cadastrar', /duplicate|unique/i.test(error.message) ? 'Este e-mail já está cadastrado.' : error.message);
    setAdding(false);
    setForm({ email: '', full_name: '', role: 'admin' });
    q.reload();
    Alert.alert('Acesso cadastrado ✓', `Peça para ${email} criar a conta no app com este e-mail (ou entrar, se já tiver conta). O acesso é liberado automaticamente.`);
  }

  const count = (r: UserRole) => all.filter((u) => u.role === r && u.ativo).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen refreshing={q.refreshing} onRefresh={q.refresh} bottomInset={false}>
        <BackHeader title="Controle de acesso" right={<IconButton icon="person-add" bg={colors.primary} onPress={() => setAdding(true)} />} />
        <Muted style={{ marginBottom: 12 }}>
          Quem cria conta no app entra como <Text style={{ color: colors.text, fontWeight: '700' }}>Corredor</Text>. Cadastre aqui os administradores que vão organizar as corridas.
        </Muted>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <Counter label="Administradores" value={count('admin')} color={colors.lime} />
          <Counter label="Corredores" value={count('athlete')} color={colors.text} />
          <Counter label="Desativados" value={all.filter((u) => !u.ativo).length} color={colors.danger} />
        </View>

        <Input icon="search" placeholder="Buscar por nome ou e-mail" value={search} onChangeText={setSearch} autoCapitalize="none" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          <Chip label="Todos" active={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label="Administradores" active={filter === 'admin'} color={colors.lime} onPress={() => setFilter('admin')} />
          <Chip label="Corredores" active={filter === 'athlete'} onPress={() => setFilter('athlete')} />
          <Chip label="Desativados" active={filter === 'inativos'} color={colors.danger} onPress={() => setFilter('inativos')} />
        </ScrollView>

        {!users.length ? <EmptyState icon="people" title="Ninguém por aqui" /> : null}
        {users.map((u) => {
          const geral = u.email === ADMIN_GERAL;
          const me = u.user_id === session?.user.id;
          return (
            <Card key={u.id} animated={false} style={!u.ativo ? { opacity: 0.6 } : undefined}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <Avatar uri={u.avatar_url} name={u.full_name || u.email} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={[font.h3, { color: colors.text }]}>
                    {u.full_name || '—'}
                    {me ? ' (você)' : ''}
                  </Text>
                  <Muted style={{ fontSize: 12 }}>{u.email}</Muted>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                    {geral ? <Badge label="Admin geral" color={colors.lime} /> : null}
                    {!u.user_id ? <Badge label="Aguardando 1º acesso" color={colors.warning} /> : null}
                    {!u.ativo ? <Badge label="Desativado" color={colors.danger} /> : null}
                  </View>
                </View>
                {!geral ? (
                  <Pressable onPress={() => remove(u)} hitSlop={10}>
                    <Ionicons name="trash-outline" size={18} color={colors.textDim} />
                  </Pressable>
                ) : null}
              </View>
              {geral ? (
                <Muted style={{ fontSize: 12 }}>Administrador geral: sempre tem acesso total.</Muted>
              ) : (
                <>
                  <View style={{ flexDirection: 'row' }}>
                    {ROLES.map((r) => (
                      <Chip key={r.value} label={r.label} active={u.role === r.value} color={r.color} onPress={() => u.role !== r.value && update(u, { role: r.value })} />
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                    <Muted style={{ fontSize: 12, flex: 1 }}>{ROLES.find((r) => r.value === u.role)?.help}</Muted>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginRight: 6 }}>Ativo</Text>
                    <Switch value={u.ativo} onValueChange={(v) => update(u, { ativo: v })} trackColor={{ true: colors.success }} />
                  </View>
                </>
              )}
            </Card>
          );
        })}
      </Screen>

      <Modal visible={adding} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAdding(false)}>
        <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingTop: 24 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={[font.h2, { color: colors.text, flex: 1 }]}>Cadastrar acesso</Text>
            <IconButton icon="close" onPress={() => setAdding(false)} />
          </View>
          <Muted style={{ marginBottom: 16 }}>
            A pessoa cria a conta no app com este e-mail (ou entra, se já tiver) e recebe automaticamente o papel escolhido.
          </Muted>
          <Input label="E-mail *" icon="mail-outline" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} autoCapitalize="none" keyboardType="email-address" />
          <Input label="Nome" icon="person-outline" value={form.full_name} onChangeText={(v) => setForm({ ...form, full_name: v })} />
          <Text style={[font.tiny, { color: colors.textMuted, marginBottom: 8 }]}>Papel</Text>
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            {ROLES.map((r) => (
              <Chip key={r.value} label={r.label} active={form.role === r.value} color={r.color} onPress={() => setForm({ ...form, role: r.value })} />
            ))}
          </View>
          <Muted style={{ fontSize: 12, marginBottom: 20 }}>{ROLES.find((r) => r.value === form.role)?.help}</Muted>
          <GradientButton title="Cadastrar" icon="checkmark" onPress={add} />
        </ScrollView>
      </Modal>
    </View>
  );
}

function Counter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ color, fontWeight: '900', fontSize: 20 }}>{value}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 11 }}>{label}</Text>
    </View>
  );
}
