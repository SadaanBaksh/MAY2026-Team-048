import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useNotificationStore } from '@/store/notificationStore';

export function NotificationBell({ userId, onPress }: { userId: string; onPress: () => void }) {
  const unread = useNotificationStore((s) => s.notifications.filter((n) => n.userId === userId && !n.isRead).length);

  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.wrapper} accessibilityLabel="Notifications">
      <Ionicons name="notifications-outline" size={22} color={Colors.ink} />
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.white,
  },
});
