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

  const isRejected = currentUser?.accountStatus === 'rejected';

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.wrapper}>
      <View style={styles.content}>
        <View style={[styles.iconWrap, isRejected && styles.iconWrapDanger]}>
          <Ionicons
            name={isRejected ? 'close-circle-outline' : 'time-outline'}
            size={36}
            color={isRejected ? Colors.danger : Colors.primary}
          />
        </View>
        <Text style={styles.title}>{isRejected ? 'Request declined' : 'Awaiting approval'}</Text>
        <Text style={styles.message}>
          {isRejected
            ? 'Your facility manager declined this registration request. Contact your facility manager if you think this is a mistake.'
            : 'Your registration has been sent to your facility manager for approval. You will be able to log in once your account is approved.'}
        </Text>
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
    },
  });
