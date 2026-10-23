import { Ionicons } from '@expo/vector-icons';
import { router, useIsFocused, usePathname, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useDesignTheme } from '../../hooks/use-design-theme';

const mainPages = new Set(['home', 'activity', 'insights', 'explore']);

/** Single tab-shell entry. Availability of the screen never enables AI requests. */
export function GlobalAIAssistantButton() {
  const { user } = useAuth();
  const { colors } = useDesignTheme();
  const segments: readonly string[] = useSegments();
  const focused = useIsFocused();
  const pathname = usePathname();
  const [keyboardVisible, setKeyboardVisible] = useState(Keyboard.isVisible());
  const opening = useRef(false);
  const page = segments.join('/');
  useEffect(() => { opening.current = false; }, [page, focused]);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  if (/\/ChatSupport\/?$/i.test(pathname) || !user || !focused || keyboardVisible || segments.length !== 2 || segments[0] !== '(tabs)' || !mainPages.has(segments[1])) return null;
  return <View pointerEvents="box-none" style={styles.row}>
    <Pressable accessibilityRole="button" accessibilityLabel="Open ExTrack assistant" accessibilityHint="Opens local financial guidance. AI requests remain subject to availability and consent."
      onPress={() => {
        if (opening.current) return;
        opening.current = true;
        Keyboard.dismiss();
        try { router.navigate('/ChatSupport'); } catch { opening.current = false; }
      }}
      style={({ pressed }) => [styles.button, { backgroundColor: colors.surface, borderColor: colors.accent, opacity: pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
      <Ionicons name="chatbubble-ellipses-outline" size={26} color={colors.accent} />
      <View pointerEvents="none" style={[styles.sparkle, { backgroundColor: colors.surface }]}><Ionicons name="sparkles" size={13} color={colors.accent} /></View>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  // Sibling flow keeps the button exactly 12px above the actual bar edge.
  row: { width: '100%', maxWidth: 600, alignItems: 'flex-end', marginBottom: 12 },
  button: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, justifyContent: 'center', alignItems: 'center', shadowColor: '#071126', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 12, elevation: 6 },
  sparkle: { position: 'absolute', top: 8, right: 8, borderRadius: 8, padding: 1 },
});
