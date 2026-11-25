import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform } from 'react-native';

import { BackHeader } from '@/components/Header';
import { GradientButton, IconButton, Loading, Screen } from '@/components/ui';
import { FormFields, serialize, toFormValues, type FormValues } from '@/features/admin/form';
import { eventFields } from '@/features/admin/resources';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useActiveEvent } from '@/providers/EventProvider';
import { colors } from '@/theme';

export default function EventForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useAuth();
  const { reload } = useActiveEvent();
  const [values, setValues] = useState<FormValues | null>(id ? null : toFormValues(eventFields, null));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => setValues(toFormValues(eventFields, data)));
  }, [id]);

  if (!values) return <Loading />;

  async function onSave() {
    try {
      const payload = serialize(eventFields, values!);
      setSaving(true);
      if (id) {
        const { error } = await supabase.from('events').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const slug = String(payload.name).toLowerCase().normalize('NFD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') + '-' + Date.now().toString(36);
        const { data, error } = await supabase
          .from('events')
          .insert({ ...payload, slug, organizer_id: session!.user.id })
          .select('id')
          .single();
        if (error) throw error;
        await supabase.from('event_staff').insert({ event_id: data.id, user_id: session!.user.id, role: 'owner' });
        router.replace(`/admin/event/${data.id}`);
        return;
      }
      await reload();
      router.back();
    } catch (e) {
      Alert.alert('Erro', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    Alert.alert('Excluir corrida?', 'Todos os dados (inscrições, treinos vinculados, leads) serão removidos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('events').delete().eq('id', id!);
          if (error) return Alert.alert('Erro', error.message);
          router.dismissTo('/admin');
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen bottomInset={false}>
        <BackHeader title={id ? 'Personalizar corrida' : 'Nova corrida'} right={id ? <IconButton icon="trash-outline" color={colors.danger} onPress={onDelete} /> : null} />
        <FormFields fields={eventFields} values={values} onChange={setValues} />
        <GradientButton
          title="Salvar"
          icon="checkmark"
          onPress={onSave}
          loading={saving}
          colorsPair={[(values.primary_color as string) || colors.primary, (values.secondary_color as string) || colors.secondary]}
          style={{ marginTop: 8, marginBottom: 40 }}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}
