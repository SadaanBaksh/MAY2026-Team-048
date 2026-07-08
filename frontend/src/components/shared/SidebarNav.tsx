import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';

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

const SIDEBAR_WIDTH = 240;

export function SidebarNav({ title, items }: SidebarNavProps) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const pathname = usePathname();

  return (
    <View style={styles.sidebar}>
      <Text style={styles.brand}>{title}</Text>
      <View style={styles.items}>
        {items.map((item) => {
          const active = item.match(pathname);
          return (
            <Pressable
              key={item.href}
              onPress={() => router.push(item.href as never)}
              style={[styles.item, active && styles.itemActive]}>
              <Ionicons name={item.icon} size={20} color={active ? Colors.primary : Colors.inkSecondary} />
              <Text style={[styles.itemLabel, active && styles.itemLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
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
    },
    brand: {
      ...Type.title,
      color: Colors.ink,
      paddingHorizontal: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    items: {
      gap: 2,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.sm,
      borderRadius: Radius.sm,
    },
    itemActive: {
      backgroundColor: Colors.primarySoft,
    },
    itemLabel: {
      ...Type.bodyMedium,
      color: Colors.inkSecondary,
    },
    itemLabelActive: {
      color: Colors.primary,
    },
  });
