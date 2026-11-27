import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Entrar com Face ID / digital: o e-mail e a senha ficam guardados no cofre do
 * aparelho (Keychain no iPhone, Keystore no Android) e só são lidos depois que
 * a biometria do celular confirma que é o dono.
 */
const KEY = 'corre_login_biometria';

type Credenciais = { email: string; password: string };

/** Nome amigável do recurso disponível no aparelho ("Face ID", "digital"...) ou null se não houver */
export async function biometriaDisponivel(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    if (!(await LocalAuthentication.hasHardwareAsync())) return null;
    if (!(await LocalAuthentication.isEnrolledAsync())) return null;
    const tipos = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (tipos.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return Platform.OS === 'ios' ? 'Face ID' : 'reconhecimento facial';
    if (tipos.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return Platform.OS === 'ios' ? 'Touch ID' : 'digital';
    return 'biometria';
  } catch {
    return null;
  }
}

/** E-mail guardado para entrar com biometria (sem pedir a biometria) */
export async function emailComBiometria(): Promise<string | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as Credenciais).email : null;
  } catch {
    return null;
  }
}

export async function salvarBiometria(email: string, password: string) {
  await SecureStore.setItemAsync(KEY, JSON.stringify({ email: email.trim().toLowerCase(), password }));
}

export async function removerBiometria() {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {}
}

/** Pede Face ID / digital e devolve as credenciais guardadas (null se cancelar ou falhar) */
export async function lerComBiometria(): Promise<Credenciais | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  const r = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Entrar no Corre+',
    cancelLabel: 'Usar senha',
    disableDeviceFallback: false,
  });
  if (!r.success) return null;
  return JSON.parse(raw) as Credenciais;
}

/** Confirma com a biometria antes de ligar o recurso */
export async function confirmarBiometria(): Promise<boolean> {
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Ativar entrada com biometria', cancelLabel: 'Cancelar' });
  return r.success;
}
