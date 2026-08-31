import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { SimplifixLogo } from '@/components/ui/SimplifixLogo';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import type { UserRole } from '@/types';

export interface SidebarNavItem {
  href: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  match: (pathname: string) => boolean;
}

export interface SidebarNavProps {
  title: string;
  items: SidebarNavItem[];
}

const SIDEBAR_WIDTH = 248;
const PROFILE_ROUTES: Record<UserRole, string> = {
  resident: '/(resident)/(tabs)/profile',
  facility_employee: '/(employee)/(tabs)/profile',
  maintenance_staff: '/(maintenance)/(tabs)/profile',
  facility_manager: '/(manager)/(tabs)/profile',
  admin: '/(admin)',
};

export function SidebarNav({ title, items }: SidebarNavProps) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const pathname = usePathname();
  const user = useAuthStore((s) => s.currentUser);

  return (
    <View style={styles.sidebar}>
      <View style={styles.brandBlock}>
        <View style={styles.brandRow}>
          <SimplifixLogo width={28} height={28} />
          <Text style={styles.brand}>{title}</Text>
        </View>
        <Text style={styles.brandSubtitle}>AI-powered maintenance.</Text>
      </View>
      <View style={styles.items}>
        {items.map((item) => {
          const active = item.match(pathname);
          return (
            <Pressable
              key={item.href}
              onPress={() => router.push(item.href as never)}
              style={[styles.item, active && styles.itemActive]}
              accessibilityRole="button"
            >
              <Ionicons
                name={item.icon}
                size={20}
                color={active ? Colors.primary : Colors.inkSecondary}
              />
              <Text style={[styles.itemLabel, active && styles.itemLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {user && (
        <View style={styles.accountArea}>
          <Pressable
            style={styles.account}
            onPress={() => router.push(PROFILE_ROUTES[user.role] as never)}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            <Avatar name={user.name} color={user.avatarColor} uri={user.avatarUri} size={36} />
            <View style={styles.accountText}>
              <Text style={styles.accountName} numberOfLines={1}>
                {user.name}
              </Text>
              <Text style={styles.accountEmail} numberOfLines={1}>
                {user.email}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.inkTertiary} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    sidebar: {
      width: SIDEBAR_WIDTH,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: Colors.border,
      backgroundColor: Colors.surface,
      paddingTop: Spacing.xl,
      paddingHorizontal: Spacing.sm,
      paddingBottom: Spacing.md,
    },
    brandBlock: { paddingHorizontal: Spacing.sm, marginBottom: Spacing.xl },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    brand: { ...Type.title, color: Colors.ink },
    brandSubtitle: { ...Type.tiny, color: Colors.inkTertiary, marginTop: 2 },
    items: { gap: 2, flex: 1 },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.sm,
      borderRadius: Radius.sm,
    },
    itemActive: { backgroundColor: Colors.primarySoft },
    itemLabel: { ...Type.bodyMedium, color: Colors.inkSecondary },
    itemLabelActive: { color: Colors.primary },
    accountArea: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
      paddingTop: Spacing.md,
      gap: Spacing.sm,
    },
    account: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.xs,
    },
    accountText: { flex: 1, minWidth: 0 },
    accountName: { ...Type.captionBold, color: Colors.ink },
    accountEmail: { ...Type.tiny, color: Colors.inkTertiary },
  });
