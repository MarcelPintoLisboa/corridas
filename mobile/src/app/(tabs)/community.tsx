import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';

import { RaceSwitcher } from '@/components/RaceSwitcher';
import { Avatar, Card, EmptyState, Loading, Muted, Screen, Title } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { formatDate, formatDuration, formatKm, formatPace, formatTime } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';
import type { CommunityComment, CommunityPost, Workout } from '@/lib/types';
import { pickImage, uploadImage } from '@/lib/upload';
import { useAuth } from '@/providers/AuthProvider';
import { useActiveEvent } from '@/providers/EventProvider';
import { alpha, colors, font, radius, onColor } from '@/theme';
import { t } from '@/i18n';

/** Mural interno da corrida: só os corredores associados à MESMA corrida veem, publicam fotos/treinos e comentam */
export default function CommunityScreen() {
  const { session, isAdmin } = useAuth();
  const { event, accent } = useActiveEvent();
  const uid = session?.user.id;

  const q = useAsync(async () => {
    if (!event) return null;
    const [posts, likes, lastWorkout, comments] = await Promise.all([
      supabase.from('st_community_posts').select('*').eq('event_id', event.id).order('created_at', { ascending: false }).limit(100).then(unwrap),
      supabase.from('st_community_likes').select('post_id,user_id').then(unwrap),
      supabase.from('st_workouts').select('*').eq('user_id', uid!).eq('event_id', event.id).order('performed_at', { ascending: false }).limit(1).then(unwrap),
      supabase
        .from('st_community_comments')
        .select('*')
        .eq('event_id', event.id)
        .order('created_at', { ascending: true })
        .then((r) => (r.error ? [] : (r.data as CommunityComment[]))),
    ]);
    return { posts: posts as CommunityPost[], likes: likes as { post_id: string; user_id: string }[], lastWorkout: (lastWorkout as Workout[])[0] ?? null, comments };
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
        <Title>Stories</Title>
        <EmptyState icon="people" title="Nenhuma corrida ainda" message="Quando o organizador associar você a uma corrida, o mural dos corredores dela aparece aqui." />
      </Screen>
    );
  }
  if (q.loading || !q.data) return <Loading />;
  const { posts, likes, lastWorkout, comments } = q.data;

  async function toggleLike(p: CommunityPost) {
    const liked = likes.some((l) => l.post_id === p.id && l.user_id === uid);
    if (liked) await supabase.from('st_community_likes').delete().eq('post_id', p.id).eq('user_id', uid!);
    else await supabase.from('st_community_likes').insert({ post_id: p.id, user_id: uid });
    q.reload();
  }

  function remove(p: CommunityPost) {
    Alert.alert(t('Apagar publicação?'), undefined, [
      { text: t('Cancelar'), style: 'cancel' },
      { text: t('Apagar'), style: 'destructive', onPress: async () => { await supabase.from('st_community_posts').delete().eq('id', p.id); q.reload(); } },
    ]);
  }

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <Title>Stories</Title>
      <Muted style={{ marginBottom: 12 }}>{t('Mural dos corredores da {name}. Só quem está nesta corrida vê.', { name: event.name })}</Muted>
      <RaceSwitcher />

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
                <Text style={{ color: colors.text, fontWeight: '800' }}>{p.author_name ?? t('Corredor')}</Text>
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
            <Comments
              post={p}
              accent={accent}
              uid={uid}
              canModerate={isAdmin}
              comments={comments.filter((c) => c.post_id === p.id)}
              onChanged={q.reload}
              likeButton={
                <Pressable onPress={() => toggleLike(p)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} hitSlop={8}>
                  <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? colors.danger : colors.textMuted} />
                  <Text style={{ color: colors.textMuted, fontWeight: '700' }}>{count || ''}</Text>
                </Pressable>
              }
            />
          </Card>
        );
      })}
    </Screen>
  );
}

