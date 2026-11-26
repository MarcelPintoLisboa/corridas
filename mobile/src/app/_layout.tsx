import { DarkTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ForcePasswordChange } from '@/components/ForcePasswordChange';
import { Loading } from '@/components/ui';
import { LanguageProvider } from '@/i18n';
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
  const { session, loading, profile } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  // Controle de acesso por redirecionamento: "/" sempre existe como rota
  // (evita a tela "Unmatched Route" no primeiro acesso sem login).
  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    if (!session && !inAuth) router.replace('/login');
    else if (session && inAuth) router.replace('/');
  }, [session, loading, segments, router]);

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
    <View style={{ flex: 1 }}>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
      <Stack.Screen name="events/index" />
      <Stack.Screen name="events/[id]" />
      <Stack.Screen name="workout/new" options={modal} />
      <Stack.Screen name="workout/[id]" />
      <Stack.Screen name="tips" />
      <Stack.Screen name="sponsors" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="updates" />
      <Stack.Screen name="admin" />
    </Stack>
    {/* 1º acesso com senha provisória: cobre o app até a pessoa criar a própria senha */}
    {session && profile?.trocar_senha ? (
      <View style={StyleSheet.absoluteFill}>
        <ForcePasswordChange />
      </View>
    ) : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ThemeProvider value={theme}>
        <LanguageProvider>
          {(lang) => (
            <AuthProvider>
              <EventProvider>
                <StatusBar style="light" />
                {/* trocar o idioma remonta as telas com os textos traduzidos */}
                <RootNavigator key={lang} />
              </EventProvider>
            </AuthProvider>
          )}
        </LanguageProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
