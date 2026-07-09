import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme, type ThemeColors } from '@/hooks/useTheme';

export function Divider({ inset = 0 }: { inset?: number }) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  return <View style={[styles.line, { marginLeft: inset }]} />;
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    line: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: Colors.border,
    },
  });
