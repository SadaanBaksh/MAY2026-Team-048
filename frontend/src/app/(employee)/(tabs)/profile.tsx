import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { ProfileHeader } from '@/components/shared/ProfileHeader';
import { Colors, Type } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import type { FacilityEmployee } from '@/types';

export default function EmployeeProfileScreen() {
  const user = useAuthStore((s) => s.currentUser) as FacilityEmployee;
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/welcome');
  };

  return (
    <Screen edges={['top']}>
      <Text style={styles.title}>Profile</Text>
      <ProfileHeader user={user} meta={user.title} />
      <Button label="Log Out" variant="outline" onPress={handleLogout} fullWidth icon="log-out-outline" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...Type.title,
    color: Colors.ink,
  },
});
