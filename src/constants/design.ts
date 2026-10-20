/** Shared visual tokens. Financial meanings remain in the domain layer. */
export const palette = {
  navy: '#0B1426', blue: '#5278E8', positive: '#159B73', negative: '#E56870',
  white: '#FFFFFF', muted: '#8190A5',
} as const;

export const design = {
  radius: { control: 14, card: 24, sheet: 28 },
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  touch: 48,
  contentWidth: 720,
} as const;

export function getDesignTheme(dark: boolean) {
  return {
    background: dark ? palette.navy : '#F7F9FC',
    surface: dark ? '#142137' : palette.white,
    raised: dark ? '#1C2C45' : '#EEF2FA',
    text: dark ? '#F3F6FC' : '#142139',
    secondary: dark ? '#A5B3C8' : '#52647C',
    muted: palette.muted,
    border: dark ? '#263650' : '#E4EAF3',
    accent: dark ? '#91ACFF' : '#365CCA',
    primary: palette.blue,
    positive: dark ? '#5BD1AE' : '#117C5D',
    negative: dark ? '#F3979D' : '#B63E4B',
  };
}

export const themes = { light: getDesignTheme(false), dark: getDesignTheme(true) };
