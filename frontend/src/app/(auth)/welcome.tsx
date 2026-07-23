import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SimplifixLogo } from '@/components/shared/SimplifixLogo';
import { Button } from '@/components/ui/Button';
import { LightColors, Radius, Spacing, Type } from '@/constants/theme';
import type { ThemeColors } from '@/hooks/useTheme';

const ROLE_HIGHLIGHTS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'home-outline', label: 'Residents' },
  { icon: 'briefcase-outline', label: 'Facility Team' },
  { icon: 'construct-outline', label: 'Maintenance' },
  { icon: 'stats-chart-outline', label: 'Managers' },
];

export default function WelcomeScreen() {
  // Always rendered with the light palette, regardless of the app's theme mode —
  // this is a brand-colored splash screen, not a themed app surface.
  const Colors = LightColors;
  const styles = useMemo(() => getStyles(Colors), [Colors]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[Colors.primaryDark, Colors.primary]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.hero}>
          <View style={styles.brandMark}>
            <SimplifixLogo width={80} height={80} />
          </View>
          <Text style={styles.brand}>Simplifix</Text>
          <Text style={styles.tagline}>
            AI-assisted complaint management for residential communities.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>One app, every stakeholder</Text>
          <View style={styles.roleGrid}>
            {ROLE_HIGHLIGHTS.map((role) => (
              <View key={role.label} style={styles.roleItem}>
                <View style={styles.roleIcon}>
                  <Ionicons name={role.icon} size={18} color={Colors.primary} />
                </View>
                <Text style={styles.roleLabel}>{role.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            <Button
              label="Log In"
              onPress={() => router.push('/(auth)/login')}
              fullWidth
              size="lg"
              style={{ backgroundColor: Colors.primary }}
              textColor={Colors.white}
            />
            <Button
              label="Create an Account"
              onPress={() => router.push('/(auth)/register')}
              variant="outline"
              fullWidth
              size="lg"
              style={{ borderColor: Colors.borderStrong }}
              textColor={Colors.ink}
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    safeArea: {
      flex: 1,
      justifyContent: 'space-between',
    },
    hero: {
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.xxl,
      gap: Spacing.xs,
    },
    brandMark: {
      width: 56,
      height: 56,
      borderRadius: Radius.lg,
      backgroundColor: 'rgba(255,255,255,0.16)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.sm,
    },
    brand: {
      ...Type.display,
      fontSize: 34,
      color: Colors.white,
    },
    tagline: {
      ...Type.body,
      color: 'rgba(255,255,255,0.85)',
      maxWidth: 280,
    },
    card: {
      backgroundColor: Colors.surface,
      borderTopLeftRadius: Radius.xl + 6,
      borderTopRightRadius: Radius.xl + 6,
      padding: Spacing.xl,
      paddingBottom: Spacing.xxl,
      gap: Spacing.lg,
    },
    cardTitle: {
      ...Type.subtitle,
      color: Colors.ink,
    },
    roleGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    roleItem: {
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    roleIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: Colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    roleLabel: {
      ...Type.tiny,
      color: Colors.inkSecondary,
      textAlign: 'center',
    },
    actions: {
      gap: Spacing.sm,
    },
  });
