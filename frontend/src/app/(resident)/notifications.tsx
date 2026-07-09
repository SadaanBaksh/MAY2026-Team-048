import { router } from 'expo-router';
import { View } from 'react-native';

import { NotificationsList } from '@/components/shared/NotificationsList';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';

export default function ResidentNotificationsScreen() {
  const user = useAuthStore((s) => s.currentUser)!;
  const notifications = useNotificationStore((s) => s.notifications).filter(
    (n) => n.userId === user.userId,
  );
  const markRead = useNotificationStore((s) => s.markRead);

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Notifications" showBack />
      <Screen edges={['bottom']}>
        <NotificationsList
          notifications={notifications}
          onPressItem={(n) => {
            markRead(n.notificationId);
            if (n.ticketId) router.push(`/(resident)/complaint/${n.ticketId}`);
          }}
        />
      </Screen>
    </View>
  );
}
