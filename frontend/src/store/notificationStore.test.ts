import { fetchNotifications, markNotificationRead, type ApiNotification } from '@/api/client';
import { useNotificationStore } from '@/store/notificationStore';

jest.mock('@/api/client', () => ({
  fetchNotifications: jest.fn(),
  markNotificationRead: jest.fn(),
}));

const mockFetchNotifications = fetchNotifications as jest.MockedFunction<
  typeof fetchNotifications
>;
const mockMarkNotificationRead = markNotificationRead as jest.MockedFunction<
  typeof markNotificationRead
>;

function buildApiNotification(overrides: Partial<ApiNotification> = {}): ApiNotification {
  return {
    id: 'ntf_api1',
    user_id: 'usr_1',
    ticket_id: 'tkt_1',
    title: 'New complaint',
    message: 'Someone reported something',
    is_read: false,
    created_at: '2026-07-30T00:00:00.000Z',
    ...overrides,
  };
}

describe('useNotificationStore', () => {
  beforeEach(() => {
    useNotificationStore.setState({ notifications: [] });
    jest.clearAllMocks();
  });

  describe('markRead', () => {
    it('marks only the matching notification as read', () => {
      useNotificationStore.setState({
        notifications: [
          {
            notificationId: 'a',
            userId: 'u1',
            title: 'A',
            message: '',
            isRead: false,
            createdAt: 'x',
          },
          {
            notificationId: 'b',
            userId: 'u1',
            title: 'B',
            message: '',
            isRead: false,
            createdAt: 'x',
          },
        ],
      });

      useNotificationStore.getState().markRead('a');

      const { notifications } = useNotificationStore.getState();
      expect(notifications.find((n) => n.notificationId === 'a')?.isRead).toBe(true);
      expect(notifications.find((n) => n.notificationId === 'b')?.isRead).toBe(false);
    });
  });

  describe('markAllRead', () => {
    it('marks all notifications for the given user as read, leaving other users untouched', () => {
      useNotificationStore.setState({
        notifications: [
          {
            notificationId: 'a',
            userId: 'u1',
            title: 'A',
            message: '',
            isRead: false,
            createdAt: 'x',
          },
          {
            notificationId: 'b',
            userId: 'u1',
            title: 'B',
            message: '',
            isRead: false,
            createdAt: 'x',
          },
          {
            notificationId: 'c',
            userId: 'u2',
            title: 'C',
            message: '',
            isRead: false,
            createdAt: 'x',
          },
        ],
      });

      useNotificationStore.getState().markAllRead('u1');

      const { notifications } = useNotificationStore.getState();
      expect(notifications.find((n) => n.notificationId === 'a')?.isRead).toBe(true);
      expect(notifications.find((n) => n.notificationId === 'b')?.isRead).toBe(true);
      expect(notifications.find((n) => n.notificationId === 'c')?.isRead).toBe(false);
    });
  });

  describe('refreshNotifications', () => {
    it('replaces local state entirely with the mapped backend response', async () => {
      useNotificationStore.setState({
        notifications: [
          {
            notificationId: 'ntf_stale',
            userId: 'usr_1',
            title: 'Stale',
            message: 'stale',
            isRead: false,
            createdAt: 'old',
          },
        ],
      });
      mockFetchNotifications.mockResolvedValue([
        buildApiNotification({ id: 'ntf_api1', title: 'Fresh' }),
        buildApiNotification({ id: 'ntf_api2', title: 'Also fresh' }),
      ]);

      await useNotificationStore.getState().refreshNotifications('tok');

      expect(mockFetchNotifications).toHaveBeenCalledWith('tok');
      const { notifications } = useNotificationStore.getState();
      expect(notifications).toHaveLength(2);
      expect(notifications.find((n) => n.notificationId === 'ntf_stale')).toBeUndefined();
      expect(notifications.map((n) => n.title)).toEqual(['Fresh', 'Also fresh']);
    });

    it('maps a null ticket_id to undefined', async () => {
      mockFetchNotifications.mockResolvedValue([
        buildApiNotification({ id: 'ntf_no_ticket', ticket_id: null }),
      ]);

      await useNotificationStore.getState().refreshNotifications('tok');

      expect(useNotificationStore.getState().notifications[0].ticketId).toBeUndefined();
    });
  });

  describe('markNotificationReadAction', () => {
    it('optimistically marks the notification read locally, then calls the backend', async () => {
      useNotificationStore.setState({
        notifications: [
          {
            notificationId: 'a',
            userId: 'u1',
            title: 'A',
            message: '',
            isRead: false,
            createdAt: 'x',
          },
        ],
      });
      mockMarkNotificationRead.mockResolvedValue(buildApiNotification({ id: 'a', is_read: true }));

      await useNotificationStore.getState().markNotificationReadAction('tok', 'a');

      expect(mockMarkNotificationRead).toHaveBeenCalledWith('tok', 'a');
      expect(useNotificationStore.getState().notifications[0].isRead).toBe(true);
    });

    it('keeps the optimistic local read state even if the backend call fails', async () => {
      useNotificationStore.setState({
        notifications: [
          {
            notificationId: 'a',
            userId: 'u1',
            title: 'A',
            message: '',
            isRead: false,
            createdAt: 'x',
          },
        ],
      });
      mockMarkNotificationRead.mockRejectedValue(new Error('404'));

      await expect(
        useNotificationStore.getState().markNotificationReadAction('tok', 'a'),
      ).resolves.toBeUndefined();

      expect(useNotificationStore.getState().notifications[0].isRead).toBe(true);
    });
  });
});
