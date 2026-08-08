import { Redirect, Slot, Stack } from 'expo-router';
import { type SidebarNavItem } from '@/components/shared/SidebarNav';
import { RoleShell } from '@/components/shared/RoleShell';
import { useIsDesktop } from '@/hooks/useIsDesktop';

import { useAuthStore } from '@/store/authStore';

const NAV_ITEMS: SidebarNavItem[] = [
  { href: '/(resident)/(tabs)', label: 'Home', icon: 'home', match: (p) => p === '/' },
  { href: '/(resident)/(tabs)/complaints', label: 'Complaints', icon: 'document-text', match: (p) => p === '/complaints' || p.startsWith('/complaint/') },
  { href: '/(resident)/(tabs)/profile', label: 'Profile', icon: 'person-circle', match: (p) => p === '/profile' },
];

export default function ResidentLayout() {
  const user = useAuthStore((s) => s.currentUser);
  const isDesktop = useIsDesktop();
  if (!user || user.role !== 'resident') return <Redirect href="/(auth)/customer-login" />;

  if (isDesktop) return <RoleShell title="Resident dashboard" items={NAV_ITEMS}><Slot /></RoleShell>;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="complaint/[id]" />
      <Stack.Screen
        name="new-complaint"
        options={{ presentation: 'card', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="emergency"
        options={{ presentation: 'card', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}
