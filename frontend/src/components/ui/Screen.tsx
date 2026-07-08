import { ReactNode, useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';

export interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

export function Screen({
  children,
  scroll = true,
  padded = true,
  style,
  contentStyle,
  refreshing,
  onRefresh,
  edges = ['top'],
}: ScreenProps) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const inner = padded ? styles.padded : undefined;

  return (
    <SafeAreaView style={[styles.safeArea, style]} edges={edges}>
      {scroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[inner, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
            ) : undefined
          }>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.scroll, inner, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: Colors.surfaceMuted,
    },
    scroll: {
      flex: 1,
    },
    padded: {
      padding: Spacing.md,
      paddingBottom: Spacing.xxxl,
      gap: Spacing.md,
    },
  });
