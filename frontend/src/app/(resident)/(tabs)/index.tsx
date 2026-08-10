import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AISummaryCard } from '@/components/ui/AISummaryCard';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { TicketCard } from '@/components/shared/TicketCard';
import { NoticeCard } from '@/components/shared/NoticeCard';
import { DashboardSearch } from '@/components/shared/DashboardSearch';
import { APARTMENTS } from '@/data/seed';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useTicketStore } from '@/store/ticketStore';
import { useNoticeStore } from '@/store/noticeStore';
import { fetchDashboardSummary } from '@/api/client';
import type { Resident } from '@/types';

export default function ResidentHomeScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const user = useAuthStore((s) => s.currentUser) as Resident;
  const token = useAuthStore((s) => s.token);
  const tickets = useTicketStore((s) => s.tickets);
  const refreshTickets = useTicketStore((s) => s.refreshTickets);
  const refreshNotifications = useNotificationStore((s) => s.refreshNotifications);
  const notices = useNoticeStore((s) => s.notices);
  const refreshNotices = useNoticeStore((s) => s.refreshNotices);

  const [searchQuery, setSearchQuery] = useState('');
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (token) refreshTickets(token).catch(() => {});
      if (token) refreshNotifications(token).catch(() => {});
      if (token) refreshNotices(token).catch(() => {});
      if (token) {
        setSummaryLoading(true);
        fetchDashboardSummary(token)
          .then(setAiSummary)
          .catch(() => setAiSummary(null))
          .finally(() => setSummaryLoading(false));
      }
    }, [token, refreshTickets, refreshNotifications, refreshNotices]),
  );

  const apartment = APARTMENTS.find((a) => a.apartmentId === user.apartmentId);

  const myTickets = useMemo(
    () =>
      tickets
        .filter((t) => t.residentId === user.userId)
        .sort((a, b) => new Date(b.dateOfRequest).getTime() - new Date(a.dateOfRequest).getTime()),
    [tickets, user.userId],
  );

  const needsAttention = myTickets.filter(
    (t) => t.status === 'Resolved' && t.residentRating == null,
  );

  return (
    <View style={styles.root}>
      <Screen edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable
              style={styles.headerProfile}
              onPress={() => router.push('/(resident)/(tabs)/profile')}
            >
              <Avatar name={user.name} color={user.avatarColor} size={44} />
              <View>
                <Text style={styles.greeting}>Hi, {user.name.split(' ')[0]}</Text>
                <Text style={styles.unit}>
                  {apartment ? `${apartment.unitNumber}, ${apartment.building}` : 'Resident'}
                </Text>
              </View>
            </Pressable>
          </View>
          <NotificationBell
            userId={user.userId}
            onPress={() => router.push('/(resident)/notifications')}
          />
        </View>

        <DashboardSearch query={searchQuery} onChangeQuery={setSearchQuery} />

        {!searchQuery.trim() && (
          <>
            <Pressable onPress={() => router.push('/(resident)/new-complaint')}>
              <Card style={styles.reportCard} elevated={false}>
                <View style={styles.reportIcon}>
                  <Ionicons name="camera" size={22} color={Colors.white} />
                </View>
                <View style={styles.reportText}>
                  <Text style={styles.reportTitle}>Report an Issue</Text>
                  <Text style={styles.reportSubtitle}>
                    Snap a photo or video — AI fills in the details
                  </Text>
                </View>
                <Ionicons name="arrow-forward-circle" size={26} color={Colors.white} />
              </Card>
            </Pressable>

            {notices.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Latest notices</Text>
                  <Text
                    style={styles.viewAll}
                    onPress={() => router.push('/(resident)/(tabs)/public')}
                  >
                    View all
                  </Text>
                </View>
                <NoticeCard
                  notice={notices[0]}
                  onPress={() => router.push(`/(resident)/notice/${notices[0].id}`)}
                />
              </View>
            )}

            {needsAttention.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Needs your review</Text>
                <View style={styles.list}>
                  {needsAttention.map((t) => (
                    <TicketCard
                      key={t.ticketId}
                      ticket={t}
                      subtitle="Verify the fix and rate the work"
                      onPress={() => router.push(`/(resident)/complaint/${t.ticketId}`)}
                      compact
                    />
                  ))}
                </View>
              </View>
            )}

            {summaryLoading ? (
              <AISummaryCard
                summary="Generating summary…"
                variant="resident"
                label="My Complaints Summary"
              />
            ) : aiSummary ? (
              <AISummaryCard summary={aiSummary} variant="resident" label="My Complaints Summary" />
            ) : null}

            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Recent Complaints</Text>
                {myTickets.length > 0 && (
                  <Text
                    style={styles.viewAll}
                    onPress={() => router.push('/(resident)/(tabs)/complaints')}
                  >
                    View all
                  </Text>
                )}
              </View>
              {myTickets.length === 0 ? (
                <EmptyState
                  icon="document-text-outline"
                  title="No complaints yet"
                  message="Report your first maintenance issue and our AI will help describe it."
                  actionLabel="Report an Issue"
                  onAction={() => router.push('/(resident)/new-complaint')}
                />
              ) : (
                <View style={styles.list}>
                  {myTickets.slice(0, 3).map((t) => (
                    <TicketCard
                      key={t.ticketId}
                      ticket={t}
                      onPress={() => router.push(`/(resident)/complaint/${t.ticketId}`)}
                      compact
                    />
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </Screen>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Request emergency service"
        style={({ pressed }) => [styles.emergencyFab, pressed && styles.chatFabPressed]}
        onPress={() => router.push('/(resident)/emergency' as Href)}
      >
        <Ionicons name="warning" size={24} color={Colors.white} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open AI assistant"
        style={({ pressed }) => [styles.chatFab, pressed && styles.chatFabPressed]}
        onPress={() => router.push('/(resident)/chat')}
      >
        <Ionicons name="sparkles" size={24} color={Colors.white} />
      </Pressable>
    </View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: Colors.surfaceMuted,
    },
    chatFab: {
      position: 'absolute',
      bottom: Spacing.xl,
      right: Spacing.lg,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: Colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
      zIndex: 10,
    },
    emergencyFab: {
      position: 'absolute',
      bottom: Spacing.xl + 68,
      right: Spacing.lg,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: Colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: Colors.danger,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
      zIndex: 10,
    },
    chatFabPressed: {
      opacity: 0.8,
      transform: [{ scale: 0.96 }],
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    headerProfile: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    greeting: {
      ...Type.title,
      color: Colors.ink,
    },
    unit: {
      ...Type.caption,
      color: Colors.inkSecondary,
    },
    reportCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: Colors.teal,
      borderWidth: 0,
    },
    reportIcon: {
      width: 44,
      height: 44,
      borderRadius: Radius.md,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    reportText: {
      flex: 1,
    },
    reportTitle: {
      ...Type.bodyMedium,
      color: Colors.white,
    },
    reportSubtitle: {
      ...Type.caption,
      color: 'rgba(255,255,255,0.85)',
      marginTop: 2,
    },
    section: {
      gap: Spacing.sm,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionTitle: {
      ...Type.subtitle,
      color: Colors.ink,
    },
    viewAll: {
      ...Type.captionBold,
      color: Colors.teal,
    },
    list: {
      gap: Spacing.sm,
    },
  });
