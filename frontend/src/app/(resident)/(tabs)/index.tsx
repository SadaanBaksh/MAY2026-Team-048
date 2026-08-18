import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NotificationBell } from '@/components/shared/NotificationBell';
import { Avatar } from '@/components/ui/Avatar';
import { Screen } from '@/components/ui/Screen';
import { FontFamily, Radius, Spacing, Type } from '@/constants/theme';
import { getCategoryById } from '@/data/categories';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useNoticeStore } from '@/store/noticeStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useTicketStore } from '@/store/ticketStore';
import type { Resident, Ticket } from '@/types';
import { timeAgo } from '@/utils/date';

const ACTIVE_STATUSES: Ticket['status'][] = ['Assigned', 'In_Progress'];

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

  useFocusRefresh(token, refreshTickets, refreshNotifications, refreshNotices);

  const myTickets = useMemo(
    () =>
      tickets
        .filter((ticket) => ticket.residentId === user.userId)
        .sort((a, b) => new Date(b.dateOfRequest).getTime() - new Date(a.dateOfRequest).getTime()),
    [tickets, user.userId],
  );

  const needsAttention = myTickets.filter(
    (ticket) => ticket.status === 'Resolved' && ticket.residentRating == null,
  );
  const featuredTicket =
    myTickets.find((ticket) => ticket.status === 'Pending') ??
    myTickets.find((ticket) => ACTIVE_STATUSES.includes(ticket.status)) ??
    myTickets[0];
  const pendingCount = myTickets.filter((ticket) => ticket.status === 'Pending').length;
  const activeCount = myTickets.filter((ticket) => ACTIVE_STATUSES.includes(ticket.status)).length;
  const closedCount = myTickets.filter((ticket) =>
    ['Resolved', 'Closed'].includes(ticket.status),
  ).length;
  const latestNotice = notices[0];

  return (
    <View style={styles.root}>
      <Screen edges={['top']} contentStyle={styles.screenContent}>
        <View style={styles.header}>
          <Pressable
            style={styles.profileButton}
            onPress={() => router.push('/(resident)/(tabs)/profile')}
          >
            <Avatar name={user.name} color={user.avatarColor} size={54} uri={user.avatarUri} />
            <View style={styles.headerCopy}>
              <Text style={styles.greeting}>Hi, {user.name.split(' ')[0]}</Text>
              <Text style={styles.unit}>
                {user.unitNumber && user.building
                  ? `${user.unitNumber} · ${user.building}`
                  : 'Resident'}
              </Text>
            </View>
          </Pressable>
          <NotificationBell
            userId={user.userId}
            onPress={() => router.push('/(resident)/notifications')}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Report an issue"
          onPress={() => router.push('/(resident)/new-complaint')}
          style={({ pressed }) => [styles.reportButton, pressed && styles.pressed]}
        >
          <LinearGradient
            colors={[Colors.teal, '#087B70']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.reportCard}
          >
            <View style={styles.reportIcon}>
              <Ionicons name="camera" size={26} color={Colors.white} />
            </View>
            <View style={styles.reportCopy}>
              <Text style={styles.reportTitle}>Report an issue</Text>
              <Text style={styles.reportSubtitle}>
                Photo, video or text — AI helps fill in the details
              </Text>
            </View>
            <View style={styles.reportArrow}>
              <Ionicons name="arrow-forward" size={22} color={Colors.teal} />
            </View>
          </LinearGradient>
        </Pressable>

        {needsAttention.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Needs your review</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{needsAttention.length}</Text>
              </View>
            </View>
            <View style={styles.reviewList}>
              {needsAttention.slice(0, 3).map((ticket, index) => {
                const category = getCategoryById(ticket.categoryId);
                return (
                  <Pressable
                    key={ticket.ticketId}
                    onPress={() => router.push(`/(resident)/complaint/${ticket.ticketId}`)}
                    style={({ pressed }) => [
                      styles.reviewRow,
                      index > 0 && styles.reviewRowBorder,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.ticketIcon}>
                      <Ionicons name={category.icon} size={24} color={Colors.teal} />
                    </View>
                    <View style={styles.reviewCopy}>
                      <Text style={styles.reviewTitle} numberOfLines={2}>
                        {ticket.title}
                      </Text>
                      <View style={styles.reviewMetaRow}>
                        <View style={styles.resolvedDot} />
                        <Text style={styles.reviewMeta}>
                          Resolved · {timeAgo(ticket.dateOfRequest)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.reviewAction}>
                      <Text style={styles.reviewActionText}>Review</Text>
                      <Ionicons name="arrow-forward" size={19} color={Colors.teal} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeadingBetween}>
            <Text style={styles.sectionTitle}>Your complaints</Text>
            <Pressable hitSlop={8} onPress={() => router.push('/(resident)/(tabs)/complaints')}>
              <Text style={styles.viewAll}>View all</Text>
            </Pressable>
          </View>

          <View style={styles.statsRow}>
            <StatCard
              count={pendingCount}
              label="Pending"
              icon="time-outline"
              color={Colors.warning}
              background={`${Colors.warning}0D`}
              neutralColor={Colors.inkTertiary}
              neutralBackground={Colors.surfaceSunken}
              neutralBorder={Colors.border}
              styles={styles}
            />
            <StatCard
              count={activeCount}
              label="Active"
              icon="pulse-outline"
              color={Colors.info}
              background={`${Colors.info}0D`}
              neutralColor={Colors.inkTertiary}
              neutralBackground={Colors.surfaceSunken}
              neutralBorder={Colors.border}
              styles={styles}
            />
            <StatCard
              count={closedCount}
              label="Closed"
              icon="checkmark-circle-outline"
              color={Colors.teal}
              background={`${Colors.teal}0D`}
              neutralColor={Colors.inkTertiary}
              neutralBackground={Colors.surfaceSunken}
              neutralBorder={Colors.border}
              styles={styles}
            />
          </View>

          {featuredTicket ? (
            <Pressable
              onPress={() => router.push(`/(resident)/complaint/${featuredTicket.ticketId}`)}
              style={({ pressed }) => [styles.featuredTicket, pressed && styles.pressed]}
            >
              <View style={[styles.ticketIcon, styles.featuredIcon]}>
                <Ionicons
                  name={getCategoryById(featuredTicket.categoryId).icon}
                  size={23}
                  color={featuredTicket.status === 'Pending' ? Colors.warning : Colors.teal}
                />
              </View>
              <View style={styles.featuredCopy}>
                <Text style={styles.featuredTitle} numberOfLines={1}>
                  {featuredTicket.title}
                </Text>
                <View style={styles.featuredMetaRow}>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor:
                          featuredTicket.status === 'Pending' ? Colors.warning : Colors.info,
                      },
                    ]}
                  />
                  <Text style={styles.featuredMeta}>
                    {featuredTicket.status.replace('_', ' ')} ·{' '}
                    {getCategoryById(featuredTicket.categoryId).categoryName}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={22} color={Colors.inkTertiary} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push('/(resident)/new-complaint')}
              style={styles.emptyComplaints}
            >
              <Text style={styles.emptyText}>No complaints yet</Text>
              <Text style={styles.emptyAction}>Report your first issue</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeadingBetween}>
            <Text style={styles.sectionTitle}>Community</Text>
            <Pressable hitSlop={8} onPress={() => router.push('/(resident)/(tabs)/public')}>
              <Text style={styles.viewAll}>View all</Text>
            </Pressable>
          </View>
          {latestNotice ? (
            <Pressable
              onPress={() => router.push(`/(resident)/notice/${latestNotice.id}`)}
              style={({ pressed }) => [styles.notice, pressed && styles.pressed]}
            >
              <View style={styles.noticeIcon}>
                <Ionicons name="megaphone" size={22} color={Colors.teal} />
              </View>
              <View style={styles.noticeCopy}>
                <Text style={styles.noticeTitle} numberOfLines={1}>
                  {latestNotice.title}
                </Text>
                <View style={styles.noticeAction}>
                  <Text style={styles.noticeActionText}>View notice</Text>
                  <Ionicons name="arrow-forward" size={17} color={Colors.teal} />
                </View>
              </View>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push('/(resident)/(tabs)/public')}
              style={({ pressed }) => [
                styles.notice,
                styles.noticeEmpty,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.noticeIcon, styles.noticeIconEmpty]}>
                <Ionicons name="megaphone-outline" size={22} color={Colors.inkTertiary} />
              </View>
              <View style={styles.noticeCopy}>
                <Text style={styles.noticeTitle}>No new community notices</Text>
                <Text style={styles.noticeEmptyText}>You’re all caught up</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.inkTertiary} />
            </Pressable>
          )}
        </View>
      </Screen>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Request emergency service"
        style={({ pressed }) => [styles.emergencyFab, pressed && styles.fabPressed]}
        onPress={() => router.push('/(resident)/emergency' as Href)}
      >
        <Ionicons name="warning" size={24} color={Colors.white} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open AI assistant"
        style={({ pressed }) => [styles.chatFab, pressed && styles.fabPressed]}
        onPress={() => router.push('/(resident)/chat')}
      >
        <Ionicons name="sparkles" size={24} color={Colors.white} />
      </Pressable>
    </View>
  );
}

