import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';

import { BackHeader } from '@/components/Header';
import { Avatar, Badge, Card, GradientButton, Input, Loading, Muted, Screen, SectionHeader } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { formatDateTime, leadStatusColor, leadStatusLabel } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';
import type { Lead, LeadInteraction, LeadStatus } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { alpha, colors, font, radius } from '@/theme';
import { t } from '@/i18n';

const STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'converted', 'lost'];
const typeIcon = { note: 'document-text', email: 'mail', whatsapp: 'logo-whatsapp', call: 'call', status_change: 'swap-horizontal' } as const;

export default function LeadDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string | null>(null);

  const q = useAsync(async () => {
    const [lead, interactions] = await Promise.all([
      supabase.from('st_leads').select('*, event:st_events(name)').eq('id', id).single().then(unwrap),
      supabase.from('st_lead_interactions').select('*').eq('lead_id', id).order('created_at', { ascending: false }).then(unwrap),
    ]);
    return { lead: lead as Lead & { event: { name: string } | null }, interactions: interactions as LeadInteraction[] };
  }, [id]);

  if (q.loading || !q.data) return <Loading />;
  const { lead, interactions } = q.data;

  async function log(type: LeadInteraction['type'], content: string) {
    await supabase.from('st_lead_interactions').insert({ lead_id: id, type, content, created_by: session!.user.id });
  }

  async function setStatus(s: LeadStatus) {
    if (s === lead.status) return;
    const score = { new: 30, contacted: 50, qualified: 75, converted: 100, lost: 0 }[s];
    const { error } = await supabase.from('st_leads').update({ status: s, score }).eq('id', id);
    if (error) return Alert.alert(t('Erro'), error.message);
    await log('status_change', `${leadStatusLabel[lead.status]} → ${leadStatusLabel[s]}`);
    q.reload();
  }

  async function contact(type: 'whatsapp' | 'email' | 'call') {
    const phone = (lead.phone ?? '').replace(/\D/g, '');
    const first = lead.name.split(' ')[0];
    const event = lead.event?.name ?? t('nossa corrida');
    const msg = encodeURIComponent(t('Olá {first}! Aqui é da organização da {event} 🏃 Ainda dá tempo de garantir seu kit! Posso te ajudar?', { first, event }));
    const url =
      type === 'whatsapp'
        ? `https://wa.me/${phone.length <= 11 ? '55' + phone : phone}?text=${msg}`
        : type === 'email'
          ? `mailto:${lead.email}?subject=${encodeURIComponent(event)}&body=${msg}`
          : `tel:${phone}`;
    await Linking.openURL(url).catch(() => Alert.alert(t('Não foi possível abrir')));
    await log(type, t(type === 'whatsapp' ? 'Mensagem de WhatsApp enviada' : type === 'email' ? 'E-mail enviado' : 'Ligação realizada'));
    if (lead.status === 'new') await setStatus('contacted');
    else q.reload();
  }

  async function addNote() {
    if (!note.trim()) return;
    await log('note', note.trim());
    setNote('');
    q.reload();
  }

  async function saveTags() {
    const arr = (tags ?? '').split(',').map((v) => v.trim()).filter(Boolean);
    await supabase.from('st_leads').update({ tags: arr }).eq('id', id);
    setTags(null);
    q.reload();
  }

  return (
    <Screen bottomInset={false} refreshing={q.refreshing} onRefresh={q.refresh}>
      <BackHeader title="Lead" />
      <Card animated={false} style={{ alignItems: 'center' }}>
        <Avatar name={lead.name} size={64} />
        <Text style={[font.h2, { color: colors.text, marginTop: 8 }]}>{lead.name}</Text>
        <Muted>{[lead.email, lead.phone].filter(Boolean).join(' · ')}</Muted>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          <Badge label={`Score ${lead.score}`} color={colors.lime} />
          {lead.interest ? <Badge label={lead.interest} color={colors.cyan} /> : null}
          <Badge label={lead.consent_marketing ? 'LGPD ✓' : 'Sem consentimento'} color={lead.consent_marketing ? colors.success : colors.warning} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          {lead.phone ? <ActionBtn icon="logo-whatsapp" color="#25D366" label="WhatsApp" onPress={() => contact('whatsapp')} /> : null}
          {lead.phone ? <ActionBtn icon="call" color={colors.cyan} label="Ligar" onPress={() => contact('call')} /> : null}
          {lead.email ? <ActionBtn icon="mail" color={colors.warning} label="E-mail" onPress={() => contact('email')} /> : null}
        </View>
      </Card>

      <SectionHeader title="Etapa do funil" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {STATUSES.map((s) => (
          <Pressable key={s} onPress={() => setStatus(s)} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: lead.status === s ? leadStatusColor[s] : alpha(leadStatusColor[s], 0.12), borderWidth: 1.5, borderColor: leadStatusColor[s] }}>
            <Text style={{ color: lead.status === s ? '#000' : leadStatusColor[s], fontWeight: '800' }}>{leadStatusLabel[s]}</Text>
          </Pressable>
        ))}
      </View>

      <SectionHeader title="Tags" action={tags == null ? 'Editar' : undefined} onAction={() => setTags(lead.tags.join(', '))} />
      {tags == null ? (
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {lead.tags.length ? lead.tags.map((tag) => <Badge key={tag} label={`#${tag}`} color={colors.secondary} />) : <Muted>Sem tags</Muted>}
        </View>
      ) : (
        <>
          <Input value={tags} onChangeText={setTags} placeholder="separe por vírgula" autoCapitalize="none" />
          <GradientButton small title="Salvar tags" onPress={saveTags} />
        </>
      )}

      <SectionHeader title="Histórico" />
      <Input placeholder="Adicionar anotação..." value={note} onChangeText={setNote} multiline />
      <GradientButton small title="Adicionar nota" icon="add" onPress={addNote} style={{ marginBottom: 16 }} />
      {interactions.map((it) => (
        <View key={it.id} style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={typeIcon[it.type]} size={16} color={colors.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text }}>{it.content}</Text>
            <Text style={{ color: colors.textDim, fontSize: 11 }}>{formatDateTime(it.created_at)}</Text>
          </View>
        </View>
      ))}
      <Muted style={{ fontSize: 12, marginBottom: 30 }}>{t('Lead criado em {date}', { date: formatDateTime(lead.created_at) })}</Muted>
    </Screen>
  );
}

function ActionBtn({ icon, color, label, onPress }: { icon: 'logo-whatsapp' | 'call' | 'mail'; color: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', backgroundColor: alpha(color, 0.15), borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 16 }}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={{ color, fontWeight: '700', fontSize: 12, marginTop: 2 }}>{t(label)}</Text>
    </Pressable>
  );
}
