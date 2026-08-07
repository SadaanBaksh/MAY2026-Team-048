import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { NotificationsList } from '@/components/shared/NotificationsList';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';

export default function EmployeeNotificationsScreen() {
  const user = useAuthStore((s) => s.currentUser)!;
  const token = useAuthStore((s) => s.token);
  const notifications = useNotificationStore((s) => s.notifications).filter(
    (n) => n.userId === user.userId,
  );
  const refreshNotifications = useNotificationStore((s) => s.refreshNotifications);
  const markNotificationReadAction = useNotificationStore((s) => s.markNotificationReadAction);

  useFocusEffect(
    useCallback(() => {
      if (token) refreshNotifications(token);
    }, [token, refreshNotifications]),
  );

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Notifications" showBack />
      <Screen edges={['bottom']}>
        <NotificationsList
          notifications={notifications}
          onPressItem={(n) => {
            if (token) markNotificationReadAction(token, n.notificationId);
            if (n.publicServiceId) router.push(`/(employee)/public/${n.publicServiceId}`);
            else if (n.ticketId) router.push(`/(employee)/complaint/${n.ticketId}`);
          }}
        />
      </Screen>
    </View>
  );
}
