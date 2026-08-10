import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { PriorityBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Radius, Spacing, Type } from '@/constants/theme';
import { CATEGORIES, getCategoryById } from '@/data/categories';
import { APARTMENTS } from '@/data/seed';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useTicketStore } from '@/store/ticketStore';
import type { Ticket } from '@/types';
import { formatShortDate } from '@/utils/date';
import { isTicketOverdue } from '@/utils/overdue';

type InsightTab = 'backlog' | 'aging' | 'categories' | 'demand';
type Range = '30' | '90' | '365';

type TrendBucket = {
  label: string;
  start: number;
  end: number;
  opened: number;
  resolved: number;
  backlog: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_STATUSES = new Set(['Pending', 'Assigned', 'In_Progress']);
const VALID_TABS = new Set<InsightTab>(['backlog', 'aging', 'categories', 'demand']);
const TAB_OPTIONS: { value: InsightTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'backlog', label: 'Backlog', icon: 'trending-up-outline' },
  { value: 'aging', label: 'SLA & aging', icon: 'timer-outline' },
  { value: 'categories', label: 'Categories', icon: 'layers-outline' },
  { value: 'demand', label: 'Demand', icon: 'grid-outline' },
];

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function ticketAgeDays(ticket: Ticket): number {
  return Math.max(0, (Date.now() - new Date(ticket.dateOfRequest).getTime()) / DAY_MS);
}

function resolutionHours(ticket: Ticket): number | null {
  if (!ticket.dateOfResolution) return null;
  return (
    (new Date(ticket.dateOfResolution).getTime() - new Date(ticket.dateOfRequest).getTime()) / 36e5
  );
}

