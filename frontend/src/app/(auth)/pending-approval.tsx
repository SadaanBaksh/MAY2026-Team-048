import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';

export default function PendingApprovalScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);

  const status = currentUser?.accountStatus;
  const view =
    status === 'suspended'
      ? {
          icon: 'ban-outline' as const,
          danger: true,
          title: 'Account suspended',
          message:
            'Your account has been suspended by your facility manager. Please contact them to restore access.',
        }
      : status === 'rejected'
        ? {
            icon: 'close-circle-outline' as const,
            danger: true,
            title: 'Request declined',
            message:
              'Your facility manager declined this registration request. Contact your facility manager if you think this is a mistake.',
          }
        : {
            icon: 'time-outline' as const,
            danger: false,
            title: 'Awaiting approval',
            message:
              'Your registration has been sent to your facility manager for approval. You will be able to log in once your account is approved.',
          };

  const handleLogout = () => {
    const role = currentUser?.role;
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
    <SafeAreaView style={styles.wrapper}>
      <View style={styles.content}>
        <View style={[styles.iconWrap, view.danger && styles.iconWrapDanger]}>
          <Ionicons
            name={view.icon}
            size={36}
            color={view.danger ? Colors.danger : Colors.primary}
          />
        </View>
        <Text style={styles.title}>{view.title}</Text>
        <Text style={styles.message}>{view.message}</Text>
        <Button label="Log Out" variant="outline" onPress={handleLogout} style={styles.button} />
      </View>
    </SafeAreaView>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      flex: 1,
      backgroundColor: Colors.surfaceMuted,
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
      gap: Spacing.sm,
    },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: Colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.xs,
    },
    iconWrapDanger: {
      backgroundColor: Colors.dangerSoft,
    },
    title: {
      ...Type.title,
      color: Colors.ink,
      textAlign: 'center',
    },
    message: {
      ...Type.body,
      color: Colors.inkSecondary,
      textAlign: 'center',
    },
    button: {
      marginTop: Spacing.lg,
      // Button defaults to alignSelf:'flex-start' unless fullWidth; override so it
      // sits centered under the centered icon/title/message stack.
      alignSelf: 'center',
    },
  });
