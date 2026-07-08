import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import type { UserRole } from '@/types';

const DEMO_ACCOUNTS: { role: UserRole; label: string; email: string }[] = [
  { role: 'resident', label: 'Resident · Aditi Sharma', email: 'aditi.sharma@simplifix.dev' },
  { role: 'facility_employee', label: 'Facility Employee · Neha Kulkarni', email: 'neha.kulkarni@simplifix.dev' },
  { role: 'maintenance_staff', label: 'Maintenance Staff · Ramesh Yadav', email: 'ramesh.yadav@simplifix.dev' },
  { role: 'facility_manager', label: 'Facility Manager · Priya Nair', email: 'priya.nair@simplifix.dev' },
];

export default function LoginScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const login = useAuthStore((s) => s.login);
  const loginAsDemo = useAuthStore((s) => s.loginAsDemo);

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      setError('Enter your email and password to continue.');
      return;
    }
    const result = login(email);
    if (!result.success) {
      setError(result.error ?? 'Unable to log in.');
      return;
    }
    setError('');
    router.replace('/');
  };

  const handleDemo = (role: UserRole) => {
    loginAsDemo(role);
    router.replace('/');
  };

  return (
    <View style={styles.wrapper}>
      <ScreenHeader title="Log In" showBack onBack={() => router.back()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Log in to track and manage your maintenance complaints.</Text>

        <View style={styles.form}>
          <TextField
            label="Email"
            icon="mail-outline"
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextField
            label="Password"
            icon="lock-closed-outline"
            placeholder="••••••••"
            secure
            value={password}
            onChangeText={setPassword}
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Button label="Log In" onPress={handleLogin} fullWidth size="lg" />
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or explore a demo account</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.demoList}>
          {DEMO_ACCOUNTS.map((acc) => (
            <Card key={acc.role} onPress={() => handleDemo(acc.role)} style={styles.demoCard}>
              <Avatar name={acc.label.split('·')[1]?.trim() ?? acc.label} size={36} />
              <View style={styles.demoText}>
                <Text style={styles.demoLabel}>{acc.label}</Text>
                <Text style={styles.demoEmail}>{acc.email}</Text>
              </View>
            </Card>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>New resident?</Text>
          <Text style={styles.footerLink} onPress={() => router.push('/(auth)/register')}>
            Create an account
          </Text>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const getStyles = (Colors: ThemeColors) => StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: Colors.surfaceMuted,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  title: {
    ...Type.title,
    color: Colors.ink,
  },
  subtitle: {
    ...Type.body,
    color: Colors.inkSecondary,
    marginTop: -Spacing.xs,
  },
  form: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  error: {
    ...Type.caption,
    color: Colors.danger,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  dividerText: {
    ...Type.tiny,
    color: Colors.inkTertiary,
  },
  demoList: {
    gap: Spacing.xs,
  },
  demoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  demoText: {
    flex: 1,
  },
  demoLabel: {
    ...Type.bodyMedium,
    color: Colors.ink,
  },
  demoEmail: {
    ...Type.caption,
    color: Colors.inkSecondary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.md,
  },
  footerText: {
    ...Type.caption,
    color: Colors.inkSecondary,
  },
  footerLink: {
    ...Type.captionBold,
    color: Colors.primary,
  },
});
