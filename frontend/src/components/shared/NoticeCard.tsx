import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import type { Notice } from '@/types';

const STATUS_TONE: Record<Notice['status'], 'muted' | 'info' | 'success' | 'warning'> = {
  Draft: 'muted',
  Scheduled: 'info',
  Sent: 'success',
  Expired: 'muted',
  Cancelled: 'warning',
};

function displayDate(value: string): string {
  return new Date(value).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function NoticeCard({ notice, onPress }: { notice: Notice; onPress?: () => void }) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const tone = STATUS_TONE[notice.status];
  const toneColors = {
    muted: { background: Colors.surfaceSunken, text: Colors.inkSecondary },
    info: { background: Colors.infoSoft, text: Colors.info },
    success: { background: Colors.successSoft, text: Colors.success },
    warning: { background: Colors.warningSoft, text: Colors.warning },
  }[tone];
  const timing =
    notice.status === 'Scheduled' && notice.scheduledAt
      ? `Scheduled for ${displayDate(notice.scheduledAt)}`
      : notice.sentAt
        ? `Sent ${displayDate(notice.sentAt)}`
        : `Updated ${displayDate(notice.updatedAt)}`;

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.iconWrap}>
          <Ionicons name="megaphone" size={19} color={Colors.teal} />
        </View>
        <View style={styles.heading}>
          <Text style={styles.title} numberOfLines={2}>
            {notice.title || 'Untitled notice'}
          </Text>
          <Text style={styles.timing}>{timing}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: toneColors.background }]}>
          <Text style={[styles.badgeText, { color: toneColors.text }]}>{notice.status}</Text>
        </View>
      </View>
      {!!notice.body && (
        <Text style={styles.body} numberOfLines={3}>
          {notice.body}
        </Text>
      )}
      <View style={styles.metaRow}>
        <Ionicons name="business-outline" size={14} color={Colors.inkTertiary} />
        <Text style={styles.meta} numberOfLines={1}>
          {notice.targetBuildings.join(', ') || 'No towers selected'}
        </Text>
        {notice.recipientCount > 0 && (
          <Text style={styles.meta}>{notice.recipientCount} recipients</Text>
        )}
      </View>
      {notice.expiresAt && notice.status === 'Sent' && (
        <Text style={styles.expiry}>Visible until {displayDate(notice.expiresAt)}</Text>
      )}
    </Card>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    card: { gap: Spacing.sm },
    topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: Radius.md,
      backgroundColor: Colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heading: { flex: 1 },
    title: { ...Type.bodyMedium, color: Colors.ink },
    timing: { ...Type.tiny, color: Colors.inkTertiary, marginTop: 2 },
    badge: { borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
    badgeText: { ...Type.tiny },
    body: { ...Type.body, color: Colors.inkSecondary },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    meta: { ...Type.caption, color: Colors.inkTertiary, flexShrink: 1 },
    expiry: { ...Type.tiny, color: Colors.warning },
  });
