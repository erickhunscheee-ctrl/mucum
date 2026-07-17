const HOUR_MS = 60 * 60 * 1000;
const PROJECTION_HOURS = 72;
const MUCUM_DRAINAGE_AREA_KM2 = 16000;

export const MUCUM_RAIN_GAUGES = [
  { key: 'lagoa_vermelha', city: 'Lagoa Vermelha', weight: 0.19 },
  { key: 'santa_tereza', city: 'Santa Tereza', weight: 0.30 },
  { key: 'caxias_do_sul', city: 'Caxias do Sul', weight: 0.05 },
  { key: 'jaquirana', city: 'Jaquirana', weight: 0.22 },
  { key: 'sao_jose_ausentes', city: 'Sao Jose dos Ausentes', weight: 0.07 },
  { key: 'vacaria', city: 'Vacaria', weight: 0.16 },
];

export const MUCUM_THRESHOLDS_M = {
  attention: 5,
  alert: 9,
  inundation: 18,
};

const SOURCE_URLS = {
  sgbForecastModel: 'https://rigeo.sgb.gov.br/jspui/bitstream/doc/24596/1/sistema%20de%20alerta_taquari_2014.pdf',
  sgbBulletin: 'https://www.sgb.gov.br/sace/taquari/ultimo_boletim.php',
  sgbSystem: 'https://www.sgb.gov.br/sace/taquari_apresentacao.php',
  openMeteoEnsemble: 'https://open-meteo.com/en/docs/ensemble-api',
  openMeteoFlood: 'https://open-meteo.com/en/docs/flood-api',
  wmoVerification: 'https://wmo.int/media/news/wmo-issues-guidelines-verification-of-hydrological-forecasts',
};

