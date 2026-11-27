import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';

import { Badge, Card, EmptyState, FadeIn, ListRow, Loading, Muted, Screen, SectionHeader, Title } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { formatDate, formatDateTime, formatTime, levelLabel } from '@/lib/format';
import type { KitPickup } from '@/lib/types';
import { useActiveEvent } from '@/providers/EventProvider';
import { alpha, brand, colors, font, radius, themed } from '@/theme';
import { t } from '@/i18n';

const postMeta = themed(() => ({
  news: { label: 'Notícia', icon: 'newspaper', color: colors.cyan },
  alert: { label: 'Aviso', icon: 'warning', color: colors.warning },
  promo: { label: 'Promoção', icon: 'pricetag', color: colors.lime },
  schedule: { label: 'Programação', icon: 'time', color: colors.secondary },
} as const));

function pickupStatus(p: KitPickup) {
  const now = Date.now();
  const s = new Date(p.starts_at).getTime();
  const e = new Date(p.ends_at).getTime();
  if (now < s) return { label: t('EM BREVE'), color: colors.cyan };
  if (now <= e) return { label: t('ABERTO AGORA'), color: colors.success };
  return { label: t('ENCERRADO'), color: colors.textDim };
}

export default function EventScreen() {
  const { event, active, accent } = useActiveEvent();
  const q = useAsync(async () => {
    if (!event) return null;
    const [pickups, posts, distances] = await Promise.all([api.pickups(event.id), api.posts(event.id), api.distances(event.id)]);
    return { pickups, posts, distances };
  }, [event?.id]);

  if (!event || !active) {
    return (
      <Screen>
        <Title>Corrida</Title>
        <EmptyState icon="flag" title="Nenhuma corrida ainda" message="Quando o organizador associar você a uma corrida, ela aparece aqui." />
      </Screen>
    );
  }
  if (q.loading) return <Loading />;

  return (
    <Screen padded={false} refreshing={q.refreshing} onRefresh={q.refresh}>
      <View style={{ height: 240, marginTop: -60 }}>
        {event.cover_image_url ? <Image source={event.cover_image_url} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" /> : null}
        <LinearGradient colors={[alpha(brand.pine, 0.35), alpha(brand.deep, 0.97)]} style={{ flex: 1, justifyContent: 'flex-end', padding: 16 }}>
          <Text style={[font.tiny, { color: brand.lime }]}>{formatDateTime(event.event_date)}</Text>
          <Text style={[font.hero, { color: '#fff' }]}>{event.name}</Text>
        </LinearGradient>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        {/* Inscrição */}
        <FadeIn>
          <LinearGradient colors={[brand.pine, brand.deep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.lg, padding: 18, marginTop: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <Text style={[font.tiny, { color: 'rgba(255,255,255,0.8)' }]}>{t('Minha inscrição')}</Text>
                <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900' }}>{active.distance?.label ?? '—'}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.9)' }}>
                  {levelLabel[active.level]}
                  {active.shirt_size ? ` · ${t('Camiseta')} ${active.shirt_size}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[font.tiny, { color: 'rgba(255,255,255,0.8)' }]}>{t('Nº de peito')}</Text>
                <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900' }}>{active.bib_number ?? '---'}</Text>
              </View>
            </View>
            <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: radius.md, padding: 10 }}>
              <Ionicons name={active.kit_picked_up ? 'checkmark-circle' : 'cube'} size={20} color={active.kit_picked_up ? brand.lime : '#fff'} />
              <Text style={{ color: '#fff', fontWeight: '700', flex: 1 }}>
                {t(active.kit_picked_up ? 'Kit retirado! Bora pra prova 🔥' : 'Kit ainda não retirado')}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>#{active.id.slice(0, 8).toUpperCase()}</Text>
            </View>
          </LinearGradient>
        </FadeIn>

        {/* Kits */}
        <SectionHeader title="Retirada de kits" />
        {q.data?.pickups.length ? (
          q.data.pickups.map((p, i) => {
            const st = pickupStatus(p);
            return (
              <Card key={p.id} delay={i * 60}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[font.h3, { color: colors.text }]}>{p.location_name}</Text>
                    {p.address ? <Muted style={{ fontSize: 13 }}>{p.address}</Muted> : null}
                  </View>
                  <Badge label={st.label} color={st.color} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                  <Ionicons name="calendar" size={16} color={accent} />
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {formatDate(p.starts_at, true)} · {formatTime(p.starts_at)} {t('às')} {formatTime(p.ends_at)}
                  </Text>
                </View>
                {p.required_docs ? (
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                    <Ionicons name="id-card" size={16} color={colors.textMuted} />
                    <Muted style={{ fontSize: 13, flex: 1 }}>{p.required_docs}</Muted>
                  </View>
                ) : null}
                {p.notes ? <Muted style={{ fontSize: 13, marginTop: 6, fontStyle: 'italic' }}>💡 {p.notes}</Muted> : null}
                {p.maps_url ? (
                  <Pressable onPress={() => Linking.openURL(p.maps_url!)} style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: alpha(accent, 0.15), paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill }}>
                    <Ionicons name="navigate" size={16} color={accent} />
                    <Text style={{ color: accent, fontWeight: '800' }}>{t('Como chegar')}</Text>
                  </Pressable>
                ) : null}
              </Card>
            );
          })
        ) : (
          <Muted>Locais de retirada serão divulgados em breve.</Muted>
        )}

        {/* Informações */}
        <SectionHeader title="Informações" />
        <Card>
          <ListRow icon="gift" color={colors.lime} title="Patrocinadores" subtitle="Ofertas, cupons e materiais para inscritos" onPress={() => router.push('/sponsors')} />
          <ListRow icon="location" color={accent} title={event.location_name ?? t('Local')} subtitle={[event.address, event.city, event.state].filter(Boolean).join(' · ')} onPress={event.latitude ? () => Linking.openURL(`https://maps.google.com/?q=${event.latitude},${event.longitude}`) : undefined} />
          <ListRow icon="trail-sign" color={accent} title="Distâncias" subtitle={q.data?.distances.map((d) => d.label).join(' · ')} />
          {event.regulation_url ? <ListRow icon="document-text" color={accent} title="Regulamento" onPress={() => Linking.openURL(event.regulation_url!)} /> : null}
          {event.instagram_handle ? <ListRow icon="logo-instagram" color="#E1306C" title={event.instagram_handle} subtitle={event.hashtag ?? undefined} onPress={() => Linking.openURL(`https://instagram.com/${event.instagram_handle!.replace('@', '')}`)} /> : null}
          {event.website_url ? <ListRow icon="globe" color={accent} title="Site oficial" onPress={() => Linking.openURL(event.website_url!)} /> : null}
        </Card>
        {event.description ? <Muted style={{ marginTop: 4 }}>{event.description}</Muted> : null}
        {event.route_map_url ? (
          <>
            <SectionHeader title="Percurso" />
            <Image source={event.route_map_url} style={{ width: '100%', height: 220, borderRadius: radius.lg }} contentFit="cover" />
          </>
        ) : null}

        {/* Publicações */}
        <SectionHeader title="Mural da prova" />
        {q.data?.posts.map((p, i) => {
          const m = postMeta[p.type];
          return (
            <Card key={p.id} delay={i * 50} style={{ padding: 0, overflow: 'hidden', borderColor: p.pinned ? m.color : colors.border }}>
              {p.image_url ? <Image source={p.image_url} style={{ width: '100%', height: 170 }} contentFit="cover" /> : null}
              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name={m.icon} size={14} color={m.color} />
                  <Text style={[font.tiny, { color: m.color, fontSize: 10 }]}>{t(m.label)}</Text>
                  <Text style={{ color: colors.textDim, fontSize: 11 }}>· {formatDate(p.published_at)}</Text>
                  {p.pinned ? <Text style={{ marginLeft: 'auto' }}>📌</Text> : null}
                </View>
                <Text style={[font.h3, { color: colors.text, marginTop: 4 }]}>{p.title}</Text>
                {p.body ? <Muted style={{ marginTop: 4 }}>{p.body}</Muted> : null}
                {p.cta_url ? (
                  <Pressable onPress={() => Linking.openURL(p.cta_url!)} style={{ marginTop: 12, alignSelf: 'flex-start', backgroundColor: m.color, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill }}>
                    <Text style={{ color: '#000', fontWeight: '800' }}>{p.cta_label ?? t('Saiba mais')}</Text>
                  </Pressable>
                ) : null}
              </View>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}
