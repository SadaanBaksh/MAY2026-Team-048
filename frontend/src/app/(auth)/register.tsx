import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as v from 'valibot';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SimplifixLogo } from '@/components/ui/SimplifixLogo';
import { TextField } from '@/components/ui/TextField';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import type { UserRole } from '@/types';
import {
  emailSchema,
  firstIssueMessage,
  passwordSchema,
  phoneSchema,
  toCanonicalPhone,
} from '@/utils/validation';
import { sendOtp, verifyOtp } from '@/api/client';
import { Ionicons } from '@expo/vector-icons';
import { TextInput, Pressable } from 'react-native';
import { useRef } from 'react';

const REGISTER_CARD_MAX_WIDTH = 480;

// The employee/manager back-office roles register from the desktop app; residents and
// maintenance staff register from the mobile app, so each surface only offers its pair.
const DESKTOP_ROLE_OPTIONS: { label: string; value: UserRole }[] = [
  { label: 'Manager', value: 'facility_manager' },
  { label: 'Employee', value: 'facility_employee' },
];

const MOBILE_ROLE_OPTIONS: { label: string; value: UserRole }[] = [
  { label: 'Resident', value: 'resident' },
  { label: 'Staff', value: 'maintenance_staff' },
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
  const isDesktop = useIsDesktop();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const register = useAuthStore((s) => s.register);

  const roleOptions = isDesktop ? DESKTOP_ROLE_OPTIONS : MOBILE_ROLE_OPTIONS;
  const [role, setRole] = useState<UserRole>(isDesktop ? 'facility_manager' : 'resident');
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
  const [submitting, setSubmitting] = useState(false);
  
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const otpRefs = [useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null)];
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'otp' && countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [step, countdown]);

  // Keep the selected role valid for whichever pair of options the current
  // breakpoint shows (e.g. resizing from desktop down to mobile width).
  useEffect(() => {
    setRole(isDesktop ? 'facility_manager' : 'resident');
  }, [isDesktop]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    const emailError = firstIssueMessage(v.safeParse(emailSchema, email));
    if (emailError) {
      setError(emailError);
      return;
    }
    const phoneError = firstIssueMessage(v.safeParse(phoneSchema, phone));
    if (phoneError) {
      setError(phoneError);
      return;
    }
    const passwordError = firstIssueMessage(v.safeParse(passwordSchema, password));
    if (passwordError) {
      setError(passwordError);
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
    setSubmitting(true);
    try {
      await sendOtp(email, 'register');
      setStep('otp');
      setCountdown(60);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    const otp = otpDigits.join('');
    if (otp.length !== 4) {
      setError('Please enter a 4-digit code.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await verifyOtp(email, otp, 'register');
      if (res.verified) {
        const result = await register({
          name,
          email,
          phone: toCanonicalPhone(phone),
          role,
          password,
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
      } else {
        setError('Invalid OTP.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    try {
      await sendOtp(email, 'register');
      setCountdown(60);
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP.');
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    const newDigits = [...otpDigits];
    newDigits[index] = text.slice(-1); // Take only the last character if pasted
    setOtpDigits(newDigits);
    if (text && index < 3) {
      otpRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  const copy = ROLE_COPY[role];

  return (
    <View style={styles.wrapper}>
      <ScreenHeader title="Create Account" showBack onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
          keyboardShouldPersistTaps="handled"
        >
          {step === 'form' ? (
          <Card style={[styles.card, isDesktop && styles.cardDesktop]}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <SimplifixLogo width={50} height={50} />
              </View>
              <Text style={styles.brandName}>Simplifix</Text>
            </View>

            <SegmentedControl options={roleOptions} value={role} onChange={setRole} />

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
              <Button
                label="Create Account"
                onPress={handleSubmit}
                loading={submitting}
                disabled={submitting}
                fullWidth
                size="lg"
              />
            </View>
          </Card>
          ) : (
            <Card style={[styles.card, isDesktop && styles.cardDesktop]}>
              <View style={{ alignItems: 'center', marginBottom: Spacing.md }}>
                <View style={styles.iconCircle}>
                  <Ionicons name="mail-outline" size={32} color={Colors.teal} />
                </View>
              </View>
              
              <Text style={[styles.title, { textAlign: 'center' }]}>Verify your email</Text>
              <Text style={[styles.subtitle, { textAlign: 'center' }]}>We&apos;ve sent a 4-digit code to {email}</Text>

              <View style={styles.otpContainer}>
                {otpDigits.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={otpRefs[i]}
                    style={[styles.otpInput, { color: Colors.ink, borderColor: Colors.border }]}
                    keyboardType="number-pad"
                    maxLength={1}
                    value={digit}
                    onChangeText={(text) => handleOtpChange(text, i)}
                    onKeyPress={(e) => handleOtpKeyPress(e, i)}
                  />
                ))}
              </View>

              <Pressable onPress={handleResend} style={{ alignItems: 'center', marginTop: Spacing.sm }}>
                <Text style={{ ...Type.bodyMedium, color: countdown > 0 ? Colors.inkTertiary : Colors.teal }}>
                  {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
                </Text>
              </Pressable>

              {!!error && <Text style={[styles.error, { textAlign: 'center', marginTop: Spacing.sm }]}>{error}</Text>}
              
              <View style={{ marginTop: Spacing.md }}>
                <Button
                  label="Verify & Create Account"
                  onPress={handleVerify}
                  loading={submitting}
                  disabled={submitting || otpDigits.join('').length !== 4}
                  fullWidth
                  size="lg"
                />
              </View>
              
              <View style={{ marginTop: Spacing.sm }}>
                <Button
                  label="Back"
                  variant="outline"
                  onPress={() => setStep('form')}
                  disabled={submitting}
                  fullWidth
                  size="lg"
                />
              </View>
            </Card>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Text
              style={styles.footerLink}
              onPress={() =>
                router.replace(role === 'resident' ? '/(auth)/customer-login' : '/(auth)/employee-login')
              }
            >
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
      maxWidth: REGISTER_CARD_MAX_WIDTH,
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
      marginTop: Spacing.sm,
    },
    footerText: {
      ...Type.caption,
      color: Colors.inkSecondary,
    },
    footerLink: {
      ...Type.captionBold,
      color: Colors.primary,
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: Colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: Colors.border,
    },
    otpContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Spacing.md,
      marginTop: Spacing.lg,
    },
    otpInput: {
      width: 56,
      height: 64,
      borderWidth: 1,
      borderRadius: Radius.md,
      textAlign: 'center',
      fontSize: 24,
      fontFamily: 'semiBold',
      backgroundColor: Colors.surface,
    },
  });
