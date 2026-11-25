import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { BackHeader } from '@/components/Header';
import { Badge, Card, Chip, EmptyState, Input, Loading, Muted, Screen } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { levelLabel } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';
import { colors, font, radius } from '@/theme';

interface Row {
  id: string;
  bib_number: string | null;
  shirt_size: string | null;
  level: string;
  kit_picked_up: boolean;
  profile: { full_name: string | null; email: string | null; phone: string | null } | null;
  distance: { label: string } | null;
}

export default function RegistrationsScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');

  const q = useAsync(
    async () =>
      unwrap(
        await supabase
          .from('registrations')
          .select('id,bib_number,shirt_size,level,kit_picked_up,profile:profiles(full_name,email,phone),distance:event_distances(label)')
          .eq('event_id', eventId)
          .order('created_at', { ascending: false }),
      ) as unknown as Row[],
    [eventId],
  );

  if (q.loading) return <Loading />;
  const rows = (q.data ?? []).filter((r) => {
    if (filter === 'pending' && r.kit_picked_up) return false;
    if (filter === 'done' && !r.kit_picked_up) return false;
    return `${r.profile?.full_name ?? ''} ${r.profile?.email ?? ''} ${r.bib_number ?? ''}`.toLowerCase().includes(search.toLowerCase());
  });

  async function update(id: string, patch: Partial<Row> & { kit_picked_up_at?: string | null }) {
    const { error } = await supabase.from('registrations').update(patch).eq('id', id);
    if (error) Alert.alert('Erro', error.message);
    q.setData((q.data ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  const done = (q.data ?? []).filter((r) => r.kit_picked_up).length;

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh} bottomInset={false}>
      <BackHeader title="Inscritos" />
      <Muted style={{ marginTop: -8, marginBottom: 12 }}>
        {q.data?.length ?? 0} inscritos · {done} kits retirados
      </Muted>
      <Input icon="search" placeholder="Nome, e-mail ou nº de peito" value={search} onChangeText={setSearch} />
      <View style={{ flexDirection: 'row', marginBottom: 12 }}>
        <Chip label="Todos" active={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="Kit pendente" active={filter === 'pending'} onPress={() => setFilter('pending')} />
        <Chip label="Kit retirado" active={filter === 'done'} color={colors.success} onPress={() => setFilter('done')} />
      </View>
      {!rows.length ? <EmptyState icon="people" title="Nenhum inscrito" /> : null}
      {rows.map((r) => (
        <Card key={r.id} animated={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={[font.h3, { color: colors.text }]}>{r.profile?.full_name ?? '—'}</Text>
              <Muted style={{ fontSize: 12 }}>{r.profile?.email}</Muted>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                {r.distance ? <Badge label={r.distance.label} color={colors.primary} /> : null}
                <Badge label={levelLabel[r.level]} color={colors.textMuted} />
                {r.shirt_size ? <Badge label={`Cam. ${r.shirt_size}`} color={colors.cyan} /> : null}
                <Badge label={`#${r.id.slice(0, 8).toUpperCase()}`} color={colors.textDim} />
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
          <Pressable
            onPress={() => update(r.id, { kit_picked_up: !r.kit_picked_up, kit_picked_up_at: !r.kit_picked_up ? new Date().toISOString() : null })}
            style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: r.kit_picked_up ? colors.success : colors.surfaceAlt }}>
            <Ionicons name={r.kit_picked_up ? 'checkmark-circle' : 'cube-outline'} size={18} color={r.kit_picked_up ? '#000' : colors.text} />
            <Text style={{ color: r.kit_picked_up ? '#000' : colors.text, fontWeight: '800' }}>{r.kit_picked_up ? 'Kit entregue' : 'Marcar kit como entregue'}</Text>
          </Pressable>
        </Card>
      ))}
    </Screen>
  );
}
