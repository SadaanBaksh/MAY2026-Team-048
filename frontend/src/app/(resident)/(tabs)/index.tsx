import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { StatCard } from '@/components/ui/StatCard';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { TicketCard } from '@/components/shared/TicketCard';
import { APARTMENTS } from '@/data/seed';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { useTicketStore } from '@/store/ticketStore';
import type { Resident } from '@/types';

export default function ResidentHomeScreen() {
  const user = useAuthStore((s) => s.currentUser) as Resident;
  const tickets = useTicketStore((s) => s.tickets);

  const apartment = APARTMENTS.find((a) => a.apartmentId === user.apartmentId);

  const myTickets = useMemo(
    () =>
      tickets
        .filter((t) => t.residentId === user.userId)
        .sort((a, b) => new Date(b.dateOfRequest).getTime() - new Date(a.dateOfRequest).getTime()),
    [tickets, user.userId]
  );

  const active = myTickets.filter((t) => t.status !== 'Closed');
  const needsAttention = myTickets.filter((t) => t.status === 'Resolved' && t.residentRating == null);
  const closed = myTickets.filter((t) => t.status === 'Closed');

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Avatar name={user.name} color={user.avatarColor} size={44} />
          <View>
            <Text style={styles.greeting}>Hi, {user.name.split(' ')[0]}</Text>
            <Text style={styles.unit}>{apartment ? `${apartment.unitNumber}, ${apartment.building}` : 'Resident'}</Text>
          </View>
        </View>
        <NotificationBell userId={user.userId} onPress={() => router.push('/(resident)/notifications')} />
      </View>

      <Pressable onPress={() => router.push('/(resident)/new-complaint')}>
        <Card style={styles.reportCard} elevated={false}>
          <View style={styles.reportIcon}>
            <Ionicons name="camera" size={22} color={Colors.white} />
          </View>
          <View style={styles.reportText}>
            <Text style={styles.reportTitle}>Report an Issue</Text>
            <Text style={styles.reportSubtitle}>Snap a photo or video — AI fills in the details</Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={26} color={Colors.white} />
        </Card>
      </Pressable>

      <View style={styles.statsRow}>
        <StatCard label="Active" value={active.length} icon="pulse-outline" color={Colors.primary} />
        <StatCard label="Needs Review" value={needsAttention.length} icon="star-outline" color={Colors.accent} />
        <StatCard label="Resolved" value={closed.length} icon="checkmark-done-outline" color={Colors.success} />
      </View>

      {needsAttention.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Needs your review</Text>
          <View style={styles.list}>
            {needsAttention.map((t) => (
              <TicketCard
                key={t.ticketId}
                ticket={t}
                subtitle="Verify the fix and rate the work"
                onPress={() => router.push(`/(resident)/complaint/${t.ticketId}`)}
              />
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Complaints</Text>
          {myTickets.length > 0 && (
            <Text style={styles.viewAll} onPress={() => router.push('/(resident)/(tabs)/complaints')}>
              View all
            </Text>
          )}
        </View>
        {myTickets.length === 0 ? (
          <EmptyState
            icon="document-text-outline"
            title="No complaints yet"
            message="Report your first maintenance issue and our AI will help describe it."
            actionLabel="Report an Issue"
            onAction={() => router.push('/(resident)/new-complaint')}
          />
        ) : (
          <View style={styles.list}>
            {myTickets.slice(0, 3).map((t) => (
              <TicketCard key={t.ticketId} ticket={t} onPress={() => router.push(`/(resident)/complaint/${t.ticketId}`)} />
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  greeting: {
    ...Type.title,
    color: Colors.ink,
  },
  unit: {
    ...Type.caption,
    color: Colors.inkSecondary,
  },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderWidth: 0,
  },
  reportIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportText: {
    flex: 1,
  },
  reportTitle: {
    ...Type.bodyMedium,
    color: Colors.white,
  },
  reportSubtitle: {
    ...Type.caption,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
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
