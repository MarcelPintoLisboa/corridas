import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BackHeader } from '@/components/Header';
import { Badge, EmptyState, FadeIn, Input, Loading, Screen } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { daysUntil, formatDate } from '@/lib/format';
import { useActiveEvent } from '@/providers/EventProvider';
import { alpha, colors, font, radius } from '@/theme';
import { tn } from '@/i18n';

export default function EventsList() {
  const q = useAsync(() => api.publishedEvents(), []);
  const { registrations } = useActiveEvent();
  const [search, setSearch] = useState('');

  if (q.loading) return <Loading />;
  const events = (q.data ?? []).filter((e) => `${e.name} ${e.city ?? ''}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh} bottomInset={false}>
      <BackHeader title="Encontre sua corrida" />
      <Input icon="search" placeholder="Nome da corrida ou cidade" value={search} onChangeText={setSearch} />
      {!events.length ? <EmptyState icon="search" title="Nenhuma corrida encontrada" /> : null}
      {events.map((e, i) => {
        const registered = registrations.some((r) => r.event_id === e.id);
        const days = daysUntil(e.event_date);
        return (
          <FadeIn key={e.id} delay={i * 70}>
            <Pressable onPress={() => router.push(`/events/${e.id}`)} style={({ pressed }) => ({ height: 200, borderRadius: radius.xl, overflow: 'hidden', marginBottom: 14, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
              {e.cover_image_url ? <Image source={e.cover_image_url} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" transition={300} /> : null}
              <LinearGradient colors={[alpha(e.secondary_color, 0.4), alpha(e.primary_color, 0.95)]} style={{ flex: 1, padding: 18, justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {registered ? <Badge label="✓ Inscrito" color={colors.lime} /> : null}
                  {days > 0 ? <Badge label={tn(days, '{n} dia', '{n} dias')} color="#fff" /> : null}
                </View>
                <View>
                  <Text style={[font.tiny, { color: 'rgba(255,255,255,0.85)' }]}>
                    {formatDate(e.event_date, true)} · {e.city ?? ''}
                  </Text>
                  <Text style={[font.h1, { color: '#fff' }]}>{e.name}</Text>
                  {e.tagline ? <Text style={{ color: 'rgba(255,255,255,0.9)' }}>{e.tagline}</Text> : null}
                </View>
              </LinearGradient>
            </Pressable>
          </FadeIn>
        );
      })}
    </Screen>
  );
}
