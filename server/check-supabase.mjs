import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

loadLocalEnv();

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey) {
  console.error('Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no .env.');
  console.error('Tambem aceito NEXT_PUBLIC_SUPABASE_URL nos scripts Node, mas o app Expo precisa de EXPO_PUBLIC_SUPABASE_URL.');
  process.exit(1);
}

await checkRest('anon', anonKey);

if (serviceRoleKey) {
  await checkRest('service_role', serviceRoleKey);
} else {
  console.log('service_role: nao configurada; gravacao pelo proxy ficara desativada.');
}

async function checkRest(label, key) {
  const response = await fetch(`${supabaseUrl}/rest/v1/municipalities?select=id,name,state_code,river_name&limit=5`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });

  const payload = await response.json().catch(() => null);

  console.log(`${label}: HTTP ${response.status}`);
  console.log(JSON.stringify(payload, null, 2));
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
