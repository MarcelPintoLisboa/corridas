import { View } from 'react-native';

import { Input } from '@/components/ui';
import { maskDateBR, maskTime } from '@/lib/format';
import { t } from '@/i18n';

export interface DateTimeValue {
  date: string; // DD/MM/AAAA
  time: string; // HH:mm
}

/** Data (DD/MM/AAAA) e hora (HH:mm) em campos separados, com máscara */
export function DateTimeFields({
  dateLabel,
  timeLabel = 'Hora',
  value,
  onChange,
}: {
  dateLabel: string;
  timeLabel?: string;
  value: DateTimeValue;
  onChange: (v: DateTimeValue) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ flex: 3 }}>
        <Input
          label={dateLabel}
          icon="calendar"
          placeholder={t('DD/MM/AAAA')}
          keyboardType="number-pad"
          maxLength={10}
          value={value.date}
          onChangeText={(v) => onChange({ ...value, date: maskDateBR(v) })}
        />
      </View>
      <View style={{ flex: 2 }}>
        <Input
          label={timeLabel}
          icon="time"
          placeholder="HH:mm"
          keyboardType="number-pad"
          maxLength={5}
          value={value.time}
          onChangeText={(v) => onChange({ ...value, time: maskTime(v) })}
        />
      </View>
    </View>
  );
}
