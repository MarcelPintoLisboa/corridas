import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, Switch, Text, View } from 'react-native';

import { BackHeader } from '@/components/Header';
import { GradientButton, Input, Muted, Screen, SectionHeader } from '@/components/ui';
import { DateTimeFields } from '@/components/DateTimeFields';
import { formatPace, parseDateTimeBR, parseDuration, toDateInputBR, toTimeInput } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { pickImage, uploadImage } from '@/lib/upload';
import { useAuth } from '@/providers/AuthProvider';
import { useActiveEvent } from '@/providers/EventProvider';
import { alpha, colors, radius } from '@/theme';

const FEELINGS = ['😫', '😕', '🙂', '😄', '🔥'];

export default function NewWorkout() {
  const params = useLocalSearchParams<{ sessionId?: string; title?: string; km?: string }>();
  const { session } = useAuth();
  const { event, accent, accent2 } = useActiveEvent();

  const [title, setTitle] = useState(params.title ?? '');
  const [km, setKm] = useState(params.km ? String(params.km).replace('.', ',') : '');
  const [time, setTime] = useState('');
  const [when, setWhen] = useState(() => { const now = new Date().toISOString(); return { date: toDateInputBR(now), time: toTimeInput(now) }; });
  const [feeling, setFeeling] = useState(3);
  const [notes, setNotes] = useState('');
  const [isRace, setIsRace] = useState(false);
  const [photo, setPhoto] = useState<{ uri: string; mime: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const distance = Number(km.replace(',', '.'));
  const seconds = parseDuration(time);
  const pace = distance > 0 && seconds ? seconds / distance : null;

  async function onSave() {
    if (!(distance > 0)) return Alert.alert('Informe a distância em km');
    if (!seconds) return Alert.alert('Informe o tempo', 'Formato: 45:30 ou 1:05:20');
    const performedAt = parseDateTimeBR(when.date, when.time) ?? new Date().toISOString();
    setSaving(true);
    try {
      const photoUrl = photo ? await uploadImage(photo.uri, 'workouts', photo.mime) : null;
      const { data, error } = await supabase
        .from('st_workouts')
        .insert({
          user_id: session!.user.id,
          event_id: event?.id ?? null,
          session_id: params.sessionId || null,
          title: title || (isRace ? 'Prova' : 'Treino'),
          distance_km: distance,
          duration_seconds: seconds,
          performed_at: performedAt,
          feeling: feeling + 1,
          notes: notes || null,
          is_race: isRace,
          photo_url: photoUrl,
        })
        .select('id')
        .single();
      if (error) throw error;
      router.replace(`/workout/${data.id}?fresh=1`);
    } catch (e) {
      Alert.alert('Erro ao salvar', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen bottomInset={false}>
        <BackHeader title="Registrar treino" />

        <Pressable
          onPress={async () => {
            const a = await pickImage([9, 16]);
            if (a) setPhoto({ uri: a.uri, mime: a.mimeType ?? 'image/jpeg' });
          }}
          style={{ height: 170, borderRadius: radius.lg, borderWidth: 2, borderStyle: 'dashed', borderColor: alpha(accent, 0.6), backgroundColor: alpha(accent, 0.06), alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 16 }}>
          {photo ? (
            <Image source={photo.uri} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <>
              <Ionicons name="camera" size={32} color={accent} />
              <Text style={{ color: colors.text, fontWeight: '800', marginTop: 6 }}>Adicionar foto</Text>
              <Muted style={{ fontSize: 12 }}>Vai para o fundo do seu post no Instagram</Muted>
            </>
          )}
        </Pressable>

        <Input label="Título" placeholder="Longão de domingo" value={title} onChangeText={setTitle} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Input label="Distância (km)" icon="map" placeholder="10,0" keyboardType="decimal-pad" value={km} onChangeText={setKm} />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Tempo" icon="timer" placeholder="52:30" keyboardType="numbers-and-punctuation" value={time} onChangeText={setTime} />
          </View>
        </View>

        <View style={{ backgroundColor: alpha(accent, 0.12), borderRadius: radius.md, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ color: colors.textMuted, fontWeight: '700' }}>PACE MÉDIO</Text>
          <Text style={{ color: accent, fontSize: 26, fontWeight: '900' }}>{formatPace(pace)} <Text style={{ fontSize: 14 }}>/km</Text></Text>
        </View>

        <DateTimeFields dateLabel="Data do treino" value={when} onChange={setWhen} />

        <SectionHeader title="Como você se sentiu?" />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          {FEELINGS.map((f, i) => (
            <Pressable key={f} onPress={() => setFeeling(i)} style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: feeling === i ? alpha(accent, 0.25) : colors.surface, borderWidth: 2, borderColor: feeling === i ? accent : 'transparent', transform: [{ scale: feeling === i ? 1.1 : 1 }] }}>
              <Text style={{ fontSize: 26 }}>{f}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12 }}>
          <View>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Foi uma prova oficial?</Text>
            <Muted style={{ fontSize: 12 }}>Provas preparatórias aparecem com troféu 🏆</Muted>
          </View>
          <Switch value={isRace} onValueChange={setIsRace} trackColor={{ true: accent }} />
        </View>

        <Input label="Anotações" multiline placeholder="Como foi o treino?" value={notes} onChangeText={setNotes} />

        <GradientButton title="Salvar e gerar post" icon="logo-instagram" colorsPair={[accent, accent2]} onPress={onSave} loading={saving} style={{ marginTop: 8, marginBottom: 30 }} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
