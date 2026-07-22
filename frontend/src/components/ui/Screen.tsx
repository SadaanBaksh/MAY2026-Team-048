import { ReactNode, useMemo } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useIsDesktop';
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
  /** Overrides the default desktop content max-width (e.g. narrower for single-card pages like Profile). */
  maxWidth?: number;
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
  maxWidth = MaxContentWidth,
}: ScreenProps) {
  const { Colors } = useTheme();
  const isDesktop = useIsDesktop();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const outer = padded ? styles.padded : undefined;

  const content = (
    <View
      style={[
        styles.inner,
        !scroll && styles.innerFlex,
        padded && styles.gap,
        isDesktop && { maxWidth },
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, style]} edges={edges}>
      {scroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[outer, isDesktop && styles.centered, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={Colors.primary}
              />
            ) : undefined
          }
        >
          {content}
        </ScrollView>
      ) : (
        <View style={[styles.scroll, outer, isDesktop && styles.centered, contentStyle]}>
          {content}
        </View>
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
    },
    centered: {
      alignItems: 'center',
    },
    inner: {
      width: '100%',
    },
    innerFlex: {
      flex: 1,
    },
    gap: {
      gap: Spacing.md,
    },
  });
