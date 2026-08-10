import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DashboardSearch } from '@/components/shared/DashboardSearch';
import { AISummaryCard } from '@/components/ui/AISummaryCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PriorityBadge, StatusBadge } from '@/components/ui/Badge';
import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { fetchDashboardSummary } from '@/api/client';
import { Radius, Spacing, Type } from '@/constants/theme';
import { CATEGORIES, getCategoryById } from '@/data/categories';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { usePublicServiceStore } from '@/store/publicServiceStore';
import { useTicketStore } from '@/store/ticketStore';
import type { Ticket } from '@/types';
import { timeAgo } from '@/utils/date';
import { isTicketOverdue } from '@/utils/overdue';

type Range = '7' | '30' | '90';

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_STATUSES = new Set(['Pending', 'Assigned', 'In_Progress']);
const URGENT_PRIORITIES = new Set(['High', 'Critical', 'Emergency']);

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function daysOpen(ticket: Ticket): number {
  return Math.max(1, Math.ceil((Date.now() - new Date(ticket.dateOfRequest).getTime()) / DAY_MS));
}

export default function ManagerAnalyticsScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const isDesktop = useIsDesktop();
  const user = useAuthStore((s) => s.currentUser)!;
  const token = useAuthStore((s) => s.token);
  const tickets = useTicketStore((s) => s.tickets);
  const refreshTickets = useTicketStore((s) => s.refreshTickets);
  const publicServices = usePublicServiceStore((s) => s.services);
  const refreshPublicServices = usePublicServiceStore((s) => s.refreshServices);

  const [searchQuery, setSearchQuery] = useState('');
  const [range, setRange] = useState<Range>('30');
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      refreshTickets(token);
      refreshPublicServices(token);
      setSummaryLoading(true);
      fetchDashboardSummary(token)
        .then(setAiSummary)
        .catch(() => setAiSummary(null))
        .finally(() => setSummaryLoading(false));
    }, [token, refreshTickets, refreshPublicServices]),
  );

  const openTickets = useMemo(
    () => tickets.filter((ticket) => OPEN_STATUSES.has(ticket.status)),
    [tickets],
  );

  const stats = useMemo(() => {
    const overdue = openTickets.filter(isTicketOverdue).length;
    const urgent = openTickets.filter((ticket) => URGENT_PRIORITIES.has(ticket.priority)).length;
    const unassigned = openTickets.filter((ticket) => !ticket.workerId).length;
    const resolutionHours = tickets
      .filter((ticket) => ticket.dateOfResolution)
      .map(
        (ticket) =>
          (new Date(ticket.dateOfResolution!).getTime() -
            new Date(ticket.dateOfRequest).getTime()) /
          36e5,
      );
    const rated = tickets.filter((ticket) => ticket.residentRating != null);

    return {
      overdue,
      urgent,
      unassigned,
      medianResolution: median(resolutionHours),
      rating:
        rated.length > 0
          ? rated.reduce((sum, ticket) => sum + (ticket.residentRating ?? 0), 0) / rated.length
          : null,
      ratedCount: rated.length,
    };
  }, [tickets, openTickets]);

  const attentionTickets = useMemo(
    () =>
      [...openTickets]
        .sort((a, b) => {
          const score = (ticket: Ticket) =>
            (isTicketOverdue(ticket) ? 100 : 0) +
            (ticket.priority === 'Emergency'
              ? 50
              : ticket.priority === 'Critical'
                ? 40
                : ticket.priority === 'High'
                  ? 30
                  : 0) +
            (!ticket.workerId ? 20 : 0) +
            daysOpen(ticket);
          return score(b) - score(a);
        })
        .slice(0, 4),
    [openTickets],
  );

  const categoryInsights = useMemo(() => {
    const rows = CATEGORIES.map((category) => {
      const categoryTickets = openTickets.filter(
        (ticket) => ticket.categoryId === category.categoryId,
      );
      return {
        category,
        open: categoryTickets.length,
        overdue: categoryTickets.filter(isTicketOverdue).length,
        oldest: categoryTickets.length ? Math.max(...categoryTickets.map(daysOpen)) : 0,
      };
    })
      .filter((row) => row.open > 0)
      .sort((a, b) => b.overdue - a.overdue || b.open - a.open || b.oldest - a.oldest);
    const maxOpen = Math.max(1, ...rows.map((row) => row.open));
    return rows.map((row) => ({
      ...row,
      width: `${Math.max(12, (row.open / maxOpen) * 100)}%` as const,
    }));
  }, [openTickets]);

  const trend = useMemo(() => {
    const days = Number(range);
    const bucketCount = range === '7' ? 7 : range === '30' ? 4 : 6;
    const bucketDays = days / bucketCount;
    const now = Date.now();
    const buckets = Array.from({ length: bucketCount }, (_, index) => {
      const start = now - (days - index * bucketDays) * DAY_MS;
      const end = start + bucketDays * DAY_MS;
      const opened = tickets.filter((ticket) => {
        const created = new Date(ticket.dateOfRequest).getTime();
        return created >= start && created < end;
      }).length;
      const resolved = tickets.filter((ticket) => {
        if (!ticket.dateOfResolution) return false;
        const completed = new Date(ticket.dateOfResolution).getTime();
        return completed >= start && completed < end;
      }).length;
      return {
        label: range === '7' ? `${index + 1}` : `W${index + 1}`,
        opened,
        resolved,
      };
    });
    return {
      buckets,
      opened: buckets.reduce((sum, bucket) => sum + bucket.opened, 0),
      resolved: buckets.reduce((sum, bucket) => sum + bucket.resolved, 0),
      max: Math.max(1, ...buckets.flatMap((bucket) => [bucket.opened, bucket.resolved])),
    };
  }, [tickets, range]);

  const publicStats = useMemo(
    () => ({
      open: publicServices.filter(
        (service) => service.status !== 'Resolved' && service.status !== 'Merged',
      ).length,
      resolved: publicServices.filter((service) => service.status === 'Resolved').length,
      reports: publicServices.reduce((sum, service) => sum + service.reports.length, 0),
    }),
    [publicServices],
  );

  const openInsights = (tab: 'backlog' | 'aging' | 'categories' | 'demand') =>
    router.push({ pathname: '/(manager)/insights', params: { tab } });

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Operations overview</Text>
          <Text style={styles.subtitle}>
            Good to see you, {user.name.split(' ')[0]}. Here&rsquo;s what needs attention.
          </Text>
        </View>
        <Button
          label={isDesktop ? 'Explore analytics' : 'Explore'}
          icon="bar-chart-outline"
          iconPosition="right"
          size="sm"
          variant="secondary"
          onPress={() => openInsights('backlog')}
        />
      </View>

      <DashboardSearch query={searchQuery} onChangeQuery={setSearchQuery} />

      {!searchQuery.trim() && (
        <>
          <View style={styles.metricsGrid}>
            <MetricCard
              icon="file-tray-full-outline"
              label="Open complaints"
              value={openTickets.length}
              detail={`${stats.urgent} high priority`}
              tone={stats.urgent > 0 ? Colors.warning : Colors.primary}
              onPress={() => openInsights('backlog')}
            />
            <MetricCard
              icon="alert-circle-outline"
              label="Overdue"
              value={stats.overdue}
              detail={stats.overdue ? 'Past SLA · act now' : 'All within SLA'}
              tone={stats.overdue ? Colors.danger : Colors.success}
              onPress={() => openInsights('aging')}
            />
            <MetricCard
              icon="person-add-outline"
              label="Unassigned"
              value={stats.unassigned}
              detail={stats.unassigned ? 'Waiting for an owner' : 'Every issue has an owner'}
              tone={stats.unassigned ? Colors.warning : Colors.success}
              onPress={() => openInsights('aging')}
            />
            <MetricCard
              icon="timer-outline"
              label="Median resolution"
              value={stats.medianResolution == null ? '—' : `${stats.medianResolution.toFixed(1)}h`}
              detail={
                stats.medianResolution == null
                  ? 'No resolved complaints yet'
                  : 'Across resolved complaints'
              }
              tone={Colors.info}
              onPress={() => openInsights('categories')}
            />
          </View>

          <View style={isDesktop ? styles.twoColumn : styles.stack}>
            <Card style={[styles.section, styles.flexCard]}>
              <SectionHeader
                title="Needs attention"
                subtitle="Prioritized by SLA, urgency and assignment"
                action="View history"
                onAction={() => router.push('/(manager)/(tabs)/history')}
              />
              {attentionTickets.length ? (
                <View style={styles.attentionList}>
                  {attentionTickets.map((ticket) => (
                    <Pressable
                      key={ticket.ticketId}
                      onPress={() => router.push(`/(manager)/complaint/${ticket.ticketId}`)}
                      style={({ pressed }) => [styles.attentionRow, pressed && styles.pressed]}
                    >
                      <View
                        style={[
                          styles.attentionIcon,
                          {
                            backgroundColor: isTicketOverdue(ticket)
                              ? Colors.dangerSoft
                              : Colors.warningSoft,
                          },
                        ]}
                      >
                        <Ionicons
                          name={
                            isTicketOverdue(ticket)
                              ? 'alert-circle'
                              : getCategoryById(ticket.categoryId).icon
                          }
                          size={18}
                          color={isTicketOverdue(ticket) ? Colors.danger : Colors.warning}
                        />
                      </View>
                      <View style={styles.attentionBody}>
                        <Text style={styles.itemTitle} numberOfLines={1}>
                          {ticket.title}
                        </Text>
                        <Text style={styles.itemMeta} numberOfLines={1}>
                          {getCategoryById(ticket.categoryId).categoryName} · {daysOpen(ticket)}d
                          open
                          {!ticket.workerId ? ' · Unassigned' : ''}
                        </Text>
                      </View>
                      <View style={styles.attentionBadges}>
                        {isTicketOverdue(ticket) && <Text style={styles.overdueText}>Overdue</Text>}
                        <PriorityBadge priority={ticket.priority} />
                      </View>
                      <Ionicons name="chevron-forward" size={17} color={Colors.inkTertiary} />
                    </Pressable>
                  ))}
                </View>
              ) : (
                <EmptyMessage
                  icon="checkmark-circle"
                  text="Nothing needs immediate attention."
                  color={Colors.success}
                />
              )}
            </Card>

            <Card style={[styles.section, styles.flexCard]}>
              <SectionHeader
                title="Incoming vs completed"
                subtitle={`Activity in the last ${range} days`}
                action="Full trend"
                onAction={() => openInsights('backlog')}
              />
              <SegmentedControl
                options={[
                  { label: '7D', value: '7' },
                  { label: '30D', value: '30' },
                  { label: '90D', value: '90' },
                ]}
                value={range}
                onChange={setRange}
              />
              <View style={styles.trendSummary}>
                <View>
                  <Text style={styles.trendValue}>{trend.opened}</Text>
                  <View style={styles.legendLabel}>
                    <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
                    <Text style={styles.itemMeta}>Opened</Text>
                  </View>
                </View>
                <View>
                  <Text style={styles.trendValue}>{trend.resolved}</Text>
                  <View style={styles.legendLabel}>
                    <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
                    <Text style={styles.itemMeta}>Completed</Text>
                  </View>
                </View>
                <View style={styles.flowSummary}>
                  <Text
                    style={[
                      styles.flowValue,
                      { color: trend.opened > trend.resolved ? Colors.warning : Colors.success },
                    ]}
                  >
                    {trend.opened - trend.resolved > 0 ? '+' : ''}
                    {trend.opened - trend.resolved}
                  </Text>
                  <Text style={styles.itemMeta}>backlog change</Text>
                </View>
              </View>
              <View style={styles.trendChart}>
                {trend.buckets.map((bucket) => (
                  <View key={bucket.label} style={styles.trendBucket}>
                    <View style={styles.trendBars}>
                      <View
                        style={[
                          styles.trendBar,
                          {
                            height: Math.max(3, (bucket.opened / trend.max) * 72),
                            backgroundColor: Colors.primary,
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.trendBar,
                          {
                            height: Math.max(3, (bucket.resolved / trend.max) * 72),
                            backgroundColor: Colors.success,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.bucketLabel}>{bucket.label}</Text>
                  </View>
                ))}
              </View>
            </Card>
          </View>

          {summaryLoading ? (
            <AISummaryCard
              summary="Reviewing the latest operations data…"
              variant="manager"
              label="Community Digest"
            />
          ) : aiSummary ? (
            <AISummaryCard summary={aiSummary} variant="manager" label="Community Digest" />
          ) : null}

          <View style={isDesktop ? styles.twoColumn : styles.stack}>
            <Card style={[styles.section, styles.flexCard]}>
              <SectionHeader
                title="Open work by category"
                subtitle="Risk and age, not just volume"
                action="Explore"
                onAction={() => openInsights('categories')}
              />
              {categoryInsights.length ? (
                categoryInsights.map((row) => (
                  <View key={row.category.categoryId} style={styles.categoryRow}>
                    <View style={styles.categoryTop}>
                      <View style={styles.categoryNameWrap}>
                        <Ionicons name={row.category.icon} size={17} color={Colors.teal} />
                        <Text style={styles.categoryName}>{row.category.categoryName}</Text>
                      </View>
                      <Text style={styles.categoryCount}>{row.open} open</Text>
                    </View>
                    <View style={styles.categoryTrack}>
                      <View
                        style={[
                          styles.categoryFill,
                          {
                            width: row.width,
                            backgroundColor: row.overdue ? Colors.danger : Colors.teal,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.itemMeta, row.overdue > 0 && { color: Colors.danger }]}>
                      {row.overdue ? `${row.overdue} overdue · ` : ''}oldest open for {row.oldest}d
                    </Text>
                  </View>
                ))
              ) : (
                <EmptyMessage
                  icon="checkmark-circle"
                  text="No open complaint categories."
                  color={Colors.success}
                />
              )}
            </Card>

            <Card style={[styles.section, styles.flexCard]}>
              <SectionHeader
                title="Public services"
                subtitle="Shared issues affecting the community"
              />
              <View style={styles.publicSummary}>
                <SmallMetric value={publicStats.open} label="Open" />
                <SmallMetric value={publicStats.resolved} label="Resolved" />
                <SmallMetric value={publicStats.reports} label="Resident reports" />
              </View>
              <View style={styles.publicList}>
                {publicServices.slice(0, 3).map((service) => (
                  <Pressable
                    key={service.id}
                    onPress={() => router.push(`/(manager)/public/${service.id}`)}
                    style={({ pressed }) => [styles.publicRow, pressed && styles.pressed]}
                  >
                    <View style={styles.publicBody}>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {service.title}
                      </Text>
                      <Text style={styles.itemMeta} numberOfLines={1}>
                        {service.location} · {timeAgo(service.createdAt)} · {service.reports.length}{' '}
                        report{service.reports.length === 1 ? '' : 's'}
                      </Text>
                    </View>
                    <StatusBadge status={service.status} />
                    <Ionicons name="chevron-forward" size={17} color={Colors.inkTertiary} />
                  </Pressable>
                ))}
                {!publicServices.length && (
                  <Text style={styles.empty}>No public service issues yet.</Text>
                )}
              </View>
            </Card>
          </View>

          <Card style={styles.satisfactionCard}>
            <View
              style={[
                styles.satisfactionIcon,
                {
                  backgroundColor: stats.rating == null ? Colors.surfaceSunken : Colors.warningSoft,
                },
              ]}
            >
              <Ionicons
                name="star"
                size={20}
                color={stats.rating == null ? Colors.inkTertiary : Colors.warning}
              />
            </View>
            <View style={styles.satisfactionBody}>
              <Text style={styles.sectionTitle}>Resident satisfaction</Text>
              <Text style={styles.itemMeta}>
                {stats.rating == null
                  ? 'No resident ratings yet—scores will appear after feedback is submitted.'
                  : `Based on ${stats.ratedCount} completed complaint${stats.ratedCount === 1 ? '' : 's'}.`}
              </Text>
            </View>
            <Text style={styles.satisfactionValue}>
              {stats.rating == null ? 'No data' : `${stats.rating.toFixed(1)} / 5`}
            </Text>
          </Card>
        </>
      )}
    </Screen>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  detail: string;
  tone: string;
  onPress?: () => void;
}) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  return (
    <Card style={styles.metricCard} onPress={onPress}>
      <View style={[styles.metricIcon, { backgroundColor: `${tone}16` }]}>
        <Ionicons name={icon} size={18} color={tone} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricDetailRow}>
        <Text style={[styles.metricDetail, { color: tone }]} numberOfLines={1}>
          {detail}
        </Text>
        {onPress && <Ionicons name="arrow-forward" size={13} color={tone} />}
      </View>
    </Card>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle: string;
  action?: string;
  onAction?: () => void;
}) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
      {action && (
        <Pressable onPress={onAction}>
          <Text style={styles.textAction}>{action} →</Text>
        </Pressable>
      )}
    </View>
  );
}

