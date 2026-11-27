import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAsync } from '@/hooks/useAsync';
import { t } from '@/i18n';
import type { SafetyState } from '@/lib/anamnese';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useActiveEvent } from '@/providers/EventProvider';
import { alpha, colors, font, radius, onColor } from '@/theme';

interface AnamneseRow {
  safety_state: SafetyState;
  plan_id: string | null;
  updated_at: string;
}

/** Chamada para a anamnese na aba Treino (ou status dela, se já respondida) */
export function AnamneseCard({ onChanged, compact }: { onChanged?: () => void; compact?: boolean }) {
  const { session } = useAuth();
  const { event, accent, accent2 } = useActiveEvent();
  const q = useAsync(async () => {
    if (!event || !session) return null;
    const { data, error } = await supabase
      .from('st_anamneses')
      .select('safety_state, plan_id, updated_at')
      .eq('event_id', event.id)
      .eq('user_id', session.user.id)
      .maybeSingle();
    return error ? null : (data as AnamneseRow | null);
  }, [event?.id, session?.user.id]);

  const { reload } = q;
  useFocusEffect(
    useCallback(() => {
      reload();
      onChanged?.();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  if (q.loading) return null;
  const a = q.data;
  const open = () => router.push('/anamnese');

  // ainda não respondeu: chamada principal
  if (!a) {
    return (
      <Pressable onPress={open} style={({ pressed }) => ({ borderRadius: radius.lg, overflow: 'hidden', marginBottom: 14, opacity: pressed ? 0.85 : 1 })}>
        <LinearGradient colors={[accent, accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="clipboard" size={24} color={onColor(accent)} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[font.h3, { color: onColor(accent) }]}>{t('Monte seu plano personalizado')}</Text>
              <Text style={{ color: onColor(accent), opacity: 0.85, fontSize: 13, marginTop: 2 }}>
                {t('Responda a anamnese (5 min) e receba treinos feitos para o seu objetivo, sua rotina e seu histórico — inclusive do relógio.')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={onColor(accent)} />
          </View>
        </LinearGradient>
      </Pressable>
    );
  }

  const blocked = a.safety_state !== 'eligible';
  const color = blocked ? (a.safety_state === 'urgency' ? colors.danger : colors.warning) : colors.success;
  if (compact && !blocked) {
    return (
      <Pressable onPress={open} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
        <Text style={{ color: colors.textMuted, fontSize: 12, flex: 1 }}>
          {t('Plano gerado pela sua anamnese em {date}', { date: formatDate(a.updated_at) })}
        </Text>
        <Text style={{ color: accent, fontSize: 12, fontWeight: '800' }}>{t('Refazer')}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable onPress={open} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: alpha(color, 0.1), borderRadius: radius.lg, borderWidth: 1, borderColor: alpha(color, 0.45), padding: 14, marginBottom: 14, opacity: pressed ? 0.8 : 1 })}>
      <Ionicons name={blocked ? 'medkit' : 'checkmark-circle'} size={24} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '800' }}>{t(blocked ? 'Plano bloqueado pela triagem' : 'Anamnese respondida')}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>
          {t(
            a.safety_state === 'urgency'
              ? 'Procure atendimento médico antes de treinar.'
              : a.safety_state === 'review'
                ? 'Faça uma avaliação médica e depois refaça a triagem.'
                : a.safety_state === 'pending'
                  ? 'Esclareça as respostas "Não sei" e refaça a triagem.'
                  : 'Toque para atualizar suas respostas e gerar um novo plano.',
          )}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
    </Pressable>
  );
}
