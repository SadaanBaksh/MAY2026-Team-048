import { Redirect, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { DesktopOnlyNotice } from '@/components/shared/DesktopOnlyNotice';
import { RoleShell } from '@/components/shared/RoleShell';
import { type SidebarNavItem } from '@/components/shared/SidebarNav';
import { useIsDesktop } from '@/hooks/useIsDesktop';
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
    href: '/(manager)/(tabs)/people',
    label: 'People',
    icon: 'people',
    match: (p) => p === '/people',
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
  if (user.accountStatus !== 'active') return <Redirect href="/(auth)/pending-approval" />;

  const stack = (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="insights" />
      <Stack.Screen name="complaint/[id]" />
      <Stack.Screen name="public/[id]" />
      <Stack.Screen name="notice/[id]" />
    </Stack>
  );

  // The manager workspace is a desktop-only, sidebar-driven layout. On a phone
  // it collapses into an unusable mess, so keep the navigator mounted (Expo
  // Router needs it) but cover it with a clean "open on desktop" notice.
  if (!isDesktop) {
    return (
      <View style={styles.mobileWrap}>
        {stack}
        <View style={StyleSheet.absoluteFill}>
          <DesktopOnlyNotice />
        </View>
      </View>
    );
  }

  return (
    <RoleShell title="Manager dashboard" items={DESKTOP_NAV_ITEMS}>
      {stack}
    </RoleShell>
  );
}

const styles = StyleSheet.create({
  mobileWrap: { flex: 1 },
});
