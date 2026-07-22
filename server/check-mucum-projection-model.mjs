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
  dams: [{ dam_name: 'UHE 14 de Julho', outflow_m3s: 5000, measured_at: base.toISOString() }],
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
    {
      stationCode: '86471000',
      stationName: 'UHE 14 DE JULHO',
      measuredAt: base.toISOString(),
      flowM3s: 1100,
    },
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
assert.equal(result.timeline[0].likelyLevelDeltaM, 0);
assert.equal(
  result.timeline[1].likelyLevelDeltaM,
  Number((result.timeline[1].likelyLevelM - result.timeline[0].likelyLevelM).toFixed(2)),
);
assert.equal(result.model.officialLeadHours, 6);
assert.equal(result.model.officialVariant, 'SGB 2014 - UHE 14 de Julho');
assert.notEqual(result.model.officialProjectedFlowM3s, 1.45 * current.dams[0].outflow_m3s);
assert.equal(result.drivers.uhe14JulhoOutflowM3s, 1100);
assert.ok(result.drivers.recentStageTrendMPerHour > 0);
assert.ok(result.timeline[7].minimumLevelDeltaM > -0.25, 'A transicao apos a equacao oficial nao deve criar queda brusca no cenario minimo.');
assert.equal(result.thresholdCrossings.map((item) => item.levelM).join(','), '5,9,18');
assert.ok(result.confidence.shortTermPct > result.confidence.next72hPct);
assert.equal(result.operationalEstimate.levelM, result.peaks.likely.levelM);
assert.equal(result.operationalGuidance.evacuationSafetyMarginM, 3);
assert.deepEqual(result.operationalGuidance.territorialEvacuationLevelsM, [16, 18, 20, 22]);
assert.equal(result.drivers.upstreamSignals.length, 4);
assert.ok(result.drivers.forecastRain72hMm.minimum <= result.drivers.forecastRain72hMm.likely);
assert.ok(result.drivers.forecastRain72hMm.likely <= result.drivers.forecastRain72hMm.maximum);
assert.ok(result.drivers.localCriticalRain72hMm.likely > 0);
assert.ok(result.alerts.every((alert) => !alert.detail.includes('observados e previstos')));
result.timeline.forEach((row) => {
  assert.ok(row.minimumLevelM <= row.likelyLevelM);
  assert.ok(row.likelyLevelM <= row.maximumLevelM);
});

const mismatchedFlowResult = calculateMucumProjection({
  current: {
    ...current,
    river: {
      ...current.river,
      currentFlowM3s: 99999,
      flowMeasuredAt: isoHoursAgo(2),
    },
  },
  forecast,
  ensemble,
  generatedAt: base.toISOString(),
});
assert.equal(mismatchedFlowResult.current.flowM3s, Number(dischargeFromMucumStage(current.river.currentLevelM).toFixed(2)));

const staleOfficialResult = calculateMucumProjection({
  current: {
    ...current,
    stationReadings: current.stationReadings
      .filter((reading) => reading.stationCode !== '86471000')
      .concat({
        stationCode: '86471000',
        stationName: 'UHE 14 DE JULHO',
        measuredAt: isoHoursAgo(3),
        flowM3s: 5000,
      }),
  },
  forecast,
  ensemble,
  generatedAt: base.toISOString(),
});
assert.equal(staleOfficialResult.model.officialLeadHours, null);
assert.equal(staleOfficialResult.drivers.uhe14JulhoOutflowM3s, null);

const rapidRiseResult = calculateMucumProjection({
  current: {
    ...current,
    river: {
      ...current.river,
      currentLevelM: 5.5,
      currentFlowM3s: dischargeFromMucumStage(5.5),
    },
    stationReadings: [
      mucumReading(1, 4.1),
      mucumReading(0.5, 4.6),
      mucumReading(0, 5.5),
      ...current.stationReadings.filter((reading) => reading.stationCode !== '86510000'),
    ],
  },
  forecast,
  ensemble,
  generatedAt: base.toISOString(),
});
assert.ok(rapidRiseResult.drivers.recentStageTrendMPerHour >= 1);
assert.ok(rapidRiseResult.alerts.some((alert) => alert.title === 'Subida muito rapida observada em Mucum'));

assert.throws(() => calculateMucumProjection({
  current: {
    ...current,
    river: {
      ...current.river,
      levelMeasuredAt: isoHoursAgo(13),
      flowMeasuredAt: isoHoursAgo(13),
    },
  },
  forecast,
  ensemble,
  generatedAt: base.toISOString(),
}), /desatualizado/);

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

const extremeEnsemble = {
  points: ensemble.points.map((point) => ({
    ...point,
    payload: {
      hourly: Object.fromEntries(Object.keys(point.payload.hourly).map((key, index) => [
        key,
        Array.from({ length: 72 }, (_, hour) => hour < 24 ? 4 + index * 2 : 0),
      ])),
    },
  })),
};
const extremeResult = calculateMucumProjection({
  current,
  forecast,
  ensemble: extremeEnsemble,
  generatedAt: base.toISOString(),
});
validateProjection(extremeResult);
if (extremeResult.peaks.maximum.levelM > 20) {
  assert.ok(extremeResult.alerts.some((alert) => alert.title.includes('extrapola a curva-chave')));
}

[0.6, 2, 5, 9, 18, 20].forEach((levelM) => {
  const flowM3s = dischargeFromMucumStage(levelM);
  assert.ok(flowM3s !== null && flowM3s >= 0);
  assert.ok(Math.abs((stageFromMucumDischarge(flowM3s) ?? 0) - levelM) < 0.01);
});

function validateProjection(projection) {
  assert.equal(projection.timeline.length, 73);
  assert.equal(projection.timeline[0].minimumLevelM, projection.current.levelM);
  assert.equal(projection.timeline[0].likelyLevelM, projection.current.levelM);
  assert.equal(projection.timeline[0].maximumLevelM, projection.current.levelM);
  projection.timeline.forEach((row) => {
    [row.minimumLevelM, row.likelyLevelM, row.maximumLevelM, row.minimumFlowM3s, row.likelyFlowM3s, row.maximumFlowM3s]
      .forEach((value) => assert.ok(Number.isFinite(value) && value >= 0));
    assert.ok(row.minimumLevelM <= row.likelyLevelM);
    assert.ok(row.likelyLevelM <= row.maximumLevelM);
    assert.ok(row.minimumFlowM3s <= row.likelyFlowM3s);
    assert.ok(row.likelyFlowM3s <= row.maximumFlowM3s);
  });
}

console.log(JSON.stringify({
  status: 'ok',
  officialLeadHours: result.model.officialLeadHours,
  likelyPeak: result.peaks.likely,
  confidence: result.confidence,
  rain72h: result.drivers.forecastRain72hMm,
}, null, 2));
