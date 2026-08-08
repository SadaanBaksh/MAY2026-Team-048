import { Redirect, Slot, Stack } from 'expo-router';
import { RoleShell } from '@/components/shared/RoleShell';
import { type SidebarNavItem } from '@/components/shared/SidebarNav';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useAuthStore } from '@/store/authStore';

const DESKTOP_NAV_ITEMS: SidebarNavItem[] = [
  { href: '/(manager)/(tabs)', label: 'Analytics', icon: 'stats-chart', match: (p) => p === '/' },
  {
    href: '/(manager)/(tabs)/requests',
    label: 'Requests',
    icon: 'person-add',
    match: (p) => p === '/requests',
  },
  {
    href: '/(manager)/(tabs)/performance',
    label: 'Performance',
    icon: 'ribbon',
    match: (p) => p === '/performance',
  },
  {
    href: '/(manager)/(tabs)/history',
    label: 'History',
    icon: 'time',
    match: (p) => p === '/history' || p.startsWith('/complaint/'),
  },
  {
    href: '/(manager)/(tabs)/profile',
    label: 'Profile',
    icon: 'person-circle',
    match: (p) => p === '/profile',
  },
];

export default function ManagerLayout() {
  const user = useAuthStore((s) => s.currentUser);
  const isDesktop = useIsDesktop();

  if (!user || user.role !== 'facility_manager') return <Redirect href="/(auth)/landing" />;

  if (isDesktop) {
    return (
      <RoleShell title="Manager dashboard" items={DESKTOP_NAV_ITEMS}>
        <Slot />
      </RoleShell>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="complaint/[id]" />
    </Stack>
  );
}
