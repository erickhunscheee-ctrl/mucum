const proxyBaseUrl = process.env.EXPO_PUBLIC_PROXY_URL || 'http://localhost:3001';

const response = await fetch(`${proxyBaseUrl}/api/mucum/current`);
const payload = await response.json().catch(() => null);

console.log(`Mucum current: HTTP ${response.status}`);

if (payload) {
  console.log(JSON.stringify({
    message: payload.message,
    detail: payload.detail,
    generatedAt: payload.generatedAt,
    rainfall: payload.rainfall,
    regionalRainfall: {
      basinName: payload.regionalRainfall?.basinName,
      stationCount: payload.regionalRainfall?.stationCount,
      withRainCount: payload.regionalRainfall?.withRainCount,
      maxMm: payload.regionalRainfall?.maxMm,
      avgMm: payload.regionalRainfall?.avgMm,
      lastMeasuredAt: payload.regionalRainfall?.lastMeasuredAt,
    },
    river: payload.river,
    dams: payload.dams?.length ?? 0,
    source: payload.source,
  }, null, 2));
}

if (!response.ok) {
  process.exit(1);
}
