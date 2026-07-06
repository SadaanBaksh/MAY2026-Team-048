import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/authStore';

export default function ManagerLayout() {
  const user = useAuthStore((s) => s.currentUser);
  if (!user || user.role !== 'facility_manager') return <Redirect href="/(auth)/welcome" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="complaint/[id]" />
    </Stack>
  );
}