export default function ManagerInsightsScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const params = useLocalSearchParams<{ tab?: string }>();
  const requestedTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const [activeTab, setActiveTab] = useState<InsightTab>(
    requestedTab && VALID_TABS.has(requestedTab as InsightTab)
      ? (requestedTab as InsightTab)
      : 'backlog',
  );
  const [range, setRange] = useState<Range>('30');
  const [building, setBuilding] = useState('all');
  const [categoryId, setCategoryId] = useState('all');
  const [selectedBucket, setSelectedBucket] = useState<number | null>(null);
  const [selectedHeatCell, setSelectedHeatCell] = useState<{ day: number; period: number } | null>(
    null,
  );

  const tickets = useTicketStore((state) => state.tickets);
  const users = useAuthStore((state) => state.users);
  const buildings = useMemo(
    () => [...new Set(APARTMENTS.map((apartment) => apartment.building))],
    [],
  );

  useEffect(() => {
    if (requestedTab && VALID_TABS.has(requestedTab as InsightTab)) {
      setActiveTab(requestedTab as InsightTab);
    }
  }, [requestedTab]);

  const buildingFor = (ticket: Ticket) => {
    const resident = users.find((user) => user.userId === ticket.residentId);
    if (!resident || resident.role !== 'resident') return null;
    return APARTMENTS.find((apartment) => apartment.apartmentId === resident.apartmentId)?.building;
  };

  const scopedTickets = useMemo(
    () =>
      tickets.filter(
        (ticket) =>
          (categoryId === 'all' || ticket.categoryId === categoryId) &&
          (building === 'all' || buildingFor(ticket) === building),
      ),
    // buildingFor is a small lookup over store data and intentionally follows users.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tickets, users, categoryId, building],
  );

  const trend = useMemo(() => {
    const days = Number(range);
    const bucketCount = range === '30' ? 6 : range === '90' ? 6 : 12;
    const bucketDuration = (days * DAY_MS) / bucketCount;
    const endOfRange = Date.now();
    const startOfRange = endOfRange - days * DAY_MS;
    const buckets: TrendBucket[] = Array.from({ length: bucketCount }, (_, index) => {
      const start = startOfRange + index * bucketDuration;
      const end = index === bucketCount - 1 ? endOfRange + 1 : start + bucketDuration;
      const opened = scopedTickets.filter((ticket) => {
        const created = new Date(ticket.dateOfRequest).getTime();
        return created >= start && created < end;
      }).length;
      const resolved = scopedTickets.filter((ticket) => {
        if (!ticket.dateOfResolution) return false;
        const completed = new Date(ticket.dateOfResolution).getTime();
        return completed >= start && completed < end;
      }).length;
      const backlog = scopedTickets.filter((ticket) => {
        const created = new Date(ticket.dateOfRequest).getTime();
        const completed = ticket.dateOfResolution
          ? new Date(ticket.dateOfResolution).getTime()
          : Number.POSITIVE_INFINITY;
        return created < end && completed >= end;
      }).length;
      return {
        label: formatShortDate(new Date(end - 1).toISOString()),
        start,
        end,
        opened,
        resolved,
        backlog,
      };
    });
    return {
      buckets,
      opened: buckets.reduce((sum, bucket) => sum + bucket.opened, 0),
      resolved: buckets.reduce((sum, bucket) => sum + bucket.resolved, 0),
      currentBacklog: buckets.at(-1)?.backlog ?? 0,
    };
  }, [scopedTickets, range]);

  useEffect(() => {
    setSelectedBucket(null);
    setSelectedHeatCell(null);
  }, [range, building, categoryId]);

  const selectedBucketTickets = useMemo(() => {
    if (selectedBucket == null) return [];
    const bucket = trend.buckets[selectedBucket];
    if (!bucket) return [];
    return scopedTickets.filter((ticket) => {
      const created = new Date(ticket.dateOfRequest).getTime();
      const completed = ticket.dateOfResolution
        ? new Date(ticket.dateOfResolution).getTime()
        : Number.NEGATIVE_INFINITY;
      return (
        (created >= bucket.start && created < bucket.end) ||
        (completed >= bucket.start && completed < bucket.end)
      );
    });
  }, [selectedBucket, trend.buckets, scopedTickets]);

  const openTickets = useMemo(
    () => scopedTickets.filter((ticket) => OPEN_STATUSES.has(ticket.status)),
    [scopedTickets],
  );
  const periodTickets = useMemo(() => {
    const cutoff = Date.now() - Number(range) * DAY_MS;
    return scopedTickets.filter((ticket) => new Date(ticket.dateOfRequest).getTime() >= cutoff);
  }, [scopedTickets, range]);

  const categoryRows = useMemo(() => {
    const categories =
      categoryId === 'all'
        ? CATEGORIES
        : CATEGORIES.filter((category) => category.categoryId === categoryId);
    const rows = categories
      .map((category) => {
        const categoryTickets = scopedTickets.filter(
          (ticket) => ticket.categoryId === category.categoryId,
        );
        const open = categoryTickets.filter((ticket) => OPEN_STATUSES.has(ticket.status));
        const resolvedTimes = categoryTickets
          .map(resolutionHours)
          .filter((hours): hours is number => hours != null);
        return {
          category,
          total: categoryTickets.length,
          open: open.length,
          overdue: open.filter(isTicketOverdue).length,
          urgent: open.filter((ticket) =>
            ['High', 'Critical', 'Emergency'].includes(ticket.priority),
          ).length,
          medianHours: median(resolvedTimes),
        };
      })
      .filter((row) => row.total > 0)
      .sort((a, b) => b.open - a.open || b.overdue - a.overdue);
    return { rows, maxOpen: Math.max(1, ...rows.map((row) => row.open)) };
  }, [scopedTickets, categoryId]);

  const demand = useMemo(() => {
    const cells = Array.from({ length: 4 }, () => Array(7).fill(0) as number[]);
    periodTickets.forEach((ticket) => {
      const date = new Date(ticket.dateOfRequest);
      const mondayFirstDay = (date.getDay() + 6) % 7;
      const hour = date.getHours();
      const period = hour < 6 ? 0 : hour < 12 ? 1 : hour < 18 ? 2 : 3;
      cells[period][mondayFirstDay] += 1;
    });
    return { cells, max: Math.max(1, ...cells.flat()) };
  }, [periodTickets]);

  const heatCellTickets = useMemo(() => {
    if (!selectedHeatCell) return [];
    return periodTickets.filter((ticket) => {
      const date = new Date(ticket.dateOfRequest);
      const day = (date.getDay() + 6) % 7;
      const hour = date.getHours();
      const period = hour < 6 ? 0 : hour < 12 ? 1 : hour < 18 ? 2 : 3;
      return day === selectedHeatCell.day && period === selectedHeatCell.period;
    });
  }, [periodTickets, selectedHeatCell]);

  const setTab = (tab: InsightTab) => {
    setActiveTab(tab);
    router.setParams({ tab });
  };

  return (
    <View style={styles.wrapper}>
      <ScreenHeader
        title="Analytics explorer"
        subtitle="Investigate trends and drill into the work behind them"
        showBack
      />
      <Screen edges={['bottom']} maxWidth={1100}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          {TAB_OPTIONS.map((tab) => {
            const active = activeTab === tab.value;
            return (
              <Pressable
                key={tab.value}
                onPress={() => setTab(tab.value)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Ionicons
                  name={tab.icon}
                  size={17}
                  color={active ? Colors.white : Colors.inkSecondary}
                />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Card style={styles.filtersCard} elevated={false}>
          {(activeTab === 'backlog' || activeTab === 'demand') && (
            <View style={styles.rangeFilter}>
              <Text style={styles.filterLabel}>Analysis window</Text>
              <SegmentedControl
                options={[
                  { label: '30 days', value: '30' },
                  { label: '90 days', value: '90' },
                  { label: '1 year', value: '365' },
                ]}
                value={range}
                onChange={setRange}
              />
            </View>
          )}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Building</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              <Chip
                label="All buildings"
                active={building === 'all'}
                onPress={() => setBuilding('all')}
              />
              {buildings.map((name) => (
                <Chip
                  key={name}
                  label={name}
                  active={building === name}
                  onPress={() => setBuilding(name)}
                />
              ))}
            </ScrollView>
          </View>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              <Chip
                label="All categories"
                active={categoryId === 'all'}
                onPress={() => setCategoryId('all')}
              />
              {CATEGORIES.filter((category) =>
                tickets.some((ticket) => ticket.categoryId === category.categoryId),
              ).map((category) => (
                <Chip
                  key={category.categoryId}
                  label={category.categoryName}
                  icon={category.icon}
                  active={categoryId === category.categoryId}
                  onPress={() => setCategoryId(category.categoryId)}
                />
              ))}
            </ScrollView>
          </View>
        </Card>

        {activeTab === 'backlog' && (
          <BacklogPanel
            trend={trend}
            selectedBucket={selectedBucket}
            onSelectBucket={setSelectedBucket}
            selectedTickets={selectedBucketTickets}
          />
        )}
        {activeTab === 'aging' && <AgingPanel tickets={openTickets} />}
        {activeTab === 'categories' && (
          <CategoriesPanel rows={categoryRows.rows} maxOpen={categoryRows.maxOpen} />
        )}
        {activeTab === 'demand' && (
          <DemandPanel
            demand={demand}
            ticketCount={periodTickets.length}
            range={range}
            selectedCell={selectedHeatCell}
            onSelectCell={setSelectedHeatCell}
            selectedTickets={heatCellTickets}
          />
        )}
      </Screen>
    </View>
  );
}

function BacklogPanel({
  trend,
  selectedBucket,
  onSelectBucket,
  selectedTickets,
}: {
  trend: { buckets: TrendBucket[]; opened: number; resolved: number; currentBacklog: number };
  selectedBucket: number | null;
  onSelectBucket: (index: number) => void;
  selectedTickets: Ticket[];
}) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const completionRatio = trend.opened ? Math.round((trend.resolved / trend.opened) * 100) : 0;
  return (
    <>
      <View style={styles.metricGrid}>
        <InsightMetric
          label="Opened"
          value={trend.opened}
          detail="During this period"
          color={Colors.primary}
        />
        <InsightMetric
          label="Completed"
          value={trend.resolved}
          detail="During this period"
          color={Colors.success}
        />
        <InsightMetric
          label="Current backlog"
          value={trend.currentBacklog}
          detail="Still unresolved"
          color={trend.currentBacklog ? Colors.warning : Colors.success}
        />
        <InsightMetric
          label="Completion ratio"
          value={`${completionRatio}%`}
          detail="Completed ÷ opened"
          color={completionRatio >= 100 ? Colors.success : Colors.info}
        />
      </View>
      <Card style={styles.panelCard}>
        <PanelHeading
          title="Backlog movement"
          subtitle="Bars show incoming and completed work; the line shows unresolved work at each interval."
        />
        <View style={styles.legendRow}>
          <Legend color={Colors.primary} label="Opened" />
          <Legend color={Colors.success} label="Completed" />
          <Legend color={Colors.warning} label="Backlog" line />
        </View>
        <BacklogChart buckets={trend.buckets} selected={selectedBucket} onSelect={onSelectBucket} />
        <Text style={styles.chartHint}>Select an interval to inspect its complaints.</Text>
      </Card>
      {selectedBucket != null && (
        <Card style={styles.panelCard}>
          <PanelHeading
            title={trend.buckets[selectedBucket]?.label ?? 'Selected interval'}
            subtitle={`${selectedTickets.length} complaint${selectedTickets.length === 1 ? '' : 's'} opened or completed in this interval`}
          />
          <TicketRows tickets={selectedTickets} empty="No complaint activity in this interval." />
        </Card>
      )}
    </>
  );
}

function BacklogChart({
  buckets,
  selected,
  onSelect,
}: {
  buckets: TrendBucket[];
  selected: number | null;
  onSelect: (index: number) => void;
}) {
  const { Colors } = useTheme();
  const width = 760;
  const height = 250;
  const left = 42;
  const right = 14;
  const top = 18;
  const bottom = 42;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxValue = Math.max(
    1,
    ...buckets.flatMap((bucket) => [bucket.opened, bucket.resolved, bucket.backlog]),
  );
  const step = plotWidth / Math.max(1, buckets.length);
  const y = (value: number) => top + plotHeight - (value / maxValue) * plotHeight;
  const points = buckets.map((bucket, index) => ({
    x: left + step * index + step / 2,
    y: y(bucket.backlog),
  }));
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const barWidth = Math.min(18, step * 0.22);
  return (
    <View style={{ width: '100%', aspectRatio: width / height }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
        {[0, 0.5, 1].map((ratio) => {
          const lineY = top + plotHeight * ratio;
          return (
            <Line
              key={ratio}
              x1={left}
              x2={width - right}
              y1={lineY}
              y2={lineY}
              stroke={Colors.border}
              strokeWidth="1"
            />
          );
        })}
        {buckets.map((bucket, index) => {
          return (
            <Rect
              key={`hit-${bucket.label}-${index}`}
              x={left + step * index}
              y={top}
              width={step}
              height={plotHeight + 28}
              fill={selected === index ? `${Colors.info}12` : 'transparent'}
              onPress={() => onSelect(index)}
            />
          );
        })}
        {buckets.map((bucket, index) => {
          const center = left + step * index + step / 2;
          const openedHeight = (bucket.opened / maxValue) * plotHeight;
          return (
            <Rect
              key={`opened-${index}`}
              x={center - barWidth - 2}
              y={top + plotHeight - openedHeight}
              width={barWidth}
              height={Math.max(2, openedHeight)}
              rx="3"
              fill={Colors.primary}
              onPress={() => onSelect(index)}
            />
          );
        })}
        {buckets.map((bucket, index) => {
          const center = left + step * index + step / 2;
          const resolvedHeight = (bucket.resolved / maxValue) * plotHeight;
          return (
            <Rect
              key={`resolved-${index}`}
              x={center + 2}
              y={top + plotHeight - resolvedHeight}
              width={barWidth}
              height={Math.max(2, resolvedHeight)}
              rx="3"
              fill={Colors.success}
              onPress={() => onSelect(index)}
            />
          );
        })}
        <Path d={path} fill="none" stroke={Colors.warning} strokeWidth="3" strokeLinejoin="round" />
        {points.map((point, index) => (
          <Circle
            key={`point-${index}`}
            cx={point.x}
            cy={point.y}
            r={selected === index ? 6 : 4}
            fill={Colors.surface}
            stroke={Colors.warning}
            strokeWidth="3"
            onPress={() => onSelect(index)}
          />
        ))}
        {points.map((point, index) => (
          <SvgText
            key={`backlog-value-${index}`}
            x={point.x}
            y={Math.max(top + 10, point.y - 10)}
            fontSize="10"
            fontWeight="700"
            fill={Colors.warning}
            textAnchor="middle"
          >
            {buckets[index].backlog}
          </SvgText>
        ))}
        {buckets.map((bucket, index) => (
          <SvgText
            key={`label-${index}`}
            x={left + step * index + step / 2}
            y={height - 13}
            fontSize="10"
            fill={Colors.inkTertiary}
            textAnchor="middle"
          >
            {bucket.label}
          </SvgText>
        ))}
        <SvgText x={left - 8} y={top + 4} fontSize="10" fill={Colors.inkTertiary} textAnchor="end">
          {maxValue}
        </SvgText>
        <SvgText
          x={left - 8}
          y={top + plotHeight + 4}
          fontSize="10"
          fill={Colors.inkTertiary}
          textAnchor="end"
        >
          0
        </SvgText>
      </Svg>
    </View>
  );
}

function AgingPanel({ tickets }: { tickets: Ticket[] }) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const sorted = [...tickets].sort((a, b) => ticketAgeDays(b) - ticketAgeDays(a));
  const maxDays = Math.max(7, ...sorted.map(ticketAgeDays));
  const overdue = sorted.filter(isTicketOverdue).length;
  const unassigned = sorted.filter((ticket) => !ticket.workerId).length;
  const oldest = sorted[0] ? ticketAgeDays(sorted[0]) : 0;
  return (
    <>
      <View style={styles.metricGrid}>
        <InsightMetric
          label="Open complaints"
          value={sorted.length}
          detail="Currently unresolved"
          color={Colors.primary}
        />
        <InsightMetric
          label="Past SLA"
          value={overdue}
          detail="Requires intervention"
          color={overdue ? Colors.danger : Colors.success}
        />
        <InsightMetric
          label="Unassigned"
          value={unassigned}
          detail="Without an owner"
          color={unassigned ? Colors.warning : Colors.success}
        />
        <InsightMetric
          label="Oldest issue"
          value={sorted.length ? `${Math.ceil(oldest)}d` : '—'}
          detail="Time since reported"
          color={oldest > 3 ? Colors.warning : Colors.info}
        />
      </View>
      <Card style={styles.panelCard}>
        <PanelHeading
          title="Complaint aging"
          subtitle="Each dot is an open complaint. The position shows how long it has remained unresolved."
        />
        <View style={styles.agingLegend}>
          <Legend color={Colors.danger} label="Past SLA" />
          <Legend color={Colors.warning} label="High priority" />
          <Legend color={Colors.teal} label="Within SLA" />
        </View>
        {sorted.length ? (
          <View style={styles.agingChart}>
            <View style={styles.agingAxisRow}>
              <View style={styles.agingLabelSpace} />
              <View style={styles.axisTrack}>
                <Text style={[styles.axisLabel, { left: 0 }]}>0d</Text>
                <Text style={[styles.axisLabel, { left: `${Math.min(85, (1 / maxDays) * 100)}%` }]}>
                  1d
                </Text>
                <Text style={[styles.axisLabel, { left: `${Math.min(85, (3 / maxDays) * 100)}%` }]}>
                  3d SLA
                </Text>
                <Text style={[styles.axisLabel, { right: 0 }]}>{Math.ceil(maxDays)}d</Text>
              </View>
            </View>
            {sorted.map((ticket) => {
              const age = ticketAgeDays(ticket);
              const overdueTicket = isTicketOverdue(ticket);
              const urgent = ['High', 'Critical', 'Emergency'].includes(ticket.priority);
              const color = overdueTicket ? Colors.danger : urgent ? Colors.warning : Colors.teal;
              const slaDays = ticket.status === 'In_Progress' ? 3 : 1;
              return (
                <Pressable
                  key={ticket.ticketId}
                  onPress={() => router.push(`/(manager)/complaint/${ticket.ticketId}`)}
                  style={({ pressed }) => [styles.agingRow, pressed && { opacity: 0.65 }]}
                >
                  <View style={styles.agingLabelSpace}>
                    <Text style={styles.agingTitle} numberOfLines={1}>
                      {ticket.title}
                    </Text>
                    <Text style={styles.microText}>
                      {getCategoryById(ticket.categoryId).categoryName}
                    </Text>
                  </View>
                  <View style={styles.agingPlot}>
                    <View style={styles.agingLine} />
                    <View
                      style={[
                        styles.slaMarker,
                        { left: `${Math.min(100, (slaDays / maxDays) * 100)}%` },
                      ]}
                    />
                    <View
                      style={[
                        styles.agingDot,
                        { left: `${Math.min(97, (age / maxDays) * 100)}%`, backgroundColor: color },
                      ]}
                    >
                      <Text style={styles.agingDotText}>{Math.ceil(age)}d</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.inkTertiary} />
                </Pressable>
              );
            })}
          </View>
        ) : (
          <EmptyInline text="No open complaints match these filters." />
        )}
      </Card>
    </>
  );
}

type CategoryRow = {
  category: (typeof CATEGORIES)[number];
  total: number;
  open: number;
  overdue: number;
  urgent: number;
  medianHours: number | null;
};

function CategoriesPanel({ rows, maxOpen }: { rows: CategoryRow[]; maxOpen: number }) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const busiest = rows[0];
  const slowest = [...rows]
    .filter((row) => row.medianHours != null)
    .sort((a, b) => (b.medianHours ?? 0) - (a.medianHours ?? 0))[0];
  return (
    <>
      <View style={styles.metricGrid}>
        <InsightMetric
          label="Active categories"
          value={rows.filter((row) => row.open).length}
          detail="With open work"
          color={Colors.primary}
        />
        <InsightMetric
          label="Highest pressure"
          value={busiest?.category.categoryName ?? '—'}
          detail={busiest ? `${busiest.open} currently open` : 'No complaint data'}
          color={Colors.warning}
          compact
        />
        <InsightMetric
          label="Slowest category"
          value={slowest?.category.categoryName ?? '—'}
          detail={
            slowest?.medianHours != null
              ? `${slowest.medianHours.toFixed(1)}h median`
              : 'More resolved data needed'
          }
          color={Colors.info}
          compact
        />
      </View>
      <Card style={styles.panelCard}>
        <PanelHeading
          title="Category pressure"
          subtitle="Compare open volume, urgency and overdue risk. Longer bars indicate more unresolved work."
        />
        {rows.length ? (
          <View style={styles.categoryList}>
            {rows.map((row) => (
              <View key={row.category.categoryId} style={styles.categoryRow}>
                <View style={styles.categoryHeading}>
                  <View style={styles.categoryIdentity}>
                    <View style={styles.categoryIcon}>
                      <Ionicons name={row.category.icon} size={17} color={Colors.teal} />
                    </View>
                    <View>
                      <Text style={styles.categoryTitle}>{row.category.categoryName}</Text>
                      <Text style={styles.microText}>
                        {row.total} total ·{' '}
                        {row.medianHours == null
                          ? 'No resolution baseline'
                          : `${row.medianHours.toFixed(1)}h median resolution`}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.categoryValue}>{row.open} open</Text>
                </View>
                <View style={styles.pressureTrack}>
                  <View
                    style={[
                      styles.pressureFill,
                      {
                        width: `${Math.max(row.open ? 8 : 0, (row.open / maxOpen) * 100)}%`,
                        backgroundColor: row.overdue
                          ? Colors.danger
                          : row.urgent
                            ? Colors.warning
                            : Colors.teal,
                      },
                    ]}
                  />
                </View>
                <View style={styles.categoryMetaRow}>
                  <Text style={[styles.microText, row.overdue > 0 && { color: Colors.danger }]}>
                    {row.overdue} overdue
                  </Text>
                  <Text style={[styles.microText, row.urgent > 0 && { color: Colors.warning }]}>
                    {row.urgent} high priority
                  </Text>
                  <Text style={styles.microText}>
                    {row.open ? Math.round((row.overdue / row.open) * 100) : 0}% overdue rate
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <EmptyInline text="No category data matches these filters." />
        )}
      </Card>
    </>
  );
}

function DemandPanel({
  demand,
  ticketCount,
  range,
  selectedCell,
  onSelectCell,
  selectedTickets,
}: {
  demand: { cells: number[][]; max: number };
  ticketCount: number;
  range: Range;
  selectedCell: { day: number; period: number } | null;
  onSelectCell: (cell: { day: number; period: number }) => void;
  selectedTickets: Ticket[];
}) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const periodLabels = ['Night', 'Morning', 'Afternoon', 'Evening'];
  const peakValue = Math.max(...demand.cells.flat());
  let peak = { day: 0, period: 0 };
  demand.cells.forEach((row, period) =>
    row.forEach((value, day) => {
      if (value === peakValue) peak = { day, period };
    }),
  );
  return (
    <>
      <View style={styles.metricGrid}>
        <InsightMetric
          label="Complaints analyzed"
          value={ticketCount}
          detail={`Reported in ${range} days`}
          color={Colors.primary}
        />
        <InsightMetric
          label="Peak window"
          value={
            ticketCount ? `${dayLabels[peak.day]} ${periodLabels[peak.period].toLowerCase()}` : '—'
          }
          detail={
            ticketCount ? `${peakValue} complaint${peakValue === 1 ? '' : 's'}` : 'No demand data'
          }
          color={Colors.info}
          compact
        />
      </View>
      <Card style={styles.panelCard}>
        <PanelHeading
          title="Complaint demand heatmap"
          subtitle="Darker cells indicate when residents report more issues. Select a cell to inspect its complaints."
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.heatmap}>
            <View style={styles.heatRow}>
              <View style={styles.heatLabel} />
              {dayLabels.map((day) => (
                <Text key={day} style={styles.heatDay}>
                  {day}
                </Text>
              ))}
            </View>
            {demand.cells.map((row, period) => (
              <View key={periodLabels[period]} style={styles.heatRow}>
                <Text style={styles.heatLabel}>{periodLabels[period]}</Text>
                {row.map((value, day) => {
                  const intensity = value / demand.max;
                  const background =
                    value === 0
                      ? Colors.surfaceSunken
                      : `${Colors.teal}${intensity > 0.75 ? 'D9' : intensity > 0.45 ? '9C' : '55'}`;
                  const active = selectedCell?.day === day && selectedCell.period === period;
                  return (
                    <Pressable
                      key={`${period}-${day}`}
                      onPress={() => onSelectCell({ day, period })}
                      style={[
                        styles.heatCell,
                        { backgroundColor: background },
                        active && { borderColor: Colors.ink, borderWidth: 2 },
                      ]}
                    >
                      <Text style={[styles.heatValue, value > 0 && { color: Colors.white }]}>
                        {value}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
        <View style={styles.heatLegend}>
          <Text style={styles.microText}>Fewer</Text>
          {['22', '55', '9C', 'D9'].map((alpha) => (
            <View
              key={alpha}
              style={[styles.heatLegendCell, { backgroundColor: `${Colors.teal}${alpha}` }]}
            />
          ))}
          <Text style={styles.microText}>More reports</Text>
        </View>
      </Card>
      {selectedCell && (
        <Card style={styles.panelCard}>
          <PanelHeading
            title={`${dayLabels[selectedCell.day]} · ${periodLabels[selectedCell.period]}`}
            subtitle={`${selectedTickets.length} complaint${selectedTickets.length === 1 ? '' : 's'} reported in this window`}
          />
          <TicketRows tickets={selectedTickets} empty="No complaints in this time window." />
        </Card>
      )}
    </>
  );
}

function InsightMetric({
  label,
  value,
  detail,
  color,
  compact,
}: {
  label: string;
  value: string | number;
  detail: string;
  color: string;
  compact?: boolean;
}) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  return (
    <Card style={styles.insightMetric}>
      <View style={[styles.metricAccent, { backgroundColor: color }]} />
      <Text style={[compact ? styles.compactMetricValue : styles.metricValue]} numberOfLines={2}>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.microText, { color }]}>{detail}</Text>
    </Card>
  );
}

function PanelHeading({ title, subtitle }: { title: string; subtitle: string }) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  return (
    <View style={styles.panelHeading}>
      <Text style={styles.panelTitle}>{title}</Text>
      <Text style={styles.panelSubtitle}>{subtitle}</Text>
    </View>
  );
}

function Legend({ color, label, line }: { color: string; label: string; line?: boolean }) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  return (
    <View style={styles.legend}>
      <View style={[line ? styles.legendLine : styles.legendSquare, { backgroundColor: color }]} />
      <Text style={styles.microText}>{label}</Text>
    </View>
  );
}

function TicketRows({ tickets, empty }: { tickets: Ticket[]; empty: string }) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  if (!tickets.length) return <EmptyInline text={empty} />;
  return (
    <View>
      {tickets.map((ticket) => (
        <Pressable
          key={ticket.ticketId}
          onPress={() => router.push(`/(manager)/complaint/${ticket.ticketId}`)}
          style={({ pressed }) => [styles.ticketRow, pressed && { opacity: 0.65 }]}
        >
          <View style={styles.ticketIcon}>
            <Ionicons
              name={getCategoryById(ticket.categoryId).icon}
              size={17}
              color={Colors.teal}
            />
          </View>
          <View style={styles.ticketBody}>
            <Text style={styles.ticketTitle} numberOfLines={1}>
              {ticket.title}
            </Text>
            <Text style={styles.microText}>
              {getCategoryById(ticket.categoryId).categoryName} · reported{' '}
              {formatShortDate(ticket.dateOfRequest)}
            </Text>
          </View>
          <PriorityBadge priority={ticket.priority} />
          <Ionicons name="chevron-forward" size={16} color={Colors.inkTertiary} />
        </Pressable>
      ))}
    </View>
  );
}

function EmptyInline({ text }: { text: string }) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  return (
    <View style={styles.emptyInline}>
      <Ionicons name="analytics-outline" size={22} color={Colors.inkTertiary} />
      <Text style={styles.panelSubtitle}>{text}</Text>
    </View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: { flex: 1, backgroundColor: Colors.surfaceMuted },
    tabRow: { gap: Spacing.xs },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 9,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.pill,
      backgroundColor: Colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
    },
    tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    tabLabel: { ...Type.captionBold, color: Colors.inkSecondary },
    tabLabelActive: { color: Colors.white },
    filtersCard: { gap: Spacing.sm, backgroundColor: Colors.surface, borderColor: Colors.border },
    rangeFilter: { gap: 6, maxWidth: 420 },
    filterGroup: { gap: 6 },
    filterLabel: {
      ...Type.tiny,
      color: Colors.inkSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    chipRow: { gap: 7 },
    metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    insightMetric: { flex: 1, minWidth: 180, gap: 3, overflow: 'hidden' },
    metricAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
    metricValue: { ...Type.title, color: Colors.ink },
    compactMetricValue: { ...Type.subtitle, color: Colors.ink, minHeight: 45 },
    metricLabel: { ...Type.caption, color: Colors.inkSecondary },
    microText: { ...Type.tiny, color: Colors.inkSecondary },
    panelCard: { gap: Spacing.md },
    panelHeading: { gap: 2 },
    panelTitle: { ...Type.subtitle, color: Colors.ink },
    panelSubtitle: { ...Type.caption, color: Colors.inkSecondary },
    legendRow: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
    legend: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendSquare: { width: 9, height: 9, borderRadius: 3 },
    legendLine: { width: 18, height: 3, borderRadius: 2 },
    chartHint: { ...Type.tiny, color: Colors.inkTertiary, textAlign: 'center' },
    ticketRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
    },
    ticketIcon: {
      width: 34,
      height: 34,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.primarySoft,
    },
    ticketBody: { flex: 1, minWidth: 0, gap: 2 },
    ticketTitle: { ...Type.bodyMedium, color: Colors.ink },
    agingLegend: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
    agingChart: { gap: 0 },
    agingAxisRow: { flexDirection: 'row', alignItems: 'center', minHeight: 28, paddingRight: 24 },
    agingLabelSpace: { width: 180, paddingRight: Spacing.sm },
    axisTrack: { flex: 1, height: 20, position: 'relative' },
    axisLabel: { ...Type.tiny, color: Colors.inkTertiary, position: 'absolute' },
    agingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 58,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
    },
    agingTitle: { ...Type.captionBold, color: Colors.ink },
    agingPlot: {
      flex: 1,
      height: 38,
      justifyContent: 'center',
      position: 'relative',
      marginRight: 10,
    },
    agingLine: { height: 3, borderRadius: 2, backgroundColor: Colors.border },
    slaMarker: { position: 'absolute', width: 1, height: 30, backgroundColor: Colors.warning },
    agingDot: {
      position: 'absolute',
      width: 26,
      height: 26,
      marginLeft: -13,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: Colors.surface,
    },
    agingDotText: { ...Type.tiny, fontSize: 9, color: Colors.white },
    categoryList: { gap: Spacing.md },
    categoryRow: {
      gap: Spacing.xs,
      paddingBottom: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    categoryHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    categoryIdentity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
    categoryIcon: {
      width: 34,
      height: 34,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.primarySoft,
    },
    categoryTitle: { ...Type.captionBold, color: Colors.ink },
    categoryValue: { ...Type.captionBold, color: Colors.ink },
    pressureTrack: {
      height: 10,
      borderRadius: Radius.pill,
      backgroundColor: Colors.surfaceSunken,
      overflow: 'hidden',
    },
    pressureFill: { height: '100%', borderRadius: Radius.pill },
    categoryMetaRow: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
    heatmap: { minWidth: 710, gap: 7 },
    heatRow: { flexDirection: 'row', gap: 7, alignItems: 'center' },
    heatLabel: { width: 76, ...Type.tiny, color: Colors.inkSecondary },
    heatDay: { width: 78, textAlign: 'center', ...Type.tiny, color: Colors.inkSecondary },
    heatCell: {
      width: 78,
      height: 54,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'transparent',
    },
    heatValue: { ...Type.bodyMedium, color: Colors.inkTertiary },
    heatLegend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
    heatLegendCell: { width: 20, height: 10, borderRadius: 2 },
    emptyInline: {
      minHeight: 150,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
    },
  });
