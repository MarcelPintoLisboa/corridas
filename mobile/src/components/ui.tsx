import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { daysUntil, initials } from '@/lib/format';
import { alpha, colors, font, radius, spacing } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------------------------------------------------------------- Screen
export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  padded = true,
  style,
  bottomInset = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  bottomInset?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const content = [padded && { paddingHorizontal: spacing.md }, { paddingBottom: bottomInset ? 120 : 24 }, style];
  if (!scroll) return <View style={[styles.screen, content]}>{children}</View>;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[{ paddingTop: insets.top + 8 }, content]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.text} />
        ) : undefined
      }>
      {children}
    </ScrollView>
  );
}

// ---------------------------------------------------------------- Text
export function Title({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[font.h1, { color: colors.text }, style]}>{tr(children)}</Text>;
}
export function Muted({ children, style, numberOfLines }: { children: ReactNode; style?: object; numberOfLines?: number }) {
  return (
    <Text numberOfLines={numberOfLines} style={[font.body, { color: colors.textMuted }, style]}>
      {tr(children)}
    </Text>
  );
}

/** traduz quando o conteúdo é um texto simples */
const tr = (c: ReactNode) => (typeof c === 'string' ? t(c) : c);

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[font.h2, { color: colors.text }]}>{t(title)}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <Text style={[font.small, { color: colors.textMuted }]}>{t(action)} ›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- Buttons
export function GradientButton({
  title,
  onPress,
  icon,
  loading,
  disabled,
  colorsPair,
  variant = 'solid',
  style,
  small,
}: {
  title: string;
  onPress?: () => void;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  colorsPair?: [string, string];
  variant?: 'solid' | 'ghost';
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const pair = colorsPair ?? [colors.primary, colors.secondary];
  const inner = (
    <View style={[styles.btnInner, small && { paddingVertical: 10, paddingHorizontal: 14 }]}>
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 16 : 20} color="#fff" /> : null}
          <Text style={[styles.btnText, small && { fontSize: 14 }]}>{t(title)}</Text>
        </>
      )}
    </View>
  );
  return (
    <Animated.View style={[anim, { opacity: disabled ? 0.5 : 1 }, style]}>
      <Pressable
        disabled={disabled || loading}
        onPressIn={() => scale.set(withSpring(0.95))}
        onPressOut={() => scale.set(withSpring(1))}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPress?.();
        }}>
        {variant === 'solid' ? (
          <LinearGradient colors={pair} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
            {inner}
          </LinearGradient>
        ) : (
          <View style={[styles.btn, { borderWidth: 1.5, borderColor: pair[0], backgroundColor: alpha(pair[0], 0.08) }]}>
            {inner}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function IconButton({ icon, onPress, color = colors.text, bg = colors.surface, size = 22 }: {
  icon: IconName; onPress?: () => void; color?: string; bg?: string; size?: number;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.iconBtn, { backgroundColor: bg, opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

// ---------------------------------------------------------------- Card
export function Card({
  children,
  style,
  onPress,
  delay = 0,
  animated = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  delay?: number;
  animated?: boolean;
}) {
  const body = onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}>
      {children}
    </Pressable>
  ) : (
    <View style={[styles.card, style]}>{children}</View>
  );
  if (!animated) return body;
  return <Animated.View entering={FadeInDown.delay(delay).springify().damping(16)}>{body}</Animated.View>;
}

export function FadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return <Animated.View entering={FadeInDown.delay(delay).springify().damping(16)}>{children}</Animated.View>;
}

// ---------------------------------------------------------------- Inputs
export function Input({ label, icon, style, ...props }: TextInputProps & { label?: string; icon?: IconName }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Text style={styles.label}>{t(label)}</Text> : null}
      <View style={[styles.inputWrap, focused && { borderColor: colors.primary }]}>
        {icon ? <Ionicons name={icon} size={18} color={colors.textMuted} style={{ marginRight: 8 }} /> : null}
        <TextInput
          placeholderTextColor={colors.textDim}
          {...props}
          placeholder={props.placeholder ? t(props.placeholder) : undefined}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[styles.input, props.multiline && { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 }, style]}
        />
      </View>
    </View>
  );
}

