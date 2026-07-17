export const colors = {
  mucumBlue: '#006EA8',
  institutionalBlue: '#003B5C',
  valleyGreen: '#168A4D',
  bridgeGold: '#F2C230',
  riverLight: '#D9EFF8',
  background: '#F5F7F8',
  surface: '#FFFFFF',
  text: '#173042',
  textSecondary: '#64747D',

  danger: '#C62828',
  warning: '#ED8B00',
  info: '#0277BD',
  safe: '#2E7D32',

  border: '#D5E1E7',
  surfaceMuted: '#EEF4F6',
  blueSoft: '#E4F3F9',
  greenSoft: '#E7F3EB',
  goldSoft: '#FFF7D6',
  dangerSoft: '#FBE9E9',
  warningSoft: '#FFF2DC',
  infoSoft: '#E3F2F8',
  safeSoft: '#E7F3E8',
  white: '#FFFFFF',
  whiteMuted: 'rgba(255,255,255,0.72)',
  whiteSubtle: 'rgba(255,255,255,0.12)',
  whiteFaint: 'rgba(255,255,255,0.07)',
  whiteTextMuted: 'rgba(255,255,255,0.62)',
  whiteTextFaint: 'rgba(255,255,255,0.38)',
} as const;

export const chartColors = {
  rain: colors.mucumBlue,
  rainFill: 'rgba(0,110,168,0.28)',
  rainGrid: 'rgba(0,110,168,0.10)',
  level: colors.valleyGreen,
  levelFill: 'rgba(22,138,77,0.12)',
  flow: colors.info,
  flowFill: 'rgba(2,119,189,0.10)',
  reservoir: colors.bridgeGold,
} as const;

export const riverChartColors = [
  colors.mucumBlue,
  colors.valleyGreen,
  colors.warning,
  colors.info,
  colors.danger,
  colors.institutionalBlue,
  colors.bridgeGold,
] as const;
