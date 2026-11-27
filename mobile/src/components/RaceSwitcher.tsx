import { FlatList, Pressable, Text } from 'react-native';

import { useActiveEvent } from '@/providers/EventProvider';
import { colors, onColor } from '@/theme';

/** Troca a corrida ativa entre as corridas em que a pessoa está associada */
export function RaceSwitcher() {
  const { registrations, active, setActiveEventId } = useActiveEvent();
  if (registrations.length < 2) return null;
  return (
    <FlatList
      horizontal
      data={registrations}
      keyExtractor={(r) => r.id}
      showsHorizontalScrollIndicator={false}
      style={{ marginBottom: 12, flexGrow: 0 }}
      contentContainerStyle={{ gap: 8 }}
      renderItem={({ item }) => {
        const on = item.event_id === active?.event_id;
        const c = item.event?.primary_color ?? colors.primary;
        return (
          <Pressable
            onPress={() => setActiveEventId(item.event_id)}
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, backgroundColor: on ? c : colors.surface, borderWidth: 1.5, borderColor: on ? c : colors.border }}>
            <Text style={{ color: on ? onColor(c) : colors.textMuted, fontWeight: '700' }}>{item.event?.name}</Text>
          </Pressable>
        );
      }}
    />
  );
}
