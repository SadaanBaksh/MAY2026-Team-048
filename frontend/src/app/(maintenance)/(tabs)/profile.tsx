import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RatingStars } from '@/components/ui/RatingStars';
import { Screen } from '@/components/ui/Screen';
import { DarkModeToggle } from '@/components/shared/DarkModeToggle';
import { ProfileHeader } from '@/components/shared/ProfileHeader';
import { Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useTicketStore } from '@/store/ticketStore';
import type { MaintenanceStaff } from '@/types';

export default function MaintenanceProfileScreen() {
  const { Colors } = useTheme();
  const user = useAuthStore((s) => s.currentUser) as MaintenanceStaff;
  const logout = useAuthStore((s) => s.logout);
  const tickets = useTicketStore((s) => s.tickets);

  const jobs = useMemo(
    () => tickets.filter((t) => t.workerId === user.userId),
    [tickets, user.userId],
  );
  const completed = jobs.filter((t) => t.status === 'Resolved' || t.status === 'Closed');
  const styles = useMemo(() => getStyles(Colors), [Colors]);

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/employee-login');
  };

  return (
    <Screen edges={['top']} maxWidth={480}>
      <Text style={styles.title}>Profile</Text>
      <ProfileHeader user={user} meta={user.specialization} />

      <Card style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{jobs.length}</Text>
          <Text style={styles.statLabel}>Total Jobs</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{completed.length}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <RatingStars value={Math.round(user.rating)} readOnly size={16} />
          <Text style={styles.statLabel}>{user.rating.toFixed(1)} rating</Text>
        </View>
      </Card>

      <DarkModeToggle />

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
