import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ReactNode, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: ReactNode;
}

export function ScreenHeader({ title, subtitle, showBack, onBack, right }: ScreenHeaderProps) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.row}>
        <View style={styles.left}>
          {showBack && (
            <Pressable
              onPress={onBack ?? (() => router.back())}
              hitSlop={10}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back">
              <Ionicons name="chevron-back" size={22} color={Colors.ink} />
            </Pressable>
          )}
          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle && (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>
        {right && <View>{right}</View>}
      </View>
    </SafeAreaView>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      backgroundColor: Colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      minHeight: 52,
    },
    left: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      flexShrink: 1,
    },
    backButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: -Spacing.xs,
    },
    titleBlock: {
      flexShrink: 1,
    },
    title: {
      ...Type.subtitle,
      color: Colors.ink,
    },
    subtitle: {
      ...Type.caption,
      color: Colors.inkSecondary,
      marginTop: 1,
    },
  });
