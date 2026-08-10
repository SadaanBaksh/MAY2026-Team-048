import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { fetchNotifications, markNotificationRead, type ApiNotification } from '@/api/client';
import { NOTIFICATIONS } from '@/data/seed';
import type { AppNotification } from '@/types';

function mapApiNotificationToNotification(apiNotification: ApiNotification): AppNotification {
  return {
    notificationId: apiNotification.id,
    userId: apiNotification.user_id,
    ticketId: apiNotification.ticket_id ?? undefined,
    publicServiceId: apiNotification.public_service_id ?? undefined,
    noticeId: apiNotification.notice_id ?? undefined,
    title: apiNotification.title,
    message: apiNotification.message,
    isRead: apiNotification.is_read,
    createdAt: apiNotification.created_at,
  };
}

interface NotificationState {
  notifications: AppNotification[];
  markRead: (notificationId: string) => void;
  markAllRead: (userId: string) => void;
  /** Fetches the caller's notifications from the backend. */
  refreshNotifications: (token: string) => Promise<void>;
  /** Marks a notification read on the backend, with an optimistic local update first. */
  markNotificationReadAction: (token: string, notificationId: string) => Promise<void>;
}

// IDs of the hardcoded demo dataset (`data/seed.ts`), used only to strip that dataset back out
// of anything already persisted to AsyncStorage — see the `migrate` below.
const SEED_NOTIFICATION_IDS = new Set(NOTIFICATIONS.map((n) => n.notificationId));

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      notifications: [],

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
        // Every notification now comes from the backend (no more local-only creation path), so
        // this is a plain replace — no merge logic needed to protect anything local-only.
        set({ notifications: apiNotifications.map(mapApiNotificationToNotification) });
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
          // Call sites fire this without awaiting/catching — swallow so a transient network
          // failure doesn't surface as an unhandled rejection. The optimistic local update above
          // already reflects the read state either way.
        }
      },
    }),
    {
      name: 'simplifix-notifications',
      storage: createJSONStorage(() => AsyncStorage),
      // Bumped (v1) to strip the hardcoded demo notifications (`data/seed.ts`) out of
      // AsyncStorage — every real account was seeing fabricated notifications (e.g. about
      // "Aditi Sharma"'s complaints) that don't belong to them.
      // Bumped again (v2) once the last local-only notification path (`addNotification`, called
      // from the now-removed emergency `submitComplaint` flow) was removed — any `ntf_`-prefixed
      // notification still sitting in AsyncStorage at this point is guaranteed stale, since every
      // notification ID now comes from the backend (a plain UUID) instead.
      version: 2,
      migrate: (persistedState) => {
        const state = persistedState as NotificationState;
        const isStale = (notificationId: string) =>
          SEED_NOTIFICATION_IDS.has(notificationId) || notificationId.startsWith('ntf_');
        return {
          ...state,
          notifications: state.notifications.filter((n) => !isStale(n.notificationId)),
        };
      },
    },
  ),
);
