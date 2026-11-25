import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// A chave anon/publishable é pública por natureza (vai dentro do app): a segurança fica nas
// regras RLS do banco. NUNCA coloque aqui a chave service_role/secret.
// O .env (EXPO_PUBLIC_*) só é necessário para apontar para OUTRO projeto Supabase.
const DEFAULT_URL = 'https://eoowbybfrbmjxcjfniuu.supabase.co';
const DEFAULT_ANON_KEY = 'sb_publishable_n5kj7FP4nEklOtYOt5GgKw_GpRUXs_t';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: Platform.OS === 'web' && typeof window === 'undefined' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Renova o token apenas com o app em primeiro plano
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Lança o erro do Supabase ou devolve os dados */
export function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}
