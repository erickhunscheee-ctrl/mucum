import { useWindowDimensions, View, StyleSheet } from 'react-native';
import {
  Building2,
  CircleAlert,
  ClipboardCheck,
  History,
  MapPin,
  Route,
  ShieldCheck,
  Users,
} from 'lucide-react-native';

import { AppText as Text } from '../../components/ui/AppText';
import { MucumCurrentData } from '../../services/mucumCurrent';
import { MucumProjectionData } from '../../services/mucumProjection';
import { colors } from '../../theme/mucumTheme';
import { formatForecastTime, formatNullable } from '../../utils/format';
import {
  contingencyPlan,
  contingencyRoutes,
  contingencyShelters,
  contingencyStages,
  historicalFloods,
  levelReferences,
  meetingPoints,
  riskTerritories,
  stageForLevel,
  sumCapacity,
  ContingencyStage,
} from './contingencyData';

type Props = {
  current: MucumCurrentData | null;
  projection: MucumProjectionData | null;
};

export function ContingencyPlanSection({ current, projection }: Props) {
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const currentLevel = current?.river.currentLevelM ?? projection?.current.levelM ?? null;
  const likelyPeak = projection?.peaks.likely.levelM ?? null;
  const maximumPeak = projection?.peaks.maximum.levelM ?? null;
  const currentStage = stageForLevel(currentLevel);
  const likelyStage = stageForLevel(likelyPeak);
  const maximumStage = stageForLevel(maximumPeak);
  const exposedPeople = riskTerritories.reduce((total, territory) => total + territory.people, 0);

  return (
    <View style={styles.root}>
      <View style={styles.notice}>
        <ClipboardCheck color={colors.institutionalBlue} size={20} />
        <View style={styles.noticeCopy}>
          <Text style={styles.noticeTitle}>Base operacional municipal de {contingencyPlan.version}</Text>
          <Text style={styles.bodyText}>
            Estagio atual usa nivel observado. Projecoes sao apoio a decisao e nao acionam evacuacao automaticamente.
          </Text>
        </View>
        <Text style={styles.sourceTag}>Plano p. {contingencyPlan.sourcePages.stages}</Text>
      </View>

      <View style={[styles.kpiGrid, compact && styles.singleColumn]}>
        <Metric label="Nivel observado" value={formatNullable(currentLevel, ' m')} detail={currentStage?.label ?? 'Sem leitura'} color={stageColor(currentStage)} />
        <Metric label="Pico provavel" value={formatNullable(likelyPeak, ' m')} detail={likelyStage ? `${likelyStage.label}${projection ? ` - ${formatForecastTime(projection.peaks.likely.at)}` : ''}` : 'Sem projecao'} color={stageColor(likelyStage)} />
        <Metric label="Cenario maximo" value={formatNullable(maximumPeak, ' m')} detail={maximumStage?.label ?? 'Sem projecao'} color={stageColor(maximumStage)} />
        <Metric label="Populacao exposta" value={String(exposedPeople)} detail={`${riskTerritories.length} territorios mapeados`} color={colors.institutionalBlue} />
      </View>

      <View style={[styles.twoColumns, compact && styles.singleColumn]}>
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <ShieldCheck color={colors.mucumBlue} size={19} />
            <View>
              <Text style={styles.panelTitle}>Estagio e resposta minima</Text>
              <Text style={styles.panelSubtitle}>Gatilhos pela cota SGB/CPRM pos-setembro de 2023</Text>
            </View>
          </View>
          {contingencyStages.map((stage) => (
            <StageRow
              key={stage.code}
              stage={stage}
              current={stage.code === currentStage?.code}
              projected={stage.code === likelyStage?.code && stage.code !== currentStage?.code}
            />
          ))}
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <CircleAlert color={colors.warning} size={19} />
            <View>
              <Text style={styles.panelTitle}>Acoes prioritarias</Text>
              <Text style={styles.panelSubtitle}>Separacao entre condicao observada e planejamento</Text>
            </View>
          </View>
          <ActionGroup title="Agora" stage={currentStage} empty="Aguardando leitura do rio" />
          <ActionGroup title="Se o pico provavel se confirmar" stage={likelyStage} empty="Aguardando projecao" />
          {maximumStage && maximumStage.code !== likelyStage?.code ? (
            <View style={styles.scenarioWarning}>
              <Text style={styles.scenarioWarningTitle}>Cenario maximo: {maximumStage.label}</Text>
              <Text style={styles.bodyText}>Usar para pre-posicionar recursos; confirmar com boletins oficiais e Defesa Civil.</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <History color={colors.valleyGreen} size={19} />
          <View>
            <Text style={styles.panelTitle}>Cheias historicas como referencia</Text>
            <Text style={styles.panelSubtitle}>Cotas transcritas das fichas territoriais do plano, paginas 57 a 60</Text>
          </View>
        </View>
        <View style={styles.historyList}>
          {historicalFloods.map((event) => (
            <View key={event.date} style={styles.historyRow}>
              <Text style={styles.historyLabel}>{event.label}</Text>
              <View style={styles.historyTrack}>
                <View style={[styles.historyBar, { width: `${Math.min(100, (event.levelM / 28) * 100)}%` }]} />
              </View>
              <Text style={styles.historyValue}>{event.levelM.toFixed(2)} m</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.twoColumns, compact && styles.singleColumn]}>
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Route color={colors.info} size={19} />
            <View>
              <Text style={styles.panelTitle}>Disponibilidade das rotas</Text>
              <Text style={styles.panelSubtitle}>Comparada ao pico provavel; validar bloqueios em campo</Text>
            </View>
          </View>
          {contingencyRoutes.map((route) => {
            const unavailable = likelyPeak !== null && likelyPeak >= route.unavailableAtM;
            return (
              <View key={route.name} style={styles.listRow}>
                <View style={styles.listCopy}>
                  <Text style={styles.listTitle}>{route.name}</Text>
                  <Text style={styles.listMeta}>{route.access} · {route.distanceM} m · {route.estimatedMinutes} min</Text>
                  <Text style={styles.listMeta}>{route.originDestination}</Text>
                </View>
                <View style={[styles.statusBadge, unavailable ? styles.statusDanger : styles.statusSafe]}>
                  <Text style={[styles.statusText, { color: unavailable ? colors.danger : colors.safe }]}>
                    {unavailable ? 'Indisponivel' : `Ate ${route.unavailableAtM} m`}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Building2 color={colors.institutionalBlue} size={19} />
            <View>
              <Text style={styles.panelTitle}>Capacidade de acolhimento</Text>
              <Text style={styles.panelSubtitle}>Abrigos sao ultimo recurso conforme o plano</Text>
            </View>
          </View>
          <CapacityRow icon={Building2} label="Alojamentos temporarios" value={sumCapacity(contingencyShelters)} detail={`${contingencyShelters.length} locais`} />
          <CapacityRow icon={MapPin} label="Pontos de encontro" value={sumCapacity(meetingPoints)} detail={`${meetingPoints.length} locais`} />
          <CapacityRow icon={Users} label="Pessoas nas areas mapeadas" value={exposedPeople} detail="Contagem agregada; sem dados pessoais" />
          <View style={styles.divider} />
          {riskTerritories.map((territory) => (
            <View key={territory.name} style={styles.territoryRow}>
              <View style={styles.listCopy}>
                <Text style={styles.listTitle}>{territory.name}</Text>
                <Text style={styles.listMeta}>{territory.risk}</Text>
              </View>
              <Text style={styles.territoryValue}>{territory.people} pessoas</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.referencePanel}>
        <Text style={styles.panelTitle}>Referencias de cota nao devem ser misturadas</Text>
        <View style={[styles.referenceGrid, compact && styles.singleColumn]}>
          {levelReferences.map((reference) => (
            <View key={reference.name} style={styles.referenceItem}>
              <Text style={styles.listTitle}>{reference.name}</Text>
              <Text style={styles.listMeta}>Atencao {reference.attentionM} m · Alerta {reference.alertM} m · Inundacao {reference.inundationM} m</Text>
            </View>
          ))}
        </View>
        <Text style={styles.validationNote}>
          A tabela meteorologica da pagina 22 possui uma lacuna entre 150 e 250 mm/24h; por seguranca, ela nao foi usada para acionamento automatico.
        </Text>
      </View>
    </View>
  );
}

function Metric({ label, value, detail, color }: { label: string; value: string; detail: string; color: string }) {
  return (
    <View style={[styles.metric, { borderTopColor: color }]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </View>
  );
}

function StageRow({ stage, current, projected }: { stage: ContingencyStage; current: boolean; projected: boolean }) {
  const color = stageColor(stage);
  return (
    <View style={[styles.stageRow, current && { backgroundColor: colors.blueSoft, borderColor: color }]}>
      <View style={[styles.stageLevel, { backgroundColor: color }]}>
        <Text style={styles.stageLevelText}>{stage.thresholdM}m</Text>
      </View>
      <View style={styles.listCopy}>
        <Text style={styles.listTitle}>{stage.label}</Text>
        <Text style={styles.listMeta}>{stage.alarm ?? 'Sem alarme de evacuacao'}</Text>
      </View>
      {current || projected ? (
        <Text style={[styles.stageMarker, { color }]}>{current ? 'ATUAL' : 'PROVAVEL'}</Text>
      ) : null}
    </View>
  );
}

function ActionGroup({ title, stage, empty }: { title: string; stage: ContingencyStage | null; empty: string }) {
  return (
    <View style={styles.actionGroup}>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={[styles.actionStage, { color: stageColor(stage) }]}>{stage?.label ?? empty}</Text>
      {stage?.actions.map((action) => (
        <View key={action} style={styles.actionRow}>
          <View style={[styles.actionDot, { backgroundColor: stageColor(stage) }]} />
          <Text style={styles.bodyText}>{action}</Text>
        </View>
      ))}
    </View>
  );
}

function CapacityRow({ icon: Icon, label, value, detail }: { icon: typeof Building2; label: string; value: number; detail: string }) {
  return (
    <View style={styles.capacityRow}>
      <View style={styles.capacityIcon}><Icon color={colors.mucumBlue} size={17} /></View>
      <View style={styles.listCopy}>
        <Text style={styles.listTitle}>{label}</Text>
        <Text style={styles.listMeta}>{detail}</Text>
      </View>
      <Text style={styles.capacityValue}>{value}</Text>
    </View>
  );
}

function stageColor(stage: ContingencyStage | null) {
  if (!stage) return colors.textSecondary;
  if (stage.code === 'maximum') return colors.danger;
  if (stage.code === 'very-high' || stage.code === 'high') return colors.warning;
  if (stage.code === 'moderate') return colors.info;
  return colors.safe;
}

const styles = StyleSheet.create({
  root: { gap: 14 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: colors.riverLight, borderWidth: 1, borderColor: colors.mucumBlue, borderRadius: 6 },
  noticeCopy: { flex: 1, gap: 2 },
  noticeTitle: { color: colors.institutionalBlue, fontSize: 16, fontWeight: '700' },
  sourceTag: { color: colors.institutionalBlue, fontSize: 14, fontWeight: '600' },
  bodyText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  kpiGrid: { flexDirection: 'row', gap: 10 },
  singleColumn: { flexDirection: 'column' },
  metric: { flex: 1, minWidth: 150, padding: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderTopWidth: 3, borderRadius: 6 },
  metricLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  metricValue: { marginTop: 5, fontSize: 25, fontWeight: '700' },
  metricDetail: { marginTop: 2, color: colors.textSecondary, fontSize: 14 },
  twoColumns: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  panel: { flex: 1, minWidth: 0, padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, gap: 10 },
  panelHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 3 },
  panelTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  panelSubtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 18 },
  stageRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderWidth: 1, borderColor: 'transparent', borderRadius: 5 },
  stageLevel: { width: 43, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  stageLevelText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  stageMarker: { fontSize: 14, fontWeight: '700' },
  actionGroup: { gap: 5, paddingBottom: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  actionTitle: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  actionStage: { fontSize: 18, fontWeight: '700' },
  actionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  actionDot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  scenarioWarning: { padding: 11, backgroundColor: colors.warningSoft, borderLeftWidth: 3, borderLeftColor: colors.warning, borderRadius: 4, gap: 2 },
  scenarioWarningTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  historyList: { gap: 8 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  historyLabel: { width: 150, color: colors.text, fontSize: 14, fontWeight: '600' },
  historyTrack: { flex: 1, height: 12, backgroundColor: colors.surfaceMuted, borderRadius: 3, overflow: 'hidden' },
  historyBar: { height: '100%', backgroundColor: colors.mucumBlue },
  historyValue: { width: 62, textAlign: 'right', color: colors.institutionalBlue, fontSize: 14, fontWeight: '700' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  listCopy: { flex: 1, gap: 1 },
  listTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  listMeta: { color: colors.textSecondary, fontSize: 14, lineHeight: 18 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 4, borderWidth: 1 },
  statusSafe: { backgroundColor: colors.safeSoft, borderColor: colors.safe },
  statusDanger: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  statusText: { fontSize: 14, fontWeight: '700' },
  capacityRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 7 },
  capacityIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blueSoft, borderRadius: 5 },
  capacityValue: { color: colors.institutionalBlue, fontSize: 22, fontWeight: '700' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 3 },
  territoryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 7 },
  territoryValue: { color: colors.institutionalBlue, fontSize: 14, fontWeight: '700' },
  referencePanel: { padding: 16, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: 6, gap: 10 },
  referenceGrid: { flexDirection: 'row', gap: 10 },
  referenceItem: { flex: 1, minWidth: 0, padding: 10, backgroundColor: colors.surface, borderLeftWidth: 3, borderLeftColor: colors.mucumBlue },
  validationNote: { color: colors.warning, fontSize: 14, fontWeight: '600', lineHeight: 19 },
});
