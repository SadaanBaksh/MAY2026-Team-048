import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as v from 'valibot';

import { requestEmailChangeOtp } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SimplifixLogo } from '@/components/ui/SimplifixLogo';
import { TextField } from '@/components/ui/TextField';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { emailSchema, firstIssueMessage } from '@/utils/validation';

const CARD_MAX_WIDTH = 480;

export default function ChangeEmailScreen() {
  const { Colors } = useTheme();
  const isDesktop = useIsDesktop();
  const styles = useMemo(() => getStyles(Colors), [Colors]);

  const token = useAuthStore((s) => s.token);
  const currentUser = useAuthStore((s) => s.currentUser);
  const confirmEmailChange = useAuthStore((s) => s.confirmEmailChange);

  const [step, setStep] = useState<'enter_email' | 'verify'>('enter_email');
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const otpRefs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ];
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'verify' && countdown > 0) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [step, countdown]);

  const handleSendOtp = async () => {
    if (!token) return;
    const emailError = firstIssueMessage(v.safeParse(emailSchema, newEmail));
    if (emailError) {
      setError(emailError);
      return;
    }
    if (newEmail.trim().toLowerCase() === currentUser?.email.toLowerCase()) {
      setError('That is already your email address.');
      return;
    }
    setSubmitting(true);
    try {
      await requestEmailChangeOtp(token, newEmail.trim());
      setStep('verify');
      setCountdown(60);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    const otp = otpDigits.join('');
    if (otp.length !== 4) {
      setError('Please enter the 4-digit code.');
      return;
    }
    setSubmitting(true);
    try {
      await confirmEmailChange(newEmail.trim(), otp);
      setSuccessMsg('Email address updated.');
      setError('');
      setTimeout(() => router.back(), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to verify code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!token || countdown > 0) return;
    try {
      await requestEmailChangeOtp(token, newEmail.trim());
      setCountdown(60);
    } catch (err: any) {
      setError(err.message || 'Failed to resend code.');
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    const newDigits = [...otpDigits];
    newDigits[index] = text.slice(-1);
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

  return (
    <View style={styles.wrapper}>
      <ScreenHeader title="Change Email" showBack onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
          keyboardShouldPersistTaps="handled"
        >
          {step === 'enter_email' && (
            <Card style={[styles.card, isDesktop && styles.cardDesktop]}>
              <View style={styles.brandRow}>
                <View style={styles.brandMark}>
                  <SimplifixLogo width={50} height={50} />
                </View>
                <Text style={styles.brandName}>Simplifix</Text>
              </View>

              <Text style={styles.title}>Change Email</Text>
              <Text style={styles.subtitle}>
                Enter the new email address for your account. We&apos;ll send a 4-digit
                verification code to it to confirm it&apos;s yours.
              </Text>

              <View style={styles.form}>
                <TextField
                  label="Current Email"
                  icon="mail-outline"
                  value={currentUser?.email ?? ''}
                  editable={false}
                  style={{ color: Colors.inkTertiary }}
                />
                <TextField
                  label="New Email"
                  icon="mail-outline"
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={newEmail}
                  onChangeText={setNewEmail}
                />
                {!!error && <Text style={styles.error}>{error}</Text>}
                <Button
                  label="Send Verification Code"
                  onPress={handleSendOtp}
                  loading={submitting}
                  disabled={submitting}
                  fullWidth
                  size="lg"
                />
              </View>
            </Card>
          )}

          {step === 'verify' && (
            <Card style={[styles.card, isDesktop && styles.cardDesktop]}>
              <View style={{ alignItems: 'center', marginBottom: Spacing.md }}>
                <View style={styles.iconCircle}>
                  <Ionicons name="mail-outline" size={32} color={Colors.teal} />
                </View>
              </View>

              <Text style={[styles.title, { textAlign: 'center' }]}>Verify New Email</Text>
              <Text style={[styles.subtitle, { textAlign: 'center' }]}>
                We&apos;ve sent a 4-digit code to {newEmail.trim()}
              </Text>

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

              <Pressable
                onPress={handleResend}
                style={{ alignItems: 'center', marginTop: Spacing.sm }}
              >
                <Text
                  style={{
                    ...Type.bodyMedium,
                    color: countdown > 0 ? Colors.inkTertiary : Colors.teal,
                  }}
                >
                  {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
                </Text>
              </Pressable>

              {!!error && (
                <Text style={[styles.error, { textAlign: 'center', marginTop: Spacing.sm }]}>
                  {error}
                </Text>
              )}
              {!!successMsg && (
                <Text style={[styles.success, { textAlign: 'center', marginTop: Spacing.sm }]}>
                  {successMsg}
                </Text>
              )}

              <View style={{ marginTop: Spacing.md }}>
                <Button
                  label="Confirm New Email"
                  onPress={handleVerify}
                  loading={submitting}
                  disabled={submitting || !!successMsg || otpDigits.join('').length !== 4}
                  fullWidth
                  size="lg"
                />
              </View>

              <View style={{ marginTop: Spacing.sm }}>
                <Button
                  label="Back"
                  variant="outline"
                  onPress={() => {
                    setStep('enter_email');
                    setOtpDigits(['', '', '', '']);
                    setError('');
                  }}
                  disabled={submitting || !!successMsg}
                  fullWidth
                  size="lg"
                />
              </View>
            </Card>
          )}
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
      maxWidth: CARD_MAX_WIDTH,
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
    error: {
      ...Type.caption,
      color: Colors.danger,
    },
    success: {
      ...Type.caption,
      color: Colors.success,
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
