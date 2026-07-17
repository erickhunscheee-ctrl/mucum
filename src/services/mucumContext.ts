import { DashboardSnapshotMeta } from '../types/dashboard';
import { PROXY_BASE_URL } from './proxyBaseUrl';

export type MucumStationSummary = {
  code: string;
  name: string;
  city: string;
  river: string;
  type: string;
  operating: boolean;
  isTelemetry: boolean;
  isRain: boolean;
  isLevel: boolean;
  isFlow: boolean;
  upstreamOfMucum: boolean;
  contributorKey?: string | null;
  contributorName?: string | null;
  contributorRelation?: string | null;
  influence?: string | null;
  priority: number;
};

export type MucumContext = {
  generatedAt: string;
  snapshot?: DashboardSnapshotMeta;
  municipality: Record<string, unknown> | null;
  subBasin: Record<string, unknown> | null;
  rivers: Record<string, unknown>[];
  stations: {
    telemetry: MucumStationSummary[];
    rainfall: MucumStationSummary[];
    level: MucumStationSummary[];
    allRelevant: MucumStationSummary[];
  };
  counts: {
    inventoryInBasin: number;
    stationsInSubBasin: number;
    telemetry: number;
    rainfall: number;
    level: number;
  };
  cache: 'hit' | 'miss';
};

const MUCUM_CONTEXT_URL = `${PROXY_BASE_URL}/api/mucum/context`;

export async function getMucumContext(forceRefresh = false) {
  const params = forceRefresh ? '?refresh=true' : '';
  const response = await fetch(`${MUCUM_CONTEXT_URL}${params}`);
  const data = (await response.json()) as MucumContext | { message?: string; detail?: string };

  if (!response.ok) {
    const errorData = data as { message?: string; detail?: string };
    throw new Error(errorData.message || errorData.detail || `Falha ao carregar contexto de Mucum: HTTP ${response.status}`);
  }

  return data as MucumContext;
}
