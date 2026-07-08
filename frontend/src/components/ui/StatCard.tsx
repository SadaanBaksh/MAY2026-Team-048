import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: ComponentProps<typeof Ionicons>['name'];
  color?: string;
  trend?: string;
}

export function StatCard({ label, value, icon, color, trend }: StatCardProps) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const resolvedColor = color ?? Colors.primary;
  return (
    <Card style={styles.card} padded>
      <View style={[styles.iconWrap, { backgroundColor: `${resolvedColor}17` }]}>
        <Ionicons name={icon} size={18} color={resolvedColor} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {trend && <Text style={styles.trend}>{trend}</Text>}
    </Card>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flex: 1,
      minWidth: 132,
      gap: 4,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    value: {
      ...Type.title,
      color: Colors.ink,
    },
    label: {
      ...Type.caption,
      color: Colors.inkSecondary,
    },
    trend: {
      ...Type.tiny,
      color: Colors.success,
      marginTop: 2,
    },
  });
