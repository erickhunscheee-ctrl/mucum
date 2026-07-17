import { Platform } from 'react-native';

import { apiErrorMessage, readJsonResponse } from './httpJson';
import { PROXY_BASE_URL } from './proxyBaseUrl';

export type HidroEndpointKey =
  | 'inventory'
  | 'catalogUf'
  | 'catalogBasin'
  | 'catalogSubBasin'
  | 'catalogRiver'
  | 'catalogMunicipality'
  | 'catalogEntity'
  | 'rain'
  | 'riverLevel'
  | 'flow'
  | 'telemetryAdopted'
  | 'telemetryDetailed';

export type HidroResponse = {
  status?: string;
  code?: number;
  message?: string;
  items?: unknown;
};

export const usesProxyAuth = Platform.OS === 'web';

export type QueryInput = {
  endpoint: HidroEndpointKey;
  token: string;
  stationCode: string;
  stationCodes: string;
  state: string;
  basinCode: string;
  startDate: string;
  endDate: string;
  searchDate: string;
  filterType: 'DATA_LEITURA' | 'DATA_ULTIMA_ATUALIZACAO';
  telemetryRange: string;
  catalogCode: string;
};

export type EndpointConfig = {
  key: HidroEndpointKey;
  label: string;
  description: string;
  path: string;
  family: 'inventory' | 'catalog' | 'series' | 'telemetry';
  codeParam?: string;
};

export const API_BASE_URL = 'https://www.ana.gov.br/hidrowebservice';
export const API_PROXY_URL = `${PROXY_BASE_URL}/api/ana`;

export const endpointConfigs: EndpointConfig[] = [
  {
    key: 'inventory',
    label: 'Inventario de estacoes',
    description: 'Busca estacoes por UF, codigo da estacao ou codigo da bacia.',
    path: '/EstacoesTelemetricas/HidroInventarioEstacoes/v1',
    family: 'inventory',
  },
  {
    key: 'catalogUf',
    label: 'UFs',
    description: 'Lista unidades federativas cadastradas na base HIDRO.',
    path: '/EstacoesTelemetricas/HidroUF/v1',
    family: 'catalog',
    codeParam: 'C\u00f3digo da UF',
  },
  {
    key: 'catalogBasin',
    label: 'Bacias',
    description: 'Lista bacias hidrograficas e seus codigos para filtrar estacoes.',
    path: '/EstacoesTelemetricas/HidroBacia/v1',
    family: 'catalog',
    codeParam: 'C\u00f3digo da Bacia',
  },
  {
    key: 'catalogSubBasin',
    label: 'Sub-bacias',
    description: 'Lista sub-bacias hidrograficas cadastradas na base HIDRO.',
    path: '/EstacoesTelemetricas/HidroSubBacia/v1',
    family: 'catalog',
    codeParam: 'C\u00f3digo da Sub-Bacia',
  },
  {
    key: 'catalogRiver',
    label: 'Rios',
    description: 'Lista corpos hidricos cadastrados na base HIDRO.',
    path: '/EstacoesTelemetricas/HidroRio/v1',
    family: 'catalog',
    codeParam: 'C\u00f3digo do Rio',
  },
  {
    key: 'catalogMunicipality',
    label: 'Municipios',
    description: 'Lista municipios cadastrados na base HIDRO.',
    path: '/EstacoesTelemetricas/HidroMunicipio/v1',
    family: 'catalog',
    codeParam: 'C\u00f3digo do Munic\u00edpio',
  },
  {
    key: 'catalogEntity',
    label: 'Entidades',
    description: 'Lista entidades responsaveis/operadoras das estacoes.',
    path: '/EstacoesTelemetricas/HidroEntidade/v1',
    family: 'catalog',
    codeParam: 'C\u00f3digo da Entidade',
  },
  {
    key: 'rain',
    label: 'Serie de chuva',
    description: 'Chuva convencional por estacao, limitada a 366 dias por chamada.',
    path: '/EstacoesTelemetricas/HidroSerieChuva/v1',
    family: 'series',
  },
  {
    key: 'riverLevel',
    label: 'Serie de cotas',
    description: 'Nivel/cota convencional por estacao, limitada a 366 dias por chamada.',
    path: '/EstacoesTelemetricas/HidroSerieCotas/v1',
    family: 'series',
  },
  {
    key: 'flow',
    label: 'Serie de vazao',
    description: 'Vazao convencional por estacao, limitada a 366 dias por chamada.',
    path: '/EstacoesTelemetricas/HidroSerieVazao/v1',
    family: 'series',
  },
  {
    key: 'telemetryAdopted',
    label: 'Telemetrica adotada',
    description: 'Chuva, nivel e vazao adotados. Aceita ate 10 estacoes e periodo de ate 30 dias.',
    path: '/EstacoesTelemetricas/HidroinfoanaSerieTelemetricaAdotada/v2',
    family: 'telemetry',
  },
  {
    key: 'telemetryDetailed',
    label: 'Telemetrica detalhada',
    description: 'Dados adotados e brutos. Aceita ate 10 estacoes e periodo de ate 30 dias.',
    path: '/EstacoesTelemetricas/HidroinfoanaSerieTelemetricaDetalhada/v2',
    family: 'telemetry',
  },
];

