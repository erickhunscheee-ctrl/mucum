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
import { Bar, Chart, Line } from 'react-chartjs-2';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText as Text } from '../ui/AppText';
import { MucumCurrentData } from '../../services/mucumCurrent';
import { MucumForecastData } from '../../services/mucumForecast';
import { HistoricalFloodEvent, MucumHistoricalFloodsData } from '../../services/mucumHistoricalFloods';
import { MucumProjectionData } from '../../services/mucumProjection';
import { formatChartTime } from '../../utils/format';
import { chartColors, colors, riverChartColors } from '../../theme/mucumTheme';
import { chartFontFamily } from '../../theme/typography';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler);
ChartJS.defaults.font.family = chartFontFamily;
ChartJS.defaults.font.size = 14;
ChartJS.defaults.font.weight = 400;

type CurrentChartProps = { current: MucumCurrentData | null };

const commonPlugins = {
  legend: {
    position: 'bottom' as const,
    labels: { boxWidth: 11, boxHeight: 11, color: colors.textSecondary, font: { weight: 600 as const } },
  },
  tooltip: {
    backgroundColor: colors.institutionalBlue,
    titleColor: colors.surface,
    bodyColor: colors.surface,
    padding: 10,
  },
};

export function RegionalRainfallChart({ current }: CurrentChartProps) {
  const data = useMemo(() => {
    const cities = (current?.regionalRainfall.cities?.length
      ? current.regionalRainfall.cities
      : (current?.regionalRainfall.stations ?? []).map((station) => ({
          city: station.city || station.stationName,
          rainfallMm: station.rainfallMm,
        })))
      .filter((city) => city.rainfallMm !== null)
      .slice()
      .sort((left, right) => (right.rainfallMm ?? 0) - (left.rainfallMm ?? 0));

    return {
      labels: cities.map((city) => city.city),
      datasets: [{
        label: 'Chuva acumulada (mm)',
        data: cities.map((city) => city.rainfallMm ?? 0),
        backgroundColor: cities.map((city) => (city.rainfallMm ?? 0) >= 30 ? colors.warning : chartColors.rain),
        borderRadius: 4,
      }],
    };
  }, [current]);

  if (!data.labels.length) return <EmptyChart message="Sem leituras regionais de chuva para comparar." />;

  return (
    <ChartBox contentHeight={Math.max(220, data.labels.length * 34)}>
      <Bar
        data={data}
        options={{
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: commonPlugins,
          scales: {
            x: { beginAtZero: true, title: { display: true, text: 'Chuva acumulada (mm)', color: chartColors.rain }, grid: { color: chartColors.rainGrid } },
            y: { grid: { display: false }, ticks: { color: colors.textSecondary, autoSkip: false } },
          },
        }}
      />
    </ChartBox>
  );
}

export function RegionalRainfallPeaksChart({ current }: CurrentChartProps) {
  const chart = useMemo(() => {
    const peaksByDate = new Map<string, { city: string; rainfallMm: number }>();

    (current?.regionalRainfall.cities ?? []).forEach((city) => {
      city.daily.forEach((day) => {
        const currentPeak = peaksByDate.get(day.date);
        if (!currentPeak || day.rainfallMm > currentPeak.rainfallMm) {
          peaksByDate.set(day.date, { city: city.city, rainfallMm: day.rainfallMm });
        }
      });
    });

    const points = Array.from(peaksByDate.entries())
      .map(([date, peak]) => ({ date, ...peak }))
      .sort((left, right) => left.date.localeCompare(right.date));

    return {
      points,
      data: {
        labels: points.map((point) => formatDayLabel(point.date)),
        datasets: [{
          label: 'Maior chuva do dia (mm)',
          data: points.map((point) => point.rainfallMm),
          backgroundColor: points.map((point) => point.rainfallMm >= 30 ? colors.warning : chartColors.level),
          borderRadius: 4,
        }],
      },
    };
  }, [current]);

  if (!chart.data.labels.length) return <EmptyChart message="Sem serie diaria suficiente para calcular os picos regionais." />;

  return (
    <ChartBox>
      <Bar
        data={chart.data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            ...commonPlugins,
            legend: { display: false },
            tooltip: {
              ...commonPlugins.tooltip,
              callbacks: {
                afterLabel: (context) => `Cidade: ${chart.points[context.dataIndex]?.city ?? '-'}`,
              },
            },
          },
          scales: {
            y: { beginAtZero: true, title: { display: true, text: 'Pico diario (mm)', color: chartColors.level }, grid: { color: chartColors.rainGrid } },
            x: { grid: { display: false }, ticks: { color: colors.textSecondary, maxRotation: 0, maxTicksLimit: 12 } },
          },
        }}
      />
    </ChartBox>
  );
}

