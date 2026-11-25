import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { alpha, colors, radius } from '@/theme';

import { GradientButton } from './ui';

/**
 * Aparece só enquanto o sistema não tem nenhum administrador: o primeiro usuário
 * se torna admin com um toque (depois, ele promove os outros na tela de acessos).
 */
export function FirstAdminBanner() {
  const { isAdmin, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const q = useAsync(async () => {
    const { data } = await supabase.rpc('admin_exists');
    return Boolean(data);
  }, []);

  if (isAdmin || q.loading || q.data !== false) return null;

  async function claim() {
    setBusy(true);
    const { error } = await supabase.rpc('claim_first_admin');
    setBusy(false);
    if (error) return Alert.alert('Não foi possível', error.message);
    await refreshProfile();
    q.setData(true);
    Alert.alert('Você é o administrador! 🎉', 'Agora você pode cadastrar corridas, treinos, patrocinadores, kits e outros administradores.', [
      { text: 'Abrir painel', onPress: () => router.push('/admin') },
    ]);
  }

  return (
    <View style={{ backgroundColor: alpha(colors.lime, 0.1), borderRadius: radius.lg, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: alpha(colors.lime, 0.5) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="shield-checkmark" size={20} color={colors.lime} />
        <Text style={{ color: colors.text, fontWeight: '800', flex: 1 }}>Configuração inicial</Text>
      </View>
      <Text style={{ color: colors.textMuted, marginTop: 6, fontSize: 13 }}>
        Ainda não existe nenhum administrador. Se você é o responsável pela plataforma, assuma o acesso de administrador para cadastrar as corridas.
      </Text>
      <GradientButton small title="Tornar-me administrador" icon="key" colorsPair={[colors.lime, colors.cyan]} loading={busy} onPress={claim} style={{ marginTop: 12 }} />
    </View>
  );
}
