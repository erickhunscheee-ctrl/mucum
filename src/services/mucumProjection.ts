import { DashboardSnapshotMeta } from '../types/dashboard';
import { apiErrorMessage, readJsonResponse } from './httpJson';
import { PROXY_BASE_URL } from './proxyBaseUrl';

export type ProjectionStatus = 'normal' | 'attention' | 'alert' | 'inundation';
export type ProjectionSeverity = 'normal' | 'info' | 'warning' | 'critical';

export type ProjectionTimelinePoint = {
  hour: number;
  time: string;
  minimumLevelM: number;
  likelyLevelM: number;
  maximumLevelM: number;
  minimumFlowM3s: number;
  likelyFlowM3s: number;
  maximumFlowM3s: number;
  minimumLevelDeltaM: number;
  likelyLevelDeltaM: number;
  maximumLevelDeltaM: number;
  minimumRainMm: number;
  likelyRainMm: number;
  maximumRainMm: number;
  confidencePct: number;
  confidenceLabel: 'alta' | 'media' | 'baixa';
  status: ProjectionStatus;
};

export type MucumProjectionData = {
  generatedAt: string;
  baseTime: string;
  horizonHours: number;
  snapshot?: DashboardSnapshotMeta;
  current: {
    levelM: number;
    flowM3s: number;
    status: ProjectionStatus;
    measuredAt: string;
  };
  model: {
    name: string;
    version: string;
    status: string;
    officialLeadHours: number | null;
    officialVariant: string | null;
    officialEquation: string | null;
    officialProjectedFlowM3s: number | null;
    drainageAreaKm2: number;
    thresholdsM: { attention: number; alert: number; inundation: number };
    operationalUse: string;
    disclaimer: string;
    limitations: string[];
  };
  operationalEstimate: {
    levelM: number;
    lowerLevelM: number;
    upperLevelM: number;
    at: string;
    hour: number;
    confidencePct: number;
    confidenceLabel: 'alta' | 'media' | 'baixa';
    basis: string;
  };
  operationalGuidance: {
    observedMonitoringCadenceMinutes: number | null;
    projectedMonitoringCadenceMinutes: number | null;
    evacuationSafetyMarginM: number;
    territorialEvacuationLevelsM: number[];
    source: string;
  };
  confidence: {
    overallPct: number;
    shortTermPct: number | null;
    next24hPct: number | null;
    next72hPct: number | null;
    components: {
      freshnessPct: number;
      hydrologyInputsPct: number;
      meteorologyPct: number;
      basinCoveragePct: number;
    };
    verificationStatus: string;
  };
  scenarios: Record<'minimum' | 'likely' | 'maximum', { label: string; description: string }>;
  peaks: Record<'minimum' | 'likely' | 'maximum', {
    levelM: number;
    flowM3s: number;
    at: string;
    hour: number;
    status: ProjectionStatus;
    confidencePct: number;
  }>;
  thresholdCrossings: {
    key: 'attention' | 'alert' | 'inundation';
    label: string;
    levelM: number;
    minimumAt: string | null;
    likelyAt: string | null;
    maximumAt: string | null;
  }[];
  horizons: ProjectionTimelinePoint[];
  drivers: {
    observedRain3dMm: number;
    observedRain7dMm: number;
    forecastRain72hMm: { minimum: number; likely: number; maximum: number };
    localCriticalRain72hMm: { minimum: number; likely: number; maximum: number };
    localCriticalRainCoveragePct: number;
    ensembleMembers: number;
    basinRainCoveragePct: number;
    runoffCoefficients: { minimum: number; likely: number; maximum: number };
    stageTrendMPerHour: number;
    flowTrendM3sPerHour: number;
    linhaJoseJulioFlowM3s: number | null;
    uhe14JulhoOutflowM3s: number | null;
    upstreamSignals: {
      stationCode: string;
      stationName: string;
      river: string;
      levelM: number | null;
      flowM3s: number | null;
      measuredAt: string | null;
      available: boolean;
    }[];
    availableUpstreamSignals: number;
    damSignals: {
      name: string;
      flowM3s: number | null;
      maximumReferenceM3s: number;
      status: 'unavailable' | 'normal' | 'high' | 'very_high' | 'maximum';
      measuredAt: string | null;
    }[];
    glofasAvailable: boolean;
  };
  alerts: {
    severity: ProjectionSeverity;
    title: string;
    detail: string;
  }[];
  timeline: ProjectionTimelinePoint[];
  sources: { name: string; url: string }[];
};

const MUCUM_PROJECTION_URL = `${PROXY_BASE_URL}/api/mucum/projection`;

export async function getMucumProjection(forceRefresh = false) {
  const params = forceRefresh ? '?refresh=true' : '';
  const response = await fetch(`${MUCUM_PROJECTION_URL}${params}`);
  const data = await readJsonResponse<MucumProjectionData | { message?: string; detail?: string }>(response, 'Projecao hidrologica');

  if (!response.ok) {
    throw new Error(apiErrorMessage(data, `Falha ao carregar projecao: HTTP ${response.status}`));
  }

  return data as MucumProjectionData;
}
