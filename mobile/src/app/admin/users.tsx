import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { BackHeader } from '@/components/Header';
import { Avatar, Badge, Card, Chip, EmptyState, GradientButton, IconButton, Input, Loading, Muted, Screen } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { generatePassword } from '@/lib/password';
import { supabase, unwrap } from '@/lib/supabase';
import type { Profile, UserRole } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { colors, font, themed } from '@/theme';
import { t } from '@/i18n';

const ADMIN_GERAL = 'mapl11@hotmail.com';
const ROLES: { value: UserRole; label: string; help: string; color: string }[] = themed(() => [
  { value: 'athlete', label: 'Corredor', help: 'Vê as corridas em que foi associado, registra treinos e participa do mural', color: colors.surfaceAlt },
  { value: 'admin', label: 'Gestor', help: 'Cria as próprias corridas, publica o conteúdo e associa os corredores', color: colors.lime },
]);

/** Controle de acesso (st_usuarios): o admin geral vê todos e cria gestores; o gestor vê só os próprios corredores */
export default function UsersScreen() {
  const { isAdmin, isAdminGeral, session, refreshProfile } = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | UserRole | 'inativos'>('all');
  const [adding, setAdding] = useState(false);
  const emptyForm = () => ({ email: '', full_name: '', password: generatePassword(), role: (isAdminGeral ? 'admin' : 'athlete') as UserRole });
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  // acesso recém-criado: mostra os dados e as opções de envio
  const [created, setCreated] = useState<{ email: string; password: string; name: string } | null>(null);
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
    if (error) return Alert.alert(t('Não foi possível alterar'), t(error.message));
    q.setData(all.map((x) => (x.id === u.id ? { ...x, ...patch } : x)));
    if (u.user_id === session?.user.id) refreshProfile();
  }

  function remove(u: Profile) {
    Alert.alert(t('Remover acesso?'), t('{email} deixa de acessar o Corre+.', { email: u.email ?? '' }), [
      { text: t('Cancelar'), style: 'cancel' },
      {
        text: t('Remover'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('st_usuarios').delete().eq('id', u.id);
          if (error) return Alert.alert(t('Erro'), t(error.message));
          q.setData(all.filter((x) => x.id !== u.id));
        },
      },
    ]);
  }

  async function add() {
    const email = form.email.trim().toLowerCase();
    const password = form.password.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return Alert.alert(t('Informe um e-mail válido'));
    if (password.length < 6) return Alert.alert(t('A senha deve ter pelo menos 6 caracteres'));
    setSaving(true);
    const { data, error } = await supabase.rpc('st_criar_usuario', {
      p_email: email,
      p_full_name: form.full_name.trim(),
      p_role: isAdminGeral ? form.role : 'athlete',
      p_password: password,
    });
    setSaving(false);
    if (error) {
      const msg = /function|schema cache/i.test(error.message)
        ? t('Rode o arquivo supabase/migrations/20261126000006_st_senha_inicial.sql no SQL Editor do Supabase.')
        : /duplicate|unique/i.test(error.message)
          ? t('Este e-mail já está cadastrado.')
          : t(error.message);
      return Alert.alert(t('Não foi possível cadastrar'), msg);
    }
    setAdding(false);
    setForm(emptyForm());
    q.reload();
    if ((data as { status: string }).status === 'ja_tinha_conta') {
      return Alert.alert(
        t('Acesso liberado ✓'),
        t('{email} já tinha login neste servidor, então continua com a senha que já usava. O acesso ao Corre+ foi liberado.', { email }),
      );
    }
    const access = { email, password, name: form.full_name.trim() };
    // espera o modal de cadastro fechar (o iOS não abre dois modais ao mesmo tempo)
    setTimeout(() => setCreated(access), 450);
  }

  const count = (r: UserRole) => all.filter((u) => u.role === r && u.ativo).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen refreshing={q.refreshing} onRefresh={q.refresh} bottomInset={false}>
        <BackHeader title={isAdminGeral ? 'Controle de acesso' : 'Meus corredores'} right={<IconButton icon="person-add" bg={colors.primary} onPress={() => setAdding(true)} />} />
        <Muted style={{ marginBottom: 12 }}>
          {isAdminGeral ? (
            <>
              {t('Cadastre aqui os')} <Text style={{ color: colors.text, fontWeight: '700' }}>{t('gestores')}</Text> {t('que compraram o app. Cada gestor cria as próprias corridas e associa os corredores dele.')}
            </>
          ) : (
            <>{t('Seus corredores: quem você cadastrou ou associou às suas corridas. Para colocar alguém numa corrida, use Corredores da corrida.')}</>
          )}
        </Muted>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {isAdminGeral ? <Counter label="Gestores" value={count('admin')} color={colors.lime} /> : null}
          <Counter label="Corredores" value={count('athlete')} color={colors.text} />
          <Counter label="Desativados" value={all.filter((u) => !u.ativo).length} color={colors.danger} />
        </View>

        <Input icon="search" placeholder="Buscar por nome ou e-mail" value={search} onChangeText={setSearch} autoCapitalize="none" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          <Chip label="Todos" active={filter === 'all'} onPress={() => setFilter('all')} />
          {isAdminGeral ? <Chip label="Gestores" active={filter === 'admin'} color={colors.lime} onPress={() => setFilter('admin')} /> : null}
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
                    {me ? ` (${t('você')})` : ''}
                  </Text>
                  <Muted style={{ fontSize: 12 }}>{u.email}</Muted>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                    {geral ? <Badge label="Admin geral" color={colors.lime} /> : null}
                    {!u.user_id ? <Badge label="Aguardando 1º acesso" color={colors.warning} /> : null}
                    {!u.ativo ? <Badge label="Desativado" color={colors.danger} /> : null}
                  </View>
                </View>
                <Pressable onPress={() => setEditing(u)} hitSlop={10} accessibilityLabel={t('Editar')} style={{ marginRight: geral ? 0 : 14 }}>
                  <Ionicons name="create-outline" size={19} color={colors.text} />
                </Pressable>
                {!geral ? (
                  <Pressable onPress={() => remove(u)} hitSlop={10} accessibilityLabel={t('Remover')}>
                    <Ionicons name="trash-outline" size={18} color={colors.textDim} />
                  </Pressable>
                ) : null}
              </View>
              {geral ? (
                <Muted style={{ fontSize: 12 }}>Administrador geral: sempre tem acesso total.</Muted>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', display: isAdminGeral ? 'flex' : 'none' }}>
                    {ROLES.map((r) => (
                      <Chip key={r.value} label={r.label} active={u.role === r.value} color={r.color} onPress={() => u.role !== r.value && update(u, { role: r.value })} />
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                    <Muted style={{ fontSize: 12, flex: 1 }}>{t(ROLES.find((r) => r.value === u.role)?.help ?? '')}</Muted>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginRight: 6 }}>{t('Ativo')}</Text>
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
            <Text style={[font.h2, { color: colors.text, flex: 1 }]}>{t('Cadastrar acesso')}</Text>
            <IconButton icon="close" onPress={() => setAdding(false)} />
          </View>
          <Muted style={{ marginBottom: 16 }}>
            {t('A pessoa entra no app com este e-mail e a senha inicial, já com o papel escolhido. Depois ela pode trocar a senha em Meu perfil.')}
          </Muted>
          <Input label="E-mail *" icon="mail-outline" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} autoCapitalize="none" keyboardType="email-address" />
          <Input label="Nome" icon="person-outline" value={form.full_name} onChangeText={(v) => setForm({ ...form, full_name: v })} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Input
                label="Senha inicial *"
                icon="key-outline"
                value={form.password}
                onChangeText={(v) => setForm({ ...form, password: v })}
                placeholder="mínimo 6 caracteres"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <Pressable
              onPress={() => setForm({ ...form, password: generatePassword() })}
              accessibilityLabel={t('Gerar senha aleatória')}
              style={({ pressed }) => ({ marginBottom: 16, height: 52, paddingHorizontal: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, opacity: pressed ? 0.7 : 1 })}>
              <Ionicons name="shuffle" size={18} color={colors.lime} />
              <Text style={{ color: colors.text, fontWeight: '800' }}>{t('Gerar')}</Text>
            </Pressable>
          </View>
          <Muted style={{ fontSize: 12, marginTop: -8, marginBottom: 14 }}>{t('Digite uma senha ou toque em Gerar para criar uma aleatória.')}</Muted>
          <Text style={[font.tiny, { color: colors.textMuted, marginBottom: 8, display: isAdminGeral ? 'flex' : 'none' }]}>{t('Papel')}</Text>
          <View style={{ flexDirection: 'row', marginBottom: 6, display: isAdminGeral ? 'flex' : 'none' }}>
            {ROLES.map((r) => (
              <Chip key={r.value} label={r.label} active={form.role === r.value} color={r.color} onPress={() => setForm({ ...form, role: r.value })} />
            ))}
          </View>
          <Muted style={{ fontSize: 12, marginBottom: 20 }}>{t(ROLES.find((r) => r.value === form.role)?.help ?? '')}</Muted>
          <GradientButton title="Cadastrar" icon="checkmark" onPress={add} loading={saving} />
        </ScrollView>
      </Modal>

      <Modal visible={!!editing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditing(null)}>
        {editing ? (
          <EditUser
            user={editing}
            canEditRole={isAdminGeral && editing.email !== ADMIN_GERAL}
            onClose={() => setEditing(null)}
            onSaved={(patch) => {
              q.setData(all.map((x) => (x.id === editing.id ? { ...x, ...patch } : x)));
              if (editing.user_id === session?.user.id) refreshProfile();
              setEditing(null);
            }}
          />
        ) : null}
      </Modal>

      <Modal visible={!!created} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCreated(null)}>
        {created ? <CreatedAccess access={created} onClose={() => setCreated(null)} /> : null}
      </Modal>
    </View>
  );
}

