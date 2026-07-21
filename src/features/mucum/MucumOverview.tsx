import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  Check,
  CloudRain,
  Clock,
  Database,
  Droplets,
  Gauge,
  RadioTower,
  RefreshCcw,
  TrendingUp,
  Waves,
} from 'lucide-react-native';

import { HydroComparisonChart } from '../../components/charts/HydroComparisonChart';
import { AppText as Text } from '../../components/ui/AppText';
import { ContingencyPlanSection } from '../contingency/ContingencyPlanSection';
import {
  CityRainfallDetailChart,
  DamsFlowChart,
  ForecastRainChart,
  ProjectionLevelChart,
  ProjectionRainChart,
  RegionalRainfallChart,
  RegionalRainfallPeaksChart,
  RiverTrendChart,
} from '../../components/charts/MucumAnalyticsCharts';
import { MucumContext, MucumStationSummary } from '../../services/mucumContext';
import { MucumCurrentData } from '../../services/mucumCurrent';
import { MucumForecastData } from '../../services/mucumForecast';
import { MucumProjectionData, ProjectionSeverity, ProjectionStatus } from '../../services/mucumProjection';
import { AdminSection, RainfallWindowHours } from '../../types/navigation';
import { DashboardDataStatus } from '../../types/dashboard';
import { colors } from '../../theme/mucumTheme';
import { MucumContributorsPanel } from './MucumContributorsPanel';
import { mucumContributorCatalog } from './mucumContributors';
import { UpstreamCityRainfallPanel } from './UpstreamCityRainfallPanel';
import {
  formatForecastTime,
  formatMeasuredAt,
  formatNullable,
  rainfallWindowLabel,
} from '../../utils/format';

type AlertLevel = 'normal' | 'warning' | 'critical';

const ALERT_PARAMS = {
  level: { alert: 7.0, critical: 18.0 },
  rain24h: { alert: 20, critical: 100 },
};

const rainfallWindowOptions: { label: string; hours: RainfallWindowHours }[] = [
  { label: 'Dia', hours: 24 },
  { label: 'Semana', hours: 168 },
  { label: 'Mes', hours: 720 },
];

const priorityRainfallCities = ['Santa Tereza', 'Guapore', 'Marau', 'Jaquirana', 'Vacaria'];

const KPI_ACCENTS = {
  green: { accent: colors.safe, iconBg: colors.safeSoft, iconColor: colors.safe },
  blue: { accent: colors.mucumBlue, iconBg: colors.blueSoft, iconColor: colors.mucumBlue },
  amber: { accent: colors.bridgeGold, iconBg: colors.goldSoft, iconColor: colors.institutionalBlue },
  red: { accent: colors.danger, iconBg: colors.dangerSoft, iconColor: colors.danger },
  dark: { accent: colors.institutionalBlue, iconBg: colors.blueSoft, iconColor: colors.institutionalBlue },
};

type MucumOverviewProps = {
  context: MucumContext | null;
  current: MucumCurrentData | null;
  forecast: MucumForecastData | null;
  projection: MucumProjectionData | null;
  section: AdminSection;
  isLoading: boolean;
  dataStatus: DashboardDataStatus;
  dataUpdatedAt: string | null;
  dataWarning: string | null;
  rainfallWindowHours: RainfallWindowHours;
  onRainfallWindowChange: (hours: RainfallWindowHours) => void;
  onRefresh: () => void;
};

export function MucumOverview({
  context,
  current,
  forecast,
  projection,
  section,
  isLoading,
  dataStatus,
  dataUpdatedAt,
  dataWarning,
  rainfallWindowHours,
  onRainfallWindowChange,
  onRefresh,
}: MucumOverviewProps) {
  if (section === 'contingency') {
    return (
      <>
        <SectionHero section={section} onRefresh={onRefresh} />
        <DataFreshnessBar
          status={dataStatus}
          updatedAt={dataUpdatedAt}
          warning={dataWarning}
          isLoading={isLoading}
        />
        <ContingencyPlanSection current={current} projection={projection} />
      </>
    );
  }

  if (!context) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Carregando contexto hidrologico</Text>
          <ActivityIndicator color={colors.mucumBlue} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.resultSubtitle}>O painel busca municipio, sub-bacia, rios e estacoes relevantes da ANA.</Text>
        </View>
      </View>
    );
  }

  const rainfallLabel = rainfallWindowLabel(rainfallWindowHours);
  const levelStatus = riverLevelStatus(current?.river.currentLevelM);
  const rainStatus = rainfallStatus(
    current?.rainfall.accumulated24hMm
      ?? (rainfallWindowHours === 24 ? current?.rainfall.accumulatedMm ?? current?.rainfall.currentMm : null),
  );
  const riverStations = context.stations.allRelevant
    .filter((station) => station.isLevel || station.isFlow)
    .slice()
    .sort((left, right) => Number(right.upstreamOfMucum) - Number(left.upstreamOfMucum) || right.priority - left.priority);

  return (
    <>
      <SectionHero section={section} onRefresh={onRefresh} />
      <DataFreshnessBar
        status={dataStatus}
        updatedAt={dataUpdatedAt}
        warning={dataWarning}
        isLoading={isLoading}
      />
      {section !== 'projection' ? (
        <ObservationPeriodBar
          value={rainfallWindowHours}
          onChange={onRainfallWindowChange}
        />
      ) : null}

      {isLoading && !current ? (
        <View style={styles.loadingPanel}>
          <ActivityIndicator color={colors.mucumBlue} />
          <View style={styles.loadingCopy}>
            <Text style={styles.cardTitle}>Atualizando dados</Text>
            <Text style={styles.resultSubtitle}>
              Carregando ANA, Supabase, barragens e previsao para chuva {rainfallLabel}.
            </Text>
          </View>
        </View>
      ) : null}

      {section === 'dashboard' ? (
        <DashboardSection
          context={context}
          current={current}
          forecast={forecast}
          rainfallLabel={rainfallLabel}
          rainStatus={rainStatus}
          levelStatus={levelStatus}
        />
      ) : null}

      {section === 'monitoring' ? (
        <MonitoringSection
          current={current}
          forecast={forecast}
          isLoading={isLoading}
          rainfallLabel={rainfallLabel}
          rainStatus={rainStatus}
          levelStatus={levelStatus}
        />
      ) : null}

      {section === 'projection' ? (
        <ProjectionSection projection={projection} isLoading={isLoading} />
      ) : null}

      {section === 'rainfall' ? (
        <RainfallSection
          current={current}
          forecast={forecast}
          rainfallLabel={rainfallLabel}
          rainStatus={rainStatus}
        />
      ) : null}

      {section === 'rivers' ? (
        <RiversSection
          context={context}
          current={current}
          forecast={forecast}
          levelStatus={levelStatus}
          rainfallLabel={rainfallLabel}
          stations={riverStations}
        />
      ) : null}

      {section === 'dams' ? <DamsSection current={current} /> : null}
      {section === 'stations' ? <StationsSection context={context} /> : null}
    </>
  );
}

function DataFreshnessBar({
  status,
  updatedAt,
  warning,
  isLoading,
}: {
  status: DashboardDataStatus;
  updatedAt: string | null;
  warning: string | null;
  isLoading: boolean;
}) {
  const palette = status === 'live'
    ? { background: colors.safeSoft, border: colors.safe, text: colors.safe, dot: colors.safe, label: 'Atualizado' }
    : status === 'historical'
      ? { background: colors.warningSoft, border: colors.warning, text: colors.text, dot: colors.warning, label: 'Historico' }
      : { background: colors.infoSoft, border: colors.info, text: colors.institutionalBlue, dot: colors.info, label: status === 'local' ? 'Cache local' : 'Snapshot' };

  return (
    <View style={[styles.freshnessBar, { backgroundColor: palette.background, borderColor: palette.border }]}>
      {isLoading ? <ActivityIndicator color={palette.dot} size="small" /> : <View style={[styles.freshnessDot, { backgroundColor: palette.dot }]} />}
      <View style={styles.freshnessCopy}>
        <Text style={[styles.freshnessTitle, { color: palette.text }]}>
          {isLoading ? 'Atualizando em segundo plano' : palette.label}
          {updatedAt ? ` - ${formatMeasuredAt(updatedAt)}` : ''}
        </Text>
        {warning ? <Text style={[styles.freshnessWarning, { color: palette.text }]} numberOfLines={2}>{warning}</Text> : null}
      </View>
    </View>
  );
}

