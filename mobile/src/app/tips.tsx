import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { BackHeader } from '@/components/Header';
import { Avatar, Card, Chip, EmptyState, Loading, Muted, Screen } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { daysUntil, tipCategoryLabel } from '@/lib/format';
import { useActiveEvent } from '@/providers/EventProvider';
import { alpha, colors, font, radius } from '@/theme';
import { t, tn } from '@/i18n';

export default function TipsScreen() {
  const { event, accent } = useActiveEvent();
  const [cat, setCat] = useState<string | null>(null);
  const q = useAsync(() => (event ? api.tips(event.id, event.event_date) : Promise.resolve([])), [event?.id]);

  if (q.loading) return <Loading />;
  const tips = (q.data ?? []).filter((tip) => !cat || tip.category === cat);
  const days = event ? daysUntil(event.event_date) : null;

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh} bottomInset={false}>
      <BackHeader title="Dicas dos treinadores" />
      {days != null && days > 0 ? (
        <View style={{ backgroundColor: alpha(accent, 0.12), borderRadius: radius.md, padding: 12, marginBottom: 12 }}>
          <Text style={{ color: colors.text }}>
            {t(days === 1 ? 'Falta' : 'Faltam')} <Text style={{ color: accent, fontWeight: '900' }}>{tn(days, '{n} dia', '{n} dias')}</Text> {t('para a prova')}. {t('Novas dicas de alimentação e estratégia são liberadas conforme a prova se aproxima.')} 🔓
          </Text>
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
        <Chip label="Todas" active={!cat} color={accent} onPress={() => setCat(null)} />
        {Object.entries(tipCategoryLabel).map(([k, v]) => (
          <Chip key={k} label={`${v.emoji} ${v.label}`} active={cat === k} color={v.color} onPress={() => setCat(k)} />
        ))}
      </ScrollView>

      {!tips.length ? <EmptyState icon="bulb" title="Nenhuma dica por aqui ainda" /> : null}
      {tips.map((tip, i) => {
        const c = tipCategoryLabel[tip.category];
        return (
          <Card key={tip.id} delay={i * 60} style={{ padding: 0, overflow: 'hidden' }}>
            {tip.image_url ? <Image source={tip.image_url} style={{ width: '100%', height: 160 }} contentFit="cover" /> : null}
            <View style={{ padding: 16 }}>
              <Text style={[font.tiny, { color: c.color, fontSize: 10 }]}>{c.emoji} {c.label}</Text>
              <Text style={[font.h2, { color: colors.text, marginTop: 4 }]}>{tip.title}</Text>
              <Muted style={{ marginTop: 6, lineHeight: 22 }}>{tip.body}</Muted>
              {tip.author_name ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
                  <Avatar name={tip.author_name} size={32} />
                  <View>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{tip.author_name}</Text>
                    {tip.author_role ? <Muted style={{ fontSize: 12 }}>{tip.author_role}</Muted> : null}
                  </View>
                </View>
              ) : null}
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
