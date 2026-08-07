import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { AISummaryCard } from '@/components/ui/AISummaryCard';
import { Card } from '@/components/ui/Card';
import { DonutChart } from '@/components/ui/DonutChart';
import { BarChart } from '@/components/ui/BarChart';
import { Screen } from '@/components/ui/Screen';
import { StatCard } from '@/components/ui/StatCard';
import { BurgerMenu } from '@/components/shared/BurgerMenu';
import { DashboardSearch } from '@/components/shared/DashboardSearch';
import { PublicServiceCard } from '@/components/shared/PublicServiceCard';
import { CATEGORIES } from '@/data/categories';
import { Spacing, Type } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useTicketStore } from '@/store/ticketStore';
import { usePublicServiceStore } from '@/store/publicServiceStore';
import { isTicketOverdue } from '@/utils/overdue';
import { fetchDashboardSummary } from '@/api/client';

const CHART_PALETTE = [
  '#0c2d35',
  '#7A3FC2',
  '#EE9A3A',
  '#1C9C6E',
  '#DB8A1B',
  '#2E7BC2',
  '#B62B4D',
  '#C2740F',
  '#5B5F6D',
];

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
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (token) refreshTickets(token);
      if (token) refreshPublicServices(token);
      if (token) {
        setSummaryLoading(true);
        fetchDashboardSummary(token)
          .then(setAiSummary)
          .catch(() => setAiSummary(null))
          .finally(() => setSummaryLoading(false));
      }
    }, [token, refreshTickets, refreshPublicServices]),
  );

  const stats = useMemo(() => {
    const total = tickets.length;
    const pending = tickets.filter((t) => t.status === 'Pending').length;
    const overdue = tickets.filter(isTicketOverdue).length;
    const emergencyHandled = tickets.filter(
      (t) => t.priority === 'Emergency' && (t.status === 'Resolved' || t.status === 'Closed'),
    ).length;
    const resolvedTickets = tickets.filter((t) => t.dateOfResolution);
    const avgResolutionHours = resolvedTickets.length
      ? resolvedTickets.reduce((sum, t) => {
          const diff =
            new Date(t.dateOfResolution!).getTime() - new Date(t.dateOfRequest).getTime();
          return sum + diff / (1000 * 60 * 60);
        }, 0) / resolvedTickets.length
      : 0;
    const ratedTickets = tickets.filter((t) => t.residentRating != null);
    const avgRating = ratedTickets.length
      ? ratedTickets.reduce((sum, t) => sum + (t.residentRating ?? 0), 0) / ratedTickets.length
      : 0;

    return {
      total,
      pending,
      overdue,
      emergencyHandled,
      avgResolutionHours,
      avgRating,
      ratedCount: ratedTickets.length,
    };
  }, [tickets]);

  const categoryData = useMemo(
    () =>
      CATEGORIES.map((cat, i) => ({
        label: cat.categoryName,
        value: tickets.filter((t) => t.categoryId === cat.categoryId).length,
        color: CHART_PALETTE[i % CHART_PALETTE.length],
      })).filter((d) => d.value > 0),
    [tickets],
  );

  const statusData = useMemo(
    () => [
      {
        label: 'Pending',
        value: tickets.filter((t) => t.status === 'Pending').length,
        color: Colors.warning,
      },
      {
        label: 'Assigned',
        value: tickets.filter((t) => t.status === 'Assigned').length,
        color: Colors.info,
      },
      {
        label: 'In Progress',
        value: tickets.filter((t) => t.status === 'In_Progress').length,
        color: '#7A3FC2',
      },
      {
        label: 'Resolved',
        value: tickets.filter((t) => t.status === 'Resolved').length,
        color: Colors.success,
      },
      {
        label: 'Closed',
        value: tickets.filter((t) => t.status === 'Closed').length,
        color: Colors.inkTertiary,
      },
    ],
    [tickets, Colors],
  );

  const publicStats = useMemo(
    () => ({
      total: publicServices.length,
      open: publicServices.filter((service) => service.status !== 'Resolved').length,
      resolved: publicServices.filter((service) => service.status === 'Resolved').length,
      mergedReports: publicServices.reduce(
        (sum, service) => sum + Math.max(0, service.reports.length - 1),
        0,
      ),
    }),
    [publicServices],
  );

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        {Platform.OS !== 'android' && <BurgerMenu />}
        <View style={styles.headerText}>
          <Text style={styles.title}>Analytics</Text>
          <Text style={styles.subtitle}>
            Hi {user.name.split(' ')[0]}, here&rsquo;s the community overview
          </Text>
        </View>
      </View>

      <DashboardSearch query={searchQuery} onChangeQuery={setSearchQuery} />

      {!searchQuery.trim() && (
        <>
          {summaryLoading ? (
            <AISummaryCard
              summary="Generating summary…"
              variant="manager"
              label="Community Digest"
            />
          ) : aiSummary ? (
            <AISummaryCard summary={aiSummary} variant="manager" label="Community Digest" />
          ) : null}

          <View style={styles.statsGrid}>
            <StatCard
              label="Total Complaints"
              value={stats.total}
              icon="document-text-outline"
              color={Colors.primary}
            />
            <StatCard
              label="Pending"
              value={stats.pending}
              icon="hourglass-outline"
              color={Colors.warning}
            />
            <StatCard
              label="Overdue"
              value={stats.overdue}
              icon="alert-circle-outline"
              color={Colors.danger}
            />
            <StatCard
              label="Avg Resolution"
              value={`${stats.avgResolutionHours.toFixed(1)}h`}
              icon="speedometer-outline"
              color={Colors.info}
            />
            <StatCard
              label="Emergency Services Handled"
              value={stats.emergencyHandled}
              icon="shield-checkmark-outline"
              color={Colors.danger}
            />
          </View>

          <View style={isDesktop ? styles.chartGrid : styles.chartStack}>
            <Card style={[styles.section, isDesktop && styles.chartGridItem]}>
              <Text style={styles.sectionTitle}>Complaints by Category</Text>
              {categoryData.length > 0 ? (
                <DonutChart
                  data={categoryData}
                  centerValue={String(stats.total)}
                  centerLabel="Total"
                />
              ) : (
                <Text style={styles.empty}>No complaint data yet.</Text>
              )}
            </Card>

            <Card style={[styles.section, isDesktop && styles.chartGridItem]}>
              <Text style={styles.sectionTitle}>Status Breakdown</Text>
              <BarChart data={statusData} />
            </Card>
          </View>

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Public Services</Text>
            <View style={styles.publicStats}>
              <View style={styles.publicMetric}>
                <Text style={styles.publicValue}>{publicStats.total}</Text>
                <Text style={styles.publicLabel}>Total</Text>
              </View>
              <View style={styles.publicMetric}>
                <Text style={styles.publicValue}>{publicStats.open}</Text>
                <Text style={styles.publicLabel}>Open</Text>
              </View>
              <View style={styles.publicMetric}>
                <Text style={styles.publicValue}>{publicStats.resolved}</Text>
                <Text style={styles.publicLabel}>Resolved</Text>
              </View>
              <View style={styles.publicMetric}>
                <Text style={styles.publicValue}>{publicStats.mergedReports}</Text>
                <Text style={styles.publicLabel}>Merged reports</Text>
              </View>
            </View>
          </Card>

          {publicServices.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Public Issues</Text>
              {publicServices.slice(0, 3).map((service) => (
                <PublicServiceCard
                  key={service.id}
                  service={service}
                  onPress={() => router.push(`/(manager)/public/${service.id}`)}
                />
              ))}
            </View>
          )}

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Resident Satisfaction</Text>
            <View style={styles.satisfactionRow}>
              <Text style={styles.satisfactionValue}>{stats.avgRating.toFixed(1)}</Text>
              <View>
                <Text style={styles.satisfactionLabel}>Average rating</Text>
                <Text style={styles.satisfactionMeta}>
                  from {stats.ratedCount} rated complaints
                </Text>
              </View>
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    headerText: {
      gap: 2,
    },
    title: {
      ...Type.title,
      color: Colors.ink,
    },
    subtitle: {
      ...Type.caption,
      color: Colors.inkSecondary,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    section: {
      gap: Spacing.sm,
    },
    chartStack: {
      gap: Spacing.md,
    },
    chartGrid: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: Spacing.md,
    },
    chartGridItem: {
      flex: 1,
    },
    sectionTitle: {
      ...Type.subtitle,
      color: Colors.ink,
    },
    empty: {
      ...Type.caption,
      color: Colors.inkTertiary,
    },
    satisfactionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    publicStats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    publicMetric: {
      minWidth: 110,
      flex: 1,
      alignItems: 'center',
      padding: Spacing.sm,
    },
    publicValue: {
      ...Type.title,
      color: Colors.primary,
    },
    publicLabel: {
      ...Type.tiny,
      color: Colors.inkSecondary,
      textAlign: 'center',
    },
    satisfactionValue: {
      ...Type.display,
      fontSize: 40,
      color: Colors.accent,
    },
    satisfactionLabel: {
      ...Type.bodyMedium,
      color: Colors.ink,
    },
    satisfactionMeta: {
      ...Type.caption,
      color: Colors.inkSecondary,
    },
  });
