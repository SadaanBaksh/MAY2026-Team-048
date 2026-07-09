import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

export interface BarChartProps {
  data: BarDatum[];
  valueSuffix?: string;
}

export function BarChart({ data, valueSuffix = '' }: BarChartProps) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={styles.wrapper}>
      {data.map((d, i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.label} numberOfLines={1}>
            {d.label}
          </Text>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.max((d.value / max) * 100, 4)}%`,
                  backgroundColor: d.color ?? Colors.primary,
                },
              ]}
            />
          </View>
          <Text style={styles.value}>
            {d.value}
            {valueSuffix}
          </Text>
        </View>
      ))}
    </View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      gap: Spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    label: {
      ...Type.caption,
      color: Colors.inkSecondary,
      width: 92,
    },
    track: {
      flex: 1,
      height: 10,
      borderRadius: Radius.pill,
      backgroundColor: Colors.surfaceSunken,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: Radius.pill,
    },
    value: {
      ...Type.captionBold,
      color: Colors.ink,
      width: 28,
      textAlign: 'right',
    },
  });
