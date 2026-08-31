import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/authStore';

export default function AdminLayout() {
  const user = useAuthStore((s) => s.currentUser);
  if (!user || user.role !== 'admin') return <Redirect href="/(auth)/landing" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
