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

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SimplifixLogo } from '@/components/ui/SimplifixLogo';
import { TextField } from '@/components/ui/TextField';
import { MaxAuthCardWidth, Radius, Spacing, Type } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useTheme, type RoleColorMap, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import type { AppUser, UserRole } from '@/types';

export interface DemoAccountItem {
  role: UserRole;
  shortLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export interface FooterLinkItem {
  promptText: string;
  linkText: string;
  onPress: () => void;
}

export interface AuthLoginScreenProps {
  headerTitle: string;
  title: string;
  subtitle: string;
  emailPlaceholder?: string;
  buttonLabel: string;
  demoDividerText: string;
  demoAccounts: DemoAccountItem[];
  validateRole?: (user: AppUser) => string | null;
  footerLinks: FooterLinkItem[];
}

export function AuthLoginScreen({
  headerTitle,
  title,
  subtitle,
  emailPlaceholder = 'you@example.com',
  buttonLabel,
  demoDividerText,
  demoAccounts,
  validateRole,
  footerLinks,
}: AuthLoginScreenProps) {
  const { Colors, RoleColors } = useTheme();
  const isDesktop = useIsDesktop();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const login = useAuthStore((s) => s.login);
  const loginAsDemo = useAuthStore((s) => s.loginAsDemo);
  const logout = useAuthStore((s) => s.logout);

  const afterLogin = async (result: { success: boolean; error?: string }) => {
    if (!result.success) {
      setError(result.error ?? 'Unable to log in.');
      return;
    }
    const loggedInUser = useAuthStore.getState().currentUser;
    if (loggedInUser && validateRole) {
      const roleError = validateRole(loggedInUser);
      if (roleError) {
        await logout();
        setError(roleError);
        return;
      }
    }
    setError('');
    router.replace('/');
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Enter your email and password to continue.');
      return;
    }
    setSubmitting(true);
    try {
      await afterLogin(await login(email.trim(), password));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemo = async (role: UserRole) => {
    setSubmitting(true);
    try {
      await afterLogin(await loginAsDemo(role));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <ScreenHeader title={headerTitle} showBack onBack={() => router.back()} />
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
                <SimplifixLogo width={50} height={50} />
              </View>
              <Text style={styles.brandName}>Simplifix</Text>
            </View>

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>

            <View style={styles.form}>
              <TextField
                label="Email"
                icon="mail-outline"
                placeholder={emailPlaceholder}
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
                label={buttonLabel}
                onPress={handleLogin}
                loading={submitting}
                disabled={submitting}
                fullWidth
                size="lg"
                style={styles.loginButton}
              />
            </View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{demoDividerText}</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.demoRow}>
              {demoAccounts.map((acc) => (
                <DemoRoleChip
                  key={acc.role}
                  icon={acc.icon}
                  label={acc.shortLabel}
                  labelColor={Colors.inkSecondary}
                  roleColor={RoleColors[acc.role]}
                  disabled={submitting}
                  onPress={() => handleDemo(acc.role)}
                />
              ))}
            </View>
          </Card>

          {footerLinks.map((link, idx) => (
            <View key={idx} style={styles.footer}>
              <Text style={styles.footerText}>{link.promptText}</Text>
              <Text style={styles.footerLink} onPress={link.onPress}>
                {link.linkText}
              </Text>
            </View>
          ))}
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
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  labelColor: string;
  roleColor: RoleColorMap[UserRole];
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        chipStyles.chip,
        pressed && chipStyles.chipPressed,
        disabled && chipStyles.chipDisabled,
      ]}
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
  chipDisabled: {
    opacity: 0.4,
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
