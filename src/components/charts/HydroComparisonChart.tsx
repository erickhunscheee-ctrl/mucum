import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText as Text } from '../ui/AppText';
import { MucumCurrentData } from '../../services/mucumCurrent';
import { colors } from '../../theme/mucumTheme';

export function HydroComparisonChart({ current }: { current: MucumCurrentData | null }) {
  const { height } = useWindowDimensions();
  const readings = current?.stationReadings?.filter((reading) => (
    reading.rainfallMm !== null ||
    reading.riverLevelM !== null ||
    reading.flowM3s !== null
  )) ?? [];

  return (
    <View style={[styles.fallback, { height: Math.max(190, Math.min(250, Math.round(height * 0.3))) }]}>
      <Text style={styles.title}>Grafico disponivel no painel web</Text>
      <Text style={styles.text}>
        {readings.length
          ? `${readings.length} leitura(s) carregada(s) para comparacao.`
          : 'Sem serie suficiente para montar a comparacao agora.'}
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
    maxWidth: 420,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },
});

