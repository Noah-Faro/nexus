export const theme = {
  colors: {
    // Pure Black for iPhone 11 Pro OLED screen battery saving & contrast
    background: '#000000',
    // Secondary panels and card sheets
    surface: '#121212',
    surfaceElevated: '#1a1a1a',
    // Minimalist panel dividers resembling Obsidian panes
    border: '#2e2e2e',
    borderMuted: '#1e1e1e',
    // Typography colors
    text: '#e0e0e0',          // Off-white for reduced eye strain
    textMuted: '#7a7a7a',     // Light grey for tags, metrics, and secondary details
    textSubtle: '#4e4e4e',    // Dark grey for background guidelines
    // Signature Obsidian colors
    accent: '#754ec3',        // Obsidian Purple
    accentAmber: '#e5b567',   // Minimalist warm yellow/amber
    accentRed: '#e95656',     // Alert/Reset color
    accentGreen: '#4ea64e',   // Success/Completed color
    // Transparent accents
    accentFade: 'rgba(117, 78, 195, 0.15)',
    accentAmberFade: 'rgba(229, 181, 103, 0.15)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    xs: 3,
    sm: 6,
    md: 10,
    lg: 16,
    round: 9999,
  },
  typography: {
    mono: 'Courier New', // Standard fallback iOS monospaced font
    sans: 'System',
    weight: {
      light: '300' as const,
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
    }
  }
};
