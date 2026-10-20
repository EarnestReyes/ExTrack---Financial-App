import { palette, themes, design } from "../../../constants/design";
import { StyleSheet } from "react-native";
export const createStyles = (isDarkMode: boolean) => {
    const backgroundColor = isDarkMode ? themes.dark.background : themes.light.background;
    const cardColor = isDarkMode ? themes.dark.surface : palette.white;
    const textColor = isDarkMode ? themes.dark.text : themes.light.text;
    const secondaryTextColor = isDarkMode ? themes.dark.secondary : themes.light.secondary;
    const borderColor = isDarkMode ? themes.dark.border : themes.light.border;
    return StyleSheet.create({
        keyboardContainer: {
            flex: 1,
            backgroundColor: backgroundColor,
        },
        scrollContent: {
            flexGrow: 1,
        },
        container: {
            flex: 1,
            backgroundColor: backgroundColor,
            paddingHorizontal: 24,
            paddingTop: 40,
            paddingBottom: 48,
            justifyContent: 'center',
            width: "100%", maxWidth: 520, alignSelf: "center",
        },
        logoSection: {
            alignItems: 'center',
            marginBottom: 32,
        },
        logoCircle: {
            width: 72,
            height: 72,
            borderRadius: 22,
            backgroundColor: palette.navy,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 15,
        },
        logoText: {
            color: palette.white,
            fontSize: 40,
            fontWeight: 'bold',
        },
        title: {
            fontSize: 34,
            fontWeight: 'bold',
            color: textColor,
            letterSpacing: -1,
        },
        subtitle: {
            fontSize: 14,
            color: secondaryTextColor,
            marginTop: 8,
            textAlign: 'center',
            lineHeight: 22,
        },
        card: {
            backgroundColor: cardColor,
            borderRadius: design.radius.card,
            padding: 24,
            borderWidth: 1, borderColor: borderColor,
        },
        cardTitle: {
            fontSize: 24,
            fontWeight: 'bold',
            color: textColor,
            marginBottom: 5,
        },
        cardSubtitle: {
            fontSize: 14,
            color: secondaryTextColor,
            marginBottom: 20,
            lineHeight: 20,
        },
        inputLabel: {
            fontSize: 13,
            fontWeight: '600',
            color: textColor,
            marginBottom: 8,
            marginTop: 15,
        },
        input: {
            backgroundColor: cardColor,
            borderRadius: design.radius.control,
            borderWidth: 1,
            borderColor: borderColor,
            paddingHorizontal: 16,
            paddingVertical: 16,
            fontSize: 16,
            color: textColor,
            minHeight: 54,
        },
        primaryButton: {
            backgroundColor: themes.light.accent,
            padding: 18,
            borderRadius: design.radius.control,
            alignItems: 'center',
            marginTop: 25,
            minHeight: 54,
        },
        buttonDisabled: {
            opacity: 0.6,
        },
        primaryButtonText: {
            color: palette.white,
            fontSize: 16,
            fontWeight: 'bold',
        },
        resendButton: {
            alignItems: 'center',
            marginTop: 10,
            paddingVertical: 10,
            minHeight: 48, justifyContent: "center",
        },
        resendText: {
            fontSize: 14,
            fontWeight: '600',
            color: isDarkMode ? themes.dark.accent : themes.light.accent,
        },
        loginContainer: {
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 22,
        },
        loginText: {
            fontSize: 14,
            color: secondaryTextColor,
            marginRight: 5,
        },
        loginLink: {
            fontSize: 14,
            fontWeight: 'bold',
            color: isDarkMode ? themes.dark.accent : themes.light.accent,
        },
    });
};
