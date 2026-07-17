import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ANA_BASE_URL = 'https://www.ana.gov.br/hidrowebservice';

loadLocalEnv();

const identifier = process.env.ANA_IDENTIFICADOR;
const password = process.env.ANA_SENHA;

if (!identifier || !password) {
  console.error('Credenciais ausentes: configure ANA_IDENTIFICADOR e ANA_SENHA.');
  process.exit(1);
}

const authResponse = await fetch(`${ANA_BASE_URL}/EstacoesTelemetricas/OAUth/v1`, {
  method: 'GET',
  headers: {
    Accept: 'application/json',
    Identificador: identifier,
    Senha: password,
  },
});

const authPayload = await authResponse.json();
const token = findToken(authPayload);

console.log('OAuth HTTP:', authResponse.status);
console.log('OAuth body:', summarize(authPayload));
console.log('Token encontrado:', token ? `sim, ${token.length} caracteres` : 'nao');

if (!token) {
  process.exit(1);
}

const testUrl = `${ANA_BASE_URL}/EstacoesTelemetricas/HidroInventarioEstacoes/v1?Unidade%20Federativa=SP`;
const variants = [
  ['Authorization: Bearer <token>', { Authorization: `Bearer ${token}` }],
  ['Authorization: <token>', { Authorization: token }],
  ['authorization: Bearer <token>', { authorization: `Bearer ${token}` }],
  ['accesstoken: <token>', { accesstoken: token }],
];

for (const [label, headers] of variants) {
  const response = await fetch(testUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...headers,
    },
  });
  const payload = await response.json().catch(() => ({}));

  console.log(`${label}: HTTP ${response.status} / code ${payload.code ?? '-'} / ${payload.message ?? payload.status ?? '-'}`);
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

  for (const [key, child] of Object.entries(value)) {
    if (/token|authorization/i.test(key) && typeof child === 'string' && child.length > 20) {
      return child.replace(/^Bearer\s+/i, '');
    }
  }

  for (const child of Object.values(value)) {
    const token = findToken(child);
    if (token) {
      return token;
    }
  }

  return null;
}

function summarize(value) {
  if (!value || typeof value !== 'object') {
    return typeof value;
  }

  return JSON.stringify(maskTokens(value));
}

function maskTokens(value) {
  if (typeof value === 'string') {
    return value.length > 20 ? `<redacted:${value.length}>` : value;
  }

  if (Array.isArray(value)) {
    return value.map(maskTokens);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, maskTokens(child)]));
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
