import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useNoticeStore } from '@/store/noticeStore';

function displayDate(value: string): string {
  return new Date(value).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' });
}

export default function ResidentNoticeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const token = useAuthStore((state) => state.token)!;
  const cached = useNoticeStore((state) => state.notices.find((notice) => notice.id === id));
  const refresh = useNoticeStore((state) => state.refreshNotice);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cached && id)
      refresh(token, id).catch((exc) =>
        setError(exc instanceof Error ? exc.message : 'Could not load notice'),
      );
  }, [cached, id, token, refresh]);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Official notice" showBack />
      <Screen edges={['bottom']}>
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : !cached ? (
          <Text style={styles.meta}>Loading notice…</Text>
        ) : (
          <Card style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name="megaphone" size={24} color={Colors.teal} />
            </View>
            <Text style={styles.title}>{cached.title}</Text>
            <Text style={styles.meta}>
              {cached.sentAt ? `Sent ${displayDate(cached.sentAt)}` : 'Official management notice'}
            </Text>
            <View style={styles.divider} />
            <Text style={styles.body}>{cached.body}</Text>
            <View style={styles.targetRow}>
              <Ionicons name="business-outline" size={16} color={Colors.inkTertiary} />
              <Text style={styles.meta}>For {cached.targetBuildings.join(', ')}</Text>
            </View>
            {cached.expiresAt && (
              <View style={styles.expiry}>
                <Ionicons name="time-outline" size={16} color={Colors.warning} />
                <Text style={styles.expiryText}>Valid until {displayDate(cached.expiresAt)}</Text>
              </View>
            )}
          </Card>
        )}
      </Screen>
    </View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.surfaceMuted },
    card: { gap: Spacing.md },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: Radius.md,
      backgroundColor: Colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { ...Type.title, color: Colors.ink },
    body: { ...Type.body, color: Colors.ink, lineHeight: 24 },
    meta: { ...Type.caption, color: Colors.inkSecondary },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
    targetRow: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'center' },
    expiry: {
      flexDirection: 'row',
      gap: Spacing.xs,
      alignItems: 'center',
      backgroundColor: Colors.warningSoft,
      borderRadius: Radius.md,
      padding: Spacing.sm,
    },
    expiryText: { ...Type.caption, color: Colors.warning },
    error: { ...Type.body, color: Colors.danger },
  });
