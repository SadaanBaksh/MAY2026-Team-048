import { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';

export type AISummaryVariant = 'manager' | 'employee' | 'resident';

export interface AISummaryCardProps {
  summary: string;
  variant?: AISummaryVariant;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

const VARIANT_CONFIG: Record<
  AISummaryVariant,
  { bg: (c: ThemeColors) => string; border: (c: ThemeColors) => string; badge: (c: ThemeColors) => string; badgeText: (c: ThemeColors) => string }
> = {
  manager: {
    bg: (c) => c.primarySoft,
    border: (c) => c.primaryTint,
    badge: (c) => c.primary,
    badgeText: (c) => c.white,
  },
  employee: {
    bg: (c) => c.infoSoft,
    border: (c) => `${c.info}33`,
    badge: (c) => c.info,
    badgeText: (c) => c.white,
  },
  resident: {
    bg: (c) => `${c.teal}12`,
    border: (c) => `${c.teal}30`,
    badge: (c) => c.teal,
    badgeText: (c) => c.white,
  },
};

export function AISummaryCard({
  summary,
  variant = 'manager',
  label = 'AI Summary',
  style,
}: AISummaryCardProps) {
  const { Colors } = useTheme();
  const cfg = VARIANT_CONFIG[variant];
  const styles = useMemo(() => getStyles(Colors, cfg), [Colors, cfg]);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{label}</Text>
        </View>
      </View>
      <Text style={styles.summary}>{summary}</Text>
    </View>
  );
}

const getStyles = (
  Colors: ThemeColors,
  cfg: (typeof VARIANT_CONFIG)[AISummaryVariant],
) =>
  StyleSheet.create({
    container: {
      backgroundColor: cfg.bg(Colors),
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: cfg.border(Colors),
      padding: Spacing.md,
      gap: Spacing.xs,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    badge: {
      backgroundColor: cfg.badge(Colors),
      borderRadius: Radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    badgeText: {
      ...Type.tiny,
      color: cfg.badgeText(Colors),
    },
    summary: {
      ...Type.body,
      color: Colors.ink,
      lineHeight: 22,
      marginTop: 2,
    },
  });