function ObservationPeriodBar({
  value,
  onChange,
}: {
  value: RainfallWindowHours;
  onChange: (hours: RainfallWindowHours) => void;
}) {
  return (
    <View style={styles.sectionToolbar}>
      <View style={styles.periodCopy}>
        <Text style={styles.cardTitle}>Periodo observado</Text>
        <Text style={styles.cardSub}>
          Atualiza acumulados e graficos historicos. Leituras atuais e previsao mantem seus proprios horarios.
        </Text>
      </View>
      <RainfallWindowSelector value={value} onChange={onChange} />
    </View>
  );
}

function SectionHero({ section, onRefresh }: { section: AdminSection; onRefresh: () => void }) {
  const content: Record<Exclude<AdminSection, 'admin' | 'ana'>, { title: string; text: string }> = {
    dashboard: { title: 'Panorama hidrologico de Mucum', text: 'Indicadores essenciais da sub-bacia 86 em uma leitura rapida.' },
    monitoring: { title: 'Monitoramento operacional', text: 'Acompanhe sinais de chuva, nivel, vazao e integracoes em tempo real.' },
    projection: { title: 'Projecao hidrologica', text: 'Cenarios de nivel e vazao para Mucum, com pico, cotas operacionais e confianca por horizonte.' },
    contingency: { title: 'Plano de contingencia', text: 'Gatilhos oficiais, acoes minimas, rotas, alojamentos e referencias historicas para apoiar a operacao municipal.' },
    rainfall: { title: 'Chuvas na bacia Taquari-Antas', text: 'Acumulados observados, distribuicao regional e previsao para os proximos dias.' },
    rivers: { title: 'Rios e vazao', text: 'Evolucao do nivel e da vazao nas estacoes que influenciam Mucum.' },
    dams: { title: 'Barragens a montante', text: 'Compare entrada, saida e nivel dos reservatorios acima de Mucum.' },
    stations: { title: 'Rede de estacoes', text: 'Inventario segmentado das estacoes de chuva, nivel, vazao e telemetria.' },
  };
  const selected = content[section as Exclude<AdminSection, 'admin' | 'ana'>] ?? content.dashboard;

  return (
    <View style={styles.heroPanel}>
      <View style={styles.heroCopy}>
        <Text style={styles.kicker}>Mucum / Rio Taquari</Text>
        <Text style={styles.heroTitle}>{selected.title}</Text>
        <Text style={styles.heroText}>{selected.text}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onRefresh} style={styles.heroAction}>
        <RefreshCcw color={colors.institutionalBlue} size={18} />
        <Text style={styles.heroActionText}>Atualizar</Text>
      </Pressable>
    </View>
  );
}

function DashboardSection({
  context, current, forecast, rainfallLabel, rainStatus, levelStatus,
}: {
  context: MucumContext;
  current: MucumCurrentData | null;
  forecast: MucumForecastData | null;
  rainfallLabel: string;
  rainStatus: AlertLevel;
  levelStatus: AlertLevel;
}) {
  return (
    <>
      <View style={styles.kpiGrid}>
        <KpiCard label={`Chuva ${rainfallLabel}`} value={formatNullable(current?.rainfall.accumulatedMm ?? current?.rainfall.currentMm, '')} unit="mm" icon={CloudRain} accent={rainStatus === 'critical' ? 'red' : rainStatus === 'warning' ? 'amber' : 'blue'} trend="acumulado na bacia" />
        <KpiCard label="Nivel Mucum" value={formatNullable(current?.river.currentLevelM, '')} unit="m" icon={Waves} accent={levelStatus === 'critical' ? 'red' : levelStatus === 'warning' ? 'amber' : 'green'} trend={levelStatusLabel(levelStatus)} />
        <KpiCard label="Vazao atual" value={formatNullable(current?.river.currentFlowM3s, '')} unit="m3/s" icon={Droplets} accent="blue" trend="Rio Taquari" />
        <KpiCard label="Previsao 24h" value={formatNullable(forecast?.basin.next24hMm, '')} unit="mm" icon={CloudRain} accent="amber" trend="maior ponto da bacia" />
        <KpiCard label="Estacoes" value={String(context.counts.stationsInSubBasin)} icon={RadioTower} accent="dark" trend="sub-bacia 86" />
        <KpiCard label="Barragens" value={String(current?.source.damsFromSupabase ?? 0)} icon={Database} accent="dark" trend="monitoradas" />
      </View>
      <ChartPanel title="Chuva x nivel do rio" subtitle={`Serie observada em ${rainfallLabel}`} live>
        <HydroComparisonChart current={current} />
      </ChartPanel>
    </>
  );
}

function MonitoringSection({
  current, forecast, isLoading, rainfallLabel, rainStatus, levelStatus,
}: {
  current: MucumCurrentData | null;
  forecast: MucumForecastData | null;
  isLoading: boolean;
  rainfallLabel: string;
  rainStatus: AlertLevel;
  levelStatus: AlertLevel;
}) {
  return (
    <>
      <CurrentDataPanel current={current} rainfallLabel={rainfallLabel} rainStatus={rainStatus} levelStatus={levelStatus} />
      <ChartPanel title="Comportamento hidrologico" subtitle={`Chuva, nivel e vazao observados em ${rainfallLabel}`} live>
        <HydroComparisonChart current={current} />
      </ChartPanel>
      <AdminStatusPanel current={current} forecast={forecast} isLoading={isLoading} rainfallLabel={rainfallLabel} />
    </>
  );
}

