import Ionicons from "@react-native-vector-icons/ionicons";
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
  { bg: (c: ThemeColors) => string; border: (c: ThemeColors) => string; icon: (c: ThemeColors) => string; badge: (c: ThemeColors) => string; badgeText: (c: ThemeColors) => string }
> = {
  manager: {
    bg: (c) => c.primarySoft,
    border: (c) => c.primaryTint,
    icon: (c) => c.primary,
    badge: (c) => c.primary,
    badgeText: (c) => c.white,
  },
  employee: {
    bg: (c) => c.infoSoft,
    border: (c) => `${c.info}33`,
    icon: (c) => c.info,
    badge: (c) => c.info,
    badgeText: (c) => c.white,
  },
  resident: {
    bg: (c) => `${c.teal}12`,
    border: (c) => `${c.teal}30`,
    icon: (c) => c.teal,
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
  const styles = useMemo(() => getStyles(Colors, cfg, variant), [Colors, cfg, variant]);

  return (
    <View style={[styles.container, style]}>
      {/* Top row: icon + badge */}
      <View style={styles.topRow}>
        <View style={styles.iconWrap}>
          <Ionicons name="sparkles" size={16} color={cfg.icon(Colors)} />
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{label}</Text>
        </View>
        <View style={styles.poweredByWrap}>
          <Text style={styles.poweredBy}>Powered by AI</Text>
        </View>
      </View>

      {/* Summary text */}
      <Text style={styles.summary}>{summary}</Text>

      {/* Footer disclaimer */}
      <View style={styles.footer}>
        <Ionicons name="information-circle-outline" size={12} color={cfg.icon(Colors)} />
        <Text style={styles.footerText}>Auto-generated · Refreshes with new data</Text>
      </View>
    </View>
  );
}

const getStyles = (
  Colors: ThemeColors,
  cfg: (typeof VARIANT_CONFIG)[AISummaryVariant],
  _variant: AISummaryVariant,
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
      gap: Spacing.xs,
    },
    iconWrap: {
      width: 28,
      height: 28,
      borderRadius: Radius.sm,
      backgroundColor: `${cfg.icon(Colors)}18`,
      alignItems: 'center',
      justifyContent: 'center',
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
    poweredByWrap: {
      marginLeft: 'auto',
    },
    poweredBy: {
      ...Type.tiny,
      color: Colors.inkTertiary,
      fontStyle: 'italic',
    },
    summary: {
      ...Type.body,
      color: Colors.ink,
      lineHeight: 22,
      marginTop: 2,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },
    footerText: {
      ...Type.tiny,
      color: Colors.inkTertiary,
    },
  });
