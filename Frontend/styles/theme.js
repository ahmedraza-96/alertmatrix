// Modern Design System - Clean White Theme
export const colors = {
  // Primary Colors
  primary: '#2563EB',      // Modern blue
  primaryLight: '#3B82F6',
  primaryDark: '#1D4ED8',
  
  // Secondary Colors
  secondary: '#64748B',    // Slate gray
  secondaryLight: '#94A3B8',
  secondaryDark: '#475569',
  
  // Background Colors
  background: '#FFFFFF',
  backgroundSecondary: '#F8FAFC',
  backgroundTertiary: '#F1F5F9',
  backgroundDark: '#1E293B',
  backgroundGradient: '#F8FAFC',
  backgroundAccent: '#EFF6FF',
  
  // Surface Colors
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  
  // Text Colors
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#64748B',
  textLight: '#94A3B8',
  
  // Status Colors
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  
  // Status Light Variants
  successLight: '#D1FAE5',
  warningLight: '#FEF3C7',
  errorLight: '#FEE2E2',
  infoLight: '#DBEAFE',
  
  // Border Colors
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  borderDark: '#CBD5E1',
  
  // Special Colors
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.2)',
  white: '#FFFFFF',
  black: '#000000',
};

export const typography = {
  // Font Families
  fontRegular: 'System',
  fontMedium: 'System',
  fontBold: 'System',
  
  // Font Sizes
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
  
  // Line Heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  
  // Font Weights
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
  '4xl': 96,
};

export const borderRadius = {
  none: 0,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 12,
  },
};

// Component Styles
export const components = {
  button: {
    height: 48,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
  },
  
  input: {
    height: 48,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
  },
  
  card: {
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  
  container: {
    paddingHorizontal: spacing.lg,
  },
};

// Layout Constants
export const layout = {
  headerHeight: 60,
  tabBarHeight: 80,
  screenPadding: spacing.lg,
  cardSpacing: spacing.md,
};

// Animation Durations
export const animations = {
  fast: 150,
  normal: 300,
  slow: 500,
};

export default {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  components,
  layout,
  animations,
}; 