function ProjectionSection({ projection, isLoading }: { projection: MucumProjectionData | null; isLoading: boolean }) {
  if (!projection) {
    return (
      <View style={styles.loadingPanel}>
        <ActivityIndicator color={colors.mucumBlue} />
        <View style={styles.loadingCopy}>
          <Text style={styles.cardTitle}>{isLoading ? 'Calculando cenarios' : 'Projecao indisponivel'}</Text>
          <Text style={styles.resultSubtitle}>Aguardando nivel e vazao de Mucum, UHE 14 de Julho, chuva ensemble e sinal GloFAS.</Text>
        </View>
      </View>
    );
  }

  const peak = projection.peaks.likely;
  const operationalEstimate = projection.operationalEstimate ?? {
    levelM: peak.levelM,
    lowerLevelM: projection.peaks.minimum.levelM,
    upperLevelM: projection.peaks.maximum.levelM,
    at: peak.at,
    hour: peak.hour,
    confidencePct: peak.confidencePct,
    confidenceLabel: peak.confidencePct >= 75 ? 'alta' : peak.confidencePct >= 50 ? 'media' : 'baixa',
    basis: 'Cenario provavel da rodada.',
  };
  const forecastRain = projection.drivers.forecastRain72hMm;
  const marauRain = projection.drivers.localCriticalRain72hMm;
  const confidenceAccent = projection.confidence.overallPct >= 75 ? 'green' : projection.confidence.overallPct >= 50 ? 'amber' : 'red';

  return (
    <>
      <View style={styles.projectionNotice}>
        <Gauge color={colors.institutionalBlue} size={20} />
        <View style={styles.projectionNoticeCopy}>
          <Text style={styles.cardTitle}>Apoio a decisao, nao boletim oficial</Text>
          <Text style={styles.cardSub}>{projection.model.disclaimer}</Text>
        </View>
        <Text style={styles.modelVersion}>v{projection.model.version}</Text>
      </View>

      <View style={styles.kpiGrid}>
        <KpiCard label="Nivel atual" value={formatNullable(projection.current.levelM, '')} unit="m" icon={Waves} accent={projectionStatusAccent(projection.current.status)} trend={projectionStatusLabel(projection.current.status)} />
        <KpiCard label="Estimativa operacional" value={formatNullable(operationalEstimate.levelM, '')} unit="m" icon={TrendingUp} accent={projectionStatusAccent(peak.status)} trend={`${operationalEstimate.hour}h - ${formatForecastTime(operationalEstimate.at)}`} />
        <KpiCard label="Faixa dos cenarios no pico" value={`${operationalEstimate.lowerLevelM} a ${operationalEstimate.upperLevelM}`} unit="m" icon={Gauge} accent={confidenceAccent} trend={`${operationalEstimate.confidencePct}% de confianca`} />
        <KpiCard label="Confianca curto prazo" value={String(projection.confidence.overallPct)} unit="%" icon={Gauge} accent={confidenceAccent} trend={`${projection.model.officialLeadHours ?? 6} horas`} />
        <KpiCard label="Chuva prevista 72h" value={formatNullable(forecastRain.likely, '')} unit="mm" icon={CloudRain} accent="blue" trend={`${forecastRain.minimum} a ${forecastRain.maximum} mm`} />
        <KpiCard label="Marau / Guapore 72h" value={formatNullable(marauRain?.likely, '')} unit="mm" icon={CloudRain} accent="amber" trend={marauRain ? `${marauRain.minimum} a ${marauRain.maximum} mm` : 'sinal local indisponivel'} />
      </View>

      <View style={styles.projectionAlerts}>
        {projection.alerts.map((alert) => (
          <ProjectionAlert key={`${alert.title}-${alert.detail}`} severity={alert.severity} title={alert.title} detail={alert.detail} />
        ))}
      </View>

      <ChartPanel
        title="Nivel projetado em Mucum"
        subtitle="Faixa minima, provavel e maxima; linhas horizontais representam as cotas oficiais de atencao, alerta e inundacao"
      >
        <ProjectionLevelChart projection={projection} />
      </ChartPanel>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderCopy}>
            <Text style={styles.cardTitle}>Subida prevista hora a hora</Text>
            <Text style={styles.cardSub}>Variacao do nivel provavel em relacao a hora anterior.</Text>
          </View>
          <TrendingUp color={colors.mucumBlue} size={19} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.hourlyProjectionTable}>
            <View style={[styles.hourlyProjectionRow, styles.thresholdHeader]}>
              <Text style={[styles.hourlyProjectionCell, styles.hourlyProjectionHour]}>Hora</Text>
              <Text style={styles.hourlyProjectionCell}>Nivel provavel</Text>
              <Text style={styles.hourlyProjectionCell}>Sobe/desce</Text>
              <Text style={styles.hourlyProjectionCell}>Faixa min-max</Text>
            </View>
            {projection.timeline.map((point) => (
              <View key={point.hour} style={styles.hourlyProjectionRow}>
                <Text style={[styles.hourlyProjectionCell, styles.hourlyProjectionHour]}>{point.hour === 0 ? 'Agora' : `+${point.hour}h`}</Text>
                <Text style={styles.hourlyProjectionCell}>{formatNullable(point.likelyLevelM, ' m')}</Text>
                <Text style={[styles.hourlyProjectionCell, hourlyDeltaStyle(point.likelyLevelDeltaM)]}>{formatHourlyDelta(point.likelyLevelDeltaM)}</Text>
                <Text style={styles.hourlyProjectionCell}>{point.minimumLevelM} - {point.maximumLevelM} m</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={styles.operationalEstimateNote}>
        <View style={styles.cardHeaderCopy}>
          <Text style={styles.cardTitle}>Ponto mais provavel desta rodada</Text>
          <Text style={styles.cardSub}>{operationalEstimate.basis} O valor central e a melhor estimativa disponivel, mas deve ser lido junto da faixa de cenarios {operationalEstimate.lowerLevelM} a {operationalEstimate.upperLevelM} m.</Text>
        </View>
      </View>

      <View style={styles.chartGrid}>
        <ChartPanel title="Chuva acumulada dos cenarios" subtitle={`P10, mediana e P90 de ${projection.drivers.ensembleMembers} membros meteorologicos`} compact>
          <ProjectionRainChart projection={projection} />
        </ChartPanel>
        <View style={[styles.projectionConfidencePanel, styles.chartGridCard]}>
          <View style={styles.cardHeaderCopy}>
            <Text style={styles.cardTitle}>Confianca da rodada</Text>
            <Text style={styles.cardSub}>A confianca diminui conforme o horizonte e a ausencia de dados.</Text>
          </View>
          <ConfidenceRow label="Curto prazo" value={projection.confidence.shortTermPct ?? 0} />
          <ConfidenceRow label="Proximas 24h" value={projection.confidence.next24hPct ?? 0} />
          <ConfidenceRow label="Proximas 72h" value={projection.confidence.next72hPct ?? 0} />
          <View style={styles.confidenceDivider} />
          <ConfidenceRow label="Atualidade dos dados" value={projection.confidence.components.freshnessPct} compact />
          <ConfidenceRow label="Entradas hidrologicas" value={projection.confidence.components.hydrologyInputsPct} compact />
          <ConfidenceRow label="Ensemble meteorologico" value={projection.confidence.components.meteorologyPct} compact />
          <ConfidenceRow label="Cobertura da bacia" value={projection.confidence.components.basinCoveragePct} compact />
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderCopy}>
            <Text style={styles.cardTitle}>Horizontes operacionais</Text>
            <Text style={styles.cardSub}>Leituras pontuais dos tres cenarios e confianca naquele horario.</Text>
          </View>
          <Clock color={colors.mucumBlue} size={19} />
        </View>
        <View style={styles.projectionHorizonGrid}>
          {projection.horizons.map((point) => (
            <View key={point.hour} style={styles.projectionHorizonCell}>
              <Text style={styles.horizonHour}>+{point.hour}h</Text>
              <Text style={styles.horizonLikely}>{formatNullable(point.likelyLevelM, ' m')}</Text>
              <Text style={[styles.horizonDelta, hourlyDeltaStyle(point.likelyLevelDeltaM)]}>{formatHourlyDelta(point.likelyLevelDeltaM)}</Text>
              <Text style={styles.horizonRange}>{point.minimumLevelM} - {point.maximumLevelM} m</Text>
              <Text style={styles.horizonConfidence}>{point.confidencePct}% confianca</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderCopy}>
            <Text style={styles.cardTitle}>Cruzamento das cotas de Mucum</Text>
            <Text style={styles.cardSub}>Horario inicial estimado por faixa; um traco indica que o nivel nao foi alcancado em 72h.</Text>
          </View>
        </View>
        <View style={styles.thresholdTable}>
          <View style={[styles.thresholdRow, styles.thresholdHeader]}>
            <Text style={[styles.thresholdCell, styles.thresholdName]}>Cota</Text>
            <Text style={styles.thresholdCell}>Minimo</Text>
            <Text style={styles.thresholdCell}>Provavel</Text>
            <Text style={styles.thresholdCell}>Maximo</Text>
          </View>
          {projection.thresholdCrossings.map((crossing) => (
            <View key={crossing.key} style={styles.thresholdRow}>
              <Text style={[styles.thresholdCell, styles.thresholdName]}>{crossing.label} {crossing.levelM} m</Text>
              <Text style={styles.thresholdCell}>{formatCrossing(crossing.minimumAt)}</Text>
              <Text style={styles.thresholdCell}>{formatCrossing(crossing.likelyAt)}</Text>
              <Text style={styles.thresholdCell}>{formatCrossing(crossing.maximumAt)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.methodPanel}>
        <Text style={styles.cardTitle}>Como esta rodada foi calculada</Text>
        <Text style={styles.methodText}>
          {projection.model.officialVariant
            ? `${projection.model.officialVariant}: ${projection.model.officialEquation}. `
            : 'Sem entradas suficientes para aplicar a equacao oficial nesta rodada. '}
          Depois do curto prazo, os cenarios combinam chuva ponderada na area de 16.000 km2, propagacao conceitual, curva-chave de Mucum e GloFAS com peso reduzido.
        </Text>
        <View style={styles.tagRow}>
          <Text style={styles.dataTag}>{projection.drivers.glofasAvailable ? 'GloFAS ativo' : 'GloFAS indisponivel'}</Text>
          <Text style={styles.dataTag}>{projection.drivers.ensembleMembers} membros</Text>
          <Text style={styles.dataTag}>{projection.drivers.basinRainCoveragePct}% da bacia</Text>
          <Text style={styles.dataTag}>Marau/Guapore {projection.drivers.localCriticalRainCoveragePct ?? 0}%</Text>
          <Text style={styles.dataTag}>{projection.drivers.availableUpstreamSignals ?? 0}/4 sinais de afluentes</Text>
        </View>
      </View>
    </>
  );
}

function ProjectionAlert({ severity, title, detail }: { severity: ProjectionSeverity; title: string; detail: string }) {
  const palette = projectionSeverityPalette(severity);
  return (
    <View style={[styles.projectionAlert, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <View style={[styles.projectionAlertDot, { backgroundColor: palette.border }]} />
      <View style={styles.projectionAlertCopy}>
        <Text style={[styles.projectionAlertTitle, { color: palette.text }]}>{title}</Text>
        <Text style={styles.projectionAlertDetail}>{detail}</Text>
      </View>
    </View>
  );
}

function ConfidenceRow({ label, value, compact = false }: { label: string; value: number; compact?: boolean }) {
  const color = value >= 75 ? colors.safe : value >= 50 ? colors.warning : colors.danger;
  return (
    <View style={[styles.confidenceRow, compact && styles.confidenceRowCompact]}>
      <View style={styles.confidenceLabelRow}>
        <Text style={styles.confidenceLabel}>{label}</Text>
        <Text style={[styles.confidenceValue, { color }]}>{value}%</Text>
      </View>
      <View style={styles.confidenceTrack}>
        <View style={[styles.confidenceFill, { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function RainfallSection({
  current, forecast, rainfallLabel, rainStatus,
}: {
  current: MucumCurrentData | null;
  forecast: MucumForecastData | null;
  rainfallLabel: string;
  rainStatus: AlertLevel;
}) {
  const availableCities = useMemo(() => getRainfallCities(current, forecast), [current, forecast]);
  const [selectedCities, setSelectedCities] = useState<string[]>(priorityRainfallCities);

  useEffect(() => {
    if (!availableCities.length) return;
    setSelectedCities((previous) => {
      const availableSelection = previous.filter((selected) => (
        availableCities.some((city) => cityNamesMatch(city, selected))
      ));
      if (availableSelection.length) return availableSelection;
      const priorities = priorityRainfallCities.filter((priority) => (
        availableCities.some((city) => cityNamesMatch(city, priority))
      ));
      return priorities.length ? priorities : availableCities.slice(0, 3);
    });
  }, [availableCities]);

  const toggleCity = (city: string) => {
    setSelectedCities((previous) => (
      previous.some((selected) => cityNamesMatch(selected, city))
        ? previous.filter((selected) => !cityNamesMatch(selected, city))
        : [...previous, city]
    ));
  };

  const selectPriorityCities = () => {
    setSelectedCities(priorityRainfallCities.filter((priority) => (
      availableCities.some((city) => cityNamesMatch(city, priority))
    )));
  };

  const orderedCities = availableCities.slice().sort((left, right) => {
    const leftSelected = selectedCities.some((city) => cityNamesMatch(city, left));
    const rightSelected = selectedCities.some((city) => cityNamesMatch(city, right));
    if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
    return left.localeCompare(right, 'pt-BR');
  });

  return (
    <>
      <View style={styles.kpiGrid}>
        <KpiCard label={`Acumulado ${rainfallLabel}`} value={formatNullable(current?.rainfall.accumulatedMm ?? current?.rainfall.currentMm, '')} unit="mm" icon={CloudRain} accent={rainStatus === 'critical' ? 'red' : rainStatus === 'warning' ? 'amber' : 'blue'} trend={current?.rainfall.stationName ?? 'Mucum'} />
        <KpiCard label="Maximo a montante" value={formatNullable(current?.regionalRainfall.maxMm, '')} unit="mm" icon={CloudRain} accent="amber" trend={`${current?.regionalRainfall.withRainCount ?? 0} cidades com leitura`} />
        <KpiCard label="Media a montante" value={formatNullable(current?.regionalRainfall.avgMm, '')} unit="mm" icon={CloudRain} accent="green" trend="cabeceiras e afluentes" />
        <KpiCard label="Previsao 72h" value={formatNullable(forecast?.basin.next72hMm, '')} unit="mm" icon={CloudRain} accent="blue" trend={forecast?.basin.peakPointName ?? 'bacia'} />
      </View>
      <UpstreamScopeBar current={current} />
      <UpstreamCityRainfallPanel current={current} rainfallLabel={rainfallLabel} />
      <MucumContributorsPanel
        current={current}
        forecast={forecast}
        rainfallLabel={rainfallLabel}
        selectedCities={selectedCities}
        onToggleCity={toggleCity}
      />
      <View style={styles.chartGrid}>
        <ChartPanel title={`Cidades a montante - ${rainfallLabel}`} subtitle="Acumulado da melhor estacao ativa de cada municipio que drena para Mucum" live compact>
          <RegionalRainfallChart current={current} />
        </ChartPanel>
        <ChartPanel title="Picos diarios regionais" subtitle="Maior volume diario e cidade correspondente" live compact>
          <RegionalRainfallPeaksChart current={current} />
        </ChartPanel>
      </View>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderCopy}>
            <Text style={styles.cardTitle}>Cidades no comparativo</Text>
            <Text style={styles.cardSub}>{selectedCities.length} selecionada{selectedCities.length === 1 ? '' : 's'}</Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.citySelectionActions}>
            <Pressable accessibilityRole="button" onPress={selectPriorityCities} style={({ pressed }) => [styles.selectionAction, pressed && styles.pressed]}>
              <Text style={styles.selectionActionText}>Prioritarias</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setSelectedCities([])} style={({ pressed }) => [styles.selectionAction, pressed && styles.pressed]}>
              <Text style={styles.selectionActionText}>Limpar</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.citySelector}>
            {orderedCities.map((city) => {
              const selected = selectedCities.some((selectedCity) => cityNamesMatch(city, selectedCity));
              return (
                <Pressable
                  key={city}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => toggleCity(city)}
                  style={({ pressed }) => [styles.cityOption, selected && styles.cityOptionSelected, pressed && styles.pressed]}
                >
                  {selected ? <Check color={colors.surface} size={15} /> : null}
                  <Text style={[styles.cityOptionText, selected && styles.cityOptionTextSelected]}>{city}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.selectedCityGrid}>
            {selectedCities.map((city) => {
              const observed = current?.regionalRainfall.cities?.find((item) => cityNamesMatch(item.city, city));
              const predicted = forecast?.points.find((point) => cityNamesMatch(point.name, city));
              return (
                <SelectedCityRainSummary
                  key={city}
                  city={city}
                  rainfallLabel={rainfallLabel}
                  observedMm={observed?.rainfallMm ?? null}
                  maxDailyMm={observed?.maxDailyMm ?? null}
                  forecast24hMm={predicted?.next24hMm ?? null}
                  forecast72hMm={predicted?.next72hMm ?? null}
                />
              );
            })}
            {!selectedCities.length ? <Text style={styles.emptyText}>Selecione uma ou mais cidades para comparar.</Text> : null}
          </View>
        </View>
      </View>
      <ChartPanel title="Chuva observada x prevista por cidade" subtitle={`Acumulado ${rainfallLabel} e previsao para as proximas 72h`}>
        <CityRainfallDetailChart current={current} forecast={forecast} cities={selectedCities} observedLabel={rainfallLabel} />
      </ChartPanel>
      <ChartPanel title="Previsao futura regional - proximas 24h" subtitle="Maior chuva horaria prevista entre os pontos monitorados">
        <ForecastRainChart forecast={forecast} />
      </ChartPanel>
      <ForecastPanel forecast={forecast} />
      <RegionalRainPanel current={current} rainfallLabel={rainfallLabel} />
    </>
  );
}

function RiversSection({
  context, current, forecast, levelStatus, rainfallLabel, stations,
}: {
  context: MucumContext;
  current: MucumCurrentData | null;
  forecast: MucumForecastData | null;
  levelStatus: AlertLevel;
  rainfallLabel: string;
  stations: MucumStationSummary[];
}) {
  const monitoredRivers = countMonitoredRivers(current);
  const upstreamRivers = current?.regionalRainfall.scope?.rivers.length ?? 0;

  return (
    <>
      <View style={styles.kpiGrid}>
        <KpiCard label="Nivel atual" value={formatNullable(current?.river.currentLevelM, '')} unit="m" icon={Waves} accent={levelStatus === 'critical' ? 'red' : levelStatus === 'warning' ? 'amber' : 'green'} trend={current?.river.levelStationName ?? 'Mucum'} />
        <KpiCard label="Vazao atual" value={formatNullable(current?.river.currentFlowM3s, '')} unit="m3/s" icon={Droplets} accent="blue" trend={current?.river.flowStationName ?? 'Rio Taquari'} />
        <KpiCard label="Rios no escopo" value={String(upstreamRivers)} icon={Waves} accent="dark" trend="acima da estacao Mucum" />
        <KpiCard label="Rios com leitura" value={String(monitoredRivers)} icon={RadioTower} accent="dark" trend="series disponiveis agora" />
      </View>
      <UpstreamScopeBar current={current} />
      <MucumContributorsPanel current={current} forecast={forecast} rainfallLabel={rainfallLabel} compact />
      <ChartPanel title="Visao geral dos rios a montante" subtitle={`Nivel observado em ${rainfallLabel}; cada cor da legenda representa um rio`} live>
        <RiverTrendChart current={current} />
      </ChartPanel>
      <RiversPanel context={context} />
      <StationsPanel section="rivers" stations={stations.slice(0, 20)} />
    </>
  );
}

function DamsSection({ current }: { current: MucumCurrentData | null }) {
  const dams = current?.dams ?? [];
  return (
    <>
      <View style={styles.kpiGrid}>
        <KpiCard label="Barragens" value={String(dams.length)} icon={Database} accent="dark" trend="a montante" />
        <KpiCard label="Entrada somada" value={formatNullable(sumValues(dams.map((dam) => dam.inflow_m3s)), '')} unit="m3/s" icon={Droplets} accent="blue" trend="leituras disponiveis" />
        <KpiCard label="Saida somada" value={formatNullable(sumValues(dams.map((dam) => dam.outflow_m3s)), '')} unit="m3/s" icon={Droplets} accent="green" trend="leituras disponiveis" />
        <KpiCard label="Maior reservatorio" value={formatNullable(maxValue(dams.map((dam) => dam.reservoir_level_m)), '')} unit="m" icon={Database} accent="amber" trend="nivel informado" />
      </View>
      <ChartPanel title="Entrada, saida e reservatorio" subtitle="Comparativo das UHEs monitoradas acima de Mucum" live>
        <DamsFlowChart current={current} />
      </ChartPanel>
      <DamsPanel current={current} />
    </>
  );
}

function StationsSection({ context }: { context: MucumContext }) {
  return (
    <>
      <View style={styles.kpiGrid}>
        <KpiCard label="Total relevante" value={String(context.counts.stationsInSubBasin)} icon={RadioTower} accent="dark" trend="sub-bacia 86" />
        <KpiCard label="Telemetricas" value={String(context.counts.telemetry)} icon={RadioTower} accent="green" trend="consulta automatica" />
        <KpiCard label="Chuva" value={String(context.counts.rainfall)} icon={CloudRain} accent="blue" trend="pluviometricas" />
        <KpiCard label="Nivel" value={String(context.counts.level)} icon={Waves} accent="amber" trend="fluviometricas" />
      </View>
      <StationsPanel section="stations" stations={context.stations.allRelevant.slice(0, 30)} />
    </>
  );
}

function CurrentDataPanel({
  current, rainfallLabel, rainStatus, levelStatus,
}: {
  current: MucumCurrentData | null;
  rainfallLabel: string;
  rainStatus: AlertLevel;
  levelStatus: AlertLevel;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>Dados atuais</Text>
          <Text style={styles.cardSub}>Ultima leitura agregada das estacoes telemetricas</Text>
        </View>
        <LiveBadge />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.currentGrid}>
          <CurrentDataCard icon={CloudRain} label={`Chuva ${rainfallLabel}`} value={formatNullable(current?.rainfall.accumulatedMm ?? current?.rainfall.currentMm, ' mm')} meta={`${current?.rainfall.stationName ?? 'Sem estacao'} ${formatMeasuredAt(current?.rainfall.measuredAt)}`} alertLevel={rainStatus} />
          <CurrentDataCard icon={Waves} label="Nivel" value={formatNullable(current?.river.currentLevelM, ' m')} meta={`${current?.river.levelStationName ?? 'Sem estacao'} ${formatMeasuredAt(current?.river.levelMeasuredAt)}`} alertLevel={levelStatus} />
          <CurrentDataCard icon={Droplets} label="Vazao" value={formatNullable(current?.river.currentFlowM3s, ' m3/s')} meta={`${current?.river.flowStationName ?? 'Sem estacao'} ${formatMeasuredAt(current?.river.flowMeasuredAt)}`} />
        </View>
      </View>
    </View>
  );
}

function UpstreamScopeBar({ current }: { current: MucumCurrentData | null }) {
  const scope = current?.regionalRainfall.scope;
  const rivers = scope?.rivers ?? mucumContributorCatalog.contributors.map((contributor) => contributor.name);

  return (
    <View style={[styles.sectionToolbar, styles.scopeToolbar]}>
      <View style={styles.periodCopy}>
        <Text style={styles.cardTitle}>Area de influencia de Mucum</Text>
        <Text style={styles.cardSub}>Montante, drenagem local e Guapore separado do contexto a jusante da estacao {scope?.outletStationCode ?? '86510000'}</Text>
      </View>
      <View style={[styles.tagRow, styles.scopeTagRow]}>
        {rivers.map((river) => <Text key={river} style={styles.dataTag}>{river}</Text>)}
      </View>
    </View>
  );
}

function RainfallWindowSelector({ value, onChange }: { value: RainfallWindowHours; onChange: (hours: RainfallWindowHours) => void }) {
  return (
    <View style={styles.segmentWrap}>
      {rainfallWindowOptions.map((option) => (
        <Pressable
          key={option.hours}
          accessibilityRole="button"
          onPress={() => onChange(option.hours)}
          style={({ pressed }) => [styles.segmentCompact, value === option.hours && styles.segmentSelected, pressed && styles.pressed]}
        >
          <Text style={[styles.segmentText, value === option.hours && styles.segmentTextSelected]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ChartPanel({
  title, subtitle, live = false, compact = false, children,
}: {
  title: string;
  subtitle: string;
  live?: boolean;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.card, compact && styles.chartGridCard]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderCopy}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSub}>{subtitle}</Text>
        </View>
        {live ? <LiveBadge /> : null}
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function ForecastPanel({ forecast }: { forecast: MucumForecastData | null }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>Previsao futura de chuva</Text>
          <Text style={styles.cardSub}>Nao e alterada pelo periodo observado</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        {forecast ? (
          <>
            <View style={styles.currentGrid}>
              <MiniReading label="Prox. 6h" value={formatNullable(forecast.basin.next6hMm, ' mm')} />
              <MiniReading label="Prox. 24h" value={formatNullable(forecast.basin.next24hMm, ' mm')} />
              <MiniReading label="Prox. 72h" value={formatNullable(forecast.basin.next72hMm, ' mm')} />
              <MiniReading label="Prox. 7d" value={formatNullable(forecast.basin.next7dMm, ' mm')} />
            </View>
            <Text style={styles.resultSubtitle}>
              Pico previsto: {formatNullable(forecast.basin.peakHourMm, ' mm/h')} em {forecast.basin.peakPointName ?? '-'} {formatForecastTime(forecast.basin.peakHourAt)}.
            </Text>
            <View style={styles.stationList}>
              {forecast.points
                .filter((point) => point.role !== 'jusante_contexto')
                .slice()
                .sort((left, right) => right.next72hMm - left.next72hMm)
                .slice(0, 5)
                .map((point) => (
                  <ForecastPointCard key={point.key} point={point} />
                ))}
            </View>
          </>
        ) : (
          <Text style={styles.emptyText}>Previsao ainda nao carregada.</Text>
        )}
      </View>
    </View>
  );
}

function RegionalRainPanel({ current, rainfallLabel }: { current: MucumCurrentData | null; rainfallLabel: string }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>Chuva nas cabeceiras e cidades a montante - {rainfallLabel}</Text>
          <Text style={styles.cardSub}>
            Pontos que drenam para a estacao Mucum 86510000 - Atualizado {formatMeasuredAt(current?.regionalRainfall.lastMeasuredAt) || '-'}
          </Text>
        </View>
        <LiveBadge />
      </View>
      <View style={styles.cardBody}>
        {current?.regionalRainfall.stations.length ? (
          <View style={styles.stationList}>
            {current.regionalRainfall.stations.map((station) => (
              <RainStationCard key={`${station.stationCode}-${station.source}`} station={station} />
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>
            Nenhuma leitura regional de chuva encontrada agora. Atualize ou confira a consulta livre da ANA.
          </Text>
        )}
      </View>
    </View>
  );
}

function DamsPanel({ current }: { current: MucumCurrentData | null }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>Barragens a montante</Text>
          <Text style={styles.cardSub}>Leituras do Supabase</Text>
        </View>
        <Database color={colors.mucumBlue} size={18} />
      </View>
      <View style={styles.cardBody}>
        {current?.dams.length ? (
          <View style={styles.stationList}>
            {current.dams.map((dam) => (
              <View key={dam.dam_id} style={styles.damCard}>
                <View style={styles.stationCardTop}>
                  <View style={styles.stationIcon}>
                    <Database color={colors.mucumBlue} size={18} />
                  </View>
                  <View style={styles.stationInfo}>
                    <Text style={styles.stationName}>{dam.dam_name}</Text>
                    <Text style={styles.stationMeta}>{dam.river_name ?? 'Rio nao informado'} - {dam.operator_name ?? 'Operador nao informado'}</Text>
                  </View>
                  <Text style={styles.stationCode}>{formatMeasuredAt(dam.measured_at)}</Text>
                </View>
                <View style={styles.currentGrid}>
                  <MiniReading label="Entrada" value={formatNullable(dam.inflow_m3s, ' m3/s')} />
                  <MiniReading label="Saida" value={formatNullable(dam.outflow_m3s, ' m3/s')} />
                  <MiniReading label="Reservatorio" value={formatNullable(dam.reservoir_level_m, ' m')} />
                  <MiniReading label="Vertedouro" value={dam.spillway_status ?? '-'} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>Nenhuma barragem ativa com leitura cadastrada.</Text>
        )}
      </View>
    </View>
  );
}

function RiversPanel({ context }: { context: MucumContext }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>Rios cadastrados na bacia</Text>
          <Text style={styles.cardSub}>Visao geral ANA; o grafico considera somente series que chegam a Mucum</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.riverGrid}>
          {context.rivers.map((river) => (
            <View key={String(river.codigorio)} style={styles.riverChip}>
              <Text style={styles.riverName}>{String(river.Nome_Rio ?? '-')}</Text>
              <Text style={styles.riverCode}>{String(river.codigorio ?? '')}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function StationsPanel({ section, stations }: { section: AdminSection; stations: MucumStationSummary[] }) {
  const title = section === 'monitoring'
    ? 'Estacoes para monitoramento'
    : section === 'rivers'
      ? 'Estacoes de nivel e vazao'
      : section === 'stations'
        ? 'Estacoes relevantes da bacia'
        : 'Estacoes relevantes';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSub}>{section === 'rivers' ? 'Pontos a montante primeiro; estacoes a jusante permanecem como contexto' : 'Priorizadas por operacao, telemetria e relevancia para Taquari-Antas'}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.stationList}>
          {stations.map((station) => (
            <StationCard key={`${station.code}-${station.name}`} station={station} />
          ))}
        </View>
      </View>
    </View>
  );
}

function KpiCard({
  label, value, unit, icon: Icon, accent, trend,
}: {
  label: string; value: string; unit?: string;
  icon: typeof Database; accent: keyof typeof KPI_ACCENTS; trend?: string;
}) {
  const colors = KPI_ACCENTS[accent];
  return (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiAccent, { backgroundColor: colors.accent }]} />
      <View style={[styles.kpiIconBox, { backgroundColor: colors.iconBg }]}>
        <Icon color={colors.iconColor} size={16} />
      </View>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>
        {value}
        {unit ? <Text style={styles.kpiUnit}> {unit}</Text> : null}
      </Text>
      {trend ? <Text style={styles.kpiTrend}>{trend}</Text> : null}
    </View>
  );
}

function CurrentDataCard({
  icon: Icon, label, value, meta, alertLevel,
}: {
  icon: typeof Database; label: string; value: string; meta: string; alertLevel?: AlertLevel;
}) {
  const c = alertLevel ? alertPalette(alertLevel) : alertPalette('normal');
  return (
    <View style={[
      styles.currentCard,
      alertLevel && alertLevel !== 'normal' && { borderColor: c.accent, borderWidth: 1.5 },
    ]}>
      <View style={[styles.stationIcon, { backgroundColor: c.iconBg }]}>
        <Icon color={c.iconColor} size={18} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.currentValue, alertLevel && alertLevel !== 'normal' && { color: c.iconColor }]}>{value}</Text>
      <Text style={styles.currentMeta} numberOfLines={2}>{meta}</Text>
      {alertLevel && alertLevel !== 'normal' ? (
        <StatusBadge level={alertLevel} label={alertLevel === 'critical' ? 'CRITICO' : 'ALERTA'} />
      ) : null}
    </View>
  );
}

function AdminStatusPanel({
  current, forecast, isLoading, rainfallLabel,
}: {
  current: MucumCurrentData | null;
  forecast: MucumForecastData | null;
  isLoading: boolean;
  rainfallLabel: string;
}) {
  const warnings = current?.source.warnings ?? [];
  return (
    <View style={styles.adminPanel}>
      <View style={styles.resultHeader}>
        <View>
          <Text style={styles.cardTitle}>Painel administrativo</Text>
          <Text style={styles.resultSubtitle}>Status das integracoes e do periodo operacional selecionado.</Text>
        </View>
        {isLoading ? <ActivityIndicator color={colors.mucumBlue} /> : <Database color={colors.mucumBlue} size={22} />}
      </View>
      <View style={styles.currentGrid}>
        <MiniReading label="Periodo chuva" value={rainfallLabel} />
        <MiniReading label="ANA linhas" value={String(current?.source.telemetryRows ?? '-')} />
        <MiniReading label="Leituras salvas" value={String(current?.source.stationReadingsSaved ?? '-')} />
        <MiniReading label="Agregados salvos" value={String(current?.source.rainfallAggregatesSaved ?? '-')} />
        <MiniReading label="Barragens salvas" value={String(current?.source.damReadingsSaved ?? '-')} />
        <MiniReading label="Previsao" value={forecast ? forecast.source.provider : '-'} />
      </View>
      {warnings.length ? (
        <View style={styles.warningList}>
          {warnings.map((warning) => (
            <Text key={warning} style={styles.warningText}>{warning}</Text>
          ))}
        </View>
      ) : (
        <Text style={styles.currentMeta}>Sem avisos no ultimo carregamento.</Text>
      )}
    </View>
  );
}

function MiniReading({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniReading}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.miniReadingValue}>{value}</Text>
    </View>
  );
}

function SelectedCityRainSummary({
  city,
  rainfallLabel,
  observedMm,
  maxDailyMm,
  forecast24hMm,
  forecast72hMm,
}: {
  city: string;
  rainfallLabel: string;
  observedMm: number | null;
  maxDailyMm: number | null;
  forecast24hMm: number | null;
  forecast72hMm: number | null;
}) {
  return (
    <View style={styles.selectedCityCard}>
      <Text style={styles.selectedCityName}>{city}</Text>
      <View style={styles.selectedCityMetrics}>
        <View style={styles.selectedCityMetric}>
          <Text style={styles.metricLabel}>{rainfallLabel}</Text>
          <Text style={styles.selectedCityValue}>{formatNullable(observedMm, ' mm')}</Text>
        </View>
        <View style={styles.selectedCityMetric}>
          <Text style={styles.metricLabel}>Maior dia</Text>
          <Text style={styles.selectedCityValue}>{formatNullable(maxDailyMm, ' mm')}</Text>
        </View>
        <View style={styles.selectedCityMetric}>
          <Text style={styles.metricLabel}>Prev. 24h</Text>
          <Text style={styles.selectedCityValue}>{formatNullable(forecast24hMm, ' mm')}</Text>
        </View>
        <View style={styles.selectedCityMetric}>
          <Text style={styles.metricLabel}>Prev. 72h</Text>
          <Text style={styles.selectedCityValue}>{formatNullable(forecast72hMm, ' mm')}</Text>
        </View>
      </View>
    </View>
  );
}

function RainStationCard({ station }: { station: MucumCurrentData['regionalRainfall']['stations'][number] }) {
  const status = rainfallStatus(station.rainfallMm);
  const c = alertPalette(status);
  return (
    <View style={styles.stationCard}>
      <View style={styles.stationCardTop}>
        <View style={[styles.stationIcon, { backgroundColor: c.iconBg }]}>
          <CloudRain color={c.iconColor} size={18} />
        </View>
        <View style={styles.stationInfo}>
          <Text style={styles.stationName}>{station.stationName || 'Estacao sem nome'}</Text>
          <Text style={styles.stationMeta}>
            {station.city || 'Municipio nao informado'} - {station.river || 'Rio nao informado'}
          </Text>
        </View>
        <StatusBadge level={status} label={formatNullable(station.rainfallMm, ' mm')} />
      </View>
      <View style={styles.currentGrid}>
        <MiniReading label="Chuva" value={formatNullable(station.rainfallMm, ' mm')} />
        <MiniReading label="Fonte" value={station.source} />
        <MiniReading label="Leitura" value={formatMeasuredAt(station.measuredAt) || '-'} />
      </View>
      {station.error ? <Text style={styles.currentMeta}>Falha: {station.error}</Text> : null}
    </View>
  );
}

function ForecastPointCard({ point }: { point: MucumForecastData['points'][number] }) {
  return (
    <View style={styles.stationCard}>
      <View style={styles.stationCardTop}>
        <View style={[styles.stationIcon, { backgroundColor: colors.blueSoft }]}>
          <CloudRain color={colors.info} size={18} />
        </View>
        <View style={styles.stationInfo}>
          <Text style={styles.stationName}>{point.name}</Text>
          <Text style={styles.stationMeta}>
            Pico {formatNullable(point.peakHourMm, ' mm/h')} {formatForecastTime(point.peakHourAt)}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: colors.blueSoft }]}>
          <Text style={[styles.statusBadgeText, { color: colors.institutionalBlue }]}>{formatNullable(point.next72hMm, ' mm')}</Text>
        </View>
      </View>
      <View style={styles.currentGrid}>
        <MiniReading label="24h" value={formatNullable(point.next24hMm, ' mm')} />
        <MiniReading label="72h" value={formatNullable(point.next72hMm, ' mm')} />
        <MiniReading label="7d" value={formatNullable(point.next7dMm, ' mm')} />
      </View>
    </View>
  );
}

function StationCard({ station }: { station: MucumStationSummary }) {
  const tags = [
    station.operating ? 'operando' : '',
    station.upstreamOfMucum ? 'a montante' : 'contexto da bacia',
    station.isTelemetry ? 'telemetria' : '',
    station.isRain ? 'chuva' : '',
    station.isLevel ? 'nivel' : '',
    station.isFlow ? 'vazao' : '',
  ].filter(Boolean);

  return (
    <View style={styles.stationCard}>
      <View style={styles.stationCardTop}>
        <View style={[styles.stationIcon, { backgroundColor: station.isRain ? colors.blueSoft : colors.blueSoft }]}>
          {station.isRain ? <CloudRain color={colors.mucumBlue} size={18} /> : <Waves color={colors.valleyGreen} size={18} />}
        </View>
        <View style={styles.stationInfo}>
          <Text style={styles.stationName}>{station.name}</Text>
          <Text style={styles.stationMeta}>{station.city || 'Sem municipio'} - {station.river || station.type || 'Sem rio'}</Text>
        </View>
        <Text style={styles.stationCode}>{station.code}</Text>
      </View>
      <View style={styles.tagRow}>
        {tags.map((tag) => (
          <Text key={tag} style={styles.dataTag}>{tag}</Text>
        ))}
      </View>
    </View>
  );
}

function LiveBadge() {
  return (
    <View style={styles.liveBadge}>
      <View style={styles.liveDot} />
      <Text style={styles.liveText}>Ao vivo</Text>
    </View>
  );
}

function StatusBadge({ level, label }: { level: AlertLevel; label: string }) {
  const c = alertPalette(level);
  return (
    <View style={[styles.statusBadge, { backgroundColor: c.iconBg }]}>
      <View style={[styles.statusBadgeDot, { backgroundColor: c.accent }]} />
      <Text style={[styles.statusBadgeText, { color: c.iconColor }]}>{label}</Text>
    </View>
  );
}

function projectionStatusAccent(status: ProjectionStatus): keyof typeof KPI_ACCENTS {
  if (status === 'inundation') return 'red';
  if (status === 'alert' || status === 'attention') return 'amber';
  return 'green';
}

function projectionStatusLabel(status: ProjectionStatus) {
  if (status === 'inundation') return 'Cota de inundacao';
  if (status === 'alert') return 'Cota de alerta';
  if (status === 'attention') return 'Cota de atencao';
  return 'Abaixo da atencao';
}

function projectionSeverityPalette(severity: ProjectionSeverity) {
  if (severity === 'critical') return { background: colors.dangerSoft, border: colors.danger, text: colors.danger };
  if (severity === 'warning') return { background: colors.warningSoft, border: colors.warning, text: colors.text };
  if (severity === 'info') return { background: colors.infoSoft, border: colors.info, text: colors.institutionalBlue };
  return { background: colors.safeSoft, border: colors.safe, text: colors.safe };
}

function formatCrossing(value: string | null) {
  return value ? formatForecastTime(value) : '-';
}

function formatHourlyDelta(value: number | null | undefined) {
  if (typeof value !== 'number') return '-';
  if (Math.abs(value) < 0.005) return 'estavel';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)} m/h`;
}

function hourlyDeltaStyle(value: number | null | undefined) {
  if (typeof value !== 'number' || Math.abs(value) < 0.005) return styles.deltaStable;
  return value > 0 ? styles.deltaRising : styles.deltaFalling;
}

function riverLevelStatus(m: number | null | undefined): AlertLevel {
  if (m === null || m === undefined || !Number.isFinite(m)) return 'normal';
  if (m >= ALERT_PARAMS.level.critical) return 'critical';
  if (m >= ALERT_PARAMS.level.alert) return 'warning';
  return 'normal';
}

function rainfallStatus(mm: number | null | undefined): AlertLevel {
  if (mm === null || mm === undefined || !Number.isFinite(mm)) return 'normal';
  if (mm >= ALERT_PARAMS.rain24h.critical) return 'critical';
  if (mm >= ALERT_PARAMS.rain24h.alert) return 'warning';
  return 'normal';
}

function levelStatusLabel(level: AlertLevel) {
  if (level === 'critical') return 'Nivel critico';
  if (level === 'warning') return 'Nivel de alerta';
  return 'dentro do normal';
}

function sumValues(values: (number | null)[]) {
  const available = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return available.length ? available.reduce((total, value) => total + value, 0) : null;
}

function maxValue(values: (number | null)[]) {
  const available = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return available.length ? Math.max(...available) : null;
}

function getRainfallCities(current: MucumCurrentData | null, forecast: MucumForecastData | null) {
  const observedCities = current?.regionalRainfall.cities?.map((city) => city.city)
    ?? current?.regionalRainfall.stations.map((station) => station.city || station.stationName)
    ?? [];
  const cities = observedCities.filter(Boolean);

  (forecast?.points ?? []).filter((point) => point.role !== 'jusante_contexto').forEach((point) => {
    if (!cities.some((city) => cityNamesMatch(city, point.name))) {
      cities.push(point.name);
    }
  });

  return cities
    .filter((city, index) => cities.findIndex((candidate) => cityNamesMatch(candidate, city)) === index)
    .sort((left, right) => {
      if (cityNamesMatch(left, 'Mucum')) return -1;
      if (cityNamesMatch(right, 'Mucum')) return 1;
      return left.localeCompare(right, 'pt-BR');
    });
}

function countMonitoredRivers(current: MucumCurrentData | null) {
  return new Set((current?.stationReadings ?? [])
    .filter((reading) => reading.riverLevelM !== null && reading.river && !isDownstreamLocation(reading.city ?? '', reading.river))
    .map((reading) => normalizeCityName(reading.river ?? ''))).size;
}

function isDownstreamLocation(city: string, river: string) {
  const normalizedCity = normalizeCityName(city);
  const normalizedRiver = normalizeCityName(river);
  return Boolean(normalizedCity.match(/ENCANTADO|ROCA SALES|COLINAS|ARROIO DO MEIO|LAJEADO|ESTRELA|BOM RETIRO|TAQUARI/)
    || normalizedRiver.match(/FORQUETA|TAQUARI-MIRIM/));
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

function alertPalette(level: AlertLevel) {
  if (level === 'critical') return { accent: colors.danger, iconBg: colors.dangerSoft, iconColor: colors.danger };
  if (level === 'warning') return { accent: colors.warning, iconBg: colors.warningSoft, iconColor: colors.warning };
  return { accent: colors.safe, iconBg: colors.safeSoft, iconColor: colors.safe };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 18,
  },
  cardHeader: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  cardHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  cardSub: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardBody: {
    padding: 20,
    gap: 14,
    flexDirection: 'column',
  },
  resultSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 18,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  freshnessBar: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  freshnessDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  freshnessCopy: {
    flex: 1,
    minWidth: 0,
  },
  freshnessTitle: {
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '600',
  },
  freshnessWarning: {
    fontSize: 14,
    lineHeight: 16,
    marginTop: 2,
  },
  heroPanel: {
    minHeight: 112,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.bridgeGold,
    backgroundColor: colors.institutionalBlue,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 18,
    overflow: 'hidden',
  },
  heroCopy: {
    flex: 1,
    minWidth: 220,
    maxWidth: 680,
  },
  kicker: {
    color: colors.riverLight,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.surface,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '700',
  },
  heroText: {
    color: colors.whiteTextMuted,
    fontSize: 14,
    lineHeight: 18,
    marginTop: 6,
  },
  heroAction: {
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: colors.bridgeGold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  heroActionText: {
    color: colors.institutionalBlue,
    fontSize: 14,
    fontWeight: '600',
  },
  loadingPanel: {
    minHeight: 80,
    borderRadius: 8,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    marginBottom: 18,
  },
  loadingCopy: {
    flex: 1,
    gap: 4,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  kpiCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    paddingBottom: 22,
    overflow: 'hidden',
    flexDirection: 'column',
    gap: 2,
  },
  kpiAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  kpiIconBox: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 30,
    marginBottom: 4,
  },
  kpiUnit: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  kpiTrend: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.safe,
  },
  liveText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.safe,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  segmentWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  segmentCompact: {
    minWidth: 48,
    minHeight: 34,
    borderRadius: 8,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  sectionToolbar: {
    minHeight: 58,
    borderRadius: 8,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  periodCopy: {
    flex: 1,
    minWidth: 220,
    maxWidth: 720,
  },
  scopeToolbar: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  scopeTagRow: {
    width: '100%',
  },
  chartGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    gap: 14,
  },
  chartGridCard: {
    flex: 1,
    minWidth: 260,
  },
  segmentSelected: {
    backgroundColor: colors.blueSoft,
    borderColor: colors.mucumBlue,
  },
  segmentText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  segmentTextSelected: {
    color: colors.institutionalBlue,
  },
  citySelector: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
  },
  citySelectionActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectionAction: {
    minHeight: 36,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
  },
  selectionActionText: {
    color: colors.institutionalBlue,
    fontSize: 14,
    fontWeight: '600',
  },
  cityOption: {
    minHeight: 38,
    borderRadius: 8,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  cityOptionSelected: {
    backgroundColor: colors.mucumBlue,
    borderColor: colors.mucumBlue,
  },
  cityOptionText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  cityOptionTextSelected: {
    color: colors.surface,
  },
  selectedCityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  selectedCityCard: {
    minWidth: 270,
    flex: 1,
    borderRadius: 7,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surfaceMuted,
    padding: 12,
    gap: 9,
  },
  selectedCityName: {
    color: colors.institutionalBlue,
    fontSize: 16,
    fontWeight: '700',
  },
  selectedCityMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  selectedCityMetric: {
    minWidth: 92,
    flex: 1,
    gap: 2,
  },
  selectedCityValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  currentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  currentCard: {
    minWidth: 160,
    flex: 1,
    borderRadius: 8,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surfaceMuted,
    padding: 14,
    gap: 5,
    flexDirection: 'column',
  },
  currentValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  currentMeta: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 16,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stationIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blueSoft,
  },
  adminPanel: {
    borderRadius: 8,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surfaceMuted,
    padding: 18,
    gap: 14,
    marginBottom: 18,
    flexDirection: 'column',
  },
  warningList: {
    borderRadius: 8,
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
    borderWidth: 1,
    padding: 10,
    gap: 6,
  },
  warningText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 17,
  },
  miniReading: {
    minWidth: 100,
    flex: 1,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 4,
    flexDirection: 'column',
  },
  miniReadingValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  stationCard: {
    borderRadius: 8,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 10,
    flexDirection: 'column',
  },
  stationList: {
    gap: 10,
    flexDirection: 'column',
  },
  stationCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stationInfo: {
    flex: 1,
    gap: 2,
  },
  stationName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  stationMeta: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  stationCode: {
    color: colors.mucumBlue,
    fontSize: 14,
    fontWeight: '600',
  },
  damCard: {
    borderRadius: 8,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 10,
    flexDirection: 'column',
  },
  riverGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  riverChip: {
    minWidth: 130,
    flexGrow: 1,
    borderRadius: 8,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'column',
    gap: 2,
  },
  riverName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  riverCode: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dataTag: {
    color: colors.institutionalBlue,
    backgroundColor: colors.blueSoft,
    borderRadius: 20,
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 3,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  projectionNotice: {
    minHeight: 64,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.info,
    backgroundColor: colors.infoSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  projectionNoticeCopy: {
    flex: 1,
    gap: 2,
  },
  operationalEstimateNote: {
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.mucumBlue,
    backgroundColor: colors.blueSoft,
  },
  modelVersion: {
    color: colors.institutionalBlue,
    fontSize: 14,
    fontWeight: '700',
  },
  projectionAlerts: {
    gap: 8,
    marginBottom: 14,
  },
  projectionAlert: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  projectionAlertDot: {
    width: 8,
    height: 32,
    borderRadius: 4,
  },
  projectionAlertCopy: {
    flex: 1,
    gap: 2,
  },
  projectionAlertTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  projectionAlertDetail: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 18,
  },
  projectionConfidencePanel: {
    flex: 1,
    minWidth: 260,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 10,
  },
  confidenceRow: {
    gap: 5,
  },
  confidenceRowCompact: {
    gap: 3,
  },
  confidenceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  confidenceLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  confidenceValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  confidenceTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: 6,
    borderRadius: 3,
  },
  confidenceDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  projectionHorizonGrid: {
    padding: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  projectionHorizonCell: {
    minWidth: 132,
    flex: 1,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.mucumBlue,
    backgroundColor: colors.surfaceMuted,
    gap: 3,
  },
  horizonHour: {
    color: colors.mucumBlue,
    fontSize: 14,
    fontWeight: '700',
  },
  horizonLikely: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  horizonDelta: {
    fontSize: 13,
    fontWeight: '700',
  },
  horizonRange: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  horizonConfidence: {
    color: colors.institutionalBlue,
    fontSize: 14,
    fontWeight: '600',
  },
  thresholdTable: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  thresholdRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  thresholdHeader: {
    backgroundColor: colors.surfaceMuted,
  },
  thresholdCell: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  thresholdName: {
    flex: 1.35,
    color: colors.text,
    textAlign: 'left',
    fontWeight: '700',
  },
  hourlyProjectionTable: {
    minWidth: 640,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  hourlyProjectionRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  hourlyProjectionCell: {
    width: 150,
    paddingHorizontal: 8,
    paddingVertical: 8,
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  hourlyProjectionHour: {
    width: 92,
    color: colors.text,
    textAlign: 'left',
    fontWeight: '700',
  },
  deltaRising: {
    color: colors.danger,
  },
  deltaFalling: {
    color: colors.safe,
  },
  deltaStable: {
    color: colors.textSecondary,
  },
  methodPanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: 16,
    marginBottom: 18,
    gap: 10,
  },
  methodText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyText: {
    maxWidth: 440,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.82,
  },
});