export function CityRainfallDetailChart({
  current,
  forecast,
  cities,
  observedLabel,
}: CurrentChartProps & { forecast: MucumForecastData | null; cities: string[]; observedLabel: string }) {
  const data = useMemo(() => {
    const rows = cities.map((city) => {
      const observed = (current?.regionalRainfall.cities ?? [])
        .find((item) => cityNamesMatch(item.city, city));
      const predicted = (forecast?.points ?? [])
        .find((point) => cityNamesMatch(point.name, city));
      return {
        city,
        observedMm: observed?.rainfallMm ?? null,
        forecast72hMm: predicted?.next72hMm ?? null,
      };
    });

    return {
      labels: rows.map((row) => row.city),
      datasets: [
        {
          label: `Observado - ${observedLabel}`,
          data: rows.map((row) => row.observedMm),
          backgroundColor: chartColors.rain,
          borderRadius: 4,
        },
        {
          label: 'Previsto - proximas 72h',
          data: rows.map((row) => row.forecast72hMm),
          backgroundColor: colors.bridgeGold,
          borderRadius: 4,
        },
      ],
    };
  }, [cities, current, forecast, observedLabel]);

  if (!data.labels.length) return <EmptyChart message="Selecione cidades para comparar a chuva observada e prevista." />;

  return (
    <ChartBox contentHeight={Math.max(220, data.labels.length * 46)}>
      <Bar
        data={data}
        options={{
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: commonPlugins,
          scales: {
            x: { beginAtZero: true, title: { display: true, text: 'Chuva acumulada (mm)', color: chartColors.rain }, grid: { color: chartColors.rainGrid } },
            y: { grid: { display: false }, ticks: { color: colors.textSecondary, autoSkip: false } },
          },
        }}
      />
    </ChartBox>
  );
}

export function ForecastRainChart({ forecast }: { forecast: MucumForecastData | null }) {
  const data = useMemo(() => {
    const points = (forecast?.points ?? []).filter((point) => point.role !== 'jusante_contexto');
    const hours = points[0]?.hours.slice(0, 24) ?? [];

    return {
      labels: hours.map((hour) => formatChartTime(hour.time)),
      datasets: [{
        label: 'Maior chuva prevista na bacia (mm/h)',
        data: hours.map((_, index) => Math.max(0, ...points.map((point) => point.hours[index]?.precipitationMm ?? 0))),
        backgroundColor: chartColors.rain,
        borderColor: chartColors.rain,
        borderWidth: 1,
        borderRadius: 4,
      }],
    };
  }, [forecast]);

  if (!data.labels.length) return <EmptyChart message="A previsao horaria ainda nao foi carregada." />;

  return (
    <ChartBox>
      <Bar
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: commonPlugins,
          scales: {
            y: { beginAtZero: true, title: { display: true, text: 'mm/h', color: chartColors.rain }, grid: { color: chartColors.rainGrid } },
            x: { grid: { display: false }, ticks: { color: colors.textSecondary, maxRotation: 0, maxTicksLimit: 9 } },
          },
        }}
      />
    </ChartBox>
  );
}

