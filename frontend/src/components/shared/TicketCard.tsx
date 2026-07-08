import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PriorityBadge, StatusBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { IconCircle } from '@/components/ui/IconCircle';
import { getCategoryById } from '@/data/categories';
import { Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import type { Ticket } from '@/types';
import { timeAgo } from '@/utils/date';
import { isTicketOverdue } from '@/utils/overdue';

export interface TicketCardProps {
  ticket: Ticket;
  subtitle?: string;
  onPress?: () => void;
}

export function TicketCard({ ticket, subtitle, onPress }: TicketCardProps) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const category = getCategoryById(ticket.categoryId);
  const overdue = isTicketOverdue(ticket);

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <IconCircle name={category.icon} color={Colors.primary} size={40} />
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {ticket.title}
            </Text>
            <Text style={styles.time}>{timeAgo(ticket.dateOfRequest)}</Text>
          </View>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle ?? category.categoryName}
          </Text>
          <View style={styles.badgeRow}>
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
            {overdue && (
              <View style={styles.overdueChip}>
                <Text style={styles.overdueText}>Overdue</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Card>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      gap: 0,
    },
    row: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    body: {
      flex: 1,
      gap: 4,
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: Spacing.xs,
    },
    title: {
      ...Type.bodyMedium,
      color: Colors.ink,
      flexShrink: 1,
    },
    time: {
      ...Type.tiny,
      color: Colors.inkTertiary,
    },
    subtitle: {
      ...Type.caption,
      color: Colors.inkSecondary,
    },
    badgeRow: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 4,
      flexWrap: 'wrap',
    },
    overdueChip: {
      paddingVertical: 5,
      paddingHorizontal: Spacing.sm,
      borderRadius: 999,
      backgroundColor: Colors.criticalSoft,
      alignSelf: 'flex-start',
    },
    overdueText: {
      ...Type.tiny,
      color: Colors.critical,
    },
  });
