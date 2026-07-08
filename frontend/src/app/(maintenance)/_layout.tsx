import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/authStore';

export default function MaintenanceLayout() {
  const user = useAuthStore((s) => s.currentUser);
  if (!user || user.role !== 'maintenance_staff') return <Redirect href="/(auth)/welcome" />;
  if (user.accountStatus !== 'active') return <Redirect href="/(auth)/pending-approval" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="job/[id]" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}
