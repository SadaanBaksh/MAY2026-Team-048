import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TicketCard } from '@/components/shared/TicketCard';
import { Colors, Spacing, Type } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { useTicketStore } from '@/store/ticketStore';

type Segment = 'active' | 'history';

export default function ResidentComplaintsScreen() {
  const user = useAuthStore((s) => s.currentUser)!;
  const tickets = useTicketStore((s) => s.tickets);
  const [segment, setSegment] = useState<Segment>('active');

  const myTickets = useMemo(
    () =>
      tickets
        .filter((t) => t.residentId === user.userId)
        .sort((a, b) => new Date(b.dateOfRequest).getTime() - new Date(a.dateOfRequest).getTime()),
    [tickets, user.userId]
  );

  const filtered = myTickets.filter((t) => (segment === 'active' ? t.status !== 'Closed' : t.status === 'Closed'));

  return (
    <Screen edges={['top']}>
      <Text style={styles.title}>My Complaints</Text>
      <SegmentedControl
        value={segment}
        onChange={setSegment}
        options={[
          { label: 'Active', value: 'active' },
          { label: 'History', value: 'history' },
        ]}
      />
      <View style={styles.list}>
        {filtered.length === 0 ? (
          <EmptyState
            icon={segment === 'active' ? 'checkmark-circle-outline' : 'time-outline'}
            title={segment === 'active' ? 'No active complaints' : 'No history yet'}
            message={
              segment === 'active'
                ? 'You have no ongoing maintenance requests right now.'
                : 'Closed and rated complaints will appear here.'
            }
          />
        ) : (
          filtered.map((t) => (
            <TicketCard key={t.ticketId} ticket={t} onPress={() => router.push(`/(resident)/complaint/${t.ticketId}`)} />
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...Type.title,
    color: Colors.ink,
  },
  list: {
    gap: Spacing.sm,
  },
});
