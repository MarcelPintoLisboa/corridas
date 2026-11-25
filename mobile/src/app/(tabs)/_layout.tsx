import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/components/ui';
import { useActiveEvent } from '@/providers/EventProvider';
import { alpha, colors } from '@/theme';

const TABS: { name: string; label: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', label: 'Início', icon: 'home-outline', iconActive: 'home' },
  { name: 'training', label: 'Treino', icon: 'barbell-outline', iconActive: 'barbell' },
  { name: 'results', label: 'Evolução', icon: 'stats-chart-outline', iconActive: 'stats-chart' },
  { name: 'event', label: 'Corrida', icon: 'flag-outline', iconActive: 'flag' },
  { name: 'sponsors', label: 'Parceiros', icon: 'gift-outline', iconActive: 'gift' },
];

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void; emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
};

function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { accent } = useActiveEvent();
  return (
    <View style={[s.bar, { bottom: Math.max(insets.bottom, 12) }]}>
      {state.routes.map((route, i) => {
        const tab = TABS.find((t) => t.name === route.name);
        if (!tab) return null;
        const focused = state.index === i;
        return (
          <TabItem
            key={route.key}
            tab={tab}
            focused={focused}
            accent={accent}
            onPress={() => {
              const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !ev.defaultPrevented) {
                Haptics.selectionAsync().catch(() => {});
                navigation.navigate(route.name);
              }
            }}
          />
        );
      })}
    </View>
  );
}

function TabItem({ tab, focused, accent, onPress }: { tab: (typeof TABS)[number]; focused: boolean; accent: string; onPress: () => void }) {
  const v = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    v.value = withSpring(focused ? 1 : 0, { damping: 14 });
  }, [focused, v]);
  const pill = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ scale: 0.6 + v.value * 0.4 }] }));
  const icon = useAnimatedStyle(() => ({ transform: [{ translateY: -v.value * 2 }, { scale: 1 + v.value * 0.1 }] }));
  return (
    <Pressable onPress={onPress} style={s.item}>
      <Animated.View style={[s.pill, { backgroundColor: alpha(accent, 0.2) }, pill]} />
      <Animated.View style={icon}>
        <Ionicons name={focused ? tab.iconActive : tab.icon} size={22} color={focused ? accent : colors.textMuted} />
      </Animated.View>
      <Text style={[s.label, { color: focused ? colors.text : colors.textDim }]}>{tab.label}</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      tabBar={(props) => <TabBar {...(props as unknown as TabBarProps)} />}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    backgroundColor: 'rgba(22,22,36,0.97)',
    borderRadius: 28,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 20,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  pill: { position: 'absolute', top: 0, bottom: 0, left: 6, right: 6, borderRadius: 20 },
  label: { fontSize: 10, fontWeight: '700', marginTop: 3 },
});
