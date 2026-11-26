import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackHeader } from '@/components/Header';
import { Card, EmptyState, GradientButton, IconButton, Loading, Muted, Screen } from '@/components/ui';
import { FormFields, serialize, toFormValues, type FormValues, type Option } from '@/features/admin/form';
import { resources } from '@/features/admin/resources';
import { useAsync } from '@/hooks/useAsync';
import { supabase, unwrap } from '@/lib/supabase';
import { alpha, colors, font, radius } from '@/theme';
import { t } from '@/i18n';

type Row = Record<string, any>;

export default function CrudScreen() {
  const { resource, parentId } = useLocalSearchParams<{ resource: string; parentId: string }>();
  const cfg = resources[resource];
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState<Row | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const q = useAsync(async () => {
    let query = supabase.from(cfg.table).select('*').eq(cfg.parentKey, parentId);
    for (const o of cfg.order) query = query.order(o.column, { ascending: o.ascending });
    // planos pessoais (anamnese) não aparecem na lista de planos gerais da corrida
    const rows = (unwrap(await query) as Row[]).filter((r) => cfg.table !== 'st_training_plans' || !r.user_id);
    const options = cfg.loadOptions ? await cfg.loadOptions(parentId) : {};
    return { rows, options };
  }, [resource, parentId]);

  if (!cfg) return <EmptyState title="Recurso não encontrado" />;
  if (q.loading || !q.data) return <Loading />;

  const fields = cfg.fields.map((f) => (q.data!.options[f.key] ? { ...f, options: q.data!.options[f.key] as Option[] } : f));

  function openForm(row: Row | null) {
    setEditing(row);
    setValues(toFormValues(fields, row));
    setOpen(true);
  }

  async function onSave() {
    try {
      const payload = serialize(fields, values);
      setSaving(true);
      const res = editing
        ? await supabase.from(cfg.table).update(payload).eq('id', editing.id)
        : await supabase.from(cfg.table).insert({ ...payload, [cfg.parentKey]: parentId });
      if (res.error) throw new Error(res.error.message);
      setOpen(false);
      q.reload();
    } catch (e) {
      const msg = (e as Error).message;
      // colunas novas ainda não criadas no banco
      if (/column .* (does not exist|of relation)|schema cache/i.test(msg) && resource === 'sessions') {
        Alert.alert(t('Erro'), t('Rode o arquivo supabase/migrations/20261126000007_st_sessao_detalhada.sql no SQL Editor do Supabase.'));
      } else {
        Alert.alert(t('Erro'), t(msg));
      }
    } finally {
      setSaving(false);
    }
  }

  function onDelete(row: Row) {
    Alert.alert(t('Excluir?'), cfg.display(row).title, [
      { text: t('Cancelar'), style: 'cancel' },
      {
        text: t('Excluir'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from(cfg.table).delete().eq('id', row.id);
          if (error) return Alert.alert(t('Erro'), t(error.message));
          setOpen(false);
          q.reload();
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen refreshing={q.refreshing} onRefresh={q.refresh} bottomInset={false}>
        <BackHeader title={cfg.title} right={<IconButton icon="add" bg={colors.primary} onPress={() => openForm(null)} />} />
        {!q.data.rows.length ? <EmptyState icon={cfg.icon} title="Nada cadastrado ainda" action="Adicionar" onAction={() => openForm(null)} /> : null}
        {q.data.rows.map((row, i) => {
          const d = cfg.display(row);
          return (
            <Card key={row.id} delay={Math.min(i, 10) * 30} onPress={() => openForm(row)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {d.image ? <Image source={d.image} style={{ width: 48, height: 48, borderRadius: 12 }} /> : null}
              <View style={{ flex: 1 }}>
                <Text style={[font.h3, { color: colors.text }]} numberOfLines={2}>
                  {d.badge ? `${d.badge} ` : ''}
                  {d.title}
                </Text>
                {d.subtitle ? <Muted style={{ fontSize: 12 }} numberOfLines={2}>{d.subtitle}</Muted> : null}
              </View>
              {cfg.rowAction ? (
                <Pressable onPress={() => router.push(cfg.rowAction!.href(row))} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: alpha(colors.primary, 0.15), paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill }}>
                  <Ionicons name={cfg.rowAction.icon} size={14} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>{t(cfg.rowAction.label)}</Text>
                </Pressable>
              ) : (
                <Ionicons name="create-outline" size={18} color={colors.textDim} />
              )}
            </Card>
          );
        })}
      </Screen>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingTop: Platform.OS === 'ios' ? 20 : insets.top + 12, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Text style={[font.h2, { color: colors.text, flex: 1 }]}>{t(editing ? 'Editar' : 'Novo')} · {t(cfg.title)}</Text>
              {editing ? <IconButton icon="trash-outline" color={colors.danger} onPress={() => onDelete(editing)} /> : null}
              <View style={{ width: 8 }} />
              <IconButton icon="close" onPress={() => setOpen(false)} />
            </View>
            <FormFields fields={fields} values={values} onChange={setValues} />
            <GradientButton title="Salvar" icon="checkmark" onPress={onSave} loading={saving} style={{ marginTop: 8 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
