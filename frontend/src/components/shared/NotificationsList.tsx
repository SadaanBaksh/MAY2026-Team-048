import Ionicons from "@react-native-vector-icons/ionicons";
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { IconCircle } from '@/components/ui/IconCircle';
import { Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import type { AppNotification } from '@/types';
import { timeAgo } from '@/utils/date';

export interface NotificationsListProps {
  notifications: AppNotification[];
  onPressItem: (notification: AppNotification) => void;
}

export function NotificationsList({ notifications, onPressItem }: NotificationsListProps) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);

  if (notifications.length === 0) {
    return (
      <EmptyState
        icon="notifications-outline"
        title="No notifications"
        message="You're all caught up."
      />
    );
  }

  const sorted = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <View style={styles.list}>
      {sorted.map((n) => (
        <Pressable
          key={n.notificationId}
          onPress={() => onPressItem(n)}
          style={({ pressed }) => [
            styles.row,
            !n.isRead && styles.rowUnread,
            pressed && styles.pressed,
          ]}
        >
          <IconCircle
            name={
              n.title.toLowerCase().includes('overdue')
                ? 'alert-circle-outline'
                : 'notifications-outline'
            }
            color={n.title.toLowerCase().includes('overdue') ? Colors.danger : Colors.teal}
            size={36}
          />
          <View style={styles.body}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>
                {n.title}
              </Text>
              {!n.isRead && <View style={styles.dot} />}
            </View>
            <Text style={styles.message} numberOfLines={2}>
              {n.message}
            </Text>
            <Text style={styles.time}>{timeAgo(n.createdAt)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.inkTertiary} />
        </Pressable>
      ))}
    </View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    list: {
      gap: 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.xs,
      borderRadius: 12,
    },
    rowUnread: {
      backgroundColor: Colors.primarySoft,
    },
    pressed: {
      opacity: 0.85,
    },
    body: {
      flex: 1,
      gap: 2,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    title: {
      ...Type.bodyMedium,
      color: Colors.ink,
      flexShrink: 1,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: Colors.teal,
    },
    message: {
      ...Type.caption,
      color: Colors.inkSecondary,
    },
    time: {
      ...Type.tiny,
      color: Colors.inkTertiary,
      marginTop: 2,
    },
  });
