import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Type } from '@/constants/theme';
import type { ComplaintHistoryEntry } from '@/types';
import { formatFullDate } from '@/utils/date';

export function HistoryTimeline({ entries }: { entries: ComplaintHistoryEntry[] }) {
  const sorted = [...entries].sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());

  return (
    <View>
      {sorted.map((entry, i) => {
        const isLast = i === sorted.length - 1;
        return (
          <View key={entry.historyId} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.dot, isLast && styles.dotActive]} />
              {!isLast && <View style={styles.line} />}
            </View>
            <View style={styles.content}>
              <Text style={styles.status}>{entry.newStatus.replace('_', ' ')}</Text>
              <Text style={styles.remarks}>{entry.remarks}</Text>
              <Text style={styles.meta}>
                {entry.actorName} · {formatFullDate(entry.changedAt)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  rail: {
    alignItems: 'center',
    width: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.borderStrong,
    marginTop: 4,
  },
  dotActive: {
    backgroundColor: Colors.primary,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.border,
    marginVertical: 2,
  },
  content: {
    flex: 1,
    paddingBottom: Spacing.md,
    gap: 2,
  },
  status: {
    ...Type.bodyMedium,
    color: Colors.ink,
    textTransform: 'capitalize',
  },
  remarks: {
    ...Type.caption,
    color: Colors.inkSecondary,
  },
  meta: {
    ...Type.tiny,
    color: Colors.inkTertiary,
    marginTop: 2,
  },
});
