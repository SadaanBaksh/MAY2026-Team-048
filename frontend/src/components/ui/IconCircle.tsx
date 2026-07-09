import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

export interface IconCircleProps {
  name: ComponentProps<typeof Ionicons>['name'];
  color?: string;
  background?: string;
  size?: number;
}

export function IconCircle({ name, color, background, size = 40 }: IconCircleProps) {
  const { Colors } = useTheme();
  color = color ?? Colors.accent;
  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background ?? `${color}1A`,
        },
      ]}
    >
      <Ionicons name={name} size={size * 0.5} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
