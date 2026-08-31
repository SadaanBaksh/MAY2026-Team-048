import { create } from 'zustand';

import {
  createPublicComment,
  createPublicService,
  fetchPublicComments,
  fetchPublicService,
  fetchPublicServices,
  fetchSimilaritySuggestions,
  mergePublicServices,
  reviewSimilaritySuggestion,
  unmergePublicService,
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
  /** Facility-employee manual merge: fold the chosen open services into one combined page. */
  mergeServices: (token: string, serviceIds: string[]) => Promise<PublicService>;
  /** Facility-employee unmerge: split a combined page back into its source pages. */
  unmergeService: (token: string, serviceId: string) => Promise<PublicService[]>;
}

function upsert(items: PublicService[], value: PublicService): PublicService[] {
  const exists = items.some((item) => item.id === value.id);
  return exists ? items.map((item) => (item.id === value.id ? value : item)) : [value, ...items];
}

export const usePublicServiceStore = create<PublicServiceState>((set, get) => ({
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

  mergeServices: async (token, serviceIds) => {
    const merged = await mergePublicServices(token, serviceIds);
    // The sources are now `Merged` (and drop out of the default feed) and pending
    // AI suggestions touching them are gone — refetch both lists for a clean state.
    await Promise.all([get().refreshServices(token), get().refreshSuggestions(token)]);
    return merged;
  },

  unmergeService: async (token, serviceId) => {
    const restored = await unmergePublicService(token, serviceId);
    // The combined page is gone and the sources are back — refetch for a clean state.
    await Promise.all([get().refreshServices(token), get().refreshSuggestions(token)]);
    return restored;
  },
}));