/** Edição de um usuário já cadastrado (nome, contato, papel e, antes do 1º acesso, o e-mail) */
function EditUser({ user, canEditRole, onClose, onSaved }: {
  user: Profile;
  canEditRole: boolean;
  onClose: () => void;
  onSaved: (patch: Partial<Profile>) => void;
}) {
  const [f, setF] = useState({
    full_name: user.full_name ?? '',
    email: user.email ?? '',
    phone: user.phone ?? '',
    city: user.city ?? '',
    instagram: user.instagram ?? '',
    role: user.role,
  });
  const [saving, setSaving] = useState(false);
  // depois do 1º acesso o e-mail é o login da pessoa: não muda por aqui
  const emailLocked = !!user.user_id;

  async function save() {
    const email = f.email.trim().toLowerCase();
    if (!emailLocked && !/^\S+@\S+\.\S+$/.test(email)) return Alert.alert(t('Informe um e-mail válido'));
    const ig = f.instagram.trim().replace(/^@/, '');
    const patch: Partial<Profile> = {
      full_name: f.full_name.trim(),
      phone: f.phone.trim() || null,
      city: f.city.trim() || null,
      instagram: ig ? `@${ig}` : null,
      ...(emailLocked ? {} : { email }),
      ...(canEditRole ? { role: f.role } : {}),
    };
    setSaving(true);
    const { error } = await supabase.from('st_usuarios').update(patch).eq('id', user.id);
    setSaving(false);
    if (error) {
      return Alert.alert(t('Não foi possível alterar'), /duplicate|unique/i.test(error.message) ? t('Este e-mail já está cadastrado.') : t(error.message));
    }
    onSaved(patch);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingTop: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <Text style={[font.h2, { color: colors.text, flex: 1 }]}>{t('Editar cadastro')}</Text>
        <IconButton icon="close" onPress={onClose} />
      </View>
      <Input label="Nome" icon="person-outline" value={f.full_name} onChangeText={(v) => setF({ ...f, full_name: v })} />
      <Input
        label="E-mail"
        icon="mail-outline"
        value={f.email}
        onChangeText={(v) => setF({ ...f, email: v })}
        editable={!emailLocked}
        autoCapitalize="none"
        keyboardType="email-address"
        style={emailLocked ? { color: colors.textMuted } : undefined}
      />
      {emailLocked ? (
        <Muted style={{ fontSize: 12, marginTop: -8, marginBottom: 14 }}>{t('O e-mail é o login da pessoa e não pode ser alterado depois do primeiro acesso.')}</Muted>
      ) : null}
      <Input label="WhatsApp" icon="logo-whatsapp" value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} keyboardType="phone-pad" />
      <Input label="Cidade" icon="location-outline" value={f.city} onChangeText={(v) => setF({ ...f, city: v })} />
      <Input label="Instagram" icon="logo-instagram" value={f.instagram} onChangeText={(v) => setF({ ...f, instagram: v })} autoCapitalize="none" placeholder="@seuperfil" />
      {canEditRole ? (
        <>
          <Text style={[font.tiny, { color: colors.textMuted, marginBottom: 8 }]}>{t('Papel')}</Text>
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            {ROLES.map((r) => (
              <Chip key={r.value} label={r.label} active={f.role === r.value} color={r.color} onPress={() => setF({ ...f, role: r.value })} />
            ))}
          </View>
          <Muted style={{ fontSize: 12, marginBottom: 16 }}>{t(ROLES.find((r) => r.value === f.role)?.help ?? '')}</Muted>
        </>
      ) : null}
      <GradientButton title="Salvar" icon="checkmark" onPress={save} loading={saving} style={{ marginTop: 8 }} />
    </ScrollView>
  );
}

