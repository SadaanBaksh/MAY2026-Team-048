import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { exportManagerCsv, type ManagerExportDataset } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { DarkModeToggle } from '@/components/shared/DarkModeToggle';
import { ProfileHeader } from '@/components/shared/ProfileHeader';
import { Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import type { FacilityManager } from '@/types';

export default function ManagerProfileScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const user = useAuthStore((s) => s.currentUser) as FacilityManager;
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const [exporting, setExporting] = useState<ManagerExportDataset | null>(null);

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/landing');
  };

  const handleExport = async (dataset: ManagerExportDataset) => {
    if (!token || exporting) return;
    setExporting(dataset);
    try {
      const filename = await exportManagerCsv(token, dataset);
      Alert.alert('CSV ready', `${filename} has been downloaded or opened for sharing.`);
    } catch (error) {
      Alert.alert(
        'Export failed',
        error instanceof Error ? error.message : 'The CSV could not be created. Please try again.',
      );
    } finally {
      setExporting(null);
    }
  };

  return (
    <Screen edges={['top']} maxWidth={480}>
      <Text style={styles.title}>Profile</Text>
      <ProfileHeader user={user} meta={user.title} />
      <DarkModeToggle />
      <Card style={styles.exportCard}>
        <View style={styles.exportHeading}>
          <Text style={styles.sectionTitle}>Data exports</Text>
          <Text style={styles.sectionDescription}>
            Download complete, spreadsheet-ready office records. Exports include the current details
            for every record, not just the rows visible on screen.
          </Text>
        </View>
        <Button
          label="Employees & maintenance staff"
          variant="outline"
          icon="people-outline"
          fullWidth
          loading={exporting === 'employees'}
          disabled={exporting !== null}
          onPress={() => handleExport('employees')}
        />
        <Button
          label="Residents"
          variant="outline"
          icon="home-outline"
          fullWidth
          loading={exporting === 'residents'}
          disabled={exporting !== null}
          onPress={() => handleExport('residents')}
        />
        <Button
          label="Public services"
          variant="outline"
          icon="construct-outline"
          fullWidth
          loading={exporting === 'services'}
          disabled={exporting !== null}
          onPress={() => handleExport('services')}
        />
      </Card>
      <Button
        label="Change Password"
        variant="outline"
        onPress={() => router.push('/(auth)/change-password')}
        fullWidth
        icon="key-outline"
      />
      <Button
        label="Log Out"
        variant="outline"
        onPress={handleLogout}
        fullWidth
        icon="log-out-outline"
        textColor={Colors.danger}
      />
    </Screen>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    title: {
      ...Type.title,
      color: Colors.ink,
    },
    exportCard: {
      gap: Spacing.sm,
    },
    exportHeading: {
      gap: Spacing.xs,
      marginBottom: Spacing.xs,
    },
    sectionTitle: {
      ...Type.subtitle,
      color: Colors.ink,
    },
    sectionDescription: {
      ...Type.caption,
      color: Colors.inkSecondary,
    },
  });
