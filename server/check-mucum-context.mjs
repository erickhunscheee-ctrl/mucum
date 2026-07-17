import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

loadLocalEnv();

const ANA_BASE_URL = 'https://www.ana.gov.br/hidrowebservice';
const KEYWORDS = ['MUCUM', 'MUÇUM', 'TAQUARI', 'ANTAS', 'FORQUETA', 'CARREIRO', 'GUAPORE', 'GUAPORÉ'];

const token = await getAnaToken();

if (!token) {
  console.error('Nao foi possivel autenticar na ANA.');
  process.exit(1);
}

const [municipalities, rivers, basins, subBasins, inventoryRs] = await Promise.all([
  anaGet('/EstacoesTelemetricas/HidroMunicipio/v1'),
  anaGet('/EstacoesTelemetricas/HidroRio/v1'),
  anaGet('/EstacoesTelemetricas/HidroBacia/v1'),
  anaGet('/EstacoesTelemetricas/HidroSubBacia/v1'),
  anaGet('/EstacoesTelemetricas/HidroInventarioEstacoes/v1', { 'Unidade Federativa': 'RS' }),
]);

const municipalityRows = normalizeItems(municipalities.items);
const riverRows = normalizeItems(rivers.items);
const basinRows = normalizeItems(basins.items);
const subBasinRows = normalizeItems(subBasins.items);
const inventoryRows = normalizeItems(inventoryRs.items);

const context = {
  municipalities: findRows(municipalityRows, ['MUCUM', 'MUÇUM']),
  rivers: findRows(riverRows, KEYWORDS),
  basins: findRows(basinRows, ['TAQUARI', 'ANTAS']),
  subBasins: findRows(subBasinRows, KEYWORDS),
  stations: findRows(inventoryRows, KEYWORDS).slice(0, 40),
  counts: {
    municipalities: municipalityRows.length,
    rivers: riverRows.length,
    basins: basinRows.length,
    subBasins: subBasinRows.length,
    inventoryRs: inventoryRows.length,
  },
};

console.log(JSON.stringify(context, null, 2));

async function anaGet(path, params = {}) {
  const url = new URL(`${ANA_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json();
  return payload;
}

async function getAnaToken() {
  const response = await fetch(`${ANA_BASE_URL}/EstacoesTelemetricas/OAUth/v1`, {
    headers: {
      Accept: 'application/json',
      Identificador: process.env.ANA_IDENTIFICADOR,
      Senha: process.env.ANA_SENHA,
    },
  });
  const payload = await response.json();
  return findToken(payload);
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

function normalizeItems(items) {
  if (Array.isArray(items)) {
    return items.filter(isRecord);
  }

  if (isRecord(items)) {
    const arrays = Object.values(items).filter(Array.isArray);
    const nestedRows = arrays.flat().filter(isRecord);
    return nestedRows.length ? nestedRows : [items];
  }

  return [];
}

function findRows(rows, keywords) {
  return rows.filter((row) => {
    const haystack = JSON.stringify(row).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    return keywords.some((keyword) => haystack.includes(keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()));
  });
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
