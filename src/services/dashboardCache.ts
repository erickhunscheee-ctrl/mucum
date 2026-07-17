import AsyncStorage from '@react-native-async-storage/async-storage';

import { MucumContext } from './mucumContext';
import { MucumCurrentData } from './mucumCurrent';
import { MucumForecastData } from './mucumForecast';
import { MucumProjectionData } from './mucumProjection';
import { RainfallWindowHours } from '../types/navigation';

const DASHBOARD_CACHE_KEY = '@hydro-ana/mucum-dashboard-v1';

type DashboardCachePayload = {
  version: 1;
  savedAt: string;
  context: MucumContext | null;
  forecast: MucumForecastData | null;
  projection?: MucumProjectionData | null;
  currentByWindow: Partial<Record<RainfallWindowHours, MucumCurrentData>>;
};

export type CachedMucumDashboard = {
  savedAt: string;
  context: MucumContext | null;
  current: MucumCurrentData | null;
  forecast: MucumForecastData | null;
  projection: MucumProjectionData | null;
};

export async function getCachedMucumDashboard(rainfallWindowHours: RainfallWindowHours): Promise<CachedMucumDashboard | null> {
  try {
    const serialized = await AsyncStorage.getItem(DASHBOARD_CACHE_KEY);

    if (!serialized) {
      return null;
    }

    const cached = JSON.parse(serialized) as DashboardCachePayload;

    if (cached.version !== 1 || !cached.context) {
      return null;
    }

    return {
      savedAt: cached.savedAt,
      context: cached.context,
      current: cached.currentByWindow[rainfallWindowHours] ?? null,
      forecast: cached.forecast,
      projection: cached.projection ?? null,
    };
  } catch {
    return null;
  }
}

export async function saveMucumDashboardCache({
  rainfallWindowHours,
  context,
  current,
  forecast,
  projection,
}: {
  rainfallWindowHours: RainfallWindowHours;
  context?: MucumContext | null;
  current?: MucumCurrentData | null;
  forecast?: MucumForecastData | null;
  projection?: MucumProjectionData | null;
}) {
  try {
    const serialized = await AsyncStorage.getItem(DASHBOARD_CACHE_KEY);
    const previous = serialized ? JSON.parse(serialized) as DashboardCachePayload : null;
    const next: DashboardCachePayload = {
      version: 1,
      savedAt: new Date().toISOString(),
      context: context ?? previous?.context ?? null,
      forecast: forecast ?? previous?.forecast ?? null,
      projection: projection ?? previous?.projection ?? null,
      currentByWindow: {
        ...(previous?.currentByWindow ?? {}),
        ...(current ? { [rainfallWindowHours]: current } : {}),
      },
    };

    await AsyncStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(next));
  } catch {
    // Cache local e uma melhoria de disponibilidade; falhas nao bloqueiam o painel.
  }
}
