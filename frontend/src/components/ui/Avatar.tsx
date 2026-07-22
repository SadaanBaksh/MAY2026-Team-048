import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

export interface AvatarProps {
  name: string;
  color?: string;
  size?: number;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, color, size = 40 }: AvatarProps) {
  const { Colors } = useTheme();
  color = color ?? Colors.teal;
  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `${color}1F`,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: Colors.border,
        },
      ]}
    >
      <Text style={{ color, fontSize: size * 0.38, fontWeight: '700' }}>{getInitials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
