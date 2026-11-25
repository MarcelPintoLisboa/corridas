import { router } from 'expo-router';
import { Text } from 'react-native';

import { SponsorCarousel, SponsorOfferCard } from '@/components/sponsors';
import { EmptyState, Loading, Muted, Screen, SectionHeader, Title } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { useActiveEvent } from '@/providers/EventProvider';
import { colors } from '@/theme';

export default function SponsorsScreen() {
  const { event } = useActiveEvent();
  const q = useAsync(() => (event ? api.sponsors(event.id) : Promise.resolve([])), [event?.id]);

  if (!event) {
    return (
      <Screen>
        <Title>Parceiros</Title>
        <EmptyState icon="gift" title="Ofertas exclusivas" message="Vincule sua corrida para desbloquear cupons dos patrocinadores." action="Encontrar corrida" onAction={() => router.push('/events')} />
      </Screen>
    );
  }
  if (q.loading) return <Loading />;
  const sponsors = q.data ?? [];
  const withOffer = sponsors.filter((s) => s.offer_title);
  const others = sponsors.filter((s) => !s.offer_title);

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <Title>Parceiros</Title>
      <Muted style={{ marginBottom: 16 }}>
        Quem faz a <Text style={{ color: colors.text, fontWeight: '800' }}>{event.name}</Text> acontecer — com benefícios para você.
      </Muted>

      <SponsorCarousel sponsors={sponsors} height={200} />

      {withOffer.length ? <SectionHeader title="🎁 Ofertas para inscritos" /> : null}
      {withOffer.map((s) => (
        <SponsorOfferCard key={s.id} sponsor={s} />
      ))}

      {others.length ? <SectionHeader title="Apoiadores" /> : null}
      {others.map((s) => (
        <SponsorOfferCard key={s.id} sponsor={s} />
      ))}

      {!sponsors.length ? <EmptyState icon="gift" title="Em breve" message="Os patrocinadores serão anunciados em breve." /> : null}
    </Screen>
  );
}
