import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';

import { Avatar, Card, EmptyState, Loading, Muted, Screen, Title } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { formatDate, formatDuration, formatKm, formatPace, formatTime } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';
import type { CommunityPost, Workout } from '@/lib/types';
import { pickImage, uploadImage } from '@/lib/upload';
import { useAuth } from '@/providers/AuthProvider';
import { useActiveEvent } from '@/providers/EventProvider';
import { alpha, colors, font, radius } from '@/theme';

/** Mural interno da corrida: os corredores inscritos publicam treinos, fotos e recados */
export default function CommunityScreen() {
  const { session, isAdmin } = useAuth();
  const { event, accent } = useActiveEvent();
  const uid = session?.user.id;

  const q = useAsync(async () => {
    if (!event) return null;
    const [posts, likes, lastWorkout] = await Promise.all([
      supabase.from('community_posts').select('*').eq('event_id', event.id).order('created_at', { ascending: false }).limit(100).then(unwrap),
      supabase.from('community_likes').select('post_id,user_id').then(unwrap),
      supabase.from('workouts').select('*').eq('user_id', uid!).eq('event_id', event.id).order('performed_at', { ascending: false }).limit(1).then(unwrap),
    ]);
    return { posts: posts as CommunityPost[], likes: likes as { post_id: string; user_id: string }[], lastWorkout: (lastWorkout as Workout[])[0] ?? null };
  }, [event?.id]);

  const { reload } = q;
  useFocusEffect(
    useCallback(() => {
      reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  if (!event) {
    return (
      <Screen>
        <Title>Comunidade</Title>
        <EmptyState icon="people" title="Entre em uma corrida" message="Inscreva-se para trocar treinos e fotos com os outros corredores." action="Ver corridas" onAction={() => router.push('/events')} />
      </Screen>
    );
  }
  if (q.loading || !q.data) return <Loading />;
  const { posts, likes, lastWorkout } = q.data;

  async function toggleLike(p: CommunityPost) {
    const liked = likes.some((l) => l.post_id === p.id && l.user_id === uid);
    if (liked) await supabase.from('community_likes').delete().eq('post_id', p.id).eq('user_id', uid!);
    else await supabase.from('community_likes').insert({ post_id: p.id, user_id: uid });
    q.reload();
  }

  function remove(p: CommunityPost) {
    Alert.alert('Apagar publicação?', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: async () => { await supabase.from('community_posts').delete().eq('id', p.id); q.reload(); } },
    ]);
  }

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <Title>Comunidade</Title>
      <Muted style={{ marginBottom: 14 }}>Mural dos corredores da {event.name}</Muted>

      <Composer eventId={event.id} accent={accent} lastWorkout={lastWorkout} onPosted={q.reload} />

      {!posts.length ? <EmptyState icon="chatbubbles" title="Seja o primeiro a publicar" message="Compartilhe seu treino de hoje e motive a galera! 🏃" /> : null}
      {posts.map((p, i) => {
        const count = likes.filter((l) => l.post_id === p.id).length;
        const liked = likes.some((l) => l.post_id === p.id && l.user_id === uid);
        const canDelete = p.user_id === uid || isAdmin;
        return (
          <Card key={p.id} delay={Math.min(i, 8) * 40} style={{ padding: 0, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
              <Avatar uri={p.author_avatar} name={p.author_name} size={38} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{p.author_name ?? 'Corredor'}</Text>
                <Muted style={{ fontSize: 12 }}>{formatDate(p.created_at, true)} · {formatTime(p.created_at)}</Muted>
              </View>
              {canDelete ? (
                <Pressable onPress={() => remove(p)} hitSlop={10}>
                  <Ionicons name="trash-outline" size={18} color={colors.textDim} />
                </Pressable>
              ) : null}
            </View>
            {p.body ? <Text style={{ color: colors.text, paddingHorizontal: 14, paddingBottom: 10, fontSize: 15, lineHeight: 21 }}>{p.body}</Text> : null}
            {p.image_url ? <Image source={p.image_url} style={{ width: '100%', aspectRatio: 4 / 5 }} contentFit="cover" transition={250} /> : null}
            {p.workout_km ? (
              <View style={{ flexDirection: 'row', margin: 14, marginBottom: 0, backgroundColor: alpha(accent, 0.12), borderRadius: radius.md, padding: 12 }}>
                <Metric label="KM" value={formatKm(p.workout_km, 2)} color={accent} />
                <Metric label="TEMPO" value={formatDuration(p.workout_seconds)} />
                <Metric label="PACE" value={`${formatPace(p.workout_pace)}/km`} />
              </View>
            ) : null}
            <Pressable onPress={() => toggleLike(p)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 14 }}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? colors.danger : colors.textMuted} />
              <Text style={{ color: colors.textMuted, fontWeight: '700' }}>{count || ''}</Text>
            </Pressable>
          </Card>
        );
      })}
    </Screen>
  );
}

