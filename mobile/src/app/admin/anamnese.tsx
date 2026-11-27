import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { BackHeader } from '@/components/Header';
import { Card, EmptyState, Loading, Muted, Screen } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { t } from '@/i18n';
import { summaryRows, type Answers, type Route, type SafetyState } from '@/lib/anamnese';
import { formatDateTime } from '@/lib/format';
import type { HealthSummary } from '@/lib/health.types';
import { supabase } from '@/lib/supabase';
import { alpha, colors, font, radius, themed } from '@/theme';

const STATE: Record<SafetyState, { label: string; text: string; color: string; icon: 'checkmark-circle' | 'medkit' | 'alert-circle' | 'help-circle' }> = themed(() => ({
  eligible: { label: 'Liberado', text: 'Triagem sem restrições. Plano pessoal gerado.', color: colors.success, icon: 'checkmark-circle' },
  review: { label: 'Avaliação médica', text: 'Respondeu "Sim" em algum item de saúde. Plano bloqueado até avaliação profissional.', color: colors.warning, icon: 'medkit' },
  pending: { label: 'Triagem pendente', text: 'Respondeu "Não sei" em algum item de saúde. Plano bloqueado até esclarecer.', color: colors.warning, icon: 'help-circle' },
  urgency: { label: 'Urgência', text: 'Relatou sintomas acontecendo agora. Foi orientado a procurar atendimento imediato (SAMU 192).', color: colors.danger, icon: 'alert-circle' },
}));

/** Gestor: respostas da anamnese de um corredor da corrida */
export default function AdminAnamnese() {
  const { eventId, userId } = useLocalSearchParams<{ eventId: string; userId: string }>();
  const q = useAsync(async () => {
    const [a, u] = await Promise.all([
      supabase.from('st_anamneses').select('*').eq('event_id', eventId).eq('user_id', userId).maybeSingle(),
      supabase.from('st_usuarios').select('full_name,email,phone').eq('user_id', userId).maybeSingle(),
    ]);
    return {
      row: a.data as { answers: Answers; route: Route; health: HealthSummary | null; safety_state: SafetyState; updated_at: string } | null,
      user: u.data as { full_name: string | null; email: string | null; phone: string | null } | null,
    };
  }, [eventId, userId]);

  if (q.loading || !q.data) return <Loading />;
  const { row, user } = q.data;

  return (
    <Screen bottomInset={false} refreshing={q.refreshing} onRefresh={q.refresh}>
      <BackHeader title="Anamnese" />
      <Text style={[font.h2, { color: colors.text }]}>{user?.full_name || user?.email || t('Corredor')}</Text>
      <Muted style={{ marginBottom: 14 }}>{[user?.email, user?.phone].filter(Boolean).join(' · ')}</Muted>

      {!row ? (
        <EmptyState icon="clipboard-outline" title="Anamnese ainda não respondida" message="O corredor responde pela aba Treino do app. Assim que ele enviar, as respostas aparecem aqui." />
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: alpha(STATE[row.safety_state].color, 0.12), borderRadius: radius.lg, borderWidth: 1, borderColor: alpha(STATE[row.safety_state].color, 0.45), padding: 14, marginBottom: 14 }}>
            <Ionicons name={STATE[row.safety_state].icon} size={26} color={STATE[row.safety_state].color} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '900' }}>{t(STATE[row.safety_state].label)}</Text>
              <Muted style={{ fontSize: 13 }}>{t(STATE[row.safety_state].text)}</Muted>
            </View>
          </View>
          <Card animated={false}>
            {summaryRows(row.answers, row.route, row.health).map((r, i) => (
              <View key={r.label} style={{ flexDirection: 'row', gap: 10, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                <Text style={{ color: colors.textMuted, width: 150, fontSize: 13 }}>{t(r.label)}</Text>
                <Text style={{ color: colors.text, flex: 1, fontSize: 13, fontWeight: '600' }}>{r.value.split(', ').map((v) => t(v)).join(', ')}</Text>
              </View>
            ))}
          </Card>
          <Muted style={{ fontSize: 12, marginBottom: 30 }}>{t('Atualizada em {date}', { date: formatDateTime(row.updated_at) })}</Muted>
        </>
      )}
    </Screen>
  );
}
