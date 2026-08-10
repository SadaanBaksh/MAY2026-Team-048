import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AISummaryCard } from '@/components/ui/AISummaryCard';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { StatCard } from '@/components/ui/StatCard';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { TicketCard } from '@/components/shared/TicketCard';
import { DashboardSearch } from '@/components/shared/DashboardSearch';
import { APARTMENTS } from '@/data/seed';
import { Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useTicketStore } from '@/store/ticketStore';
import { isTicketOverdue } from '@/utils/overdue';
import { fetchDashboardSummary } from '@/api/client';

export default function EmployeeDashboardScreen() {
  const { Colors } = useTheme();
  const user = useAuthStore((s) => s.currentUser)!;
  const users = useAuthStore((s) => s.users);
  const token = useAuthStore((s) => s.token);
  const tickets = useTicketStore((s) => s.tickets);
  const refreshTickets = useTicketStore((s) => s.refreshTickets);
  const refreshNotifications = useNotificationStore((s) => s.refreshNotifications);

  const [searchQuery, setSearchQuery] = useState('');
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (token) refreshTickets(token);
      if (token) refreshNotifications(token);
      if (token) {
        setSummaryLoading(true);
        fetchDashboardSummary(token)
          .then(setAiSummary)
          .catch(() => setAiSummary(null))
          .finally(() => setSummaryLoading(false));
      }
    }, [token, refreshTickets, refreshNotifications]),
  );

  const sorted = useMemo(
    () =>
      [...tickets].sort(
        (a, b) => new Date(b.dateOfRequest).getTime() - new Date(a.dateOfRequest).getTime(),
      ),
    [tickets],
  );

  const pending = sorted.filter((t) => t.status === 'Pending');
  const overdue = sorted.filter(isTicketOverdue);
  const inProgress = sorted.filter((t) => t.status === 'In_Progress');
  const resolved = sorted.filter((t) => t.status === 'Resolved' || t.status === 'Closed');

  const residentName = (residentId: string) =>
    users.find((u) => u.userId === residentId)?.name ?? 'Resident';
  const apartmentFor = (residentId: string) => {
    const resident = users.find((u) => u.userId === residentId);
    if (!resident || resident.role !== 'resident') return '';
    const apt = APARTMENTS.find((a) => a.apartmentId === resident.apartmentId);
    return apt ? `${apt.unitNumber}, ${apt.building}` : '';
  };

  const styles = useMemo(() => getStyles(Colors), [Colors]);

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            style={styles.headerProfile}
            onPress={() => router.push('/(employee)/(tabs)/profile')}
          >
            <Avatar name={user.name} color={user.avatarColor} size={44} />
            <View>
              <Text style={styles.greeting}>Hi, {user.name.split(' ')[0]}</Text>
              <Text style={styles.role}>Facility Coordinator</Text>
            </View>
          </Pressable>
        </View>
        <NotificationBell
          userId={user.userId}
          onPress={() => router.push('/(employee)/notifications')}
        />
      </View>

      <DashboardSearch query={searchQuery} onChangeQuery={setSearchQuery} />

      {!searchQuery.trim() && (
        <>
          <View style={styles.statsGrid}>
        <StatCard
          label="Pending Review"
          value={pending.length}
          icon="hourglass-outline"
          color={Colors.warning}
        />
        <StatCard
          label="Overdue"
          value={overdue.length}
          icon="alert-circle-outline"
          color={Colors.danger}
        />
        <StatCard
          label="In Progress"
          value={inProgress.length}
          icon="construct-outline"
          color={Colors.info}
        />
        <StatCard
          label="Resolved"
          value={resolved.length}
          icon="checkmark-done-outline"
          color={Colors.success}
        />
      </View>

      {summaryLoading ? (
        <AISummaryCard summary="Generating summary…" variant="employee" label="Operations Brief" />
      ) : aiSummary ? (
        <AISummaryCard summary={aiSummary} variant="employee" label="Operations Brief" />
      ) : null}

      {overdue.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overdue Complaints</Text>
          <View style={styles.list}>
            {overdue.slice(0, 4).map((t) => (
              <TicketCard
                key={t.ticketId}
                ticket={t}
                subtitle={`${residentName(t.residentId)} · ${apartmentFor(t.residentId)}`}
                onPress={() => router.push(`/(employee)/complaint/${t.ticketId}`)}
              />
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Awaiting Review</Text>
          {pending.length > 0 && (
            <Text
              style={styles.viewAll}
              onPress={() => router.push('/(employee)/(tabs)/complaints')}
            >
              View all
            </Text>
          )}
        </View>
        {pending.length === 0 ? (
          <EmptyState
            icon="checkmark-circle-outline"
            title="All caught up"
            message="No new complaints awaiting review."
          />
        ) : (
          <View style={styles.list}>
            {pending.slice(0, 4).map((t) => (
              <TicketCard
                key={t.ticketId}
                ticket={t}
                subtitle={`${residentName(t.residentId)} · ${apartmentFor(t.residentId)}`}
                onPress={() => router.push(`/(employee)/complaint/${t.ticketId}`)}
              />
            ))}
          </View>
        )}
      </View>
      </>
      )}
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
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    section: {
      gap: Spacing.sm,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionTitle: {
      ...Type.subtitle,
      color: Colors.ink,
    },
    viewAll: {
      ...Type.captionBold,
      color: Colors.primary,
    },
    list: {
      gap: Spacing.sm,
    },
  });