export function Chip({ label, active, onPress, color = colors.primary }: {
  label: string; active?: boolean; onPress?: () => void; color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active ? { backgroundColor: color, borderColor: color } : { borderColor: colors.border }]}>
      <Text style={[font.small, { color: active ? '#fff' : colors.textMuted, fontWeight: '700' }]}>{t(label)}</Text>
    </Pressable>
  );
}

export function Badge({ label, color = colors.primary }: { label: string; color?: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: alpha(color, 0.18) }]}>
      <Text style={[font.tiny, { color, fontSize: 10 }]}>{t(label)}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- Feedback
export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

export function EmptyState({ icon = 'sparkles', title, message, action, onAction }: {
  icon?: IconName; title: string; message?: string; action?: string; onAction?: () => void;
}) {
  return (
    <FadeIn>
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Ionicons name={icon} size={34} color={colors.primary} />
        </View>
        <Text style={[font.h2, { color: colors.text, textAlign: 'center' }]}>{t(title)}</Text>
        {message ? <Muted style={{ textAlign: 'center', marginTop: 6 }}>{t(message)}</Muted> : null}
        {action ? <GradientButton title={t(action)} onPress={onAction} style={{ marginTop: spacing.lg }} /> : null}
      </View>
    </FadeIn>
  );
}

export function Avatar({ uri, name, size = 44 }: { uri?: string | null; name?: string | null; size?: number }) {
  if (uri) return <Image source={uri} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <LinearGradient colors={[colors.primary, colors.secondary]} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.38 }}>{initials(name)}</Text>
    </LinearGradient>
  );
}

// ---------------------------------------------------------------- Stat
export function Stat({ label, value, unit, color = colors.text }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[font.tiny, { color: colors.textMuted }]}>{t(label)}</Text>
      <Text style={{ color, fontSize: 24, fontWeight: '900', marginTop: 2 }}>
        {value}
        {unit ? <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: '600' }}> {t(unit)}</Text> : null}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------- Countdown
export function Countdown({ date, color = colors.lime }: { date: string; color?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const diff = Math.max(0, new Date(date).getTime() - now);
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  const items = [
    { v: d, l: t('dias') },
    { v: h, l: 'h' },
    { v: m, l: 'min' },
    { v: s, l: t('seg') },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {items.map((it) => (
        <View key={it.l} style={styles.countBox}>
          <Text style={{ color, fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{String(it.v).padStart(2, '0')}</Text>
          <Text style={[font.tiny, { color: 'rgba(255,255,255,0.75)', fontSize: 9 }]}>{it.l}</Text>
        </View>
      ))}
    </View>
  );
}

/** Pílula pulsante "faltam X dias" */
export function PulseBadge({ date, color = colors.lime }: { date: string; color?: string }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.08, { duration: 700 }), withTiming(1, { duration: 700 })), -1);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const days = daysUntil(date);
  const label = days > 1 ? t('FALTAM {n} DIAS', { n: days }) : days === 1 ? t('É AMANHÃ!') : days === 0 ? t('É HOJE! 🔥') : t('FINALIZADA');
  return (
    <Animated.View style={[styles.pulse, { backgroundColor: color }, style]}>
      <Text style={{ color: '#000', fontWeight: '900', fontSize: 12, letterSpacing: 1 }}>{label}</Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------- Row
export function ListRow({ icon, title, subtitle, onPress, right, color = colors.primary }: {
  icon?: IconName; title: string; subtitle?: string; onPress?: () => void; right?: ReactNode; color?: string;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      {icon ? (
        <View style={[styles.rowIcon, { backgroundColor: alpha(color, 0.15) }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[font.h3, { color: colors.text }]}>{t(title)}</Text>
        {subtitle ? <Muted style={{ fontSize: 13, marginTop: 2 }} numberOfLines={2}>{t(subtitle)}</Muted> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textDim} /> : null)}
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, minHeight: 200 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm + 4 },
  btn: { borderRadius: radius.pill },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, paddingHorizontal: 22 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm + 4, borderWidth: 1, borderColor: colors.border },
  label: { ...font.tiny, color: colors.textMuted, marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgElevated, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 14 },
  input: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1.5, marginRight: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm, alignSelf: 'flex-start' },
  empty: { alignItems: 'center', padding: spacing.xl, marginTop: spacing.lg },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: alpha(colors.primary, 0.15), alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  countBox: { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: radius.md, paddingVertical: 8, minWidth: 62, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  pulse: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
