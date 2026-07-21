import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ChevronDown, ChevronUp, CloudRain, MapPin, RadioTower } from 'lucide-react-native';

import { AppText as Text } from '../../components/ui/AppText';
import { MucumCurrentData } from '../../services/mucumCurrent';
import { colors } from '../../theme/mucumTheme';
import { formatMeasuredAt, formatNullable } from '../../utils/format';
import {
  mucumContributorCatalog,
  MucumContributor,
  normalizeHydroName,
} from './mucumContributors';

type Props = {
  current: MucumCurrentData | null;
  rainfallLabel: string;
};

type CityRainfallRow = {
  city: string;
  contributor: MucumContributor | null;
  rainfallMm: number | null;
  maxDailyMm: number | null;
  peakDate: string | null;
  stationName: string | null;
  measuredAt: string | null;
};

type SystemFilter = 'all' | 'system_antas' | 'system_carreiro' | 'system_guapore';

const filterOptions: { key: SystemFilter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'system_antas', label: 'Antas' },
  { key: 'system_carreiro', label: 'Carreiro' },
  { key: 'system_guapore', label: 'Guapore' },
];

const defaultVisibleRows = 12;

export function UpstreamCityRainfallPanel({ current, rainfallLabel }: Props) {
  const { width } = useWindowDimensions();
  const narrow = width < 820;
  const [selectedSystem, setSelectedSystem] = useState<SystemFilter>('all');
  const [showAll, setShowAll] = useState(false);
  const rows = useMemo(() => buildCityRows(current), [current]);
  const filteredRows = rows.filter((row) => (
    selectedSystem === 'all' || contributorSystem(row.contributor) === selectedSystem
  ));
  const visibleRows = showAll ? filteredRows : filteredRows.slice(0, defaultVisibleRows);
  const rowsWithReading = filteredRows.filter((row) => row.rainfallMm !== null);
  const highest = rowsWithReading[0] ?? null;
  const highestPeak = rowsWithReading
    .filter((row) => row.maxDailyMm !== null)
    .slice()
    .sort((left, right) => (right.maxDailyMm ?? 0) - (left.maxDailyMm ?? 0))[0] ?? null;

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <CloudRain color={colors.mucumBlue} size={20} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Quanto choveu nas cabeceiras, por cidade</Text>
          <Text style={styles.subtitle}>
            Acumulado observado em {rainfallLabel} nas cidades a montante que drenam para Mucum. Zero e uma leitura valida; traco indica dado indisponivel.
          </Text>
        </View>
        <View style={styles.coverageBadge}>
          <Text style={styles.coverageValue}>{rowsWithReading.length}/{filteredRows.length}</Text>
          <Text style={styles.coverageLabel}>com leitura</Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <SummaryMetric
          label={`Maior acumulado em ${rainfallLabel}`}
          value={highest ? formatNullable(highest.rainfallMm, ' mm') : '-'}
          detail={highest?.city ?? 'Sem leitura no periodo'}
        />
        <SummaryMetric
          label="Maior pico diario"
          value={highestPeak ? formatNullable(highestPeak.maxDailyMm, ' mm') : '-'}
          detail={highestPeak ? `${highestPeak.city}${formatPeakDate(highestPeak.peakDate)}` : 'Sem serie diaria'}
        />
        <SummaryMetric
          label="Ultima atualizacao regional"
          value={formatMeasuredAt(current?.regionalRainfall.lastMeasuredAt) || '-'}
          detail={`${current?.regionalRainfall.stationCount ?? 0} estacoes consideradas`}
        />
      </View>

      <View style={styles.filters}>
        {filterOptions.map((option) => {
          const selected = selectedSystem === option.key;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                setSelectedSystem(option.key);
                setShowAll(false);
              }}
              style={({ pressed }) => [styles.filterButton, selected && styles.filterButtonSelected, pressed && styles.pressed]}
            >
              <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {!narrow ? (
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={[styles.tableHeaderText, styles.cityCell]}>Cidade da cabeceira</Text>
          <Text style={[styles.tableHeaderText, styles.systemCell]}>Sistema formador</Text>
          <Text style={[styles.tableHeaderText, styles.rainCell]}>Chuva {rainfallLabel}</Text>
          <Text style={[styles.tableHeaderText, styles.peakCell]}>Pico diario</Text>
          <Text style={[styles.tableHeaderText, styles.stationCell]}>Fonte da leitura</Text>
        </View>
      ) : null}

      <View style={styles.tableBody}>
        {visibleRows.map((row) => (
          <CityRainfallTableRow key={normalizeHydroName(row.city)} row={row} rainfallLabel={rainfallLabel} narrow={narrow} />
        ))}
        {!visibleRows.length ? (
          <Text style={styles.empty}>Nenhuma cidade cadastrada neste sistema formador.</Text>
        ) : null}
      </View>

      {filteredRows.length > defaultVisibleRows ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowAll((currentValue) => !currentValue)}
          style={({ pressed }) => [styles.showAllButton, pressed && styles.pressed]}
        >
          {showAll ? <ChevronUp color={colors.institutionalBlue} size={17} /> : <ChevronDown color={colors.institutionalBlue} size={17} />}
          <Text style={styles.showAllText}>
            {showAll ? 'Mostrar menos cidades' : `Mostrar todas as ${filteredRows.length} cidades`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function CityRainfallTableRow({
  row,
  rainfallLabel,
  narrow,
}: {
  row: CityRainfallRow;
  rainfallLabel: string;
  narrow: boolean;
}) {
  const hasReading = row.rainfallMm !== null;
  const palette = influencePalette(row.contributor?.influence);

  return (
    <View style={[styles.tableRow, narrow && styles.tableRowNarrow]}>
      <View style={[styles.cityCell, narrow && styles.fullCell]}>
        <View style={styles.cityTitleRow}>
          <MapPin color={palette.color} size={16} />
          <Text style={styles.cityName}>{row.city}</Text>
        </View>
        <View style={[styles.influenceBadge, { backgroundColor: palette.background }]}>
          <Text style={[styles.influenceText, { color: palette.color }]}>{palette.label}</Text>
        </View>
      </View>

      <View style={[styles.systemCell, narrow && styles.halfCell]}>
        {narrow ? <Text style={styles.mobileLabel}>Sistema formador</Text> : null}
        <Text style={styles.systemName}>{row.contributor?.name ?? 'Contribuinte a montante'}</Text>
      </View>

      <View style={[styles.rainCell, narrow && styles.halfCell]}>
        {narrow ? <Text style={styles.mobileLabel}>Chuva {rainfallLabel}</Text> : null}
        <Text style={[styles.rainValue, !hasReading && styles.unavailableValue]}>
          {formatNullable(row.rainfallMm, ' mm')}
        </Text>
        {!hasReading ? <Text style={styles.unavailableText}>Sem leitura</Text> : null}
      </View>

      <View style={[styles.peakCell, narrow && styles.halfCell]}>
        {narrow ? <Text style={styles.mobileLabel}>Pico diario</Text> : null}
        <Text style={styles.metricValue}>{formatNullable(row.maxDailyMm, ' mm')}</Text>
        <Text style={styles.metricDetail}>{formatPeakDate(row.peakDate).replace(' - ', '') || '-'}</Text>
      </View>

      <View style={[styles.stationCell, narrow && styles.halfCell]}>
        {narrow ? <Text style={styles.mobileLabel}>Fonte da leitura</Text> : null}
        <View style={styles.stationTitleRow}>
          <RadioTower color={colors.textSecondary} size={15} />
          <Text style={styles.stationName} numberOfLines={2}>{row.stationName ?? 'Sem estacao com dado'}</Text>
        </View>
        <Text style={styles.metricDetail}>{formatMeasuredAt(row.measuredAt) || 'Nao atualizada no periodo'}</Text>
      </View>
    </View>
  );
}

function SummaryMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <View style={styles.summaryMetric}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryDetail}>{detail}</Text>
    </View>
  );
}

