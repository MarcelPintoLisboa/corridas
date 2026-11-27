import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/theme';
import { t } from '@/i18n';

/** Fundo animado com "blobs" de gradiente flutuando */
export function AuthHero({ title, subtitle }: { title: string; subtitle: string }) {
  const k = useSharedValue(0);
  useEffect(() => {
    k.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [k]);
  const blob1 = useAnimatedStyle(() => ({ transform: [{ translateX: -40 + k.value * 80 }, { translateY: k.value * 30 }, { scale: 1 + k.value * 0.2 }] }));
  const blob2 = useAnimatedStyle(() => ({ transform: [{ translateX: 40 - k.value * 70 }, { translateY: -k.value * 40 }] }));
  const icon = useAnimatedStyle(() => ({ transform: [{ translateX: -4 + k.value * 8 }] }));

  return (
    <View style={s.wrap}>
      <Animated.View style={[s.blob, { backgroundColor: colors.primary, top: -60, left: -40 }, blob1]} />
      <Animated.View style={[s.blob, { backgroundColor: colors.pine, top: 40, right: -80 }, blob2]} />
      <LinearGradient colors={['transparent', colors.bg]} style={StyleSheet.absoluteFill} />
      <View style={s.content}>
        {/* marca Corre+ */}
        <Animated.View style={[s.logo, icon]}>
          <Image source={require('@/assets/images/logo-wordmark.png')} style={{ width: 210, height: 54 }} contentFit="contain" accessibilityLabel="Corre+" />
        </Animated.View>
        <Animated.Text entering={FadeInDown.delay(200).springify()} style={s.title}>{t(title)}</Animated.Text>
        <Animated.Text entering={FadeInDown.delay(300).springify()} style={s.subtitle}>{t(subtitle)}</Animated.Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { height: 330, overflow: 'hidden', justifyContent: 'flex-end' },
  blob: { position: 'absolute', width: 300, height: 300, borderRadius: 150, opacity: 0.35 },
  content: { paddingHorizontal: 24, paddingBottom: 12 },
  logo: { marginBottom: 16, alignSelf: 'flex-start' },
  title: { color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: -1, marginTop: 4 },
  subtitle: { color: colors.textMuted, fontSize: 15, marginTop: 6 },
});
