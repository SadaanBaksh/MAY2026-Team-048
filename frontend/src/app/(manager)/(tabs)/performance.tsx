import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { SearchBar } from '@/components/ui/SearchBar';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { usePublicServiceStore } from '@/store/publicServiceStore';
import { useTicketStore } from '@/store/ticketStore';
import type { MaintenanceStaff } from '@/types';
import { isTicketOverdue } from '@/utils/overdue';

const DAY_MS = 24 * 60 * 60 * 1000;
const CAPACITY = 5;

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export default function ManagerPerformanceScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const isDesktop = useIsDesktop();
  const users = useAuthStore((s) => s.users);
  const tickets = useTicketStore((s) => s.tickets);
  const publicServices = usePublicServiceStore((s) => s.services);
  const [query, setQuery] = useState('');

  const allRows = useMemo(() => {
    const staff = users.filter(
      (user): user is MaintenanceStaff =>
        user.role === 'maintenance_staff' && user.accountStatus === 'active',
    );

    return staff
      .map((worker) => {
        const jobs = tickets.filter((ticket) => ticket.workerId === worker.userId);
        const publicJobs = publicServices.filter((service) => service.workerId === worker.userId);
        const activeJobs = jobs.filter(
          (ticket) => ticket.status === 'Assigned' || ticket.status === 'In_Progress',
        );
        const activePublicJobs = publicJobs.filter(
          (service) => service.status === 'Assigned' || service.status === 'In_Progress',
        );
        const active = activeJobs.length + activePublicJobs.length;
        const overdue = activeJobs.filter(isTicketOverdue).length;
        const thirtyDaysAgo = Date.now() - 30 * DAY_MS;
        const completed =
          jobs.filter(
            (ticket) =>
              ticket.dateOfResolution &&
              new Date(ticket.dateOfResolution).getTime() >= thirtyDaysAgo,
          ).length +
          publicJobs.filter(
            (service) =>
              service.resolvedAt && new Date(service.resolvedAt).getTime() >= thirtyDaysAgo,
          ).length;
        const resolutionHours = [
          ...jobs
            .filter((ticket) => ticket.dateOfResolution)
            .map(
              (ticket) =>
                (new Date(ticket.dateOfResolution!).getTime() -
                  new Date(ticket.dateOfRequest).getTime()) /
                36e5,
            ),
          ...publicJobs
            .filter((service) => service.resolvedAt)
            .map(
              (service) =>
                (new Date(service.resolvedAt!).getTime() - new Date(service.createdAt).getTime()) /
                36e5,
            ),
        ];
        const rated = jobs.filter((ticket) => ticket.residentRating != null);
        const rating = rated.length
          ? rated.reduce((sum, ticket) => sum + (ticket.residentRating ?? 0), 0) / rated.length
          : null;
        return {
          worker,
          active,
          overdue,
          completed,
          medianHours: median(resolutionHours),
          rating,
          ratedCount: rated.length,
        };
      })
      .sort((a, b) => b.overdue - a.overdue || b.active - a.active || b.completed - a.completed);
  }, [users, tickets, publicServices]);

  const rows = useMemo(() => {
    if (!query.trim()) return allRows;
    const normalized = query.toLowerCase();
    return allRows.filter(
      ({ worker }) =>
        worker.name.toLowerCase().includes(normalized) ||
        worker.specialization.toLowerCase().includes(normalized) ||
        worker.email.toLowerCase().includes(normalized) ||
        worker.phone.toLowerCase().includes(normalized),
    );
  }, [allRows, query]);

  const team = useMemo(() => {
    const active = allRows.reduce((sum, row) => sum + row.active, 0);
    const overdue = allRows.reduce((sum, row) => sum + row.overdue, 0);
    const completed = allRows.reduce((sum, row) => sum + row.completed, 0);
    const resolutionTimes = allRows
      .map((row) => row.medianHours)
      .filter((hours): hours is number => hours != null);
    const available = allRows.filter((row) => row.active < CAPACITY).length;
    return { active, overdue, completed, medianHours: median(resolutionTimes), available };
  }, [allRows]);

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Team capacity</Text>
        <Text style={styles.subtitle}>
          Balance workload, protect SLAs and spot where support is needed.
        </Text>
      </View>

      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search staff by name or specialization…"
      />

      <View style={styles.teamGrid}>
        <TeamMetric
          icon="briefcase-outline"
          value={team.active}
          label="Active work"
          detail="Across the team"
          color={Colors.primary}
        />
        <TeamMetric
          icon="alert-circle-outline"
          value={team.overdue}
          label="Overdue"
          detail={team.overdue ? 'Requires intervention' : 'Everything within SLA'}
          color={team.overdue ? Colors.danger : Colors.success}
        />
        <TeamMetric
          icon="checkmark-done-outline"
          value={team.completed}
          label="Completed"
          detail="In the last 30 days"
          color={Colors.success}
        />
        <TeamMetric
          icon="timer-outline"
          value={team.medianHours == null ? '—' : `${team.medianHours.toFixed(1)}h`}
          label="Median resolution"
          detail={`${team.available} staff with capacity`}
          color={Colors.info}
        />
      </View>

      <View style={styles.sectionHeading}>
        <View style={styles.headingText}>
          <Text style={styles.sectionTitle}>Workload and performance</Text>
          <Text style={styles.sectionSubtitle}>
            Capacity assumes up to {CAPACITY} concurrent assignments per staff member.
          </Text>
        </View>
        {!!rows.length && <Text style={styles.staffCount}>{rows.length} staff</Text>}
      </View>

      <View style={styles.list}>
        {rows.length === 0 ? (
          <EmptyState
            icon="search-outline"
            title="No staff performance records found"
            message={
              query.trim()
                ? `No staff members matched "${query}".`
                : 'Active maintenance staff will appear here.'
            }
          />
        ) : (
          rows.map((row) => (
            <StaffPerformanceCard key={row.worker.userId} row={row} isDesktop={isDesktop} />
          ))
        )}
      </View>
    </Screen>
  );
}

