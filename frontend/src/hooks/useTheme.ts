import { useMemo } from 'react';

import {
  DarkColors,
  DarkPriorityColors,
  DarkRoleColors,
  DarkStatusColors,
  LightColors,
  LightPriorityColors,
  LightRoleColors,
  LightStatusColors,
} from '@/constants/theme';
import { useThemeStore } from '@/store/themeStore';

export type ThemeColors = typeof LightColors;
export type RoleColorMap = typeof LightRoleColors;
export type PriorityColorMap = typeof LightPriorityColors;
export type StatusColorMap = typeof LightStatusColors;

export function useTheme() {
  const mode = useThemeStore((s) => s.mode);
  const isDark = mode === 'dark';

  return useMemo(
    () => ({
      mode,
      isDark,
      Colors: isDark ? DarkColors : LightColors,
      RoleColors: isDark ? DarkRoleColors : LightRoleColors,
      PriorityColors: isDark ? DarkPriorityColors : LightPriorityColors,
      StatusColors: isDark ? DarkStatusColors : LightStatusColors,
    }),
    [isDark, mode]
  );
}
