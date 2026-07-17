export type DashboardDataStatus = 'live' | 'cache' | 'historical' | 'local';

export type DashboardSnapshotMeta = {
  status: Exclude<DashboardDataStatus, 'local'>;
  dataUpdatedAt: string | null;
  cachedAt: string | null;
  expiresAt: string | null;
  isStale: boolean;
  warning: string | null;
};
