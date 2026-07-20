import { Redirect, Slot, Stack } from 'expo-router';
import { View } from 'react-native';

import { SidebarNav, type SidebarNavItem } from '@/components/shared/SidebarNav';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';

const DESKTOP_NAV_ITEMS: SidebarNavItem[] = [
  { href: '/(employee)/(tabs)', label: 'Dashboard', icon: 'grid', match: (p) => p === '/' },
  {
    href: '/(employee)/(tabs)/complaints',
    label: 'Complaints',
    icon: 'document-text',
    match: (p) => p === '/complaints' || p.startsWith('/complaint/'),
  },
  {
    href: '/(employee)/(tabs)/workers',
    label: 'Workers',
    icon: 'people',
    match: (p) => p === '/workers',
  },
  {
    href: '/(employee)/(tabs)/profile',
    label: 'Profile',
    icon: 'person-circle',
    match: (p) => p === '/profile',
  },
];

export default function EmployeeLayout() {
  const user = useAuthStore((s) => s.currentUser);
  const { Colors } = useTheme();
  const isDesktop = useIsDesktop();

  if (!user || user.role !== 'facility_employee') return <Redirect href="/(auth)/welcome" />;
  if (user.accountStatus !== 'active') return <Redirect href="/(auth)/pending-approval" />;

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
      <Stack.Screen name="notifications" />
    </Stack>
  );
}
