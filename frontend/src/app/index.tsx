import { Redirect } from 'expo-router';

import { useAuthStore } from '@/store/authStore';
import type { UserRole } from '@/types';

const ROLE_HOME: Record<UserRole, string> = {
  resident: '/(resident)/(tabs)',
  facility_employee: '/(employee)/(tabs)',
  maintenance_staff: '/(maintenance)/(tabs)',
  facility_manager: '/(manager)/(tabs)',
};

export default function Index() {
  const currentUser = useAuthStore((s) => s.currentUser);

  if (!currentUser) return <Redirect href="/(auth)/landing" />;
  if (currentUser.accountStatus !== 'active') return <Redirect href="/(auth)/pending-approval" />;
  return <Redirect href={ROLE_HOME[currentUser.role] as never} />;
}
