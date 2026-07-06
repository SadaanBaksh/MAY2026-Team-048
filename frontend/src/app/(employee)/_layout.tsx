import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/authStore';

export default function EmployeeLayout() {
  const user = useAuthStore((s) => s.currentUser);
  if (!user || user.role !== 'facility_employee') return <Redirect href="/(auth)/welcome" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="complaint/[id]" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}
