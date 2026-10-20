import { Image, StyleSheet, View } from 'react-native';
import { palette } from '../../constants/design';

export function BrandMark() {
  return <View style={styles.frame}><Image source={require('../../../assets/images/extrack-logo.png')} style={styles.image} accessibilityLabel="ExTrack logo" /></View>;
}
const styles = StyleSheet.create({
  frame: { width: 72, height: 72, borderRadius: 22, backgroundColor: palette.navy, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  image: { width: 58, height: 58, resizeMode: 'contain' },
});
