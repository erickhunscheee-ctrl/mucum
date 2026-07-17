const baseUrl = process.env.PROXY_URL ?? 'http://localhost:3001';
const [currentResponse, forecastResponse] = await Promise.all([
  fetch(`${baseUrl}/api/mucum/current?rainWindowHours=24&refresh=true`),
  fetch(`${baseUrl}/api/mucum/forecast?refresh=true`),
]);
const [current, forecast] = await Promise.all([currentResponse.json(), forecastResponse.json()]);

if (!currentResponse.ok || !forecastResponse.ok) {
  throw new Error(JSON.stringify({ currentStatus: currentResponse.status, forecastStatus: forecastResponse.status }));
}

const cities = (current.regionalRainfall?.cities ?? []).map((city) => city.city);
const downstreamCities = cities.filter((city) => /ENCANTADO|ROCA SALES|LAJEADO|ESTRELA/i.test(city));
const rivers = Array.from(new Set((current.stationReadings ?? [])
  .filter((reading) => reading.riverLevelM !== null && reading.river)
  .map((reading) => reading.river)));
const impactForecast = (forecast.points ?? []).filter((point) => point.role !== 'jusante_contexto');

console.log(JSON.stringify({
  currentStatus: current.snapshot?.status ?? 'live',
  forecastStatus: forecast.snapshot?.status ?? 'live',
  scope: current.regionalRainfall?.scope,
  cityCount: cities.length,
  cities,
  downstreamCities,
  riversWithLevel: rivers,
  impactForecastPoints: impactForecast.map((point) => point.name),
  downstreamForecastPoints: (forecast.points ?? [])
    .filter((point) => point.role === 'jusante_contexto')
    .map((point) => point.name),
  forecastHoursPerPoint: impactForecast[0]?.hours?.length ?? 0,
}, null, 2));
