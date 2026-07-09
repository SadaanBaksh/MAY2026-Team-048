import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/authStore';

export default function ResidentLayout() {
  const user = useAuthStore((s) => s.currentUser);
  if (!user || user.role !== 'resident') return <Redirect href="/(auth)/welcome" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="complaint/[id]" />
      <Stack.Screen
        name="new-complaint"
        options={{ presentation: 'card', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}
