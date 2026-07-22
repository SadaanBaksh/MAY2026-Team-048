import { ArcElement, Chart as ChartJS, Tooltip } from 'chart.js';
import { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { StyleSheet, Text, View } from 'react-native';

import { Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';

ChartJS.register(ArcElement, Tooltip);

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

// Web renders charts with Chart.js (canvas) instead of victory-native (SVG) — victory-native's
// web output has proportion/label-positioning quirks that don't show up on native, so the
// desktop-only manager dashboard gets this platform-specific implementation via the .web.tsx
// extension, which Metro resolves automatically for web builds while native keeps DonutChart.tsx.
export function DonutChart({
  data,
  size = 180,
  strokeWidth = 20,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);

  const chartData = useMemo(
    () => ({
      labels: data.map((d) => d.label),
      datasets: [
        {
          data: data.map((d) => d.value),
          backgroundColor: data.map((d) => d.color),
          borderWidth: 0,
          borderRadius: 6,
          spacing: 3,
          hoverOffset: 4,
        },
      ],
    }),
    [data],
  );

  const cutout = `${Math.round(((size / 2 - strokeWidth) / (size / 2)) * 100)}%`;

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout,
      animation: { duration: 900 },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
      },
    }),
    [cutout],
  );

  return (
    <View style={styles.wrapper}>
      <View style={{ width: size, height: size }}>
        <Doughnut data={chartData} options={options} />
        {(centerLabel || centerValue) && (
          <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
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
