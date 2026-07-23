import { router } from 'expo-router';

import { AuthLoginScreen, type DemoAccountItem } from '@/components/shared/AuthLoginScreen';

const DEMO_ACCOUNTS: DemoAccountItem[] = [
  { role: 'resident', shortLabel: 'Resident', icon: 'home-outline' },
];

export default function CustomerLoginScreen() {
  return (
    <AuthLoginScreen
      headerTitle="Customer Log In"
      title="Customer Login"
      subtitle="Log in to your resident account to submit and track maintenance complaints."
      emailPlaceholder="you@example.com"
      buttonLabel="Log In as Customer"
      demoDividerText="or explore a customer demo account"
      demoAccounts={DEMO_ACCOUNTS}
      validateRole={(user) =>
        user.role !== 'resident'
          ? 'This email belongs to an employee account. Please use Employee Login.'
          : null
      }
      footerLinks={[
        {
          promptText: 'New resident?',
          linkText: 'Create an account',
          onPress: () => router.push('/(auth)/register'),
        },
        {
          promptText: 'Are you an employee?',
          linkText: 'Employee Login',
          onPress: () => router.replace('/(auth)/employee-login'),
        },
      ]}
    />
  );
}
