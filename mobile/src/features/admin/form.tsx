import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Switch, Text, View } from 'react-native';

import { DateTimeFields, type DateTimeValue } from '@/components/DateTimeFields';
import { Chip, Input } from '@/components/ui';
import { parseDateTimeBR, toDateInputBR, toTimeInput } from '@/lib/format';
import { pickAndUpload } from '@/lib/upload';
import { alpha, colors, font, radius } from '@/theme';
import { t } from '@/i18n';

import { StepsEditor, fromStepDrafts, toStepDrafts, type StepDraft } from './StepsEditor';

export type FieldType = 'text' | 'multiline' | 'number' | 'bool' | 'datetime' | 'select' | 'image' | 'color' | 'url' | 'tags' | 'steps';

export interface Option {
  label: string;
  value: string;
}

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: Option[];
  help?: string;
  aspect?: [number, number];
  default?: unknown;
  /** datetime: rótulo do campo de hora (a data usa `label`) */
  timeLabel?: string;
}

export type FormValues = Record<string, unknown>;

/** traduz rótulos com emoji na frente ("🏃 Treino") */
export const tl = (s: string) => {
  const m = s.match(/^([^A-Za-zÀ-ÿ]+\s)(.*)$/);
  return m ? m[1] + t(m[2]) : t(s);
};

const PALETTE = ['#C7F753', '#24463A', '#FF4D2E', '#FF3D71', '#FF9100', '#FFC400', '#C6FF00', '#00E676', '#00E5FF', '#2979FF', '#7B2FF7', '#D500F9', '#FFFFFF', '#111111'];

/** Converte a linha do banco em valores editáveis (strings para inputs) */
export function toFormValues(fields: Field[], row: Record<string, unknown> | null): FormValues {
  const v: FormValues = {};
  for (const f of fields) {
    const raw = row?.[f.key] ?? f.default ?? null;
    if (f.type === 'datetime') v[f.key] = { date: toDateInputBR(raw as string | null), time: toTimeInput(raw as string | null) } satisfies DateTimeValue;
    else if (f.type === 'steps') v[f.key] = toStepDrafts(raw);
    else if (f.type === 'bool') v[f.key] = Boolean(raw);
    else if (f.type === 'tags') v[f.key] = Array.isArray(raw) ? raw.join(', ') : '';
    else v[f.key] = raw == null ? '' : String(raw);
  }
  return v;
}

/** Converte valores do formulário para o payload do Supabase. Lança erro de validação. */
export function serialize(fields: Field[], values: FormValues) {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const val = values[f.key];
    const str = typeof val === 'string' ? val.trim() : val;
    if (f.type === 'datetime') {
      const dt = (val as DateTimeValue | undefined) ?? { date: '', time: '' };
      if (!dt.date.trim()) {
        if (f.required) throw new Error(t('Preencha "{field}"', { field: t(f.label) }));
        out[f.key] = null;
        continue;
      }
      const iso = parseDateTimeBR(dt.date, dt.time);
      if (!iso) throw new Error(t('"{field}": use a data DD/MM/AAAA e a hora HH:mm', { field: t(f.label) }));
      out[f.key] = iso;
      continue;
    }
    if (f.type === 'steps') {
      out[f.key] = fromStepDrafts((val as StepDraft[] | undefined) ?? []);
      continue;
    }
    if (f.required && (str === '' || str == null)) throw new Error(t('Preencha "{field}"', { field: t(f.label) }));
    switch (f.type) {
      case 'bool':
        out[f.key] = Boolean(val);
        break;
      case 'number':
        out[f.key] = str === '' ? null : Number(String(str).replace(',', '.'));
        if (out[f.key] != null && isNaN(out[f.key] as number)) throw new Error(t('"{field}" deve ser um número', { field: t(f.label) }));
        break;
      case 'tags':
        out[f.key] = String(str ?? '')
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
        break;
      default:
        out[f.key] = str === '' ? null : str;
    }
  }
  return out;
}

export function FormFields({ fields, values, onChange }: { fields: Field[]; values: FormValues; onChange: (v: FormValues) => void }) {
  const set = (k: string, val: unknown) => onChange({ ...values, [k]: val });
  return (
    <View>
      {fields.map((f) => (
        <FieldInput key={f.key} field={f} value={values[f.key]} onChange={(v) => set(f.key, v)} />
      ))}
    </View>
  );
}

