import { Redirect, Stack } from 'expo-router';
import { View } from 'react-native';
import { RoleShell } from '@/components/shared/RoleShell';
import { type SidebarNavItem } from '@/components/shared/SidebarNav';
import { EmergencyAlertBar } from '@/components/shared/EmergencyAlertBar';
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
  if (!user || user.role !== 'facility_employee') return <Redirect href="/(auth)/landing" />;
  if (user.accountStatus !== 'active') return <Redirect href="/(auth)/pending-approval" />;

  return <RoleShell title="Employee dashboard" items={DESKTOP_NAV_ITEMS}>
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="complaint/[id]" />
        <Stack.Screen name="notifications" />
      </Stack>
      <EmergencyAlertBar />
    </View>
  </RoleShell>;
}
