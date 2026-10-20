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
            backgroundColor,
        },
        scrollContent: {
            flexGrow: 1,
        },
        container: {
            flex: 1,
            backgroundColor,
            paddingHorizontal: 24,
            paddingTop: 40,
            paddingBottom: 48,
            justifyContent: "center",
            width: "100%", maxWidth: 520, alignSelf: "center",
        },
        logoSection: {
            alignItems: "center",
            marginBottom: 32,
        },
        logoCircle: {
            width: 72,
            height: 72,
            borderRadius: 22,
            backgroundColor: palette.navy,
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 15,
        },
        logoText: {
            color: palette.white,
            fontSize: 40,
            fontWeight: "bold",
        },
        title: {
            fontSize: 34,
            fontWeight: "bold",
            color: textColor,
            letterSpacing: -1,
        },
        subtitle: {
            fontSize: 14,
            color: secondaryTextColor,
            marginTop: 8,
            textAlign: "center",
            lineHeight: 22,
        },
        registerCard: {
            backgroundColor: cardColor,
            borderRadius: design.radius.card,
            padding: 24,
            borderWidth: 1, borderColor: borderColor,
        },
        registerTitle: {
            fontSize: 24,
            fontWeight: "bold",
            color: textColor,
            marginBottom: 5,
        },
        registerSubtitle: {
            fontSize: 14,
            color: secondaryTextColor,
            marginBottom: 20,
        },
        inputLabel: {
            fontSize: 13,
            fontWeight: "600",
            color: textColor,
            marginBottom: 8,
            marginTop: 15,
        },
        labelWithBadge: {
            flexDirection: "row",
            alignItems: "center",
        },
        loaderInline: {
            marginLeft: 8,
            marginTop: 8,
        },
        input: {
            backgroundColor: cardColor,
            borderRadius: design.radius.control,
            borderWidth: 1,
            borderColor,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 16,
            color: textColor,
            minHeight: 54,
        },
        textArea: {
            minHeight: 70,
            textAlignVertical: "top",
        },
        datePickerDoneButton: {
            alignSelf: "flex-end",
            paddingVertical: 8,
            paddingHorizontal: 16,
        },
        datePickerDoneText: {
            color: isDarkMode ? themes.dark.accent : themes.light.accent,
            fontWeight: "bold",
            fontSize: 16,
        },
        registerButton: {
            backgroundColor: themes.light.accent,
            padding: 18,
            borderRadius: design.radius.control,
            alignItems: "center",
            marginTop: 25,
            minHeight: 54,
        },
        registerButtonDisabled: {
            opacity: 0.6,
        },
        registerButtonText: {
            color: palette.white,
            fontSize: 16,
            fontWeight: "bold",
        },
        loginContainer: {
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            marginTop: 22,
        },
        loginText: {
            fontSize: 14,
            color: secondaryTextColor,
            marginRight: 5,
        },
        loginLink: {
            fontSize: 14,
            fontWeight: "bold",
            color: isDarkMode ? themes.dark.accent : themes.light.accent,
        },
    });
};
