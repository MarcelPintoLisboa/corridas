import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme';

/** Área administrativa: só administradores (quem organiza as corridas) */
export default function AdminLayout() {
  const { session, isAdmin } = useAuth();
  if (!session) return <Redirect href="/login" />;
  if (!isAdmin) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }} />;
}