export function calculateMucumProjection({
  current,
  forecast,
  ensemble,
  glofas,
  projectionReadings = [],
  generatedAt = new Date().toISOString(),
}) {
  if (!current) {
    throw new Error('Dados hidrologicos atuais sao obrigatorios para calcular a projecao.');
  }

  const readings = mergeReadings(current.stationReadings ?? [], projectionReadings);
  const mucumReadings = stationRows(readings, '86510000');
  const latestMucum = latestReading(mucumReadings);
  const baseTime = validDate(
    current.river?.levelMeasuredAt
      ?? current.river?.flowMeasuredAt
      ?? latestMucum?.measuredAt
      ?? generatedAt,
  );
  const currentLevelM = finiteNumber(current.river?.currentLevelM)
    ?? latestMetricValue(mucumReadings, 'riverLevelM');
  const measuredCurrentFlow = finiteNumber(current.river?.currentFlowM3s)
    ?? latestMetricValue(mucumReadings, 'flowM3s');
  const currentFlowM3s = measuredCurrentFlow ?? dischargeFromMucumStage(currentLevelM);

  if (currentLevelM === null || currentFlowM3s === null) {
    throw new Error('A projecao requer ao menos nivel e vazao atuais de Mucum, medidos ou derivados pela curva-chave.');
  }

  const flowAt4hAgo = metricNearHoursAgo(mucumReadings, 'flowM3s', baseTime, 4)
    ?? dischargeFromMucumStage(metricNearHoursAgo(mucumReadings, 'riverLevelM', baseTime, 4));
  const flowAt6hAgo = metricNearHoursAgo(mucumReadings, 'flowM3s', baseTime, 6)
    ?? dischargeFromMucumStage(metricNearHoursAgo(mucumReadings, 'riverLevelM', baseTime, 6));
  const linhaReading = latestReading(stationRows(readings, '86472000'));
  const linhaFlowM3s = finiteNumber(linhaReading?.flowM3s)
    ?? dischargeFromLinhaJoseJulioStage(linhaReading?.riverLevelM);
  const dam14July = (current.dams ?? []).find((dam) => normalize(dam.dam_name).includes('14 DE JULHO'));
  const uheReading = latestReading(stationRows(readings, '86471000'));
  const uheOutflowM3s = finiteNumber(dam14July?.outflow_m3s) ?? finiteNumber(uheReading?.flowM3s);
  const official = officialShortTermProjection({
    linhaFlowM3s,
    uheOutflowM3s,
    flowAt4hAgo,
    flowAt6hAgo,
  });

  const ratingBiasM = clamp(
    currentLevelM - (stageFromMucumDischarge(currentFlowM3s) ?? currentLevelM),
    -1.5,
    1.5,
  );
  const stageTrendMPerHour = observedTrend(mucumReadings, 'riverLevelM', baseTime, 6, 0.75);
  const flowTrendM3sPerHour = observedTrend(mucumReadings, 'flowM3s', baseTime, 6, 1200);
  const observedRain = observedBasinRain(current);
  const rainScenarios = basinRainScenarios(ensemble, forecast);
  const runoffCoefficients = runoffScenarioCoefficients(observedRain);
  const runoff = {
    minimum: routeRainfallToFlow(rainScenarios.minimum, runoffCoefficients.minimum),
    likely: routeRainfallToFlow(rainScenarios.likely, runoffCoefficients.likely),
    maximum: routeRainfallToFlow(rainScenarios.maximum, runoffCoefficients.maximum),
  };
  const glofasScenarios = normalizeGlofas(glofas, currentFlowM3s);
  const freshnessScore = dataFreshnessScore(baseTime, generatedAt);
  const hydrologyScore = hydrologyInputScore({ official, currentLevelM, measuredCurrentFlow, linhaFlowM3s, uheOutflowM3s });
  const meteorologyScore = rainScenarios.ensembleMembers > 1 ? 92 : forecast ? 58 : 20;
  const coverageScore = Math.round(100 * rainScenarios.coverage);
  const baseConfidence = Math.round(
    freshnessScore * 0.32
      + hydrologyScore * 0.34
      + meteorologyScore * 0.20
      + coverageScore * 0.14,
  );

  const timeline = [];
  const cumulativeRain = { minimum: 0, likely: 0, maximum: 0 };

  for (let hour = 0; hour <= PROJECTION_HOURS; hour += 1) {
    if (hour > 0) {
      cumulativeRain.minimum += rainScenarios.minimum[hour - 1] ?? 0;
      cumulativeRain.likely += rainScenarios.likely[hour - 1] ?? 0;
      cumulativeRain.maximum += rainScenarios.maximum[hour - 1] ?? 0;
    }

    const baseFlow = projectedBaseFlow({
      hour,
      currentFlowM3s,
      official,
      flowTrendM3sPerHour,
      stageTrendMPerHour,
      currentLevelM,
    });
    const modelError = official && hour <= official.leadHours ? 0.14 : 0.20 + (hour / PROJECTION_HOURS) * 0.12;
    const conceptual = {
      minimum: Math.max(0, baseFlow * (1 - modelError) + (runoff.minimum[hour] ?? 0)),
      likely: Math.max(0, baseFlow + (runoff.likely[hour] ?? 0)),
      maximum: Math.max(0, baseFlow * (1 + modelError) + (runoff.maximum[hour] ?? 0)),
    };
    const flowScenarios = blendGlofas(conceptual, glofasScenarios, hour);
    const levelScenarios = orderedScenarios({
      minimum: stageFromMucumDischarge(flowScenarios.minimum, ratingBiasM),
      likely: stageFromMucumDischarge(flowScenarios.likely, ratingBiasM),
      maximum: stageFromMucumDischarge(flowScenarios.maximum, ratingBiasM),
    });
    const confidencePct = confidenceForHorizon(baseConfidence, hour, Boolean(official));

    timeline.push({
      hour,
      time: new Date(Date.parse(baseTime) + hour * HOUR_MS).toISOString(),
      minimumLevelM: round(levelScenarios.minimum),
      likelyLevelM: round(levelScenarios.likely),
      maximumLevelM: round(levelScenarios.maximum),
      minimumFlowM3s: round(flowScenarios.minimum),
      likelyFlowM3s: round(flowScenarios.likely),
      maximumFlowM3s: round(flowScenarios.maximum),
      minimumRainMm: round(cumulativeRain.minimum),
      likelyRainMm: round(cumulativeRain.likely),
      maximumRainMm: round(cumulativeRain.maximum),
      confidencePct,
      confidenceLabel: confidenceLabel(confidencePct),
      status: levelStatus(levelScenarios.likely),
    });
  }

  // The measured starting point must never be widened by model uncertainty.
  timeline[0] = {
    ...timeline[0],
    minimumLevelM: round(currentLevelM),
    likelyLevelM: round(currentLevelM),
    maximumLevelM: round(currentLevelM),
    minimumFlowM3s: round(currentFlowM3s),
    likelyFlowM3s: round(currentFlowM3s),
    maximumFlowM3s: round(currentFlowM3s),
    status: levelStatus(currentLevelM),
  };

  const peaks = {
    minimum: peakScenario(timeline, 'minimumLevelM', 'minimumFlowM3s'),
    likely: peakScenario(timeline, 'likelyLevelM', 'likelyFlowM3s'),
    maximum: peakScenario(timeline, 'maximumLevelM', 'maximumFlowM3s'),
  };
  const thresholdCrossings = Object.entries(MUCUM_THRESHOLDS_M).map(([key, levelM]) => ({
    key,
    label: thresholdLabel(key),
    levelM,
    minimumAt: firstCrossing(timeline, 'minimumLevelM', levelM),
    likelyAt: firstCrossing(timeline, 'likelyLevelM', levelM),
    maximumAt: firstCrossing(timeline, 'maximumLevelM', levelM),
  }));
  const alerts = buildProjectionAlerts({ timeline, peaks, thresholdCrossings, observedRain, rainScenarios, official, freshnessScore });
  const shortTermHour = official?.leadHours ?? 6;

  return {
    generatedAt,
    baseTime,
    horizonHours: PROJECTION_HOURS,
    current: {
      levelM: round(currentLevelM),
      flowM3s: round(currentFlowM3s),
      status: levelStatus(currentLevelM),
      measuredAt: baseTime,
    },
    model: {
      name: 'Hydro Mucum Hibrido',
      version: '1.0.0',
      status: official ? 'oficial_curto_prazo_com_cenarios_experimentais' : 'experimental_sem_equacao_oficial_disponivel',
      officialLeadHours: official?.leadHours ?? null,
      officialVariant: official?.variant ?? null,
      officialEquation: official?.equation ?? null,
      officialProjectedFlowM3s: round(official?.flowM3s),
      drainageAreaKm2: MUCUM_DRAINAGE_AREA_KM2,
      thresholdsM: MUCUM_THRESHOLDS_M,
      operationalUse: 'apoio_a_decisao',
      disclaimer: 'Projecao automatica sujeita a incerteza. Nao substitui boletins do SGB, ANA, Defesa Civil ou operadores das UHEs.',
      limitations: [
        'A equacao publicada pelo SGB sustenta principalmente as primeiras 4 a 6 horas.',
        'Os cenarios de 6 a 72 horas usam chuva-vazao conceitual e devem ser recalibrados com eventos historicos locais.',
        'A curva-chave e as vazoes de barragens podem mudar; valide versoes e leituras com SGB e operadores.',
        'O GloFAS possui resolucao aproximada de 5 km e entra apenas como sinal independente de baixa ponderacao.',
      ],
    },
    confidence: {
      overallPct: timeline[shortTermHour]?.confidencePct ?? timeline[0].confidencePct,
      shortTermPct: timeline[shortTermHour]?.confidencePct ?? null,
      next24hPct: timeline[24]?.confidencePct ?? null,
      next72hPct: timeline[72]?.confidencePct ?? null,
      components: {
        freshnessPct: freshnessScore,
        hydrologyInputsPct: hydrologyScore,
        meteorologyPct: meteorologyScore,
        basinCoveragePct: coverageScore,
      },
      verificationStatus: 'sem_historico_de_previsoes_suficiente_para_validacao_operacional',
    },
    scenarios: {
      minimum: { label: 'Minimo', description: 'Chuva P10, menor escoamento e limite inferior hidrologico.' },
      likely: { label: 'Provavel', description: 'Mediana meteorologica, condicao antecedente observada e propagacao central.' },
      maximum: { label: 'Maximo', description: 'Chuva P90, solo mais responsivo e limite superior hidrologico.' },
    },
    peaks,
    thresholdCrossings,
    horizons: [4, 6, 12, 24, 48, 72].map((hour) => timeline[hour]),
    drivers: {
      observedRain3dMm: round(observedRain.last3dMm),
      observedRain7dMm: round(observedRain.last7dMm),
      forecastRain72hMm: {
        minimum: round(sum(rainScenarios.minimum)),
        likely: round(sum(rainScenarios.likely)),
        maximum: round(sum(rainScenarios.maximum)),
      },
      ensembleMembers: rainScenarios.ensembleMembers,
      basinRainCoveragePct: coverageScore,
      runoffCoefficients,
      stageTrendMPerHour: round(stageTrendMPerHour, 3),
      flowTrendM3sPerHour: round(flowTrendM3sPerHour, 1),
      linhaJoseJulioFlowM3s: round(linhaFlowM3s),
      uhe14JulhoOutflowM3s: round(uheOutflowM3s),
      glofasAvailable: Boolean(glofasScenarios),
    },
    alerts,
    timeline,
    sources: [
      { name: 'SGB - modelo de propagacao e curva-chave de Mucum', url: SOURCE_URLS.sgbForecastModel },
      { name: 'SGB - cotas operacionais e boletim Taquari', url: SOURCE_URLS.sgbBulletin },
      { name: 'SGB - Sistema de Alerta Hidrologico Taquari', url: SOURCE_URLS.sgbSystem },
      { name: 'Open-Meteo - ensemble meteorologico', url: SOURCE_URLS.openMeteoEnsemble },
      { name: 'Open-Meteo/GloFAS - vazao fluvial global', url: SOURCE_URLS.openMeteoFlood },
      { name: 'WMO - verificacao de previsoes hidrologicas', url: SOURCE_URLS.wmoVerification },
    ],
  };
}

