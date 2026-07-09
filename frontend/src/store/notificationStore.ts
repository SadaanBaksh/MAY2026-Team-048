import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { NOTIFICATIONS } from '@/data/seed';
import type { AppNotification } from '@/types';
import { isoNow } from '@/utils/date';
import { generateId } from '@/utils/id';

interface NotificationState {
  notifications: AppNotification[];
  addNotification: (
    input: Omit<AppNotification, 'notificationId' | 'isRead' | 'createdAt'>,
  ) => void;
  markRead: (notificationId: string) => void;
  markAllRead: (userId: string) => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      notifications: NOTIFICATIONS,

      addNotification: (input) =>
        set((state) => ({
          notifications: [
            { ...input, notificationId: generateId('ntf'), isRead: false, createdAt: isoNow() },
            ...state.notifications,
          ],
        })),

      markRead: (notificationId) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.notificationId === notificationId ? { ...n, isRead: true } : n,
          ),
        })),

      markAllRead: (userId) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.userId === userId ? { ...n, isRead: true } : n,
          ),
        })),
    }),
    {
      name: 'simplifix-notifications',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
