import { fetchNotifications, markNotificationRead, type ApiNotification } from '@/api/client';
import { useNotificationStore } from '@/store/notificationStore';

jest.mock('@/api/client', () => ({
  fetchNotifications: jest.fn(),
  markNotificationRead: jest.fn(),
}));

jest.mock('@/utils/id', () => ({ generateId: (prefix: string) => `${prefix}_test` }));
jest.mock('@/utils/date', () => ({ isoNow: () => '2026-07-31T12:00:00.000Z' }));

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

  describe('addNotification', () => {
    it('prepends a new notification with generated id, unread state and current timestamp', () => {
      useNotificationStore.getState().addNotification({
        userId: 'usr_1',
        ticketId: 'tkt_1',
        title: 'New complaint',
        message: 'Resident reported a leak',
      });

      expect(useNotificationStore.getState().notifications).toEqual([
        {
          userId: 'usr_1',
          ticketId: 'tkt_1',
          title: 'New complaint',
          message: 'Resident reported a leak',
          notificationId: 'ntf_test',
          isRead: false,
          createdAt: '2026-07-31T12:00:00.000Z',
        },
      ]);
    });

    it('adds newest notifications to the front of the list', () => {
      const { addNotification } = useNotificationStore.getState();
      addNotification({ userId: 'u1', title: 'First', message: 'first' });
      addNotification({ userId: 'u1', title: 'Second', message: 'second' });

      const titles = useNotificationStore.getState().notifications.map((n) => n.title);
      expect(titles).toEqual(['Second', 'First']);
    });
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
    it('replaces notifications matching backend ids and preserves local-only ones', async () => {
      useNotificationStore.setState({
        notifications: [
          {
            notificationId: 'ntf_api1',
            userId: 'usr_1',
            title: 'Stale',
            message: 'stale',
            isRead: false,
            createdAt: 'old',
          },
          {
            notificationId: 'ntf_local',
            userId: 'usr_1',
            title: 'Local only',
            message: 'local',
            isRead: false,
            createdAt: 'x',
          },
        ],
      });
      mockFetchNotifications.mockResolvedValue([
        buildApiNotification({ id: 'ntf_api1', title: 'Fresh' }),
      ]);

      await useNotificationStore.getState().refreshNotifications('tok');

      expect(mockFetchNotifications).toHaveBeenCalledWith('tok');
      const { notifications } = useNotificationStore.getState();
      expect(notifications).toHaveLength(2);
      expect(notifications.find((n) => n.notificationId === 'ntf_api1')?.title).toBe('Fresh');
      expect(notifications.find((n) => n.notificationId === 'ntf_local')).toBeDefined();
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

    it('keeps the optimistic local read state even if the backend call fails (local-only notifications)', async () => {
      useNotificationStore.setState({
        notifications: [
          {
            notificationId: 'local-only',
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
        useNotificationStore.getState().markNotificationReadAction('tok', 'local-only'),
      ).resolves.toBeUndefined();

      expect(useNotificationStore.getState().notifications[0].isRead).toBe(true);
    });
  });
});