function TeamMetric({
  icon,
  value,
  label,
  detail,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string | number;
  label: string;
  detail: string;
  color: string;
}) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  return (
    <Card style={styles.teamMetric}>
      <View style={styles.teamMetricTop}>
        <View style={[styles.teamMetricIcon, { backgroundColor: `${color}16` }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text style={styles.teamMetricValue}>{value}</Text>
      </View>
      <Text style={styles.teamMetricLabel}>{label}</Text>
      <Text style={[styles.teamMetricDetail, { color }]} numberOfLines={1}>
        {detail}
      </Text>
    </Card>
  );
}

type StaffRow = {
  worker: MaintenanceStaff;
  active: number;
  overdue: number;
  completed: number;
  medianHours: number | null;
  rating: number | null;
  ratedCount: number;
};

function StaffPerformanceCard({ row, isDesktop }: { row: StaffRow; isDesktop: boolean }) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const capacityPercent = Math.min(100, (row.active / CAPACITY) * 100);
  const capacity =
    row.active >= CAPACITY
      ? { label: 'At capacity', color: Colors.danger, background: Colors.dangerSoft }
      : row.active >= CAPACITY - 1
        ? { label: 'Near capacity', color: Colors.warning, background: Colors.warningSoft }
        : { label: 'Available', color: Colors.success, background: Colors.successSoft };

  return (
    <Card style={styles.staffCard}>
      <View style={[styles.staffContent, !isDesktop && styles.staffContentMobile]}>
        <View style={styles.identityColumn}>
          <View style={styles.identityRow}>
            <Avatar name={row.worker.name} color={row.worker.avatarColor} size={46} />
            <View style={styles.identityText}>
              <Text style={styles.name}>{row.worker.name}</Text>
              <Text style={styles.specialization}>{row.worker.specialization}</Text>
            </View>
            <Badge label={capacity.label} color={capacity.color} background={capacity.background} />
          </View>
          <View style={styles.capacityLabels}>
            <Text style={styles.capacityText}>
              {row.active} of {CAPACITY} active assignments
            </Text>
            <Text style={styles.capacityText}>{Math.round(capacityPercent)}%</Text>
          </View>
          <View style={styles.capacityTrack}>
            <View
              style={[
                styles.capacityFill,
                { width: `${capacityPercent}%`, backgroundColor: capacity.color },
              ]}
            />
          </View>
        </View>

        <View style={[styles.staffMetrics, !isDesktop && styles.staffMetricsMobile]}>
          <StaffMetric value={row.active} label="Active" />
          <StaffMetric value={row.overdue} label="Overdue" alert={row.overdue > 0} />
          <StaffMetric value={row.completed} label="Done · 30d" />
          <StaffMetric
            value={row.medianHours == null ? '—' : `${row.medianHours.toFixed(1)}h`}
            label="Median time"
          />
          <View style={styles.staffMetric}>
            <Text style={styles.staffMetricValue}>
              {row.rating == null ? 'No data' : `${row.rating.toFixed(1)} ★`}
            </Text>
            <Text style={styles.staffMetricLabel}>
              {row.rating == null
                ? 'No ratings yet'
                : `${row.ratedCount} rating${row.ratedCount === 1 ? '' : 's'}`}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

function StaffMetric({
  value,
  label,
  alert,
}: {
  value: string | number;
  label: string;
  alert?: boolean;
}) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  return (
    <View style={styles.staffMetric}>
      <Text style={[styles.staffMetricValue, alert && { color: Colors.danger }]}>{value}</Text>
      <Text style={styles.staffMetricLabel}>{label}</Text>
    </View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    header: { gap: 2 },
    title: { ...Type.title, color: Colors.ink },
    subtitle: { ...Type.caption, color: Colors.inkSecondary },
    teamGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    teamMetric: { flex: 1, minWidth: 180, gap: 3 },
    teamMetricTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    teamMetricIcon: {
      width: 34,
      height: 34,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    teamMetricValue: { ...Type.title, color: Colors.ink },
    teamMetricLabel: { ...Type.captionBold, color: Colors.ink },
    teamMetricDetail: { ...Type.tiny },
    sectionHeading: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    headingText: { flex: 1, gap: 2 },
    sectionTitle: { ...Type.subtitle, color: Colors.ink },
    sectionSubtitle: { ...Type.tiny, color: Colors.inkTertiary },
    staffCount: { ...Type.captionBold, color: Colors.teal },
    list: { gap: Spacing.sm },
    staffCard: { paddingVertical: Spacing.lg },
    staffContent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xl },
    staffContentMobile: { flexDirection: 'column', alignItems: 'stretch', gap: Spacing.md },
    identityColumn: { flex: 1.15, minWidth: 0, gap: Spacing.xs },
    identityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    identityText: { flex: 1, minWidth: 0, gap: 1 },
    name: { ...Type.bodyMedium, color: Colors.ink },
    specialization: { ...Type.caption, color: Colors.inkSecondary },
    capacityLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 2,
    },
    capacityText: { ...Type.tiny, color: Colors.inkSecondary },
    capacityTrack: {
      height: 7,
      backgroundColor: Colors.surfaceSunken,
      borderRadius: Radius.pill,
      overflow: 'hidden',
    },
    capacityFill: { height: '100%', borderRadius: Radius.pill },
    staffMetrics: {
      flex: 1.5,
      flexDirection: 'row',
      alignItems: 'center',
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: Colors.border,
    },
    staffMetricsMobile: {
      borderLeftWidth: 0,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
      paddingTop: Spacing.sm,
    },
    staffMetric: {
      flex: 1,
      minWidth: 65,
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: Spacing.xs,
    },
    staffMetricValue: { ...Type.bodyMedium, color: Colors.ink, textAlign: 'center' },
    staffMetricLabel: { ...Type.tiny, color: Colors.inkSecondary, textAlign: 'center' },
  });