export function RiverTrendChart({ current }: CurrentChartProps) {
  const data = useMemo(() => {
    const available = (current?.stationReadings ?? []).filter((reading) => (
      reading.riverLevelM !== null
      && reading.measuredAt
      && reading.river
      && !isDownstreamOfMucum(reading.city ?? '', reading.river)
    ));
    const windowHours = current?.regionalRainfall.windowHours ?? 24;
    const bucketMs = windowHours > 168 ? 24 * 60 * 60 * 1000 : windowHours > 24 ? 6 * 60 * 60 * 1000 : 60 * 60 * 1000;
    const byRiver = new Map<string, typeof available>();

    available.forEach((reading) => {
      const key = normalizeChartName(reading.river ?? reading.stationName);
      const rows = byRiver.get(key) ?? [];
      rows.push(reading);
      byRiver.set(key, rows);
    });

    const riverBuckets = Array.from(byRiver.entries()).map(([river, rows], index) => {
      const values = new Map<number, number>();
      rows
        .slice()
        .sort((left, right) => Date.parse(left.measuredAt) - Date.parse(right.measuredAt))
        .forEach((reading) => {
          const time = Date.parse(reading.measuredAt);
          if (!Number.isFinite(time) || reading.riverLevelM === null) return;
          values.set(Math.floor(time / bucketMs) * bucketMs, reading.riverLevelM);
        });
      return { river, values, color: colorForRiver(river, index) };
    });
    const timestamps = Array.from(new Set(riverBuckets.flatMap((series) => Array.from(series.values.keys()))))
      .sort((left, right) => left - right);

    return {
      labels: timestamps.map((timestamp) => formatChartTime(new Date(timestamp).toISOString())),
      datasets: riverBuckets.map((series) => ({
          label: formatRiverLabel(series.river),
          data: timestamps.map((timestamp) => series.values.get(timestamp) ?? null),
          borderColor: series.color,
          backgroundColor: series.color,
          fill: false,
          tension: 0.28,
          pointRadius: 2,
          spanGaps: true,
        })),
    };
  }, [current]);

  if (!data.labels.length || !data.datasets.length) return <EmptyChart message="Sem series de nivel suficientes para comparar os rios a montante." />;

  return (
    <ChartBox>
      <Line
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: commonPlugins,
          scales: {
            y: { beginAtZero: false, title: { display: true, text: 'Nivel do rio (m)', color: chartColors.level }, grid: { color: chartColors.levelFill } },
            x: { grid: { display: false }, ticks: { color: colors.textSecondary, maxRotation: 0, maxTicksLimit: 9 } },
          },
        }}
      />
    </ChartBox>
  );
}

function isDownstreamOfMucum(city: string, river: string) {
  const normalizedCity = normalizeChartName(city);
  const normalizedRiver = normalizeChartName(river);
  return Boolean(normalizedCity.match(/ENCANTADO|ROCA SALES|COLINAS|ARROIO DO MEIO|LAJEADO|ESTRELA|BOM RETIRO|TAQUARI/)
    || normalizedRiver.match(/FORQUETA|TAQUARI-MIRIM/));
}

function normalizeChartName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}

function colorForRiver(river: string, index: number) {
  if (river.includes('TAQUARI')) return colors.mucumBlue;
  if (river.includes('ANTAS')) return colors.valleyGreen;
  if (river.includes('CARREIRO')) return colors.warning;
  if (river.includes('GUAPORE')) return colors.info;
  if (river.includes('PRATA')) return colors.bridgeGold;
  if (river.includes('TAINHAS')) return colors.danger;
  return riverChartColors[index % riverChartColors.length];
}

function formatRiverLabel(value: string) {
  return value.toLowerCase().replace(/(^|\s)\p{L}/gu, (letter) => letter.toUpperCase());
}

export function ProjectionLevelChart({ projection }: { projection: MucumProjectionData | null }) {
  const data = useMemo(() => {
    const rows = (projection?.timeline ?? []).filter((row) => row.hour % 2 === 0 || row.hour <= 6);
    const thresholds = projection?.model.thresholdsM;
    return {
      labels: rows.map((row) => row.hour === 0 ? 'Agora' : `+${row.hour}h`),
      datasets: [
        {
          label: 'Cenario maximo',
          data: rows.map((row) => row.maximumLevelM),
          borderColor: colors.danger,
          backgroundColor: colors.dangerSoft,
          borderDash: [5, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.25,
        },
        {
          label: 'Cenario provavel',
          data: rows.map((row) => row.likelyLevelM),
          borderColor: colors.mucumBlue,
          backgroundColor: chartColors.rainFill,
          borderWidth: 3,
          pointRadius: 0,
          tension: 0.25,
        },
        {
          label: 'Cenario minimo',
          data: rows.map((row) => row.minimumLevelM),
          borderColor: colors.valleyGreen,
          backgroundColor: colors.greenSoft,
          borderDash: [3, 3],
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.25,
        },
        ...(thresholds ? [
          thresholdDataset('Atencao 5 m', thresholds.attention, colors.warning, rows.length),
          thresholdDataset('Alerta 9 m', thresholds.alert, colors.bridgeGold, rows.length),
          thresholdDataset('Inundacao 18 m', thresholds.inundation, colors.danger, rows.length),
        ] : []),
      ],
    };
  }, [projection]);

  if (!data.labels.length) return <EmptyChart message="A projecao ainda nao foi calculada." />;

  return (
    <ChartBox>
      <Line
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: commonPlugins,
          scales: {
            y: { beginAtZero: true, title: { display: true, text: 'Nivel em Mucum (m)', color: chartColors.level }, grid: { color: chartColors.levelFill } },
            x: { grid: { display: false }, ticks: { color: colors.textSecondary, maxTicksLimit: 12, maxRotation: 0 } },
          },
        }}
      />
    </ChartBox>
  );
}

