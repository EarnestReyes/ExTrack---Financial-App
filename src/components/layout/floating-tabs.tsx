import { Ionicons } from '@expo/vector-icons';
import { Tabs, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignTheme } from '../../hooks/use-design-theme';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { GlobalAIAssistantButton } from './GlobalAIAssistantButton';

const items = [
  { name: 'home', label: 'Home', icon: 'home-outline', active: 'home' },
  { name: 'activity', label: 'Activity', icon: 'swap-horizontal-outline', active: 'swap-horizontal' },
  { name: 'insights', label: 'Insights', icon: 'stats-chart-outline', active: 'stats-chart' },
  { name: 'explore', label: 'Profile', icon: 'person-outline', active: 'person' },
] as const;

export default function FloatingTabs() {
  const { colors } = useDesignTheme();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const [barHeight, setBarHeight] = useState(72);
  const bottomSpace = Math.max(insets.bottom, 12);
  return <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background, paddingBottom: barHeight + bottomSpace }, animation: reduced ? 'none' : 'fade' }}
    tabBar={({ state, navigation }) => <View pointerEvents="box-none" style={[styles.position, { paddingBottom: bottomSpace, paddingLeft: Math.max(insets.left, 16), paddingRight: Math.max(insets.right, 16) }]}>
      <GlobalAIAssistantButton />
      <View onLayout={({ nativeEvent }) => setBarHeight(nativeEvent.layout.height)} style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {items.map((item, index) => {
          const route = state.routes.find(value => value.name === item.name);
          const active = state.routes[state.index]?.name === item.name;
          return <View key={item.name} style={{ flex: index === 1 ? 1.8 : 1, flexDirection: 'row' }}>
            <Pressable accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: active }}
              onPress={() => {
                if (!route) return;
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!event.defaultPrevented) navigation.navigate(item.name);
              }} style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.6 : 1 }]}>
              <Ionicons name={active ? item.active : item.icon} size={21} color={active ? colors.accent : colors.secondary} />
              <Text style={[styles.label, { color: active ? colors.accent : colors.secondary, fontWeight: active ? '700' : '500' }]}>{item.label}</Text>
              <View style={[styles.indicator, { backgroundColor: active ? colors.primary : 'transparent' }]} />
            </Pressable>
            {index === 1 && <Pressable accessibilityRole="button" accessibilityLabel="Add transaction" onPress={() => router.navigate({ pathname: '/home', params: { compose: String(Date.now()) } })}
              style={({ pressed }) => [styles.add, { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 }]}>
              <Ionicons name="add" size={30} color="#FFFFFF" />
            </Pressable>}
          </View>;
        })}
      </View>
    </View>}>
    {items.map(item => <Tabs.Screen key={item.name} name={item.name} options={{ title: item.label }} />)}
  </Tabs>;
}

const styles = StyleSheet.create({
  // Overlay one dock; scenes reserve only the measured navigation height.
  position: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  bar: { width: '100%', maxWidth: 600, flexDirection: 'row', alignItems: 'center', borderRadius: 26, paddingHorizontal: 8, paddingVertical: 8, borderWidth: 1, shadowColor: '#071126', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 8 },
  tab: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontSize: 10 },
  indicator: { width: 12, height: 3, borderRadius: 2, marginTop: 1 },
  add: { width: 52, height: 52, alignSelf: 'center', borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginHorizontal: 5 },
});
