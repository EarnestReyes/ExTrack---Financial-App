import { SafeModal as Modal } from '../../../components/ui/safe-modal';
import { palette, themes } from "../../../constants/design";
import { useReducedMotion } from "../../../hooks/use-reduced-motion";
import React, { useCallback, useMemo, useState } from 'react';
import {
Image,
Platform,
ScrollView,
StyleSheet,
Text,
TouchableOpacity,
useColorScheme,
View,
} from 'react-native';
import { getThemePreference } from '../../../database';

// 1. Import your local image here (adjust the path based on your folder structure)
// For example, if DeveloperModal is in `src/components` and your image is in `src/assets/images`:
import LocalDevImage from '../../../../assets/images/developer.jpg';
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
  const reducedMotion = useReducedMotion();

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


  const styles = useMemo(
    () => createStyles(isDarkMode, 0),
    [isDarkMode]
  );

  // 2. Resolve the local image source safely so it works across platforms
  const resolvedImageSource = profileImageUri 
    ? { uri: profileImageUri } 
    : LocalDevImage;

  return (
    <Modal
      visible={visible}
      animationType={reducedMotion ? "none" : "slide"}
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
  const cardBg = isDarkMode ? themes.dark.surface : palette.white;
  const innerCardBg = isDarkMode ? themes.dark.background : themes.light.background;
  const textColor = isDarkMode ? themes.light.background : themes.dark.background;
  const secondaryTextColor = isDarkMode ? themes.dark.secondary : themes.light.secondary;
  const borderColor = isDarkMode ? themes.dark.border : themes.light.border;
  const badgeBg = isDarkMode ? themes.light.accent : '#eff6ff';
  const badgeBorder = isDarkMode ? '#3BF6AE' : '#bfdbfe';
  const badgeTextColor = isDarkMode ? '#93c5fd' : themes.light.accent;
  const dragHandleBg = isDarkMode ? '#475569' : themes.light.border;

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
      backgroundColor: themes.light.accent,
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
      backgroundColor: themes.light.accent,
      borderRadius: 14,
      alignItems: 'center',
    },
    closeText: {
      color: palette.white,
      fontWeight: '700',
      fontSize: 15,
      letterSpacing: 0.5,
    },
  });
};