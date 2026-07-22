import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, isAbsolute, relative, resolve } from 'node:path';

import {
  calculateMucumProjection,
  MUCUM_LOCAL_CRITICAL_RAIN_GAUGES,
  MUCUM_RAIN_GAUGES,
} from './mucum-projection.mjs';

loadLocalEnv();

const PORT = Number(process.env.PORT || 3001);
const ANA_BASE_URL = 'https://www.ana.gov.br/hidrowebservice';
const ANA_REQUEST_TIMEOUT_MS = 30_000;
const ANA_AUTH_TIMEOUT_MS = 15_000;
const ANA_TOKEN_FALLBACK_TTL_MS = 30 * 60 * 1000;
const ANA_TOKEN_EXPIRY_SKEW_MS = 60 * 1000;
const PROXY_PREFIX = '/api/ana';
const HEALTH_PATH = '/api/health';
const MUCUM_CONTEXT_PATH = '/api/mucum/context';
const MUCUM_CURRENT_PATH = '/api/mucum/current';
const MUCUM_FORECAST_PATH = '/api/mucum/forecast';
const MUCUM_PROJECTION_PATH = '/api/mucum/projection';
const MUCUM_HISTORICAL_FLOODS_PATH = '/api/mucum/historical-floods';
const DASHBOARD_SCOPE = 'mucum';
const STATIC_ROOT = resolve(process.cwd(), 'dist');
const DASHBOARD_SNAPSHOT_TTLS = {
  context: 24 * 60 * 60 * 1000,
  current: 10 * 60 * 1000,
  forecast: 60 * 60 * 1000,
  projection: 15 * 60 * 1000,
};
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MUCUM_PRIMARY_LEVEL_FLOW_CODES = ['86510000'];
const MUCUM_RAIN_CODES = ['2951070', '2951170'];
const REGIONAL_LEVEL_FLOW_FALLBACK_CODES = ['86720000'];
const MAX_RAIN_STATIONS_PER_CITY = 5;
const MUCUM_CONTRIBUTOR_CATALOG = JSON.parse(
  readFileSync(resolve(process.cwd(), 'shared/mucum-contributors.json'), 'utf8'),
);
const MUCUM_CONTRIBUTORS = MUCUM_CONTRIBUTOR_CATALOG.contributors;
const MUCUM_CONTRIBUTOR_RIVERS = MUCUM_CONTRIBUTORS.map((contributor) => contributor.name);
const FORECAST_POINTS = [
  { key: 'mucum', name: 'Mucum', role: 'municipio', contributorKey: 'taquari_mucum', latitude: -29.1672, longitude: -51.8686 },
  { key: 'sao_jose_ausentes', name: 'Sao Jose dos Ausentes', role: 'cabeceira_antas', contributorKey: 'antas', latitude: -28.7478, longitude: -50.0658 },
  { key: 'bom_jesus', name: 'Bom Jesus', role: 'cabeceira_antas', contributorKey: 'antas', latitude: -28.6697, longitude: -50.4295 },
  { key: 'vacaria', name: 'Vacaria', role: 'cabeceira_antas', contributorKey: 'antas', latitude: -28.5071, longitude: -50.9412 },
  { key: 'campestre_da_serra', name: 'Campestre da Serra', role: 'cabeceira_antas', contributorKey: 'antas', latitude: -28.7926, longitude: -51.0941 },
  { key: 'monte_alegre_dos_campos', name: 'Monte Alegre dos Campos', role: 'cabeceira_antas', contributorKey: 'antas', latitude: -28.6805, longitude: -50.7834 },
  { key: 'caxias_do_sul', name: 'Caxias do Sul', role: 'rio_das_antas', contributorKey: 'antas', latitude: -29.1678, longitude: -51.1794 },
  { key: 'cambara_do_sul', name: 'Cambara do Sul', role: 'rio_tainhas', contributorKey: 'tainhas', latitude: -29.0474, longitude: -50.1465 },
  { key: 'jaquirana', name: 'Jaquirana', role: 'rio_tainhas', contributorKey: 'tainhas', latitude: -28.8847, longitude: -50.3587 },
  { key: 'sao_francisco_de_paula', name: 'Sao Francisco de Paula', role: 'rio_tainhas', contributorKey: 'tainhas', latitude: -29.4481, longitude: -50.5832 },
  { key: 'ibiraiaras', name: 'Ibiraiaras', role: 'rio_carreiro', contributorKey: 'carreiro', latitude: -28.3741, longitude: -51.6377 },
  { key: 'lagoa_vermelha', name: 'Lagoa Vermelha', role: 'rio_carreiro', contributorKey: 'carreiro', latitude: -28.2086, longitude: -51.5250 },
  { key: 'muitos_capoes', name: 'Muitos Capoes', role: 'rio_turvo', contributorKey: 'turvo', latitude: -28.3134, longitude: -51.1836 },
  { key: 'marau', name: 'Marau', role: 'rio_guapore_local_critical', contributorKey: 'guapore', latitude: -28.4569, longitude: -52.1892 },
  { key: 'guapore', name: 'Guapore', role: 'rio_guapore', contributorKey: 'guapore', latitude: -28.8456, longitude: -51.8903 },
  { key: 'anta_gorda', name: 'Anta Gorda', role: 'rio_guapore', contributorKey: 'guapore', latitude: -28.9698, longitude: -52.0102 },
  { key: 'uniao_da_serra', name: 'Uniao da Serra', role: 'rio_guapore', contributorKey: 'guapore', latitude: -28.7833, longitude: -52.0236 },
  { key: 'vespasiano_correa', name: 'Vespasiano Correa', role: 'baixo_guapore', contributorKey: 'guapore', latitude: -29.0655, longitude: -51.8625 },
  { key: 'doutor_ricardo', name: 'Doutor Ricardo', role: 'baixo_guapore_santa_lucia', contributorKey: 'guapore', latitude: -29.0847, longitude: -51.9974 },
  { key: 'serafina_correa', name: 'Serafina Correa', role: 'rio_carreiro', contributorKey: 'carreiro', latitude: -28.7115, longitude: -51.9354 },
  { key: 'nova_bassano', name: 'Nova Bassano', role: 'rio_carreiro', contributorKey: 'carreiro', latitude: -28.7291, longitude: -51.7044 },
  { key: 'nova_prata', name: 'Nova Prata', role: 'rio_da_prata', contributorKey: 'prata', latitude: -28.7839, longitude: -51.6104 },
  { key: 'veranopolis', name: 'Veranopolis', role: 'rio_das_antas_uhe', contributorKey: 'antas', latitude: -28.9361, longitude: -51.5494 },
  { key: 'bento', name: 'Bento Goncalves', role: 'rio_das_antas_uhe', contributorKey: 'antas', latitude: -29.1667, longitude: -51.5167 },
  { key: 'antonio_prado', name: 'Antonio Prado', role: 'rio_das_antas', contributorKey: 'antas', latitude: -28.8565, longitude: -51.2887 },
  { key: 'nova_padua', name: 'Nova Padua', role: 'rio_das_antas', contributorKey: 'antas', latitude: -29.0280, longitude: -51.3096 },
  { key: 'cotipora_14_julho', name: 'Cotipora', role: 'uhe_14_julho', contributorKey: 'antas', latitude: -28.9958, longitude: -51.6972 },
  { key: 'nova_roma_castro_alves', name: 'Nova Roma do Sul', role: 'uhe_castro_alves', contributorKey: 'antas', latitude: -28.9886, longitude: -51.4097 },
  { key: 'sao_valentim_do_sul', name: 'Sao Valentim do Sul', role: 'foz_rio_carreiro', contributorKey: 'carreiro', latitude: -29.0451, longitude: -51.7683 },
  { key: 'dois_lajeados', name: 'Dois Lajeados', role: 'baixo_carreiro', contributorKey: 'carreiro', latitude: -28.9830, longitude: -51.8357 },
  { key: 'santa_tereza', name: 'Santa Tereza', role: 'rio_das_antas', contributorKey: 'antas', latitude: -29.1657, longitude: -51.7351 },
  { key: 'encantado', name: 'Encantado', role: 'jusante_contexto', latitude: -29.2362, longitude: -51.8706 },
  { key: 'roca_sales', name: 'Roca Sales', role: 'jusante_contexto', latitude: -29.2844, longitude: -51.8658 },
];
const DAM_TELEMETRY_CONFIGS = [
  {
    damName: 'UHE Castro Alves',
    inflowCodes: ['86298000'],
    reservoirCode: '86305000',
    outflowCodes: [],
    stationCodes: ['86298000', '86305000', '86306000'],
    sections: [
      { key: 'alca', label: 'Alca', stationCode: '86306000', stationName: 'UHE Castro Alves Alca' },
      { key: 'jusante', label: 'Jusante', stationCode: null, stationName: null, note: 'Sem estacao ANA de jusante total configurada.' },
    ],
  },
  {
    damName: 'UHE Monte Claro',
    inflowCodes: ['86448000'],
    reservoirCode: '86448000',
    outflowCodes: ['86450500'],
    stationCodes: ['86448000', '86450000', '86450500'],
    sections: [
      { key: 'alca', label: 'Alca', stationCode: '86450000', stationName: 'UHE Monte Claro Jusante 1 (Alca)' },
      { key: 'jusante', label: 'Jusante', stationCode: '86450500', stationName: 'UHE Monte Claro Jusante 2' },
    ],
  },
  {
    damName: 'UHE 14 de Julho',
    inflowCodes: ['86451000'],
    reservoirCode: '86470800',
    outflowCodes: ['86471000'],
    stationCodes: ['86451000', '86470800', '86470900', '86471000'],
    sections: [
      { key: 'alca', label: 'Alca', stationCode: '86470900', stationName: 'UHE 14 de Julho Alca' },
      { key: 'jusante', label: 'Jusante', stationCode: '86471000', stationName: 'UHE 14 de Julho Jusante' },
    ],
  },
];
const HISTORICAL_FLOOD_WINDOWS = [
  { key: 'sep-2023', label: 'Setembro de 2023', searchDate: '2023-09-08', planPeakLevelM: 26.11 },
  { key: 'nov-2023', label: 'Novembro de 2023', searchDate: '2023-11-20', planPeakLevelM: 23.20 },
  { key: 'may-2024', label: 'Maio de 2024', searchDate: '2024-05-03', planPeakLevelM: 26.10 },
  { key: 'may-2024-repeak', label: 'Repiquete de maio de 2024', searchDate: '2024-05-14', planPeakLevelM: 20.80 },
];
const HISTORICAL_DAM_FLOW_STATIONS = [
  { stationCode: '86298000', damName: 'UHE Castro Alves', signal: 'Afluencia associada' },
  { stationCode: '86306000', damName: 'UHE Castro Alves', signal: 'Defluencia associada' },
  { stationCode: '86448000', damName: 'UHE Monte Claro', signal: 'Afluencia associada' },
  { stationCode: '86450500', damName: 'UHE Monte Claro', signal: 'Defluencia associada' },
  { stationCode: '86451000', damName: 'UHE 14 de Julho', signal: 'Afluencia associada' },
  { stationCode: '86471000', damName: 'UHE 14 de Julho', signal: 'Defluencia associada' },
];

