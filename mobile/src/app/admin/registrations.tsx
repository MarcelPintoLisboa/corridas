import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { BackHeader } from '@/components/Header';
import { Avatar, Badge, Card, Chip, EmptyState, GradientButton, IconButton, Input, Loading, Muted, Screen } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { levelLabel } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';
import type { EventDistance, Profile } from '@/lib/types';
import { colors, font, radius } from '@/theme';
import { t } from '@/i18n';

interface Row {
  id: string;
  user_id: string;
  bib_number: string | null;
  shirt_size: string | null;
  level: string;
  kit_picked_up: boolean;
  profile: { full_name: string | null; email: string | null; phone: string | null; role: string } | null;
  distance: { label: string } | null;
  anamnese?: string | null;
}

interface Pending {
  id: string;
  level: string;
  usuario: { full_name: string | null; email: string } | null;
  distance: { label: string } | null;
}

const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

/** Corredores da corrida: associar pessoas cadastradas, nº de peito e entrega de kit */
export default function RegistrationsScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [adding, setAdding] = useState(false);

  const q = useAsync(async () => {
    const [regs, pending, distances] = await Promise.all([
      supabase
        .from('st_registrations')
        .select('id,user_id,bib_number,shirt_size,level,kit_picked_up,distance:st_event_distances(label)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .then(unwrap) as unknown as Promise<Omit<Row, 'profile'>[]>,
      supabase
        .from('st_inscricoes_pendentes')
        .select('id,level,usuario:st_usuarios(full_name,email),distance:st_event_distances(label)')
        .eq('event_id', eventId)
        .order('criado_em', { ascending: false })
        .then((r) => (r.error ? [] : (r.data as unknown as Pending[]))),
      api.distances(eventId),
    ]);
    // nomes vêm do controle de acesso (st_usuarios)
    const ids = regs.map((r) => r.user_id);
    const users = ids.length
      ? (unwrap(await supabase.from('st_usuarios').select('user_id,full_name,email,phone,role').in('user_id', ids)) as {
          user_id: string; full_name: string | null; email: string | null; phone: string | null; role: string;
        }[])
      : [];
    const byId = new Map(users.map((u) => [u.user_id, u]));
    // anamneses (sem a migração 0009 a consulta falha e simplesmente não mostra o selo)
    const anam = await supabase.from('st_anamneses').select('user_id,safety_state').eq('event_id', eventId);
    const anamBy = new Map(((anam.data ?? []) as { user_id: string; safety_state: string }[]).map((a) => [a.user_id, a.safety_state]));
    return { rows: regs.map((r) => ({ ...r, profile: byId.get(r.user_id) ?? null, anamnese: anamBy.get(r.user_id) ?? null })) as Row[], pending, distances };
  }, [eventId]);

  if (q.loading || !q.data) return <Loading />;
  const all = q.data.rows;
  const rows = all.filter((r) => {
    if (filter === 'pending' && r.kit_picked_up) return false;
    if (filter === 'done' && !r.kit_picked_up) return false;
    return `${r.profile?.full_name ?? ''} ${r.profile?.email ?? ''} ${r.bib_number ?? ''}`.toLowerCase().includes(search.toLowerCase());
  });

  async function update(id: string, patch: Partial<Row> & { kit_picked_up_at?: string | null }) {
    const { error } = await supabase.from('st_registrations').update(patch).eq('id', id);
    if (error) return Alert.alert(t('Erro'), t(error.message));
    q.setData({ ...q.data!, rows: all.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  }

  function removeRegistration(r: Row) {
    Alert.alert(t('Remover da corrida?'), t('{name} deixa de ver os treinos e o mural desta corrida.', { name: r.profile?.full_name || r.profile?.email || t('Este corredor') }), [
      { text: t('Cancelar'), style: 'cancel' },
      {
        text: t('Remover'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('st_registrations').delete().eq('id', r.id);
          if (error) return Alert.alert(t('Erro'), t(error.message));
          q.reload();
        },
      },
    ]);
  }

  async function removePending(p: Pending) {
    const { error } = await supabase.from('st_inscricoes_pendentes').delete().eq('id', p.id);
    if (error) return Alert.alert(t('Erro'), t(error.message));
    q.reload();
  }

  const done = all.filter((r) => r.kit_picked_up).length;
  const enrolledEmails = new Set([...all.map((r) => r.profile?.email), ...q.data.pending.map((p) => p.usuario?.email)].filter(Boolean) as string[]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen refreshing={q.refreshing} onRefresh={q.refresh} bottomInset={false}>
        <BackHeader title="Corredores da corrida" right={<IconButton icon="person-add" bg={colors.primary} onPress={() => setAdding(true)} />} />
        <Muted style={{ marginTop: -8, marginBottom: 12 }}>
          {t('{n} inscritos', { n: all.length })} · {t('{n} kits retirados', { n: done })}{q.data.pending.length ? ` · ${t('{n} aguardando 1º acesso', { n: q.data.pending.length })}` : ''}
        </Muted>

        <GradientButton title="Associar corredor cadastrado" icon="person-add" onPress={() => setAdding(true)} style={{ marginBottom: 14 }} />

        {q.data.pending.length ? (
          <Card animated={false} style={{ borderColor: colors.warning }}>
            <Text style={{ color: colors.text, fontWeight: '800', marginBottom: 4 }}>{t('Aguardando 1º acesso')}</Text>
            <Muted style={{ fontSize: 12, marginBottom: 8 }}>São inscritos automaticamente quando entrarem no app com este e-mail.</Muted>
            {q.data.pending.map((p) => (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{p.usuario?.full_name || p.usuario?.email}</Text>
                  <Muted style={{ fontSize: 12 }}>
                    {p.usuario?.email} · {p.distance?.label ?? t('sem distância')} · {levelLabel[p.level]}
                  </Muted>
                </View>
                <Pressable onPress={() => removePending(p)} hitSlop={10}>
                  <Ionicons name="close-circle" size={22} color={colors.textDim} />
                </Pressable>
              </View>
            ))}
          </Card>
        ) : null}

        <Input icon="search" placeholder="Nome, e-mail ou nº de peito" value={search} onChangeText={setSearch} />
        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          <Chip label="Todos" active={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label="Kit pendente" active={filter === 'pending'} onPress={() => setFilter('pending')} />
          <Chip label="Kit retirado" active={filter === 'done'} color={colors.success} onPress={() => setFilter('done')} />
        </View>
        {!rows.length ? <EmptyState icon="people" title="Nenhum inscrito" message="Associe corredores cadastrados ou aguarde as inscrições pelo app." /> : null}
        {rows.map((r) => (
          <Card key={r.id} animated={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={[font.h3, { color: colors.text }]}>{r.profile?.full_name || '—'}</Text>
                <Muted style={{ fontSize: 12 }}>{r.profile?.email}</Muted>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {r.profile?.role === 'admin' ? <Badge label="Admin" color={colors.lime} /> : null}
                  {r.distance ? <Badge label={r.distance.label} color={colors.primary} /> : null}
                  <Badge label={levelLabel[r.level]} color={colors.textMuted} />
                  <Pressable onPress={() => router.push(`/admin/anamnese?eventId=${eventId}&userId=${r.user_id}`)} hitSlop={6}>
                    <Badge
                      label={t(r.anamnese === 'eligible' ? 'Anamnese ✓' : r.anamnese === 'urgency' ? 'Triagem: urgência' : r.anamnese ? 'Triagem: avaliar' : 'Sem anamnese')}
                      color={r.anamnese === 'eligible' ? colors.success : r.anamnese === 'urgency' ? colors.danger : r.anamnese ? colors.warning : colors.textDim}
                    />
                  </Pressable>
                  {r.shirt_size ? <Badge label={`${t('Cam.')} ${r.shirt_size}`} color={colors.cyan} /> : null}
                </View>
              </View>
              <TextInput
                defaultValue={r.bib_number ?? ''}
                placeholder="Nº"
                placeholderTextColor={colors.textDim}
                keyboardType="number-pad"
                onEndEditing={(e) => update(r.id, { bib_number: e.nativeEvent.text || null })}
                style={{ width: 64, height: 44, borderRadius: radius.sm, backgroundColor: colors.bgElevated, color: colors.text, textAlign: 'center', fontWeight: '900', fontSize: 16, borderWidth: 1, borderColor: colors.border }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Pressable
                onPress={() => update(r.id, { kit_picked_up: !r.kit_picked_up, kit_picked_up_at: !r.kit_picked_up ? new Date().toISOString() : null })}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: r.kit_picked_up ? colors.success : colors.surfaceAlt }}>
                <Ionicons name={r.kit_picked_up ? 'checkmark-circle' : 'cube-outline'} size={18} color={r.kit_picked_up ? '#000' : colors.text} />
                <Text style={{ color: r.kit_picked_up ? '#000' : colors.text, fontWeight: '800' }}>{t(r.kit_picked_up ? 'Kit entregue' : 'Marcar kit entregue')}</Text>
              </Pressable>
              <Pressable onPress={() => removeRegistration(r)} style={{ width: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceAlt }}>
                <Ionicons name="person-remove-outline" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          </Card>
        ))}
      </Screen>

      <AssociateModal
        visible={adding}
        eventId={eventId}
        distances={q.data.distances}
        enrolledEmails={enrolledEmails}
        onClose={() => setAdding(false)}
        onDone={() => q.reload()}
      />
    </View>
  );
}

function AssociateModal({ visible, eventId, distances, enrolledEmails, onClose, onDone }: {
  visible: boolean;
  eventId: string;
  distances: EventDistance[];
  enrolledEmails: Set<string>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<(Pick<Profile, 'id' | 'email' | 'full_name' | 'avatar_url'> & { byEmail?: boolean }) | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [distanceId, setDistanceId] = useState<string | null>(null);
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('beginner');
  const [saving, setSaving] = useState(false);
  const users = useAsync(
    async () => (visible ? (unwrap(await supabase.from('st_usuarios').select('*').eq('ativo', true).order('full_name')) as Profile[]) : []),
    [visible],
  );

  function close() {
    setPicked(null);
    setSearch('');
    setNewEmail('');
    setNewName('');
    setDistanceId(null);
    setLevel('beginner');
    onClose();
  }

  async function save() {
    if (!picked) return;
    setSaving(true);
    const { data, error } = picked.byEmail
      ? await supabase.rpc('st_associar_corredor_email', { p_event_id: eventId, p_email: picked.email, p_full_name: picked.full_name, p_distance_id: distanceId, p_level: level })
      : await supabase.rpc('st_associar_corredor', { p_event_id: eventId, p_usuario_id: picked.id, p_distance_id: distanceId, p_level: level });
    if (error) {
      setSaving(false);
      return Alert.alert(t('Não foi possível associar'), /function|schema cache/i.test(error.message) ? t('Rode os arquivos supabase/migrations/20261126000003_st_corredores.sql e 20261126000004_st_gestores.sql no SQL Editor do Supabase.') : t(error.message));
    }
    // e-mail de boas-vindas (Edge Function st-boas-vindas); se não estiver configurada, só avisa
    let mail = '';
    if (picked.email) {
      const res = await supabase.functions.invoke('st-boas-vindas', { body: { event_id: eventId, email: picked.email } });
      if (!res.error) mail = t('E-mail de boas-vindas enviado para {email}.', { email: picked.email });
      else {
        // lê o motivo devolvido pela função (ex.: Resend em modo de teste só envia para o e-mail da conta)
        let status = 0;
        let detail = '';
        try {
          const ctx = (res.error as { context?: Response }).context;
          status = ctx?.status ?? 0;
          const body = await ctx?.json();
          detail = body?.detail?.message ?? body?.error ?? '';
        } catch {}
        mail =
          status === 404 || !status
            ? t('O e-mail de boas-vindas não foi enviado (configure a função st-boas-vindas no Supabase).')
            : /testing emails|verify a domain|own email/i.test(detail)
              ? t('O e-mail de boas-vindas não foi enviado: o Resend ainda está em modo de teste e só envia para o e-mail da sua conta. Verifique o domínio no Resend para enviar a todos.')
              : t('O e-mail de boas-vindas não foi enviado: {detail}', { detail: detail || `HTTP ${status}` });
      }
    }
    setSaving(false);
    onDone();
    Alert.alert(
      t(data === 'pendente' ? 'Associado — aguardando 1º acesso' : 'Corredor associado ✓'),
      (data === 'pendente'
        ? t('{email} ainda não entrou no app. A inscrição é feita automaticamente no primeiro acesso.', { email: picked.email ?? '' })
        : t('{name} já vê os treinos, o mural e as informações desta corrida.', { name: picked.full_name || picked.email || '' })) +
        (mail ? `\n\n${mail}` : ''),
    );
    close();
  }

  const list = (users.data ?? []).filter((u) => `${u.full_name ?? ''} ${u.email ?? ''}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingTop: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={[font.h2, { color: colors.text, flex: 1 }]}>{t('Associar corredor')}</Text>
          <IconButton icon="close" onPress={close} />
        </View>
        <Muted style={{ marginBottom: 14 }}>Informe o e-mail do corredor ou escolha alguém que você já cadastrou. Gestores também podem correr.</Muted>

        {!picked ? (
          <>
            <Card animated={false}>
              <Text style={{ color: colors.text, fontWeight: '800', marginBottom: 8 }}>{t('Pelo e-mail')}</Text>
              <Input icon="mail-outline" placeholder="email@docorredor.com" value={newEmail} onChangeText={setNewEmail} autoCapitalize="none" keyboardType="email-address" />
              <Input icon="person-outline" placeholder="Nome (opcional)" value={newName} onChangeText={setNewName} />
              <GradientButton
                small
                title="Continuar"
                icon="arrow-forward"
                disabled={!/^\S+@\S+\.\S+$/.test(newEmail.trim())}
                onPress={() => {
                  const email = newEmail.trim().toLowerCase();
                  if (enrolledEmails.has(email)) return Alert.alert(t('Já está na corrida'), t('{email} já está associado a esta corrida.', { email }));
                  setPicked({ id: '', email, full_name: newName.trim() || null, avatar_url: null, byEmail: true });
                }}
              />
              <Muted style={{ fontSize: 11, marginTop: 8 }}>Se a pessoa ainda não tem conta, ela entra no app com este e-mail e já encontra a corrida.</Muted>
            </Card>
            <Text style={[font.tiny, { color: colors.textMuted, marginTop: 10, marginBottom: 8 }]}>{t('Ou escolha alguém já cadastrado')}</Text>
            <Input icon="search" placeholder="Buscar por nome ou e-mail" value={search} onChangeText={setSearch} autoCapitalize="none" />
            {users.loading ? <Loading /> : null}
            {!users.loading && !list.length ? <EmptyState icon="people" title="Ninguém encontrado" message="Cadastre a pessoa em Controle de acesso." /> : null}
            {list.map((u) => {
              const already = !!u.email && enrolledEmails.has(u.email);
              return (
                <Pressable key={u.id} disabled={already} onPress={() => setPicked(u)} style={({ pressed }) => ({ opacity: already ? 0.45 : pressed ? 0.7 : 1 })}>
                  <Card animated={false} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Avatar uri={u.avatar_url} name={u.full_name || u.email} size={38} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '800' }}>{u.full_name || '—'}</Text>
                      <Muted style={{ fontSize: 12 }}>{u.email}</Muted>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                        {u.role === 'admin' ? <Badge label="Admin" color={colors.lime} /> : <Badge label="Corredor" color={colors.textMuted} />}
                        {!u.user_id ? <Badge label="Sem 1º acesso" color={colors.warning} /> : null}
                        {already ? <Badge label="Já está na corrida" color={colors.success} /> : null}
                      </View>
                    </View>
                    {!already ? <Ionicons name="chevron-forward" size={18} color={colors.textDim} /> : null}
                  </Card>
                </Pressable>
              );
            })}
          </>
        ) : (
          <>
            <Card animated={false} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar uri={picked.avatar_url} name={picked.full_name || picked.email} size={42} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{picked.full_name || '—'}</Text>
                <Muted style={{ fontSize: 12 }}>{picked.email}</Muted>
              </View>
              <Text onPress={() => setPicked(null)} style={{ color: colors.primary, fontWeight: '700' }}>{t('Trocar')}</Text>
            </Card>

            <Text style={[font.tiny, { color: colors.textMuted, marginBottom: 8, marginTop: 6 }]}>{t('Distância')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
              {distances.length ? (
                distances.map((d) => <Chip key={d.id} label={d.label} active={distanceId === d.id} onPress={() => setDistanceId(d.id)} />)
              ) : (
                <Muted style={{ fontSize: 12 }}>Cadastre as distâncias da corrida para escolher aqui.</Muted>
              )}
            </View>

            <Text style={[font.tiny, { color: colors.textMuted, marginBottom: 8, marginTop: 6 }]}>{t('Nível')}</Text>
            <View style={{ flexDirection: 'row', marginBottom: 20 }}>
              {LEVELS.map((l) => (
                <Chip key={l} label={levelLabel[l]} active={level === l} onPress={() => setLevel(l)} />
              ))}
            </View>

            <GradientButton title="Associar à corrida" icon="checkmark" loading={saving} disabled={distances.length > 0 && !distanceId} onPress={save} />
            {distances.length > 0 && !distanceId ? <Muted style={{ fontSize: 12, marginTop: 8, textAlign: 'center' }}>Escolha a distância</Muted> : null}
          </>
        )}
      </ScrollView>
    </Modal>
  );
}
