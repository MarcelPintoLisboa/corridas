import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { en } from './en';

/**
 * Internacionalização simples: o texto em português é a própria chave.
 *   t('Início')                      → "Home" (em inglês) / "Início" (em português)
 *   t('Faltam {n} dias', { n: 3 })   → "3 days to go"
 * Texto sem tradução cadastrada aparece em português (nunca quebra a tela).
 * Ao trocar o idioma, a árvore de telas é remontada (ver LanguageProvider),
 * então `t()` pode ser chamado em qualquer lugar, inclusive fora de componentes.
 */
export type Lang = 'pt' | 'en';

const STORAGE_KEY = 'app-language';
let current: Lang = 'pt';

export const getLang = () => current;
export const isEn = () => current === 'en';

export function t(pt: string, vars?: Record<string, string | number>): string {
  let s = current === 'en' ? (en[pt] ?? pt) : pt;
  if (vars) for (const k in vars) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
}

/** Plural simples: tn(n, '{n} treino', '{n} treinos') */
export function tn(n: number, one: string, many: string) {
  return t(n === 1 ? one : many, { n });
}

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
}
const Ctx = createContext<LangCtx | null>(null);

export function LanguageProvider({ children }: { children: (lang: Lang) => ReactNode }) {
  const [lang, setLangState] = useState<Lang | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        current = v === 'en' ? 'en' : 'pt';
        setLangState(current);
      })
      .catch(() => setLangState('pt'));
  }, []);

  const setLang = (l: Lang) => {
    current = l;
    setLangState(l);
    AsyncStorage.setItem(STORAGE_KEY, l).catch(() => {});
  };

  if (!lang) return null;
  return <Ctx.Provider value={{ lang, setLang, toggle: () => setLang(lang === 'en' ? 'pt' : 'en') }}>{children(lang)}</Ctx.Provider>;
}

export function useLanguage() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
