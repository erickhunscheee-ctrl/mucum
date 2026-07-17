import { useMemo } from 'react';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText as Text } from '../ui/AppText';
import { MucumCurrentData } from '../../services/mucumCurrent';
import { formatChartTime } from '../../utils/format';
import { bucketStationReadings } from '../../utils/chartData';
import { chartColors, colors } from '../../theme/mucumTheme';
import { chartFontFamily } from '../../theme/typography';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler);
ChartJS.defaults.font.family = chartFontFamily;
ChartJS.defaults.font.size = 14;
ChartJS.defaults.font.weight = 400;

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false,
  },
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        boxWidth: 12,
        boxHeight: 12,
        color: colors.textSecondary,
        font: {
          weight: 600,
        },
      },
    },
    tooltip: {
      backgroundColor: colors.institutionalBlue,
      titleColor: colors.surface,
      bodyColor: colors.surface,
      padding: 10,
    },
  },
  scales: {
    rain: {
      type: 'linear',
      position: 'left',
      beginAtZero: true,
      title: {
        display: true,
        text: 'Chuva (mm)',
        color: colors.mucumBlue,
      },
      grid: {
        color: chartColors.rainGrid,
      },
      ticks: {
        color: colors.textSecondary,
      },
    },
    level: {
      type: 'linear',
      position: 'right',
      title: {
        display: true,
        text: 'Nivel (m)',
        color: colors.valleyGreen,
      },
      grid: {
        drawOnChartArea: false,
      },
      ticks: {
        color: colors.textSecondary,
      },
    },
    flow: {
      type: 'linear',
      display: false,
      position: 'right',
    },
    x: {
      grid: {
        display: false,
      },
      ticks: {
        color: colors.textSecondary,
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: 9,
      },
    },
  },
};

export function HydroComparisonChart({ current }: { current: MucumCurrentData | null }) {
  const { height } = useWindowDimensions();
  const data = useMemo(() => buildHydroComparisonChartData(current), [current]);
  const chartHeight = Math.max(190, Math.min(270, Math.round(height * 0.32)));

  if (!data.labels.length) {
    return (
      <View style={[styles.empty, { height: chartHeight }]}>
        <Text style={styles.emptyText}>
          Sem serie suficiente para montar o grafico. Assim que a telemetria da ANA retornar chuva ou nivel, a comparacao aparece aqui.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.box, { height: chartHeight }]}>
      <Chart type="bar" data={data as any} options={chartOptions as any} />
    </View>
  );
}

function buildHydroComparisonChartData(current: MucumCurrentData | null) {
  const primaryCodes = new Set(
    ['86510000', current?.rainfall.stationCode, current?.river.levelStationCode, current?.river.flowStationCode]
      .filter(Boolean)
      .map(String),
  );
  const sourceRows = current?.stationReadings ?? [];
  const primaryRows = sourceRows.filter((reading) => primaryCodes.has(reading.stationCode));
  const rows = bucketStationReadings((primaryRows.length ? primaryRows : sourceRows)
    .filter((reading) => reading.measuredAt && (
      reading.rainfallMm !== null ||
      reading.riverLevelM !== null ||
      reading.flowM3s !== null
    )), 48);

  return {
    labels: rows.map((reading) => formatChartTime(reading.measuredAt)),
    datasets: [
      {
        type: 'bar',
        label: 'Chuva (mm)',
        data: rows.map((reading) => reading.rainfallMm ?? 0),
        yAxisID: 'rain',
        backgroundColor: chartColors.rainFill,
        borderColor: chartColors.rain,
        borderWidth: 1,
        borderRadius: 4,
        order: 2,
      },
      {
        type: 'line',
        label: 'Nivel do rio (m)',
        data: rows.map((reading) => reading.riverLevelM),
        yAxisID: 'level',
        borderColor: chartColors.level,
        backgroundColor: chartColors.levelFill,
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 4,
        tension: 0.28,
        spanGaps: true,
        order: 1,
      },
      {
        type: 'line',
        label: 'Vazao (m3/s)',
        data: rows.map((reading) => reading.flowM3s),
        yAxisID: 'flow',
        borderColor: chartColors.flow,
        backgroundColor: chartColors.flowFill,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.28,
        spanGaps: true,
        hidden: true,
        order: 0,
      },
    ],
  };
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: 1,
    padding: 12,
  },
  empty: {
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    maxWidth: 440,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
  },
});