function officialShortTermProjection({ linhaFlowM3s, uheOutflowM3s, flowAt4hAgo, flowAt6hAgo }) {
  if (linhaFlowM3s !== null && flowAt4hAgo !== null) {
    return {
      leadHours: 4,
      variant: 'SGB Linha Jose Julio',
      equation: 'Qmucum(t+4) = 1.45 * Qlinha(t) - 0.20 * Qmucum(t-4) + 190',
      flowM3s: clamp(1.45 * linhaFlowM3s - 0.20 * flowAt4hAgo + 190, 0, 30000),
    };
  }

  if (uheOutflowM3s !== null && flowAt6hAgo !== null) {
    return {
      leadHours: 6,
      variant: 'SGB UHE 14 de Julho',
      equation: 'Qmucum(t+6) = 1.45 * Qusina(t) - 0.20 * Qmucum(t-6) + 190',
      flowM3s: clamp(1.45 * uheOutflowM3s - 0.20 * flowAt6hAgo + 190, 0, 30000),
    };
  }

  return null;
}

function projectedBaseFlow({ hour, currentFlowM3s, official, flowTrendM3sPerHour, stageTrendMPerHour, currentLevelM }) {
  if (hour === 0) return currentFlowM3s;

  if (official) {
    if (hour <= official.leadHours) {
      return lerp(currentFlowM3s, official.flowM3s, hour / official.leadHours);
    }

    const decay = Math.exp(-(hour - official.leadHours) / 36);
    return Math.max(0, currentFlowM3s + (official.flowM3s - currentFlowM3s) * decay);
  }

  const derivedFlowTrend = flowTrendM3sPerHour || flowTrendFromStage(currentLevelM, stageTrendMPerHour);
  const integratedTrend = derivedFlowTrend * 12 * (1 - Math.exp(-hour / 12));
  return Math.max(0, currentFlowM3s + integratedTrend);
}

