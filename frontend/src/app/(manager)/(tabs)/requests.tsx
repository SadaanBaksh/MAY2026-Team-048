import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { SearchBar } from '@/components/ui/SearchBar';
import { Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { timeAgo } from '@/utils/date';
import type { FacilityEmployee, MaintenanceStaff } from '@/types';

type PendingUser = FacilityEmployee | MaintenanceStaff;

const ROLE_LABELS: Record<PendingUser['role'], string> = {
  facility_employee: 'Facility Employee',
  maintenance_staff: 'Maintenance Staff',
};

function roleMeta(user: PendingUser): string {
  return user.role === 'facility_employee' ? user.title : user.specialization;
}

export default function ManagerRequestsScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const users = useAuthStore((s) => s.users);
  const refreshUsers = useAuthStore((s) => s.refreshUsers);
  const approveUser = useAuthStore((s) => s.approveUser);
  const rejectUser = useAuthStore((s) => s.rejectUser);
  const [query, setQuery] = useState('');

  useEffect(() => {
    refreshUsers();
  }, [refreshUsers]);

  const pending = useMemo(() => {
    const list = users.filter(
      (u): u is PendingUser =>
        (u.role === 'facility_employee' || u.role === 'maintenance_staff') &&
        u.accountStatus === 'pending',
    );
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q) ||
        ROLE_LABELS[u.role].toLowerCase().includes(q) ||
        roleMeta(u).toLowerCase().includes(q),
    );
  }, [users, query]);

  return (
    <Screen edges={['top']}>
      <Text style={styles.title}>Requests</Text>
      <Text style={styles.subtitle}>
        Approve or decline employee and staff registration requests.
      </Text>

      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search requests by name, role, title, specialization..."
      />

      {pending.length === 0 ? (
        <EmptyState
          icon={query.trim() ? 'search-outline' : 'checkmark-done-outline'}
          title={query.trim() ? 'No matching requests' : 'No pending requests'}
          message={
            query.trim()
              ? `No registration requests matched "${query}".`
              : 'New employee and staff sign-ups will show up here.'
          }
        />
      ) : (
        pending.map((user) => (
          <Card key={user.userId} style={styles.card}>
            <View style={styles.row}>
              <Avatar name={user.name} color={user.avatarColor} size={44} />
              <View style={styles.info}>
                <Text style={styles.name}>{user.name}</Text>
                <Text style={styles.meta}>
                  {ROLE_LABELS[user.role]} · {roleMeta(user)}
                </Text>
                <Text style={styles.contact}>{user.email}</Text>
                <Text style={styles.contact}>{user.phone}</Text>
              </View>
            </View>
            <Text style={styles.requested}>Requested {timeAgo(user.createdAt)}</Text>
            <View style={styles.actions}>
              <Button
                label="Decline"
                variant="outline"
                size="sm"
                onPress={() => rejectUser(user.userId)}
                style={styles.actionButton}
              />
              <Button
                label="Approve"
                size="sm"
                onPress={() => approveUser(user.userId)}
                style={styles.actionButton}
              />
            </View>
          </Card>
        ))
      )}
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
      ...Type.body,
      color: Colors.inkSecondary,
      marginTop: -Spacing.xs,
    },
    card: {
      gap: Spacing.sm,
    },
    row: {
      flexDirection: 'row',
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
    meta: {
      ...Type.caption,
      color: Colors.primary,
    },
    contact: {
      ...Type.caption,
      color: Colors.inkSecondary,
    },
    requested: {
      ...Type.tiny,
      color: Colors.inkTertiary,
    },
    actions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    actionButton: {
      flex: 1,
    },
  });
