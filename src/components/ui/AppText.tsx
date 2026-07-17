import { Platform, StyleSheet, Text as NativeText, TextProps, TextStyle } from 'react-native';

import { fontFamilies, minimumTextSize, normalizeFontWeight } from '../../theme/typography';

export function AppText({ style, ...props }: TextProps) {
  const flattened = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const weight = normalizeFontWeight(flattened.fontWeight);
  const fontSize = Math.max(flattened.fontSize ?? minimumTextSize, minimumTextSize);
  const resolvedStyle: TextStyle = {
    fontFamily: fontFamilies[weight],
    fontSize,
    fontWeight: Platform.OS === 'web' ? String(weight) as TextStyle['fontWeight'] : 'normal',
  };

  if (flattened.lineHeight !== undefined) {
    resolvedStyle.lineHeight = Math.max(flattened.lineHeight, Math.ceil(fontSize * 1.25));
  }

  return <NativeText {...props} style={[style, resolvedStyle]} />;
}
