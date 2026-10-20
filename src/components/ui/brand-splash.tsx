import { useEffect, useRef } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Image, StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { palette } from '../../constants/design';

export function BrandSplash({ onComplete, locked }: { onComplete: () => void; locked: boolean }) {
  const entrance = useRef(new Animated.Value(0)).current;
  const finish = useRef(onComplete);
  finish.current = onComplete;
  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    const complete = () => { if (active) finish.current(); };
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', reduced => {
      if (reduced) { animation?.stop(); entrance.setValue(1); complete(); }
    });
    void AccessibilityInfo.isReduceMotionEnabled().catch(() => true).then(reduced => {
      if (!active) return;
      if (reduced) { entrance.setValue(1); complete(); return; }
      animation = Animated.timing(entrance, { toValue: 1, duration: 620, useNativeDriver: true });
      animation.start(({ finished }) => { if (finished) complete(); });
    });
    return () => { active = false; animation?.stop(); listener.remove(); };
  }, [entrance]);
  return <View style={styles.root} onLayout={() => { void SplashScreen.hideAsync().catch(() => {}); }}>
    <View pointerEvents="none" style={styles.ambient} />
    <Animated.View style={{ alignItems: 'center', opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
      <View style={styles.mark}><Image source={require('../../../assets/images/extrack-logo.png')} style={styles.logo} accessibilityLabel="ExTrack logo" /></View>
      <Text style={styles.title}>ExTrack</Text>
      <Text style={styles.subtitle}>A clearer view of your money.</Text>
      {locked && <ActivityIndicator accessibilityLabel="Unlocking your account" color="#91ACFF" style={{ marginTop: 28 }} />}
    </Animated.View>
    <Text style={styles.footer}>YOUR MONEY. YOUR PERSPECTIVE.</Text>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.navy, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  ambient: { position: 'absolute', width: 340, height: 340, borderRadius: 170, backgroundColor: '#182B50', opacity: 0.45 },
  mark: { width: 104, height: 104, borderRadius: 30, backgroundColor: '#1D3052', borderWidth: 1, borderColor: '#30466D', alignItems: 'center', justifyContent: 'center' },
  logo: { width: 82, height: 82, resizeMode: 'contain' },
  title: { fontSize: 38, letterSpacing: -1.5, fontWeight: '700', color: '#FFFFFF', marginTop: 24 },
  subtitle: { fontSize: 15, lineHeight: 24, color: '#A5B3C8', marginTop: 8 },
  footer: { position: 'absolute', bottom: 64, color: '#A5B3C8', fontSize: 10, letterSpacing: 2 },
});
