import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { SearchBar } from '@/components/ui/SearchBar';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TicketCard } from '@/components/shared/TicketCard';
import { Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useTicketStore } from '@/store/ticketStore';
import { useDashboardSearch } from '@/hooks/useDashboardSearch';

type Segment = 'active' | 'history';

export default function ResidentComplaintsScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const user = useAuthStore((s) => s.currentUser)!;
  const users = useAuthStore((s) => s.users);
  const tickets = useTicketStore((s) => s.tickets);
  const [segment, setSegment] = useState<Segment>('active');
  const [query, setQuery] = useState('');

  const { matchingComplaints } = useDashboardSearch(query, tickets, users, user);

  const myTickets = useMemo(
    () =>
      tickets
        .filter((t) => t.residentId === user.userId)
        .sort((a, b) => new Date(b.dateOfRequest).getTime() - new Date(a.dateOfRequest).getTime()),
    [tickets, user.userId],
  );

  const displayedTickets = useMemo(() => {
    const list = query.trim() ? matchingComplaints : myTickets;
    return list.filter((t) =>
      segment === 'active'
        ? t.status !== 'Closed' && t.status !== 'Cancelled' && t.status !== 'Rejected'
        : t.status === 'Closed' || t.status === 'Cancelled' || t.status === 'Rejected',
    );
  }, [query, matchingComplaints, myTickets, segment]);

  return (
    <Screen edges={['top']}>
      <Text style={styles.title}>My Complaints</Text>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search my complaints by title, category, status..."
      />
      <SegmentedControl
        value={segment}
        onChange={setSegment}
        options={[
          { label: 'Active', value: 'active' },
          { label: 'History', value: 'history' },
        ]}
      />
      <View style={styles.list}>
        {displayedTickets.length === 0 ? (
          <EmptyState
            icon={query.trim() ? 'search-outline' : segment === 'active' ? 'checkmark-circle-outline' : 'time-outline'}
            title={
              query.trim()
                ? 'No matching complaints'
                : segment === 'active'
                ? 'No active complaints'
                : 'No history yet'
            }
            message={
              query.trim()
                ? `No complaints matched "${query}".`
                : segment === 'active'
                ? 'You have no ongoing maintenance requests right now.'
                : 'Closed and rated complaints will appear here.'
            }
          />
        ) : (
          displayedTickets.map((t) => (
            <TicketCard
              key={t.ticketId}
              ticket={t}
              onPress={() => router.push(`/(resident)/complaint/${t.ticketId}`)}
            />
          ))
        )}
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
    list: {
      gap: Spacing.sm,
    },
  });