function useFocusRefresh(
  token: string | null,
  refreshTickets: (token: string) => Promise<unknown>,
  refreshNotifications: (token: string) => Promise<unknown>,
  refreshNotices: (token: string) => Promise<unknown>,
) {
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      refreshTickets(token).catch(() => {});
      refreshNotifications(token).catch(() => {});
      refreshNotices(token).catch(() => {});
    }, [token, refreshTickets, refreshNotifications, refreshNotices]),
  );
}

type HomeStyles = ReturnType<typeof getStyles>;

function StatCard({
  count,
  label,
  icon,
  color,
  background,
  neutralColor,
  neutralBackground,
  neutralBorder,
  styles,
}: {
  count: number;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  background: string;
  neutralColor: string;
  neutralBackground: string;
  neutralBorder: string;
  styles: HomeStyles;
}) {
  const isEmpty = count === 0;
  const displayColor = isEmpty ? neutralColor : color;
  return (
    <View
      style={[
        styles.statCard,
        {
          borderColor: isEmpty ? neutralBorder : `${color}55`,
          backgroundColor: isEmpty ? neutralBackground : background,
        },
      ]}
    >
      <Ionicons name={icon} size={22} color={displayColor} />
      <View>
        <Text style={[styles.statCount, isEmpty && { color: neutralColor }]}>{count}</Text>
        <Text style={[styles.statLabel, isEmpty && { color: neutralColor }]}>{label}</Text>
      </View>
    </View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.surfaceMuted },
    chatFab: {
      position: 'absolute',
      right: Spacing.lg,
      bottom: Spacing.xl,
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
      right: Spacing.lg,
      bottom: Spacing.xl + 68,
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
    fabPressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
    screenContent: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xxl,
    },
    pressed: { opacity: 0.78 },
    reportButton: { marginBottom: 2 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.xs,
    },
    profileButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
    headerCopy: { flex: 1 },
    greeting: { fontSize: 25, lineHeight: 31, fontFamily: FontFamily.bold, color: Colors.ink },
    unit: { ...Type.body, color: Colors.inkSecondary, marginTop: 1 },
    reportCard: {
      minHeight: 102,
      borderRadius: Radius.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    reportIcon: {
      width: 54,
      height: 54,
      borderRadius: 27,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    reportCopy: { flex: 1 },
    reportTitle: { ...Type.title, color: Colors.white },
    reportSubtitle: { ...Type.caption, color: 'rgba(255,255,255,0.9)', marginTop: 3 },
    reportArrow: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.white,
    },
    sectionCard: {
      borderRadius: Radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
      padding: Spacing.md,
      gap: Spacing.md,
      marginBottom: 2,
    },
    sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    sectionHeadingBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitle: { ...Type.title, color: Colors.ink },
    countBadge: {
      minWidth: 28,
      height: 28,
      borderRadius: 14,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.successSoft,
    },
    countBadgeText: { ...Type.bodyMedium, color: Colors.teal },
    reviewList: { marginTop: -Spacing.xs },
    reviewRow: {
      minHeight: 74,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
    },
    reviewRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
    ticketIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.primarySoft,
    },
    reviewCopy: { flex: 1, gap: 4 },
    reviewTitle: { ...Type.bodyMedium, color: Colors.ink },
    reviewMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    resolvedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
    reviewMeta: { ...Type.caption, color: Colors.inkSecondary },
    reviewAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    reviewActionText: { ...Type.bodyMedium, color: Colors.teal },
    viewAll: { ...Type.bodyMedium, color: Colors.teal },
    statsRow: { flexDirection: 'row', gap: Spacing.xs },
    statCard: {
      flex: 1,
      minHeight: 64,
      borderRadius: Radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.xs,
    },
    statCount: { ...Type.subtitle, color: Colors.ink, lineHeight: 19 },
    statLabel: { ...Type.tiny, color: Colors.inkSecondary },
    featuredTicket: {
      minHeight: 72,
      borderRadius: Radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      padding: Spacing.sm,
    },
    featuredIcon: { backgroundColor: `${Colors.warning}12` },
    featuredCopy: { flex: 1, gap: 5 },
    featuredTitle: { ...Type.subtitle, color: Colors.ink },
    featuredMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    featuredMeta: { ...Type.caption, color: Colors.inkTertiary, flexShrink: 1 },
    emptyComplaints: {
      borderRadius: Radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
      padding: Spacing.md,
      alignItems: 'center',
    },
    emptyText: { ...Type.bodyMedium, color: Colors.ink },
    emptyAction: { ...Type.caption, color: Colors.teal, marginTop: 3 },
    notice: {
      minHeight: 76,
      borderRadius: Radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${Colors.teal}40`,
      backgroundColor: `${Colors.teal}08`,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      padding: Spacing.sm,
    },
    noticeIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.successSoft,
    },
    noticeCopy: { flex: 1, gap: 5 },
    noticeTitle: { ...Type.subtitle, color: Colors.ink },
    noticeAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    noticeActionText: { ...Type.captionBold, color: Colors.teal },
    noticeEmpty: { borderColor: Colors.border, backgroundColor: Colors.surfaceMuted },
    noticeIconEmpty: { backgroundColor: Colors.surfaceSunken },
    noticeEmptyText: { ...Type.caption, color: Colors.inkTertiary },
  });