function basinRainScenarios(ensemble, forecast) {
  const ensembleSummary = summarizeEnsemble(ensemble);
  if (ensembleSummary) return ensembleSummary;

  const deterministic = weightedForecastHours(forecast);
  return {
    minimum: deterministic.map((value) => value * 0.60),
    likely: deterministic,
    maximum: deterministic.map((value) => value * 1.55),
    ensembleMembers: deterministic.some((value) => value > 0) ? 1 : 0,
    coverage: deterministic.length ? 0.65 : 0,
  };
}

function summarizeEnsemble(ensemble) {
  const points = Array.isArray(ensemble?.points) ? ensemble.points : [];
  const available = points.filter((point) => point?.payload?.hourly);
  if (!available.length) return null;

  const memberKeys = available
    .map((point) => Object.keys(point.payload.hourly).filter((key) => key === 'precipitation' || key.startsWith('precipitation_member')))
    .reduce((common, keys) => common.filter((key) => keys.includes(key)));
  if (!memberKeys.length) return null;

  const availableWeight = sum(available.map((point) => finiteNumber(point.weight) ?? 0));
  if (availableWeight <= 0) return null;

  const memberSeries = memberKeys.map((memberKey) => Array.from({ length: PROJECTION_HOURS }, (_, hour) => (
    available.reduce((total, point) => {
      const weight = (finiteNumber(point.weight) ?? 0) / availableWeight;
      return total + (finiteNumber(point.payload.hourly[memberKey]?.[hour]) ?? 0) * weight;
    }, 0)
  )));

  return {
    minimum: Array.from({ length: PROJECTION_HOURS }, (_, hour) => quantile(memberSeries.map((series) => series[hour]), 0.10)),
    likely: Array.from({ length: PROJECTION_HOURS }, (_, hour) => quantile(memberSeries.map((series) => series[hour]), 0.50)),
    maximum: Array.from({ length: PROJECTION_HOURS }, (_, hour) => quantile(memberSeries.map((series) => series[hour]), 0.90)),
    ensembleMembers: memberSeries.length,
    coverage: clamp(availableWeight, 0, 1),
  };
}

