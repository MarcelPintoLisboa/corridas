import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { BackHeader } from '@/components/Header';
import { Card, Loading, Muted, Screen, Stat } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';

/** Relatório do patrocinador (para prestar contas da cota) */
export default function SponsorMetrics() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useAsync(async () => {
    const [{ data: sponsor }, ...counts] = await Promise.all([
      supabase.from('st_sponsors').select('name').eq('id', id).single(),
      ...(['impression', 'click', 'coupon_copy'] as const).map((k) =>
        supabase.from('st_sponsor_interactions').select('id', { count: 'exact', head: true }).eq('sponsor_id', id).eq('kind', k),
      ),
    ]);
    return { name: sponsor?.name as string, impressions: counts[0].count ?? 0, clicks: counts[1].count ?? 0, coupons: counts[2].count ?? 0 };
  }, [id]);

  if (q.loading || !q.data) return <Loading />;
  const { impressions, clicks, coupons } = q.data;
  const ctr = impressions ? ((clicks + coupons) / impressions) * 100 : 0;

  return (
    <Screen bottomInset={false}>
      <BackHeader title={q.data.name} />
      <Card>
        <View style={{ flexDirection: 'row', marginBottom: 16 }}>
          <Stat label="Impressões" value={String(impressions)} />
          <Stat label="Cliques" value={String(clicks)} color={colors.primary} />
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Stat label="Cupons copiados" value={String(coupons)} color={colors.lime} />
          <Stat label="CTR" value={ctr.toFixed(1)} unit="%" color={colors.cyan} />
        </View>
      </Card>
      <Muted>Impressões são contadas quando o banner aparece no carrossel; cliques ao abrir o site/Instagram; cupons ao copiar o código.</Muted>
      <Text />
    </Screen>
  );
}
