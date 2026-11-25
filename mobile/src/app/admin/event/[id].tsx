import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';

import { WeeklyBars } from '@/components/charts';
import { BackHeader } from '@/components/Header';
import { Card, FadeIn, IconButton, ListRow, Loading, Muted, Screen, SectionHeader } from '@/components/ui';
import { resources } from '@/features/admin/resources';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { formatDateTime, formatKm } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';
import type { EventMetrics } from '@/lib/types';
import { alpha, colors, radius } from '@/theme';

export default function AdminEvent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const q = useAsync(async () => {
    const [event, metrics] = await Promise.all([api.event(id), supabase.rpc('event_metrics', { p_event_id: id }).then(unwrap)]);
    return { event, metrics: metrics as EventMetrics };
  }, [id]);
  const { reload } = q;
  useFocusEffect(
    useCallback(() => {
      reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  if (q.loading || !q.data) return <Loading />;
  const { event, metrics: m } = q.data;
  const c = event.primary_color;

  const kpis = [
    { label: 'Inscritos', value: m.registrations, icon: 'people', color: c },
    { label: 'Kits retirados', value: `${m.kits_picked_up}/${m.registrations}`, icon: 'cube', color: colors.success },
    { label: 'Leads', value: m.leads_total, icon: 'magnet', color: colors.cyan, sub: `${m.leads_new} novos` },
    { label: 'Conversão', value: m.leads_total ? `${Math.round((m.leads_converted / m.leads_total) * 100)}%` : '—', icon: 'trending-up', color: colors.lime },
    { label: 'Treinos', value: m.workouts, icon: 'barbell', color: colors.secondary, sub: `${formatKm(m.km_total, 0)} km` },
    { label: 'Posts Instagram', value: m.instagram_shares, icon: 'logo-instagram', color: '#E1306C' },
    { label: 'Impressões patroc.', value: m.sponsor_impressions, icon: 'eye', color: colors.warning },
    { label: 'Cliques patroc.', value: m.sponsor_clicks, icon: 'hand-left', color: colors.primary },
  ] as const;

  const tileW = (width - 32 - 10) / 2;
  const menu = Object.values(resources).filter((r) => r.showInMenu !== false);

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh} bottomInset={false}>
      <BackHeader title={event.name} right={<IconButton icon="create-outline" onPress={() => router.push(`/admin/event-form?id=${id}`)} />} />
      <Muted style={{ marginTop: -8, marginBottom: 12 }}>{formatDateTime(event.event_date)}</Muted>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {kpis.map((k, i) => (
          <FadeIn key={k.label} delay={i * 40}>
            <View style={{ width: tileW, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: alpha(k.color, 0.18), alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={k.icon} size={18} color={k.color} />
              </View>
              <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900', marginTop: 8 }}>{k.value}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {k.label}
                {'sub' in k ? ` · ${k.sub}` : ''}
              </Text>
            </View>
          </FadeIn>
        ))}
      </View>

      {m.by_distance.length ? (
        <Card delay={300} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.text, fontWeight: '800', marginBottom: 10 }}>Inscritos por distância</Text>
          <WeeklyBars values={m.by_distance.map((d) => d.total)} labels={m.by_distance.map((d) => `${d.label} (${d.total})`)} width={width - 66} height={90} color={c} />
        </Card>
      ) : null}

      <SectionHeader title="Marketing & participantes" />
      <Card animated={false}>
        <ListRow icon="magnet" color={colors.cyan} title="Leads (CRM)" subtitle="Funil, contatos, WhatsApp e exportação" onPress={() => router.push(`/admin/leads?eventId=${id}`)} />
        <ListRow icon="people" color={c} title="Inscritos & check-in de kit" subtitle="Nº de peito e retirada" onPress={() => router.push(`/admin/registrations?eventId=${id}`)} />
        <ListRow icon="cloud-upload" color={colors.lime} title="Importar compras de kit" subtitle="Colar planilha (CSV) da plataforma de vendas" onPress={() => router.push(`/admin/import?eventId=${id}`)} />
      </Card>

      <SectionHeader title="Conteúdo da corrida" />
      <Card animated={false}>
        <ListRow icon="color-palette" color={c} title="Personalizar corrida" subtitle="Nome, imagens, cores, local, links" onPress={() => router.push(`/admin/event-form?id=${id}`)} />
        {menu.map((r) => (
          <ListRow key={r.key} icon={r.icon} color={c} title={r.title} subtitle={r.description} onPress={() => router.push(`/admin/crud/${r.key}?parentId=${id}`)} />
        ))}
      </Card>
    </Screen>
  );
}