function FieldLabel({ field }: { field: Field }) {
  return (
    <Text style={[font.tiny, { color: colors.textMuted, marginBottom: 6 }]}>
      {t(field.label)}
      {field.required ? ' *' : ''}
    </Text>
  );
}

function FieldInput({ field, value, onChange }: { field: Field; value: unknown; onChange: (v: unknown) => void }) {
  const [uploading, setUploading] = useState(false);
  const str = (value as string) ?? '';

  switch (field.type) {
    case 'steps':
      return <StepsEditor label={field.label} value={(value as StepDraft[]) ?? []} onChange={onChange} />;

    case 'datetime':
      return (
        <DateTimeFields
          dateLabel={`${t(field.label)}${field.required ? ' *' : ''}`}
          timeLabel={field.timeLabel ? t(field.timeLabel) : undefined}
          value={(value as DateTimeValue) ?? { date: '', time: '' }}
          onChange={onChange}
        />
      );

    case 'bool':
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>{t(field.label)}</Text>
            {field.help ? <Text style={{ color: colors.textDim, fontSize: 12 }}>{t(field.help)}</Text> : null}
          </View>
          <Switch value={Boolean(value)} onValueChange={onChange} trackColor={{ true: colors.primary }} />
        </View>
      );

    case 'select':
      return (
        <View style={{ marginBottom: 16 }}>
          <FieldLabel field={field} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 }}>
            {!field.required ? <Chip label="—" active={!str} onPress={() => onChange('')} /> : null}
            {(field.options ?? []).map((o) => (
              <Chip key={o.value} label={tl(o.label)} active={str === o.value} onPress={() => onChange(o.value)} />
            ))}
          </View>
        </View>
      );

    case 'color':
      return (
        <View style={{ marginBottom: 16 }}>
          <FieldLabel field={field} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
            {PALETTE.map((c) => (
              <Pressable key={c} onPress={() => onChange(c)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, borderWidth: 3, borderColor: str.toUpperCase() === c ? colors.text : 'transparent' }} />
            ))}
          </View>
          <Input value={str} onChangeText={onChange} placeholder="#FF4D2E" autoCapitalize="characters" icon="color-palette" />
        </View>
      );

    case 'image':
      return (
        <View style={{ marginBottom: 16 }}>
          <FieldLabel field={field} />
          <Pressable
            onPress={async () => {
              try {
                setUploading(true);
                const url = await pickAndUpload('admin', field.aspect);
                if (url) onChange(url);
              } catch (e) {
                Alert.alert(t('Erro no upload'), (e as Error).message);
              } finally {
                setUploading(false);
              }
            }}
            style={{ height: field.aspect && field.aspect[0] === field.aspect[1] ? 120 : 160, width: field.aspect && field.aspect[0] === field.aspect[1] ? 120 : '100%', borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: alpha(colors.primary, 0.05), alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {uploading ? (
              <ActivityIndicator color={colors.primary} />
            ) : str ? (
              <Image source={str} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={26} color={colors.primary} />
                <Text style={{ color: colors.textMuted, marginTop: 4 }}>{t('Enviar imagem')}</Text>
              </>
            )}
          </Pressable>
          {str ? (
            <Text onPress={() => onChange('')} style={{ color: colors.danger, marginTop: 6, fontSize: 12 }}>
              {t('Remover imagem')}
            </Text>
          ) : null}
        </View>
      );

    default:
      return (
        <View>
          <Input
            label={`${t(field.label)}${field.required ? ' *' : ''}`}
            value={str}
            onChangeText={onChange}
            placeholder={field.placeholder}
            multiline={field.type === 'multiline'}
            keyboardType={field.type === 'number' ? 'decimal-pad' : field.type === 'url' ? 'url' : 'default'}
            autoCapitalize={field.type === 'url' ? 'none' : 'sentences'}
          />
          {field.help ? <Text style={{ color: colors.textDim, fontSize: 12, marginTop: -10, marginBottom: 14 }}>{t(field.help)}</Text> : null}
        </View>
      );
  }
}
