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

  return (
    <View style={styles.wrapper}>
      <View style={{ width: size, height: size }}>
        <VictoryPie
          width={size}
          height={size}
          data={data}
          x="label"
          y="value"
          innerRadius={size / 2 - strokeWidth}
          padAngle={3}
          cornerRadius={6}
          labels={({ datum }) => String((datum as DonutDatum).value)}
          style={{
            data: {
              fill: (args) => (args.datum as DonutDatum | undefined)?.color ?? Colors.primary,
            },
            labels: { fill: '#FFFFFF', fontSize: 12, fontWeight: '600' },
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
