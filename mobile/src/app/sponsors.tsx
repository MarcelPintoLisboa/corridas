import { Text } from 'react-native';

import { BackHeader } from '@/components/Header';
import { SponsorCarousel, SponsorOfferCard } from '@/components/sponsors';
import { EmptyState, Loading, Muted, Screen, SectionHeader } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { useActiveEvent } from '@/providers/EventProvider';
import { colors } from '@/theme';
import { t } from '@/i18n';

/** Patrocinadores da corrida: banners, ofertas/cupons e materiais */
export default function SponsorsScreen() {
  const { event } = useActiveEvent();
  const q = useAsync(() => (event ? api.sponsors(event.id) : Promise.resolve([])), [event?.id]);

  if (!event) {
    return (
      <Screen bottomInset={false}>
        <BackHeader title="Parceiros" />
        <EmptyState icon="gift" title="Ofertas exclusivas" message="Quando o organizador associar você a uma corrida, ela aparece aqui. Os patrocinadores e cupons vêm junto." />
      </Screen>
    );
  }
  if (q.loading) return <Loading />;
  const sponsors = q.data ?? [];
  const withOffer = sponsors.filter((s) => s.offer_title || s.material_url);
  const others = sponsors.filter((s) => !s.offer_title && !s.material_url);

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh} bottomInset={false}>
      <BackHeader title="Parceiros" />
      <Muted style={{ marginBottom: 16 }}>
        {t('Quem faz a')} <Text style={{ color: colors.text, fontWeight: '800' }}>{event.name}</Text> {t('acontecer — com benefícios e materiais para você.')}
      </Muted>

      <SponsorCarousel sponsors={sponsors} height={200} />

      {withOffer.length ? <SectionHeader title="🎁 Ofertas e materiais" /> : null}
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
