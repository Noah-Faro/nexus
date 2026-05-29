export const theme = {
  colors: {
    // Pure Black for iPhone 11 Pro OLED screen battery saving & contrast
    background: '#000000',
    // Secondary panels and card sheets
    surface: '#0a0a0a',
    surfaceElevated: '#151515',
    surfaceSecondary: '#3a3a3c',
    surfaceCard: '#1c1c1e',
    surfaceMuted: '#2c2c2e',
    // Minimalist panel dividers
    border: '#222222',
    borderMuted: '#111111',
    // Typography colors
    text: '#ffffff',          // Pure white for high contrast OLED
    textMuted: '#8e8e93',     // iOS system grey for secondary text
    textSubtle: '#3a3a3c',    // Dark grey for background guidelines
    // Accents
    accent: '#0a84ff',        // iOS Blue
    accentAmber: '#ff9f0a',   // iOS Orange
    accentRed: '#ff453a',     // iOS Red
    accentGreen: '#32d74b',   // iOS Green
    accentCyan: '#64d2ff',    // iOS Cyan
    // Transparent accents
    accentFade: 'rgba(10, 132, 255, 0.15)',
    accentAmberFade: 'rgba(255, 159, 10, 0.15)',
    accentCyanFade: 'rgba(100, 210, 255, 0.1)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 18,
    round: 9999,
  },
  typography: {
    mono: 'System',
    sans: 'Outfit_400Regular',
    semibold: 'Outfit_600SemiBold',
    bold: 'Outfit_700Bold',
    weight: {
      light: '300' as const,
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
    }
  }
};