export function HistoricalFloodRiseChart({ historical }: { historical: MucumHistoricalFloodsData | null }) {
  const data = useMemo(() => {
    const hours = Array.from({ length: 37 }, (_, index) => -96 + index * 3);
    return {
      labels: hours.map((hour) => hour === 0 ? 'Pico' : `${hour}h`),
      datasets: (historical?.events ?? []).map((event, index) => {
        const valuesByHour = new Map(event.points.map((point) => [point.hourFromPeak, point.levelM]));
        return {
          label: event.label,
          data: hours.map((hour) => valuesByHour.get(hour) ?? null),
          borderColor: riverChartColors[index % riverChartColors.length],
          borderWidth: index === 2 ? 3 : 2,
          pointRadius: 0,
          tension: 0.2,
          spanGaps: false,
        };
      }),
    };
  }, [historical]);

  if (!data.datasets.length) return <EmptyChart message="As series historicas ainda nao foram carregadas." />;

  return (
    <ChartBox>
      <Line
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: commonPlugins,
          scales: {
            y: { beginAtZero: true, title: { display: true, text: 'Cota telemetrica ANA (m)', color: chartColors.level }, grid: { color: chartColors.levelFill } },
            x: { title: { display: true, text: 'Horas antes/depois do pico observado' }, grid: { display: false }, ticks: { color: colors.textSecondary, maxTicksLimit: 12, maxRotation: 0 } },
          },
        }}
      />
    </ChartBox>
  );
}

export function HistoricalDamFlowChart({ event }: { event: HistoricalFloodEvent | null }) {
  const data = useMemo(() => {
    const hours = Array.from({ length: 37 }, (_, index) => -96 + index * 3);
    const damColors = [colors.mucumBlue, colors.warning, colors.valleyGreen];
    return {
      labels: hours.map((hour) => hour === 0 ? 'Pico em Mucum' : `${hour}h`),
      datasets: (event?.damFlows ?? [])
        .filter((series) => series.points.length)
        .map((series, index) => {
          const valuesByHour = new Map(series.points.map((point) => [point.hourFromFloodPeak, point.flowM3s]));
          return {
            label: `${series.damName} - ${series.signal}`,
            data: hours.map((hour) => valuesByHour.get(hour) ?? null),
            borderColor: damColors[Math.floor(index / 2) % damColors.length],
            borderDash: series.signal.startsWith('Defluencia') ? [5, 4] : undefined,
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.15,
            spanGaps: false,
          };
        }),
    };
  }, [event]);

  if (!data.datasets.length) return <EmptyChart message="Nao ha vazoes historicas disponiveis para este evento." />;

  return (
    <ChartBox>
      <Line
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: commonPlugins,
          scales: {
            y: { beginAtZero: true, title: { display: true, text: 'Vazao telemetrica (m3/s)', color: chartColors.flow }, grid: { color: chartColors.flowFill } },
            x: { title: { display: true, text: 'Horas em relacao ao pico observado em Mucum' }, grid: { display: false }, ticks: { color: colors.textSecondary, maxTicksLimit: 12, maxRotation: 0 } },
          },
        }}
      />
    </ChartBox>
  );
}

