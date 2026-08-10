import { create } from 'zustand';

import {
  createPublicComment,
  createPublicService,
  fetchPublicComments,
  fetchPublicService,
  fetchPublicServices,
  fetchSimilaritySuggestions,
  reviewSimilaritySuggestion,
  updatePublicService,
} from '@/api/client';
import type {
  Priority,
  PublicService,
  PublicServiceComment,
  PublicServiceStatus,
  PublicSimilaritySuggestion,
} from '@/types';

interface PublicServiceState {
  services: PublicService[];
  comments: Record<string, PublicServiceComment[]>;
  suggestions: PublicSimilaritySuggestion[];
  loading: boolean;
  refreshServices: (token: string) => Promise<void>;
  refreshService: (token: string, id: string) => Promise<PublicService>;
  submitService: (
    token: string,
    payload: {
      title: string;
      description: string;
      location: string;
      category_id: string;
      priority: Priority;
      photo_urls?: string[];
    },
  ) => Promise<PublicService>;
  updateService: (
    token: string,
    id: string,
    patch: {
      worker_id?: string | null;
      category_id?: string;
      priority?: Priority;
      status?: PublicServiceStatus;
      resolution_remarks?: string;
      resolution_proof_url?: string;
    },
  ) => Promise<PublicService>;
  refreshComments: (token: string, id: string) => Promise<void>;
  addComment: (token: string, id: string, message: string) => Promise<void>;
  refreshSuggestions: (token: string) => Promise<void>;
  reviewSuggestion: (
    token: string,
    suggestionId: string,
    accept: boolean,
  ) => Promise<PublicSimilaritySuggestion>;
}

function upsert(items: PublicService[], value: PublicService): PublicService[] {
  const exists = items.some((item) => item.id === value.id);
  return exists ? items.map((item) => (item.id === value.id ? value : item)) : [value, ...items];
}

export const usePublicServiceStore = create<PublicServiceState>((set) => ({
  services: [],
  comments: {},
  suggestions: [],
  loading: false,

  refreshServices: async (token) => {
    set({ loading: true });
    try {
      set({ services: await fetchPublicServices(token) });
    } finally {
      set({ loading: false });
    }
  },

  refreshService: async (token, id) => {
    const service = await fetchPublicService(token, id);
    set((state) => ({ services: upsert(state.services, service) }));
    return service;
  },

  submitService: async (token, payload) => {
    const service = await createPublicService(token, payload);
    set((state) => ({ services: upsert(state.services, service) }));
    return service;
  },

  updateService: async (token, id, patch) => {
    const service = await updatePublicService(token, id, patch);
    set((state) => ({ services: upsert(state.services, service) }));
    return service;
  },

  refreshComments: async (token, id) => {
    const comments = await fetchPublicComments(token, id);
    set((state) => ({ comments: { ...state.comments, [id]: comments } }));
  },

  addComment: async (token, id, message) => {
    const comment = await createPublicComment(token, id, message);
    set((state) => ({
      comments: { ...state.comments, [id]: [...(state.comments[id] ?? []), comment] },
      services: state.services.map((service) =>
        service.id === id ? { ...service, commentCount: service.commentCount + 1 } : service,
      ),
    }));
  },

  refreshSuggestions: async (token) => {
    set({ suggestions: await fetchSimilaritySuggestions(token) });
  },

  reviewSuggestion: async (token, suggestionId, accept) => {
    const reviewed = await reviewSimilaritySuggestion(token, suggestionId, accept);
    set((state) => ({
      suggestions: state.suggestions.filter((item) => item.id !== suggestionId),
    }));
    return reviewed;
  },
}));
