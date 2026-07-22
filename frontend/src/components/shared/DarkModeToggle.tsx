import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Switch, Text } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useThemeStore } from '@/store/themeStore';

export function DarkModeToggle() {
  const { Colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  return (
    <Card style={styles.row}>
      <Ionicons name={isDark ? 'moon' : 'moon-outline'} size={20} color={Colors.inkSecondary} />
      <Text style={styles.label}>Dark Mode</Text>
      <Switch
        value={isDark}
        onValueChange={toggleTheme}
        trackColor={{
          false: Colors.borderStrong,
          true: isDark ? Colors.primaryDark : Colors.primary,
        }}
        thumbColor={Colors.white}
        ios_backgroundColor={Colors.borderStrong}
      />
    </Card>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    label: {
      ...Type.body,
      color: Colors.ink,
      flex: 1,
    },
  });
