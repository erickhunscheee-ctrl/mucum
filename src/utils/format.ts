import { RainfallWindowHours } from '../types/navigation';

export function formatNullable(value: number | null | undefined, suffix: string) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '-';
  }

  return `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${suffix}`;
}

export function rainfallWindowLabel(hours: RainfallWindowHours) {
  if (hours === 720) {
    return '30d';
  }

  if (hours === 168) {
    return '7d';
  }

  return '24h';
}

export function formatMeasuredAt(value: string | null | undefined) {
  return formatShortDateTime(value, true);
}

export function formatForecastTime(value: string | null | undefined) {
  return formatShortDateTime(value, true);
}

export function formatChartTime(value: string) {
  return formatShortDateTime(value, false);
}

export function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatShortDateTime(value: string | null | undefined, withMinute: boolean) {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: withMinute ? '2-digit' : undefined,
  });
}
