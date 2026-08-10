import { Redirect, Stack } from 'expo-router';
import { RoleShell } from '@/components/shared/RoleShell';
import { type SidebarNavItem } from '@/components/shared/SidebarNav';
import { useAuthStore } from '@/store/authStore';

const DESKTOP_NAV_ITEMS: SidebarNavItem[] = [
  {
    href: '/(manager)/(tabs)/notices',
    label: 'Notices',
    icon: 'megaphone',
    match: (p) => p === '/notices' || p.startsWith('/notice/'),
  },
  {
    href: '/(manager)/(tabs)',
    label: 'Analytics',
    icon: 'stats-chart',
    match: (p) => p === '/' || p === '/insights',
  },
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
  if (!user || user.role !== 'facility_manager') return <Redirect href="/(auth)/landing" />;

  return <RoleShell title="Manager dashboard" items={DESKTOP_NAV_ITEMS}>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="insights" />
      <Stack.Screen name="complaint/[id]" />
      <Stack.Screen name="public/[id]" />
      <Stack.Screen name="notice/[id]" />
    </Stack>
  </RoleShell>;
}
