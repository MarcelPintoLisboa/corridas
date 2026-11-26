import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { colors } from '@/theme';

/**
 * Retorno do login do Strava (streetrunning://strava-conectado?ok=1).
 * No iPhone a sessão de login captura o endereço antes; no Android o link também
 * chega ao roteador, então esta tela só volta para onde o corredor estava.
 */
export default function StravaReturn() {
  useEffect(() => {
    const id = setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/')), 50);
    return () => clearTimeout(id);
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
