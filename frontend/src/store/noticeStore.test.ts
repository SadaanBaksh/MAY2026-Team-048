import {
  cancelNotice,
  createNotice,
  fetchNotice,
  fetchNotices,
  scheduleNotice,
  sendNotice,
  updateNotice,
} from '@/api/client';
import { useNoticeStore } from '@/store/noticeStore';
import type { Notice } from '@/types';

jest.mock('@/api/client', () => ({
  cancelNotice: jest.fn(),
  createNotice: jest.fn(),
  fetchNotice: jest.fn(),
  fetchNotices: jest.fn(),
  scheduleNotice: jest.fn(),
  sendNotice: jest.fn(),
  updateNotice: jest.fn(),
}));

const mockFetch = fetchNotices as jest.MockedFunction<typeof fetchNotices>;
const mockFetchOne = fetchNotice as jest.MockedFunction<typeof fetchNotice>;
const mockCreate = createNotice as jest.MockedFunction<typeof createNotice>;
const mockUpdate = updateNotice as jest.MockedFunction<typeof updateNotice>;
const mockSend = sendNotice as jest.MockedFunction<typeof sendNotice>;
const mockSchedule = scheduleNotice as jest.MockedFunction<typeof scheduleNotice>;
const mockCancel = cancelNotice as jest.MockedFunction<typeof cancelNotice>;

function notice(overrides: Partial<Notice> = {}): Notice {
  return {
    id: 'notice-1',
    createdById: 'manager-1',
    title: 'Power maintenance',
    body: 'Power will be unavailable from 2 PM to 4 PM.',
    briefPoints: ['Power will be unavailable from 2 PM to 4 PM'],
    targetBuildings: ['Tower A'],
    status: 'Draft',
    timezone: 'Asia/Kolkata',
    scheduledAt: null,
    sentAt: null,
    expiresAt: null,
    recipientCount: 0,
    createdAt: '2026-08-10T08:00:00Z',
    updatedAt: '2026-08-10T08:00:00Z',
    ...overrides,
  };
}

const payload = {
  title: 'Power maintenance',
  body: 'Power will be unavailable from 2 PM to 4 PM.',
  brief_points: ['Power will be unavailable from 2 PM to 4 PM'],
  target_buildings: ['Tower A'],
  timezone: 'Asia/Kolkata',
  expires_at: null,
};

describe('useNoticeStore', () => {
  beforeEach(() => {
    useNoticeStore.setState({ notices: [], loading: false });
    jest.clearAllMocks();
  });

  it('loads the notices visible to the current role', async () => {
    mockFetch.mockResolvedValue([notice()]);
    await useNoticeStore.getState().refreshNotices('token');
    expect(mockFetch).toHaveBeenCalledWith('token');
    expect(useNoticeStore.getState().notices).toHaveLength(1);
  });

  it('creates a draft, then updates it in place', async () => {
    mockCreate.mockResolvedValue(notice());
    await useNoticeStore.getState().saveNotice('token', null, payload);
    mockUpdate.mockResolvedValue(notice({ title: 'Updated title' }));
    await useNoticeStore
      .getState()
      .saveNotice('token', 'notice-1', { ...payload, title: 'Updated title' });
    expect(useNoticeStore.getState().notices).toHaveLength(1);
    expect(useNoticeStore.getState().notices[0].title).toBe('Updated title');
  });

  it('upserts a directly opened notice', async () => {
    mockFetchOne.mockResolvedValue(notice());
    await useNoticeStore.getState().refreshNotice('token', 'notice-1');
    expect(useNoticeStore.getState().notices[0].id).toBe('notice-1');
  });

  it('tracks schedule, send, and cancel lifecycle responses', async () => {
    useNoticeStore.setState({ notices: [notice()] });
    mockSchedule.mockResolvedValue(
      notice({ status: 'Scheduled', scheduledAt: '2026-08-11T08:00:00Z' }),
    );
    await useNoticeStore.getState().schedule('token', 'notice-1', '2026-08-11T08:00:00Z');
    expect(useNoticeStore.getState().notices[0].status).toBe('Scheduled');

    mockSend.mockResolvedValue(notice({ status: 'Sent', recipientCount: 12 }));
    await useNoticeStore.getState().send('token', 'notice-1');
    expect(useNoticeStore.getState().notices[0]).toMatchObject({
      status: 'Sent',
      recipientCount: 12,
    });

    mockCancel.mockResolvedValue(notice({ status: 'Cancelled' }));
    await useNoticeStore.getState().cancel('token', 'notice-1');
    expect(useNoticeStore.getState().notices[0].status).toBe('Cancelled');
  });
});