function weightedForecastHours(forecast) {
  const points = forecast?.points ?? [];
  const weighted = MUCUM_RAIN_GAUGES
    .map((gauge) => ({ gauge, point: points.find((point) => point.key === gauge.key) }))
    .filter((item) => item.point?.hours?.length);
  const availableWeight = sum(weighted.map((item) => item.gauge.weight));

  if (!weighted.length || availableWeight <= 0) return Array(PROJECTION_HOURS).fill(0);

  return Array.from({ length: PROJECTION_HOURS }, (_, hour) => weighted.reduce((total, item) => (
    total + (finiteNumber(item.point.hours[hour]?.precipitationMm) ?? 0) * item.gauge.weight / availableWeight
  ), 0));
}

function observedBasinRain(current) {
  const cities = current.regionalRainfall?.cities ?? [];
  const weighted = MUCUM_RAIN_GAUGES
    .map((gauge) => ({ gauge, city: cities.find((item) => namesMatch(item.city, gauge.city)) }))
    .filter((item) => item.city?.daily?.length);
  const availableWeight = sum(weighted.map((item) => item.gauge.weight));

  if (!weighted.length || availableWeight <= 0) {
    const fallback = finiteNumber(current.regionalRainfall?.avgMm) ?? finiteNumber(current.rainfall?.accumulatedMm) ?? 0;
    return { last3dMm: fallback, last7dMm: fallback, coverage: 0 };
  }

  const dates = Array.from(new Set(weighted.flatMap((item) => item.city.daily.map((day) => day.date)))).sort();
  const daily = dates.map((date) => weighted.reduce((total, item) => {
    const value = finiteNumber(item.city.daily.find((day) => day.date === date)?.rainfallMm) ?? 0;
    return total + value * item.gauge.weight / availableWeight;
  }, 0));

  return {
    last3dMm: sum(daily.slice(-3)),
    last7dMm: sum(daily.slice(-7)),
    coverage: clamp(availableWeight, 0, 1),
  };
}

function runoffScenarioCoefficients(observedRain) {
  const saturation = clamp(Math.max(observedRain.last3dMm / 90, observedRain.last7dMm / 105), 0, 1.4);
  const likely = clamp(0.18 + 0.22 * saturation, 0.18, 0.49);
  return {
    minimum: round(clamp(0.08 + 0.10 * saturation, 0.08, 0.22), 3),
    likely: round(likely, 3),
    maximum: round(clamp(likely + 0.20, 0.38, 0.68), 3),
  };
}

