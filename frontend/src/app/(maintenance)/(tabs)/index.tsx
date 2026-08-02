import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { TicketCard } from '@/components/shared/TicketCard';
import { APARTMENTS } from '@/data/seed';
import { Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useTicketStore } from '@/store/ticketStore';
import type { MaintenanceStaff } from '@/types';

type Segment = 'active' | 'completed';

export default function MaintenanceJobsScreen() {
  const { Colors } = useTheme();
  const user = useAuthStore((s) => s.currentUser) as MaintenanceStaff;
  const users = useAuthStore((s) => s.users);
  const token = useAuthStore((s) => s.token);
  const tickets = useTicketStore((s) => s.tickets);
  const refreshTickets = useTicketStore((s) => s.refreshTickets);
  const refreshNotifications = useNotificationStore((s) => s.refreshNotifications);
  const [segment, setSegment] = useState<Segment>('active');

  useFocusEffect(
    useCallback(() => {
      if (token) refreshTickets(token);
      if (token) refreshNotifications(token);
    }, [token, refreshTickets, refreshNotifications]),
  );

  const myJobs = useMemo(
    () =>
      tickets
        .filter((t) => t.workerId === user.userId)
        .sort((a, b) => new Date(b.dateOfRequest).getTime() - new Date(a.dateOfRequest).getTime()),
    [tickets, user.userId],
  );

  const filtered = myJobs.filter((t) =>
    segment === 'active'
      ? t.status === 'Assigned' || t.status === 'In_Progress'
      : t.status === 'Resolved' || t.status === 'Closed',
  );

  const infoFor = (residentId: string) => {
    const resident = users.find((u) => u.userId === residentId);
    if (!resident || resident.role !== 'resident') return resident?.name ?? 'Resident';
    const apt = APARTMENTS.find((a) => a.apartmentId === resident.apartmentId);
    return `${resident.name} · ${apt ? apt.unitNumber : ''}`;
  };

  const styles = useMemo(() => getStyles(Colors), [Colors]);

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            style={styles.headerProfile}
            onPress={() => router.push('/(maintenance)/(tabs)/profile')}
          >
            <Avatar name={user.name} color={user.avatarColor} size={44} />
            <View>
              <Text style={styles.greeting}>Hi, {user.name.split(' ')[0]}</Text>
              <Text style={styles.role}>{user.specialization}</Text>
            </View>
          </Pressable>
        </View>
        <NotificationBell
          userId={user.userId}
          onPress={() => router.push('/(maintenance)/notifications')}
        />
      </View>

      <SegmentedControl
        value={segment}
        onChange={setSegment}
        options={[
          { label: 'Active', value: 'active' },
          { label: 'Completed', value: 'completed' },
        ]}
      />

      <View style={styles.list}>
        {filtered.length === 0 ? (
          <EmptyState
            icon={segment === 'active' ? 'checkmark-circle-outline' : 'time-outline'}
            title={segment === 'active' ? 'No active jobs' : 'No completed jobs yet'}
            message={
              segment === 'active'
                ? 'New assignments will appear here.'
                : 'Jobs you finish will show up here.'
            }
          />
        ) : (
          filtered.map((t) => (
            <TicketCard
              key={t.ticketId}
              ticket={t}
              subtitle={infoFor(t.residentId)}
              onPress={() => router.push(`/(maintenance)/job/${t.ticketId}`)}
            />
          ))
        )}
      </View>
    </Screen>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    headerProfile: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    greeting: {
      ...Type.title,
      color: Colors.ink,
    },
    role: {
      ...Type.caption,
      color: Colors.inkSecondary,
    },
    list: {
      gap: Spacing.sm,
    },
  });
