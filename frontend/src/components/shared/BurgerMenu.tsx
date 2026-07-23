import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Divider } from '@/components/ui/Divider';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import type { UserRole } from '@/types';

const PANEL_WIDTH = 280;

const ROLE_PROFILE: Record<UserRole, string> = {
  resident: '/(resident)/(tabs)/profile',
  facility_employee: '/(employee)/(tabs)/profile',
  maintenance_staff: '/(maintenance)/(tabs)/profile',
  facility_manager: '/(manager)/(tabs)/profile',
};

export function BurgerMenu() {
  const { Colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const isDesktop = useIsDesktop();
  const [visible, setVisible] = useState(false);
  const translateX = useRef(new Animated.Value(-PANEL_WIDTH)).current;

  const user = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (visible) {
      Animated.timing(translateX, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible, translateX]);

  // Desktop layouts (Employee/Manager) already show a persistent SidebarNav
  // with the same profile/logout access, so the burger would be redundant.
  if (!user || isDesktop) return null;

  const openMenu = () => setVisible(true);

  const closeMenu = () => {
    Animated.timing(translateX, {
      toValue: -PANEL_WIDTH,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
    });
  };

  const goTo = (href: string) => {
    closeMenu();
    router.push(href as never);
  };

  const handleLogout = () => {
    const role = user?.role;
    closeMenu();
    logout();
    if (role === 'resident') {
      router.replace('/(auth)/customer-login');
    } else if (role === 'maintenance_staff') {
      router.replace('/(auth)/employee-login');
    } else {
      router.replace('/(auth)/landing');
    }
  };

  return (
    <>
      <Pressable onPress={openMenu} hitSlop={10} style={styles.trigger} accessibilityLabel="Menu">
        <Ionicons name="menu-outline" size={24} color={Colors.ink} />
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={closeMenu}>
        <Pressable style={styles.backdrop} onPress={closeMenu}>
          <Animated.View style={[styles.panel, { transform: [{ translateX }] }]}>
            <Pressable style={styles.panelInner} onPress={() => {}}>
              <View style={styles.profileRow}>
                <Avatar name={user.name} color={user.avatarColor} size={48} />
                <View style={styles.profileText}>
                  <Text style={styles.name} numberOfLines={1}>
                    {user.name}
                  </Text>
                  <Text style={styles.email} numberOfLines={1}>
                    {user.email}
                  </Text>
                </View>
              </View>

              <Divider />

              <View style={styles.items}>
                <MenuItem
                  icon="person-outline"
                  label="Profile"
                  onPress={() => goTo(ROLE_PROFILE[user.role])}
                />
                <View style={styles.item}>
                  <Ionicons
                    name={isDark ? 'moon' : 'moon-outline'}
                    size={20}
                    color={Colors.inkSecondary}
                  />
                  <Text style={[styles.itemLabel, styles.itemLabelGrow]}>Dark Mode</Text>
                  <Switch
                    value={isDark}
                    onValueChange={toggleTheme}
                    trackColor={{
                      false: Colors.borderStrong,
                      true: isDark ? Colors.teal : Colors.primary,
                    }}
                    thumbColor={Colors.white}
                    ios_backgroundColor={Colors.borderStrong}
                  />
                </View>
              </View>

              <View style={styles.footer}>
                <Divider />
                <MenuItem icon="log-out-outline" label="Log Out" onPress={handleLogout} danger />
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  return (
    <Pressable style={styles.item} onPress={onPress}>
      <Ionicons name={icon} size={20} color={danger ? Colors.danger : Colors.inkSecondary} />
      <Text style={[styles.itemLabel, danger && { color: Colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    trigger: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backdrop: {
      flex: 1,
      backgroundColor: Colors.surfaceOverlay,
    },
    panel: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: PANEL_WIDTH,
    },
    panelInner: {
      flex: 1,
      backgroundColor: Colors.surface,
      paddingTop: 64,
      paddingHorizontal: Spacing.md,
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingBottom: Spacing.md,
    },
    profileText: {
      flex: 1,
    },
    name: {
      ...Type.bodyMedium,
      color: Colors.ink,
    },
    email: {
      ...Type.caption,
      color: Colors.inkSecondary,
    },
    items: {
      paddingTop: Spacing.xs,
      flex: 1,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.sm,
    },
    itemLabel: {
      ...Type.body,
      color: Colors.ink,
    },
    itemLabelGrow: {
      flex: 1,
    },
    footer: {
      paddingBottom: Spacing.lg,
    },
  });
