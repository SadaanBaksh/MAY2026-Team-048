import { ReactNode, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SidebarNav, type SidebarNavItem } from '@/components/shared/SidebarNav';
import { Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';

export function RoleShell({
  title,
  items,
  children,
}: {
  title: string;
  items: SidebarNavItem[];
  children: ReactNode;
}) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const user = useAuthStore((s) => s.currentUser);

  return (
    <View style={styles.shell}>
      <SidebarNav title="Simplifix" items={items} />
      <View style={styles.content}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.workspace}>Workspace</Text>
            <Text style={styles.pageTitle}>{title}</Text>
          </View>
          {user && <Text style={styles.userName}>{user.name}</Text>}
        </View>
        <View style={styles.body}>{children}</View>
      </View>
    </View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    shell: { flex: 1, flexDirection: 'row', backgroundColor: Colors.surfaceMuted },
    content: { flex: 1, minWidth: 0 },
    topBar: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.xl,
      backgroundColor: Colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    workspace: { ...Type.tiny, color: Colors.inkTertiary, textTransform: 'uppercase', letterSpacing: 1 },
    pageTitle: { ...Type.subtitle, color: Colors.ink, marginTop: 2 },
    userName: { ...Type.bodyMedium, color: Colors.inkSecondary },
    body: { flex: 1, minWidth: 0 },
  });
