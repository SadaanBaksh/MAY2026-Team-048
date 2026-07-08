import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { BarChart } from '@/components/ui/BarChart';
import { Card } from '@/components/ui/Card';
import { RatingStars } from '@/components/ui/RatingStars';
import { Screen } from '@/components/ui/Screen';
import { Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useTicketStore } from '@/store/ticketStore';
import type { MaintenanceStaff } from '@/types';

export default function ManagerPerformanceScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const users = useAuthStore((s) => s.users);
  const tickets = useTicketStore((s) => s.tickets);

  const rows = useMemo(() => {
    const staff = users.filter((u): u is MaintenanceStaff => u.role === 'maintenance_staff');
    return staff
      .map((w) => {
        const jobs = tickets.filter((t) => t.workerId === w.userId);
        const active = jobs.filter((t) => t.status === 'Assigned' || t.status === 'In_Progress').length;
        const completed = jobs.filter((t) => t.status === 'Resolved' || t.status === 'Closed').length;
        const rated = jobs.filter((t) => t.residentRating != null);
        const avgRating = rated.length ? rated.reduce((s, t) => s + (t.residentRating ?? 0), 0) / rated.length : w.rating;
        const resolved = jobs.filter((t) => t.dateOfResolution);
        const avgHours = resolved.length
          ? resolved.reduce((s, t) => s + (new Date(t.dateOfResolution!).getTime() - new Date(t.dateOfRequest).getTime()) / 36e5, 0) /
            resolved.length
          : null;
        return { worker: w, active, completed, avgRating, avgHours };
      })
      .sort((a, b) => b.avgRating - a.avgRating);
  }, [users, tickets]);

  const loadData = rows.map((r) => ({ label: r.worker.name.split(' ')[0], value: r.active }));

  return (
    <Screen edges={['top']}>
      <Text style={styles.title}>Staff Performance</Text>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Active Load by Staff</Text>
        <BarChart data={loadData} />
      </Card>

      <View style={styles.list}>
        {rows.map(({ worker, active, completed, avgRating, avgHours }) => (
          <Card key={worker.userId} style={styles.card}>
            <View style={styles.row}>
              <Avatar name={worker.name} color={worker.avatarColor} size={44} />
              <View style={styles.info}>
                <Text style={styles.name}>{worker.name}</Text>
                <Text style={styles.spec}>{worker.specialization}</Text>
              </View>
              <RatingStars value={Math.round(avgRating)} readOnly size={14} />
            </View>
            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{active}</Text>
                <Text style={styles.metricLabel}>Active</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{completed}</Text>
                <Text style={styles.metricLabel}>Completed</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{avgHours != null ? `${avgHours.toFixed(1)}h` : '—'}</Text>
                <Text style={styles.metricLabel}>Avg Time</Text>
              </View>
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    title: {
      ...Type.title,
      color: Colors.ink,
    },
    section: {
      gap: Spacing.sm,
    },
    sectionTitle: {
      ...Type.subtitle,
      color: Colors.ink,
    },
    list: {
      gap: Spacing.sm,
    },
    card: {
      gap: Spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    info: {
      flex: 1,
      gap: 2,
    },
    name: {
      ...Type.bodyMedium,
      color: Colors.ink,
    },
    spec: {
      ...Type.caption,
      color: Colors.inkSecondary,
    },
    metricsRow: {
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
      paddingTop: Spacing.sm,
    },
    metric: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    metricValue: {
      ...Type.bodyMedium,
      color: Colors.ink,
    },
    metricLabel: {
      ...Type.tiny,
      color: Colors.inkSecondary,
    },
  });
