import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { t } from '@/i18n';

interface AuthCtx {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** Administrador: organiza as corridas e gerencia todo o conteúdo */
  isAdmin: boolean;
  /** Administrador geral fixo (mapl11@hotmail.com) */
  isAdminGeral: boolean;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, phone?: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

interface MinhaConta {
  situacao: 'ok' | 'desativado';
  usuario: Profile;
  admin: boolean;
  admin_geral: boolean;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [admin, setAdmin] = useState({ isAdmin: false, isAdminGeral: false });
  const [loading, setLoading] = useState(true);

  /** Liga/cria o cadastro em st_usuarios e carrega o papel (controle de acesso) */
  const loadAccount = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      setAdmin({ isAdmin: false, isAdminGeral: false });
      return;
    }
    const meta = s.user.user_metadata ?? {};
    const { data, error } = await supabase.rpc('st_minha_conta', {
      p_full_name: (meta.full_name as string) ?? null,
      p_phone: (meta.phone as string) ?? null,
    });
    if (error || !data) {
      setProfile(null);
      return;
    }
    const conta = data as MinhaConta;
    if (conta.situacao === 'desativado') {
      Alert.alert(t('Acesso desativado'), t('Seu acesso ao Corre+ foi desativado. Fale com a organização.'));
      await supabase.auth.signOut();
      return;
    }
    setProfile(conta.usuario);
    setAdmin({ isAdmin: conta.admin, isAdminGeral: conta.admin_geral });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadAccount(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      // fora do callback do Supabase (evita travar o cliente de auth)
      setTimeout(() => loadAccount(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadAccount]);

  const value: AuthCtx = {
    session,
    profile,
    loading,
    isAdmin: admin.isAdmin,
    isAdminGeral: admin.isAdminGeral,
    refreshProfile: () => loadAccount(session),
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) throw new Error(translateAuthError(error.message));
    },
    async signUp(email, password, fullName, phone) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { full_name: fullName, phone } },
      });
      if (error) throw new Error(translateAuthError(error.message));
      return { needsConfirmation: !data.session };
    },
    async signOut() {
      await supabase.auth.signOut();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

function translateAuthError(msg: string) {
  if (/invalid login/i.test(msg)) return t('E-mail ou senha incorretos');
  if (/already registered/i.test(msg)) return t('Este e-mail já possui cadastro. Use "Entrar" (mesma senha do Assistência ML, se tiver).');
  if (/password should be/i.test(msg)) return t('A senha deve ter pelo menos 6 caracteres');
  if (/email not confirmed/i.test(msg)) return t('Confirme seu e-mail antes de entrar');
  return msg;
}
