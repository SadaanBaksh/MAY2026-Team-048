import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import HouseLogo from '@/assets/images/house_logo-house-white.svg';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { MaxAuthCardWidth, Radius, Spacing, Type } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useTheme, type RoleColorMap, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import type { UserRole } from '@/types';

const DEMO_ACCOUNTS: { role: UserRole; shortLabel: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { role: 'resident', shortLabel: 'Resident', icon: 'home-outline' },
];

export default function CustomerLoginScreen() {
  const { Colors, RoleColors } = useTheme();
  const isDesktop = useIsDesktop();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const users = useAuthStore((s) => s.users);
  const login = useAuthStore((s) => s.login);
  const loginAsDemo = useAuthStore((s) => s.loginAsDemo);

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      setError('Enter your email and password to continue.');
      return;
    }
    const targetUser = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (targetUser && targetUser.role !== 'resident') {
      setError('This email belongs to an employee account. Please use Employee Login.');
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
      <ScreenHeader title="Customer Log In" showBack onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
          keyboardShouldPersistTaps="handled"
        >
          <Card style={[styles.card, isDesktop && styles.cardDesktop]}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <HouseLogo width={18} height={18} />
              </View>
              <Text style={styles.brandName}>Simplifix</Text>
            </View>

            <Text style={styles.title}>Customer Login</Text>
            <Text style={styles.subtitle}>
              Log in to your resident account to submit and track maintenance complaints.
            </Text>

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
              <Button
                label="Log In as Customer"
                onPress={handleLogin}
                fullWidth
                size="lg"
                style={styles.loginButton}
              />
            </View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or explore a customer demo account</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.demoRow}>
              {DEMO_ACCOUNTS.map((acc) => (
                <DemoRoleChip
                  key={acc.role}
                  icon={acc.icon}
                  label={acc.shortLabel}
                  labelColor={Colors.inkSecondary}
                  roleColor={RoleColors[acc.role]}
                  onPress={() => handleDemo(acc.role)}
                />
              ))}
            </View>
          </Card>

          <View style={styles.footer}>
            <Text style={styles.footerText}>New resident?</Text>
            <Text style={styles.footerLink} onPress={() => router.push('/(auth)/register')}>
              Create an account
            </Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Are you an employee?</Text>
            <Text
              style={styles.footerLink}
              onPress={() => router.replace('/(auth)/employee-login')}
            >
              Employee Login
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function DemoRoleChip({
  icon,
  label,
  labelColor,
  roleColor,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  labelColor: string;
  roleColor: RoleColorMap[UserRole];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [chipStyles.chip, pressed && chipStyles.chipPressed]}
    >
      <View style={[chipStyles.icon, { backgroundColor: roleColor.soft }]}>
        <Ionicons name={icon} size={18} color={roleColor.text} />
      </View>
      <Text style={[chipStyles.label, { color: labelColor }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  chipPressed: {
    opacity: 0.7,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...Type.tiny,
    textAlign: 'center',
  },
});

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
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
    contentDesktop: {
      alignItems: 'center',
      paddingTop: Spacing.xxl,
    },
    card: {
      width: '100%',
      gap: Spacing.md,
      padding: Spacing.xl,
      borderRadius: Radius.xl,
    },
    cardDesktop: {
      maxWidth: MaxAuthCardWidth,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    brandMark: {
      width: 32,
      height: 32,
      borderRadius: Radius.md,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    brandName: {
      ...Type.subtitle,
      color: Colors.ink,
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
    loginButton: {
      backgroundColor: Colors.teal,
    },
    error: {
      ...Type.caption,
      color: Colors.danger,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.xs,
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
    demoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: Spacing.xs,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
      marginTop: Spacing.xs,
    },
    footerText: {
      ...Type.caption,
      color: Colors.inkSecondary,
    },
    footerLink: {
      ...Type.captionBold,
      color: Colors.teal,
    },
  });
