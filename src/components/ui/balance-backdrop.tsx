import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

export function BalanceBackdrop() {
  return <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 400 240">
    <Defs><LinearGradient id="balanceAmbient" x1="0" y1="1" x2="1" y2="0"><Stop offset="0" stopColor="#142744" /><Stop offset="1" stopColor="#345C9C" /></LinearGradient></Defs>
    <Rect width="400" height="240" rx="28" fill="url(#balanceAmbient)" />
  </Svg>;
}
