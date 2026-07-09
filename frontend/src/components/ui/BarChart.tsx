import { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { VictoryAxis, VictoryBar, VictoryChart, VictoryLabel } from 'victory-native';

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
  const [width, setWidth] = useState(320);
  const max = Math.max(...data.map((d) => d.value), 1);

  // Victory treats a `label` field on the datum as an implicit text override that
  // always wins over the `labels` prop, so the category name is remapped to `category`
  // here to let the `labels` prop below control the value text shown at the bar end.
  const chartData = data.map((d) => ({ category: d.label, value: d.value, color: d.color }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.wrapper} onLayout={onLayout}>
      <VictoryChart
        horizontal
        width={width}
        height={data.length * 46 + 24}
        padding={{ top: 4, bottom: 20, left: 96, right: 44 }}
        domainPadding={{ x: [16, 16] }}
        domain={{ y: [0, max * 1.2] }}
      >
        <VictoryAxis
          style={{
            axis: { stroke: 'transparent' },
            grid: { stroke: 'transparent' },
            tickLabels: { fill: Colors.inkSecondary, fontSize: 12, fontWeight: '500' },
          }}
        />
        <VictoryAxis
          dependentAxis
          tickFormat={() => ''}
          style={{
            axis: { stroke: 'transparent' },
            ticks: { stroke: 'transparent' },
            grid: { stroke: Colors.surfaceSunken, strokeDasharray: '3,6' },
          }}
        />
        <VictoryBar
          data={chartData.map((d) => ({ ...d, value: max }))}
          x="category"
          y="value"
          barWidth={20}
          cornerRadius={10}
          style={{ data: { fill: Colors.surfaceSunken } }}
        />
        <VictoryBar
          data={chartData}
          x="category"
          y={(datum: { value: number }) => Math.max(datum.value, max * 0.04)}
          barWidth={20}
          cornerRadius={10}
          style={{
            data: { fill: (args) => (args.datum as { color?: string } | undefined)?.color ?? Colors.primary },
            labels: { fill: Colors.ink, fontSize: 13, fontWeight: '700' },
          }}
          labels={chartData.map((d) => `${d.value}${valueSuffix}`)}
          labelComponent={<VictoryLabel dx={10} textAnchor="start" verticalAnchor="middle" />}
          animate={{ duration: 1100, easing: 'bounce', onLoad: { duration: 1100 } }}
        />
      </VictoryChart>
    </View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      width: '100%',
    },
  });
