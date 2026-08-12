import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { DarkModeToggle } from '@/components/shared/DarkModeToggle';
import { ProfileHeader } from '@/components/shared/ProfileHeader';
import { Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useTicketStore } from '@/store/ticketStore';
import type { Resident } from '@/types';

export default function ResidentProfileScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const user = useAuthStore((s) => s.currentUser) as Resident;
  const logout = useAuthStore((s) => s.logout);
  const tickets = useTicketStore((s) => s.tickets).filter((t) => t.residentId === user.userId);

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/customer-login');
  };

  return (
    <Screen edges={['top']} maxWidth={480}>
      <Text style={styles.title}>Profile</Text>
      <ProfileHeader
        user={user}
        meta={user.unitNumber && user.building ? `${user.unitNumber}, ${user.building}` : undefined}
      />

      <Card style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{tickets.length}</Text>
          <Text style={styles.statLabel}>Total Complaints</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {tickets.filter((t) => t.status === 'Closed').length}
          </Text>
          <Text style={styles.statLabel}>Resolved</Text>
        </View>
      </Card>

      <DarkModeToggle />

      <Button
        label="Change Password"
        variant="outline"
        onPress={() => router.push('/(auth)/change-password')}
        fullWidth
        icon="key-outline"
      />

      <Button
        label="Log Out"
        variant="outline"
        onPress={handleLogout}
        fullWidth
        icon="log-out-outline"
        textColor={Colors.danger}
      />
    </Screen>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    title: {
      ...Type.title,
      color: Colors.ink,
    },
    statsCard: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
    },
    statDivider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      backgroundColor: Colors.border,
    },
    statValue: {
      ...Type.title,
      color: Colors.ink,
    },
    statLabel: {
      ...Type.caption,
      color: Colors.inkSecondary,
    },
  });
