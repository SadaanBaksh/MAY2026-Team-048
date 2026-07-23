import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { VictoryPie } from 'victory-native';

import { Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';

export interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  data: DonutDatum[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
}

export function DonutChart({
  data,
  size = 180,
  strokeWidth = 20,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);

  // victory-pie's own getLabelText reads `datum.label` first, ahead of the `labels` prop —
  // since our DonutDatum.label already holds the category name, that would always win over
  // any custom labels function. Remap to x/y and put the display text in `label` instead.
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        x: d.label,
        y: d.value,
        label: String(d.value),
        color: d.color,
      })),
    [data],
  );

  return (
    <View style={styles.wrapper}>
      <View style={{ width: size, height: size }}>
        <VictoryPie
          width={size}
          height={size}
          data={chartData}
          innerRadius={size / 2 - strokeWidth}
          padAngle={3}
          cornerRadius={6}
          labelRadius={size / 2 - strokeWidth / 2}
          style={{
            data: {
              fill: (args) => (args.datum as { color?: string } | undefined)?.color ?? Colors.primary,
            },
            labels: {
              fill: '#FFFFFF',
              fontSize: 12,
              fontWeight: '600',
              padding: 0,
              textAnchor: 'middle',
              verticalAnchor: 'middle',
            },
          }}
          animate={{ duration: 1100, easing: 'bounce', onLoad: { duration: 1100 } }}
          padding={0}
        />
        {(centerLabel || centerValue) && (
          <View style={[StyleSheet.absoluteFill, styles.center]}>
            {centerValue && <Text style={styles.centerValue}>{centerValue}</Text>}
            {centerLabel && <Text style={styles.centerLabel}>{centerLabel}</Text>}
          </View>
        )}
      </View>
      <View style={styles.legend}>
        {data.map((d, i) => (
          <View key={i} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: d.color }]} />
            <Text style={styles.legendLabel} numberOfLines={1}>
              {d.label}
            </Text>
            <Text style={styles.legendValue}>{d.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      gap: Spacing.lg,
    },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    centerValue: {
      ...Type.title,
      color: Colors.ink,
    },
    centerLabel: {
      ...Type.tiny,
      color: Colors.inkSecondary,
    },
    legend: {
      gap: 8,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendLabel: {
      ...Type.caption,
      color: Colors.inkSecondary,
      width: 96,
    },
    legendValue: {
      ...Type.captionBold,
      color: Colors.ink,
    },
  });
