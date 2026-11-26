import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import type { IconName } from '@/components/ui';

import { Badge, Card, Chip, EmptyState, FadeIn, GradientButton, ListRow, Loading, Muted, Screen, SectionHeader, Title } from '@/components/ui';
import { resources } from '@/features/admin/resources';
import { useAsync } from '@/hooks/useAsync';
import { formatDate } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';
import type { RaceEvent } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { useActiveEvent } from '@/providers/EventProvider';
import { alpha, colors, radius } from '@/theme';

async function count(table: string) {
  const { count: n } = await supabase.from(table).select('*', { count: 'exact', head: true });
  return n ?? 0;
}

/** Menu do administrador: todas as funções de gestão, visível só para admins */
export default function GestaoScreen() {
  const { isAdmin, isAdminGeral } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<'fill' | 'clear' | null>(null);
  const { reload: reloadEvents } = useActiveEvent();

  const q = useAsync(async () => {
    const [events, registrations, leads, users] = await Promise.all([
      supabase.from('st_events').select('*').order('event_date', { ascending: true }).then(unwrap) as Promise<RaceEvent[]>,
      count('st_registrations'),
      count('st_leads'),
      count('st_usuarios'),
    ]);
    return { events, registrations, leads, users };
  }, []);

  const { reload } = q;
  useFocusEffect(
    useCallback(() => {
      reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  async function runDemo(kind: 'fill' | 'clear') {
    setBusy(kind);
    const { error } = await supabase.rpc(kind === 'fill' ? 'st_demo_preencher' : 'st_demo_limpar');
    setBusy(null);
    if (error) return Alert.alert('Não foi possível', /function|schema cache/i.test(error.message) ? 'Rode o arquivo supabase/migrations/20261126000002_st_demo.sql no SQL Editor do Supabase.' : error.message);
    if (kind === 'fill') setSelected('11111111-1111-1111-1111-111111111111');
    else setSelected(null);
    await Promise.all([q.reload(), reloadEvents()]);
    Alert.alert(
      kind === 'fill' ? 'Modelo preenchido ✓' : 'Modelo apagado ✓',
      kind === 'fill'
        ? 'Criamos 2 corridas completas e inscrevemos você na Night Run (10K) com treinos das últimas semanas. Veja também as abas Início, Treino, Evolução, Comunidade e Corrida.'
        : 'As corridas de demonstração e tudo ligado a elas foram removidos. Suas corridas não foram alteradas.',
    );
  }

  function confirmDemo(kind: 'fill' | 'clear') {
    Alert.alert(
      kind === 'fill' ? 'Preencher modelo?' : 'Limpar modelo?',
      kind === 'fill'
        ? 'Cria um fluxo completo de ponta a ponta: corridas, distâncias, kits, planos, dicas, patrocinadores, publicações, leads e a sua inscrição com treinos. Se o modelo já existir, ele é recriado.'
        : 'Apaga só as corridas de demonstração e tudo ligado a elas. Corridas cadastradas por você continuam.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: kind === 'fill' ? 'Preencher' : 'Limpar', style: kind === 'fill' ? 'default' : 'destructive', onPress: () => runDemo(kind) },
      ],
    );
  }

  if (!isAdmin) return <Redirect href="/" />;
  if (q.loading || !q.data) return <Loading />;

  const { events } = q.data;
  const upcoming = events.find((e) => new Date(e.event_date) >= new Date()) ?? events[events.length - 1];
  const ev = events.find((e) => e.id === selected) ?? upcoming ?? null;
  const c = ev?.primary_color ?? colors.lime;
  const menu = Object.values(resources).filter((r) => r.showInMenu !== false);

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Title>Administração</Title>
        <Badge label={isAdminGeral ? 'Admin geral' : 'Admin'} color={colors.lime} />
      </View>
      <Muted style={{ marginBottom: 14 }}>{isAdminGeral ? 'Você vê todas as corridas de todos os gestores.' : 'Suas corridas, o conteúdo delas e os corredores associados.'}</Muted>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <Stat icon="flag" label="Corridas" value={events.length} color={colors.primary} />
        <Stat icon="people" label="Inscritos" value={q.data.registrations} color={colors.cyan} />
        <Stat icon="magnet" label="Leads" value={q.data.leads} color={colors.lime} />
        <Stat icon="key" label="Acessos" value={q.data.users} color={colors.warning} />
      </View>

      <GradientButton title="Nova corrida" icon="add" colorsPair={[colors.lime, colors.cyan]} onPress={() => router.push('/admin/event-form')} />

      <View style={{ marginTop: 12, padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
        <Text style={{ color: colors.text, fontWeight: '800' }}>Modelo de demonstração</Text>
        <Muted style={{ fontSize: 12, marginBottom: 10 }}>Preenche um fluxo completo com dados de exemplo para testar, e limpa quando quiser.</Muted>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <GradientButton small title="Preencher" icon="sparkles" loading={busy === 'fill'} disabled={!!busy} colorsPair={[colors.primary, colors.secondary]} onPress={() => confirmDemo('fill')} style={{ flex: 1 }} />
          <GradientButton small title="Limpar" icon="trash" variant="ghost" loading={busy === 'clear'} disabled={!!busy} colorsPair={[colors.danger, colors.danger]} onPress={() => confirmDemo('clear')} style={{ flex: 1 }} />
        </View>
      </View>

      {!ev ? (
        <EmptyState icon="flag" title="Nenhuma corrida cadastrada" message="Crie a primeira corrida. Depois cadastre distâncias, kits, planos de treino, dicas, patrocinadores e publicações aqui." />
      ) : (
        <>
          <SectionHeader title="Gerenciar corrida" action="Todas" onAction={() => router.push('/admin')} />
          {events.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {events.map((e) => (
                <Chip key={e.id} label={e.name} active={e.id === ev.id} color={e.primary_color} onPress={() => setSelected(e.id)} />
              ))}
            </ScrollView>
          ) : null}

          <FadeIn>
            <View style={{ borderRadius: radius.lg, padding: 14, marginBottom: 12, backgroundColor: alpha(c, 0.15), borderWidth: 1, borderColor: alpha(c, 0.4) }}>
              <Text style={{ color: colors.text, fontWeight: '900', fontSize: 18 }}>{ev.name}</Text>
              <Muted style={{ fontSize: 13 }}>
                {formatDate(ev.event_date, true)} · {ev.city ?? 'local a definir'} · {ev.status === 'published' ? 'Publicada' : ev.status === 'draft' ? 'Rascunho' : ev.status === 'finished' ? 'Finalizada' : 'Cancelada'}
              </Muted>
            </View>
          </FadeIn>

          <Card animated={false}>
            <ListRow icon="speedometer" color={c} title="Painel e resultados" subtitle="Indicadores e geração automática de planos" onPress={() => router.push(`/admin/event/${ev.id}`)} />
            <ListRow icon="color-palette" color={c} title="Personalizar corrida" subtitle="Nome, ícone, imagens, cores, local e links" onPress={() => router.push(`/admin/event-form?id=${ev.id}`)} />
          </Card>

          <Text style={{ color: colors.textMuted, fontWeight: '800', fontSize: 12, marginBottom: 8, marginTop: 4 }}>CONTEÚDO</Text>
          <Card animated={false}>
            {menu.map((r) => (
              <ListRow key={r.key} icon={r.icon} color={c} title={r.title} subtitle={r.description} onPress={() => router.push(`/admin/crud/${r.key}?parentId=${ev.id}`)} />
            ))}
          </Card>

          <Text style={{ color: colors.textMuted, fontWeight: '800', fontSize: 12, marginBottom: 8, marginTop: 4 }}>PARTICIPANTES E MARKETING</Text>
          <Card animated={false}>
            <ListRow icon="people" color={c} title="Corredores da corrida" subtitle="Associar corredores cadastrados, nº de peito e kits" onPress={() => router.push(`/admin/registrations?eventId=${ev.id}`)} />
            <ListRow icon="cloud-upload" color={c} title="Importar compras de kit" subtitle="Colar planilha (CSV) da plataforma de vendas" onPress={() => router.push(`/admin/import?eventId=${ev.id}`)} />
            <ListRow icon="magnet" color={c} title="Leads (CRM)" subtitle="Funil, contatos, WhatsApp e exportação" onPress={() => router.push(`/admin/leads?eventId=${ev.id}`)} />
          </Card>
        </>
      )}

      <SectionHeader title="Geral" />
      <Card animated={false}>
        <ListRow icon="flag" color={colors.primary} title="Corridas de rua" subtitle="Criar, editar e excluir corridas" onPress={() => router.push('/admin')} />
        <ListRow icon="key" color={colors.warning} title={isAdminGeral ? 'Controle de acesso' : 'Meus corredores'} subtitle={isAdminGeral ? 'Gestores e corredores, ativar ou desativar' : 'Corredores que você cadastrou ou associou'} onPress={() => router.push('/admin/users')} />
        <ListRow icon="person-circle" color={colors.textMuted} title="Meu perfil" onPress={() => router.push('/profile')} />
      </Card>
    </Screen>
  );
}

function Stat({ icon, label, value, color }: { icon: IconName; label: string; value: number; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: colors.border }}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={{ color: colors.text, fontWeight: '900', fontSize: 18, marginTop: 4 }}>{value}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 10 }}>{label}</Text>
    </View>
  );
}
