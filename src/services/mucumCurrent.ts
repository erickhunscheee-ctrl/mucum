import { DashboardSnapshotMeta } from '../types/dashboard';
import { apiErrorMessage, readJsonResponse } from './httpJson';
import { PROXY_BASE_URL } from './proxyBaseUrl';

export type MucumCurrentData = {
  generatedAt: string;
  snapshot?: DashboardSnapshotMeta;
  source: {
    telemetryCodes: string[];
    telemetryRows: number;
    telemetryRange: string;
    damsFromSupabase: number;
    regionalRainStations: number;
    damTelemetryRows: number;
    damReadingsSaved: number;
    stationReadingsSaved: number;
    rainfallAggregatesSaved: number;
    warnings?: string[];
  };
  rainfall: {
    currentMm: number | null;
    accumulatedMm: number | null;
    accumulated24hMm: number | null;
    instantMm: number | null;
    stationName: string | null;
    stationCode: string | null;
    measuredAt: string | null;
    windowHours: number | null;
  };
  river: {
    currentLevelM: number | null;
    currentFlowM3s: number | null;
    levelStationName: string | null;
    levelStationCode: string | null;
    flowStationName: string | null;
    flowStationCode: string | null;
    levelMeasuredAt: string | null;
    flowMeasuredAt: string | null;
  };
  dams: {
    dam_id: string;
    dam_name: string;
    river_name: string | null;
    operator_name: string | null;
    measured_at: string | null;
    inflow_m3s: number | null;
    outflow_m3s: number | null;
    reservoir_level_m: number | null;
    spillway_status: string | null;
    source: string | null;
    raw_payload?: unknown;
  }[];
  regionalRainfall: {
    basinName: string;
    scope?: {
      outletCity: string;
      outletStationCode: string;
      upstreamOnly: boolean;
      includesLocalCritical?: boolean;
      rivers: string[];
      contributors?: {
        key: string;
        name: string;
        relation: string;
        influence: string;
        priority: number;
        description: string;
      }[];
      downstreamContext?: { key: string; name: string; description: string }[];
    };
    windowHours: number;
    stationCount: number;
    cityCount?: number;
    withRainCount: number;
    maxMm: number | null;
    avgMm: number | null;
    totalMm: number | null;
    lastMeasuredAt: string | null;
    stations: {
      stationCode: string;
      stationName: string;
      city: string;
      river: string;
      contributorKey?: string | null;
      contributorName?: string | null;
      contributorRelation?: string | null;
      influence?: string | null;
      measuredAt: string | null;
      rainfallMm: number | null;
      windowHours: number;
      source: string;
      rawCount: number;
      error: string | null;
      daily?: {
        date: string;
        rainfallMm: number;
        readingCount: number;
      }[];
    }[];
    cities?: {
      city: string;
      rainfallMm: number | null;
      maxDailyMm: number | null;
      peakDate: string | null;
      stationCount: number;
      stationName: string;
      measuredAt: string | null;
      contributorKey?: string | null;
      contributorName?: string | null;
      contributorRelation?: string | null;
      influence?: string | null;
      daily: {
        date: string;
        rainfallMm: number;
        readingCount: number;
      }[];
    }[];
  };
  stationReadings: {
    stationCode: string;
    stationName: string;
    city?: string;
    river?: string;
    measuredAt: string;
    rainfallMm: number | null;
    riverLevelM: number | null;
    flowM3s: number | null;
  }[];
};

const MUCUM_CURRENT_URL = `${PROXY_BASE_URL}/api/mucum/current`;

export async function getMucumCurrentData(rainWindowHours = 24, forceRefresh = false) {
  const params = new URLSearchParams({
    rainWindowHours: String(rainWindowHours),
    ...(forceRefresh ? { refresh: 'true' } : {}),
  });
  const response = await fetch(`${MUCUM_CURRENT_URL}?${params.toString()}`);
  const data = await readJsonResponse<MucumCurrentData | { message?: string; detail?: string }>(response, 'Dados atuais de Mucum');

  if (!response.ok) {
    throw new Error(apiErrorMessage(data, `Falha ao carregar dados atuais: HTTP ${response.status}`));
  }

  return data as MucumCurrentData;
}
