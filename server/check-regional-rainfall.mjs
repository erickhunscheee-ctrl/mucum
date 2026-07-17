const baseUrl = process.env.PROXY_URL ?? 'http://localhost:3001';

for (const windowHours of [24, 168, 720]) {
  const response = await fetch(`${baseUrl}/api/mucum/current?rainWindowHours=${windowHours}&refresh=true`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(`${windowHours}h retornou HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 300)}`);
  }

  const cities = payload.regionalRainfall?.cities ?? [];
  const dailyPoints = cities.reduce((total, city) => total + (city.daily?.length ?? 0), 0);
  const peak = cities
    .flatMap((city) => (city.daily ?? []).map((day) => ({ city: city.city, ...day })))
    .sort((left, right) => right.rainfallMm - left.rainfallMm)[0] ?? null;

  console.log(JSON.stringify({
    windowHours,
    stations: payload.regionalRainfall?.stationCount ?? 0,
    cities: cities.length,
    citiesWithRain: payload.regionalRainfall?.withRainCount ?? 0,
    dailyPoints,
    peak,
    snapshotStatus: payload.snapshot?.status ?? 'live',
  }, null, 2));
}
