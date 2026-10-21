import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, View, type ModalProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Keep modal content inside the usable window, including edge-to-edge Android. */
export function SafeModal({ children, avoidKeyboard = false, ...props }: ModalProps & { avoidKeyboard?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal {...props} statusBarTranslucent navigationBarTranslucent>
      <View style={[styles.viewport, props.transparent && styles.backdrop, {
        paddingTop: insets.top, paddingBottom: insets.bottom,
        paddingLeft: insets.left, paddingRight: insets.right,
      }]}>
        {avoidKeyboard ? (
          <KeyboardAvoidingView style={styles.viewport} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            {children}
          </KeyboardAvoidingView>
        ) : children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(15, 23, 42, 0.65)' },
});