function SmallMetric({ value, label }: { value: number; label: string }) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  return (
    <View style={styles.smallMetric}>
      <Text style={styles.smallMetricValue}>{value}</Text>
      <Text style={styles.itemMeta}>{label}</Text>
    </View>
  );
}

function EmptyMessage({
  icon,
  text,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  color: string;
}) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  return (
    <View style={styles.emptyMessage}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={styles.itemMeta}>{text}</Text>
    </View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    headerText: { gap: 2, flex: 1 },
    title: { ...Type.title, color: Colors.ink },
    subtitle: { ...Type.caption, color: Colors.inkSecondary },
    metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    metricCard: { flex: 1, minWidth: 180, gap: 3 },
    metricIcon: {
      width: 34,
      height: 34,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 3,
    },
    metricValue: { ...Type.title, color: Colors.ink },
    metricLabel: { ...Type.caption, color: Colors.inkSecondary },
    metricDetail: { ...Type.tiny, marginTop: 2, flexShrink: 1 },
    metricDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    twoColumn: { flexDirection: 'row', alignItems: 'stretch', gap: Spacing.md },
    stack: { gap: Spacing.md },
    flexCard: { flex: 1, minWidth: 0 },
    section: { gap: Spacing.md },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    sectionHeading: { flex: 1, gap: 2 },
    sectionTitle: { ...Type.subtitle, color: Colors.ink },
    sectionSubtitle: { ...Type.tiny, color: Colors.inkTertiary },
    textAction: { ...Type.captionBold, color: Colors.teal },
    attentionList: { gap: 0 },
    attentionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
    },
    attentionIcon: {
      width: 34,
      height: 34,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    attentionBody: { flex: 1, minWidth: 0, gap: 2 },
    itemTitle: { ...Type.bodyMedium, color: Colors.ink },
    itemMeta: { ...Type.tiny, color: Colors.inkSecondary },
    attentionBadges: { alignItems: 'flex-end', gap: 4 },
    overdueText: { ...Type.tiny, color: Colors.danger },
    pressed: { opacity: 0.65 },
    trendSummary: { flexDirection: 'row', gap: Spacing.xl, alignItems: 'flex-end' },
    trendValue: { ...Type.title, color: Colors.ink },
    legendLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 7, height: 7, borderRadius: 4 },
    flowSummary: { marginLeft: 'auto', alignItems: 'flex-end' },
    flowValue: { ...Type.subtitle },
    trendChart: {
      height: 98,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
      paddingHorizontal: Spacing.xs,
    },
    trendBucket: { flex: 1, alignItems: 'center', gap: 5 },
    trendBars: { height: 76, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
    trendBar: { width: 10, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
    bucketLabel: { ...Type.tiny, color: Colors.inkTertiary },
    categoryRow: { gap: 6, paddingTop: Spacing.xs },
    categoryTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    categoryNameWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flex: 1 },
    categoryName: { ...Type.captionBold, color: Colors.ink },
    categoryCount: { ...Type.captionBold, color: Colors.inkSecondary },
    categoryTrack: {
      height: 6,
      backgroundColor: Colors.surfaceSunken,
      borderRadius: Radius.pill,
      overflow: 'hidden',
    },
    categoryFill: { height: '100%', borderRadius: Radius.pill },
    publicSummary: {
      flexDirection: 'row',
      backgroundColor: Colors.surfaceSunken,
      borderRadius: Radius.md,
      paddingVertical: Spacing.sm,
    },
    smallMetric: { flex: 1, alignItems: 'center', gap: 2 },
    smallMetricValue: { ...Type.subtitle, color: Colors.primary },
    publicList: { gap: 0 },
    publicRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
    },
    publicBody: { flex: 1, minWidth: 0, gap: 3 },
    empty: { ...Type.caption, color: Colors.inkTertiary },
    emptyMessage: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      minHeight: 120,
    },
    satisfactionCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    satisfactionIcon: {
      width: 40,
      height: 40,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    satisfactionBody: { flex: 1, gap: 2 },
    satisfactionValue: { ...Type.subtitle, color: Colors.ink },
  });