/** Dados do acesso recém-criado + envio por e-mail, WhatsApp ou cópia */
function CreatedAccess({ access, onClose }: { access: { email: string; password: string; name: string }; onClose: () => void }) {
  const first = access.name.split(' ')[0];
  const message = t(
    'Olá{name}! Seu acesso ao Corre+ foi criado.\n\nE-mail: {email}\nSenha provisória: {password}\n\nBaixe o app, entre com esses dados e crie a sua própria senha no primeiro acesso.',
    { name: first ? ` ${first}` : '', email: access.email, password: access.password },
  );
  const subject = t('Seu acesso ao Corre+');

  async function open(url: string, fallback?: string) {
    try {
      await Linking.openURL(url);
    } catch {
      if (fallback) await Linking.openURL(fallback).catch(() => Alert.alert(t('Não foi possível abrir')));
      else Alert.alert(t('Não foi possível abrir'), t('Nenhum app de e-mail configurado neste aparelho. Use Copiar dados.'));
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingTop: 24, paddingBottom: 40 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Text style={[font.h2, { color: colors.text, flex: 1 }]}>{t('Acesso criado ✓')}</Text>
        <IconButton icon="close" onPress={onClose} />
      </View>
      <Muted style={{ marginBottom: 16 }}>{t('Envie os dados para a pessoa. No primeiro acesso, o app pede para ela criar a própria senha.')}</Muted>
      <Card animated={false}>
        <Text style={[font.tiny, { color: colors.textMuted }]}>{t('E-mail')}</Text>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, marginBottom: 10 }} selectable>{access.email}</Text>
        <Text style={[font.tiny, { color: colors.textMuted }]}>{t('Senha provisória')}</Text>
        <Text style={{ color: colors.lime, fontWeight: '900', fontSize: 22, letterSpacing: 1 }} selectable>{access.password}</Text>
      </Card>
      <GradientButton
        title="Enviar por e-mail"
        icon="mail"
        onPress={() => open(`mailto:${access.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`)}
        style={{ marginTop: 8 }}
      />
      <GradientButton
        title="Enviar por WhatsApp"
        icon="logo-whatsapp"
        colorsPair={['#25D366', '#128C7E']}
        onPress={() => open(`whatsapp://send?text=${encodeURIComponent(message)}`, `https://wa.me/?text=${encodeURIComponent(message)}`)}
        style={{ marginTop: 10 }}
      />
      <GradientButton
        title="Copiar dados"
        icon="copy"
        variant="ghost"
        onPress={() => {
          Clipboard.setStringAsync(message)
            .then(() => Alert.alert(t('Copiado ✓')))
            .catch(() => {});
        }}
        style={{ marginTop: 10 }}
      />
      <Text onPress={onClose} style={{ color: colors.textMuted, textAlign: 'center', marginTop: 20 }}>
        {t('Concluir')}
      </Text>
    </ScrollView>
  );
}

function Counter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ color, fontWeight: '900', fontSize: 20 }}>{value}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 11 }}>{t(label)}</Text>
    </View>
  );
}
