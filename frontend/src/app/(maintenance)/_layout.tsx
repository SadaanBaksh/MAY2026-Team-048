import { Redirect, Stack } from 'expo-router';

import { RoleShell } from '@/components/shared/RoleShell';
import { type SidebarNavItem } from '@/components/shared/SidebarNav';
import { useAuthStore } from '@/store/authStore';

const NAV_ITEMS: SidebarNavItem[] = [
  { href: '/(maintenance)/(tabs)', label: 'My Jobs', icon: 'briefcase', match: (p) => p === '/' },
  { href: '/(maintenance)/(tabs)/profile', label: 'Profile', icon: 'person-circle', match: (p) => p === '/profile' },
];

export default function MaintenanceLayout() {
  const user = useAuthStore((s) => s.currentUser);
  if (!user || user.role !== 'maintenance_staff') return <Redirect href="/(auth)/employee-login" />;
  if (user.accountStatus !== 'active') return <Redirect href="/(auth)/pending-approval" />;

  return <RoleShell title="Maintenance dashboard" items={NAV_ITEMS}>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="job/[id]" />
      <Stack.Screen name="notifications" />
    </Stack>
  </RoleShell>;
}
