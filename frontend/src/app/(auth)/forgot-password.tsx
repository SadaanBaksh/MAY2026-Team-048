import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, TextInput, Pressable } from 'react-native';
import * as v from 'valibot';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SimplifixLogo } from '@/components/ui/SimplifixLogo';
import { TextField } from '@/components/ui/TextField';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { emailSchema, firstIssueMessage, passwordSchema } from '@/utils/validation';
import { sendOtp, verifyOtp, resetPassword } from '@/api/client';
import { Ionicons } from '@expo/vector-icons';

const CARD_MAX_WIDTH = 480;

export default function ForgotPasswordScreen() {
  const { Colors } = useTheme();
  const isDesktop = useIsDesktop();
  const styles = useMemo(() => getStyles(Colors), [Colors]);

  const [step, setStep] = useState<'email' | 'otp' | 'new_password'>('email');
  
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const otpRefs = [useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null)];
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const [countdown, setCountdown] = useState(0);
  const [resetToken, setResetToken] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'otp' && countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [step, countdown]);

  const handleSendOtp = async () => {
    const emailError = firstIssueMessage(v.safeParse(emailSchema, email));
    if (emailError) {
      setError(emailError);
      return;
    }
    setSubmitting(true);
    try {
      await sendOtp(email, 'forgot_password');
      setStep('otp');
      setCountdown(60);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    const otp = otpDigits.join('');
    if (otp.length !== 4) {
      setError('Please enter a 4-digit code.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await verifyOtp(email, otp, 'forgot_password');
      if (res.verified && res.reset_token) {
        setResetToken(res.reset_token);
        setStep('new_password');
        setError('');
      } else {
        setError('Invalid OTP.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    const passwordError = firstIssueMessage(v.safeParse(passwordSchema, password));
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(resetToken, password);
      setSuccessMsg('Password reset successfully. You can now log in.');
      setError('');
      setTimeout(() => {
        router.replace('/');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    try {
      await sendOtp(email, 'forgot_password');
      setCountdown(60);
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP.');
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
      <ScreenHeader title="Forgot Password" showBack onBack={() => router.back()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]} keyboardShouldPersistTaps="handled">
          {step === 'email' && (
            <Card style={[styles.card, isDesktop && styles.cardDesktop]}>
              <View style={styles.brandRow}>
                <View style={styles.brandMark}>
                  <SimplifixLogo width={50} height={50} />
                </View>
                <Text style={styles.brandName}>Simplifix</Text>
              </View>

              <Text style={styles.title}>Reset your password</Text>
              <Text style={styles.subtitle}>Enter your email address and we will send you a 4-digit code to reset your password.</Text>

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
                {!!error && <Text style={styles.error}>{error}</Text>}
                <Button
                  label="Send OTP"
                  onPress={handleSendOtp}
                  loading={submitting}
                  disabled={submitting}
                  fullWidth
                  size="lg"
                />
              </View>
            </Card>
          )}

          {step === 'otp' && (
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
                  label="Verify Code"
                  onPress={handleVerifyOtp}
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
                  onPress={() => setStep('email')}
                  disabled={submitting}
                  fullWidth
                  size="lg"
                />
              </View>
            </Card>
          )}

          {step === 'new_password' && (
            <Card style={[styles.card, isDesktop && styles.cardDesktop]}>
              <View style={styles.brandRow}>
                <View style={styles.brandMark}>
                  <SimplifixLogo width={50} height={50} />
                </View>
                <Text style={styles.brandName}>Simplifix</Text>
              </View>

              <Text style={styles.title}>Create new password</Text>
              <Text style={styles.subtitle}>Your new password must be different from previous used passwords.</Text>

              <View style={styles.form}>
                <TextField
                  label="New Password"
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
                {!!successMsg && <Text style={styles.success}>{successMsg}</Text>}
                
                <Button
                  label="Reset Password"
                  onPress={handleResetPassword}
                  loading={submitting}
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
