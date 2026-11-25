import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Loading } from '@/components/ui';
import { isSupabaseConfigured } from '@/lib/supabase';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { EventProvider } from '@/providers/EventProvider';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, primary: colors.primary, text: colors.text, border: colors.border },
};

function RootNavigator() {
  const { session, loading, isOrganizer } = useAuth();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  if (!isSupabaseConfigured) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>Configure o Supabase</Text>
        <Text style={{ color: colors.textMuted, marginTop: 8 }}>
          Crie o arquivo mobile/.env com EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY (veja .env.example) e reinicie o Expo.
        </Text>
      </View>
    );
  }

  if (loading) return <Loading />;

  const modal = { presentation: 'modal' as const, headerShown: false };

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
      </Stack.Protected>

      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="events/index" />
        <Stack.Screen name="events/[id]" />
        <Stack.Screen name="workout/new" options={modal} />
        <Stack.Screen name="workout/[id]" />
        <Stack.Screen name="tips" />
        <Stack.Screen name="sponsors" />
        <Stack.Screen name="profile" />

        <Stack.Protected guard={isOrganizer}>
          <Stack.Screen name="admin" />
        </Stack.Protected>
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ThemeProvider value={theme}>
        <AuthProvider>
          <EventProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </EventProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