function Metric({ label, value, color = colors.text }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[font.tiny, { color: colors.textMuted, fontSize: 9 }]}>{label}</Text>
      <Text style={{ color, fontWeight: '900', fontSize: 17 }}>{value}</Text>
    </View>
  );
}

function Composer({ eventId, accent, lastWorkout, onPosted }: { eventId: string; accent: string; lastWorkout: Workout | null; onPosted: () => void }) {
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; mime: string } | null>(null);
  const [attach, setAttach] = useState(false);
  const [busy, setBusy] = useState(false);

  async function publish() {
    if (!text.trim() && !photo && !attach) return;
    setBusy(true);
    try {
      const image_url = photo ? await uploadImage(photo.uri, 'community', photo.mime) : null;
      const { error } = await supabase.from('community_posts').insert({
        event_id: eventId,
        body: text.trim() || null,
        image_url,
        workout_id: attach && lastWorkout ? lastWorkout.id : null,
      });
      if (error) throw error;
      setText('');
      setPhoto(null);
      setAttach(false);
      onPosted();
    } catch (e) {
      Alert.alert('Não foi possível publicar', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card animated={false}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Como foi o treino hoje?"
        placeholderTextColor={colors.textDim}
        multiline
        style={{ color: colors.text, fontSize: 15, minHeight: 50, textAlignVertical: 'top' }}
      />
      {photo ? (
        <View>
          <Image source={photo.uri} style={{ width: '100%', height: 180, borderRadius: radius.md, marginTop: 8 }} contentFit="cover" />
          <Pressable onPress={() => setPhoto(null)} style={{ position: 'absolute', top: 14, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14, padding: 4 }}>
            <Ionicons name="close" size={18} color="#fff" />
          </Pressable>
        </View>
      ) : null}
      {attach && lastWorkout ? (
        <Text style={{ color: accent, fontWeight: '700', marginTop: 8 }}>
          🏃 {formatKm(lastWorkout.distance_km, 2)} km · {formatDuration(lastWorkout.duration_seconds)} · {formatPace(lastWorkout.avg_pace_seconds)}/km
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 10 }}>
        <Pressable
          onPress={async () => {
            const a = await pickImage([4, 5]);
            if (a) setPhoto({ uri: a.uri, mime: a.mimeType ?? 'image/jpeg' });
          }}
          hitSlop={8}>
          <Ionicons name="image-outline" size={24} color={colors.textMuted} />
        </Pressable>
        {lastWorkout ? (
          <Pressable onPress={() => setAttach(!attach)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="stats-chart" size={20} color={attach ? accent : colors.textMuted} />
            <Text style={{ color: attach ? accent : colors.textMuted, fontWeight: '700', fontSize: 12 }}>Último treino</Text>
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }} />
        <Pressable onPress={publish} disabled={busy} style={{ backgroundColor: accent, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 9, opacity: busy ? 0.6 : 1 }}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Publicar</Text>}
        </Pressable>
      </View>
    </Card>
  );
}
