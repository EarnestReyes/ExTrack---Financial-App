import React, { useState, useMemo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getThemePreference } from '../database';

// 1. Import your local image here (adjust the path based on your folder structure)
// For example, if DeveloperModal is in `src/components` and your image is in `src/assets/images`:
import LocalDevImage from '../../assets/images/developer.jpg'; 
// Or if your image is named differently, update the filename above.

interface DeveloperModalProps {
  visible: boolean;
  onClose: () => void;
  /** Optional override if you want to pass a dynamic URI sometimes */
  profileImageUri?: string;
}

const SPECIALTIES = [
  'Full-Stack Web (PHP, HTML/CSS)',
  'Mobile Dev (Android / Java)',
  'SQL Databases (MySQL, SQL Server)',
  'Java Desktop Applications',
  'Authentication & Security (OTP)',
  'UI/UX & Layout Optimization',
] as const;

export const DeveloperModal: React.FC<DeveloperModalProps> = ({
  visible,
  onClose,
  profileImageUri,
}) => {
  const systemColorScheme = useColorScheme();

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const savedTheme = getThemePreference();
    if (savedTheme !== null) {
      return savedTheme === 'dark';
    }
    return systemColorScheme === 'dark';
  });

  const syncTheme = useCallback(() => {
    const savedTheme = getThemePreference();
    if (savedTheme !== null) {
      setIsDarkMode(savedTheme === 'dark');
    } else {
      setIsDarkMode(systemColorScheme === 'dark');
    }
  }, [systemColorScheme]);

  const insets = useSafeAreaInsets();

  const styles = useMemo(
    () => createStyles(isDarkMode, insets.bottom),
    [isDarkMode, insets.bottom]
  );

  // 2. Resolve the local image source safely so it works across platforms
  const resolvedImageSource = profileImageUri 
    ? { uri: profileImageUri } 
    : LocalDevImage;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onShow={syncTheme}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close modal overlay"
        />

        <View style={styles.content}>
          <View style={styles.dragHandle} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            bounces={false}
          >
            {/* Profile Avatar Section */}
            <View style={styles.profileSection}>
              <View style={styles.avatarContainer}>
                {/* 3. Render the local image or fall back gracefully */}
                <Image
                  source={resolvedImageSource}
                  style={styles.avatarImage}
                  accessibilityRole="image"
                  accessibilityLabel="Developer profile avatar"
                />
                <View style={styles.activeBadge} />
              </View>


              <Text style={styles.developerName}>Earnest Reyes</Text>
              <Text style={styles.developerRole}>
                Web, Mobile & Database Specialist
              </Text>
            </View>

            {/* Specialty Cards Section */}
            <View style={styles.cardContainer}>
              <Text style={styles.sectionTitle}>Core Expertise</Text>

              <View style={styles.badgeGrid}>
                {SPECIALTIES.map((item, index) => (
                  <View key={index} style={styles.badge}>
                    <View style={styles.badgeDot} />
                    <Text style={styles.badgeText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* About / Summary Card */}
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>About the Developer</Text>
              <Text style={styles.infoBody}>
                Specializing in building robust desktop payroll systems, secure web platforms, and mobile apps with clean user interfaces and relational databases.
              </Text>
            </View>
          </ScrollView>

          {/* Action Button */}
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Close Developer Modal"
          >
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default DeveloperModal;

const createStyles = (isDarkMode: boolean, bottomInset: number) => {
  const cardBg = isDarkMode ? '#1e293b' : '#ffffff';
  const innerCardBg = isDarkMode ? '#0f172a' : '#f8fafc';
  const textColor = isDarkMode ? '#f8fafc' : '#0f172a';
  const secondaryTextColor = isDarkMode ? '#94a3b8' : '#64748b';
  const borderColor = isDarkMode ? '#334155' : '#cbd5e1';
  const badgeBg = isDarkMode ? '#1e3a8a' : '#eff6ff';
  const badgeBorder = isDarkMode ? '#3BF6AE' : '#bfdbfe';
  const badgeTextColor = isDarkMode ? '#93c5fd' : '#1d4ed8';
  const dragHandleBg = isDarkMode ? '#475569' : '#e2e8f0';

  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.65)',
    },
    backdrop: {
      ...StyleSheet.absoluteFill,
    },
    content: {
      backgroundColor: cardBg,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: Math.max(bottomInset, Platform.OS === 'ios' ? 24 : 16) + 8,
      maxHeight: '85%',
      elevation: 24,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: -10 },
      shadowOpacity: 0.25,
      shadowRadius: 20,
      borderWidth: 1,
      borderColor,
    },
    dragHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: dragHandleBg,
      alignSelf: 'center',
      marginBottom: 20,
    },
    scrollContent: {
      paddingBottom: 16,
    },
    profileSection: {
      alignItems: 'center',
      marginBottom: 20,
    },
    avatarContainer: {
      position: 'relative',
      marginBottom: 12,
    },
    avatarImage: {
      width: 90,
      height: 90,
      borderRadius: 45,
      borderWidth: 3,
      borderColor: '#3BF654BE',
    },
    activeBadge: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: '#10b981',
      borderWidth: 3,
      borderColor: cardBg,
    },
    developerName: {
      fontSize: 20,
      fontWeight: '800',
      color: textColor,
      letterSpacing: -0.5,
    },
    developerRole: {
      fontSize: 13,
      fontWeight: '500',
      color: secondaryTextColor,
      marginTop: 2,
    },
    cardContainer: {
      backgroundColor: innerCardBg,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: textColor,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    badgeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: badgeBg,
      borderColor: badgeBorder,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    badgeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#3b82f6',
      marginRight: 6,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: badgeTextColor,
    },
    infoCard: {
      backgroundColor: innerCardBg,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor,
    },
    infoTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: textColor,
      marginBottom: 6,
    },
    infoBody: {
      fontSize: 13,
      color: secondaryTextColor,
      lineHeight: 18,
    },
    closeButton: {
      marginTop: 12,
      paddingVertical: 14,
      backgroundColor: '#1e3a8a',
      borderRadius: 14,
      alignItems: 'center',
    },
    closeText: {
      color: '#ffffff',
      fontWeight: '700',
      fontSize: 15,
      letterSpacing: 0.5,
    },
  });
};