import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import type { TicketStatus } from '@/types';

const STEPS: { status: TicketStatus; label: string }[] = [
  { status: 'Pending', label: 'Reported' },
  { status: 'Assigned', label: 'Assigned' },
  { status: 'In_Progress', label: 'In Progress' },
  { status: 'Resolved', label: 'Resolved' },
  { status: 'Closed', label: 'Closed' },
];

export function StatusStepper({ status }: { status: TicketStatus }) {
  const { Colors, StatusColors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const currentIndex = STEPS.findIndex((s) => s.status === status);

  if (status === 'Cancelled') {
    const c = StatusColors.Cancelled;
    return (
      <View style={styles.cancelledRow}>
        <Ionicons name="close-circle" size={20} color={c.dot} />
        <Text style={[styles.cancelledText, { color: c.text }]}>
          This complaint was cancelled before any work started.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      {STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        const isLast = index === STEPS.length - 1;

        return (
          <View key={step.status} style={[styles.stepGroup, isLast && styles.stepGroupLast]}>
            <View style={styles.stepColumn}>
              <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]}>
                {done && <Ionicons name="checkmark" size={12} color={Colors.white} />}
                {active && <View style={styles.activeInner} />}
              </View>
              {!isLast && <View style={[styles.line, (done || active) && styles.lineDone]} />}
            </View>
            <Text style={[styles.label, (done || active) && styles.labelActive]} numberOfLines={1}>
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const DOT_SIZE = 22;

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    cancelledRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    cancelledText: {
      ...Type.body,
      flex: 1,
    },
    stepGroup: {
      flex: 1,
      alignItems: 'center',
    },
    stepGroupLast: {
      flex: 0.4,
    },
    stepColumn: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
    },
    dot: {
      width: DOT_SIZE,
      height: DOT_SIZE,
      borderRadius: DOT_SIZE / 2,
      backgroundColor: Colors.surface,
      borderWidth: 2,
      borderColor: Colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotDone: {
      backgroundColor: Colors.success,
      borderColor: Colors.success,
    },
    dotActive: {
      borderColor: Colors.primary,
    },
    activeInner: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: Colors.primary,
    },
    line: {
      flex: 1,
      height: 2,
      backgroundColor: Colors.borderStrong,
    },
    lineDone: {
      backgroundColor: Colors.success,
    },
    label: {
      ...Type.tiny,
      color: Colors.inkTertiary,
      marginTop: 6,
      textAlign: 'center',
    },
    labelActive: {
      color: Colors.ink,
    },
  });
