import { Redirect, Slot, Stack } from 'expo-router';
import { View } from 'react-native';

import { SidebarNav, type SidebarNavItem } from '@/components/shared/SidebarNav';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';

const DESKTOP_NAV_ITEMS: SidebarNavItem[] = [
  { href: '/(manager)/(tabs)', label: 'Analytics', icon: 'stats-chart', match: (p) => p === '/' },
  { href: '/(manager)/(tabs)/requests', label: 'Requests', icon: 'person-add', match: (p) => p === '/requests' },
  { href: '/(manager)/(tabs)/performance', label: 'Performance', icon: 'ribbon', match: (p) => p === '/performance' },
  {
    href: '/(manager)/(tabs)/history',
    label: 'History',
    icon: 'time',
    match: (p) => p === '/history' || p.startsWith('/complaint/'),
  },
  { href: '/(manager)/(tabs)/profile', label: 'Profile', icon: 'person-circle', match: (p) => p === '/profile' },
];

export default function ManagerLayout() {
  const user = useAuthStore((s) => s.currentUser);
  const { Colors } = useTheme();
  const isDesktop = useIsDesktop();

  if (!user || user.role !== 'facility_manager') return <Redirect href="/(auth)/welcome" />;

  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: Colors.surfaceMuted }}>
        <SidebarNav title="Simplifix" items={DESKTOP_NAV_ITEMS} />
        <View style={{ flex: 1 }}>
          <Slot />
        </View>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="complaint/[id]" />
    </Stack>
  );
}
