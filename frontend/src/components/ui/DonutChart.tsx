import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

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
  size = 150,
  strokeWidth = 18,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;

  const cumulativeStarts = data.reduce<number[]>((acc, d, i) => {
    const previousStart = i === 0 ? 0 : acc[i - 1] + data[i - 1].value / total;
    return [...acc, previousStart];
  }, []);

  return (
    <View style={styles.wrapper}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G rotation={-90} originX={size / 2} originY={size / 2}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={Colors.surfaceSunken}
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {data.map((d, i) => {
              const fraction = d.value / total;
              const dashLength = circumference * fraction;
              const offset = circumference * (1 - cumulativeStarts[i]);
              return (
                <Circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={d.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                  strokeDashoffset={offset}
                  strokeLinecap="butt"
                  fill="transparent"
                />
              );
            })}
          </G>
        </Svg>
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
      flex: 1,
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
      flex: 1,
    },
    legendValue: {
      ...Type.captionBold,
      color: Colors.ink,
    },
  });