export const telemetryRanges = [
  'MINUTO_15',
  'MINUTO_30',
  'HORA_1',
  'HORA_6',
  'HORA_12',
  'HORA_24',
  'DIAS_2',
  'DIAS_7',
  'DIAS_14',
  'DIAS_30',
];

export const brazilianStates = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
];

const jsonHeaders = {
  Accept: 'application/json',
};

export async function queryHidroAna(input: QueryInput): Promise<HidroResponse> {
  const config = endpointConfigs.find((item) => item.key === input.endpoint);

  if (!config) {
    throw new Error('Endpoint nao configurado.');
  }

  const params = buildParams(input, config);
  const headers = Platform.OS === 'web'
    ? jsonHeaders
    : {
        ...jsonHeaders,
        Authorization: `Bearer ${input.token.trim()}`,
      };
  const response = await fetch(`${getApiBaseUrl()}${config.path}?${params.toString()}`, {
    method: 'GET',
    headers,
  });

  const data = await readJsonResponse<HidroResponse>(response, 'API hidrologica');

  if (!response.ok) {
    throw new Error(apiErrorMessage(data, `Falha na consulta: HTTP ${response.status}`));
  }

  return data;
}

function getApiBaseUrl() {
  return Platform.OS === 'web' ? API_PROXY_URL : API_BASE_URL;
}

function buildParams(input: QueryInput, config: EndpointConfig) {
  const params = new URLSearchParams();

  if (config.family === 'inventory') {
    if (input.stationCode.trim()) {
      params.set('C\u00f3digo da Esta\u00e7\u00e3o', input.stationCode.trim());
    }

    if (input.state) {
      params.set('Unidade Federativa', input.state);
    }

    if (input.basinCode.trim()) {
      params.set('C\u00f3digo da Bacia', input.basinCode.trim());
    }
  }

  if (config.family === 'catalog' && config.codeParam && input.catalogCode.trim()) {
    params.set(config.codeParam, input.catalogCode.trim());
  }

  if (config.family === 'series') {
    params.set('C\u00f3digo da Esta\u00e7\u00e3o', input.stationCode.trim());
    params.set('Tipo Filtro Data', input.filterType);
    params.set('Data Inicial (yyyy-MM-dd)', input.startDate);
    params.set('Data Final (yyyy-MM-dd)', input.endDate);
  }

  if (config.family === 'telemetry') {
    params.set('Codigos_Estacoes', input.stationCodes.trim());
    params.set('Tipo Filtro Data', input.filterType);
    params.set('Data de Busca (yyyy-MM-dd)', input.searchDate);
    params.set('Range Intervalo de busca', input.telemetryRange);
  }

  return params;
}
