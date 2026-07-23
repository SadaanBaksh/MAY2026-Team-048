import { router } from 'expo-router';

import { AuthLoginScreen, type DemoAccountItem } from '@/components/shared/AuthLoginScreen';

const DEMO_ACCOUNTS: DemoAccountItem[] = [
  { role: 'facility_employee', shortLabel: 'Employee', icon: 'briefcase-outline' },
  { role: 'maintenance_staff', shortLabel: 'Staff', icon: 'construct-outline' },
  { role: 'facility_manager', shortLabel: 'Manager', icon: 'stats-chart-outline' },
];

export default function EmployeeLoginScreen() {
  return (
    <AuthLoginScreen
      headerTitle="Employee Log In"
      title="Employee Login"
      subtitle="Log in to manage community complaints, operations, and maintenance tasks."
      emailPlaceholder="employee@example.com"
      buttonLabel="Log In as Employee"
      demoDividerText="or explore an employee demo account"
      demoAccounts={DEMO_ACCOUNTS}
      validateRole={(user) =>
        user.role === 'resident'
          ? 'This email belongs to a customer account. Please use Customer Login.'
          : null
      }
      footerLinks={[
        {
          promptText: 'Need an account?',
          linkText: 'Create an account',
          onPress: () => router.push('/(auth)/register'),
        },
        {
          promptText: 'Are you a customer?',
          linkText: 'Customer Login',
          onPress: () => router.replace('/(auth)/customer-login'),
        },
      ]}
    />
  );
}
