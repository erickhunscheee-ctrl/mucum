import { DashboardSnapshotMeta } from '../types/dashboard';
import { apiErrorMessage, readJsonResponse } from './httpJson';
import { PROXY_BASE_URL } from './proxyBaseUrl';

export type MucumForecastData = {
  generatedAt: string;
  snapshot?: DashboardSnapshotMeta;
  source: {
    provider: string;
    url: string;
    points: number;
  };
  basin: {
    next6hMm: number | null;
    next24hMm: number | null;
    next72hMm: number | null;
    next7dMm: number | null;
    peakPointName: string | null;
    peakHourMm: number | null;
    peakHourAt: string | null;
  };
  points: {
    key: string;
    name: string;
    role: string;
    contributorKey?: string;
    latitude: number;
    longitude: number;
    next6hMm: number;
    next24hMm: number;
    next72hMm: number;
    next7dMm: number;
    peakHourMm: number;
    peakHourAt: string | null;
    peakProbabilityPct: number | null;
    hours: {
      time: string;
      precipitationMm: number;
      probabilityPct: number | null;
    }[];
  }[];
};

const MUCUM_FORECAST_URL = `${PROXY_BASE_URL}/api/mucum/forecast`;

export async function getMucumForecast(forceRefresh = false) {
  const params = forceRefresh ? '?refresh=true' : '';
  const response = await fetch(`${MUCUM_FORECAST_URL}${params}`);
  const data = await readJsonResponse<MucumForecastData | { message?: string; detail?: string }>(response, 'Previsao de chuva');

  if (!response.ok) {
    throw new Error(apiErrorMessage(data, `Falha ao carregar previsao: HTTP ${response.status}`));
  }

  return data as MucumForecastData;
}