function routeRainfallToFlow(hourlyRain, runoffCoefficient) {
  const result = Array(PROJECTION_HOURS + 1).fill(0);
  const unitHydrograph = triangularUnitHydrograph(4, 14, 48);

  hourlyRain.forEach((rainMm, rainHour) => {
    const runoffVolumeM3 = Math.max(0, rainMm) * MUCUM_DRAINAGE_AREA_KM2 * 1000 * runoffCoefficient;
    unitHydrograph.forEach(({ lag, weight }) => {
      const target = rainHour + lag;
      if (target <= PROJECTION_HOURS) {
        result[target] += runoffVolumeM3 * weight / 3600;
      }
    });
  });

  return result;
}

function triangularUnitHydrograph(startLag, peakLag, endLag) {
  const raw = [];
  for (let lag = startLag; lag <= endLag; lag += 1) {
    const value = lag <= peakLag
      ? (lag - startLag + 1) / (peakLag - startLag + 1)
      : (endLag - lag + 1) / (endLag - peakLag + 1);
    raw.push({ lag, value });
  }
  const total = sum(raw.map((item) => item.value));
  return raw.map((item) => ({ lag: item.lag, weight: item.value / total }));
}

function normalizeGlofas(glofas, currentFlowM3s) {
  const daily = glofas?.daily;
  const median = numericArray(daily?.river_discharge_median ?? daily?.river_discharge);
  if (!median.length || median[0] <= 0) return null;

  const p25 = numericArray(daily?.river_discharge_p25);
  const p75 = numericArray(daily?.river_discharge_p75);
  const bias = clamp(currentFlowM3s / median[0], 0.2, 5);
  return {
    minimum: (p25.length ? p25 : median.map((value) => value * 0.75)).map((value) => value * bias),
    likely: median.map((value) => value * bias),
    maximum: (p75.length ? p75 : median.map((value) => value * 1.25)).map((value) => value * bias),
  };
}

function blendGlofas(conceptual, glofas, hour) {
  if (!glofas || hour < 12) return orderedScenarios(conceptual);
  const dayPosition = hour / 24;
  const weight = clamp((hour - 12) / 60, 0, 1) * 0.35;
  const glofasAtHour = {
    minimum: interpolateDaily(glofas.minimum, dayPosition),
    likely: interpolateDaily(glofas.likely, dayPosition),
    maximum: interpolateDaily(glofas.maximum, dayPosition),
  };
  return orderedScenarios({
    minimum: lerp(conceptual.minimum, glofasAtHour.minimum, weight),
    likely: lerp(conceptual.likely, glofasAtHour.likely, weight),
    maximum: lerp(conceptual.maximum, glofasAtHour.maximum, weight),
  });
}

function interpolateDaily(values, position) {
  const leftIndex = Math.min(Math.floor(position), values.length - 1);
  const rightIndex = Math.min(leftIndex + 1, values.length - 1);
  return lerp(values[leftIndex] ?? 0, values[rightIndex] ?? values[leftIndex] ?? 0, position - Math.floor(position));
}

export function dischargeFromMucumStage(stageM) {
  const stage = finiteNumber(stageM);
  if (stage === null || stage < 0.5) return null;
  if (stage < 2.8) return 17.15 * Math.pow(stage + 0.42, 2.77);
  return 84.32 * Math.pow(stage - 0.12, 1.67);
}

export function stageFromMucumDischarge(flowM3s, biasM = 0) {
  const flow = finiteNumber(flowM3s);
  if (flow === null || flow < 0) return null;
  const boundaryFlow = dischargeFromMucumStage(2.8);
  const stage = flow < boundaryFlow
    ? Math.pow(flow / 17.15, 1 / 2.77) - 0.42
    : Math.pow(flow / 84.32, 1 / 1.67) + 0.12;
  return clamp(stage + biasM, 0, 35);
}

function dischargeFromLinhaJoseJulioStage(stageM) {
  const stage = finiteNumber(stageM);
  if (stage === null) return null;
  const stageCm = stage * 100;
  if (stageCm < 400 || stageCm > 1800) return null;
  return 0.39 * Math.pow(stageCm - 248.75, 1.32);
}

