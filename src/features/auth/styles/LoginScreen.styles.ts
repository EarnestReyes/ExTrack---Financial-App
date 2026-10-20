import { palette, themes, design } from "../../../constants/design";
import { StyleSheet } from "react-native";
export const createStyles = (isDarkMode: boolean) => {
    const backgroundColor = isDarkMode ? themes.dark.background : themes.light.background;
    const cardColor = isDarkMode ? themes.dark.surface : palette.white;
    const textColor = isDarkMode ? themes.dark.text : themes.light.text;
    const secondaryTextColor = isDarkMode ? themes.dark.secondary : themes.light.secondary;
    const borderColor = isDarkMode ? themes.dark.border : themes.light.border;
    const inputBgColor = isDarkMode ? themes.dark.background : themes.light.background;
    return StyleSheet.create({
        keyboardContainer: { flex: 1, backgroundColor },
        scrollContent: { flexGrow: 1, justifyContent: 'center' },
        container: {
            flex: 1,
            backgroundColor,
            paddingHorizontal: 24,
            paddingTop: 40,
            paddingBottom: 48,
            justifyContent: 'center',
            width: "100%", maxWidth: 520, alignSelf: "center",
        },
        logoSection: { alignItems: 'center', marginBottom: 32 },
        logoCircle: {
            width: 72,
            height: 72,
            borderRadius: 22,
            backgroundColor: palette.navy,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 10,
        },
        logoText: { color: palette.white, fontSize: 34, fontWeight: 'bold' },
        title: { fontSize: 34, fontWeight: 'bold', color: textColor, letterSpacing: -1, },
        subtitle: { fontSize: 14, color: secondaryTextColor, marginTop: 8, textAlign: 'center', lineHeight: 22, },
        loginCard: {
            backgroundColor: cardColor,
            borderRadius: design.radius.card,
            padding: 24,
            borderWidth: 1,
            borderColor,
        },
        loginTitle: { fontSize: 26, fontWeight: 'bold', color: textColor, marginBottom: 5, textAlign: "left", letterSpacing: -0.6, },
        loginSubtitle: { fontSize: 14, color: secondaryTextColor, marginBottom: 20, textAlign: "left", lineHeight: 22, },
        inputLabel: { fontSize: 13, fontWeight: '600', color: textColor, marginBottom: 8, marginTop: 15 },
        input: {
            backgroundColor: inputBgColor,
            borderRadius: design.radius.control,
            borderWidth: 1,
            borderColor,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 16,
            color: textColor,
            minHeight: 54,
        },
        forgotButton: { alignSelf: 'flex-end', marginTop: 12, minHeight: 48, justifyContent: "center", },
        forgotText: { fontSize: 14, fontWeight: '600', color: isDarkMode ? themes.dark.accent : themes.light.accent },
        loginButton: {
            backgroundColor: themes.light.accent,
            padding: 16,
            borderRadius: design.radius.control,
            alignItems: 'center',
            marginTop: 20,
            minHeight: 54,
        },
        biometricButton: {
            backgroundColor: isDarkMode ? themes.dark.border : themes.light.border,
            padding: 16,
            borderRadius: 15,
            alignItems: 'center',
            marginTop: 12,
            borderWidth: 1,
            borderColor: isDarkMode ? '#475569' : themes.light.border,
        },
        biometricButtonText: { color: textColor, fontSize: 15, fontWeight: '600' },
        loginButtonDisabled: { opacity: 0.6 },
        loginButtonText: { color: palette.white, fontSize: 16, fontWeight: 'bold' },
        registerContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
        registerText: { fontSize: 14, color: secondaryTextColor, marginRight: 5 },
        registerLink: { fontSize: 14, fontWeight: 'bold', color: isDarkMode ? themes.dark.accent : themes.light.accent },
    });
};
