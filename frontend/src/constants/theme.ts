import { Platform } from 'react-native';

export interface ColorPalette {
  ink: string;
  inkSecondary: string;
  inkTertiary: string;
  inkInverse: string;

  surface: string;
  surfaceMuted: string;
  surfaceSunken: string;
  surfaceOverlay: string;
  border: string;
  borderStrong: string;

  primary: string;
  primaryDark: string;
  primarySoft: string;
  primaryTint: string;

  teal: string;

  accent: string;
  accentSoft: string;

  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  critical: string;
  criticalSoft: string;
  info: string;
  infoSoft: string;

  white: string;
  black: string;
}

interface RoleColorEntry {
  text: string;
  soft: string;
}
export type RoleColorPalette = Record<
  'resident' | 'facility_employee' | 'maintenance_staff' | 'facility_manager',
  RoleColorEntry
>;

interface PriorityColorEntry {
  text: string;
  soft: string;
  dot: string;
}
export type PriorityColorPalette = Record<
  'Low' | 'Medium' | 'High' | 'Critical',
  PriorityColorEntry
>;
export type StatusColorPalette = Record<
  'Pending' | 'Assigned' | 'In_Progress' | 'Resolved' | 'Closed',
  PriorityColorEntry
>;

export const LightColors: ColorPalette = {
  ink: '#12141C',
  inkSecondary: '#5B5F6D',
  inkTertiary: '#9296A3',
  inkInverse: '#FFFFFF',

  // #f8f8f6 is the brand off-white — it's the app's main/background color (matches
  // the landing page's section background), so elevated surfaces (cards, headers,
  // tab bars) sit one step lighter (white) to pop the way they do on the landing page.
  surface: '#FFFFFF',
  surfaceMuted: '#f8f8f6',
  surfaceSunken: '#f0f0ee',
  surfaceOverlay: 'rgba(12,45,53,0.55)',
  border: '#E4E6EA',
  borderStrong: '#D1D3D8',

  primary: '#0c2d35',
  primaryDark: '#071b20',
  primarySoft: '#eef2f3',
  primaryTint: '#d8e1e3',

  teal: '#0c8577',

  accent: '#ffdf00',
  accentSoft: '#fffce6',

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
};

export const DarkColors: ColorPalette = {
  ink: '#F1F2F6',
  inkSecondary: '#A9ADBB',
  inkTertiary: '#7B8890',
  inkInverse: '#FFFFFF',

  // Neutral blackish-gray surfaces (no brand teal cast).
  surface: '#18181b',
  surfaceMuted: '#09090b',
  surfaceSunken: '#030303',
  surfaceOverlay: 'rgba(0,0,0,0.7)',
  border: '#27272a',
  borderStrong: '#3f3f46',

  primary: '#0c8577',
  primaryDark: '#52525b',
  primarySoft: '#1f1f22',
  primaryTint: '#2a2a2e',

  teal: '#0c8577',

  accent: '#ffdf00',
  accentSoft: '#332c00',

  success: '#3FBE8E',
  successSoft: '#173A2C',
  warning: '#E8A63F',
  warningSoft: '#3D2F14',
  danger: '#E6716F',
  dangerSoft: '#3D1D1C',
  critical: '#D65D82',
  criticalSoft: '#3A1B25',
  info: '#5B9EE0',
  infoSoft: '#182B3D',

  white: '#FFFFFF',
  black: '#000000',
};

export const LightRoleColors: RoleColorPalette = {
  resident: { text: '#0c2d35', soft: '#eef2f3' },
  facility_employee: { text: '#7A3FC2', soft: '#F1E9FA' },
  maintenance_staff: { text: '#C2740F', soft: '#FBF0DA' },
  facility_manager: { text: '#1C7A5A', soft: '#E1F5ED' },
};

export const DarkRoleColors: RoleColorPalette = {
  resident: { text: '#1d6375', soft: '#041215' },
  facility_employee: { text: '#B08AE0', soft: '#2C2340' },
  maintenance_staff: { text: '#E0A968', soft: '#3A2C14' },
  facility_manager: { text: '#5FC79A', soft: '#173328' },
};

export const LightPriorityColors: PriorityColorPalette = {
  Low: { text: '#5B5F6D', soft: '#EEF0F6', dot: '#9296A3' },
  Medium: { text: '#2E7BC2', soft: '#E5F1FB', dot: '#2E7BC2' },
  High: { text: '#DB8A1B', soft: '#FBF0DA', dot: '#DB8A1B' },
  Critical: { text: '#B62B4D', soft: '#F9E4EA', dot: '#B62B4D' },
};

export const DarkPriorityColors: PriorityColorPalette = {
  Low: { text: '#A9ADBB', soft: '#22242D', dot: '#7B7F8F' },
  Medium: { text: '#5B9EE0', soft: '#182B3D', dot: '#5B9EE0' },
  High: { text: '#E8A63F', soft: '#3D2F14', dot: '#E8A63F' },
  Critical: { text: '#D65D82', soft: '#3A1B25', dot: '#D65D82' },
};

export const LightStatusColors: StatusColorPalette = {
  Pending: { text: '#8A6D14', soft: '#FBF0DA', dot: '#DB8A1B' },
  Assigned: { text: '#2E7BC2', soft: '#E5F1FB', dot: '#2E7BC2' },
  In_Progress: { text: '#7A3FC2', soft: '#F1E9FA', dot: '#7A3FC2' },
  Resolved: { text: '#1C9C6E', soft: '#E4F7EF', dot: '#1C9C6E' },
  Closed: { text: '#5B5F6D', soft: '#EEF0F6', dot: '#9296A3' },
};

export const DarkStatusColors: StatusColorPalette = {
  Pending: { text: '#E0BE6E', soft: '#3D2F14', dot: '#E8A63F' },
  Assigned: { text: '#5B9EE0', soft: '#182B3D', dot: '#5B9EE0' },
  In_Progress: { text: '#B08AE0', soft: '#2C2340', dot: '#B08AE0' },
  Resolved: { text: '#3FBE8E', soft: '#173A2C', dot: '#3FBE8E' },
  Closed: { text: '#A9ADBB', soft: '#22242D', dot: '#7B7F8F' },
};

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
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

// Matches the landing page's Archivo webfont (loaded via useFonts in app/_layout.tsx).
// Static per-weight font files don't respond to the `fontWeight` style prop, so every
// text style picks its weight by selecting the matching family here instead.
export const FontFamily = {
  regular: 'Archivo_400Regular',
  medium: 'Archivo_500Medium',
  semiBold: 'Archivo_600SemiBold',
  bold: 'Archivo_700Bold',
  extraBold: 'Archivo_800ExtraBold',
} as const;

export const Type = {
  display: { fontSize: 28, lineHeight: 34, fontFamily: FontFamily.extraBold },
  title: { fontSize: 22, lineHeight: 28, fontFamily: FontFamily.bold },
  subtitle: { fontSize: 17, lineHeight: 23, fontFamily: FontFamily.semiBold },
  body: { fontSize: 15, lineHeight: 22, fontFamily: FontFamily.regular },
  bodyMedium: { fontSize: 15, lineHeight: 22, fontFamily: FontFamily.semiBold },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: FontFamily.medium },
  captionBold: { fontSize: 13, lineHeight: 18, fontFamily: FontFamily.bold },
  tiny: { fontSize: 11, lineHeight: 14, fontFamily: FontFamily.semiBold },
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
