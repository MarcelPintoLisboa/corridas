// sem caracteres que confundem ao ditar/digitar (0/O, 1/l/I)
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const ALL = LOWER + UPPER + DIGITS;

function randomInt(max: number) {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } }).crypto;
  if (c?.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0] % max;
  return Math.floor(Math.random() * max);
}

const pick = (set: string) => set[randomInt(set.length)];

/** Senha aleatória fácil de ler (ex.: "Kp7mWx3qRt"), sempre com minúscula, maiúscula e número */
export function generatePassword(length = 10) {
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS)];
  while (chars.length < length) chars.push(pick(ALL));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
