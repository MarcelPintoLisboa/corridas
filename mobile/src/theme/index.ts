import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';

// Paleta Corre+ (mesma do site correplus.com.br): verde-noite + limão.
// Dois modos: escuro (padrão) e claro. A escolha fica salva no aparelho.
export type ThemeMode = 'dark' | 'light';

/** Cores fixas da marca (iguais nos dois modos): faixas e capas verde-escuras com texto branco */
export const brand = { deep: '#0C1511', night: '#111B17', pine: '#24463A', lime: '#C7F753', paper: '#F4F5EF' };

const DARK = {
  bg: '#0C1511',
  bgElevated: '#111B17',
  surface: '#16231C',
  surfaceAlt: '#1E3027',
  border: '#263B30',
  text: '#F4F5EF',
  textMuted: '#BFC9BB',
  textDim: '#7D8C80',
  primary: '#C7F753',
  secondary: '#A3E635',
  onPrimary: '#0C1511',
  pine: '#24463A',
  lime: '#C7F753',
  cyan: '#00E5FF',
  success: '#00E676',
  warning: '#FFC400',
  danger: '#FF3D71',
};

// Claro: fundo off-white do site, detalhes no verde #ADDA43
const LIGHT: typeof DARK = {
  bg: '#F4F5EF',
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#E9EDE3',
  border: '#DCE1D6',
  text: '#16231C',
  textMuted: '#4B5B50',
  textDim: '#7D8C80',
  primary: '#ADDA43',
  secondary: '#9CCB35',
  onPrimary: '#0C1511',
  pine: '#24463A',
  lime: '#5A8F12',
  cyan: '#0284C7',
  success: '#15A34A',
  warning: '#D97706',
  danger: '#E11D48',
};

const prefFile = () => new File(Paths.document, 'tema.txt');

function readMode(): ThemeMode {
  try {
    const f = prefFile();
    if (f.exists && f.textSync().trim() === 'light') return 'light';
  } catch {}
  return 'dark';
}

let mode: ThemeMode = readMode();

/** Cores do modo atual. O objeto é o mesmo nos dois modos: a troca atualiza os valores. */
export const colors = { ...(mode === 'light' ? LIGHT : DARK) };

const rebuilders: (() => void)[] = [];
const listeners = new Set<() => void>();

/** Objeto de nível de módulo que depende das cores (estilos, mapas): é recalculado quando o modo muda */
export function themed<T extends object>(factory: () => T): T {
  const obj = factory();
  rebuilders.push(() => Object.assign(obj, factory()));
  return obj;
}

export function getThemeMode() {
  return mode;
}

export function setThemeMode(next: ThemeMode) {
  if (next === mode) return;
  mode = next;
  Object.assign(colors, next === 'light' ? LIGHT : DARK);
  rebuilders.forEach((r) => r());
  try {
    const f = prefFile();
    if (!f.exists) f.create();
    f.write(next);
  } catch {}
  listeners.forEach((l) => l());
}

/** Modo atual (re-renderiza quando muda) */
export function useThemeMode() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => mode,
  );
}

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const font = {
  hero: { fontSize: 36, fontWeight: '900' as const, letterSpacing: -1.6 },
  h1: { fontSize: 28, fontWeight: '900' as const, letterSpacing: -1 },
  h2: { fontSize: 21, fontWeight: '800' as const, letterSpacing: -0.5 },
  h3: { fontSize: 16, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  small: { fontSize: 13, fontWeight: '500' as const },
  tiny: { fontSize: 11, fontWeight: '800' as const, letterSpacing: 1.4, textTransform: 'uppercase' as const },
};

/** Mistura uma cor hex com alpha (0..1) → rgba */
export function alpha(hex: string, a: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Cor de texto legível sobre um fundo: escura em cores claras (ex.: limão), branca nas escuras */
export function onColor(hex?: string | null) {
  const h = (hex ?? '').replace('#', '');
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h)) return '#fff';
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const lin = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.4 ? brand.deep : '#fff';
}

export const tierColors: Record<string, string> = {
  master: '#FFD700',
  gold: '#FFB300',
  silver: '#B0BEC5',
  support: '#7E57C2',
};
