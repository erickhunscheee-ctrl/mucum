import assert from 'node:assert/strict';

import {
  calculateMucumProjection,
  dischargeFromMucumStage,
  MUCUM_LOCAL_CRITICAL_RAIN_GAUGES,
  MUCUM_RAIN_GAUGES,
  stageFromMucumDischarge,
} from './mucum-projection.mjs';

const base = new Date('2026-07-17T12:00:00-03:00');
const isoHoursAgo = (hours) => new Date(base.getTime() - hours * 60 * 60 * 1000).toISOString();
const mucumReading = (hoursAgo, levelM) => ({
  stationCode: '86510000',
  stationName: 'MUCUM',
  measuredAt: isoHoursAgo(hoursAgo),
  riverLevelM: levelM,
  flowM3s: dischargeFromMucumStage(levelM),
  rainfallMm: 0,
});

const current = {
  generatedAt: base.toISOString(),
  source: {},
  rainfall: { accumulatedMm: 34 },
  river: {
    currentLevelM: 4.7,
    currentFlowM3s: dischargeFromMucumStage(4.7),
    levelMeasuredAt: base.toISOString(),
    flowMeasuredAt: base.toISOString(),
  },
  dams: [{ dam_name: 'UHE 14 de Julho', outflow_m3s: 1100 }],
  regionalRainfall: {
    avgMm: 34,
    cities: MUCUM_RAIN_GAUGES.map((gauge) => ({
      city: gauge.city,
      daily: [
        { date: '2026-07-15', rainfallMm: 12, readingCount: 24 },
        { date: '2026-07-16', rainfallMm: 15, readingCount: 24 },
        { date: '2026-07-17', rainfallMm: 7, readingCount: 12 },
      ],
    })),
  },
  stationReadings: [
    mucumReading(6, 4.1),
    mucumReading(4, 4.25),
    mucumReading(2, 4.45),
    mucumReading(0, 4.7),
  ],
};

const forecast = {
  points: [...MUCUM_RAIN_GAUGES, ...MUCUM_LOCAL_CRITICAL_RAIN_GAUGES].map((gauge) => ({
    key: gauge.key,
    hours: Array.from({ length: 72 }, (_, hour) => ({ precipitationMm: hour < 18 ? 0.6 : 0 })),
  })),
};

const ensemble = {
  points: [...MUCUM_RAIN_GAUGES, ...MUCUM_LOCAL_CRITICAL_RAIN_GAUGES].map((gauge) => ({
    key: gauge.key,
    weight: gauge.weight,
    payload: {
      hourly: {
        precipitation: Array.from({ length: 72 }, (_, hour) => hour < 18 ? 0.5 : 0),
        precipitation_member01: Array.from({ length: 72 }, (_, hour) => hour < 18 ? 0.2 : 0),
        precipitation_member02: Array.from({ length: 72 }, (_, hour) => hour < 18 ? 0.9 : 0),
      },
    },
  })),
};

const result = calculateMucumProjection({
  current,
  forecast,
  ensemble,
  glofas: {
    daily: {
      river_discharge_median: [1000, 1250, 1500, 1300],
      river_discharge_p25: [800, 1000, 1150, 1000],
      river_discharge_p75: [1200, 1600, 2100, 1800],
    },
  },
  generatedAt: base.toISOString(),
});

assert.equal(result.timeline.length, 73);
assert.equal(result.model.officialLeadHours, 6);
assert.equal(result.thresholdCrossings.map((item) => item.levelM).join(','), '5,9,18');
assert.ok(result.confidence.shortTermPct > result.confidence.next72hPct);
assert.ok(result.drivers.forecastRain72hMm.minimum <= result.drivers.forecastRain72hMm.likely);
assert.ok(result.drivers.forecastRain72hMm.likely <= result.drivers.forecastRain72hMm.maximum);
assert.ok(result.drivers.localCriticalRain72hMm.likely > 0);
assert.ok(result.alerts.every((alert) => !alert.detail.includes('observados e previstos')));
result.timeline.forEach((row) => {
  assert.ok(row.minimumLevelM <= row.likelyLevelM);
  assert.ok(row.likelyLevelM <= row.maximumLevelM);
});

const flowAtNineMeters = dischargeFromMucumStage(9);
assert.ok(flowAtNineMeters);
assert.ok(Math.abs((stageFromMucumDischarge(flowAtNineMeters) ?? 0) - 9) < 0.01);

const wetResult = calculateMucumProjection({
  current: {
    ...current,
    regionalRainfall: {
      ...current.regionalRainfall,
      cities: MUCUM_RAIN_GAUGES.map((gauge) => ({
        city: gauge.city,
        daily: [
          { date: '2026-07-15', rainfallMm: 35, readingCount: 24 },
          { date: '2026-07-16', rainfallMm: 35, readingCount: 24 },
          { date: '2026-07-17', rainfallMm: 30, readingCount: 12 },
        ],
      })),
    },
  },
  forecast,
  ensemble,
  generatedAt: base.toISOString(),
});

assert.ok(wetResult.alerts.some((alert) => alert.title === 'Chuva observada em faixa historicamente severa'));
assert.ok(wetResult.alerts.every((alert) => !alert.detail.includes('observados e previstos')));

console.log(JSON.stringify({
  status: 'ok',
  officialLeadHours: result.model.officialLeadHours,
  likelyPeak: result.peaks.likely,
  confidence: result.confidence,
  rain72h: result.drivers.forecastRain72hMm,
}, null, 2));
