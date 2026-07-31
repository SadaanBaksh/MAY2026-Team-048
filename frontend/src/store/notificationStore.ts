import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { fetchNotifications, markNotificationRead, type ApiNotification } from '@/api/client';
import { NOTIFICATIONS } from '@/data/seed';
import type { AppNotification } from '@/types';
import { isoNow } from '@/utils/date';
import { generateId } from '@/utils/id';

function mapApiNotificationToNotification(apiNotification: ApiNotification): AppNotification {
  return {
    notificationId: apiNotification.id,
    userId: apiNotification.user_id,
    ticketId: apiNotification.ticket_id ?? undefined,
    title: apiNotification.title,
    message: apiNotification.message,
    isRead: apiNotification.is_read,
    createdAt: apiNotification.created_at,
  };
}

interface NotificationState {
  notifications: AppNotification[];
  addNotification: (
    input: Omit<AppNotification, 'notificationId' | 'isRead' | 'createdAt'>,
  ) => void;
  markRead: (notificationId: string) => void;
  markAllRead: (userId: string) => void;
  /** Fetches the caller's notifications from the backend, merging them into local state. */
  refreshNotifications: (token: string) => Promise<void>;
  /** Marks a notification read on the backend; falls back to a local-only update for
   * notifications that never reached the backend (e.g. the local-only emergency-alert flow). */
  markNotificationReadAction: (token: string, notificationId: string) => Promise<void>;
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

      refreshNotifications: async (token) => {
        const apiNotifications = await fetchNotifications(token);
        const mapped = apiNotifications.map(mapApiNotificationToNotification);
        const apiIds = new Set(mapped.map((n) => n.notificationId));

        // Merge rather than replace: local-only notifications (e.g. from the emergency flow,
        // which never reaches the backend) would otherwise be wiped out on every refresh.
        set((state) => ({
          notifications: [
            ...mapped,
            ...state.notifications.filter((n) => !apiIds.has(n.notificationId)),
          ],
        }));
      },

      markNotificationReadAction: async (token, notificationId) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.notificationId === notificationId ? { ...n, isRead: true } : n,
          ),
        }));
        try {
          await markNotificationRead(token, notificationId);
        } catch {
          // Local-only notifications (e.g. from the emergency flow) don't exist server-side
          // to mark read — the optimistic local update above is all that's needed for those.
        }
      },
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
