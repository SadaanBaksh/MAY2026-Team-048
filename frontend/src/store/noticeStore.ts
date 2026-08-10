import { create } from 'zustand';

import {
  cancelNotice,
  createNotice,
  fetchNotice,
  fetchNotices,
  scheduleNotice,
  sendNotice,
  updateNotice,
  type SaveNoticePayload,
} from '@/api/client';
import type { Notice } from '@/types';

interface NoticeState {
  notices: Notice[];
  loading: boolean;
  refreshNotices: (token: string) => Promise<void>;
  refreshNotice: (token: string, id: string) => Promise<Notice>;
  saveNotice: (token: string, id: string | null, payload: SaveNoticePayload) => Promise<Notice>;
  send: (token: string, id: string) => Promise<Notice>;
  schedule: (token: string, id: string, scheduledAt: string) => Promise<Notice>;
  cancel: (token: string, id: string) => Promise<Notice>;
}

function upsert(notices: Notice[], notice: Notice): Notice[] {
  return notices.some((item) => item.id === notice.id)
    ? notices.map((item) => (item.id === notice.id ? notice : item))
    : [notice, ...notices];
}

export const useNoticeStore = create<NoticeState>((set) => ({
  notices: [],
  loading: false,
  refreshNotices: async (token) => {
    set({ loading: true });
    try {
      set({ notices: await fetchNotices(token) });
    } finally {
      set({ loading: false });
    }
  },
  refreshNotice: async (token, id) => {
    const notice = await fetchNotice(token, id);
    set((state) => ({ notices: upsert(state.notices, notice) }));
    return notice;
  },
  saveNotice: async (token, id, payload) => {
    const notice = id ? await updateNotice(token, id, payload) : await createNotice(token, payload);
    set((state) => ({ notices: upsert(state.notices, notice) }));
    return notice;
  },
  send: async (token, id) => {
    const notice = await sendNotice(token, id);
    set((state) => ({ notices: upsert(state.notices, notice) }));
    return notice;
  },
  schedule: async (token, id, scheduledAt) => {
    const notice = await scheduleNotice(token, id, scheduledAt);
    set((state) => ({ notices: upsert(state.notices, notice) }));
    return notice;
  },
  cancel: async (token, id) => {
    const notice = await cancelNotice(token, id);
    set((state) => ({ notices: upsert(state.notices, notice) }));
    return notice;
  },
}));
