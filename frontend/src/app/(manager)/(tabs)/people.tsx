import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { SearchBar } from '@/components/ui/SearchBar';
import { Chip } from '@/components/ui/Chip';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import type { AppUser, UserRole } from '@/types';

type RoleFilter = 'all' | Exclude<UserRole, 'facility_manager' | 'admin'>;

const ROLE_FILTERS: { key: RoleFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'resident', label: 'Residents' },
  { key: 'facility_employee', label: 'Employees' },
  { key: 'maintenance_staff', label: 'Maintenance' },
];

const ROLE_LABELS: Record<Exclude<UserRole, 'facility_manager' | 'admin'>, string> = {
  resident: 'Resident',
  facility_employee: 'Facility Employee',
  maintenance_staff: 'Maintenance Staff',
};

function roleMeta(user: AppUser): string {
  if (user.role === 'resident') {
    return [user.unitNumber, user.building].filter(Boolean).join(', ') || 'Resident';
  }
  if (user.role === 'facility_employee') return user.title;
  if (user.role === 'maintenance_staff') return user.specialization;
  return '';
}

export default function ManagerPeopleScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const currentUser = useAuthStore((s) => s.currentUser);
  const users = useAuthStore((s) => s.users);
  const refreshUsers = useAuthStore((s) => s.refreshUsers);
  const suspendUser = useAuthStore((s) => s.suspendUser);
  const reactivateUser = useAuthStore((s) => s.reactivateUser);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    refreshUsers();
  }, [refreshUsers]);

  const people = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter(
        (u) =>
          u.role !== 'facility_manager' &&
          u.userId !== currentUser?.userId &&
          (u.accountStatus === 'active' || u.accountStatus === 'suspended'),
      )
      .filter((u) => roleFilter === 'all' || u.role === roleFilter)
      .filter((u) => {
        if (!q) return true;
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.phone.toLowerCase().includes(q) ||
          roleMeta(u).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, currentUser, roleFilter, query]);

  const runAction = async (user: AppUser, action: 'suspend' | 'reactivate') => {
    setBusyId(user.userId);
    try {
      if (action === 'suspend') await suspendUser(user.userId);
      else await reactivateUser(user.userId);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      if (Platform.OS === 'web') window.alert(message);
      else Alert.alert('Action failed', message);
    } finally {
      setBusyId(null);
    }
  };

  const confirmSuspend = (user: AppUser) => {
    const message = `${user.name} will be signed out and blocked from logging in until you reactivate the account. They will be told to contact you.`;
    if (Platform.OS === 'web') {
      if (window.confirm(`Suspend ${user.name}?\n\n${message}`)) runAction(user, 'suspend');
      return;
    }
    Alert.alert(`Suspend ${user.name}?`, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Suspend', style: 'destructive', onPress: () => runAction(user, 'suspend') },
    ]);
  };

  return (
    <Screen edges={['top']}>
      <Text style={styles.title}>People</Text>
      <Text style={styles.subtitle}>
        Suspend or reactivate resident, employee, and maintenance staff accounts.
      </Text>

      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search people by name, email, phone..."
      />

      <View style={styles.filterRow}>
        {ROLE_FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            active={roleFilter === f.key}
            onPress={() => setRoleFilter(f.key)}
          />
        ))}
      </View>

      {people.length === 0 ? (
        <EmptyState
          icon={query.trim() ? 'search-outline' : 'people-outline'}
          title={query.trim() ? 'No matching people' : 'No accounts yet'}
          message={
            query.trim()
              ? `No accounts matched "${query}".`
              : 'Active residents, employees, and maintenance staff will appear here.'
          }
        />
      ) : (
        people.map((user) => {
          const suspended = user.accountStatus === 'suspended';
          const busy = busyId === user.userId;
          return (
            <Card key={user.userId} style={styles.card}>
              <View style={styles.row}>
                <Avatar name={user.name} color={user.avatarColor} uri={user.avatarUri} size={44} />
                <View style={styles.info}>
                  <Text style={styles.name}>{user.name}</Text>
                  <Text style={styles.meta}>
                    {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]} · {roleMeta(user)}
                  </Text>
                  <Text style={styles.contact}>{user.email}</Text>
                  <Text style={styles.contact}>{user.phone}</Text>
                </View>
                <View style={[styles.statusPill, suspended ? styles.statusSuspended : styles.statusActive]}>
                  <Text
                    style={[
                      styles.statusText,
                      { color: suspended ? Colors.danger : Colors.success },
                    ]}
                  >
                    {suspended ? 'Suspended' : 'Active'}
                  </Text>
                </View>
              </View>
              <View style={styles.actions}>
                {suspended ? (
                  <Button
                    label={busy ? 'Reactivating…' : 'Reactivate'}
                    size="sm"
                    icon="refresh-outline"
                    disabled={busy}
                    onPress={() => runAction(user, 'reactivate')}
                    style={styles.actionButton}
                  />
                ) : (
                  <Button
                    label={busy ? 'Suspending…' : 'Suspend'}
                    variant="outline"
                    size="sm"
                    icon="ban-outline"
                    textColor={Colors.danger}
                    disabled={busy}
                    onPress={() => confirmSuspend(user)}
                    style={styles.actionButton}
                  />
                )}
              </View>
            </Card>
          );
        })
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
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
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
    statusPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: Spacing.xs,
      paddingVertical: 2,
      borderRadius: Radius.pill,
    },
    statusActive: {
      backgroundColor: Colors.successSoft,
    },
    statusSuspended: {
      backgroundColor: Colors.dangerSoft,
    },
    statusText: {
      ...Type.tiny,
    },
    actions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    actionButton: {
      flex: 1,
    },
  });