export function ProjectionRainChart({ projection }: { projection: MucumProjectionData | null }) {
  const data = useMemo(() => {
    const rows = (projection?.timeline ?? []).filter((row) => row.hour % 3 === 0);
    return {
      labels: rows.map((row) => row.hour === 0 ? 'Agora' : `+${row.hour}h`),
      datasets: [
        { label: 'Chuva P90 / maximo', data: rows.map((row) => row.maximumRainMm), borderColor: colors.danger, borderDash: [5, 4], pointRadius: 0, tension: 0.2 },
        { label: 'Chuva mediana / provavel', data: rows.map((row) => row.likelyRainMm), borderColor: colors.mucumBlue, backgroundColor: chartColors.rainFill, fill: true, pointRadius: 0, tension: 0.2 },
        { label: 'Chuva P10 / minimo', data: rows.map((row) => row.minimumRainMm), borderColor: colors.valleyGreen, borderDash: [3, 3], pointRadius: 0, tension: 0.2 },
      ],
    };
  }, [projection]);

  if (!data.labels.length) return <EmptyChart message="Sem ensemble de chuva para compor os cenarios." />;

  return (
    <ChartBox>
      <Line
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: commonPlugins,
          scales: {
            y: { beginAtZero: true, title: { display: true, text: 'Chuva acumulada na bacia (mm)', color: chartColors.rain }, grid: { color: chartColors.rainGrid } },
            x: { grid: { display: false }, ticks: { color: colors.textSecondary, maxTicksLimit: 10, maxRotation: 0 } },
          },
        }}
      />
    </ChartBox>
  );
}

function thresholdDataset(label: string, value: number, color: string, length: number) {
  return {
    label,
    data: Array(length).fill(value),
    borderColor: color,
    borderDash: [2, 5],
    borderWidth: 1,
    pointRadius: 0,
    tension: 0,
  };
}

export function DamsFlowChart({ current }: CurrentChartProps) {
  const data = useMemo(() => ({
    labels: (current?.dams ?? []).map((dam) => dam.dam_name),
    datasets: [
      {
        type: 'bar' as const,
        label: 'Entrada (m3/s)',
        data: (current?.dams ?? []).map((dam) => dam.inflow_m3s),
        backgroundColor: chartColors.rain,
        borderRadius: 4,
        yAxisID: 'flow',
      },
      {
        type: 'bar' as const,
        label: 'Saida (m3/s)',
        data: (current?.dams ?? []).map((dam) => dam.outflow_m3s),
        backgroundColor: chartColors.level,
        borderRadius: 4,
        yAxisID: 'flow',
      },
      {
        type: 'line' as const,
        label: 'Reservatorio (m)',
        data: (current?.dams ?? []).map((dam) => dam.reservoir_level_m),
        borderColor: chartColors.reservoir,
        backgroundColor: chartColors.reservoir,
        tension: 0.2,
        pointRadius: 4,
        yAxisID: 'level',
      },
    ],
  }), [current]);

  if (!data.labels.length) return <EmptyChart message="Nenhuma leitura de barragem disponivel para comparar." />;

  return (
    <ChartBox>
      <Chart
        type="bar"
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: commonPlugins,
          scales: {
            flow: { type: 'linear', position: 'left', beginAtZero: true, title: { display: true, text: 'Vazao (m3/s)', color: chartColors.flow }, grid: { color: chartColors.rainGrid } },
            level: { type: 'linear', position: 'right', title: { display: true, text: 'Nivel (m)', color: colors.institutionalBlue }, grid: { drawOnChartArea: false } },
            x: { grid: { display: false }, ticks: { color: colors.textSecondary, maxRotation: 0 } },
          },
        } as any}
      />
    </ChartBox>
  );
}

function ChartBox({ children, contentHeight }: { children: React.ReactNode; contentHeight?: number }) {
  const { height } = useWindowDimensions();
  const chartHeight = Math.max(185, Math.min(250, Math.round(height * 0.29)));

  if (contentHeight && contentHeight > chartHeight) {
    return (
      <View style={[styles.box, { height: chartHeight, padding: 0 }]}>
        <ScrollView contentContainerStyle={{ height: contentHeight, padding: 12 }}>
          {children}
        </ScrollView>
      </View>
    );
  }

  return <View style={[styles.box, { height: chartHeight }]}>{children}</View>;
}

function cityNamesMatch(left: string, right: string) {
  const normalizedLeft = normalizeCityName(left);
  const normalizedRight = normalizeCityName(right);
  return normalizedLeft === normalizedRight
    || normalizedLeft.startsWith(normalizedRight)
    || normalizedRight.startsWith(normalizedLeft);
}

function normalizeCityName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}

function formatDayLabel(value: string) {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}` : value;
}

function roundChartNumber(value: number) {
  return Math.round(value * 100) / 100;
}

function EmptyChart({ message }: { message: string }) {
  const { height } = useWindowDimensions();
  const chartHeight = Math.max(185, Math.min(250, Math.round(height * 0.29)));
  return (
    <View style={[styles.empty, { height: chartHeight }]}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
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
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
  },
});