function buildCityRows(current: MucumCurrentData | null) {
  const contributors = mucumContributorCatalog.contributors
    .filter((contributor) => !['local_drainage', 'outlet'].includes(contributor.relation))
    .slice()
    .sort((left, right) => right.priority - left.priority);
  const rows = new Map<string, CityRainfallRow>();

  contributors.forEach((contributor) => {
    contributor.cities.forEach((city) => {
      const key = normalizeHydroName(city);
      if (rows.has(key)) return;
      rows.set(key, emptyCityRow(city, contributor));
    });
  });

  (current?.regionalRainfall.cities ?? []).forEach((reading) => {
    if (normalizeHydroName(reading.city) === 'MUCUM' || reading.contributorRelation === 'downstream_context') return;
    const key = normalizeHydroName(reading.city);
    const existing = rows.get(key);
    const contributor = contributors.find((item) => item.key === reading.contributorKey) ?? existing?.contributor ?? null;
    rows.set(key, {
      city: reading.city,
      contributor,
      rainfallMm: reading.rainfallMm,
      maxDailyMm: reading.maxDailyMm,
      peakDate: reading.peakDate,
      stationName: reading.stationName,
      measuredAt: reading.measuredAt,
    });
  });

  return Array.from(rows.values()).sort((left, right) => {
    const leftHasReading = left.rainfallMm !== null;
    const rightHasReading = right.rainfallMm !== null;
    if (leftHasReading !== rightHasReading) return leftHasReading ? -1 : 1;
    if (leftHasReading && rightHasReading && left.rainfallMm !== right.rainfallMm) {
      return (right.rainfallMm ?? 0) - (left.rainfallMm ?? 0);
    }
    const priorityDifference = (right.contributor?.priority ?? 0) - (left.contributor?.priority ?? 0);
    return priorityDifference || left.city.localeCompare(right.city, 'pt-BR');
  });
}

