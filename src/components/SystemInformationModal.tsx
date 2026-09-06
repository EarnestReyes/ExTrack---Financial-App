import React, { useState, useMemo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ScrollView,
  Platform,
} from 'react-native';

import { getThemePreference } from '../database';

interface SystemInformationModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SystemInformationModal: React.FC<SystemInformationModalProps> = ({
  visible,
  onClose,
}) => {
  const systemColorScheme = useColorScheme();

  // Initialize theme state from database preference
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const savedTheme = getThemePreference();
    if (savedTheme !== null) {
      return savedTheme === 'dark';
    }
    return systemColorScheme === 'dark';
  });

  // Re-sync theme preference when the modal opens
  const syncTheme = useCallback(() => {
    const savedTheme = getThemePreference();
    if (savedTheme !== null) {
      setIsDarkMode(savedTheme === 'dark');
    } else {
      setIsDarkMode(systemColorScheme === 'dark');
    }
  }, [systemColorScheme]);

  // Memoize stylesheet matching your exact app palette
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);

  const features = [
    { title: 'Expense & Income Tracking', desc: 'Monitor daily transactions and cash flows seamlessly.' },
    { title: 'Credit Score & Loan Insights', desc: 'Calculate credit health, payment schedules, and outstanding loans.' },
    { title: 'State-Driven Security', desc: 'Firebase authentication with email verification and password recovery.' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onShow={syncTheme}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.content}>
          <View style={styles.dragHandle} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Header / App Brand */}
            <View style={styles.headerSection}>
              <View style={styles.logoCircle}>
                <Text style={styles.logoText}>E</Text>
              </View>
              <Text style={styles.appName}>ExTrack</Text>
              <Text style={styles.appTagline}>Personal Finance Management System</Text>
              <Text style={styles.versionBadge}>v1.0.0 (Build 2026)</Text>
            </View>

            {/* Purpose & Description Card */}
            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>What is ExTrack?</Text>
              <Text style={styles.cardBody}>
                ExTrack is an all-in-one mobile personal finance tracker designed to give you complete visibility over your financial life. It helps you manage personal budgets, track daily expenses, and evaluate financial health metrics with ease.
              </Text>
            </View>

            {/* Core Capabilities */}
            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>Key Capabilities</Text>
              <View style={styles.featureList}>
                {features.map((item, index) => (
                  <View key={index} style={styles.featureItem}>
                    <View style={styles.featureBullet} />
                    <View style={styles.featureTextGroup}>
                      <Text style={styles.featureTitle}>{item.title}</Text>
                      <Text style={styles.featureDesc}>{item.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* System Technical Specs */}
            <View style={styles.specsCard}>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Framework</Text>
                <Text style={styles.specValue}>React Native (Expo Router)</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Backend Auth</Text>
                <Text style={styles.specValue}>Firebase Auth</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Environment</Text>
                <Text style={styles.specValue}>Production / Mobile</Text>
              </View>
            </View>
          </ScrollView>

          {/* Close Action */}
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            activeOpacity={0.8}
          >
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default SystemInformationModal;

// STYLES (Aligned with LoginScreen/Explore palette)
const createStyles = (isDarkMode: boolean) => {
  const cardColor = isDarkMode ? '#1e293b' : '#ffffff';
  const textColor = isDarkMode ? '#f8fafc' : '#0f172a';
  const secondaryTextColor = isDarkMode ? '#94a3b8' : '#64748b';
  const borderColor = isDarkMode ? '#334155' : '#cbd5e1';
  const inputBgColor = isDarkMode ? '#0f172a' : '#f8fafc';

  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(15, 23, 42, 0.5)',
    },
    backdrop: {
      ...StyleSheet.absoluteFill,
    },
    content: {
      backgroundColor: cardColor,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: Platform.OS === 'ios' ? 40 : 24,
      maxHeight: '85%',
      borderWidth: 1,
      borderColor,
    },
    dragHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: isDarkMode ? '#475569' : '#cbd5e1',
      alignSelf: 'center',
      marginBottom: 20,
    },
    scrollContent: {
      paddingBottom: 16,
    },
    headerSection: {
      alignItems: 'center',
      marginBottom: 20,
    },
    logoCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: '#1e3a8a',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    logoText: {
      color: '#ffffff',
      fontSize: 32,
      fontWeight: 'bold',
    },
    appName: {
      fontSize: 22,
      fontWeight: 'bold',
      color: textColor,
    },
    appTagline: {
      fontSize: 13,
      color: secondaryTextColor,
      marginTop: 2,
    },
    versionBadge: {
      marginTop: 8,
      fontSize: 11,
      fontWeight: '700',
      color: '#3b82f6',
      backgroundColor: isDarkMode ? '#0f172a' : '#eff6ff',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#dbeafe',
    },
    infoCard: {
      backgroundColor: inputBgColor,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor,
      marginBottom: 14,
    },
    cardTitle: {
      fontSize: 13,
      fontWeight: 'bold',
      color: '#3b82f6',
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    cardBody: {
      fontSize: 13,
      color: secondaryTextColor,
      lineHeight: 20,
    },
    featureList: {
      gap: 10,
      marginTop: 4,
    },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    featureBullet: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#3b82f6',
      marginTop: 6,
      marginRight: 10,
    },
    featureTextGroup: {
      flex: 1,
    },
    featureTitle: {
      fontSize: 13,
      fontWeight: 'bold',
      color: textColor,
    },
    featureDesc: {
      fontSize: 12,
      color: secondaryTextColor,
      marginTop: 1,
    },
    specsCard: {
      backgroundColor: inputBgColor,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor,
    },
    specRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 10,
    },
    specLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: secondaryTextColor,
    },
    specValue: {
      fontSize: 12,
      fontWeight: 'bold',
      color: textColor,
    },
    divider: {
      height: 1,
      backgroundColor: borderColor,
    },
    closeButton: {
      marginTop: 12,
      paddingVertical: 16,
      backgroundColor: '#1e3a8a',
      borderRadius: 15,
      alignItems: 'center',
    },
    closeText: {
      color: '#ffffff',
      fontWeight: 'bold',
      fontSize: 15,
    },
  });
};