function observedTrend(readings, key, baseTime, hours, cap) {
  const latest = latestMetric(readings, key);
  const previous = metricNearHoursAgo(readings, key, baseTime, hours);
  if (!latest || previous === null) return 0;
  const elapsedHours = Math.max(1, (Date.parse(latest.measuredAt) - (Date.parse(baseTime) - hours * HOUR_MS)) / HOUR_MS);
  return clamp((latest.value - previous) / elapsedHours, -cap, cap);
}

function flowTrendFromStage(stageM, stageTrendMPerHour) {
  if (!stageTrendMPerHour) return 0;
  const current = dischargeFromMucumStage(stageM);
  const next = dischargeFromMucumStage((finiteNumber(stageM) ?? 0) + stageTrendMPerHour);
  return current !== null && next !== null ? next - current : 0;
}

function hydrologyInputScore({ official, currentLevelM, measuredCurrentFlow, linhaFlowM3s, uheOutflowM3s }) {
  let score = 25;
  if (currentLevelM !== null) score += 20;
  if (measuredCurrentFlow !== null) score += 20;
  if (official) score += 25;
  if (linhaFlowM3s !== null || uheOutflowM3s !== null) score += 10;
  return clamp(score, 0, 100);
}

function dataFreshnessScore(measuredAt, generatedAt) {
  const ageHours = Math.max(0, (Date.parse(generatedAt) - Date.parse(measuredAt)) / HOUR_MS);
  if (ageHours <= 2) return 100;
  if (ageHours <= 4) return 85;
  if (ageHours <= 8) return 65;
  if (ageHours <= 12) return 45;
  return 20;
}

function confidenceForHorizon(base, hour, hasOfficial) {
  let factor;
  if (hour <= 4) factor = hasOfficial ? 1 : 0.88;
  else if (hour <= 6) factor = hasOfficial ? 0.92 : 0.80;
  else if (hour <= 12) factor = 0.76;
  else if (hour <= 24) factor = 0.64;
  else if (hour <= 48) factor = 0.48;
  else factor = 0.36;
  const cap = hour <= 6 && hasOfficial ? 88 : hour <= 24 ? 68 : hour <= 48 ? 54 : 42;
  return Math.round(clamp(base * factor, 15, cap));
}

function confidenceLabel(value) {
  if (value >= 75) return 'alta';
  if (value >= 50) return 'media';
  return 'baixa';
}

function buildProjectionAlerts({ timeline, peaks, thresholdCrossings, observedRain, rainScenarios, official, freshnessScore }) {
  const alerts = [];
  const inundation = thresholdCrossings.find((item) => item.key === 'inundation');
  const alert = thresholdCrossings.find((item) => item.key === 'alert');

  if (inundation?.likelyAt) {
    alerts.push({ severity: 'critical', title: 'Cenario provavel cruza a cota de inundacao', detail: `Primeiro cruzamento estimado em ${inundation.likelyAt}.` });
  } else if (inundation?.maximumAt) {
    alerts.push({ severity: 'warning', title: 'Cenario maximo alcanca a cota de inundacao', detail: 'Ha risco no limite superior; acompanhe a dispersao e os boletins oficiais.' });
  } else if (alert?.likelyAt) {
    alerts.push({ severity: 'warning', title: 'Cenario provavel cruza a cota de alerta', detail: `Primeiro cruzamento estimado em ${alert.likelyAt}.` });
  }

  const combined3d = observedRain.last3dMm + sum(rainScenarios.likely.slice(0, 72));
  if (combined3d >= 90) {
    alerts.push({ severity: 'critical', title: 'Chuva de 3 dias em faixa historicamente severa', detail: `${round(combined3d)} mm observados e previstos; o SGB identificou 90 mm/3d como condicao minima nos eventos historicos acima de 15 m.` });
  } else if (combined3d >= 50) {
    alerts.push({ severity: 'warning', title: 'Chuva de 3 dias em faixa historica de cheia', detail: `${round(combined3d)} mm observados e previstos; o SGB identificou 50 mm/3d como condicao minima nos eventos historicos acima de 10 m.` });
  }

  if (!official) {
    alerts.push({ severity: 'info', title: 'Equacao oficial de curto prazo indisponivel', detail: 'Faltam vazoes recentes da Linha Jose Julio/UHE 14 de Julho ou o historico de Mucum.' });
  }
  if (freshnessScore < 65) {
    alerts.push({ severity: 'warning', title: 'Dados hidrologicos desatualizados', detail: 'A confianca foi reduzida pela idade das leituras atuais.' });
  }
  if (!alerts.length) {
    alerts.push({ severity: 'normal', title: 'Sem cruzamento projetado das cotas criticas', detail: `Pico provavel atual: ${round(peaks.likely.levelM)} m. Continue acompanhando novas rodadas.` });
  }

  return alerts;
}

