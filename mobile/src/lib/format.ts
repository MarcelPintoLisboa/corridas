const pad = (n: number) => String(n).padStart(2, '0');

/** 3725 → "1:02:05" ; 1505 → "25:05" */
export function formatDuration(totalSeconds: number | null | undefined) {
  if (totalSeconds == null || !isFinite(totalSeconds)) return '--';
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** segundos/km → "5:32" */
export function formatPace(secPerKm: number | null | undefined) {
  if (!secPerKm || !isFinite(secPerKm)) return '--';
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

/** "1:02:05" | "25:05" | "25" (min) → segundos */
export function parseDuration(input: string): number | null {
  const parts = input.trim().split(':').map((p) => Number(p));
  if (parts.some((p) => isNaN(p))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1 && parts[0] > 0) return parts[0] * 60;
  return null;
}

export function formatKm(km: number | null | undefined, digits = 1) {
  if (km == null) return '--';
  return Number(km).toFixed(digits).replace('.', ',');
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function formatDate(d: string | Date, withWeekday = false) {
  const date = typeof d === 'string' ? new Date(d) : d;
  const base = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return withWeekday ? `${WEEKDAYS[date.getDay()]}, ${base}` : `${base} ${date.getFullYear()}`;
}

export function formatTime(d: string | Date) {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDateTime(d: string | Date) {
  return `${formatDate(d, true)} · ${formatTime(d)}`;
}

export function weekdayShort(d: Date) {
  return WEEKDAYS[d.getDay()];
}

/** "2027-01-20 19:00" → ISO; aceita também ISO */
export function parseDateTimeInput(input: string): string | null {
  const m = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function toDateTimeInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function daysUntil(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

export function initials(name?: string | null) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export const levelLabel: Record<string, string> = {
  beginner: 'Iniciante',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
};

export const leadStatusLabel: Record<string, string> = {
  new: 'Novo',
  contacted: 'Contatado',
  qualified: 'Qualificado',
  converted: 'Convertido',
  lost: 'Perdido',
};

export const leadStatusColor: Record<string, string> = {
  new: '#00E5FF',
  contacted: '#FFC400',
  qualified: '#7B2FF7',
  converted: '#00E676',
  lost: '#FF3D71',
};

export const tipCategoryLabel: Record<string, { label: string; emoji: string; color: string }> = {
  training: { label: 'Treino', emoji: '🏃', color: '#FF4D2E' },
  nutrition: { label: 'Alimentação', emoji: '🥗', color: '#00E676' },
  hydration: { label: 'Hidratação', emoji: '💧', color: '#00E5FF' },
  recovery: { label: 'Recuperação', emoji: '😴', color: '#7B2FF7' },
  mindset: { label: 'Mente', emoji: '🧠', color: '#FFC400' },
  race_day: { label: 'Dia da prova', emoji: '🏁', color: '#FF3D71' },
};

export const sessionTypeMeta: Record<string, { label: string; color: string; icon: string }> = {
  easy: { label: 'Leve', color: '#00E676', icon: 'walk' },
  long: { label: 'Longão', color: '#7B2FF7', icon: 'trail-sign' },
  tempo: { label: 'Ritmo', color: '#FFC400', icon: 'speedometer' },
  interval: { label: 'Tiros', color: '#FF4D2E', icon: 'flash' },
  fartlek: { label: 'Fartlek', color: '#FF9100', icon: 'shuffle' },
  recovery: { label: 'Regenerativo', color: '#00E5FF', icon: 'leaf' },
  strength: { label: 'Força', color: '#B388FF', icon: 'barbell' },
  rest: { label: 'Descanso', color: '#6B6B8A', icon: 'bed' },
  race: { label: 'PROVA', color: '#C6FF00', icon: 'flag' },
};

// ------------------------------------------------ Data/hora no formato brasileiro (campos separados)
/** ISO → "25/12/2027" */
export function toDateInputBR(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** ISO → "19:30" */
export function toTimeInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Máscara enquanto digita: "25122027" → "25/12/2027" */
export function maskDateBR(text: string) {
  const n = text.replace(/\D/g, '').slice(0, 8);
  return [n.slice(0, 2), n.slice(2, 4), n.slice(4, 8)].filter(Boolean).join('/');
}

/** Máscara enquanto digita: "1930" → "19:30" */
export function maskTime(text: string) {
  const n = text.replace(/\D/g, '').slice(0, 4);
  return n.length > 2 ? `${n.slice(0, 2)}:${n.slice(2)}` : n;
}

/** "25/12/2027" + "19:30" (hora opcional = 00:00) → ISO; null se inválido */
export function parseDateTimeBR(date: string, time: string): string | null {
  const m = date.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const t = time.trim() ? time.trim().match(/^(\d{1,2}):(\d{2})$/) : (['', '0', '0'] as unknown as RegExpMatchArray);
  if (!t) return null;
  const [day, month, year, h, min] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(t[1]), Number(t[2])];
  if (h > 23 || min > 59) return null;
  const d = new Date(year, month - 1, day, h, min);
  // rejeita datas como 31/02
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d.toISOString();
}
