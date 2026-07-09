import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TextField } from '@/components/ui/TextField';
import { Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import type { UserRole } from '@/types';

const ROLE_OPTIONS: { label: string; value: UserRole }[] = [
  { label: 'Resident', value: 'resident' },
  { label: 'Employee', value: 'facility_employee' },
  { label: 'Staff', value: 'maintenance_staff' },
  { label: 'Manager', value: 'facility_manager' },
];

const ROLE_COPY: Record<UserRole, { title: string; subtitle: string }> = {
  resident: {
    title: 'Resident sign up',
    subtitle: 'Register with your apartment details so complaints route to the right building.',
  },
  facility_employee: {
    title: 'Facility employee sign up',
    subtitle:
      'Your request will be sent to your facility manager for approval before you can log in.',
  },
  maintenance_staff: {
    title: 'Maintenance staff sign up',
    subtitle:
      'Your request will be sent to your facility manager for approval before you can log in.',
  },
  facility_manager: {
    title: 'Facility manager sign up',
    subtitle:
      'Managers get full access right away, including approving employee and staff requests.',
  },
};

export default function RegisterScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const register = useAuthStore((s) => s.register);

  const [role, setRole] = useState<UserRole>('resident');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [building, setBuilding] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [title, setTitle] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!name.trim() || !email.trim() || !phone.trim() || !password) {
      setError('Please fill in every field to continue.');
      return;
    }
    if (role === 'resident' && (!building.trim() || !unitNumber.trim())) {
      setError('Please fill in every field to continue.');
      return;
    }
    if (role === 'facility_employee' && !title.trim()) {
      setError('Please enter your job title.');
      return;
    }
    if (role === 'maintenance_staff' && !specialization.trim()) {
      setError('Please enter your specialization.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    const result = register({
      name,
      email,
      phone,
      role,
      building,
      unitNumber,
      title,
      specialization,
    });
    if (!result.success) {
      setError(result.error ?? 'Unable to create account.');
      return;
    }
    router.replace('/');
  };

  const copy = ROLE_COPY[role];

  return (
    <View style={styles.wrapper}>
      <ScreenHeader title="Create Account" showBack onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <SegmentedControl options={ROLE_OPTIONS} value={role} onChange={setRole} />

          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>

          <View style={styles.form}>
            <TextField
              label="Full Name"
              icon="person-outline"
              placeholder="Jane Doe"
              value={name}
              onChangeText={setName}
            />
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
              label="Phone"
              icon="call-outline"
              placeholder="+91 98765 43210"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

            {role === 'resident' && (
              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <TextField
                    label="Building / Wing"
                    placeholder="Wing A"
                    value={building}
                    onChangeText={setBuilding}
                  />
                </View>
                <View style={styles.rowItem}>
                  <TextField
                    label="Unit Number"
                    placeholder="A-305"
                    value={unitNumber}
                    onChangeText={setUnitNumber}
                  />
                </View>
              </View>
            )}

            {role === 'facility_employee' && (
              <TextField
                label="Job Title"
                icon="briefcase-outline"
                placeholder="Facility Coordinator"
                value={title}
                onChangeText={setTitle}
              />
            )}

            {role === 'maintenance_staff' && (
              <TextField
                label="Specialization"
                icon="construct-outline"
                placeholder="Plumbing, Electrical, ..."
                value={specialization}
                onChangeText={setSpecialization}
              />
            )}

            {role === 'facility_manager' && (
              <TextField
                label="Job Title (optional)"
                icon="briefcase-outline"
                placeholder="Facility Manager"
                value={title}
                onChangeText={setTitle}
              />
            )}

            <TextField
              label="Password"
              icon="lock-closed-outline"
              placeholder="••••••••"
              secure
              value={password}
              onChangeText={setPassword}
            />
            <TextField
              label="Confirm Password"
              icon="lock-closed-outline"
              placeholder="••••••••"
              secure
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Button label="Create Account" onPress={handleSubmit} fullWidth size="lg" />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Text style={styles.footerLink} onPress={() => router.replace('/(auth)/login')}>
              Log in
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

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
    row: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    rowItem: {
      flex: 1,
    },
    error: {
      ...Type.caption,
      color: Colors.danger,
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
