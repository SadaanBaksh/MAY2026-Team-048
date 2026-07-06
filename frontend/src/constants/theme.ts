
import { Platform } from 'react-native';

export const Colors = {
  ink: '#12141C',
  inkSecondary: '#5B5F6D',
  inkTertiary: '#9296A3',
  inkInverse: '#FFFFFF',

  surface: '#FFFFFF',
  surfaceMuted: '#F6F7FB',
  surfaceSunken: '#EEF0F6',
  surfaceOverlay: 'rgba(18,20,28,0.55)',
  border: '#E6E8F0',
  borderStrong: '#D6D9E4',

  primary: '#3452D9',
  primaryDark: '#22349B',
  primarySoft: '#EAEEFD',
  primaryTint: '#DCE3FB',

  accent: '#EE9A3A',
  accentSoft: '#FCF0DE',

  success: '#1C9C6E',
  successSoft: '#E4F7EF',
  warning: '#DB8A1B',
  warningSoft: '#FBF0DA',
  danger: '#DD4B4B',
  dangerSoft: '#FCE9E9',
  critical: '#B62B4D',
  criticalSoft: '#F9E4EA',
  info: '#2E7BC2',
  infoSoft: '#E5F1FB',

  white: '#FFFFFF',
  black: '#000000',
} as const;

export const RoleColors = {
  resident: { text: '#3452D9', soft: '#EAEEFD' },
  facility_employee: { text: '#7A3FC2', soft: '#F1E9FA' },
  maintenance_staff: { text: '#C2740F', soft: '#FBF0DA' },
  facility_manager: { text: '#1C7A5A', soft: '#E1F5ED' },
} as const;

export const PriorityColors = {
  Low: { text: '#5B5F6D', soft: '#EEF0F6', dot: '#9296A3' },
  Medium: { text: '#2E7BC2', soft: '#E5F1FB', dot: '#2E7BC2' },
  High: { text: '#DB8A1B', soft: '#FBF0DA', dot: '#DB8A1B' },
  Critical: { text: '#B62B4D', soft: '#F9E4EA', dot: '#B62B4D' },
} as const;

export const StatusColors = {
  Pending: { text: '#8A6D14', soft: '#FBF0DA', dot: '#DB8A1B' },
  Assigned: { text: '#2E7BC2', soft: '#E5F1FB', dot: '#2E7BC2' },
  In_Progress: { text: '#7A3FC2', soft: '#F1E9FA', dot: '#7A3FC2' },
  Resolved: { text: '#1C9C6E', soft: '#E4F7EF', dot: '#1C9C6E' },
  Closed: { text: '#5B5F6D', soft: '#EEF0F6', dot: '#9296A3' },
} as const;

export const Spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const FontFamily = Platform.select({
  ios: { sans: 'System', mono: 'Menlo' },
  android: { sans: 'sans-serif', mono: 'monospace' },
  default: { sans: 'System', mono: 'monospace' },
})!;

export const Type = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  subtitle: { fontSize: 17, lineHeight: 23, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  bodyMedium: { fontSize: 15, lineHeight: 22, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  captionBold: { fontSize: 13, lineHeight: 18, fontWeight: '700' as const },
  tiny: { fontSize: 11, lineHeight: 14, fontWeight: '600' as const },
} as const;

export const Shadow = Platform.select({
  ios: {
    shadowColor: '#0F1729',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  android: { elevation: 3 },
  default: {},
})!;

export const ShadowSmall = Platform.select({
  ios: {
    shadowColor: '#0F1729',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  android: { elevation: 1 },
  default: {},
})!;

export const BottomTabInset = Platform.select({ ios: 34, android: 24, default: 0 });
export const MaxContentWidth = 720;
