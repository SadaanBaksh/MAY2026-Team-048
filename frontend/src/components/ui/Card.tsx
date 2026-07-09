import { useMemo } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, ShadowSmall, Spacing } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';

export interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  elevated?: boolean;
}

export function Card({ children, onPress, style, padded = true, elevated = true }: CardProps) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const content = (
    <View style={[styles.base, padded && styles.padded, elevated && ShadowSmall, style]}>
      {children}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
      {content}
    </Pressable>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    base: {
      backgroundColor: Colors.surface,
      borderRadius: Radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
    },
    padded: {
      padding: Spacing.md,
    },
  });
