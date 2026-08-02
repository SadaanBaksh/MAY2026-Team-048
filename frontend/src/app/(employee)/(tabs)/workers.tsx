import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { RatingStars } from '@/components/ui/RatingStars';
import { Screen } from '@/components/ui/Screen';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useTicketStore } from '@/store/ticketStore';
import type { MaintenanceStaff } from '@/types';

export default function EmployeeWorkersScreen() {
  const { Colors } = useTheme();
  const users = useAuthStore((s) => s.users);
  const refreshUsers = useAuthStore((s) => s.refreshUsers);
  const tickets = useTicketStore((s) => s.tickets);

  useFocusEffect(
    useCallback(() => {
      refreshUsers();
    }, [refreshUsers]),
  );

  const workers = useMemo(() => {
    const staff = users.filter(
      (u): u is MaintenanceStaff => u.role === 'maintenance_staff' && u.accountStatus === 'active',
    );
    return staff
      .map((w) => ({
        worker: w,
        activeJobs: tickets.filter(
          (t) => t.workerId === w.userId && (t.status === 'Assigned' || t.status === 'In_Progress'),
        ).length,
        completedJobs: tickets.filter(
          (t) => t.workerId === w.userId && (t.status === 'Resolved' || t.status === 'Closed'),
        ).length,
      }))
      .sort((a, b) => a.activeJobs - b.activeJobs);
  }, [users, tickets]);

  const styles = useMemo(() => getStyles(Colors), [Colors]);

  return (
    <Screen edges={['top']}>
      <Text style={styles.title}>Maintenance Staff</Text>
      <Text style={styles.subtitle}>Sorted by current workload — least busy first</Text>

      <View style={styles.list}>
        {workers.map(({ worker, activeJobs, completedJobs }) => (
          <Card key={worker.userId} style={styles.card}>
            <Avatar name={worker.name} color={worker.avatarColor} size={48} />
            <View style={styles.info}>
              <Text style={styles.name}>{worker.name}</Text>
              <Text style={styles.spec}>{worker.specialization}</Text>
              <RatingStars value={Math.round(worker.rating)} readOnly size={14} />
            </View>
            <View style={styles.loadBadge}>
              <Text style={styles.loadValue}>{activeJobs}</Text>
              <Text style={styles.loadLabel}>active</Text>
              <Text style={styles.completedLabel}>{completedJobs} done</Text>
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
    subtitle: {
      ...Type.caption,
      color: Colors.inkSecondary,
      marginTop: -8,
    },
    list: {
      gap: Spacing.sm,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    info: {
      flex: 1,
      gap: 3,
    },
    name: {
      ...Type.bodyMedium,
      color: Colors.ink,
    },
    spec: {
      ...Type.caption,
      color: Colors.inkSecondary,
    },
    loadBadge: {
      alignItems: 'center',
      backgroundColor: Colors.surfaceSunken,
      borderRadius: Radius.md,
      paddingVertical: 6,
      paddingHorizontal: 10,
      minWidth: 64,
    },
    loadValue: {
      ...Type.title,
      fontSize: 18,
      color: Colors.ink,
    },
    loadLabel: {
      ...Type.tiny,
      color: Colors.inkSecondary,
    },
    completedLabel: {
      ...Type.tiny,
      color: Colors.inkTertiary,
      marginTop: 2,
    },
  });
