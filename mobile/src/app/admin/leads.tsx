import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { BackHeader } from '@/components/Header';
import { Badge, Card, EmptyState, GradientButton, IconButton, Input, Loading, Muted, Screen } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { formatDate, leadStatusColor, leadStatusLabel } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';
import type { Lead, LeadStatus } from '@/lib/types';
import { alpha, colors, font, radius } from '@/theme';

const STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'converted', 'lost'];
const sourceLabel: Record<string, string> = { app: 'App', instagram: 'Instagram', sponsor: 'Patrocinador', landing: 'Landing page', referral: 'Indicação', event: 'Evento', import: 'Importação' };

export default function LeadsScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const [status, setStatus] = useState<LeadStatus | null>(null);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', interest: '' });

  const q = useAsync(
    async () => unwrap(await supabase.from('st_leads').select('*').eq('event_id', eventId).order('created_at', { ascending: false })) as Lead[],
    [eventId],
  );
  const { reload } = q;
  useFocusEffect(
    useCallback(() => {
      reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    (q.data ?? []).forEach((l) => (c[l.status] = (c[l.status] ?? 0) + 1));
    return c;
  }, [q.data]);

  if (q.loading) return <Loading />;
  const leads = (q.data ?? []).filter(
    (l) => (!status || l.status === status) && `${l.name} ${l.email ?? ''} ${l.phone ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  );
  const total = q.data?.length ?? 0;

  async function exportCsv() {
    const header = 'nome;email;telefone;cidade;origem;status;interesse;score;consentimento;tags;criado_em';
    const lines = (q.data ?? []).map((l) =>
      [l.name, l.email, l.phone, l.city, sourceLabel[l.source], leadStatusLabel[l.status], l.interest, l.score, l.consent_marketing ? 'sim' : 'não', l.tags.join('|'), l.created_at]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(';'),
    );
    const file = new File(Paths.cache, `leads-${Date.now()}.csv`);
    file.create();
    file.write('﻿' + [header, ...lines].join('\n'));
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Exportar leads', UTI: 'public.comma-separated-values-text' });
  }

  async function addLead() {
    if (!form.name) return Alert.alert('Informe o nome');
    const { error } = await supabase.from('st_leads').insert({ event_id: eventId, ...form, email: form.email.toLowerCase() || null, source: 'event', consent_marketing: true });
    if (error) return Alert.alert('Erro', error.message);
    setAdding(false);
    setForm({ name: '', email: '', phone: '', interest: '' });
    q.reload();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen refreshing={q.refreshing} onRefresh={q.refresh} bottomInset={false}>
        <BackHeader
          title="Leads"
          right={
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <IconButton icon="download-outline" onPress={exportCsv} />
              <IconButton icon="person-add" bg={colors.primary} onPress={() => setAdding(true)} />
            </View>
          }
        />

        {/* Funil */}
        <Card animated={false}>
          <Text style={[font.tiny, { color: colors.textMuted, marginBottom: 10 }]}>Funil · {total} leads</Text>
          {STATUSES.map((s) => {
            const n = counts[s] ?? 0;
            const pct = total ? n / total : 0;
            return (
              <Pressable key={s} onPress={() => setStatus(status === s ? null : s)} style={{ marginBottom: 8, opacity: status && status !== s ? 0.4 : 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{leadStatusLabel[s]}</Text>
                  <Text style={{ color: leadStatusColor[s], fontWeight: '800' }}>{n}</Text>
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.bgElevated, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.max(pct * 100, 2)}%`, height: '100%', backgroundColor: leadStatusColor[s], borderRadius: 4 }} />
                </View>
              </Pressable>
            );
          })}
        </Card>

        <Input icon="search" placeholder="Buscar por nome, e-mail ou telefone" value={search} onChangeText={setSearch} />

        {!leads.length ? <EmptyState icon="magnet" title="Nenhum lead" message="Leads chegam pelo botão 'quero ser avisado', inscrições no app ou cadastro manual." /> : null}
        {leads.map((l, i) => (
          <Card key={l.id} delay={Math.min(i, 10) * 30} onPress={() => router.push(`/admin/lead/${l.id}`)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 8, alignSelf: 'stretch', borderRadius: 4, backgroundColor: leadStatusColor[l.status] }} />
              <View style={{ flex: 1 }}>
                <Text style={[font.h3, { color: colors.text }]}>{l.name}</Text>
                <Muted style={{ fontSize: 12 }}>{[l.email, l.phone].filter(Boolean).join(' · ')}</Muted>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <Badge label={leadStatusLabel[l.status]} color={leadStatusColor[l.status]} />
                  <Badge label={sourceLabel[l.source]} color={colors.textMuted} />
                  {l.interest ? <Badge label={l.interest} color={colors.lime} /> : null}
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: l.score >= 70 ? colors.success : l.score >= 40 ? colors.warning : colors.textMuted, fontWeight: '900', fontSize: 18 }}>{l.score}</Text>
                <Text style={{ color: colors.textDim, fontSize: 10 }}>{formatDate(l.created_at)}</Text>
              </View>
            </View>
          </Card>
        ))}
      </Screen>

      <Modal visible={adding} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAdding(false)}>
        <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingTop: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Text style={[font.h2, { color: colors.text, flex: 1 }]}>Novo lead</Text>
            <IconButton icon="close" onPress={() => setAdding(false)} />
          </View>
          <Input label="Nome *" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
          <Input label="E-mail" value={form.email} autoCapitalize="none" keyboardType="email-address" onChangeText={(v) => setForm({ ...form, email: v })} />
          <Input label="WhatsApp" value={form.phone} keyboardType="phone-pad" onChangeText={(v) => setForm({ ...form, phone: v })} />
          <Input label="Interesse" placeholder="ex: 21K" value={form.interest} onChangeText={(v) => setForm({ ...form, interest: v })} />
          <GradientButton title="Salvar lead" icon="checkmark" onPress={addLead} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, padding: 12, borderRadius: radius.md, backgroundColor: alpha(colors.cyan, 0.08) }}>
            <Ionicons name="information-circle" size={18} color={colors.cyan} />
            <Muted style={{ fontSize: 12, flex: 1 }}>Use para leads captados em feiras, stands de patrocinadores ou eventos presenciais.</Muted>
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}
