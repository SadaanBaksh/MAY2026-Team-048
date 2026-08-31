import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { SimplifixLogo } from '@/components/ui/SimplifixLogo';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';

/**
 * Full-screen message shown when a desktop-only workspace (e.g. the facility
 * manager dashboard) is opened on a phone-sized viewport. Keeps the small
 * screen clean instead of cramming the sidebar layout into it, and gives a
 * signed-in user a way back out (log out → landing / login).
 */
export function DesktopOnlyNotice({
  title = 'Best viewed on desktop',
  message = 'The manager dashboard needs a wider screen. Please sign in from a desktop or laptop to continue.',
}: {
  title?: string;
  message?: string;
}) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/landing');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="desktop-outline" size={30} color={Colors.inkTertiary} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        {currentUser && (
          <View style={styles.action}>
            <Button
              label="Log Out"
              variant="outline"
              icon="log-out-outline"
              onPress={handleLogout}
              textColor={Colors.danger}
            />
          </View>
        )}
      </View>
      <View style={styles.brandRow}>
        <SimplifixLogo width={20} height={20} />
        <Text style={styles.brand}>Simplifix</Text>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: Colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xl,
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      maxWidth: 360,
    },
    iconWrap: {
      width: 64,
      height: 64,
      borderRadius: Radius.pill,
      backgroundColor: Colors.surfaceSunken,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.xs,
    },
    title: {
      ...Type.subtitle,
      color: Colors.ink,
      textAlign: 'center',
    },
    message: {
      ...Type.body,
      color: Colors.inkSecondary,
      textAlign: 'center',
    },
    action: {
      marginTop: Spacing.md,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingBottom: Spacing.md,
    },
    brand: { ...Type.caption, color: Colors.inkTertiary },
  });
