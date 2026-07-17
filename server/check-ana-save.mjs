import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

loadLocalEnv();

const anaBaseUrl = 'https://www.ana.gov.br/hidrowebservice';
const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Configure SUPABASE_SERVICE_ROLE_KEY e EXPO_PUBLIC_SUPABASE_URL no .env.');
  process.exit(1);
}

const token = await getAnaToken();
if (!token) {
  console.error('Nao consegui obter token ANA.');
  process.exit(1);
}

const targetUrl = `${anaBaseUrl}/EstacoesTelemetricas/HidroInventarioEstacoes/v1?Unidade%20Federativa=RS`;
const anaResponse = await fetch(targetUrl, {
  headers: {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  },
});
const payload = await anaResponse.json();

const insertResponse = await fetch(`${supabaseUrl}/rest/v1/ana_api_responses`, {
  method: 'POST',
  headers: {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  },
  body: JSON.stringify({
    endpoint_key: 'HidroInventarioEstacoes',
    request_url: targetUrl,
    request_params: { 'Unidade Federativa': 'RS' },
    http_status: anaResponse.status,
    api_code: typeof payload.code === 'number' ? payload.code : null,
    api_status: typeof payload.status === 'string' ? payload.status : null,
    api_message: typeof payload.message === 'string' ? payload.message : null,
    response_payload: payload,
  }),
});

const inserted = await insertResponse.json().catch(() => null);

console.log('ANA:', anaResponse.status, payload.code, payload.message);
console.log('Supabase insert:', insertResponse.status, Array.isArray(inserted) ? inserted[0]?.id : inserted);

async function getAnaToken() {
  const response = await fetch(`${anaBaseUrl}/EstacoesTelemetricas/OAUth/v1`, {
    headers: {
      Accept: 'application/json',
      Identificador: process.env.ANA_IDENTIFICADOR,
      Senha: process.env.ANA_SENHA,
    },
  });
  const payload = await response.json();

  return payload?.items?.tokenautenticacao ?? null;
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
