import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText as Text } from '../ui/AppText';
import { MucumCurrentData } from '../../services/mucumCurrent';
import { MucumForecastData } from '../../services/mucumForecast';
import { HistoricalFloodEvent, MucumHistoricalFloodsData } from '../../services/mucumHistoricalFloods';
import { MucumProjectionData } from '../../services/mucumProjection';
import { colors } from '../../theme/mucumTheme';

type CurrentChartProps = { current: MucumCurrentData | null };

export function RegionalRainfallChart({ current }: CurrentChartProps) {
  return <ChartFallback count={current?.regionalRainfall.stations.length ?? 0} />;
}

export function RegionalRainfallPeaksChart({ current }: CurrentChartProps) {
  return <ChartFallback count={current?.regionalRainfall.cities?.length ?? 0} />;
}

export function CityRainfallDetailChart({
  current,
}: CurrentChartProps & { forecast: MucumForecastData | null; cities: string[]; observedLabel: string }) {
  return <ChartFallback count={current?.regionalRainfall.cities?.length ?? 0} />;
}

export function RiverTrendChart({ current }: CurrentChartProps) {
  return <ChartFallback count={current?.stationReadings.length ?? 0} />;
}

export function DamsFlowChart({ current }: CurrentChartProps) {
  return <ChartFallback count={current?.dams.length ?? 0} />;
}

export function ForecastRainChart({ forecast }: { forecast: MucumForecastData | null }) {
  return <ChartFallback count={forecast?.points.length ?? 0} />;
}

export function ProjectionLevelChart({ projection }: { projection: MucumProjectionData | null }) {
  return <ChartFallback count={projection?.timeline.length ?? 0} />;
}

export function ProjectionRainChart({ projection }: { projection: MucumProjectionData | null }) {
  return <ChartFallback count={projection?.timeline.length ?? 0} />;
}

export function HistoricalFloodRiseChart({ historical }: { historical: MucumHistoricalFloodsData | null }) {
  return <ChartFallback count={historical?.events.length ?? 0} />;
}

export function HistoricalDamFlowChart({ event }: { event: HistoricalFloodEvent | null }) {
  return <ChartFallback count={event?.damFlows.length ?? 0} />;
}

function ChartFallback({ count }: { count: number }) {
  const { height } = useWindowDimensions();
  return (
    <View style={[styles.fallback, { height: Math.max(185, Math.min(240, Math.round(height * 0.28))) }]}>
      <Text style={styles.title}>Grafico disponivel no painel web</Text>
      <Text style={styles.text}>
        {count ? `${count} fonte(s) de dados carregada(s).` : 'Ainda nao ha dados suficientes para esta visualizacao.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 6,
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  text: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },
});

