import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { EditProfileModal } from '@/components/shared/EditProfileModal';
import { Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
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
  const updateCurrentUser = useAuthStore((s) => s.updateCurrentUser);
  const [editing, setEditing] = useState(false);

  return (
    <Card style={styles.card}>
      <Pressable
        style={styles.editButton}
        onPress={() => setEditing(true)}
        hitSlop={10}
        accessibilityLabel="Edit profile"
      >
        <Ionicons name="pencil-outline" size={18} color={Colors.inkSecondary} />
      </Pressable>

      <Avatar name={user.name} color={user.avatarColor} uri={user.avatarUri} size={64} />
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

      <EditProfileModal
        visible={editing}
        onClose={() => setEditing(false)}
        user={user}
        onSave={updateCurrentUser}
      />
    </Card>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      alignItems: 'center',
      gap: 6,
      paddingVertical: Spacing.xl,
      position: 'relative',
    },
    editButton: {
      position: 'absolute',
      top: Spacing.md,
      right: Spacing.md,
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.surfaceMuted,
      zIndex: 1,
    },
    name: {
      ...Type.title,
      color: Colors.ink,
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
