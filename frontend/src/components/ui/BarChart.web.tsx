import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, ChartDataLabels);

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

export interface BarChartProps {
  data: BarDatum[];
  valueSuffix?: string;
}

// Web renders charts with Chart.js (canvas) instead of victory-native (SVG) — see DonutChart.web.tsx.
export function BarChart({ data, valueSuffix = '' }: BarChartProps) {
  const { Colors } = useTheme();
  const max = Math.max(...data.map((d) => d.value), 1);

  const chartData = useMemo(
    () => ({
      labels: data.map((d) => d.label),
      datasets: [
        {
          data: data.map((d) => d.value),
          backgroundColor: data.map((d) => d.color ?? Colors.primary),
          borderRadius: 10,
          borderSkipped: false,
          barThickness: 20,
          maxBarThickness: 20,
        },
      ],
    }),
    [data, Colors.primary],
  );

  const options: ChartOptions<'bar'> = useMemo(
    () => ({
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 40 } },
      animation: { duration: 900 },
      scales: {
        x: {
          display: false,
          suggestedMax: max * 1.2,
          grid: { display: false },
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: Colors.inkSecondary, font: { size: 12, weight: 500 } },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
        datalabels: {
          anchor: 'end',
          align: 'end',
          color: Colors.ink,
          font: { weight: 700, size: 13 },
          formatter: (value: number) => `${value}${valueSuffix}`,
        },
      },
    }),
    [max, valueSuffix, Colors.ink, Colors.inkSecondary],
  );

  return (
    <View style={{ width: '100%', height: data.length * 46 + 24 }}>
      <Bar data={chartData} options={options} />
    </View>
  );
}
