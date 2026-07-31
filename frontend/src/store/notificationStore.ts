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

// IDs of the hardcoded demo dataset (`data/seed.ts`), used only to strip that dataset back out
// of anything already persisted to AsyncStorage — see the `migrate` below.
const SEED_NOTIFICATION_IDS = new Set(NOTIFICATIONS.map((n) => n.notificationId));

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      notifications: [],

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
      // Bumped to strip the hardcoded demo notifications (`data/seed.ts`) out of AsyncStorage —
      // every real account was seeing fabricated notifications (e.g. about "Aditi Sharma"'s
      // complaints) that don't belong to them. Filtered by ID rather than wiped outright so real
      // notifications generated locally by ticketStore actions since install aren't lost.
      version: 1,
      migrate: (persistedState) => {
        const state = persistedState as NotificationState;
        return {
          ...state,
          notifications: state.notifications.filter(
            (n) => !SEED_NOTIFICATION_IDS.has(n.notificationId),
          ),
        };
      },
    },
  ),
);
