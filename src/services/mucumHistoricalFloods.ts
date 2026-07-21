import { apiErrorMessage, readJsonResponse } from './httpJson';
import { PROXY_BASE_URL } from './proxyBaseUrl';

export type HistoricalFloodPoint = {
  hourFromPeak: number;
  time: string;
  levelM: number;
};

export type HistoricalFloodEvent = {
  key: string;
  label: string;
  searchDate: string;
  planPeakLevelM: number;
  telemetryPeakLevelM: number;
  telemetryPeakAt: string;
  peakDifferenceM: number;
  points: HistoricalFloodPoint[];
  damFlows: HistoricalDamFlowSeries[];
};

export type HistoricalDamFlowSeries = {
  stationCode: string;
  damName: string;
  signal: string;
  availableReadings: number;
  maximumFlowM3s: number | null;
  maximumFlowAt: string | null;
  points: {
    hourFromFloodPeak: number;
    time: string;
    flowM3s: number;
  }[];
};

export type MucumHistoricalFloodsData = {
  generatedAt: string;
  stationCode: string;
  stationName: string;
  source: string;
  alignment: string;
  caveat: string;
  events: HistoricalFloodEvent[];
};

export async function getMucumHistoricalFloods() {
  const response = await fetch(`${PROXY_BASE_URL}/api/mucum/historical-floods`);
  const data = await readJsonResponse<MucumHistoricalFloodsData | { message?: string; detail?: string }>(response, 'Cheias historicas');

  if (!response.ok) {
    throw new Error(apiErrorMessage(data, `Falha ao carregar cheias historicas: HTTP ${response.status}`));
  }

  return data as MucumHistoricalFloodsData;
}
