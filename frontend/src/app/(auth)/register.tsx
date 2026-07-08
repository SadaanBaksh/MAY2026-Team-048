import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { Colors, Spacing, Type } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';

export default function RegisterScreen() {
  const register = useAuthStore((s) => s.register);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [building, setBuilding] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!name.trim() || !email.trim() || !phone.trim() || !building.trim() || !unitNumber.trim() || !password) {
      setError('Please fill in every field to continue.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    const result = register({ name, email, phone, building, unitNumber });
    if (!result.success) {
      setError(result.error ?? 'Unable to create account.');
      return;
    }
    router.replace('/');
  };

  return (
    <View style={styles.wrapper}>
      <ScreenHeader title="Create Account" showBack onBack={() => router.back()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Resident sign up</Text>
          <Text style={styles.subtitle}>
            Register with your apartment details so complaints route to the right building.
          </Text>

          <View style={styles.form}>
            <TextField label="Full Name" icon="person-outline" placeholder="Jane Doe" value={name} onChangeText={setName} />
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
            <View style={styles.row}>
              <View style={styles.rowItem}>
                <TextField label="Building / Wing" placeholder="Wing A" value={building} onChangeText={setBuilding} />
              </View>
              <View style={styles.rowItem}>
                <TextField label="Unit Number" placeholder="A-305" value={unitNumber} onChangeText={setUnitNumber} />
              </View>
            </View>
            <TextField label="Password" icon="lock-closed-outline" placeholder="••••••••" secure value={password} onChangeText={setPassword} />
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

const styles = StyleSheet.create({
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
