import { MucumCurrentData } from '../services/mucumCurrent';

type StationReading = MucumCurrentData['stationReadings'][number];

export function bucketStationReadings(readings: StationReading[], maxPoints = 48) {
  const sorted = readings
    .filter((reading) => reading.measuredAt)
    .slice()
    .sort((left, right) => new Date(left.measuredAt).getTime() - new Date(right.measuredAt).getTime());

  if (sorted.length <= maxPoints) {
    return sorted;
  }

  const bucketSize = Math.ceil(sorted.length / maxPoints);
  const buckets: StationReading[] = [];

  for (let index = 0; index < sorted.length; index += bucketSize) {
    const group = sorted.slice(index, index + bucketSize);
    const last = group[group.length - 1];
    const rainValues = group
      .map((reading) => reading.rainfallMm)
      .filter((value): value is number => value !== null && Number.isFinite(value));

    buckets.push({
      ...last,
      rainfallMm: rainValues.length
        ? Math.round(rainValues.reduce((sum, value) => sum + value, 0) * 100) / 100
        : null,
      riverLevelM: latestNumber(group, 'riverLevelM'),
      flowM3s: latestNumber(group, 'flowM3s'),
    });
  }

  return buckets;
}

function latestNumber(group: StationReading[], key: 'riverLevelM' | 'flowM3s') {
  for (let index = group.length - 1; index >= 0; index -= 1) {
    const value = group[index][key];
    if (value !== null && Number.isFinite(value)) return value;
  }

  return null;
}