let cachedToken = null;
let cachedTokenExpiresAt = 0;
let tokenRequestPromise = null;
let cachedMucumContext = null;
let cachedMucumContextAt = 0;
let dashboardSnapshotStorageAvailable = true;
let projectionRunStorageAvailable = true;
let cachedHistoricalFloods = null;
let cachedHistoricalFloodsAt = 0;
const dashboardRefreshPromises = new Map();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, Identificador, Senha',
  'Access-Control-Max-Age': '86400',
};

const staticContentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 400, { message: 'URL invalida.' });
    return;
  }

  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders);
    response.end();
    return;
  }

  if (request.method !== 'GET') {
    sendJson(response, 405, { message: 'Metodo nao permitido.' });
    return;
  }

  const incomingUrl = new URL(request.url, `http://${request.headers.host}`);

  if (incomingUrl.pathname === HEALTH_PATH) {
    sendJson(response, 200, {
      status: 'ok',
      service: 'hydro-ana',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (incomingUrl.pathname === MUCUM_CONTEXT_PATH) {
    try {
      const context = await resolveDashboardSnapshot({
        snapshotKey: 'context',
        forceRefresh: parseRefresh(incomingUrl.searchParams.get('refresh')),
        ttlMs: DASHBOARD_SNAPSHOT_TTLS.context,
        build: buildMucumContext,
        getDataUpdatedAt: (payload) => payload.generatedAt,
      });
      sendJson(response, 200, context);
    } catch (error) {
      sendJson(response, 502, {
        message: 'Falha ao carregar contexto de Mucum pelo proxy.',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  if (incomingUrl.pathname === MUCUM_CURRENT_PATH) {
    try {
      const rainfallWindowHours = parseRainfallWindowHours(incomingUrl.searchParams.get('rainWindowHours'));
      const current = await resolveDashboardSnapshot({
        snapshotKey: 'current',
        rainfallWindowHours,
        forceRefresh: parseRefresh(incomingUrl.searchParams.get('refresh')),
        ttlMs: DASHBOARD_SNAPSHOT_TTLS.current,
        build: () => buildMucumCurrentData(incomingUrl.searchParams),
        getDataUpdatedAt: currentDataUpdatedAt,
      });
      sendJson(response, 200, current);
    } catch (error) {
      sendJson(response, 502, {
        message: 'Falha ao carregar dados atuais de Mucum pelo proxy.',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  if (incomingUrl.pathname === MUCUM_FORECAST_PATH) {
    try {
      const forecast = await resolveDashboardSnapshot({
        snapshotKey: 'forecast',
        forceRefresh: parseRefresh(incomingUrl.searchParams.get('refresh')),
        ttlMs: DASHBOARD_SNAPSHOT_TTLS.forecast,
        build: buildMucumForecast,
        getDataUpdatedAt: (payload) => payload.generatedAt,
      });
      sendJson(response, 200, forecast);
    } catch (error) {
      sendJson(response, 502, {
        message: 'Falha ao carregar previsao de chuva para Mucum.',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  if (incomingUrl.pathname === MUCUM_PROJECTION_PATH) {
    try {
      const forceRefresh = parseRefresh(incomingUrl.searchParams.get('refresh'));
      const projection = await resolveDashboardSnapshot({
        snapshotKey: 'projection',
        forceRefresh,
        ttlMs: DASHBOARD_SNAPSHOT_TTLS.projection,
        build: () => buildMucumProjection(forceRefresh),
        getDataUpdatedAt: (payload) => payload.baseTime ?? payload.generatedAt,
      });
      sendJson(response, 200, projection);
    } catch (error) {
      sendJson(response, 502, {
        message: 'Falha ao calcular a projecao hidrologica de Mucum.',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  if (incomingUrl.pathname === MUCUM_HISTORICAL_FLOODS_PATH) {
    try {
      const historicalFloods = await buildMucumHistoricalFloods();
      sendJson(response, 200, historicalFloods);
    } catch (error) {
      sendJson(response, 502, {
        message: 'Falha ao carregar as curvas historicas de Mucum.',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  if (!incomingUrl.pathname.startsWith(PROXY_PREFIX)) {
    if (incomingUrl.pathname.startsWith('/api/')) {
      sendJson(response, 404, { message: 'Rota da API nao encontrada.' });
      return;
    }

    serveStaticFile(incomingUrl.pathname, response);
    return;
  }

  const anaPath = incomingUrl.pathname.slice(PROXY_PREFIX.length);
  const targetUrl = new URL(`${ANA_BASE_URL}${anaPath}${incomingUrl.search}`);

  try {
    let anaResponse = await fetchWithTimeout(targetUrl, {
      method: 'GET',
      headers: await buildForwardHeaders(request.headers),
    }, ANA_REQUEST_TIMEOUT_MS);

    if (anaResponse.status === 401 && !request.headers.authorization) {
      const refreshedToken = await getEnvToken(true);
      if (refreshedToken) {
        anaResponse = await fetchWithTimeout(targetUrl, {
          method: 'GET',
          headers: {
            Accept: request.headers.accept || 'application/json',
            Authorization: `Bearer ${refreshedToken}`,
          },
        }, ANA_REQUEST_TIMEOUT_MS);
      }
    }

    const body = await anaResponse.text();
    const parsedBody = parseJsonOrNull(body);
    saveAnaApiResponse({
      endpointKey: getEndpointKey(anaPath),
      requestUrl: targetUrl.toString(),
      requestParams: Object.fromEntries(targetUrl.searchParams.entries()),
      httpStatus: anaResponse.status,
      payload: parsedBody ?? { raw: summarizeExternalBody(body) },
    }).catch(err => console.error('Erro ao salvar no Supabase:', err));

    if (parsedBody === null) {
      sendJson(response, anaResponse.ok ? 502 : anaResponse.status, {
        message: 'A ANA retornou uma resposta nao JSON.',
        detail: summarizeExternalBody(body),
        upstreamStatus: anaResponse.status,
      });
      return;
    }

    response.writeHead(anaResponse.status, {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    });
    response.end(body);
  } catch (error) {
    sendJson(response, 502, {
      message: 'Falha ao consultar a API da ANA pelo proxy.',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(PORT, () => {
  console.log(`Hydro ANA rodando em http://localhost:${PORT}`);
});

function serveStaticFile(pathname, response) {
  let requestedPath;

  try {
    requestedPath = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html';
  } catch {
    sendJson(response, 400, { message: 'Caminho invalido.' });
    return;
  }

  const requestedFile = resolve(STATIC_ROOT, requestedPath);
  const relativePath = relative(STATIC_ROOT, requestedFile);

  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    sendJson(response, 403, { message: 'Caminho nao permitido.' });
    return;
  }

  const filePath = isReadableFile(requestedFile)
    ? requestedFile
    : extname(requestedPath)
      ? null
      : resolve(STATIC_ROOT, 'index.html');

  if (!filePath || !isReadableFile(filePath)) {
    sendJson(response, 404, { message: 'Arquivo nao encontrado.' });
    return;
  }

  const extension = extname(filePath).toLowerCase();
  const isEntryPoint = filePath.endsWith('index.html');
  response.writeHead(200, {
    'Cache-Control': isEntryPoint ? 'no-cache, no-store, must-revalidate' : 'public, max-age=31536000, immutable',
    'Content-Type': staticContentTypes[extension] ?? 'application/octet-stream',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
  });
  createReadStream(filePath).pipe(response);
}

function isReadableFile(path) {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}

async function buildForwardHeaders(headers) {
  const forwarded = {
    Accept: headers.accept || 'application/json',
  };

  const envToken = await getEnvToken();

  if (envToken) {
    forwarded.Authorization = `Bearer ${envToken}`;
  } else if (headers.authorization) {
    forwarded.Authorization = headers.authorization;
  }

  if (headers.identificador) {
    forwarded.Identificador = headers.identificador;
  }

  if (headers.senha) {
    forwarded.Senha = headers.senha;
  }

  return forwarded;
}

async function resolveDashboardSnapshot({
  snapshotKey,
  rainfallWindowHours = 0,
  forceRefresh = false,
  ttlMs,
  build,
  getDataUpdatedAt,
}) {
  const stored = await getDashboardSnapshot(snapshotKey, rainfallWindowHours);

  if (stored && !forceRefresh) {
    // If not a forced refresh, we can return the stored payload (even if stale) and do a background refresh if we wanted to.
    // Currently, it just returns it without background refresh.
    return payloadWithSnapshot(stored.payload, stored, null);
  }

  const refreshPromise = refreshDashboardSnapshot({
    snapshotKey,
    rainfallWindowHours,
    ttlMs,
    build,
    getDataUpdatedAt,
  });

  // If forceRefresh is true, we AWAIT the refreshPromise so the user gets the fresh data.
  // We only fallback to `stored` if the refreshPromise throws an error.

  try {
    return await refreshPromise;
  } catch (error) {
    if (stored) {
      return payloadWithSnapshot(stored.payload, stored, error);
    }

    throw error;
  }
}

async function getDashboardSnapshot(snapshotKey, rainfallWindowHours) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !dashboardSnapshotStorageAvailable) {
    return null;
  }

  try {
    const response = await supabaseRest(
      `dashboard_snapshots?select=payload,data_updated_at,fetched_at,expires_at,last_error&scope=eq.${DASHBOARD_SCOPE}&snapshot_key=eq.${snapshotKey}&rain_window_hours=eq.${rainfallWindowHours}&limit=1`,
    );
    const rows = await response.json();
    return Array.isArray(rows) ? rows[0] ?? null : null;
  } catch (error) {
    handleDashboardSnapshotStorageError(error);
    return null;
  }
}

async function saveDashboardSnapshot(snapshotKey, rainfallWindowHours, snapshot) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !dashboardSnapshotStorageAvailable) {
    return;
  }

  try {
    await supabaseRest('dashboard_snapshots?on_conflict=scope,snapshot_key,rain_window_hours', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        scope: DASHBOARD_SCOPE,
        snapshot_key: snapshotKey,
        rain_window_hours: rainfallWindowHours,
        payload: snapshot.payload,
        data_updated_at: snapshot.data_updated_at,
        fetched_at: snapshot.fetched_at,
        expires_at: snapshot.expires_at,
        last_error: snapshot.last_error,
      }),
    });
  } catch (error) {
    handleDashboardSnapshotStorageError(error);
  }
}

function handleDashboardSnapshotStorageError(error) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('dashboard_snapshots') && (message.includes('PGRST205') || message.includes('404'))) {
    dashboardSnapshotStorageAvailable = false;
    console.warn('Snapshots do dashboard desativados ate rodar supabase/20260717_dashboard_snapshots.sql.');
    return;
  }

  console.warn(`Cache de snapshots indisponivel: ${message}`);
}

function payloadWithSnapshot(payload, snapshot, refreshError = null, forcedStatus = null) {
  const now = Date.now();
  const expiresAt = validIsoDate(snapshot.expires_at);
  const isStale = !expiresAt || Date.parse(expiresAt) <= now;
  const status = forcedStatus ?? (isStale || refreshError ? 'historical' : 'cache');
  const warning = refreshError
    ? `Atualizacao externa indisponivel: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}`
    : null;

  return {
    ...payload,
    snapshot: {
      status,
      dataUpdatedAt: validIsoDate(snapshot.data_updated_at) ?? validIsoDate(payload.generatedAt),
      cachedAt: validIsoDate(snapshot.fetched_at),
      expiresAt,
      isStale: status === 'historical',
      warning: warning ?? snapshot.last_error ?? null,
    },
  };
}

function currentDataUpdatedAt(payload) {
  const timestamps = [
    payload.rainfall?.measuredAt,
    payload.river?.levelMeasuredAt,
    payload.river?.flowMeasuredAt,
    payload.regionalRainfall?.lastMeasuredAt,
    ...(payload.dams ?? []).map((dam) => dam.measured_at),
  ]
    .map(validIsoDate)
    .filter(Boolean)
    .sort((left, right) => Date.parse(right) - Date.parse(left));

  return timestamps[0] ?? payload.generatedAt;
}

function validIsoDate(value) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function parseRefresh(value) {
  return ['1', 'true', 'yes'].includes(String(value ?? '').toLowerCase());
}

async function buildMucumContext() {
  const now = Date.now();
  const cacheTtlMs = 10 * 60 * 1000;

  if (cachedMucumContext && now - cachedMucumContextAt < cacheTtlMs) {
    return {
      ...cachedMucumContext,
      cache: 'hit',
    };
  }

  const [municipality, subBasin, rivers, inventory] = await Promise.all([
    anaRequest('/EstacoesTelemetricas/HidroMunicipio/v1', { 'Código do Município': '24125000' }),
    anaRequest('/EstacoesTelemetricas/HidroSubBacia/v1', { 'Código da Sub-Bacia': '86' }),
    Promise.all([
      anaRequest('/EstacoesTelemetricas/HidroRio/v1', { 'Código do Rio': '86001000' }),
      anaRequest('/EstacoesTelemetricas/HidroRio/v1', { 'Código do Rio': '86100000' }),
      anaRequest('/EstacoesTelemetricas/HidroRio/v1', { 'Código do Rio': '86131000' }),
      anaRequest('/EstacoesTelemetricas/HidroRio/v1', { 'Código do Rio': '86210000' }),
      anaRequest('/EstacoesTelemetricas/HidroRio/v1', { 'Código do Rio': '86230000' }),
    ]),
    anaRequest('/EstacoesTelemetricas/HidroInventarioEstacoes/v1', {
      'Unidade Federativa': 'RS',
      'Código da Bacia': '8',
    }),
  ]);

  const summarizedStations = normalizeItems(inventory.items)
    .filter((station) => String(station.Sub_Bacia_Codigo ?? station.codigosubbacia ?? '') === '86')
    .map(summarizeStation);
  const allStations = attachTelemetryStationCodes(summarizedStations)
    .sort((left, right) => right.priority - left.priority || left.name.localeCompare(right.name));

  const telemetryStations = allStations.filter((station) => station.isTelemetry).slice(0, 30);
  const rainfallStations = allStations.filter((station) => (
    station.isRain
    && station.operating
    && isMucumRainContributorStation(station)
  ));
  const levelStations = allStations.filter((station) => station.isLevel || station.isFlow).slice(0, 30);

  cachedMucumContext = {
    generatedAt: new Date().toISOString(),
    municipality: normalizeItems(municipality.items)[0] ?? null,
    subBasin: normalizeItems(subBasin.items)[0] ?? null,
    rivers: rivers.flatMap((item) => normalizeItems(item.items)),
    stations: {
      telemetry: telemetryStations,
      rainfall: rainfallStations,
      level: levelStations,
      allRelevant: allStations.slice(0, 80),
    },
    counts: {
      inventoryInBasin: normalizeItems(inventory.items).length,
      stationsInSubBasin: allStations.length,
      telemetry: telemetryStations.length,
      rainfall: rainfallStations.length,
      level: levelStations.length,
    },
    cache: 'miss',
  };
  cachedMucumContextAt = now;

  return cachedMucumContext;
}

async function buildMucumForecast() {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', FORECAST_POINTS.map((point) => point.latitude).join(','));
  url.searchParams.set('longitude', FORECAST_POINTS.map((point) => point.longitude).join(','));
  url.searchParams.set('hourly', 'precipitation,precipitation_probability,rain,weather_code');
  url.searchParams.set('forecast_hours', '168');
  url.searchParams.set('timezone', 'America/Sao_Paulo');
  url.searchParams.set('timeformat', 'iso8601');
  url.searchParams.set('precipitation_unit', 'mm');

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(`Open-Meteo HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 160)}`);
  }

  const payloads = Array.isArray(payload) ? payload : [payload];
  const points = FORECAST_POINTS.map((point, index) => summarizeForecastPoint(point, payloads[index] ?? null));
  const impactPoints = points.filter((point) => point.role !== 'jusante_contexto');
  const basinMax = maxForecastPoint(impactPoints);

  return {
    generatedAt: new Date().toISOString(),
    source: {
      provider: 'Open-Meteo',
      url: url.toString(),
      points: points.length,
    },
    basin: {
      next6hMm: maxNumber(impactPoints.map((point) => point.next6hMm)),
      next24hMm: maxNumber(impactPoints.map((point) => point.next24hMm)),
      next72hMm: maxNumber(impactPoints.map((point) => point.next72hMm)),
      next7dMm: maxNumber(impactPoints.map((point) => point.next7dMm)),
      peakPointName: basinMax?.name ?? null,
      peakHourMm: basinMax?.peakHourMm ?? null,
      peakHourAt: basinMax?.peakHourAt ?? null,
    },
    points,
    raw: {
      // Keep only compact metadata; the full hourly arrays stay out of the default response.
      hourlyUnits: payloads[0]?.hourly_units ?? null,
    },
  };
}

function summarizeForecastPoint(point, payload) {
  const hourly = payload?.hourly ?? {};
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  const precipitation = Array.isArray(hourly.precipitation) ? hourly.precipitation : [];
  const probabilities = Array.isArray(hourly.precipitation_probability) ? hourly.precipitation_probability : [];
  const hourlyRows = times.map((time, index) => ({
    time,
    precipitationMm: parseNumber(precipitation[index]) ?? 0,
    probabilityPct: parseNumber(probabilities[index]),
  }));
  const peak = hourlyRows.reduce((currentPeak, row) => (
    row.precipitationMm > currentPeak.precipitationMm ? row : currentPeak
  ), { time: null, precipitationMm: 0, probabilityPct: null });

  return {
    ...point,
    next6hMm: sumForecastHours(hourlyRows, 6),
    next24hMm: sumForecastHours(hourlyRows, 24),
    next72hMm: sumForecastHours(hourlyRows, 72),
    next7dMm: sumForecastHours(hourlyRows, 168),
    peakHourMm: peak.precipitationMm,
    peakHourAt: peak.time,
    peakProbabilityPct: peak.probabilityPct,
    hours: hourlyRows.slice(0, 168),
  };
}

function sumForecastHours(rows, hours) {
  return roundNumber(rows.slice(0, hours).reduce((sum, row) => sum + row.precipitationMm, 0));
}

function maxForecastPoint(points) {
  return points
    .filter((point) => typeof point.peakHourMm === 'number')
    .sort((left, right) => right.peakHourMm - left.peakHourMm)[0] ?? null;
}

function maxNumber(values) {
  const numeric = values.filter((value) => typeof value === 'number');
  return numeric.length ? Math.max(...numeric) : null;
}

async function buildMucumProjection(forceRefresh = false) {
  const currentSearchParams = new URLSearchParams({ rainWindowHours: '168' });
  const [current, forecast, projectionReadings, ensemble, glofas] = await Promise.all([
    resolveDashboardSnapshot({
      snapshotKey: 'current',
      rainfallWindowHours: 168,
      forceRefresh,
      ttlMs: DASHBOARD_SNAPSHOT_TTLS.current,
      build: () => buildMucumCurrentData(currentSearchParams),
      getDataUpdatedAt: currentDataUpdatedAt,
    }),
    resolveDashboardSnapshot({
      snapshotKey: 'forecast',
      forceRefresh,
      ttlMs: DASHBOARD_SNAPSHOT_TTLS.forecast,
      build: buildMucumForecast,
      getDataUpdatedAt: (payload) => payload.generatedAt,
    }).catch(() => null),
    fetchProjectionTelemetry().catch((error) => {
      console.warn(`Telemetria dedicada da projecao indisponivel: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }),
    fetchBasinEnsemble().catch((error) => {
      console.warn(`Ensemble meteorologico indisponivel: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }),
    fetchGlofasProjection().catch((error) => {
      console.warn(`Sinal GloFAS indisponivel: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }),
  ]);

  const projection = calculateMucumProjection({
    current,
    forecast,
    ensemble,
    glofas,
    projectionReadings,
  });
  projection.confidence.verificationStatus = await saveHydrologicalProjectionRun(projection);
  return projection;
}

async function fetchProjectionTelemetry() {
  const codes = ['86510000', '86472000', '86471000', '86160000', '86410000', '86500000', '86580000'];
  const payload = await anaRequest('/EstacoesTelemetricas/HidroinfoanaSerieTelemetricaAdotada/v2', {
    Codigos_Estacoes: codes.join(','),
    'Tipo Filtro Data': 'DATA_LEITURA',
    'Data de Busca (yyyy-MM-dd)': currentSaoPauloDate(),
    'Range Intervalo de busca': 'DIAS_2',
  });

  return summarizeTelemetryRows(normalizeItems(payload.items));
}

async function fetchBasinEnsemble() {
  const gauges = [...MUCUM_RAIN_GAUGES, ...MUCUM_LOCAL_CRITICAL_RAIN_GAUGES];
  const points = gauges.map((gauge) => ({
    ...gauge,
    point: FORECAST_POINTS.find((item) => item.key === gauge.key),
  })).filter((item) => item.point);
  const url = new URL('https://ensemble-api.open-meteo.com/v1/ensemble');
  url.searchParams.set('latitude', points.map((item) => item.point.latitude).join(','));
  url.searchParams.set('longitude', points.map((item) => item.point.longitude).join(','));
  url.searchParams.set('hourly', 'precipitation');
  url.searchParams.set('models', 'gfs_seamless');
  url.searchParams.set('forecast_hours', '72');
  url.searchParams.set('timezone', 'America/Sao_Paulo');
  url.searchParams.set('precipitation_unit', 'mm');

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Open-Meteo Ensemble HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 180)}`);
  }

  const payloads = Array.isArray(payload) ? payload : [payload];
  return {
    provider: 'Open-Meteo GFS Ensemble',
    model: 'gfs_seamless',
    url: url.toString(),
    points: points.map((item, index) => ({
      key: item.key,
      name: item.city,
      weight: item.weight,
      payload: payloads[index] ?? null,
    })),
  };
}

async function fetchGlofasProjection() {
  const url = new URL('https://flood-api.open-meteo.com/v1/flood');
  url.searchParams.set('latitude', '-29.1672');
  url.searchParams.set('longitude', '-51.8686');
  url.searchParams.set('daily', 'river_discharge,river_discharge_p25,river_discharge_median,river_discharge_p75');
  url.searchParams.set('forecast_days', '7');
  url.searchParams.set('timeformat', 'iso8601');

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Open-Meteo Flood HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 180)}`);
  }

  return { ...payload, sourceUrl: url.toString() };
}

async function buildMucumHistoricalFloods() {
  const now = Date.now();
  if (cachedHistoricalFloods && now - cachedHistoricalFloodsAt < 24 * 60 * 60 * 1000) {
    return cachedHistoricalFloods;
  }

  const events = [];
  for (const event of HISTORICAL_FLOOD_WINDOWS) {
    const levelPayload = await anaRequest('/EstacoesTelemetricas/HidroinfoanaSerieTelemetricaAdotada/v2', {
      Codigos_Estacoes: '86510000',
      'Tipo Filtro Data': 'DATA_LEITURA',
      'Data de Busca (yyyy-MM-dd)': event.searchDate,
      'Range Intervalo de busca': 'DIAS_7',
    });
    const damPayload = await anaRequest('/EstacoesTelemetricas/HidroinfoanaSerieTelemetricaAdotada/v2', {
      Codigos_Estacoes: HISTORICAL_DAM_FLOW_STATIONS.map((station) => station.stationCode).join(','),
      'Tipo Filtro Data': 'DATA_LEITURA',
      'Data de Busca (yyyy-MM-dd)': event.searchDate,
      'Range Intervalo de busca': 'DIAS_7',
    });
    const rawItems = [...normalizeItems(levelPayload.items), ...normalizeItems(damPayload.items)];
    const readings = rawItems
      .filter((item) => String(item.codigoestacao) === '86510000')
      .map((item) => ({
        time: normalizeAnaTimestamp(item.Data_Hora_Medicao),
        levelM: roundNumber(Number(item.Cota_Adotada) / 100),
      }))
      .filter((item) => item.time && Number.isFinite(item.levelM) && item.levelM > 0)
      .sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime());
    const peak = readings.reduce((highest, reading) => reading.levelM > highest.levelM ? reading : highest, readings[0]);
    const peakTime = new Date(peak.time).getTime();
    const hourlyByOffset = new Map();

    readings.forEach((reading) => {
      const rawOffset = (new Date(reading.time).getTime() - peakTime) / (60 * 60 * 1000);
      const hourFromPeak = Math.round(rawOffset);
      if (hourFromPeak < -96 || hourFromPeak > 12) return;
      const existing = hourlyByOffset.get(hourFromPeak);
      if (!existing || Math.abs(rawOffset - hourFromPeak) < existing.distance) {
        hourlyByOffset.set(hourFromPeak, { hourFromPeak, time: reading.time, levelM: reading.levelM, distance: Math.abs(rawOffset - hourFromPeak) });
      }
    });

    const damFlows = HISTORICAL_DAM_FLOW_STATIONS.map((station) => {
      const flowReadings = rawItems
        .filter((item) => String(item.codigoestacao) === station.stationCode)
        .filter((item) => item.Vazao_Adotada !== null && item.Vazao_Adotada !== undefined && item.Vazao_Adotada !== '')
        .map((item) => ({
          time: normalizeAnaTimestamp(item.Data_Hora_Medicao),
          flowM3s: roundNumber(Number(item.Vazao_Adotada)),
        }))
        .filter((item) => item.time && Number.isFinite(item.flowM3s) && item.flowM3s >= 0)
        .sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime());
      const hourlyFlows = new Map();
      flowReadings.forEach((reading) => {
        const rawOffset = (new Date(reading.time).getTime() - peakTime) / (60 * 60 * 1000);
        const hourFromFloodPeak = Math.round(rawOffset);
        if (hourFromFloodPeak < -96 || hourFromFloodPeak > 12) return;
        const existing = hourlyFlows.get(hourFromFloodPeak);
        if (!existing || reading.flowM3s > existing.flowM3s) {
          hourlyFlows.set(hourFromFloodPeak, { hourFromFloodPeak, time: reading.time, flowM3s: reading.flowM3s, distance: Math.abs(rawOffset - hourFromFloodPeak) });
        }
      });
      const displayedPoints = [...hourlyFlows.values()]
        .sort((left, right) => left.hourFromFloodPeak - right.hourFromFloodPeak)
        .map(({ distance, ...point }) => point);
      const maximum = displayedPoints.length
        ? displayedPoints.reduce((highest, reading) => reading.flowM3s > highest.flowM3s ? reading : highest, displayedPoints[0])
        : null;

      return {
        ...station,
        availableReadings: flowReadings.length,
        maximumFlowM3s: maximum?.flowM3s ?? null,
        maximumFlowAt: maximum?.time ?? null,
        points: displayedPoints,
      };
    });

    events.push({
      ...event,
      telemetryPeakLevelM: peak.levelM,
      telemetryPeakAt: peak.time,
      peakDifferenceM: roundNumber(peak.levelM - event.planPeakLevelM),
      points: [...hourlyByOffset.values()]
        .sort((left, right) => left.hourFromPeak - right.hourFromPeak)
        .map(({ distance, ...point }) => point),
      damFlows,
    });
  }

  cachedHistoricalFloods = {
    generatedAt: new Date().toISOString(),
    stationCode: '86510000',
    stationName: 'Mucum',
    source: 'ANA HidroWeb - serie telemetrica adotada',
    alignment: 'Horas relativas ao maior valor telemetrico de cada janela de sete dias.',
    caveat: 'As cotas da telemetria e do plano podem usar referencias diferentes. Elas sao exibidas separadamente e nao foram ajustadas para coincidir.',
    events,
  };
  cachedHistoricalFloodsAt = now;
  return cachedHistoricalFloods;
}

async function saveHydrologicalProjectionRun(projection) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return 'armazenamento_de_rodadas_nao_configurado';
  if (!projectionRunStorageAvailable) return 'tabela_de_rodadas_nao_instalada';

  try {
    await supabaseRest('hydrological_projection_runs', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        scope: DASHBOARD_SCOPE,
        model_version: projection.model.version,
        generated_at: projection.generatedAt,
        base_time: projection.baseTime,
        horizon_hours: projection.horizonHours,
        current_level_m: projection.current.levelM,
        likely_peak_level_m: projection.peaks.likely.levelM,
        likely_peak_at: projection.peaks.likely.at,
        confidence_pct: projection.confidence.overallPct,
        payload: projection,
      }),
    });
    return 'coletando_historico_de_previsoes';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('hydrological_projection_runs') && (message.includes('PGRST205') || message.includes('404'))) {
      projectionRunStorageAvailable = false;
      console.warn('Historico de projecoes desativado ate rodar supabase/20260718_hydrological_projections.sql.');
      return 'tabela_de_rodadas_nao_instalada';
    }
    console.warn(`Nao foi possivel salvar a rodada da projecao: ${message}`);
    return 'falha_ao_armazenar_rodada';
  }
}

async function buildMucumCurrentData(searchParams = new URLSearchParams()) {
  const context = await buildMucumContext();
  const warnings = [];
  const rainfallWindowHours = parseRainfallWindowHours(searchParams.get('rainWindowHours'));
  const telemetryRange = telemetryRangeForHours(rainfallWindowHours);
  const upstreamRiverStations = selectUpstreamRiverStations(context.stations.level);
  const telemetryCodes = uniqueStationCodes([
    ...MUCUM_PRIMARY_LEVEL_FLOW_CODES,
    ...MUCUM_RAIN_CODES,
    '86581000',
    ...upstreamRiverStations.map((station) => station.code),
  ]).slice(0, 10);

  let telemetryPayload = { items: [] };
  if (telemetryCodes.length) {
    try {
      telemetryPayload = await anaRequest('/EstacoesTelemetricas/HidroinfoanaSerieTelemetricaAdotada/v2', {
        Codigos_Estacoes: telemetryCodes.join(','),
        'Tipo Filtro Data': 'DATA_LEITURA',
        'Data de Busca (yyyy-MM-dd)': currentSaoPauloDate(),
        'Range Intervalo de busca': telemetryRange,
      });
    } catch (error) {
      warnings.push(`Telemetria principal ANA indisponivel: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const telemetryRows = normalizeItems(telemetryPayload.items);
  const primaryStationReadings = enrichStationReadings(summarizeTelemetryRows(telemetryRows), context);
  const regionalResult = await buildRegionalRainfall(context, primaryStationReadings, rainfallWindowHours);
  const stationReadings = mergeStationReadings(primaryStationReadings, regionalResult.readings);
  const { readings: _regionalReadings, ...regionalRainfall } = regionalResult;
  const stationCacheSync = await saveStationReadingsAndAggregates(stationReadings, rainfallWindowHours, context, warnings);
  const latestRain = latestMetric(stationReadings, 'rainfallMm', [...MUCUM_RAIN_CODES, ...MUCUM_PRIMARY_LEVEL_FLOW_CODES]);
  const accumulatedRain = accumulatedRainfall(stationReadings, [...MUCUM_PRIMARY_LEVEL_FLOW_CODES, ...MUCUM_RAIN_CODES], rainfallWindowHours);
  const latestLevel = latestMetric(stationReadings, 'riverLevelM', [...MUCUM_PRIMARY_LEVEL_FLOW_CODES, ...REGIONAL_LEVEL_FLOW_FALLBACK_CODES]);
  const latestFlow = latestMetric(stationReadings, 'flowM3s', [...MUCUM_PRIMARY_LEVEL_FLOW_CODES, ...REGIONAL_LEVEL_FLOW_FALLBACK_CODES]);
  let damTelemetrySync = { telemetryRows: 0, savedReadings: 0, readings: [] };
  try {
    damTelemetrySync = await syncDamReadingsFromAna();
  } catch (error) {
    warnings.push(`Telemetria ANA das barragens indisponivel: ${error instanceof Error ? error.message : String(error)}`);
  }
  const damReadings = await getLatestDamReadings();

  return {
    generatedAt: new Date().toISOString(),
    source: {
      telemetryCodes,
      telemetryRows: telemetryRows.length,
      telemetryRange,
      damsFromSupabase: damReadings.length,
      regionalRainStations: regionalRainfall.stationCount,
      damTelemetryRows: damTelemetrySync.telemetryRows,
      damReadingsSaved: damTelemetrySync.savedReadings,
      stationReadingsSaved: stationCacheSync.savedReadings,
      rainfallAggregatesSaved: stationCacheSync.savedAggregates,
      warnings,
    },
    rainfall: {
      currentMm: accumulatedRain?.totalMm ?? latestRain?.value ?? null,
      accumulatedMm: accumulatedRain?.totalMm ?? null,
      accumulated24hMm: rainfallWindowHours === 24 ? accumulatedRain?.totalMm ?? null : null,
      instantMm: latestRain?.value ?? null,
      stationName: accumulatedRain?.stationName ?? latestRain?.stationName ?? null,
      stationCode: accumulatedRain?.stationCode ?? latestRain?.stationCode ?? null,
      measuredAt: accumulatedRain?.lastMeasuredAt ?? latestRain?.measuredAt ?? null,
      windowHours: accumulatedRain?.windowHours ?? rainfallWindowHours,
    },
    river: {
      currentLevelM: latestLevel?.value ?? null,
      currentFlowM3s: latestFlow?.value ?? null,
      levelStationName: latestLevel?.stationName ?? null,
      levelStationCode: latestLevel?.stationCode ?? null,
      flowStationName: latestFlow?.stationName ?? null,
      flowStationCode: latestFlow?.stationCode ?? null,
      levelMeasuredAt: latestLevel?.measuredAt ?? null,
      flowMeasuredAt: latestFlow?.measuredAt ?? null,
    },
    dams: damReadings,
    regionalRainfall,
    stationReadings,
    raw: {
      telemetry: telemetryPayload,
    },
  };
}

function uniqueStationCodes(codes) {
  return Array.from(new Set(codes.filter(Boolean).map(String)));
}

async function saveStationReadingsAndAggregates(readings, rainfallWindowHours, context, warnings = []) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !readings.length) {
    return { savedReadings: 0, savedAggregates: 0 };
  }

  try {
    const stations = await upsertMonitoringStations(readings, context);
    const savedReadings = await upsertStationReadings(readings, stations);
    const savedAggregates = await upsertRainfallAggregates(readings, stations, rainfallWindowHours);

    return { savedReadings, savedAggregates };
  } catch (error) {
    warnings.push(`Cache Supabase de estacoes indisponivel: ${error instanceof Error ? error.message : String(error)}`);
    return { savedReadings: 0, savedAggregates: 0 };
  }
}

async function upsertMonitoringStations(readings, context) {
  const relevantByCode = new Map(context.stations.allRelevant.map((station) => [station.code, station]));
  const stationRows = Array.from(new Map(readings
    .filter((reading) => reading.stationCode)
    .map((reading) => {
      const station = relevantByCode.get(reading.stationCode);
      return [reading.stationCode, {
        ana_code: reading.stationCode,
        name: reading.stationName || station?.name || reading.stationCode,
        kind: station?.isRain ? 'rain' : 'telemetry',
        river_name: reading.river || station?.river || null,
        state_code: 'RS',
        city_name: reading.city || station?.city || null,
        basin_code: station?.basinCode || '8',
        sub_basin_code: station?.subBasinCode || '86',
        latitude: station?.latitude ?? null,
        longitude: station?.longitude ?? null,
        upstream_of_mucum: station?.upstreamOfMucum ?? isMucumUpstreamLocation(reading.city, reading.river),
        priority: station?.priority ?? 0,
        is_active: true,
        notes: 'Sincronizado automaticamente pelo proxy Hydro ANA.',
      }];
    })).values());

  if (!stationRows.length) {
    return new Map();
  }

  const response = await supabaseRest('monitoring_stations?on_conflict=ana_code,kind', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(stationRows),
  });
  const rows = await response.json();

  return new Map(rows.map((station) => [station.ana_code, station]));
}

async function upsertStationReadings(readings, stationsByCode) {
  const rows = readings
    .map((reading) => {
      const station = stationsByCode.get(reading.stationCode);

      if (!station || !reading.measuredAt) {
        return null;
      }

      return {
        station_id: station.id,
        measured_at: normalizeAnaTimestamp(reading.measuredAt),
        river_level_m: reading.riverLevelM,
        rainfall_mm: reading.rainfallMm,
        flow_m3s: reading.flowM3s,
        raw_payload: reading.raw ?? {},
      };
    })
    .filter(Boolean);

  if (!rows.length) {
    return 0;
  }

  await supabaseRest('station_readings?on_conflict=station_id,measured_at', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });

  return rows.length;
}

async function upsertRainfallAggregates(readings, stationsByCode, selectedWindowHours) {
  const windowHoursList = [24, 168, 720, selectedWindowHours]
    .filter((value, index, values) => values.indexOf(value) === index);
  const rainfallStationCodes = uniqueStationCodes(readings
    .filter((reading) => typeof reading.rainfallMm === 'number')
    .map((reading) => reading.stationCode));
  const rows = rainfallStationCodes.flatMap((stationCode) => windowHoursList.map((windowHours) => {
    const aggregate = accumulatedRainfall(readings, [stationCode], windowHours);
    const station = aggregate ? stationsByCode.get(aggregate.stationCode) : null;

    if (!aggregate || !station || !aggregate.lastMeasuredAt) {
      return null;
    }

    const endsAt = normalizeAnaTimestamp(aggregate.lastMeasuredAt);
    const startsAt = new Date(new Date(endsAt).getTime() - windowHours * 60 * 60 * 1000).toISOString();

    return {
      station_id: station.id,
      window_hours: windowHours,
      starts_at: startsAt,
      ends_at: endsAt,
      rainfall_mm: aggregate.totalMm,
      raw_payload: aggregate,
    };
  })).filter(Boolean);

  if (!rows.length) {
    return 0;
  }

  await supabaseRest('rainfall_aggregates?on_conflict=station_id,window_hours,starts_at,ends_at', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });

  return rows.length;
}

async function supabaseRest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase ${path} HTTP ${response.status}: ${detail.slice(0, 180)}`);
  }

  return response;
}

function parseRainfallWindowHours(value) {
  const parsed = Number(value);
  const allowed = [24, 168, 720];

  return allowed.includes(parsed) ? parsed : 24;
}

function telemetryRangeForHours(hours) {
  if (hours >= 720) {
    return 'DIAS_30';
  }

  if (hours >= 168) {
    return 'DIAS_7';
  }

  return 'DIAS_2';
}

function enrichStationReadings(readings, context) {
  const stationByCode = new Map(
    [
      ...context.stations.allRelevant,
      ...context.stations.rainfall,
      ...context.stations.level,
      ...context.stations.telemetry,
    ].map((station) => [station.code, station]),
  );

  return readings.map((reading) => {
    const station = stationByCode.get(reading.stationCode);

    if (!station) {
      return reading;
    }

    return {
      ...reading,
      stationName: reading.stationName || station.name,
      city: station.city,
      river: station.river,
    };
  });
}

async function buildRegionalRainfall(context, telemetryReadings, rainfallWindowHours = 24) {
  const telemetryByStation = groupRainReadingsByStation(telemetryReadings);
  const selectedRainStations = selectRegionalRainStations(context.stations.rainfall);
  const telemetryRainStations = selectedRainStations.filter((station) => station.isTelemetry);
  const telemetryRainCodes = uniqueStationCodes(
    telemetryRainStations.map(telemetryQueryCode).filter(Boolean),
  );
  const missingTelemetryRainCodes = telemetryRainCodes.filter((code) => !telemetryByStation.get(code)?.length);

  if (missingTelemetryRainCodes.length) {
    for (const stationCodeBatch of chunkArray(missingTelemetryRainCodes, 10)) {
      try {
        const telemetryRainPayload = await anaRequest('/EstacoesTelemetricas/HidroinfoanaSerieTelemetricaAdotada/v2', {
          Codigos_Estacoes: stationCodeBatch.join(','),
          'Tipo Filtro Data': 'DATA_LEITURA',
          'Data de Busca (yyyy-MM-dd)': currentSaoPauloDate(),
          'Range Intervalo de busca': telemetryRangeForHours(rainfallWindowHours),
        });
        const additionalReadings = enrichStationReadings(
          summarizeTelemetryRows(normalizeItems(telemetryRainPayload.items)),
          context,
        );
        mergeRainReadingsByStation(telemetryByStation, additionalReadings);
      } catch (error) {
        console.warn(`Nao foi possivel buscar lote de telemetria regional de chuva: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  const telemetryResults = await mapWithConcurrency(
    telemetryRainStations,
    5,
    async (station) => {
      const batchReadings = aliasTelemetryReadingsForRainStation(
        station,
        telemetryByStation.get(telemetryQueryCode(station)) ?? [],
      );
      if (batchReadings.length) {
        return {
          summary: summarizeRegionalRainStation(station, batchReadings, rainfallWindowHours, 'telemetria'),
          readings: batchReadings,
        };
      }

      return fetchTelemetryRainStation(station, rainfallWindowHours);
    },
  );
  const telemetryRain = telemetryResults.map((result) => result.summary);
  const conventionalStations = selectedRainStations.filter((station) => !station.isTelemetry);
  const conventionalResults = await mapWithConcurrency(
    conventionalStations,
    4,
    (station) => fetchConventionalRainStation(station, rainfallWindowHours),
  );
  const conventionalRain = conventionalResults.map((result) => result.summary);
  const regionalReadings = mergeStationReadings(
    telemetryResults.flatMap((result) => result.readings),
    conventionalResults.flatMap((result) => result.readings),
  );
  const stations = [...telemetryRain, ...conventionalRain]
    .filter(Boolean)
    .sort((left, right) => (right.rainfallMm ?? -1) - (left.rainfallMm ?? -1));
  const cities = summarizeRegionalRainCities(stations);
  const withRain = cities.filter((city) => typeof city.rainfallMm === 'number');
  const rainfallValues = withRain.map((city) => city.rainfallMm);
  const totalMm = rainfallValues.length ? roundNumber(rainfallValues.reduce((sum, value) => sum + value, 0)) : null;
  const maxMm = rainfallValues.length ? Math.max(...rainfallValues) : null;
  const avgMm = rainfallValues.length && totalMm !== null ? roundNumber(totalMm / rainfallValues.length) : null;
  const lastMeasuredAt = cities
    .map((city) => city.measuredAt)
    .filter(Boolean)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;

  return {
    basinName: 'Taquari-Antas / sub-bacia 86',
    scope: {
      outletCity: 'Mucum',
      outletStationCode: '86510000',
      upstreamOnly: false,
      includesLocalCritical: true,
      rivers: MUCUM_CONTRIBUTOR_RIVERS,
      contributors: MUCUM_CONTRIBUTORS.map(({ riverPatterns: _riverPatterns, cities: _cities, ...contributor }) => contributor),
      downstreamContext: MUCUM_CONTRIBUTOR_CATALOG.downstreamContext,
    },
    windowHours: rainfallWindowHours,
    stationCount: stations.length,
    cityCount: cities.length,
    withRainCount: withRain.length,
    maxMm,
    avgMm,
    totalMm,
    lastMeasuredAt,
    stations,
    cities,
    readings: regionalReadings,
  };
}

function selectRegionalRainStations(stations) {
  const candidatesByCity = new Map();

  stations
    .filter((station) => station.operating && station.code && isMucumRainContributorStation(station))
    .forEach((station) => {
      const cityKey = normalizeText(station.city || station.name || station.code);
      const cityCandidates = candidatesByCity.get(cityKey) ?? [];
      cityCandidates.push(station);
      candidatesByCity.set(cityKey, cityCandidates);
    });

  return Array.from(candidatesByCity.values()).flatMap(selectRainStationCandidatesForCity);
}

function selectRainStationCandidatesForCity(stations) {
  const ordered = stations
    .slice()
    .sort((left, right) => right.priority - left.priority || left.name.localeCompare(right.name));
  const telemetry = ordered.filter((station) => station.isTelemetry);
  const conventional = ordered.filter((station) => !station.isTelemetry);
  const selected = [];

  if (telemetry[0]) selected.push(telemetry[0]);
  if (conventional[0]) selected.push(conventional[0]);

  [...telemetry.slice(1), ...conventional.slice(1)]
    .sort((left, right) => right.priority - left.priority || left.name.localeCompare(right.name))
    .forEach((station) => {
      if (selected.length < MAX_RAIN_STATIONS_PER_CITY && !selected.some((candidate) => candidate.code === station.code)) {
        selected.push(station);
      }
    });

  return selected;
}

function telemetryQueryCode(station) {
  return station.telemetryCode || station.code;
}

function aliasTelemetryReadingsForRainStation(station, readings) {
  return readings.map((reading) => ({
    ...reading,
    stationCode: station.code,
    stationName: station.name,
    city: station.city,
    river: station.river,
    raw: {
      ...reading.raw,
      Codigo_Estacao_Telemetrica_Origem: reading.stationCode,
      Codigo_Estacao_Pluviometrica: station.code,
    },
  }));
}

function selectUpstreamRiverStations(stations) {
  const bestByRiver = new Map();

  stations
    .filter((station) => station.operating && station.isTelemetry && station.code && isMucumRainContributorStation(station))
    .forEach((station) => {
      const riverKey = normalizeText(station.river || station.name || station.code);
      if (!bestByRiver.has(riverKey)) {
        bestByRiver.set(riverKey, station);
      }
    });

  return Array.from(bestByRiver.values());
}

function summarizeRegionalRainCities(stations) {
  const grouped = new Map();

  stations.forEach((station) => {
    const city = station.city || station.stationName || 'Municipio nao informado';
    const cityKey = normalizeText(city);
    const cityStations = grouped.get(cityKey) ?? [];
    cityStations.push(station);
    grouped.set(cityKey, cityStations);
  });

  return Array.from(grouped.values()).map((cityStations) => {
    const representative = cityStations
      .slice()
      .sort((left, right) => (right.rainfallMm ?? -1) - (left.rainfallMm ?? -1))[0];
    const dailyByDate = new Map();

    cityStations.flatMap((station) => station.daily ?? []).forEach((day) => {
      const current = dailyByDate.get(day.date);
      if (!current || day.rainfallMm > current.rainfallMm) {
        dailyByDate.set(day.date, day);
      }
    });

    const daily = Array.from(dailyByDate.values()).sort((left, right) => left.date.localeCompare(right.date));
    const peak = daily.slice().sort((left, right) => right.rainfallMm - left.rainfallMm)[0] ?? null;

    return {
      city: representative.city || representative.stationName,
      rainfallMm: representative.rainfallMm,
      maxDailyMm: peak?.rainfallMm ?? null,
      peakDate: peak?.date ?? null,
      stationCount: cityStations.length,
      stationName: representative.stationName,
      measuredAt: representative.measuredAt,
      contributorKey: representative.contributorKey ?? null,
      contributorName: representative.contributorName ?? null,
      contributorRelation: representative.contributorRelation ?? null,
      influence: representative.influence ?? null,
      daily,
    };
  }).sort((left, right) => (right.rainfallMm ?? -1) - (left.rainfallMm ?? -1));
}

function groupRainReadingsByStation(readings) {
  const grouped = new Map();
  mergeRainReadingsByStation(grouped, readings);
  return grouped;
}

function mergeRainReadingsByStation(grouped, readings) {
  readings
    .filter((reading) => reading.stationCode && typeof reading.rainfallMm === 'number')
    .forEach((reading) => {
      const stationReadings = grouped.get(reading.stationCode) ?? [];
      stationReadings.push(reading);
      grouped.set(reading.stationCode, stationReadings);
    });
}

function summarizeRegionalRainStation(station, readings, rainfallWindowHours, source) {
  const aggregate = accumulatedRainfall(readings, [station.code], rainfallWindowHours);
  const daily = buildDailyRainfall(readings, rainfallWindowHours);
  const latest = readings
    .filter((reading) => reading.measuredAt)
    .slice()
    .sort((left, right) => Date.parse(right.measuredAt) - Date.parse(left.measuredAt))[0];

  return summarizeRainStation(
    station,
    aggregate
      ? { measuredAt: aggregate.lastMeasuredAt, rainfallMm: aggregate.totalMm }
      : latest ?? null,
    source,
    readings.length,
    null,
    rainfallWindowHours,
    daily,
  );
}

async function fetchTelemetryRainStation(station, rainfallWindowHours = 24) {
  try {
    const payload = await anaRequest('/EstacoesTelemetricas/HidroinfoanaSerieTelemetricaAdotada/v1', {
      'Código da Estação': station.code,
      'Tipo Filtro Data': 'DATA_LEITURA',
      'Data de Busca (yyyy-MM-dd)': currentSaoPauloDate(),
      'Range Intervalo de busca': telemetryRangeForHours(rainfallWindowHours),
    });
    const rows = normalizeItems(payload.items);
    const readings = aliasTelemetryReadingsForRainStation(station, summarizeTelemetryRows(rows));

    return {
      summary: summarizeRegionalRainStation(station, readings, rainfallWindowHours, 'telemetria'),
      readings,
    };
  } catch (error) {
    return {
      summary: summarizeRainStation(
        station,
        null,
        'telemetria',
        0,
        error instanceof Error ? error.message : String(error),
        rainfallWindowHours,
        [],
      ),
      readings: [],
    };
  }
}

async function fetchConventionalRainStation(station, rainfallWindowHours = 24) {
  const todayDate = new Date();
  const startDate = new Date(Date.now() - rainfallWindowHours * 60 * 60 * 1000);

  try {
    const payload = await anaRequest('/EstacoesTelemetricas/HidroSerieChuva/v1', {
      'Código da Estação': station.code,
      'Tipo Filtro Data': 'DATA_LEITURA',
      'Data Inicial (yyyy-MM-dd)': formatDate(startDate),
      'Data Final (yyyy-MM-dd)': formatDate(todayDate),
    });
    const rows = normalizeItems(payload.items);
    const readings = rows
      .map((row) => ({
        stationCode: station.code,
        stationName: station.name,
        city: station.city,
        river: station.river,
        measuredAt: stringFromKeys(row, ['DataHora', 'Data_Hora_Medicao', 'Data_Medicao', 'DataHoraMedicao', 'Data']),
        rainfallMm: numberFromKeyIncludes(row, ['chuva', 'precipit']),
        riverLevelM: null,
        flowM3s: null,
        raw: row,
      }))
      .filter((item) => typeof item.rainfallMm === 'number' && item.measuredAt)
      .sort((left, right) => Date.parse(right.measuredAt || '') - Date.parse(left.measuredAt || ''));
    const latest = readings[0];
    const aggregate = accumulatedRainfall(readings, [station.code], rainfallWindowHours);
    const daily = buildDailyRainfall(readings, rainfallWindowHours);

    return {
      summary: summarizeRainStation(
        station,
        latest ? { measuredAt: latest.measuredAt, rainfallMm: aggregate?.totalMm ?? null } : null,
        'convencional',
        rows.length,
        null,
        rainfallWindowHours,
        daily,
      ),
      readings,
    };
  } catch (error) {
    return {
      summary: summarizeRainStation(
        station,
        null,
        'convencional',
        0,
        error instanceof Error ? error.message : String(error),
        rainfallWindowHours,
        [],
      ),
      readings: [],
    };
  }
}

function summarizeRainStation(station, reading, source, rawCount = 1, error = null, windowHours = 24, daily = []) {
  const contributor = station.contributorKey
    ? {
        key: station.contributorKey,
        name: station.contributorName,
        relation: station.contributorRelation,
        influence: station.influence,
      }
    : classifyMucumContributor(station.city, station.river);

  return {
    stationCode: station.code,
    stationName: station.name,
    city: station.city,
    river: station.river,
    contributorKey: contributor?.key ?? null,
    contributorName: contributor?.name ?? null,
    contributorRelation: contributor?.relation ?? null,
    influence: contributor?.influence ?? null,
    measuredAt: reading?.measuredAt ?? null,
    rainfallMm: reading?.rainfallMm ?? null,
    windowHours,
    source,
    rawCount,
    error,
    daily,
  };
}

function buildDailyRainfall(readings, windowHours = 24) {
  const candidates = readings
    .filter((reading) => typeof reading.rainfallMm === 'number' && reading.measuredAt)
    .slice()
    .sort((left, right) => Date.parse(left.measuredAt) - Date.parse(right.measuredAt));
  const latestTime = Math.max(...candidates.map((reading) => Date.parse(reading.measuredAt)).filter(Number.isFinite));

  if (!Number.isFinite(latestTime)) {
    return [];
  }

  const windowStart = latestTime - windowHours * 60 * 60 * 1000;
  const daily = new Map();

  candidates.forEach((reading) => {
    const measuredAt = Date.parse(reading.measuredAt);
    if (!Number.isFinite(measuredAt) || measuredAt <= windowStart || measuredAt > latestTime) return;

    const date = localDateKey(reading.measuredAt);
    if (!date) return;
    const current = daily.get(date) ?? { date, rainfallMm: 0, readingCount: 0 };
    current.rainfallMm += reading.rainfallMm;
    current.readingCount += 1;
    daily.set(date, current);
  });

  return Array.from(daily.values())
    .map((day) => ({ ...day, rainfallMm: roundNumber(day.rainfallMm) }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

function localDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}`;
}

function mergeStationReadings(...readingGroups) {
  const merged = new Map();

  readingGroups.flat().forEach((reading) => {
    if (!reading?.stationCode || !reading?.measuredAt) return;
    const key = `${reading.stationCode}|${normalizeAnaTimestamp(reading.measuredAt)}`;
    const current = merged.get(key);
    merged.set(key, current ? { ...current, ...reading } : reading);
  });

  return Array.from(merged.values()).sort((left, right) => Date.parse(left.measuredAt) - Date.parse(right.measuredAt));
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

async function syncDamReadingsFromAna() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { telemetryRows: 0, savedReadings: 0, readings: [] };
  }

  const allCodes = uniqueStationCodes(DAM_TELEMETRY_CONFIGS.flatMap((config) => config.stationCodes));
  const payload = await anaRequest('/EstacoesTelemetricas/HidroinfoanaSerieTelemetricaAdotada/v2', {
    Codigos_Estacoes: allCodes.join(','),
    'Tipo Filtro Data': 'DATA_LEITURA',
    'Data de Busca (yyyy-MM-dd)': currentSaoPauloDate(),
    'Range Intervalo de busca': 'DIAS_2',
  });
  const telemetryRows = normalizeItems(payload.items);
  const latestByStation = latestTelemetryByStation(telemetryRows);
  const dams = await getActiveDams();
  const readings = DAM_TELEMETRY_CONFIGS
    .map((config) => buildDamReadingFromTelemetry(config, latestByStation, dams))
    .filter(Boolean);

  if (!readings.length) {
    return { telemetryRows: telemetryRows.length, savedReadings: 0, readings: [] };
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/dam_readings?on_conflict=dam_id,measured_at`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(readings),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.warn(`Nao foi possivel salvar leituras ANA das barragens: HTTP ${response.status} ${detail}`);
    return { telemetryRows: telemetryRows.length, savedReadings: 0, readings };
  }

  return { telemetryRows: telemetryRows.length, savedReadings: readings.length, readings };
}

async function getActiveDams() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/dams?select=id,name&is_active=eq.true&upstream_of_mucum=eq.true`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!response.ok) {
    return new Map();
  }

  const rows = await response.json();
  return new Map(rows.map((dam) => [normalizeText(dam.name), dam]));
}

function latestTelemetryByStation(rows) {
  const latest = new Map();

  rows.forEach((row) => {
    const reading = summarizeTelemetryRows([row])[0];

    if (!reading.stationCode) {
      return;
    }

    const current = latest.get(reading.stationCode);
    if (!current || Date.parse(reading.measuredAt || '') > Date.parse(current.measuredAt || '')) {
      latest.set(reading.stationCode, reading);
    }
  });

  return latest;
}

function buildDamReadingFromTelemetry(config, latestByStation, damsByName) {
  const dam = damsByName.get(normalizeText(config.damName));

  if (!dam) {
    return null;
  }

  const stations = Object.fromEntries(
    config.stationCodes.map((code) => [code, latestByStation.get(code) ?? null]),
  );
  const measuredAt = latestMeasuredAt(Object.values(stations));

  if (!measuredAt) {
    return null;
  }

  const inflowValues = config.inflowCodes
    .map((code) => stations[code]?.flowM3s)
    .filter((value) => typeof value === 'number');
  const outflowValues = config.outflowCodes
    .map((code) => stations[code]?.flowM3s)
    .filter((value) => typeof value === 'number');
  const reservoirReading = stations[config.reservoirCode] ?? null;

  return {
    dam_id: dam.id,
    measured_at: normalizeAnaTimestamp(measuredAt),
    inflow_m3s: sumOrNull(inflowValues),
    outflow_m3s: sumOrNull(outflowValues),
    reservoir_level_m: reservoirReading?.riverLevelM ?? null,
    spillway_status: null,
    source: 'ana_telemetria_uhe',
    raw_payload: {
      damName: config.damName,
      inflowCodes: config.inflowCodes,
      reservoirCode: config.reservoirCode,
      outflowCodes: config.outflowCodes,
      sections: config.sections,
      note: 'Leitura derivada de estacoes telemetricas ANA associadas a UHE/barramento. Nao substitui boletim operacional oficial da usina.',
      stations,
    },
  };
}

function latestMeasuredAt(readings) {
  return readings
    .map((reading) => reading?.measuredAt)
    .filter(Boolean)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
}

function normalizeAnaTimestamp(value) {
  if (!value) return value;
  const raw = String(value).trim().replace(' ', 'T');
  const hasExplicitTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const normalized = hasExplicitTimezone
    ? raw
    : `${raw.replace(/\.\d+$/, '')}-03:00`;
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString();
}

function sumOrNull(values) {
  return values.length ? roundNumber(values.reduce((sum, value) => sum + value, 0)) : null;
}

async function getLatestDamReadings() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/v_latest_dam_readings?select=*&upstream_of_mucum=eq.true&order=dam_name.asc`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!response.ok) {
    return [];
  }

  const rows = await response.json();
  return rows.map(enrichDamHydrometricSections);
}

function enrichDamHydrometricSections(dam) {
  const config = DAM_TELEMETRY_CONFIGS.find((item) => normalizeText(item.damName) === normalizeText(dam.dam_name));
  const stations = dam.raw_payload?.stations ?? {};
  const hydrometricSections = (config?.sections ?? []).map((section) => {
    const reading = section.stationCode ? stations[section.stationCode] ?? null : null;
    return {
      key: section.key,
      label: section.label,
      station_code: section.stationCode,
      station_name: section.stationName,
      flow_m3s: typeof reading?.flowM3s === 'number' ? reading.flowM3s : null,
      river_level_m: typeof reading?.riverLevelM === 'number' ? reading.riverLevelM : null,
      measured_at: reading?.measuredAt ?? null,
      available: Boolean(reading && (typeof reading.flowM3s === 'number' || typeof reading.riverLevelM === 'number')),
      note: section.note ?? null,
    };
  });

  return { ...dam, hydrometric_sections: hydrometricSections };
}

function summarizeTelemetryRows(rows) {
  return rows.map((row) => {
    const stationCode = stringFromKeys(row, ['CodEstacao', 'Codigo_Estacao', 'codigoestacao', 'Cod_Estacao']);
    return {
      stationCode,
      stationName: stringFromKeys(row, ['NomeEstacao', 'Estacao_Nome', 'Nome_Estacao', 'Nome']),
      measuredAt: normalizeAnaTimestamp(stringFromKeys(row, ['DataHora', 'Data_Hora_Medicao', 'Data_Medicao', 'DataHoraMedicao', 'Data'])),
      rainfallMm: numberFromKeyIncludes(row, ['chuva', 'precipit']),
      riverLevelM: normalizeLevel(numberFromKeyIncludes(row, ['cota', 'nivel', 'nível'])),
      flowM3s: numberFromKeyIncludes(row, ['vazao', 'vazão']),
      raw: row,
    };
  });
}

function latestMetric(readings, key, preferredStationCodes = []) {
  const candidates = readings
    .filter((reading) => typeof reading[key] === 'number')
    .sort((left, right) => Date.parse(right.measuredAt || '') - Date.parse(left.measuredAt || ''));
  const latest = preferredStationCodes
    .map((code) => candidates.find((reading) => reading.stationCode === code))
    .find(Boolean) ?? candidates[0];

  return latest
    ? {
        value: latest[key],
        stationCode: latest.stationCode,
        stationName: latest.stationName,
        measuredAt: latest.measuredAt,
    }
    : null;
}

function accumulatedRainfall(readings, preferredStationCodes = [], windowHours = 24) {
  const candidates = readings
    .filter((reading) => typeof reading.rainfallMm === 'number' && reading.measuredAt)
    .sort((left, right) => Date.parse(right.measuredAt || '') - Date.parse(left.measuredAt || ''));
  const stationCode = preferredStationCodes.find((code) => candidates.some((reading) => reading.stationCode === code));

  if (!stationCode) {
    return null;
  }

  const stationReadings = candidates.filter((reading) => reading.stationCode === stationCode);
  const latest = stationReadings[0];
  const latestTime = Date.parse(latest.measuredAt || '');

  if (!Number.isFinite(latestTime)) {
    return null;
  }

  const windowStart = latestTime - windowHours * 60 * 60 * 1000;
  const windowReadings = stationReadings.filter((reading) => {
    const measuredAt = Date.parse(reading.measuredAt || '');
    return Number.isFinite(measuredAt) && measuredAt > windowStart && measuredAt <= latestTime;
  });
  const totalMm = roundNumber(windowReadings.reduce((sum, reading) => sum + reading.rainfallMm, 0));

  return {
    stationCode,
    stationName: latest.stationName,
    lastMeasuredAt: latest.measuredAt,
    totalMm,
    windowHours,
    readingCount: windowReadings.length,
  };
}

function numberFromKeyIncludes(row, needles) {
  for (const [key, value] of Object.entries(row)) {
    const normalized = normalizeText(key);
    if (needles.some((needle) => normalized.includes(normalizeText(needle)))) {
      const parsed = parseNumber(value);
      if (parsed !== null) {
        return parsed;
      }
    }
  }

  return null;
}

function stringFromKeys(row, keys) {
  for (const key of keys) {
    if (row[key] !== null && row[key] !== undefined) {
      return String(row[key]);
    }
  }

  return '';
}

function parseNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeLevel(value) {
  if (value === null) {
    return null;
  }

  return value > 100 ? value / 100 : value;
}

function roundNumber(value) {
  return Math.round(value * 100) / 100;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function currentSaoPauloDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function anaRequest(path, params = {}) {
  let token = await getEnvToken();

  if (!token) {
    throw new Error('Token ANA indisponivel.');
  }

  const url = new URL(`${ANA_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  let response = await fetchWithTimeout(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  }, ANA_REQUEST_TIMEOUT_MS);

  if (response.status === 401) {
    token = await getEnvToken(true);
    if (token) {
      response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }, ANA_REQUEST_TIMEOUT_MS);
    }
  }
  const responseBody = await response.text();
  const payload = tryParseJson(responseBody);

  saveAnaApiResponse({
    endpointKey: getEndpointKey(path),
    requestUrl: url.toString(),
    requestParams: params,
    httpStatus: response.status,
    payload,
  }).catch(err => console.error('Erro ao salvar no Supabase:', err));

  if (!response.ok || !isRecord(payload)) {
    throw new Error(`ANA ${getEndpointKey(path)} retornou HTTP ${response.status}: ${responseBody.slice(0, 160)}`);
  }

  return payload;
}

function normalizeItems(items) {
  if (Array.isArray(items)) {
    return items.filter(isRecord);
  }

  if (isRecord(items)) {
    const arrays = Object.values(items).filter(Array.isArray);
    const rows = arrays.flat().filter(isRecord);
    return rows.length ? rows : [items];
  }

  return [];
}

function summarizeStation(station) {
  const city = String(station.Municipio_Nome ?? '');
  const name = String(station.Estacao_Nome ?? 'Sem nome');
  const river = String(station.Rio_Nome ?? '');
  const isTelemetry = String(station.Tipo_Estacao_Telemetrica ?? '') === '1';
  const isRain = String(station.Tipo_Estacao_Pluviometro ?? '') === '1'
    || String(station.Tipo_Estacao_Registrador_Chuva ?? '') === '1'
    || String(station.Tipo_Estacao ?? '').toLowerCase().includes('pluv');
  const isLevel = String(station.Tipo_Estacao_Escala ?? '') === '1'
    || String(station.Tipo_Estacao_Registrador_Nivel ?? '') === '1';
  const isFlow = String(station.Tipo_Estacao_Desc_Liquida ?? '') === '1';
  const operating = String(station.Operando ?? '') === '1';
  const contributor = classifyMucumContributor(city, river);
  const upstreamOfMucum = isMucumUpstreamRelation(contributor?.relation);
  const priority = [
    operating ? 30 : 0,
    isTelemetry ? 25 : 0,
    isLevel ? 18 : 0,
    isFlow ? 12 : 0,
    isRain ? 10 : 0,
    upstreamOfMucum ? 10 : 0,
    isRelevantRiver(river) ? 8 : 0,
  ].reduce((sum, value) => sum + value, 0);

  return {
    code: String(station.codigoestacao ?? station.Codigo_Estacao ?? ''),
    name,
    city,
    river,
    latitude: station.Latitude ?? null,
    longitude: station.Longitude ?? null,
    basinCode: String(station.codigobacia ?? station.Bacia_Codigo ?? ''),
    subBasinCode: String(station.Sub_Bacia_Codigo ?? ''),
    type: String(station.Tipo_Estacao ?? ''),
    operating,
    isTelemetry,
    isRain,
    isLevel,
    isFlow,
    upstreamOfMucum,
    contributorKey: contributor?.key ?? null,
    contributorName: contributor?.name ?? null,
    contributorRelation: contributor?.relation ?? null,
    influence: contributor?.influence ?? null,
    priority,
    raw: station,
  };
}

function attachTelemetryStationCodes(stations) {
  const telemetryByLocation = new Map();

  stations
    .filter((station) => station.isTelemetry && (station.isLevel || station.isFlow))
    .sort((left, right) => right.priority - left.priority)
    .forEach((station) => {
      const locationKey = stationLocationKey(station);
      if (!telemetryByLocation.has(locationKey)) {
        telemetryByLocation.set(locationKey, station.code);
      }
    });

  return stations.map((station) => ({
    ...station,
    telemetryCode: station.isRain
      ? telemetryByLocation.get(stationLocationKey(station)) ?? station.code
      : station.code,
  }));
}

function stationLocationKey(station) {
  return `${normalizeText(station.city)}|${normalizeText(station.name)}|${station.latitude ?? ''}|${station.longitude ?? ''}`;
}

function isMucumUpstreamLocation(city, river) {
  return isMucumUpstreamRelation(classifyMucumContributor(city, river)?.relation);
}

function isRelevantRiver(river) {
  const normalizedRiver = normalizeText(river);
  return MUCUM_CONTRIBUTORS.some((contributor) => (
    contributor.riverPatterns.some((pattern) => normalizedRiver.includes(normalizeText(pattern)))
  )) || Boolean(normalizedRiver.match(/FORQUETA|JACARE|TAQUARI-MIRIM/));
}

function isMucumRainContributorStation(station) {
  const contributor = station.contributorKey
    ? { key: station.contributorKey, relation: station.contributorRelation }
    : classifyMucumContributor(station.city, station.river);
  return Boolean(contributor?.key)
    && contributor?.relation !== 'downstream_context';
}

function isMucumUpstreamRelation(relation) {
  return ['main_upstream', 'tributary_upstream', 'outlet'].includes(relation);
}

function classifyMucumContributor(city, river) {
  const normalizedCity = normalizeText(city);
  const normalizedRiver = normalizeText(river);

  if (
    normalizedCity.match(/ENCANTADO|ROCA SALES|COLINAS|ARROIO DO MEIO|LAJEADO|ESTRELA|BOM RETIRO|TAQUARI/)
    || normalizedRiver.match(/FORQUETA|JACARE|TAQUARI-MIRIM/)
  ) {
    return null;
  }

  if (normalizedCity.includes('MUCUM') && normalizedRiver.includes('RIO TAQUARI')) {
    return MUCUM_CONTRIBUTORS.find((contributor) => contributor.key === 'taquari_mucum') ?? null;
  }

  const riverMatch = MUCUM_CONTRIBUTORS.find((contributor) => (
    contributor.key !== 'taquari_mucum'
    && contributor.riverPatterns.some((pattern) => normalizedRiver.includes(normalizeText(pattern)))
  ));
  if (riverMatch) return riverMatch;

  return MUCUM_CONTRIBUTORS
    .slice()
    .sort((left, right) => right.priority - left.priority)
    .find((contributor) => (
      contributor.cities.some((candidate) => normalizeText(candidate) === normalizedCity)
    )) ?? null;
}

function normalizeText(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function saveAnaApiResponse({ endpointKey, requestUrl, requestParams, httpStatus, payload }) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !payload || typeof payload !== 'object') {
    return;
  }

  const responsePayload = {
    endpoint_key: endpointKey,
    request_url: requestUrl,
    request_params: requestParams,
    http_status: httpStatus,
    api_code: typeof payload.code === 'number' ? payload.code : null,
    api_status: typeof payload.status === 'string' ? payload.status : null,
    api_message: typeof payload.message === 'string' ? payload.message : null,
    response_payload: payload,
  };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/ana_api_responses`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(responsePayload),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.warn(`Nao foi possivel salvar retorno ANA no Supabase: HTTP ${response.status} ${detail}`);
  }
}

function getEndpointKey(path) {
  return path.split('/').filter(Boolean).at(-1) || path;
}

function tryParseJson(body) {
  try {
    return JSON.parse(body);
  } catch {
    return { raw: body };
  }
}

function parseJsonOrNull(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function summarizeExternalBody(body) {
  return String(body ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240) || 'Resposta vazia.';
}

async function getEnvToken(forceRefresh = false) {
  const tokenIsUsable = cachedToken
    && Date.now() < cachedTokenExpiresAt - ANA_TOKEN_EXPIRY_SKEW_MS;

  if (tokenIsUsable && !forceRefresh) {
    return cachedToken;
  }

  if (tokenRequestPromise) {
    return tokenRequestPromise;
  }

  if (forceRefresh || !tokenIsUsable) {
    clearCachedToken();
  }

  tokenRequestPromise = requestEnvToken();

  try {
    return await tokenRequestPromise;
  } finally {
    tokenRequestPromise = null;
  }
}

async function requestEnvToken() {
  const identifier = process.env.ANA_IDENTIFICADOR;
  const password = process.env.ANA_SENHA;

  if (!identifier || !password) {
    return null;
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchWithTimeout(`${ANA_BASE_URL}/EstacoesTelemetricas/OAUth/v1`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Identificador: identifier,
          Senha: password,
        },
      }, ANA_AUTH_TIMEOUT_MS);
      const payload = await response.json();
      const token = findToken(payload);

      if (response.ok && token) {
        cachedToken = token;
        cachedTokenExpiresAt = tokenExpirationMs(token) ?? Date.now() + ANA_TOKEN_FALLBACK_TTL_MS;
        return cachedToken;
      }
    } catch {
      // A ANA oscila ocasionalmente; a segunda tentativa evita descartar o snapshot atual.
    }

    if (attempt === 0) {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 600));
    }
  }

  clearCachedToken();
  return null;
}

function clearCachedToken() {
  cachedToken = null;
  cachedTokenExpiresAt = 0;
}

function tokenExpirationMs(token) {
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const expiration = Number(payload.exp);
    return Number.isFinite(expiration) ? expiration * 1000 : null;
  } catch {
    return null;
  }
}

function refreshDashboardSnapshot({ snapshotKey, rainfallWindowHours, ttlMs, build, getDataUpdatedAt }) {
  const refreshKey = `${snapshotKey}:${rainfallWindowHours}`;
  const activeRefresh = dashboardRefreshPromises.get(refreshKey);
  if (activeRefresh) return activeRefresh;

  const refreshPromise = (async () => {
    const payload = await build();
    const fetchedAt = new Date().toISOString();
    const dataUpdatedAt = validIsoDate(getDataUpdatedAt(payload)) ?? fetchedAt;
    const snapshot = {
      payload,
      data_updated_at: dataUpdatedAt,
      fetched_at: fetchedAt,
      expires_at: new Date(Date.parse(fetchedAt) + ttlMs).toISOString(),
      last_error: null,
    };

    saveDashboardSnapshot(snapshotKey, rainfallWindowHours, snapshot).catch(err => console.error('Erro ao salvar snapshot:', err));
    return payloadWithSnapshot(payload, snapshot, null, 'live');
  })().finally(() => {
    dashboardRefreshPromises.delete(refreshKey);
  });

  dashboardRefreshPromises.set(refreshKey, refreshPromise);
  return refreshPromise;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function findToken(value) {
  if (typeof value === 'string' && value.length > 20) {
    return value.replace(/^Bearer\s+/i, '');
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const preferred = value.tokenautenticacao || value.tokenAutenticacao || value.tokenAutenticacaoApi;
  if (typeof preferred === 'string' && preferred.length > 20) {
    return preferred.replace(/^Bearer\s+/i, '');
  }

  for (const child of Object.values(value)) {
    const token = findToken(child);
    if (token) {
      return token;
    }
  }

  return null;
}

function loadLocalEnv() {
  for (const file of ['.env.local', '.env']) {
    const path = resolve(process.cwd(), file);

    if (!existsSync(path)) {
      continue;
    }

    const lines = readFileSync(path, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);

      if (!match) {
        continue;
      }

      const [, key, rawValue] = match;
      const value = rawValue.replace(/^['"]|['"]$/g, '');

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    ...corsHeaders,
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}
