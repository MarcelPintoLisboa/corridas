import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { t } from '@/i18n';
import { STEP_KINDS, STEP_META, paceToSpeed } from '@/lib/steps';
import type { SessionStep, StepKind } from '@/lib/types';
import { alpha, colors, font, radius } from '@/theme';

/** Estado de edição: números como texto para os inputs */
export interface StepDraft {
  kind: StepKind;
  title: string;
  distance_km: string;
  duration_min: string;
  pace: string;
  repeat: string;
  note: string;
}

const num = (v: unknown) => (v == null ? '' : String(v).replace('.', ','));

export function toStepDrafts(raw: unknown): StepDraft[] {
  if (!Array.isArray(raw)) return [];
  return (raw as SessionStep[]).map((s) => ({
    kind: STEP_KINDS.includes(s.kind) ? s.kind : 'run',
    title: s.title ?? '',
    distance_km: num(s.distance_km),
    duration_min: num(s.duration_min),
    pace: s.pace ?? '',
    repeat: num(s.repeat),
    note: s.note ?? '',
  }));
}

/** Converte para o JSON gravado no banco. Lança erro de validação. */
export function fromStepDrafts(drafts: StepDraft[]): SessionStep[] {
  const n = (v: string, label: string, i: number) => {
    if (!v.trim()) return null;
    const x = Number(v.replace(',', '.'));
    if (isNaN(x) || x <= 0) throw new Error(t('Etapa {n}: "{field}" deve ser um número', { n: i + 1, field: t(label) }));
    return x;
  };
  return drafts.map((d, i) => {
    if (d.pace.trim() && !/^\d{1,2}:\d{2}(\s*[-–]\s*\d{1,2}:\d{2})?$/.test(d.pace.trim()))
      throw new Error(t('Etapa {n}: use o pace no formato 5:30 ou 5:30-6:00', { n: i + 1 }));
    const step: SessionStep = {
      kind: d.kind,
      title: d.title.trim() || t(STEP_META[d.kind].label),
      distance_km: n(d.distance_km, 'Distância (km)', i),
      duration_min: n(d.duration_min, 'Duração (min)', i),
      pace: d.pace.trim().replace(/\s/g, '') || null,
      repeat: n(d.repeat, 'Repetições', i),
      note: d.note.trim() || null,
    };
    return step;
  });
}

const empty = (kind: StepKind = 'run'): StepDraft => ({ kind, title: '', distance_km: '', duration_min: '', pace: '', repeat: '', note: '' });

export function StepsEditor({ label, value, onChange }: { label: string; value: StepDraft[]; onChange: (v: StepDraft[]) => void }) {
  const set = (i: number, patch: Partial<StepDraft>) => onChange(value.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[font.tiny, { color: colors.textMuted, marginBottom: 4 }]}>{t(label)}</Text>
      <Text style={{ color: colors.textDim, fontSize: 12, marginBottom: 10 }}>
        {t('Monte o treino em etapas (ex.: aquecimento, 6 tiros de 400 m, recuperação, desaquecimento). Sem etapas, o corredor vê o resumo da sessão.')}
      </Text>

      {value.map((s, i) => {
        const m = STEP_META[s.kind];
        const speed = paceToSpeed(s.pace);
        return (
          <View key={i} style={{ backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: alpha(m.color, 0.5), padding: 12, marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ color: m.color, fontWeight: '900', fontSize: 16, width: 26 }}>{i + 1}</Text>
              <Text style={{ color: colors.text, fontWeight: '800', flex: 1 }}>{t(m.label)}</Text>
              <IconBtn icon="arrow-up" onPress={() => move(i, -1)} disabled={i === 0} />
              <IconBtn icon="arrow-down" onPress={() => move(i, 1)} disabled={i === value.length - 1} />
              <IconBtn icon="copy-outline" onPress={() => onChange([...value.slice(0, i + 1), { ...s }, ...value.slice(i + 1)])} />
              <IconBtn icon="trash-outline" color={colors.textMuted} onPress={() => onChange(value.filter((_, j) => j !== i))} />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {STEP_KINDS.map((k) => {
                const on = k === s.kind;
                return (
                  <Pressable
                    key={k}
                    onPress={() => set(i, { kind: k })}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, marginRight: 6, backgroundColor: on ? STEP_META[k].color : 'transparent', borderWidth: 1.5, borderColor: on ? STEP_META[k].color : colors.border }}>
                    <Ionicons name={STEP_META[k].icon as 'flame'} size={13} color={on ? '#000' : colors.textMuted} />
                    <Text style={{ color: on ? '#000' : colors.textMuted, fontWeight: '700', fontSize: 12 }}>{t(STEP_META[k].label)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Field value={s.title} onChangeText={(v) => set(i, { title: v })} placeholder={t('Título (ex.: 3,5 km em ritmo de conversa)')} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Field style={{ flex: 1 }} value={s.repeat} onChangeText={(v) => set(i, { repeat: v })} placeholder={t('Repetir (×)')} keyboardType="number-pad" />
              <Field style={{ flex: 1 }} value={s.distance_km} onChangeText={(v) => set(i, { distance_km: v })} placeholder={t('Km (0,4 = 400 m)')} keyboardType="decimal-pad" />
              <Field style={{ flex: 1 }} value={s.duration_min} onChangeText={(v) => set(i, { duration_min: v })} placeholder={t('Minutos')} keyboardType="decimal-pad" />
            </View>
            <Field value={s.pace} onChangeText={(v) => set(i, { pace: v })} placeholder={t('Pace (ex.: 6:00 ou 5:30-6:00)')} keyboardType="numbers-and-punctuation" />
            {speed ? <Text style={{ color: colors.textDim, fontSize: 11, marginTop: -4, marginBottom: 6 }}>{t('Na esteira: {speed}', { speed })}</Text> : null}
            <Field value={s.note} onChangeText={(v) => set(i, { note: v })} placeholder={t('Orientação (ex.: este é um limite, não uma meta)')} multiline />
          </View>
        );
      })}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(['warmup', 'run', 'interval', 'recovery', 'cooldown'] as StepKind[]).map((k) => (
          <Pressable
            key={k}
            onPress={() => onChange([...value, empty(k)])}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, borderWidth: 1.5, borderStyle: 'dashed', borderColor: STEP_META[k].color, opacity: pressed ? 0.6 : 1 })}>
            <Ionicons name="add" size={14} color={STEP_META[k].color} />
            <Text style={{ color: STEP_META[k].color, fontWeight: '800', fontSize: 12 }}>{t(STEP_META[k].label)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Field(props: ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor={colors.textDim}
      {...props}
      style={[{ color: colors.text, backgroundColor: colors.bgElevated, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 9, marginBottom: 8, fontSize: 14 }, props.multiline && { minHeight: 60, textAlignVertical: 'top' }, props.style]}
    />
  );
}

function IconBtn({ icon, onPress, disabled, color = colors.textMuted }: { icon: 'arrow-up' | 'arrow-down' | 'copy-outline' | 'trash-outline'; onPress: () => void; disabled?: boolean; color?: string }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6} style={{ padding: 5, opacity: disabled ? 0.25 : 1 }}>
      <Ionicons name={icon} size={17} color={color} />
    </Pressable>
  );
}
