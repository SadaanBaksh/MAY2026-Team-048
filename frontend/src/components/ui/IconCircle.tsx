import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';

export interface IconCircleProps {
  name: ComponentProps<typeof Ionicons>['name'];
  color?: string;
  background?: string;
  size?: number;
}

export function IconCircle({ name, color = Colors.primary, background, size = 40 }: IconCircleProps) {
  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background ?? `${color}1A` },
      ]}>
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
