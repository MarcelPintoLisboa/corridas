import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/theme';

/** Fundo animado com "blobs" de gradiente flutuando */
export function AuthHero({ title, subtitle }: { title: string; subtitle: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [t]);
  const blob1 = useAnimatedStyle(() => ({ transform: [{ translateX: -40 + t.value * 80 }, { translateY: t.value * 30 }, { scale: 1 + t.value * 0.2 }] }));
  const blob2 = useAnimatedStyle(() => ({ transform: [{ translateX: 40 - t.value * 70 }, { translateY: -t.value * 40 }] }));
  const icon = useAnimatedStyle(() => ({ transform: [{ translateX: -10 + t.value * 20 }, { rotate: `${-8 + t.value * 16}deg` }] }));

  return (
    <View style={s.wrap}>
      <Animated.View style={[s.blob, { backgroundColor: colors.primary, top: -60, left: -40 }, blob1]} />
      <Animated.View style={[s.blob, { backgroundColor: colors.secondary, top: 40, right: -80 }, blob2]} />
      <LinearGradient colors={['transparent', colors.bg]} style={StyleSheet.absoluteFill} />
      <View style={s.content}>
        <Animated.View style={[s.logo, icon]}>
          <LinearGradient colors={[colors.primary, colors.secondary]} style={s.logoInner}>
            <Ionicons name="flash" size={38} color="#fff" />
          </LinearGradient>
        </Animated.View>
        <Animated.Text entering={FadeInDown.delay(100).springify()} style={s.brand}>
          RUN<Text style={{ color: colors.lime }}>UP</Text>
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(200).springify()} style={s.title}>{title}</Animated.Text>
        <Animated.Text entering={FadeInDown.delay(300).springify()} style={s.subtitle}>{subtitle}</Animated.Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { height: 330, overflow: 'hidden', justifyContent: 'flex-end' },
  blob: { position: 'absolute', width: 300, height: 300, borderRadius: 150, opacity: 0.55 },
  content: { paddingHorizontal: 24, paddingBottom: 12 },
  logo: { marginBottom: 14, alignSelf: 'flex-start' },
  logoInner: { width: 70, height: 70, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  brand: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 6 },
  title: { color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: -1, marginTop: 4 },
  subtitle: { color: colors.textMuted, fontSize: 15, marginTop: 6 },
});
