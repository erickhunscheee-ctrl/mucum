import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Check, CloudRain, GitBranch, MapPin, TriangleAlert } from 'lucide-react-native';

import { AppText as Text } from '../../components/ui/AppText';
import { MucumCurrentData } from '../../services/mucumCurrent';
import { MucumForecastData } from '../../services/mucumForecast';
import { colors } from '../../theme/mucumTheme';
import { formatMeasuredAt, formatNullable } from '../../utils/format';
import {
  contributorMatchesLocation,
  mucumContributorCatalog,
  MucumContributor,
  normalizeHydroName,
} from './mucumContributors';

type Props = {
  current: MucumCurrentData | null;
  forecast: MucumForecastData | null;
  rainfallLabel: string;
  compact?: boolean;
  selectedCities?: string[];
  onToggleCity?: (city: string) => void;
};

type CityReading = {
  city: string;
  observedMm: number | null;
  forecast72hMm: number | null;
  measuredAt: string | null;
};

export function MucumContributorsPanel({
  current,
  forecast,
  rainfallLabel,
  compact = false,
  selectedCities = [],
  onToggleCity,
}: Props) {
  const { width } = useWindowDimensions();
  const narrow = width < 900;
  const municipalityCount = new Set(mucumContributorCatalog.contributors.flatMap((contributor) => contributor.cities)).size;

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.headerIcon}><GitBranch color={colors.mucumBlue} size={19} /></View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Contribuintes hidrologicos de Mucum</Text>
          <Text style={styles.subtitle}>
            Chuva observada em {rainfallLabel}, previsao de 72h e {municipalityCount} municipios no indice de cobertura, separados entre montante, efeito local e jusante.
          </Text>
        </View>
      </View>

      {!compact ? (
        <View style={[styles.priorityGrid, narrow && styles.priorityGridNarrow]}>
          {mucumContributorCatalog.priorityGroups.map((group) => {
            const cities = groupCityReadings(group.contributorKeys, current, forecast);
            const maxObserved = maxNullable(cities.map((city) => city.observedMm));
            const maxForecast = maxNullable(cities.map((city) => city.forecast72hMm));
            const accent = group.key === 'system_guapore' ? colors.info : colors.mucumBlue;
            return (
              <View key={group.key} style={[styles.priorityCard, { borderTopColor: accent }]}>
                <View style={styles.priorityHeader}>
                  <View style={styles.headerCopy}>
                    <Text style={styles.priorityName}>{group.name}</Text>
                    <Text style={[styles.priorityLabel, { color: accent }]}>{group.priorityLabel}</Text>
                  </View>
                  {group.key === 'system_guapore' ? <TriangleAlert color={colors.info} size={18} /> : <GitBranch color={colors.mucumBlue} size={18} />}
                </View>
                <Text style={styles.description}>{group.description}</Text>
                <View style={styles.metrics}>
                  <SmallMetric label={`Observado ${rainfallLabel}`} value={formatNullable(maxObserved, ' mm')} />
                  <SmallMetric label="Previsao 72h" value={formatNullable(maxForecast, ' mm')} />
                </View>
                <View style={styles.cityList}>
                  {cities.length ? cities.slice(0, 6).map((city) => (
                    <CityRow
                      key={city.city}
                      city={city}
                      selected={selectedCities.some((selectedCity) => normalizeHydroName(selectedCity) === normalizeHydroName(city.city))}
                      onToggle={onToggleCity}
                    />
                  )) : <Text style={styles.empty}>Sem cidade com leitura ou previsao disponivel agora.</Text>}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.catalogBlock}>
        <Text style={styles.blockTitle}>Consulta completa por contribuinte</Text>
        <Text style={styles.subtitle}>Os principais aparecem primeiro; tributarios sem estacao continuam visiveis no escopo.</Text>
        <View style={styles.contributorList}>
          {mucumContributorCatalog.contributors
            .slice()
            .sort((left, right) => right.priority - left.priority || left.name.localeCompare(right.name))
            .map((contributor) => (
              <ContributorRow
                key={contributor.key}
                contributor={contributor}
                current={current}
                forecast={forecast}
                rainfallLabel={rainfallLabel}
              />
            ))}
        </View>
      </View>

      <View style={styles.downstreamBlock}>
        <View style={styles.downstreamHeader}>
          <MapPin color={colors.textSecondary} size={17} />
          <Text style={styles.blockTitle}>Contexto a jusante, fora da entrada de Mucum</Text>
        </View>
        <View style={styles.downstreamTags}>
          {mucumContributorCatalog.downstreamContext.map((item) => (
            <View key={item.key} style={styles.downstreamTag}>
              <Text style={styles.downstreamName}>{item.name}</Text>
              <Text style={styles.downstreamDescription}>{item.description}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function ContributorRow({
  contributor,
  current,
  forecast,
  rainfallLabel,
}: {
  contributor: MucumContributor;
  current: MucumCurrentData | null;
  forecast: MucumForecastData | null;
  rainfallLabel: string;
}) {
  const cities = groupCityReadings([contributor.key], current, forecast);
  const observed = maxNullable(cities.map((city) => city.observedMm));
  const forecast72h = maxNullable(cities.map((city) => city.forecast72hMm));
  const palette = contributorPalette(contributor);

  return (
    <View style={styles.contributorRow}>
      <View style={[styles.contributorMarker, { backgroundColor: palette.color }]} />
      <View style={styles.contributorBody}>
        <View style={styles.contributorCopy}>
          <View style={styles.contributorTitleRow}>
            <Text style={styles.contributorName}>{contributor.name}</Text>
            <View style={[styles.relationBadge, { backgroundColor: palette.background, borderColor: palette.color }]}>
              <Text style={[styles.relationText, { color: palette.color }]}>{palette.label}</Text>
            </View>
          </View>
          <Text style={styles.description}>{contributor.description}</Text>
          <Text style={styles.cityNames} numberOfLines={3}>
            Cobertura municipal: {contributor.cities.join(', ')}
          </Text>
        </View>
        <View style={styles.contributorMetrics}>
          <View style={styles.rowMetrics}>
            <Text style={styles.rowMetricLabel}>{rainfallLabel}</Text>
            <Text style={styles.rowMetricValue}>{formatNullable(observed, ' mm')}</Text>
          </View>
          <View style={styles.rowMetrics}>
            <Text style={styles.rowMetricLabel}>Prev. 72h</Text>
            <Text style={styles.rowMetricValue}>{formatNullable(forecast72h, ' mm')}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function CityRow({
  city,
  selected,
  onToggle,
}: {
  city: CityReading;
  selected: boolean;
  onToggle?: (city: string) => void;
}) {
  const content = (
    <>
      {onToggle ? (
        <View style={[styles.cityCheckbox, selected && styles.cityCheckboxSelected]}>
          {selected ? <Check color={colors.surface} size={13} /> : null}
        </View>
      ) : null}
      <View style={styles.cityCopy}>
        <Text style={styles.cityName}>{city.city}</Text>
        <Text style={styles.cityUpdated}>{formatMeasuredAt(city.measuredAt) || 'Previsao regional'}</Text>
      </View>
      <View style={styles.cityMetric}>
        <CloudRain color={colors.mucumBlue} size={14} />
        <Text style={styles.cityMetricText}>{formatNullable(city.observedMm, ' mm')}</Text>
      </View>
      <Text style={styles.cityForecast}>+72h {formatNullable(city.forecast72hMm, ' mm')}</Text>
    </>
  );

  if (!onToggle) return <View style={styles.cityRow}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={() => onToggle(city.city)}
      style={({ pressed }) => [styles.cityRow, selected && styles.cityRowSelected, pressed && styles.cityRowPressed]}
    >
      {content}
    </Pressable>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.smallMetric}>
      <Text style={styles.smallMetricLabel}>{label}</Text>
      <Text style={styles.smallMetricValue}>{value}</Text>
    </View>
  );
}

function groupCityReadings(keys: string[], current: MucumCurrentData | null, forecast: MucumForecastData | null) {
  const definitions = mucumContributorCatalog.contributors.filter((contributor) => keys.includes(contributor.key));
  const readings = new Map<string, CityReading>();

  (current?.regionalRainfall.cities ?? []).forEach((city) => {
    const matches = city.contributorKey
      ? keys.includes(city.contributorKey)
      : definitions.some((definition) => contributorMatchesLocation(definition, city.city));
    if (!matches) return;
    readings.set(normalizeHydroName(city.city), {
      city: city.city,
      observedMm: city.rainfallMm,
      forecast72hMm: null,
      measuredAt: city.measuredAt,
    });
  });

  (forecast?.points ?? []).forEach((point) => {
    const matches = point.contributorKey
      ? keys.includes(point.contributorKey)
      : definitions.some((definition) => contributorMatchesLocation(definition, point.name));
    if (!matches) return;
    const normalized = normalizeHydroName(point.name.replace(/ - UHE .+$/, ''));
    const existing = readings.get(normalized);
    readings.set(normalized, {
      city: existing?.city ?? point.name,
      observedMm: existing?.observedMm ?? null,
      forecast72hMm: point.next72hMm,
      measuredAt: existing?.measuredAt ?? null,
    });
  });

  return Array.from(readings.values()).sort((left, right) => (
    Math.max(right.observedMm ?? -1, right.forecast72hMm ?? -1)
    - Math.max(left.observedMm ?? -1, left.forecast72hMm ?? -1)
  ));
}

function maxNullable(values: (number | null)[]) {
  const available = values.filter((value): value is number => typeof value === 'number');
  return available.length ? Math.max(...available) : null;
}

function contributorPalette(contributor: MucumContributor) {
  if (contributor.relation === 'local_critical') return { color: colors.info, background: colors.infoSoft, label: 'Critico local' };
  if (contributor.relation === 'local_drainage') return { color: colors.warning, background: colors.warningSoft, label: 'Drenagem local' };
  if (contributor.relation === 'outlet') return { color: colors.institutionalBlue, background: colors.blueSoft, label: 'Controle Mucum' };
  if (contributor.influence === 'very_high') return { color: colors.mucumBlue, background: colors.blueSoft, label: 'Principal' };
  if (contributor.influence === 'high') return { color: colors.valleyGreen, background: colors.greenSoft, label: 'Alta influencia' };
  return { color: colors.textSecondary, background: colors.surfaceMuted, label: 'Tributario' };
}

const styles = StyleSheet.create({
  panel: { padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  headerIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blueSoft, borderRadius: 5 },
  headerCopy: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 19 },
  priorityGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  priorityGridNarrow: { flexDirection: 'column' },
  priorityCard: { flex: 1, minWidth: 0, padding: 13, borderWidth: 1, borderColor: colors.border, borderTopWidth: 3, borderRadius: 6, gap: 9 },
  priorityHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  priorityName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  priorityLabel: { fontSize: 14, fontWeight: '700' },
  description: { color: colors.textSecondary, fontSize: 14, lineHeight: 18 },
  metrics: { flexDirection: 'row', gap: 8 },
  smallMetric: { flex: 1, padding: 8, backgroundColor: colors.surfaceMuted, borderRadius: 4 },
  smallMetricLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  smallMetricValue: { color: colors.institutionalBlue, fontSize: 18, fontWeight: '700' },
  cityList: { gap: 4 },
  cityRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  cityRowSelected: { backgroundColor: colors.blueSoft },
  cityRowPressed: { backgroundColor: colors.blueSoft },
  cityCheckbox: { width: 19, height: 19, borderWidth: 1, borderColor: colors.border, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  cityCheckboxSelected: { backgroundColor: colors.mucumBlue, borderColor: colors.mucumBlue },
  cityCopy: { flex: 1 },
  cityName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  cityUpdated: { color: colors.textSecondary, fontSize: 14 },
  cityMetric: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cityMetricText: { color: colors.mucumBlue, fontSize: 14, fontWeight: '700' },
  cityForecast: { width: 82, textAlign: 'right', color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  empty: { color: colors.textSecondary, fontSize: 14, fontStyle: 'italic' },
  catalogBlock: { gap: 7 },
  blockTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  contributorList: { borderTopWidth: 1, borderTopColor: colors.border },
  contributorRow: { minHeight: 74, flexDirection: 'row', alignItems: 'stretch', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  contributorMarker: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  contributorBody: { flex: 1, minWidth: 0, gap: 8 },
  contributorCopy: { flex: 1, minWidth: 0, gap: 2 },
  contributorTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  contributorName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  relationBadge: { paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderRadius: 4 },
  relationText: { fontSize: 14, fontWeight: '700' },
  cityNames: { color: colors.textSecondary, fontSize: 14 },
  contributorMetrics: { flexDirection: 'row', gap: 8 },
  rowMetrics: { flex: 1, padding: 7, backgroundColor: colors.surfaceMuted, borderRadius: 4 },
  rowMetricLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  rowMetricValue: { color: colors.institutionalBlue, fontSize: 15, fontWeight: '700' },
  downstreamBlock: { gap: 8, paddingTop: 2 },
  downstreamHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  downstreamTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  downstreamTag: { flexGrow: 1, flexBasis: 220, padding: 10, backgroundColor: colors.surfaceMuted, borderLeftWidth: 3, borderLeftColor: colors.textSecondary },
  downstreamName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  downstreamDescription: { color: colors.textSecondary, fontSize: 14, lineHeight: 18 },
});