function Metric({ label, value, color = colors.text }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[font.tiny, { color: colors.textMuted, fontSize: 9 }]}>{t(label)}</Text>
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
      const { error } = await supabase.from('st_community_posts').insert({
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
      Alert.alert(t('Não foi possível publicar'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card animated={false}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={t('Como foi o treino hoje?')}
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
            <Text style={{ color: attach ? accent : colors.textMuted, fontWeight: '700', fontSize: 12 }}>{t('Último treino')}</Text>
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }} />
        <Pressable onPress={publish} disabled={busy} style={{ backgroundColor: accent, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 9, opacity: busy ? 0.6 : 1 }}>
          {busy ? <ActivityIndicator color={onColor(accent)} /> : <Text style={{ color: onColor(accent), fontWeight: '800' }}>{t('Publicar')}</Text>}
        </Pressable>
      </View>
    </Card>
  );
}

function Comments({ post, comments, accent, uid, canModerate, onChanged, likeButton }: {
  post: CommunityPost;
  comments: CommunityComment[];
  accent: string;
  uid: string | undefined;
  canModerate: boolean;
  onChanged: () => void;
  likeButton: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const shown = open ? comments : comments.slice(-2);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('st_community_comments').insert({ post_id: post.id, body: text.trim() });
    setBusy(false);
    if (error) return Alert.alert(t('Não foi possível comentar'), error.message);
    setText('');
    setOpen(true);
    onChanged();
  }

  function remove(c: CommunityComment) {
    Alert.alert(t('Apagar comentário?'), undefined, [
      { text: t('Cancelar'), style: 'cancel' },
      {
        text: t('Apagar'),
        style: 'destructive',
        onPress: async () => {
          await supabase.from('st_community_comments').delete().eq('id', c.id);
          onChanged();
        },
      },
    ]);
  }

  return (
    <View style={{ padding: 14, paddingTop: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
        {likeButton}
        <Pressable onPress={() => setOpen(!open)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} hitSlop={8}>
          <Ionicons name="chatbubble-outline" size={20} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, fontWeight: '700' }}>{comments.length || ''}</Text>
        </Pressable>
      </View>

      {comments.length > 2 && !open ? (
        <Text onPress={() => setOpen(true)} style={{ color: colors.textMuted, marginTop: 10, fontWeight: '600' }}>
          {t('Ver os {n} comentários', { n: comments.length })}
        </Text>
      ) : null}
      {shown.map((c) => (
        <View key={c.id} style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <Avatar uri={c.author_avatar} name={c.author_name} size={28} />
          <View style={{ flex: 1, backgroundColor: colors.bgElevated, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 7 }}>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>
              {c.author_name ?? t('Corredor')}{' '}
              <Text style={{ color: colors.textDim, fontWeight: '400', fontSize: 11 }}>
                · {formatDate(c.created_at, true)} {formatTime(c.created_at)}
              </Text>
            </Text>
            <Text style={{ color: colors.text, fontSize: 14, marginTop: 2 }}>{c.body}</Text>
          </View>
          {c.user_id === uid || canModerate ? (
            <Pressable onPress={() => remove(c)} hitSlop={8} style={{ paddingTop: 6 }}>
              <Ionicons name="close" size={16} color={colors.textDim} />
            </Pressable>
          ) : null}
        </View>
      ))}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('Escreva um comentário…')}
          placeholderTextColor={colors.textDim}
          maxLength={1000}
          onSubmitEditing={send}
          returnKeyType="send"
          style={{ flex: 1, color: colors.text, backgroundColor: colors.bgElevated, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14 }}
        />
        <Pressable onPress={send} disabled={busy || !text.trim()} hitSlop={8} style={{ opacity: busy || !text.trim() ? 0.4 : 1 }}>
          {busy ? <ActivityIndicator color={accent} /> : <Ionicons name="send" size={20} color={accent} />}
        </Pressable>
      </View>
    </View>
  );
}
