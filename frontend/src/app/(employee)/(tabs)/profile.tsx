import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { DarkModeToggle } from '@/components/shared/DarkModeToggle';
import { ProfileHeader } from '@/components/shared/ProfileHeader';
import { Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import type { FacilityEmployee } from '@/types';

export default function EmployeeProfileScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const user = useAuthStore((s) => s.currentUser) as FacilityEmployee;
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/welcome');
  };

  return (
    <Screen edges={['top']} maxWidth={480}>
      <Text style={styles.title}>Profile</Text>
      <ProfileHeader user={user} meta={user.title} />
      <DarkModeToggle />
      <Button
        label="Log Out"
        variant="outline"
        onPress={handleLogout}
        fullWidth
        icon="log-out-outline"
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
  });
