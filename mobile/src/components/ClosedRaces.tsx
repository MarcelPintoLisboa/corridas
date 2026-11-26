import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { useAsync } from '@/hooks/useAsync';
import { t } from '@/i18n';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { alpha, colors, radius } from '@/theme';

interface Closed {
  event_id: string;
  name: string;
  event_date: string;
  logo_url: string | null;
  primary_color: string;
}

/** Corridas do corredor que já encerraram (o acesso fecha X horas depois da largada) */
export function ClosedRaces() {
  const q = useAsync(async () => {
    const { data, error } = await supabase.rpc('st_minhas_corridas_encerradas');
    return error ? [] : ((data ?? []) as Closed[]);
  }, []);
  const list = q.data ?? [];
  if (!list.length) return null;
  return (
    <View style={{ marginBottom: 16 }}>
      {list.slice(0, 3).map((c) => (
        <View
          key={c.event_id}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: alpha(c.primary_color || colors.primary, 0.1), borderRadius: radius.lg, borderWidth: 1, borderColor: alpha(c.primary_color || colors.primary, 0.35), padding: 12, marginBottom: 8 }}>
          {c.logo_url ? (
            <Image source={c.logo_url} style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: '#fff' }} contentFit="contain" />
          ) : (
            <Ionicons name="flag" size={26} color={c.primary_color || colors.primary} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '800' }}>{t('{name} foi encerrada 🏁', { name: c.name })}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              {t('Prova em {date}. Obrigado por correr com a gente! Seus treinos continuam na aba Evolução.', { date: formatDate(c.event_date) })}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
