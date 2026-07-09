import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontFamily, Radius, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';

export interface SegmentedControlProps<T extends string> {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  return (
    <View style={styles.track}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.segment, active && styles.segmentActive]}>
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      backgroundColor: Colors.surfaceSunken,
      borderRadius: Radius.md,
      padding: 3,
      gap: 3,
    },
    segment: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: Radius.sm,
      alignItems: 'center',
    },
    segmentActive: {
      backgroundColor: Colors.surface,
      shadowColor: '#0F1729',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 1,
    },
    label: {
      ...Type.caption,
      color: Colors.inkSecondary,
    },
    labelActive: {
      color: Colors.ink,
      fontFamily: FontFamily.bold,
    },
  });
