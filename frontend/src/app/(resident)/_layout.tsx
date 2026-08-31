import { Redirect, Slot, Stack } from 'expo-router';
import { View } from 'react-native';

import { SidebarNav, type SidebarNavItem } from '@/components/shared/SidebarNav';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';

const NAV_ITEMS: SidebarNavItem[] = [
  { href: '/(resident)/(tabs)', label: 'Home', icon: 'home', match: (p) => p === '/' },
  { href: '/(resident)/(tabs)/complaints', label: 'Complaints', icon: 'document-text', match: (p) => p === '/complaints' || p.startsWith('/complaint/') },
  {
    href: '/(resident)/(tabs)/public',
    label: 'Community',
    icon: 'people-circle',
    match: (p) => p === '/public' || p.startsWith('/public/') || p.startsWith('/notice/'),
  },
  { href: '/(resident)/(tabs)/profile', label: 'Profile', icon: 'person-circle', match: (p) => p === '/profile' },
];

export default function ResidentLayout() {
  const user = useAuthStore((s) => s.currentUser);
  const { Colors } = useTheme();
  const isDesktop = useIsDesktop();

  if (!user || user.role !== 'resident') return <Redirect href="/(auth)/customer-login" />;
  if (user.accountStatus !== 'active') return <Redirect href="/(auth)/pending-approval" />;

  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: Colors.surfaceMuted }}>
        <SidebarNav title="Simplifix" items={NAV_ITEMS} />
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
      <Stack.Screen name="public/[id]" />
      <Stack.Screen name="notice/[id]" />
      <Stack.Screen
        name="public/new"
        options={{ presentation: 'card', animation: 'slide_from_bottom' }}
      />
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