function emptyCityRow(city: string, contributor: MucumContributor): CityRainfallRow {
  return {
    city,
    contributor,
    rainfallMm: null,
    maxDailyMm: null,
    peakDate: null,
    stationName: null,
    measuredAt: null,
  };
}

function contributorSystem(contributor: MucumContributor | null): SystemFilter {
  if (!contributor) return 'all';
  const group = mucumContributorCatalog.priorityGroups.find((item) => item.contributorKeys.includes(contributor.key));
  return (group?.key as SystemFilter | undefined) ?? 'all';
}

function influencePalette(influence: MucumContributor['influence'] | undefined) {
  if (influence === 'very_high') return { label: 'Influencia muito alta', color: colors.mucumBlue, background: colors.blueSoft };
  if (influence === 'high') return { label: 'Influencia alta', color: colors.valleyGreen, background: colors.greenSoft };
  return { label: 'Influencia media', color: colors.textSecondary, background: colors.surfaceMuted };
}

function formatPeakDate(value: string | null) {
  if (!value) return '';
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return ` - ${value}`;
  return ` - ${parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
}

const styles = StyleSheet.create({
  panel: { marginBottom: 18, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface, overflow: 'hidden' },
  header: { padding: 18, flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerIcon: { width: 38, height: 38, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blueSoft },
  headerCopy: { flex: 1, minWidth: 230, gap: 3 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 19 },
  coverageBadge: { minWidth: 90, paddingHorizontal: 12, paddingVertical: 7, alignItems: 'center', borderRadius: 6, backgroundColor: colors.surfaceMuted },
  coverageValue: { color: colors.institutionalBlue, fontSize: 18, fontWeight: '700' },
  coverageLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  summaryRow: { padding: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 10, backgroundColor: colors.surfaceMuted, borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryMetric: { flex: 1, minWidth: 210, gap: 2 },
  summaryLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  summaryValue: { color: colors.institutionalBlue, fontSize: 20, fontWeight: '700' },
  summaryDetail: { color: colors.textSecondary, fontSize: 14 },
  filters: { paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 7, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterButton: { minHeight: 35, paddingHorizontal: 12, paddingVertical: 7, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 6, backgroundColor: colors.surface },
  filterButtonSelected: { borderColor: colors.mucumBlue, backgroundColor: colors.blueSoft },
  filterText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  filterTextSelected: { color: colors.institutionalBlue },
  pressed: { opacity: 0.76 },
  tableBody: { width: '100%' },
  tableRow: { minHeight: 68, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 },
  tableRowNarrow: { alignItems: 'flex-start', flexWrap: 'wrap', paddingVertical: 13 },
  tableHeader: { minHeight: 42, paddingVertical: 8, backgroundColor: colors.institutionalBlue },
  tableHeaderText: { color: colors.surface, fontSize: 14, fontWeight: '600' },
  cityCell: { flexBasis: '24%', flexGrow: 1, minWidth: 150, gap: 5 },
  systemCell: { flexBasis: '18%', flexGrow: 1, minWidth: 115, gap: 2 },
  rainCell: { flexBasis: '14%', flexGrow: 1, minWidth: 95, gap: 1 },
  peakCell: { flexBasis: '13%', flexGrow: 1, minWidth: 90, gap: 1 },
  stationCell: { flexBasis: '24%', flexGrow: 1, minWidth: 160, gap: 2 },
  fullCell: { flexBasis: '100%', minWidth: '100%' },
  halfCell: { flexBasis: '46%', minWidth: 135 },
  cityTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cityName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' },
  influenceBadge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  influenceText: { fontSize: 14, fontWeight: '600' },
  systemName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  rainValue: { color: colors.mucumBlue, fontSize: 18, fontWeight: '700' },
  unavailableValue: { color: colors.textSecondary },
  unavailableText: { color: colors.warning, fontSize: 14, fontWeight: '600' },
  metricValue: { color: colors.text, fontSize: 15, fontWeight: '700' },
  metricDetail: { color: colors.textSecondary, fontSize: 14 },
  stationTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stationName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  mobileLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  empty: { padding: 18, color: colors.textSecondary, fontSize: 14 },
  showAllButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.surfaceMuted },
  showAllText: { color: colors.institutionalBlue, fontSize: 14, fontWeight: '600' },
});