function peakScenario(timeline, levelKey, flowKey) {
  const peak = timeline.reduce((best, row) => row[levelKey] > best[levelKey] ? row : best, timeline[0]);
  return {
    levelM: peak[levelKey],
    flowM3s: peak[flowKey],
    at: peak.time,
    hour: peak.hour,
    status: levelStatus(peak[levelKey]),
    confidencePct: peak.confidencePct,
  };
}

function firstCrossing(timeline, key, threshold) {
  return timeline.find((row) => row[key] >= threshold)?.time ?? null;
}

function levelStatus(levelM) {
  if (levelM >= MUCUM_THRESHOLDS_M.inundation) return 'inundation';
  if (levelM >= MUCUM_THRESHOLDS_M.alert) return 'alert';
  if (levelM >= MUCUM_THRESHOLDS_M.attention) return 'attention';
  return 'normal';
}

function thresholdLabel(key) {
  if (key === 'inundation') return 'Inundacao';
  if (key === 'alert') return 'Alerta';
  return 'Atencao';
}

function orderedScenarios(values) {
  const available = [values.minimum, values.likely, values.maximum].map((value) => finiteNumber(value) ?? 0).sort((a, b) => a - b);
  return { minimum: available[0], likely: available[1], maximum: available[2] };
}

function stationRows(readings, code) {
  return readings.filter((reading) => String(reading.stationCode) === code && reading.measuredAt)
    .sort((left, right) => Date.parse(left.measuredAt) - Date.parse(right.measuredAt));
}

function latestReading(readings) {
  return readings.at(-1) ?? null;
}

function latestMetricValue(readings, key) {
  return latestMetric(readings, key)?.value ?? null;
}

function latestMetric(readings, key) {
  const row = readings.slice().reverse().find((reading) => finiteNumber(reading[key]) !== null);
  return row ? { value: finiteNumber(row[key]), measuredAt: row.measuredAt } : null;
}

function metricNearHoursAgo(readings, key, baseTime, hours) {
  const target = Date.parse(baseTime) - hours * HOUR_MS;
  const candidates = readings
    .filter((reading) => finiteNumber(reading[key]) !== null && Number.isFinite(Date.parse(reading.measuredAt)))
    .map((reading) => ({ reading, distance: Math.abs(Date.parse(reading.measuredAt) - target) }))
    .filter((item) => item.distance <= 3 * HOUR_MS)
    .sort((left, right) => left.distance - right.distance);
  return candidates.length ? finiteNumber(candidates[0].reading[key]) : null;
}

function mergeReadings(...groups) {
  const merged = new Map();
  groups.flat().forEach((reading) => {
    if (!reading?.stationCode || !reading?.measuredAt) return;
    const key = `${reading.stationCode}|${validDate(reading.measuredAt)}`;
    merged.set(key, { ...(merged.get(key) ?? {}), ...reading });
  });
  return Array.from(merged.values());
}

function validDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function numericArray(value) {
  return Array.isArray(value) ? value.map(finiteNumber).filter((item) => item !== null) : [];
}

function quantile(values, probability) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return lerp(sorted[lower], sorted[upper], position - lower);
}

function namesMatch(left, right) {
  const a = normalize(left);
  const b = normalize(right);
  return a === b || a.startsWith(b) || b.startsWith(a);
}

function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function sum(values) {
  return values.reduce((total, value) => total + (finiteNumber(value) ?? 0), 0);
}

function round(value, decimals = 2) {
  const numeric = finiteNumber(value);
  if (numeric === null) return null;
  const factor = 10 ** decimals;
  return Math.round(numeric * factor) / factor;
}

function lerp(start, end, ratio) {
  return start + (end - start) * clamp(ratio, 0, 1);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
