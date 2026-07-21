import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { SearchBar } from '@/components/ui/SearchBar';
import { TicketCard } from '@/components/shared/TicketCard';
import { APARTMENTS } from '@/data/seed';
import { Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useTicketStore } from '@/store/ticketStore';
import type { TicketStatus } from '@/types';
import { isTicketOverdue } from '@/utils/overdue';

type StatusFilter = 'All' | TicketStatus;

const STATUS_FILTERS: StatusFilter[] = [
  'All',
  'Pending',
  'Assigned',
  'In_Progress',
  'Resolved',
  'Closed',
];

export default function EmployeeComplaintsScreen() {
  const { Colors } = useTheme();
  const users = useAuthStore((s) => s.users);
  const tickets = useTicketStore((s) => s.tickets);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const residentName = (residentId: string) =>
    users.find((u) => u.userId === residentId)?.name ?? 'Resident';
  const apartmentFor = (residentId: string) => {
    const resident = users.find((u) => u.userId === residentId);
    if (!resident || resident.role !== 'resident') return '';
    const apt = APARTMENTS.find((a) => a.apartmentId === resident.apartmentId);
    return apt ? `${apt.unitNumber}, ${apt.building}` : '';
  };

  const filtered = useMemo(() => {
    return tickets
      .filter((t) => statusFilter === 'All' || t.status === statusFilter)
      .filter((t) => !overdueOnly || isTicketOverdue(t))
      .filter((t) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          residentName(t.residentId).toLowerCase().includes(q) ||
          apartmentFor(t.residentId).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.dateOfRequest).getTime() - new Date(a.dateOfRequest).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, statusFilter, overdueOnly, query, users]);

  const styles = useMemo(() => getStyles(Colors), [Colors]);

  return (
    <Screen edges={['top']}>
      <Text style={styles.title}>Complaints</Text>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search by title, resident, or unit"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {STATUS_FILTERS.map((s) => (
          <Chip
            key={s}
            label={s === 'All' ? 'All' : s.replace('_', ' ')}
            active={statusFilter === s}
            color={Colors.teal}
            onPress={() => setStatusFilter(s)}
          />
        ))}
        <Chip
          label="Overdue"
          icon="alert-circle-outline"
          active={overdueOnly}
          color={Colors.danger}
          onPress={() => setOverdueOnly((v) => !v)}
        />
      </ScrollView>

      <View style={styles.list}>
        {filtered.length === 0 ? (
          <EmptyState
            icon="search-outline"
            title="No complaints found"
            message="Try adjusting your search or filters."
          />
        ) : (
          filtered.map((t) => (
            <TicketCard
              key={t.ticketId}
              ticket={t}
              subtitle={`${residentName(t.residentId)} · ${apartmentFor(t.residentId)}`}
              onPress={() => router.push(`/(employee)/complaint/${t.ticketId}`)}
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
    chipRow: {
      flexDirection: 'row',
      gap: 8,
    },
    list: {
      gap: Spacing.sm,
    },
  });
