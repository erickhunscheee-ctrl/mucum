const proxyBaseUrl = process.env.EXPO_PUBLIC_PROXY_URL || 'http://localhost:3001';

const response = await fetch(`${proxyBaseUrl}/api/health`);
const payload = await response.json().catch(() => null);

console.log(`Proxy: HTTP ${response.status}`);
console.log(JSON.stringify(payload, null, 2));

if (!response.ok) {
  process.exit(1);
}
