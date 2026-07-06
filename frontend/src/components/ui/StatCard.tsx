import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Colors, Type } from '@/constants/theme';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: ComponentProps<typeof Ionicons>['name'];
  color?: string;
  trend?: string;
}

export function StatCard({ label, value, icon, color = Colors.primary, trend }: StatCardProps) {
  return (
    <Card style={styles.card} padded>
      <View style={[styles.iconWrap, { backgroundColor: `${color}17` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {trend && <Text style={styles.trend}>{trend}</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
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
