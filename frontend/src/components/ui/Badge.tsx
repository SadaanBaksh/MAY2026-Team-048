import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { Priority, PublicServiceStatus, TicketStatus } from '@/types';

export function Badge({
  label,
  color,
  background,
}: {
  label: string;
  color: string;
  background: string;
}) {
  return (
    <View style={[styles.base, { backgroundColor: background }]}>
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const STATUS_LABELS: Record<TicketStatus | PublicServiceStatus, string> = {
  Pending: 'Pending',
  Assigned: 'Assigned',
  In_Progress: 'In Progress',
  Resolved: 'Resolved',
  Closed: 'Closed',
  Merged: 'Merged',
};

export function StatusBadge({ status }: { status: TicketStatus | PublicServiceStatus }) {
  const { StatusColors } = useTheme();
  const c = status === 'Merged' ? StatusColors.Closed : StatusColors[status];
  return (
    <View style={[styles.base, styles.withDot, { backgroundColor: c.soft }]}>
      <View style={[styles.dot, { backgroundColor: c.dot }]} />
      <Text style={[styles.label, { color: c.text }]}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const { PriorityColors } = useTheme();
  const c = PriorityColors[priority];
  return (
    <View style={[styles.base, styles.withDot, { backgroundColor: c.soft }]}>
      <View style={[styles.dot, { backgroundColor: c.dot }]} />
      <Text style={[styles.label, { color: c.text }]}>{priority}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 5,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  withDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    ...Type.tiny,
  },
});
