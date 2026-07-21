import { StatusBar } from 'expo-status-bar';
import { SourceSans3_400Regular } from '@expo-google-fonts/source-sans-3/400Regular';
import { SourceSans3_500Medium } from '@expo-google-fonts/source-sans-3/500Medium';
import { SourceSans3_600SemiBold } from '@expo-google-fonts/source-sans-3/600SemiBold';
import { SourceSans3_700Bold } from '@expo-google-fonts/source-sans-3/700Bold';
import { useFonts } from '@expo-google-fonts/source-sans-3/useFonts';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  BarChart3,
  ClipboardList,
  CloudRain,
  Database,
  Droplets,
  Home,
  History,
  MapPinned,
  RadioTower,
  RefreshCcw,
  Route,
  Search,
  Settings,
  ShieldAlert,
  TrendingUp,
  Waves,
  Wifi,
  WifiOff,
} from 'lucide-react-native';

import {
  brazilianStates,
  endpointConfigs,
  HidroEndpointKey,
  HidroResponse,
  queryHidroAna,
  telemetryRanges,
  usesProxyAuth,
} from './src/services/hidroAna';
import {
  emptyLocalAdminForm,
  formFromRecord,
  listLocalAdminRecords,
  localAdminEntities,
  LocalAdminEntity,
  LocalAdminForm,
  LocalAdminRecord,
  saveLocalAdminRecord,
} from './src/services/localAdmin';
import { MucumOverview as FeatureMucumOverview } from './src/features/mucum/MucumOverview';
import { AppText as Text } from './src/components/ui/AppText';
import { useMucumDashboard } from './src/features/mucum/useMucumDashboard';
import { AdminSection } from './src/types/navigation';
import { colors } from './src/theme/mucumTheme';
import { fontFamilies } from './src/theme/typography';

type RecordRow = Record<string, unknown>;
type ParameterCandidate = {
  kind: 'station' | 'basin' | 'state';
  label: string;
  value: string;
};

const today = formatDate(new Date());
const lastWeek = formatDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

const endpointIcons: Record<HidroEndpointKey, typeof Database> = {
  inventory: Database,
  catalogUf: Database,
  catalogBasin: Database,
  catalogSubBasin: Database,
  catalogRiver: Database,
  catalogMunicipality: Database,
  catalogEntity: Database,
  rain: CloudRain,
  riverLevel: Waves,
  flow: Droplets,
  telemetryAdopted: RadioTower,
  telemetryDetailed: RadioTower,
};

