import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';

import { ProgressRing } from '@/components/charts';
import { SessionCard } from '@/components/SessionCard';
import { SponsorCarousel } from '@/components/sponsors';
import { Avatar, Card, Countdown, EmptyState, FadeIn, IconButton, Loading, Muted, PulseBadge, Screen, SectionHeader, Stat } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useTraining } from '@/hooks/useTraining';
import { api } from '@/lib/api';
import { formatDate, formatKm, tipCategoryLabel } from '@/lib/format';
import { isSameDay, planProgress } from '@/lib/plan';
import { useAuth } from '@/providers/AuthProvider';
import { useActiveEvent } from '@/providers/EventProvider';
import { alpha, colors, font, radius } from '@/theme';

export default function HomeScreen() {
  const { profile, isOrganizer } = useAuth();
  const { event, active, registrations, accent, accent2, loading, reload: reloadEvents } = useActiveEvent();
  const training = useTraining();

  const content = useAsync(async () => {
    if (!event) return null;
    const [posts, tips, sponsors] = await Promise.all([api.posts(event.id), api.tips(event.id, event.event_date), api.sponsors(event.id)]);
    return { posts, tips, sponsors };
  }, [event?.id]);

  if (loading) return <Loading />;

  const firstName = profile?.full_name?.split(' ')[0] ?? 'atleta';
  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
      <View style={{ flex: 1 }}>
        <Muted>Olá,</Muted>
        <Text style={[font.h1, { color: colors.text }]}>{firstName} 👋</Text>
      </View>
      {isOrganizer ? <IconButton icon="construct" color={colors.lime} onPress={() => router.push('/admin')} /> : null}
      <Pressable onPress={() => router.push('/profile')} style={{ marginLeft: 10 }}>
        <Avatar uri={profile?.avatar_url} name={profile?.full_name} />
      </Pressable>
    </View>
  );

  if (!event || !active) {
    return (
      <Screen>
        {header}
        <EmptyState
          icon="flag"
          title="Vincule sua corrida"
          message="Comprou o kit? Cadastre-se na sua corrida para liberar treino personalizado, dicas dos treinadores, informações do kit e muito mais."
          action="Encontrar minha corrida"
          onAction={() => router.push('/events')}
        />
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
        reloadEvents();
      }}>
      {header}

      {/* HERO da corrida — customizado pelo organizador */}
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

      {registrations.length > 1 ? <EventSwitcher /> : null}

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

      {/* Publicações do organizador */}
      {content.data?.posts.length ? (
        <>
          <SectionHeader title="Novidades da prova" action="Todas" onAction={() => router.push('/event')} />
          {content.data.posts.slice(0, 3).map((p, i) => (
            <Card key={p.id} delay={200 + i * 60} style={p.type === 'alert' ? { borderColor: colors.warning } : undefined} onPress={() => router.push('/event')}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {p.image_url ? <Image source={p.image_url} style={{ width: 64, height: 64, borderRadius: 12 }} /> : null}
                <View style={{ flex: 1 }}>
                  <Text style={[font.tiny, { color: p.type === 'alert' ? colors.warning : accent, fontSize: 10 }]}>
                    {p.pinned ? '📌 ' : ''}{({ news: 'Notícia', alert: 'Aviso', promo: 'Promoção', schedule: 'Programação' } as const)[p.type]}
                  </Text>
                  <Text style={[font.h3, { color: colors.text }]}>{p.title}</Text>
                  {p.body ? <Muted numberOfLines={2} style={{ fontSize: 13 }}>{p.body}</Muted> : null}
                </View>
              </View>
            </Card>
          ))}
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

function EventSwitcher() {
  const { registrations, active, setActiveEventId } = useActiveEvent();
  return (
    <FlatList
      horizontal
      data={registrations}
      keyExtractor={(r) => r.id}
      showsHorizontalScrollIndicator={false}
      style={{ marginBottom: 12 }}
      contentContainerStyle={{ gap: 8 }}
      ListFooterComponent={
        <Pressable onPress={() => router.push('/events')} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', marginLeft: 8 }}>
          <Text style={{ color: colors.textMuted, fontWeight: '700' }}>+ Corrida</Text>
        </Pressable>
      }
      renderItem={({ item }) => {
        const on = item.event_id === active?.event_id;
        const c = item.event?.primary_color ?? colors.primary;
        return (
          <Pressable onPress={() => setActiveEventId(item.event_id)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, backgroundColor: on ? c : colors.surface, borderWidth: 1.5, borderColor: on ? c : colors.border }}>
            <Text style={{ color: on ? '#fff' : colors.textMuted, fontWeight: '700' }}>{item.event?.name}</Text>
          </Pressable>
        );
      }}
    />
  );
}
