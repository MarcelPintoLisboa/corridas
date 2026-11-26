import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';

import { ProgressRing } from '@/components/charts';
import { RaceOnboarding } from '@/components/RaceOnboarding';
import { SessionCard } from '@/components/SessionCard';
import { SponsorCarousel } from '@/components/sponsors';
import { UpdatesList, useUpdates } from '@/components/UpdatesFeed';
import { Avatar, Card, Countdown, FadeIn, IconButton, Loading, Muted, PulseBadge, Screen, SectionHeader, Stat } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { supabase, unwrap } from '@/lib/supabase';
import type { KitPickup, Post, Registration } from '@/lib/types';
import { useTraining } from '@/hooks/useTraining';
import { api } from '@/lib/api';
import { daysUntil, formatDate, formatKm, formatTime, tipCategoryLabel } from '@/lib/format';
import { isSameDay, planProgress } from '@/lib/plan';
import { useAuth } from '@/providers/AuthProvider';
import { useActiveEvent } from '@/providers/EventProvider';
import { alpha, colors, font, radius } from '@/theme';

export default function HomeScreen() {
  const { profile, isAdmin } = useAuth();
  const { event, active, registrations, accent, accent2, loading, reload: reloadEvents } = useActiveEvent();
  const training = useTraining();

  const content = useAsync(async () => {
    if (!event) return null;
    const [posts, tips, sponsors] = await Promise.all([api.posts(event.id), api.tips(event.id, event.event_date), api.sponsors(event.id)]);
    return { posts, tips, sponsors };
  }, [event?.id]);

  const eventIds = registrations.map((r) => r.event_id);
  const allRaces = useAsync(async () => {
    if (!eventIds.length) return { posts: [] as Post[], pickups: [] as KitPickup[] };
    const [posts, pickups] = await Promise.all([
      supabase
        .from('st_posts')
        .select('*')
        .in('event_id', eventIds)
        .eq('published', true)
        .order('pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(6)
        .then(unwrap),
      supabase.from('st_kit_pickups').select('*').in('event_id', eventIds).gte('ends_at', new Date().toISOString()).order('starts_at').limit(4).then(unwrap),
    ]);
    return { posts: posts as Post[], pickups: pickups as KitPickup[] };
  }, [eventIds.join(',')]);

  const updates = useUpdates(registrations, 6);

  if (loading) return <Loading />;

  const firstName = profile?.full_name?.split(' ')[0] ?? 'atleta';
  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
      <View style={{ flex: 1 }}>
        <Muted>Olá,</Muted>
        <Text style={[font.h1, { color: colors.text }]}>{firstName} 👋</Text>
      </View>
      {isAdmin ? <IconButton icon="construct" color={colors.lime} onPress={() => router.push('/admin')} /> : null}
      <Pressable onPress={() => router.push('/profile')} style={{ marginLeft: 10 }}>
        <Avatar uri={profile?.avatar_url} name={profile?.full_name} />
      </Pressable>
    </View>
  );

  if (!event || !active) {
    return (
      <Screen>
        {header}
        <RaceOnboarding />
      </Screen>
    );
  }

  const today = training.scheduled.find((s) => isSameDay(s.date, new Date()));
  const next = today ?? training.scheduled.find((s) => s.date > new Date());
  const totalKm = training.workouts.reduce((a, w) => a + Number(w.distance_km), 0);
  const progress = planProgress(training.scheduled);

  return (
    <Screen
      refreshing={training.refreshing}
      onRefresh={() => {
        training.refresh();
        content.refresh();
        allRaces.refresh();
        updates.refresh();
        reloadEvents();
      }}>
      {header}

      {registrations.length > 1 ? <MyRaces registrations={registrations} activeId={active.event_id} /> : null}

      {/* HERO da corrida — customizado pelo organizador */}
      {registrations.length === 1 ? (
      <FadeIn>
        <Pressable onPress={() => router.push('/event')} style={{ borderRadius: radius.xl, overflow: 'hidden', height: 280, marginBottom: 12 }}>
          {event.cover_image_url ? (
            <Image source={event.cover_image_url} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" transition={400} />
          ) : null}
          <LinearGradient colors={[alpha(accent2, 0.55), alpha('#000000', 0.25), alpha(accent, 0.95)]} style={{ flex: 1, padding: 20, justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <PulseBadge date={event.event_date} />
              {event.logo_url ? <Image source={event.logo_url} style={{ width: 48, height: 48, borderRadius: 12 }} /> : null}
            </View>
            <View>
              <Text style={[font.tiny, { color: 'rgba(255,255,255,0.85)' }]}>
                {active.distance?.label ?? ''} · {formatDate(event.event_date, true)}
              </Text>
              <Text style={[font.hero, { color: '#fff' }]} numberOfLines={2}>{event.name}</Text>
              {event.tagline ? <Text style={{ color: 'rgba(255,255,255,0.9)', marginBottom: 12 }}>{event.tagline}</Text> : null}
              <Countdown date={event.event_date} />
            </View>
          </LinearGradient>
        </Pressable>
      </FadeIn>
      ) : null}

      {/* Tudo o que a organização adicionou/alterou nas corridas do corredor */}
      {updates.items.length ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <Text style={[font.h2, { color: colors.text }]}>{registrations.length > 1 ? 'Atualizações das corridas' : 'Atualizações da corrida'}</Text>
              {updates.unread ? (
                <View style={{ backgroundColor: colors.primary, borderRadius: 99, minWidth: 22, height: 22, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>{updates.unread}</Text>
                </View>
              ) : null}
            </View>
            <Pressable onPress={() => router.push('/updates')} hitSlop={10}>
              <Text style={[font.small, { color: colors.textMuted }]}>Ver todas ›</Text>
            </Pressable>
          </View>
          <UpdatesList items={updates.items} seenAt={updates.seenAt} registrations={registrations} />
        </>
      ) : null}

      <RaceNews posts={[]} pickups={allRaces.data?.pickups ?? []} registrations={registrations} />

      {registrations.length > 1 ? (
        <SectionHeader title={`Em foco: ${event.name}`} />
      ) : null}

      {/* Progresso */}
      <Card delay={100} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <ProgressRing progress={progress} color={accent} color2={accent2} label={`${Math.round(progress * 100)}%`} sublabel="DO PLANO" />
        <View style={{ flex: 1, gap: 14 }}>
          <View style={{ flexDirection: 'row' }}>
            <Stat label="Treinos" value={String(training.workouts.length)} />
            <Stat label="Distância" value={formatKm(totalKm)} unit="km" color={accent} />
          </View>
          <Pressable onPress={() => router.push('/workout/new')} style={{ backgroundColor: alpha(accent, 0.15), borderRadius: radius.pill, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            <Ionicons name="add" size={18} color={accent} />
            <Text style={{ color: accent, fontWeight: '800' }}>Registrar treino</Text>
          </Pressable>
        </View>
      </Card>

      {/* Treino do dia */}
      {next ? (
        <>
          <SectionHeader title={today ? 'Treino de hoje' : 'Próximo treino'} action="Ver plano" onAction={() => router.push('/training')} />
          <FadeIn delay={150}>
            <SessionCard s={next} />
          </FadeIn>
        </>
      ) : null}

      {/* Dicas dos treinadores */}
      {content.data?.tips.length ? (
        <>
          <SectionHeader title="Dicas dos treinadores" action="Ver todas" onAction={() => router.push('/tips')} />
          <FlatList
            horizontal
            data={content.data.tips}
            keyExtractor={(t) => t.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12 }}
            renderItem={({ item }) => {
              const cat = tipCategoryLabel[item.category];
              return (
                <Pressable onPress={() => router.push('/tips')} style={{ width: 240, height: 170, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface }}>
                  {item.image_url ? <Image source={item.image_url} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" /> : null}
                  <LinearGradient colors={[alpha(cat.color, 0.35), 'rgba(0,0,0,0.9)']} style={{ flex: 1, padding: 14, justifyContent: 'flex-end' }}>
                    <Text style={[font.tiny, { color: cat.color, fontSize: 10 }]}>{cat.emoji} {cat.label}</Text>
                    <Text style={[font.h3, { color: '#fff' }]} numberOfLines={2}>{item.title}</Text>
                    {item.author_name ? <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>{item.author_name}</Text> : null}
                  </LinearGradient>
                </Pressable>
              );
            }}
          />
        </>
      ) : null}

      {/* Patrocinadores */}
      {content.data?.sponsors.length ? (
        <>
          <SectionHeader title="Parceiros da prova" action="Ofertas" onAction={() => router.push('/sponsors')} />
          <SponsorCarousel sponsors={content.data.sponsors} />
        </>
      ) : null}
    </Screen>
  );
}


const POST_LABEL = { news: 'Notícia', alert: 'Aviso', promo: 'Promoção', schedule: 'Programação' } as const;

/** Todas as corridas em que a pessoa está associada */
function MyRaces({ registrations, activeId }: { registrations: Registration[]; activeId: string }) {
  const { setActiveEventId } = useActiveEvent();
  return (
    <>
      <SectionHeader title={`Minhas corridas (${registrations.length})`} />
      <FlatList
        horizontal
        data={registrations}
        keyExtractor={(r) => r.id}
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 6, flexGrow: 0 }}
        contentContainerStyle={{ gap: 12 }}
        renderItem={({ item }) => {
          const e = item.event!;
          const on = item.event_id === activeId;
          const days = daysUntil(e.event_date);
          return (
            <Pressable
              onPress={() => setActiveEventId(item.event_id)}
              onLongPress={() => {
                setActiveEventId(item.event_id);
                router.push('/event');
              }}
              style={{ width: 260, height: 190, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 2, borderColor: on ? e.primary_color : 'transparent' }}>
              {e.cover_image_url ? <Image source={e.cover_image_url} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" /> : null}
              <LinearGradient colors={[alpha(e.secondary_color, 0.45), alpha(e.primary_color, 0.95)]} style={{ flex: 1, padding: 14, justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View style={{ backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{days > 0 ? `Faltam ${days} dias` : days === 0 ? 'É hoje!' : 'Realizada'}</Text>
                  </View>
                  {on ? <Ionicons name="checkmark-circle" size={22} color="#fff" /> : null}
                </View>
                <View>
                  <Text style={[font.tiny, { color: 'rgba(255,255,255,0.85)' }]}>
                    {formatDate(e.event_date, true)} · {formatTime(e.event_date)}
                  </Text>
                  <Text style={[font.h2, { color: '#fff' }]} numberOfLines={2}>{e.name}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 2 }}>
                    {item.distance?.label ?? 'Distância a definir'} · {item.kit_picked_up ? 'Kit retirado ✓' : 'Kit pendente'}
                  </Text>
                </View>
              </LinearGradient>
            </Pressable>
          );
        }}
      />
      <Muted style={{ fontSize: 11, marginBottom: 4 }}>Toque para focar a corrida · segure para abrir os detalhes</Muted>
    </>
  );
}

/** Publicações e retiradas de kit de TODAS as corridas associadas */
function RaceNews({ posts, pickups, registrations }: { posts: Post[]; pickups: KitPickup[]; registrations: Registration[] }) {
  const { setActiveEventId } = useActiveEvent();
  const byId = new Map(registrations.map((r) => [r.event_id, r.event!]));
  const multi = registrations.length > 1;
  const open = (eventId: string) => {
    setActiveEventId(eventId);
    router.push('/event');
  };
  if (!posts.length && !pickups.length) return null;
  return (
    <>
      {pickups.length ? (
        <>
          <SectionHeader title="Retirada de kits" />
          {pickups.map((p, i) => {
            const e = byId.get(p.event_id);
            return (
              <Card key={p.id} delay={i * 50} onPress={() => open(p.event_id)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: alpha(e?.primary_color ?? colors.primary, 0.18), alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="cube" size={20} color={e?.primary_color ?? colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    {multi && e ? <Text style={[font.tiny, { color: e.primary_color, fontSize: 10 }]}>{e.name}</Text> : null}
                    <Text style={{ color: colors.text, fontWeight: '800' }}>{p.location_name}</Text>
                    <Muted style={{ fontSize: 12 }}>
                      {formatDate(p.starts_at, true)} · {formatTime(p.starts_at)} às {formatTime(p.ends_at)}
                    </Muted>
                  </View>
                </View>
              </Card>
            );
          })}
        </>
      ) : null}

      {posts.length ? (
        <>
          <SectionHeader title={multi ? 'Novidades das suas corridas' : 'Novidades da prova'} />
          {posts.map((p, i) => {
            const e = byId.get(p.event_id);
            const c = p.type === 'alert' ? colors.warning : (e?.primary_color ?? colors.primary);
            return (
              <Card key={p.id} delay={i * 60} style={p.type === 'alert' ? { borderColor: colors.warning } : undefined} onPress={() => open(p.event_id)}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {p.image_url ? <Image source={p.image_url} style={{ width: 64, height: 64, borderRadius: 12 }} /> : null}
                  <View style={{ flex: 1 }}>
                    <Text style={[font.tiny, { color: c, fontSize: 10 }]}>
                      {p.pinned ? '📌 ' : ''}
                      {POST_LABEL[p.type]}
                      {multi && e ? ` · ${e.name}` : ''}
                    </Text>
                    <Text style={[font.h3, { color: colors.text }]}>{p.title}</Text>
                    {p.body ? <Muted numberOfLines={2} style={{ fontSize: 13 }}>{p.body}</Muted> : null}
                  </View>
                </View>
              </Card>
            );
          })}
        </>
      ) : null}
    </>
  );
}
