import * as Haptics from 'expo-haptics';
import { Pressable, Text, View } from 'react-native';

import { useLanguage, type Lang } from '@/i18n';
import { colors, onColor } from '@/theme';

const OPTIONS: { lang: Lang; flag: string; label: string }[] = [
  { lang: 'pt', flag: '🇧🇷', label: 'PT' },
  { lang: 'en', flag: '🇺🇸', label: 'EN' },
];

/** Botão de idioma (Português / English) — fica no topo da tela Início */
export function LanguageToggle() {
  const { lang, setLang } = useLanguage();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={lang === 'en' ? 'Language' : 'Idioma'}
      style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 99, borderWidth: 1, borderColor: colors.border, padding: 3 }}>
      {OPTIONS.map((o) => {
        const on = o.lang === lang;
        return (
          <Pressable
            key={o.lang}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            hitSlop={6}
            onPress={() => {
              if (on) return;
              Haptics.selectionAsync().catch(() => {});
              setLang(o.lang);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99, backgroundColor: on ? colors.primary : 'transparent' }}>
            <Text style={{ fontSize: 13 }}>{o.flag}</Text>
            <Text style={{ color: on ? onColor(colors.primary) : colors.textMuted, fontWeight: '800', fontSize: 12 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
