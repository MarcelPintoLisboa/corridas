export const colors = {
  bg: '#0A0A12',
  bgElevated: '#12121E',
  surface: '#1A1A2A',
  surfaceAlt: '#232338',
  border: '#2C2C44',
  text: '#FFFFFF',
  textMuted: '#A3A3C2',
  textDim: '#6B6B8A',
  primary: '#FF4D2E',
  secondary: '#7B2FF7',
  lime: '#C7F753',
  cyan: '#00E5FF',
  success: '#00E676',
  warning: '#FFC400',
  danger: '#FF3D71',
};

export const radius = { sm: 10, md: 16, lg: 24, xl: 32, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const font = {
  hero: { fontSize: 34, fontWeight: '900' as const, letterSpacing: -1 },
  h1: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '800' as const },
  h3: { fontSize: 16, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  small: { fontSize: 13, fontWeight: '500' as const },
  tiny: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1, textTransform: 'uppercase' as const },
};

/** Mistura uma cor hex com alpha (0..1) → rgba */
export function alpha(hex: string, a: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export const tierColors: Record<string, string> = {
  master: '#FFD700',
  gold: '#FFB300',
  silver: '#B0BEC5',
  support: '#7E57C2',
};
