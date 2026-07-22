import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { DonutChart } from '@/components/ui/DonutChart';
import { BarChart } from '@/components/ui/BarChart';
import { Screen } from '@/components/ui/Screen';
import { StatCard } from '@/components/ui/StatCard';
import { BurgerMenu } from '@/components/shared/BurgerMenu';
import { CATEGORIES } from '@/data/categories';
import { Spacing, Type } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useTicketStore } from '@/store/ticketStore';
import { isTicketOverdue } from '@/utils/overdue';

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
  const tickets = useTicketStore((s) => s.tickets);

  const stats = useMemo(() => {
    const total = tickets.length;
    const pending = tickets.filter((t) => t.status === 'Pending').length;
    const overdue = tickets.filter(isTicketOverdue).length;
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

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <BurgerMenu />
        <View style={styles.headerText}>
          <Text style={styles.title}>Analytics</Text>
          <Text style={styles.subtitle}>
            Hi {user.name.split(' ')[0]}, here&rsquo;s the community overview
          </Text>
        </View>
      </View>

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
        <Text style={styles.sectionTitle}>Resident Satisfaction</Text>
        <View style={styles.satisfactionRow}>
          <Text style={styles.satisfactionValue}>{stats.avgRating.toFixed(1)}</Text>
          <View>
            <Text style={styles.satisfactionLabel}>Average rating</Text>
            <Text style={styles.satisfactionMeta}>from {stats.ratedCount} rated complaints</Text>
          </View>
        </View>
      </Card>
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
