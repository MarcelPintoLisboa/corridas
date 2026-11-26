import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { formatDate, formatKm, sessionTypeMeta } from '@/lib/format';
import type { ScheduledSession } from '@/lib/plan';
import { isSameDay } from '@/lib/plan';
import { alpha, colors, font, radius } from '@/theme';

import type { IconName } from './ui';
import { t } from '@/i18n';

export function SessionCard({ s, compact }: { s: ScheduledSession; compact?: boolean }) {
  const meta = sessionTypeMeta[s.type];
  const today = isSameDay(s.date, new Date());
  const past = s.date < new Date() && !today;
  const canLog = s.type !== 'rest' && !s.done;

  return (
    <Pressable
      // abre o detalhe da sessão (etapas, aquecimento, esteira, registrar)
      onPress={() => router.push(`/session/${s.id}`)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
        backgroundColor: today ? alpha(meta.color, 0.12) : colors.surface,
        borderRadius: radius.lg,
        padding: compact ? 12 : 14,
        marginBottom: 10,
        borderWidth: 1.5,
        borderColor: today ? meta.color : colors.border,
        opacity: pressed ? 0.8 : past && !s.done ? 0.6 : 1,
      })}>
      <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: alpha(meta.color, 0.18), alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={meta.icon as IconName} size={22} color={meta.color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[font.tiny, { color: meta.color, fontSize: 10 }]}>{meta.label}</Text>
          <Text style={{ color: colors.textDim, fontSize: 11 }}>· {today ? t('HOJE') : formatDate(s.date, true)}</Text>
        </View>
        <Text style={[font.h3, { color: colors.text, marginTop: 2 }]}>{s.title}</Text>
        {!compact && s.description ? (
          <Text numberOfLines={2} style={{ color: colors.textMuted, fontSize: 13, marginTop: 3 }}>{s.description}</Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
          {s.distance_km ? <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>{formatKm(s.distance_km)} km</Text> : null}
          {s.duration_min ? <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>{s.duration_min} min</Text> : null}
          {s.target_pace ? <Text style={{ color: colors.textMuted, fontSize: 13 }}>⚡ {s.target_pace}</Text> : null}
        </View>
      </View>
      {s.done ? (
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="checkmark" size={18} color="#000" />
        </View>
      ) : canLog ? (
        <Ionicons name="add-circle" size={30} color={meta.color} />
      ) : null}
    </Pressable>
  );
}