const sectionTitles: Record<AdminSection, string> = {
  dashboard: 'Visao geral',
  monitoring: 'Monitoramento',
  projection: 'Projecao',
  historical: 'Enchentes antigas',
  contingency: 'Plano de contingencia',
  rainfall: 'Chuvas',
  rivers: 'Rios e vazao',
  dams: 'Barragens',
  stations: 'Estacoes',
  admin: 'Cadastros',
  ana: 'Consulta ANA',
};

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    SourceSans3_400Regular,
    SourceSans3_500Medium,
    SourceSans3_600SemiBold,
    SourceSans3_700Bold,
  });
  const { width } = useWindowDimensions();
  const isNarrow = width < 900;
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [activeMode, setActiveMode] = useState<'query' | 'admin'>('query');
  const [endpoint, setEndpoint] = useState<HidroEndpointKey>('inventory');
  const [stationCode, setStationCode] = useState('');
  const [stationCodes, setStationCodes] = useState('');
  const [state, setState] = useState('SP');
  const [basinCode, setBasinCode] = useState('');
  const [startDate, setStartDate] = useState(lastWeek);
  const [endDate, setEndDate] = useState(today);
  const [searchDate, setSearchDate] = useState(today);
  const [filterType, setFilterType] = useState<'DATA_LEITURA' | 'DATA_ULTIMA_ATUALIZACAO'>('DATA_LEITURA');
  const [telemetryRange, setTelemetryRange] = useState('DIAS_7');
  const [catalogCode, setCatalogCode] = useState('');
  const [result, setResult] = useState<HidroResponse | null>(null);
  const [error, setError] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [localEntity, setLocalEntity] = useState<LocalAdminEntity>('neighborhoods');
  const [localRecords, setLocalRecords] = useState<LocalAdminRecord[]>([]);
  const [localForm, setLocalForm] = useState<LocalAdminForm>(emptyLocalAdminForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocalLoading, setIsLocalLoading] = useState(false);
  const {
    connectionMessage,
    isConnected,
    context: mucumContext,
    current: mucumCurrent,
    forecast: mucumForecast,
    projection: mucumProjection,
    rainfallWindowHours,
    isLoading: isDashboardLoading,
    dataStatus,
    dataUpdatedAt,
    dataWarning,
    loadInitialConnections,
    changeRainfallWindow,
  } = useMucumDashboard();

  const currentEndpoint = endpointConfigs.find((item) => item.key === endpoint) ?? endpointConfigs[0];
  const rows = useMemo(() => normalizeRows(result?.items), [result]);
  const chartData = useMemo(() => buildChartData(rows), [rows]);
  const visibleRows = rows.slice(0, 8);
  const visibleColumns = useMemo(() => getVisibleColumns(visibleRows), [visibleRows]);
  const parameterCandidates = useMemo(() => extractParameterCandidates(rows), [rows]);
  const catalogEndpoints = endpointConfigs.filter((config) => config.family === 'catalog');

  const handleSearch = async (targetEndpoint = endpoint) => {
    setError('');
    setResult(null);

    const targetConfig = endpointConfigs.find((item) => item.key === targetEndpoint) ?? currentEndpoint;
    const validation = validateQuery(targetConfig);
    if (validation) {
      setError(validation);
      return;
    }

    setIsLoading(true);

    try {
      const data = await queryHidroAna({
        endpoint: targetEndpoint,
        token: '',
        stationCode,
        stationCodes,
        state,
        basinCode,
        startDate,
        endDate,
        searchDate,
        filterType,
        telemetryRange,
        catalogCode,
      });
      setResult(data);
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  };

  const validateQuery = (targetConfig = currentEndpoint) => {
    if (!usesProxyAuth) {
      return 'Consulta direta sem proxy desativada. Use o backend para manter as credenciais fora do app.';
    }

    if (targetConfig.family === 'inventory' && !stationCode.trim() && !state && !basinCode.trim()) {
      return 'Para inventario, informe UF, codigo da estacao ou codigo da bacia.';
    }

    if (targetConfig.family === 'series' && !stationCode.trim()) {
      return 'Para series convencionais, informe o codigo da estacao.';
    }

    if (targetConfig.family === 'telemetry' && !stationCodes.trim()) {
      return 'Para telemetria, informe um ou mais codigos separados por virgula.';
    }

    return '';
  };

  const runCatalog = (targetEndpoint: HidroEndpointKey) => {
    setEndpoint(targetEndpoint);
    handleSearch(targetEndpoint);
  };

  const loadLocalRecords = async (targetEntity = localEntity) => {
    setAdminMessage('');
    setIsLocalLoading(true);

    try {
      const records = await listLocalAdminRecords(targetEntity);
      setLocalRecords(records);
      setLocalEntity(targetEntity);
      setLocalForm(emptyLocalAdminForm);
      setAdminMessage(`${records.length} registro(s) carregado(s).`);
    } catch (requestError) {
      setAdminMessage(getRequestErrorMessage(requestError));
    } finally {
      setIsLocalLoading(false);
    }
  };

  const saveLocalRecord = async () => {
    setAdminMessage('');

    if (!localForm.name.trim()) {
      setAdminMessage('Informe o nome do cadastro.');
      return;
    }

    setIsLocalLoading(true);

    try {
      await saveLocalAdminRecord(localEntity, localForm);
      const records = await listLocalAdminRecords(localEntity);
      setLocalRecords(records);
      setLocalForm(emptyLocalAdminForm);
      setAdminMessage('Cadastro salvo com sucesso.');
    } catch (requestError) {
      setAdminMessage(getRequestErrorMessage(requestError));
    } finally {
      setIsLocalLoading(false);
    }
  };

  const updateLocalForm = (key: keyof LocalAdminForm, value: string | boolean) => {
    setLocalForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const applyParameter = (candidate: ParameterCandidate) => {
    if (candidate.kind === 'station') {
      setStationCode(candidate.value);
      setStationCodes(candidate.value);
      setEndpoint('rain');
    }

    if (candidate.kind === 'basin') {
      setBasinCode(candidate.value);
      setEndpoint('inventory');
    }

    if (candidate.kind === 'state') {
      setState(candidate.value.toUpperCase());
      setEndpoint('inventory');
    }
  };

  const navigateSection = (section: AdminSection) => {
    setActiveSection(section);
    setActiveMode(section === 'ana' || section === 'admin' ? 'admin' : 'query');
  };

  if (!fontsLoaded && !fontError) return null;

  return (
    <View style={styles.shell}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page}>

        {/* â”€â”€ TOPBAR â”€â”€ */}
        <View style={[styles.topbar, isNarrow && styles.topbarNarrow]}>
          <View style={styles.topbarLeft}>
            <View style={styles.brandDotInline}>
              <Droplets color={colors.institutionalBlue} size={14} strokeWidth={2.5} />
            </View>
            <View>
              <Text style={styles.topbarTitle}>
                {sectionTitles[activeSection]}
              </Text>
              <Text style={styles.topbarSub}>Mucum · Rio Taquari · hoje</Text>
            </View>
          </View>
          <View style={styles.topbarRight}>
            {isConnected ? (
              <View style={styles.dateBadge}>
                <Text style={styles.dateBadgeText}>{today}</Text>
              </View>
            ) : (
              <View style={styles.warnBadge}>
                <WifiOff color={colors.warning} size={12} />
                <Text style={styles.warnBadgeText}>Offline</Text>
              </View>
            )}
            <Pressable accessibilityRole="button" onPress={() => loadInitialConnections()} style={styles.topbarBtnPrimary}>
              <RefreshCcw color={colors.white} size={13} />
              {!isNarrow ? <Text style={styles.topbarBtnText}>Atualizar</Text> : null}
            </Pressable>
          </View>
        </View>

        {/* â”€â”€ CONNECTION BANNER (disconnected) â”€â”€ */}
        {!isConnected ? (
          <View style={styles.connectionBanner}>
            <WifiOff color={colors.warning} size={14} />
            <Text style={styles.connectionBannerText} numberOfLines={2}>{connectionMessage}</Text>
          </View>
        ) : null}

        {/* â”€â”€ WORKSPACE â”€â”€ */}
        <View style={[styles.workspace, isNarrow ? styles.workspaceNarrow : null]}>

          {/* SIDEBAR */}
          <View style={[styles.sidebar, isNarrow && styles.sidebarNarrow]}>
            {!isNarrow ? (
              <View style={styles.sidebarBrand}>
                <View style={styles.brandDot}>
                  <Droplets color={colors.institutionalBlue} size={16} strokeWidth={2.2} />
                </View>
                <View style={styles.brandText}>
                  <Text style={styles.brandName}>HydroANA</Text>
                  <Text style={styles.brandRole}>MONITORAMENTO</Text>
                </View>
              </View>
            ) : null}
            <View style={[styles.sidebarNav, isNarrow && styles.sidebarNavNarrow]}>
              {!isNarrow ? <Text style={styles.navSectionLabel}>GERAL</Text> : null}
              <SidebarButton icon={Home} label="Visao geral" active={activeSection === 'dashboard'} onPress={() => navigateSection('dashboard')} />
              <SidebarButton icon={ShieldAlert} label="Monitoramento" active={activeSection === 'monitoring'} onPress={() => navigateSection('monitoring')} />
              <SidebarButton icon={TrendingUp} label="Projecao" active={activeSection === 'projection'} onPress={() => navigateSection('projection')} />
              <SidebarButton icon={ClipboardList} label="Plano de contingencia" active={activeSection === 'contingency'} onPress={() => navigateSection('contingency')} />
              {!isNarrow ? <Text style={styles.navSectionLabel}>HIDROLOGIA</Text> : null}
              <SidebarButton icon={History} label="Enchentes antigas" active={activeSection === 'historical'} onPress={() => navigateSection('historical')} />
              <SidebarButton icon={CloudRain} label="Chuvas" active={activeSection === 'rainfall'} onPress={() => navigateSection('rainfall')} />
              <SidebarButton icon={Waves} label="Rios e vazao" active={activeSection === 'rivers'} onPress={() => navigateSection('rivers')} />
              <SidebarButton icon={Database} label="Barragens" active={activeSection === 'dams'} onPress={() => navigateSection('dams')} />
              <SidebarButton icon={RadioTower} label="Estacoes" active={activeSection === 'stations'} onPress={() => navigateSection('stations')} />
              {!isNarrow ? <Text style={styles.navSectionLabel}>GESTAO</Text> : null}
              <SidebarButton icon={Route} label="Cadastros" active={activeSection === 'admin'} onPress={() => navigateSection('admin')} />
              <SidebarButton icon={Database} label="ANA" active={activeSection === 'ana'} onPress={() => navigateSection('ana')} />
              <SidebarButton icon={Settings} label="Consulta livre" active={activeSection === 'ana' && activeMode === 'query'} onPress={() => { setActiveSection('ana'); setActiveMode('query'); }} />
            </View>
            {!isNarrow ? (
              <View style={styles.sidebarFooter}>
                {isConnected ? <Wifi color={colors.riverLight} size={13} /> : <WifiOff color={colors.bridgeGold} size={13} />}
                <Text style={[styles.sidebarFooterText, !isConnected && styles.sidebarFooterWarn]} numberOfLines={4}>
                  {connectionMessage}
                </Text>
                <Pressable accessibilityRole="button" onPress={() => loadInitialConnections()} style={styles.sidebarRefreshBtn}>
                  <RefreshCcw color={colors.riverLight} size={13} />
                </Pressable>
              </View>
            ) : null}
          </View>

          {/* LEFT PANE (admin / ana) */}
          {activeSection === 'admin' || activeSection === 'ana' ? (
            <View style={[styles.leftPane, isNarrow ? styles.paneNarrow : null]}>
              {activeSection === 'admin' ? (
                <>
                  <SectionTitle icon={Database} label="Admin" />
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>Cadastros locais</Text>
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.endpointDescription}>
                        Bairros, abrigos, rotas e pontos criticos que serao usados pelo app mobile.
                      </Text>
                      <View style={styles.endpointGrid}>
                        {localAdminEntities.map((entity) => (
                          <Pressable
                            key={entity.key}
                            accessibilityRole="button"
                            onPress={() => loadLocalRecords(entity.key)}
                            style={({ pressed }) => [
                              styles.endpointButton,
                              localEntity === entity.key && styles.endpointButtonSelected,
                              pressed && styles.pressed,
                            ]}
                          >
                            <Database color={localEntity === entity.key ? colors.surface : colors.mucumBlue} size={18} />
                            <Text style={[styles.endpointButtonText, localEntity === entity.key && styles.endpointButtonTextSelected]}>
                              {entity.label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <Text style={styles.resultSubtitle}>
                        {localAdminEntities.find((entity) => entity.key === localEntity)?.description}
                      </Text>
                      <LocalAdminFormFields entity={localEntity} form={localForm} onChange={updateLocalForm} />
                      <View style={styles.actionRow}>
                        <Pressable
                          accessibilityRole="button"
                          disabled={isLocalLoading}
                          onPress={saveLocalRecord}
                          style={({ pressed }) => [
                            styles.primaryButton,
                            styles.actionButton,
                            pressed && styles.pressed,
                            isLocalLoading && styles.disabledButton,
                          ]}
                        >
                          {isLocalLoading ? (
                            <ActivityIndicator color={colors.white} />
                          ) : (
                            <Text style={styles.primaryButtonText}>{localForm.id ? 'Atualizar' : 'Salvar'}</Text>
                          )}
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setLocalForm(emptyLocalAdminForm)}
                          style={({ pressed }) => [styles.secondaryButton, styles.actionButton, pressed && styles.pressed]}
                        >
                          <Text style={styles.secondaryButtonText}>Novo</Text>
                        </Pressable>
                      </View>
                      {adminMessage ? <Text style={styles.adminMessage}>{adminMessage}</Text> : null}
                    </View>
                  </View>

                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>Catalogos para parametros</Text>
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.endpointDescription}>
                        Carregue listas base e use os codigos encontrados para alimentar inventario, series e telemetria.
                      </Text>
                      <LabeledInput
                        label="Codigo opcional do catalogo"
                        value={catalogCode}
                        onChangeText={setCatalogCode}
                        placeholder="Filtra o catalogo atual quando a API aceitar"
                        keyboardType="numeric"
                      />
                      <View style={styles.endpointGrid}>
                        {catalogEndpoints.map((config) => (
                          <Pressable
                            key={config.key}
                            accessibilityRole="button"
                            onPress={() => runCatalog(config.key)}
                            style={({ pressed }) => [
                              styles.endpointButton,
                              endpoint === config.key && styles.endpointButtonSelected,
                              pressed && styles.pressed,
                            ]}
                          >
                            <Database color={endpoint === config.key ? colors.surface : colors.mucumBlue} size={18} />
                            <Text style={[styles.endpointButtonText, endpoint === config.key && styles.endpointButtonTextSelected]}>
                              {config.label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </View>
                </>
              ) : null}

              {activeSection === 'ana' ? <SectionTitle icon={Search} label="Consulta ANA" /> : null}
              {activeSection === 'ana' ? (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Tipo de dado</Text>
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.endpointGrid}>
                      {endpointConfigs.map((config) => {
                        const Icon = endpointIcons[config.key];
                        const selected = config.key === endpoint;
                        return (
                          <Pressable
                            key={config.key}
                            accessibilityRole="button"
                            onPress={() => setEndpoint(config.key)}
                            style={({ pressed }) => [
                              styles.endpointButton,
                              selected && styles.endpointButtonSelected,
                              pressed && styles.pressed,
                            ]}
                          >
                            <Icon color={selected ? colors.surface : colors.mucumBlue} size={18} />
                            <Text style={[styles.endpointButtonText, selected && styles.endpointButtonTextSelected]}>
                              {config.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Text style={styles.endpointDescription}>{currentEndpoint.description}</Text>

                    {currentEndpoint.family === 'inventory' ? (
                      <>
                        <SegmentedOptions label="UF" options={brazilianStates} value={state} onChange={setState} compact />
                        <LabeledInput label="Codigo da estacao" value={stationCode} onChangeText={setStationCode} placeholder="Opcional" keyboardType="numeric" />
                        <LabeledInput label="Codigo da bacia" value={basinCode} onChangeText={setBasinCode} placeholder="Opcional" keyboardType="numeric" />
                      </>
                    ) : null}

                    {currentEndpoint.family === 'catalog' ? (
                      <LabeledInput label={currentEndpoint.codeParam ?? 'Codigo opcional'} value={catalogCode} onChangeText={setCatalogCode} placeholder="Opcional" keyboardType="numeric" />
                    ) : null}

                    {currentEndpoint.family === 'series' ? (
                      <>
                        <LabeledInput label="Codigo da estacao" value={stationCode} onChangeText={setStationCode} placeholder="Ex.: 12345678" keyboardType="numeric" />
                        <View style={[styles.formRow, isNarrow ? styles.formRowNarrow : null]}>
                          <LabeledInput label="Data inicial" value={startDate} onChangeText={setStartDate} placeholder="yyyy-MM-dd" />
                          <LabeledInput label="Data final" value={endDate} onChangeText={setEndDate} placeholder="yyyy-MM-dd" />
                        </View>
                        <SegmentedOptions label="Filtro de data" options={['DATA_LEITURA', 'DATA_ULTIMA_ATUALIZACAO']} value={filterType} onChange={(value) => setFilterType(value as typeof filterType)} />
                      </>
                    ) : null}

                    {currentEndpoint.family === 'telemetry' ? (
                      <>
                        <LabeledInput label="Codigos das estacoes" value={stationCodes} onChangeText={setStationCodes} placeholder="Ate 10 codigos separados por virgula" />
                        <LabeledInput label="Data de busca" value={searchDate} onChangeText={setSearchDate} placeholder="yyyy-MM-dd" />
                        <SegmentedOptions label="Filtro de data" options={['DATA_LEITURA', 'DATA_ULTIMA_ATUALIZACAO']} value={filterType} onChange={(value) => setFilterType(value as typeof filterType)} />
                        <SegmentedOptions label="Intervalo" options={telemetryRanges} value={telemetryRange} onChange={setTelemetryRange} compact />
                      </>
                    ) : null}

                    <Pressable
                      accessibilityRole="button"
                      disabled={isLoading}
                      onPress={() => handleSearch()}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        styles.searchButton,
                        pressed && styles.pressed,
                        isLoading && styles.disabledButton,
                      ]}
                    >
                      {isLoading ? (
                        <ActivityIndicator color={colors.white} />
                      ) : (
                        <>
                          <Search color={colors.white} size={18} />
                          <Text style={styles.primaryButtonText}>Consultar ANA</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* RIGHT PANE */}
          <View style={[styles.rightPane, isNarrow ? styles.paneNarrow : null]}>
            <SectionTitle
              icon={activeSection === 'rainfall' ? CloudRain : activeSection === 'rivers' ? Waves : activeSection === 'projection' ? TrendingUp : activeSection === 'historical' ? History : activeSection === 'stations' ? RadioTower : BarChart3}
              label={activeSection === 'ana' ? 'Resultados' : sectionTitles[activeSection]}
            />
            {error ? (
              <View style={styles.alert}>
                <Text style={styles.alertTitle}>Atencao</Text>
                <Text style={styles.alertText}>{error}</Text>
              </View>
            ) : null}

            {activeSection !== 'admin' && activeSection !== 'ana' ? (
              <FeatureMucumOverview
                context={mucumContext}
                current={mucumCurrent}
                forecast={mucumForecast}
                projection={mucumProjection}
                section={activeSection}
                isLoading={isDashboardLoading}
                dataStatus={dataStatus}
                dataUpdatedAt={dataUpdatedAt}
                dataWarning={dataWarning}
                rainfallWindowHours={rainfallWindowHours}
                onRainfallWindowChange={changeRainfallWindow}
                onRefresh={() => loadInitialConnections()}
              />
            ) : null}

            {activeSection === 'admin' ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Registros locais</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.resultSubtitle}>
                    Clique em um registro para editar. A lista mostra o cadastro selecionado no painel esquerdo.
                  </Text>
                  {localRecords.length ? (
                    <View style={styles.localList}>
                      {localRecords.map((record) => (
                        <Pressable
                          key={String(record.id)}
                          accessibilityRole="button"
                          onPress={() => setLocalForm(formFromRecord(record))}
                          style={({ pressed }) => [styles.localListItem, pressed && styles.pressed]}
                        >
                          <View style={styles.localListMain}>
                            <Text style={styles.localListTitle}>{String(record.name ?? 'Sem nome')}</Text>
                            <Text style={styles.localListMeta} numberOfLines={2}>
                              {summarizeLocalRecord(record)}
                            </Text>
                          </View>
                          <Text style={[styles.statusPill, record.is_active === false && styles.statusPillMuted]}>
                            {record.is_active === false ? 'inativo' : 'ativo'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.emptyText}>
                      Nenhum registro carregado. Escolha um cadastro local e clique no tipo desejado.
                    </Text>
                  )}
                </View>
              </View>
            ) : null}

            {activeSection === 'ana' ? (
              <View style={[styles.metricsRow, isNarrow ? styles.metricsRowNarrow : null]}>
                <Metric label="Status" value={result?.status ?? '-'} />
                <Metric label="Codigo" value={String(result?.code ?? '-')} />
                <Metric label="Registros" value={String(rows.length)} />
              </View>
            ) : null}

            {activeSection === 'ana' && parameterCandidates.length ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Parametros encontrados</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.resultSubtitle}>Use estes valores para encadear uma consulta em outra.</Text>
                  <View style={styles.paramGrid}>
                    {parameterCandidates.map((candidate) => (
                      <Pressable
                        key={`${candidate.kind}-${candidate.value}`}
                        accessibilityRole="button"
                        onPress={() => applyParameter(candidate)}
                        style={({ pressed }) => [styles.paramButton, pressed && styles.pressed]}
                      >
                        <Text style={styles.paramKind}>{candidate.label}</Text>
                        <Text style={styles.paramValue} numberOfLines={1}>
                          {candidate.value}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            ) : null}

            {activeSection === 'ana' ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{currentEndpoint.label}</Text>
                  <MapPinned color={colors.mucumBlue} size={18} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.resultSubtitle}>{result?.message || 'Execute uma consulta para visualizar os dados.'}</Text>
                  {chartData.length ? (
                    <View style={styles.chart}>
                      {chartData.map((item) => (
                        <View key={item.label} style={styles.chartItem}>
                          <View style={[styles.chartBar, { height: `${Math.max(12, item.percent)}%` }]} />
                          <Text style={styles.chartLabel} numberOfLines={1}>
                            {item.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.emptyState}>
                      <Database color={colors.textSecondary} size={32} />
                      <Text style={styles.emptyTitle}>Sem dados carregados</Text>
                      <Text style={styles.emptyText}>
                        Autentique, escolha um conjunto e consulte. A resposta bruta aparece preparada para dados variados da ANA.
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ) : null}

            {activeSection === 'ana' ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Amostra dos dados</Text>
                </View>
                <View style={styles.cardBody}>
                  {visibleRows.length && visibleColumns.length ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator>
                      <View>
                        <View style={styles.tableRow}>
                          {visibleColumns.map((column) => (
                            <Text key={column} style={[styles.tableCell, styles.tableHead]}>
                              {column}
                            </Text>
                          ))}
                        </View>
                        {visibleRows.map((row, rowIndex) => (
                          <View key={`${rowIndex}-${String(row[visibleColumns[0]])}`} style={styles.tableRow}>
                            {visibleColumns.map((column) => (
                              <Text key={column} style={styles.tableCell} numberOfLines={2}>
                                {formatCell(row[column])}
                              </Text>
                            ))}
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  ) : (
                    <Text style={styles.rawText}>
                      {result ? JSON.stringify(result.items ?? result, null, 2) : 'Nenhuma resposta para exibir.'}
                    </Text>
                  )}
                </View>
              </View>
            ) : null}

            {activeSection === 'ana' ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Retorno bruto completo</Text>
                </View>
                <View style={styles.cardBody}>
                  <ScrollView style={styles.rawBox}>
                    <Text style={styles.rawText}>
                      {result ? JSON.stringify(result, null, 2) : 'Nenhuma resposta para exibir.'}
                    </Text>
                  </ScrollView>
                </View>
              </View>
            ) : null}
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

function SectionTitle({ icon: Icon, label }: { icon: typeof Database; label: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Icon color={colors.mucumBlue} size={18} />
      <Text style={styles.sectionTitleText}>{label}</Text>
    </View>
  );
}

function SidebarButton({
  icon: Icon,
  label,
  active,
  onPress,
}: {
  icon: typeof Database;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.sidebarButton, active && styles.sidebarButtonActive, pressed && styles.pressed]}
    >
      <Icon color={active ? colors.white : colors.whiteTextMuted} size={16} />
      <Text style={[styles.sidebarButtonText, active && styles.sidebarButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function LabeledInput({
  label,
  ...props
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        style={[styles.input, props.multiline && styles.multiInput]}
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
      />
    </View>
  );
}

function SegmentedOptions({
  label,
  options,
  value,
  onChange,
  compact,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.segmentWrap}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              onPress={() => onChange(option)}
              style={({ pressed }) => [
                compact ? styles.segmentCompact : styles.segment,
                selected && styles.segmentSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function LocalAdminFormFields({
  entity,
  form,
  onChange,
}: {
  entity: LocalAdminEntity;
  form: LocalAdminForm;
  onChange: (key: keyof LocalAdminForm, value: string | boolean) => void;
}) {
  return (
    <>
      <LabeledInput
        label="Nome"
        value={form.name}
        onChangeText={(value) => onChange('name', value)}
        placeholder="Nome do cadastro"
      />

      {entity !== 'neighborhoods' ? (
        <LabeledInput
          label="ID do bairro"
          value={form.neighborhood_id}
          onChangeText={(value) => onChange('neighborhood_id', value)}
          placeholder="UUID do bairro relacionado"
        />
      ) : null}

      {entity === 'shelters' ? (
        <>
          <LabeledInput label="Endereco" value={form.address} onChangeText={(value) => onChange('address', value)} placeholder="Rua, numero, referencia" />
          <View style={styles.formRow}>
            <LabeledInput label="Capacidade" value={form.capacity} onChangeText={(value) => onChange('capacity', value)} placeholder="Ex.: 120" keyboardType="numeric" />
            <LabeledInput label="WhatsApp" value={form.whatsapp} onChangeText={(value) => onChange('whatsapp', value)} placeholder="Numero" />
          </View>
          <LabeledInput label="Responsavel" value={form.contact_name} onChangeText={(value) => onChange('contact_name', value)} placeholder="Nome" />
          <LabeledInput label="Telefone" value={form.contact_phone} onChangeText={(value) => onChange('contact_phone', value)} placeholder="Numero" />
        </>
      ) : null}

      {entity === 'escape_routes' ? (
        <>
          <LabeledInput label="ID do abrigo" value={form.shelter_id} onChangeText={(value) => onChange('shelter_id', value)} placeholder="UUID do abrigo destino" />
          <LabeledInput label="Origem" value={form.origin_description} onChangeText={(value) => onChange('origin_description', value)} placeholder="Bairro, rua ou ponto de partida" />
          <LabeledInput label="Destino" value={form.destination_description} onChangeText={(value) => onChange('destination_description', value)} placeholder="Abrigo ou area segura" />
          <LabeledInput label="Link da rota" value={form.route_url} onChangeText={(value) => onChange('route_url', value)} placeholder="Google Maps ou outro mapa" />
          <View style={styles.formRow}>
            <LabeledInput label="Distancia m" value={form.distance_m} onChangeText={(value) => onChange('distance_m', value)} placeholder="Ex.: 850" keyboardType="numeric" />
            <LabeledInput label="Fecha em m" value={form.closes_at_river_level_m} onChangeText={(value) => onChange('closes_at_river_level_m', value)} placeholder="Ex.: 17.5" keyboardType="numeric" />
          </View>
        </>
      ) : null}

      {entity === 'critical_points' ? (
        <>
          <LabeledInput label="ID da rua" value={form.street_id} onChangeText={(value) => onChange('street_id', value)} placeholder="UUID da rua relacionada" />
          <LabeledInput label="Descricao" value={form.description} onChangeText={(value) => onChange('description', value)} placeholder="O que ocorre nesse ponto" multiline />
          <View style={styles.formRow}>
            <LabeledInput label="Alaga em m" value={form.starts_flooding_at_m} onChangeText={(value) => onChange('starts_flooding_at_m', value)} placeholder="Ex.: 16.8" keyboardType="numeric" />
            <LabeledInput label="Bloqueia em m" value={form.blocks_route_at_m} onChangeText={(value) => onChange('blocks_route_at_m', value)} placeholder="Ex.: 17.2" keyboardType="numeric" />
          </View>
        </>
      ) : null}

      <LabeledInput
        label="Observacoes"
        value={form.notes}
        onChangeText={(value) => onChange('notes', value)}
        placeholder="Informacoes internas"
        multiline
      />

      {entity === 'shelters' || entity === 'escape_routes' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange('is_active', !form.is_active)}
          style={styles.toggleRow}
        >
          <View style={[styles.toggleDot, form.is_active && styles.toggleDotActive]} />
          <Text style={styles.toggleText}>{form.is_active ? 'Ativo' : 'Inativo'}</Text>
        </Pressable>
      ) : null}
    </>
  );
}

function normalizeRows(items: unknown): RecordRow[] {
  if (!items) {
    return [];
  }

  if (Array.isArray(items)) {
    return items.filter(isRecord);
  }

  if (isRecord(items)) {
    const directArrays = Object.values(items).filter(Array.isArray) as unknown[][];
    const objectRows = directArrays.flat().filter(isRecord);

    if (objectRows.length) {
      return objectRows;
    }

    return [items];
  }

  return [];
}

function getVisibleColumns(rows: RecordRow[]) {
  const columns = new Set<string>();

  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (columns.size < 8 && !isNested(row[key])) {
        columns.add(key);
      }
    });
  });

  return Array.from(columns);
}

function buildChartData(rows: RecordRow[]) {
  const numericKeys = ['chuva', 'vazao', 'cota', 'nivel', 'valor'];
  const points = rows
    .slice(0, 12)
    .map((row, index) => {
      const key = Object.keys(row).find((item) => {
        const normalized = item.toLowerCase();
        return numericKeys.some((candidate) => normalized.includes(candidate)) && toNumber(row[item]) !== null;
      });
      const value = key ? toNumber(row[key]) : null;

      return value === null
        ? null
        : {
          label: formatCell(row.Data_Hora_Medicao ?? row.Data ?? row.data ?? index + 1),
          value,
        };
    })
    .filter(Boolean) as { label: string; value: number }[];

  const max = Math.max(...points.map((point) => Math.abs(point.value)), 1);

  return points.map((point) => ({
    ...point,
    percent: (Math.abs(point.value) / max) * 100,
  }));
}

function extractParameterCandidates(rows: RecordRow[]): ParameterCandidate[] {
  const candidates = new Map<string, ParameterCandidate>();

  rows.slice(0, 30).forEach((row) => {
    Object.entries(row).forEach(([key, value]) => {
      const formatted = formatCell(value);

      if (!formatted || formatted === '-' || formatted.length > 40) {
        return;
      }

      const normalized = normalizeKey(key);

      if (isStationKey(normalized)) {
        candidates.set(`station-${formatted}`, {
          kind: 'station',
          label: 'Estacao',
          value: formatted,
        });
      }

      if (isBasinKey(normalized)) {
        candidates.set(`basin-${formatted}`, {
          kind: 'basin',
          label: 'Bacia',
          value: formatted,
        });
      }

      if (isStateKey(normalized, formatted)) {
        candidates.set(`state-${formatted.toUpperCase()}`, {
          kind: 'state',
          label: 'UF',
          value: formatted.toUpperCase(),
        });
      }
    });
  });

  return Array.from(candidates.values()).slice(0, 18);
}

function summarizeLocalRecord(record: LocalAdminRecord) {
  const parts = [
    record.address,
    record.origin_description,
    record.destination_description,
    record.description,
    record.closes_at_river_level_m ? `fecha em ${record.closes_at_river_level_m}m` : '',
    record.starts_flooding_at_m ? `alaga em ${record.starts_flooding_at_m}m` : '',
  ]
    .map((item) => (item === null || item === undefined ? '' : String(item)))
    .filter(Boolean);

  return parts.length ? parts.join(' | ') : `ID: ${String(record.id ?? '-')}`;
}

function normalizeKey(key: string) {
  return key
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function isStationKey(key: string) {
  return key.includes('estacao') && (key.includes('codigo') || key.startsWith('cod'));
}

function isBasinKey(key: string) {
  return key.includes('bacia') && !key.includes('sub') && (key.includes('codigo') || key.startsWith('cod'));
}

function isStateKey(key: string, value: string) {
  return (key === 'uf' || key.includes('unidadefederativa')) && /^[A-Za-z]{2}$/.test(value);
}

function toNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isRecord(value: unknown): value is RecordRow {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNested(value: unknown) {
  return Boolean(value) && typeof value === 'object';
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) {
    return '-';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function getRequestErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'Failed to fetch' || error.message.includes('Network request failed')) {
      return 'Nao foi possivel acessar o servidor de dados. Verifique a rota /api/health e os logs do servico.';
    }

    return error.message;
  }

  return 'Erro inesperado ao consultar a ANA.';
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

const styles = StyleSheet.create({
  // â”€â”€ LAYOUT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  shell: {
    flex: 1,
    backgroundColor: colors.background,
  },
  page: {
    paddingBottom: 40,
    flexGrow: 1,
  },

  // â”€â”€ TOPBAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  topbar: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 24,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topbarNarrow: {
    paddingHorizontal: 14,
    height: 52,
  },
  topbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topbarTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  topbarSub: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 1,
  },
  topbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateBadge: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.blueSoft,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dateBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.institutionalBlue,
  },
  warnBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.warningSoft,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.warning,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  warnBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  topbarBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.mucumBlue,
  },
  topbarBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.surface,
  },
  brandDotInline: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.bridgeGold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // â”€â”€ CONNECTION BANNER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.warningSoft,
    borderBottomWidth: 1,
    borderBottomColor: colors.warning,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  connectionBannerText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },

  // â”€â”€ WORKSPACE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  workspace: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 0,
  },
  workspaceNarrow: {
    flexDirection: 'column',
  },

  // â”€â”€ SIDEBAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  sidebar: {
    width: 240,
    backgroundColor: colors.institutionalBlue,
    flexDirection: 'column',
    minHeight: 600,
  },
  sidebarNarrow: {
    width: '100%',
    minHeight: 0,
    flexDirection: 'column',
    backgroundColor: colors.institutionalBlue,
  },
  sidebarBrand: {
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteFaint,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandDot: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.bridgeGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    flexDirection: 'column',
  },
  brandName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.surface,
    letterSpacing: 0.3,
  },
  brandRole: {
    fontSize: 14,
    color: colors.riverLight,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginTop: 1,
  },
  sidebarNav: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 14,
    gap: 2,
    flexDirection: 'column',
  },
  sidebarNavNarrow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  navSectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.whiteTextFaint,
    letterSpacing: 0.8,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 4,
    marginTop: 2,
  },
  sidebarButton: {
    minHeight: 38,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  sidebarButtonActive: {
    backgroundColor: colors.mucumBlue,
  },
  sidebarButtonText: {
    flex: 1,
    color: colors.whiteTextMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  sidebarButtonTextActive: {
    color: colors.surface,
    fontWeight: '600',
  },
  sidebarFooter: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.whiteFaint,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  sidebarFooterText: {
    flex: 1,
    color: colors.riverLight,
    fontSize: 14,
    lineHeight: 16,
  },
  sidebarFooterWarn: {
    color: colors.bridgeGold,
  },
  sidebarRefreshBtn: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.whiteFaint,
  },

  // â”€â”€ PANES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  leftPane: {
    flex: 0.72,
    minWidth: 260,
    padding: 18,
    gap: 12,
    flexDirection: 'column',
  },
  rightPane: {
    flex: 2.15,
    minWidth: 340,
    padding: 18,
    gap: 0,
    flexDirection: 'column',
  },
  paneNarrow: {
    width: '100%',
    minWidth: 0,
  },

  // â”€â”€ CARDS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  // Alias for backward compat with any remaining styles.panel refs
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 18,
    padding: 18,
    gap: 12,
    flexDirection: 'column',
  },

  // â”€â”€ KPI GRID â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ LIVE BADGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ STATUS BADGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ SECTION TITLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitleText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },

  // â”€â”€ HERO PANEL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  heroPanel: {
    minHeight: 148,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.bridgeGold,
    backgroundColor: colors.institutionalBlue,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 18,
    overflow: 'hidden',
  },
  heroCopy: {
    flex: 1,
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
    fontSize: 22,
    lineHeight: 28,
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

  // â”€â”€ LOADING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ METRICS ROW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  metricsRowNarrow: {
    flexDirection: 'column',
  },
  metric: {
    flex: 1,
    minHeight: 72,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    gap: 6,
    flexDirection: 'column',
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },

  // â”€â”€ ADMIN PANEL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ CURRENT GRID â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  stationIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blueSoft,
  },

  // â”€â”€ MINI READING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ STATION CARDS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ RIVER CHIPS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ TAGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    letterSpacing: 0.3,
  },

  // â”€â”€ CHART â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  chart: {
    height: 220,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 30,
  },
  chartItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  chartBar: {
    width: '72%',
    maxWidth: 34,
    borderRadius: 5,
    backgroundColor: colors.mucumBlue,
  },
  chartLabel: {
    position: 'absolute',
    bottom: -22,
    width: 64,
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  chartJsBox: {
    width: '100%',
    minHeight: 320,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: 1,
    padding: 12,
  },
  chartEmpty: {
    minHeight: 200,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },

  // â”€â”€ EMPTY STATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  emptyState: {
    minHeight: 180,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyText: {
    maxWidth: 400,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },

  // â”€â”€ ALERT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  alert: {
    borderRadius: 8,
    borderColor: colors.warning,
    borderWidth: 1,
    backgroundColor: colors.warningSoft,
    padding: 14,
    gap: 4,
    marginBottom: 14,
    flexDirection: 'column',
  },
  alertTitle: {
    color: colors.warning,
    fontSize: 14,
    fontWeight: '700',
  },
  alertText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
  },

  // â”€â”€ RESULT HEADER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  resultSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 18,
    marginTop: 2,
  },

  // â”€â”€ FORM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  inputWrap: {
    gap: 6,
    flexDirection: 'column',
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    minHeight: 42,
    borderRadius: 8,
    borderColor: colors.border,
    borderWidth: 1,
    color: colors.text,
    fontFamily: fontFamilies[400],
    fontSize: 14,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  multiInput: {
    minHeight: 76,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formRowNarrow: {
    flexDirection: 'column',
  },

  // â”€â”€ BUTTONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  primaryButton: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: colors.mucumBlue,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  searchButton: {
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 8,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: colors.mucumBlue,
    fontSize: 14,
    fontWeight: '600',
  },
  adminMessage: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 18,
  },
  disabledButton: {
    opacity: 0.65,
  },
  pressed: {
    opacity: 0.78,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blueSoft,
  },

  // â”€â”€ SEGMENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  segmentWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  segment: {
    minHeight: 36,
    borderRadius: 8,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  segmentCompact: {
    minWidth: 44,
    minHeight: 30,
    borderRadius: 8,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
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
    fontWeight: '600',
  },

  // â”€â”€ ENDPOINT GRID â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  endpointGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  endpointButton: {
    minHeight: 40,
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: 8,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  endpointButtonSelected: {
    backgroundColor: colors.mucumBlue,
    borderColor: colors.mucumBlue,
  },
  endpointButtonText: {
    flex: 1,
    color: colors.institutionalBlue,
    fontSize: 14,
    fontWeight: '700',
  },
  endpointButtonTextSelected: {
    color: colors.surface,
  },
  endpointDescription: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 18,
  },

  // â”€â”€ TABLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  tableRow: {
    flexDirection: 'row',
  },
  tableCell: {
    width: 150,
    minHeight: 40,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 17,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  tableHead: {
    color: colors.institutionalBlue,
    fontWeight: '700',
    backgroundColor: colors.surfaceMuted,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // â”€â”€ LOCAL RECORDS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  localList: {
    gap: 8,
    flexDirection: 'column',
  },
  localListItem: {
    minHeight: 58,
    borderRadius: 8,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  localListMain: {
    flex: 1,
    gap: 3,
  },
  localListTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  localListMeta: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 16,
  },

  // â”€â”€ STATUS PILLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  statusPill: {
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
  statusPillMuted: {
    color: colors.text,
    backgroundColor: colors.warningSoft,
  },

  // â”€â”€ TOGGLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  toggleRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  toggleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderColor: colors.border,
    borderWidth: 2,
    backgroundColor: colors.surface,
  },
  toggleDotActive: {
    backgroundColor: colors.mucumBlue,
    borderColor: colors.mucumBlue,
  },
  toggleText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },

  // â”€â”€ PARAMS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  paramGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paramButton: {
    minWidth: 110,
    flexGrow: 1,
    borderRadius: 8,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
    flexDirection: 'column',
  },
  paramKind: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  paramValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },

  // â”€â”€ RAW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  rawBox: {
    maxHeight: 340,
    borderRadius: 8,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.background,
    padding: 10,
  },
  rawText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies[400],
    fontSize: 14,
    lineHeight: 17,
  },

  // â”€â”€ SUCCESS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  successLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.safeSoft,
    borderRadius: 8,
    padding: 10,
  },
  successText: {
    flex: 1,
    color: colors.safe,
    fontSize: 14,
    lineHeight: 18,
  },

  // â”€â”€ LEGACY (kept for compat) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  connectionStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    display: 'none',
  },
  connectionText: { color: colors.mucumBlue, fontSize: 14 },
  connectionTextWarning: { color: colors.warning },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, display: 'none' },
  headerNarrow: { display: 'none' },
  headerCopy: { flex: 1 },
  brandMark: { display: 'none' },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 14 },
  modeBar: { flexDirection: 'row', display: 'none' },
  modeButton: { padding: 8 },
  modeButtonActive: { backgroundColor: colors.blueSoft, borderRadius: 8 },
  modeButtonText: { color: colors.textSecondary, fontSize: 14 },
  modeButtonTextActive: { color: colors.institutionalBlue, fontWeight: '600' },
});
