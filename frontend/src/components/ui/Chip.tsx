import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Radius, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: ComponentProps<typeof Ionicons>['name'];
  color?: string;
}

export function Chip({ label, active, onPress, icon, color }: ChipProps) {
  const { Colors } = useTheme();
  color = color ?? Colors.primary;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.base,
        {
          borderColor: active ? color : Colors.border,
          backgroundColor: active ? `${color}14` : Colors.surface,
        },
      ]}
    >
      {icon && <Ionicons name={icon} size={14} color={active ? color : Colors.inkSecondary} />}
      <Text
        style={[styles.label, { color: active ? color : Colors.inkSecondary }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  label: {
    ...Type.caption,
    fontWeight: '600',
  },
});
