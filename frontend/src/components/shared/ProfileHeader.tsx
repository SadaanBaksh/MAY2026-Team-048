import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import type { AppUser } from '@/types';

const ROLE_LABELS: Record<AppUser['role'], string> = {
  resident: 'Resident',
  facility_employee: 'Facility Employee',
  maintenance_staff: 'Maintenance Staff',
  facility_manager: 'Facility Manager',
};

export function ProfileHeader({ user, meta }: { user: AppUser; meta?: string }) {
  const { Colors, RoleColors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const roleColor = RoleColors[user.role];

  return (
    <Card style={styles.card}>
      <Avatar name={user.name} color={user.avatarColor} size={64} />
      <Text style={styles.name}>{user.name}</Text>
      <View style={[styles.roleBadge, { backgroundColor: roleColor.soft }]}>
        <Text style={[styles.roleText, { color: roleColor.text }]}>{ROLE_LABELS[user.role]}</Text>
      </View>
      {meta && <Text style={styles.meta}>{meta}</Text>}

      <View style={styles.contactBlock}>
        <View style={styles.contactRow}>
          <Text style={styles.contactLabel}>Email</Text>
          <Text style={styles.contactValue}>{user.email}</Text>
        </View>
        <View style={styles.contactRow}>
          <Text style={styles.contactLabel}>Phone</Text>
          <Text style={styles.contactValue}>{user.phone}</Text>
        </View>
      </View>
    </Card>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      alignItems: 'center',
      gap: 6,
      paddingVertical: Spacing.xl,
    },
    name: {
      ...Type.title,
      marginTop: Spacing.xs,
    },
    roleBadge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: 999,
    },
    roleText: {
      ...Type.tiny,
    },
    meta: {
      ...Type.caption,
      color: Colors.inkSecondary,
    },
    contactBlock: {
      alignSelf: 'stretch',
      marginTop: Spacing.md,
      gap: Spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
      paddingTop: Spacing.md,
    },
    contactRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    contactLabel: {
      ...Type.caption,
      color: Colors.inkTertiary,
    },
    contactValue: {
      ...Type.captionBold,
      color: Colors.ink,
    },
  });
