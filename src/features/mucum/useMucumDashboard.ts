import { useEffect, useState } from 'react';

import { getCachedMucumDashboard, saveMucumDashboardCache } from '../../services/dashboardCache';
import { getMucumContext, MucumContext } from '../../services/mucumContext';
import { getMucumCurrentData, MucumCurrentData } from '../../services/mucumCurrent';
import { getMucumForecast, MucumForecastData } from '../../services/mucumForecast';
import { getMucumProjection, MucumProjectionData } from '../../services/mucumProjection';
import { getMucumMunicipality } from '../../services/supabase';
import { DashboardDataStatus } from '../../types/dashboard';
import { RainfallWindowHours } from '../../types/navigation';

export function useMucumDashboard() {
  const [connectionMessage, setConnectionMessage] = useState('Carregando dados salvos...');
  const [isConnected, setIsConnected] = useState(false);
  const [context, setContext] = useState<MucumContext | null>(null);
  const [current, setCurrent] = useState<MucumCurrentData | null>(null);
  const [forecast, setForecast] = useState<MucumForecastData | null>(null);
  const [projection, setProjection] = useState<MucumProjectionData | null>(null);
  const [rainfallWindowHours, setRainfallWindowHours] = useState<RainfallWindowHours>(24);
  const [isLoading, setIsLoading] = useState(false);
  const [dataStatus, setDataStatus] = useState<DashboardDataStatus>('local');
  const [dataUpdatedAt, setDataUpdatedAt] = useState<string | null>(null);
  const [dataWarning, setDataWarning] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      setIsLoading(true);
      const cached = await getCachedMucumDashboard(24);

      if (!active) return;

      if (cached?.context) {
        setContext(cached.context);
        setCurrent(cached.current);
        setForecast(cached.forecast);
        setProjection(cached.projection);
        setDataStatus('local');
        setDataUpdatedAt(resolveDataUpdatedAt(cached.current, cached.savedAt));
        setConnectionMessage('Dados salvos carregados. Atualizando em segundo plano...');
        setIsLoading(false);

        void loadInitialConnections(24, true);
        return;
      }

      const status = await loadInitialConnections(24, false);

      if (active && status && status !== 'live') {
        void loadInitialConnections(24, true);
      }
    };

    void initialize();

    return () => {
      active = false;
    };
  }, []);

  const loadInitialConnections = async (
    targetRainfallWindowHours = rainfallWindowHours,
    forceRefresh = true,
  ): Promise<DashboardDataStatus | null> => {
    setConnectionMessage(forceRefresh ? 'Atualizando ANA, Supabase e previsao...' : 'Buscando ultimo snapshot...');
    setIsLoading(true);

    try {
      const [municipality, nextContext, nextCurrent, nextForecast] = await Promise.all([
        getMucumMunicipality().catch(() => null),
        getMucumContext(forceRefresh),
        getMucumCurrentData(targetRainfallWindowHours, forceRefresh),
        getMucumForecast(forceRefresh),
      ]);
      const nextProjection = await getMucumProjection(forceRefresh).catch(() => null);

      const nextStatus = nextCurrent.snapshot?.status ?? 'live';
      setContext(nextContext);
      setCurrent(nextCurrent);
      setForecast(nextForecast);
      setProjection((existing) => nextProjection ?? existing);
      setDataStatus(nextStatus);
      setDataUpdatedAt(resolveDataUpdatedAt(nextCurrent));
      setDataWarning(nextCurrent.snapshot?.warning ?? null);
      setIsConnected(true);
      setConnectionMessage(buildConnectionMessage(municipality, nextContext, nextCurrent, nextStatus));

      await saveMucumDashboardCache({
        rainfallWindowHours: targetRainfallWindowHours,
        context: nextContext,
        current: nextCurrent,
        forecast: nextForecast,
        projection: nextProjection,
      });

      return nextStatus;
    } catch (requestError) {
      const cached = await getCachedMucumDashboard(targetRainfallWindowHours);

      if (cached?.context) {
        setContext(cached.context);
        setCurrent(cached.current);
        setForecast(cached.forecast);
        setProjection(cached.projection);
        setDataStatus('local');
        setDataUpdatedAt(resolveDataUpdatedAt(cached.current, cached.savedAt));
        setDataWarning(getDashboardErrorMessage(requestError));
        setConnectionMessage('Sem conexao com o proxy. Exibindo os ultimos dados salvos neste dispositivo.');
      } else {
        setConnectionMessage(getDashboardErrorMessage(requestError));
      }

      setIsConnected(false);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const changeRainfallWindow = async (hours: RainfallWindowHours) => {
    if (hours === rainfallWindowHours) return;

    setRainfallWindowHours(hours);
    setIsLoading(true);
    setConnectionMessage('Carregando acumulado salvo...');

    const cached = await getCachedMucumDashboard(hours);

    if (cached?.current) {
      setCurrent(cached.current);
      setDataStatus('local');
      setDataUpdatedAt(resolveDataUpdatedAt(cached.current, cached.savedAt));
    } else {
      setCurrent(null);
    }

    try {
      const nextCurrent = await getMucumCurrentData(hours, false);
      const nextStatus = nextCurrent.snapshot?.status ?? 'live';
      setCurrent(nextCurrent);
      setDataStatus(nextStatus);
      setDataUpdatedAt(resolveDataUpdatedAt(nextCurrent));
      setDataWarning(nextCurrent.snapshot?.warning ?? null);
      setIsConnected(true);
      setConnectionMessage(`Acumulado carregado para ${rainfallWindowLabel(hours)}. ${statusMessage(nextStatus)}`);
      await saveMucumDashboardCache({ rainfallWindowHours: hours, current: nextCurrent, context, forecast, projection });

      if (nextStatus !== 'live') {
        await refreshRainfallWindow(hours);
      }
    } catch (requestError) {
      setIsConnected(false);
      setDataWarning(getDashboardErrorMessage(requestError));
      setConnectionMessage(cached?.current
        ? 'Sem conexao para atualizar. Mantendo o acumulado salvo neste dispositivo.'
        : getDashboardErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  };

  const refreshRainfallWindow = async (hours: RainfallWindowHours) => {
    try {
      const refreshed = await getMucumCurrentData(hours, true);
      const nextStatus = refreshed.snapshot?.status ?? 'live';
      setCurrent(refreshed);
      setDataStatus(nextStatus);
      setDataUpdatedAt(resolveDataUpdatedAt(refreshed));
      setDataWarning(refreshed.snapshot?.warning ?? null);
      setConnectionMessage(`Acumulado atualizado para ${rainfallWindowLabel(hours)}. ${statusMessage(nextStatus)}`);
      await saveMucumDashboardCache({ rainfallWindowHours: hours, current: refreshed, context, forecast, projection });
    } catch (requestError) {
      setDataWarning(getDashboardErrorMessage(requestError));
      setConnectionMessage('Nao foi possivel atualizar agora. O acumulado salvo continua visivel.');
    }
  };

  return {
    connectionMessage,
    isConnected,
    context,
    current,
    forecast,
    projection,
    rainfallWindowHours,
    isLoading,
    dataStatus,
    dataUpdatedAt,
    dataWarning,
    loadInitialConnections,
    changeRainfallWindow,
  };
}

function resolveDataUpdatedAt(current: MucumCurrentData | null, fallback?: string) {
  return current?.snapshot?.dataUpdatedAt
    ?? current?.rainfall.measuredAt
    ?? current?.river.levelMeasuredAt
    ?? current?.generatedAt
    ?? fallback
    ?? null;
}

function buildConnectionMessage(
  municipality: { name?: string; state_code?: string } | null,
  context: MucumContext,
  current: MucumCurrentData,
  status: DashboardDataStatus,
) {
  const location = municipality?.name ? `${municipality.name}/${municipality.state_code ?? 'RS'}` : 'Mucum/RS';
  return `${location}: ${context.counts.stationsInSubBasin} estacoes e ${current.source.damsFromSupabase} barragem(ns). ${statusMessage(status)}`;
}

function statusMessage(status: DashboardDataStatus) {
  if (status === 'live') return 'Dados atualizados agora.';
  if (status === 'historical') return 'Exibindo dados historicos.';
  if (status === 'local') return 'Exibindo cache do dispositivo.';
  return 'Exibindo snapshot do servidor.';
}

function rainfallWindowLabel(hours: RainfallWindowHours) {
  if (hours === 168) return '7 dias';
  if (hours === 720) return '30 dias';
  return '24 horas';
}

function getDashboardErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'Failed to fetch' || error.message.includes('Network request failed')) {
      return 'Nao foi possivel acessar o servidor de dados. Verifique a rota /api/health e os logs do servico.';
    }

    return error.message;
  }

  return 'Erro inesperado ao carregar o painel.';
}
