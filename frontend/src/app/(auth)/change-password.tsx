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
import { firstIssueMessage, passwordSchema } from '@/utils/validation';
import { sendChangePasswordOtp, verifyAndChangePassword } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { Ionicons } from '@expo/vector-icons';

const CARD_MAX_WIDTH = 480;

export default function ChangePasswordScreen() {
  const { Colors } = useTheme();
  const isDesktop = useIsDesktop();
  const styles = useMemo(() => getStyles(Colors), [Colors]);

  const token = useAuthStore((s) => s.token);
  const currentUser = useAuthStore((s) => s.currentUser);
  
  const [step, setStep] = useState<'send_otp' | 'verify_and_change'>('send_otp');
  
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const otpRefs = [useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null)];
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const [countdown, setCountdown] = useState(0);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'verify_and_change' && countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [step, countdown]);

  const handleSendOtp = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      await sendChangePasswordOtp(token);
      setStep('verify_and_change');
      setCountdown(60);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePassword = async () => {
    if (!token) return;
    
    const otp = otpDigits.join('');
    if (otp.length !== 4) {
      setError('Please enter a 4-digit code.');
      return;
    }
    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }
    const passwordError = firstIssueMessage(v.safeParse(passwordSchema, newPassword));
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await verifyAndChangePassword(token, otp, currentPassword, newPassword);
      setSuccessMsg('Password changed successfully.');
      setError('');
      setTimeout(() => {
        router.back();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to change password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!token || countdown > 0) return;
    try {
      await sendChangePasswordOtp(token);
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
      <ScreenHeader title="Change Password" showBack onBack={() => router.back()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]} keyboardShouldPersistTaps="handled">
          
          {step === 'send_otp' && (
            <Card style={[styles.card, isDesktop && styles.cardDesktop]}>
              <View style={styles.brandRow}>
                <View style={styles.brandMark}>
                  <SimplifixLogo width={50} height={50} />
                </View>
                <Text style={styles.brandName}>Simplifix</Text>
              </View>

              <Text style={styles.title}>Change Password</Text>
              <Text style={styles.subtitle}>To protect your account, we need to verify your identity. We will send a 4-digit code to {currentUser?.email}.</Text>

              <View style={styles.form}>
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

          {step === 'verify_and_change' && (
            <Card style={[styles.card, isDesktop && styles.cardDesktop]}>
              <View style={{ alignItems: 'center', marginBottom: Spacing.md }}>
                <View style={styles.iconCircle}>
                  <Ionicons name="mail-outline" size={32} color={Colors.teal} />
                </View>
              </View>
              
              <Text style={[styles.title, { textAlign: 'center' }]}>Verify and Change</Text>
              <Text style={[styles.subtitle, { textAlign: 'center' }]}>We&apos;ve sent a 4-digit code to {currentUser?.email}</Text>

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

              <View style={styles.form}>
                <TextField
                  label="Current Password"
                  icon="lock-closed-outline"
                  placeholder="••••••••"
                  secure
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                />
                <TextField
                  label="New Password"
                  icon="lock-closed-outline"
                  placeholder="••••••••"
                  secure
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
                <TextField
                  label="Confirm New Password"
                  icon="lock-closed-outline"
                  placeholder="••••••••"
                  secure
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />

                {!!error && <Text style={[styles.error, { textAlign: 'center', marginTop: Spacing.sm }]}>{error}</Text>}
                {!!successMsg && <Text style={[styles.success, { textAlign: 'center', marginTop: Spacing.sm }]}>{successMsg}</Text>}
                
                <View style={{ marginTop: Spacing.md }}>
                  <Button
                    label="Change Password"
                    onPress={handleChangePassword}
                    loading={submitting}
                    disabled={submitting || !!successMsg || otpDigits.join('').length !== 4}
                    fullWidth
                    size="lg"
                  />
                </View>
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
