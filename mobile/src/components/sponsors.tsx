import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, Text, useWindowDimensions, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { Sponsor } from '@/lib/types';
import { alpha, colors, font, radius, tierColors } from '@/theme';
import { t } from '@/i18n';

const tierLabel: Record<string, string> = { master: 'MASTER', gold: 'OURO', silver: 'PRATA', support: 'APOIO' };

/** Registra impressão/clique para o relatório do organizador */
export async function trackSponsor(sponsorId: string, kind: 'impression' | 'click' | 'coupon_copy') {
  const { data } = await supabase.auth.getUser();
  await supabase.from('st_sponsor_interactions').insert({ sponsor_id: sponsorId, user_id: data.user?.id ?? null, kind });
}

export async function openSponsor(s: Sponsor) {
  trackSponsor(s.id, 'click');
  const url = s.website_url ?? (s.instagram ? `https://instagram.com/${s.instagram.replace('@', '')}` : null);
  if (url) Linking.openURL(url);
}

export async function copyCoupon(s: Sponsor) {
  if (!s.coupon_code) return;
  await Clipboard.setStringAsync(s.coupon_code);
  trackSponsor(s.id, 'coupon_copy');
  Alert.alert(t('Cupom copiado! 🎉'), t('Use {code} no site da {name}.', { code: s.coupon_code ?? '', name: s.name }));
}

/** Carrossel de banners com auto-play */
export function SponsorCarousel({ sponsors, height = 170 }: { sponsors: Sponsor[]; height?: number }) {
  const { width } = useWindowDimensions();
  const itemW = width - 32;
  const ref = useRef<FlatList<Sponsor>>(null);
  const [index, setIndex] = useState(0);
  const items = sponsors.filter((s) => s.banner_url || s.logo_url);
  const tracked = useRef(new Set<string>());

  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => {
      setIndex((i) => {
        const next = (i + 1) % items.length;
        ref.current?.scrollToOffset({ offset: next * (itemW + 12), animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(t);
  }, [items.length, itemW]);

  useEffect(() => {
    const s = items[index];
    if (s && !tracked.current.has(s.id)) {
      tracked.current.add(s.id);
      trackSponsor(s.id, 'impression').catch(() => {});
    }
  }, [index, items]);

  if (!items.length) return null;

  return (
    <View>
      <FlatList
        ref={ref}
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={itemW + 12}
        decelerationRate="fast"
        keyExtractor={(s) => s.id}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / (itemW + 12)))}
        renderItem={({ item }) => (
          <Pressable onPress={() => openSponsor(item)} style={{ width: itemW, height, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface }}>
            <Image source={item.banner_url ?? item.logo_url} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={300} />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingTop: 40 }}>
              <Text style={[font.tiny, { color: tierColors[item.tier] }]}>{t('Patrocinador {tier}', { tier: t(tierLabel[item.tier]) })}</Text>
              <Text style={[font.h2, { color: '#fff' }]}>{item.name}</Text>
              {item.offer_title ? <Text style={{ color: colors.lime, fontWeight: '700', marginTop: 2 }}>{item.offer_title}</Text> : null}
            </LinearGradient>
          </Pressable>
        )}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10, gap: 6 }}>
        {items.map((s, i) => (
          <View key={s.id} style={{ width: i === index ? 20 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? colors.text : colors.border }} />
        ))}
      </View>
    </View>
  );
}

/** Card de oferta com cupom */
export function SponsorOfferCard({ sponsor }: { sponsor: Sponsor }) {
  const tc = tierColors[sponsor.tier];
  return (
    <Pressable
      onPress={() => openSponsor(sponsor)}
      style={({ pressed }) => ({
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: alpha(tc, 0.4),
        padding: 16,
        marginBottom: 12,
        opacity: pressed ? 0.85 : 1,
      })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {sponsor.logo_url ? (
          <Image source={sponsor.logo_url} style={{ width: 54, height: 54, borderRadius: 14, backgroundColor: '#fff' }} contentFit="cover" />
        ) : (
          <View style={{ width: 54, height: 54, borderRadius: 14, backgroundColor: alpha(tc, 0.2), alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: tc, fontWeight: '900', fontSize: 20 }}>{sponsor.name[0]}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[font.tiny, { color: tc, fontSize: 10 }]}>{t(tierLabel[sponsor.tier])}</Text>
          <Text style={[font.h3, { color: colors.text }]}>{sponsor.name}</Text>
          {sponsor.description ? (
            <Text numberOfLines={2} style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>{sponsor.description}</Text>
          ) : null}
        </View>
        <Ionicons name="open-outline" size={18} color={colors.textDim} />
      </View>
      {sponsor.offer_title ? (
        <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: alpha(colors.lime, 0.08), borderRadius: radius.md, padding: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: alpha(colors.lime, 0.5) }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.lime, fontWeight: '800' }}>{sponsor.offer_title}</Text>
            {sponsor.coupon_code ? <Text style={{ color: colors.text, fontWeight: '900', letterSpacing: 2, marginTop: 2 }}>{sponsor.coupon_code}</Text> : null}
          </View>
          {sponsor.coupon_code ? (
            <Pressable onPress={() => copyCoupon(sponsor)} style={{ backgroundColor: colors.lime, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 }}>
              <Text style={{ color: '#000', fontWeight: '900', fontSize: 12 }}>{t('COPIAR')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {sponsor.material_url ? (
        <Pressable
          onPress={() => {
            trackSponsor(sponsor.id, 'click');
            Linking.openURL(sponsor.material_url!);
          }}
          style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: alpha(tc, 0.12), borderRadius: radius.md, padding: 12 }}>
          <Ionicons name="document-attach" size={18} color={tc} />
          <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>{sponsor.material_label || t('Ver material do patrocinador')}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

/** Faixa compacta de logos (ex.: rodapé da home) */
export function SponsorLogoStrip({ sponsors }: { sponsors: Sponsor[] }) {
  return (
    <FlatList
      horizontal
      data={sponsors}
      keyExtractor={(s) => s.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 10 }}
      renderItem={({ item }) => (
        <Pressable onPress={() => openSponsor(item)} style={{ width: 92, height: 64, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {item.logo_url ? (
            <Image source={item.logo_url} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 12, textAlign: 'center', padding: 6 }}>{item.name}</Text>
          )}
        </Pressable>
      )}
    />
  );
}
