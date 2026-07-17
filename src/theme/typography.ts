import { Platform, TextStyle } from 'react-native';

export type AppFontWeight = 400 | 500 | 600 | 700;

const sourceSansFamilies: Record<AppFontWeight, string> = {
  400: 'SourceSans3_400Regular',
  500: 'SourceSans3_500Medium',
  600: 'SourceSans3_600SemiBold',
  700: 'SourceSans3_700Bold',
};

const webFallback = '"Source Sans 3", Arial, sans-serif';

export const fontFamilies: Record<AppFontWeight, string> = {
  400: Platform.select({ web: `"${sourceSansFamilies[400]}", ${webFallback}`, default: sourceSansFamilies[400] }),
  500: Platform.select({ web: `"${sourceSansFamilies[500]}", ${webFallback}`, default: sourceSansFamilies[500] }),
  600: Platform.select({ web: `"${sourceSansFamilies[600]}", ${webFallback}`, default: sourceSansFamilies[600] }),
  700: Platform.select({ web: `"${sourceSansFamilies[700]}", ${webFallback}`, default: sourceSansFamilies[700] }),
};

export const chartFontFamily = `"${sourceSansFamilies[400]}", ${webFallback}`;
export const minimumTextSize = 14;

export function normalizeFontWeight(weight: TextStyle['fontWeight']): AppFontWeight {
  const numericWeight = typeof weight === 'number' ? weight : Number.parseInt(weight ?? '400', 10);

  if (numericWeight >= 700) return 700;
  if (numericWeight >= 600) return 600;
  if (numericWeight >= 500) return 500;
  return 400;
}
