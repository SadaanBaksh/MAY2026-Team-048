import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  fetchComments,
  fetchTicketHistory,
  fetchTickets,
  postComment,
  updateTicket,
  type ApiComment,
  type ApiTicket,
} from '@/api/client';
import { TICKETS, USERS } from '@/data/seed';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import type {
  Comment,
  ComplaintHistoryEntry,
  ComplaintMedia,
  CostResponsibility,
  MediaType,
  Priority,
  Ticket,
  TicketStatus,
} from '@/types';
import { isoNow } from '@/utils/date';
import { generateId } from '@/utils/id';

export interface SubmitComplaintInput {
  residentId: string;
  categoryId: string;
  title: string;
  aiDescription: string;
  aiConfidence: number;
  priority: Priority;
  mediaUrl: string | null;
  mediaType: MediaType | null;
  residentNote: string;
  voiceNoteUrl: string | null;
  voiceNoteDurationSec: number | null;
}

export interface Actor {
  name: string;
  role: string;
}

interface TicketState {
  tickets: Ticket[];
  media: ComplaintMedia[];
  history: ComplaintHistoryEntry[];
  comments: Comment[];
  /** The newly received emergency that should surface as the employee pull-up alert. */
  activeEmergencyAlertId: string | null;

  submitComplaint: (input: SubmitComplaintInput) => string;
  /** Records a ticket that was already created (with uploaded media) via the backend API. */
  addTicketFromApi: (apiTicket: ApiTicket) => string;
  /** Fetches the caller's tickets from the backend, merging them into local state. */
  refreshTickets: (token: string) => Promise<void>;
  /** Fetches the server-authoritative history for one ticket. */
  refreshTicketHistory: (token: string, ticketId: string) => Promise<void>;
  /** Fetches the server-authoritative comment thread for one ticket. */
  refreshComments: (token: string, ticketId: string) => Promise<void>;
  reviewAndAssign: (
    token: string,
    ticketId: string,
    changes: {
      categoryId: string;
      priority: Priority;
      workerId: string;
      costResponsibility: CostResponsibility;
    },
    actor: Actor,
  ) => Promise<void>;
  updateCostResponsibility: (
    token: string,
    ticketId: string,
    costResponsibility: CostResponsibility,
  ) => Promise<void>;
  startProgress: (token: string, ticketId: string, actor: Actor) => Promise<void>;
  resolveTicket: (
    token: string,
    ticketId: string,
    changes: { remarks: string; proofUrl: string },
    actor: Actor,
  ) => Promise<void>;
  verifyAndClose: (
    token: string,
    ticketId: string,
    changes: { rating: number; feedback: string },
  ) => Promise<void>;
  /** Posts a new comment to the backend and appends it to local state. */
  postCommentAction: (token: string, ticketId: string, message: string) => Promise<void>;
}

function pushHistory(
  state: TicketState,
  ticketId: string,
  oldStatus: TicketStatus | null,
  newStatus: TicketStatus,
  remarks: string,
  actorName: string,
): ComplaintHistoryEntry[] {
  const entry: ComplaintHistoryEntry = {
    historyId: generateId('hist'),
    ticketId,
    oldStatus,
    newStatus,
    remarks,
    changedAt: isoNow(),
    actorName,
  };
  return [...state.history, entry];
}

function mapApiTicketToTicket(apiTicket: ApiTicket): Ticket {
  return {
    ticketId: apiTicket.id,
    residentId: apiTicket.resident_id,
    workerId: apiTicket.worker_id,
    categoryId: apiTicket.category_id,
    imageUrl: apiTicket.image_url,
    mediaType: apiTicket.media_type,
    residentNote: apiTicket.resident_note,
    voiceNoteUrl: apiTicket.voice_note_url,
    voiceNoteDurationSec: apiTicket.voice_note_duration_sec,
    aiDescription: apiTicket.ai_description,
    aiConfidence: apiTicket.ai_confidence,
    priority: apiTicket.priority,
    status: apiTicket.status,
    costResponsibility: apiTicket.cost_responsibility,
    dateOfRequest: apiTicket.date_of_request,
    dateOfResolution: apiTicket.date_of_resolution,
    resolutionRemarks: apiTicket.resolution_remarks,
    resolutionProofUrl: apiTicket.resolution_proof_url,
    residentRating: apiTicket.resident_rating,
    residentFeedback: apiTicket.resident_feedback,
    isOverdue: apiTicket.is_overdue,
    title: apiTicket.title,
  };
}

function mapApiCommentToComment(apiComment: ApiComment): Comment {
  const author = useAuthStore.getState().users.find((u) => u.userId === apiComment.user_id);
  return {
    commentId: apiComment.id,
    ticketId: apiComment.ticket_id,
    userId: apiComment.user_id,
    authorName: author?.name ?? 'Unknown user',
    authorRole: author?.role ?? 'resident',
    message: apiComment.message,
    postedAt: apiComment.posted_at,
  };
}

// IDs of the hardcoded demo dataset (`data/seed.ts`), used only to strip that dataset back out
// of anything already persisted to AsyncStorage from before the app was backend-driven — see the
// `migrate` below. Real tickets (from the API or `generateId('tkt')`) never collide with these.
const SEED_TICKET_IDS = new Set(TICKETS.map((t) => t.ticketId));

function mapApiTicketMedia(apiTicket: ApiTicket): ComplaintMedia[] {
  return apiTicket.media.map((m) => ({
    mediaId: m.id,
    ticketId: apiTicket.id,
    mediaUrl: m.media_url,
    mediaType: m.media_type,
    uploadedAt: m.uploaded_at,
  }));
}

export const useTicketStore = create<TicketState>()(
  persist(
    (set, get) => {
      /** Maps a freshly-updated ApiTicket into local state, returning the mapped ticket. */
      const applyUpdatedTicket = (apiTicket: ApiTicket): Ticket => {
        const ticket = mapApiTicketToTicket(apiTicket);
        set((state) => ({
          tickets: state.tickets.map((t) => (t.ticketId === ticket.ticketId ? ticket : t)),
        }));
        return ticket;
      };

      return {
        tickets: [],
        media: [],
        history: [],
        comments: [],
        activeEmergencyAlertId: null,

        submitComplaint: (input) => {
          const ticketId = generateId('tkt');
          const ticket: Ticket = {
            ticketId,
            residentId: input.residentId,
            workerId: null,
            categoryId: input.categoryId,
            imageUrl: input.mediaUrl,
            mediaType: input.mediaType,
            residentNote: input.residentNote,
            voiceNoteUrl: input.voiceNoteUrl,
            voiceNoteDurationSec: input.voiceNoteDurationSec,
            aiDescription: input.aiDescription,
            aiConfidence: input.aiConfidence,
            priority: input.priority,
            status: 'Pending',
            costResponsibility: 'Pending Review',
            dateOfRequest: isoNow(),
            dateOfResolution: null,
            resolutionRemarks: null,
            resolutionProofUrl: null,
            residentRating: null,
            residentFeedback: null,
            isOverdue: false,
            title: input.title,
          };

          const resident = USERS.find((u) => u.userId === input.residentId);

          set((state) => ({
            tickets: [ticket, ...state.tickets],
            media:
              input.mediaUrl && input.mediaType
                ? [
                    ...state.media,
                    {
                      mediaId: generateId('media'),
                      ticketId,
                      mediaUrl: input.mediaUrl,
                      mediaType: input.mediaType,
                      uploadedAt: isoNow(),
                    },
                  ]
                : state.media,
            history: pushHistory(
              state,
              ticketId,
              null,
              'Pending',
              'Complaint submitted by resident.',
              resident?.name ?? 'Resident',
            ),
            activeEmergencyAlertId:
              input.priority === 'Emergency' ? ticketId : state.activeEmergencyAlertId,
          }));

          const employees = USERS.filter((u) => u.role === 'facility_employee');
          employees.forEach((emp) => {
            useNotificationStore.getState().addNotification({
              userId: emp.userId,
              ticketId,
              title:
                input.priority === 'Emergency'
                  ? 'Emergency service request'
                  : 'New complaint submitted',
              message:
                input.priority === 'Emergency'
                  ? `${resident?.name ?? 'A resident'} needs emergency assistance: ${input.title}`
                  : `${resident?.name ?? 'A resident'} reported: ${input.title}`,
            });
          });

          return ticketId;
        },

        addTicketFromApi: (apiTicket) => {
          const ticket = mapApiTicketToTicket(apiTicket);
          const newMedia = mapApiTicketMedia(apiTicket);
          const resident = USERS.find((u) => u.userId === apiTicket.resident_id);

          set((state) => ({
            tickets: [ticket, ...state.tickets],
            media: [...state.media, ...newMedia],
            history: pushHistory(
              state,
              ticket.ticketId,
              null,
              'Pending',
              'Complaint submitted by resident.',
              resident?.name ?? 'Resident',
            ),
            activeEmergencyAlertId:
              ticket.priority === 'Emergency' ? ticket.ticketId : state.activeEmergencyAlertId,
          }));

          return ticket.ticketId;
        },

        refreshTickets: async (token) => {
          const apiTickets = await fetchTickets(token);
          const mapped = apiTickets.map(mapApiTicketToTicket);
          const mappedMedia = apiTickets.flatMap(mapApiTicketMedia);
          const apiIds = new Set(mapped.map((t) => t.ticketId));

          // Merge rather than replace: locally-only tickets (e.g. from the emergency flow,
          // which never reaches the backend) would otherwise be wiped out on every refresh.
          set((state) => ({
            tickets: [...mapped, ...state.tickets.filter((t) => !apiIds.has(t.ticketId))],
            media: [...mappedMedia, ...state.media.filter((m) => !apiIds.has(m.ticketId))],
          }));
        },

        refreshTicketHistory: async (token, ticketId) => {
          const apiHistory = await fetchTicketHistory(token, ticketId);
          const users = useAuthStore.getState().users;
          const mapped: ComplaintHistoryEntry[] = apiHistory.map((h) => ({
            historyId: h.id,
            ticketId: h.ticket_id,
            oldStatus: h.old_status,
            newStatus: h.new_status,
            remarks: h.remarks,
            changedAt: h.changed_at,
            actorName: users.find((u) => u.userId === h.actor_id)?.name ?? 'Unknown',
          }));

          set((state) => ({
            history: [...state.history.filter((h) => h.ticketId !== ticketId), ...mapped],
          }));
        },

        reviewAndAssign: async (token, ticketId, changes, actor) => {
          const apiTicket = await updateTicket(token, ticketId, {
            category_id: changes.categoryId,
            worker_id: changes.workerId,
            priority: changes.priority,
            cost_responsibility: changes.costResponsibility,
            status: 'Assigned',
          });
          applyUpdatedTicket(apiTicket);
          await get().refreshTicketHistory(token, ticketId);

          set((state) => ({
            activeEmergencyAlertId:
              state.activeEmergencyAlertId === ticketId ? null : state.activeEmergencyAlertId,
          }));
        },

        updateCostResponsibility: async (token, ticketId, costResponsibility) => {
          const apiTicket = await updateTicket(token, ticketId, {
            cost_responsibility: costResponsibility,
          });
          applyUpdatedTicket(apiTicket);
        },

        startProgress: async (token, ticketId, actor) => {
          const apiTicket = await updateTicket(token, ticketId, { status: 'In_Progress' });
          applyUpdatedTicket(apiTicket);
          await get().refreshTicketHistory(token, ticketId);
        },

        resolveTicket: async (token, ticketId, changes, actor) => {
          const apiTicket = await updateTicket(token, ticketId, {
            status: 'Resolved',
            resolution_remarks: changes.remarks,
            resolution_proof_url: changes.proofUrl,
          });
          applyUpdatedTicket(apiTicket);
          await get().refreshTicketHistory(token, ticketId);
        },

        verifyAndClose: async (token, ticketId, changes) => {
          const apiTicket = await updateTicket(token, ticketId, {
            status: 'Closed',
            resident_rating: changes.rating,
            resident_feedback: changes.feedback,
          });
          applyUpdatedTicket(apiTicket);
          await get().refreshTicketHistory(token, ticketId);
        },

        refreshComments: async (token, ticketId) => {
          const apiComments = await fetchComments(token, ticketId);
          const mapped = apiComments.map(mapApiCommentToComment);
          set((state) => ({
            comments: [...state.comments.filter((c) => c.ticketId !== ticketId), ...mapped],
          }));
        },

        postCommentAction: async (token, ticketId, message) => {
          const apiComment = await postComment(token, ticketId, message);
          const comment = mapApiCommentToComment(apiComment);
          set((state) => ({ comments: [...state.comments, comment] }));
        },
      };
    },
    {
      name: 'simplifix-tickets',
      storage: createJSONStorage(() => AsyncStorage),
      // Bumped to strip the hardcoded demo dataset (`data/seed.ts`) out of AsyncStorage: the
      // store used to seed `tickets`/`media`/`history` with it directly, so every real account
      // was showing fabricated complaints (e.g. "Aditi Sharma") that don't belong to them,
      // alongside comments persisted locally before comments moved to the backend. Filtering by
      // ID rather than wiping outright preserves real local-only tickets from the emergency flow
      // (`submitComplaint`), which never sync to the backend and would otherwise be lost too.
      version: 2,
      migrate: (persistedState) => {
        const state = persistedState as TicketState;
        return {
          ...state,
          comments: [],
          tickets: state.tickets.filter((t) => !SEED_TICKET_IDS.has(t.ticketId)),
          media: state.media.filter((m) => !SEED_TICKET_IDS.has(m.ticketId)),
          history: state.history.filter((h) => !SEED_TICKET_IDS.has(h.ticketId)),
        };
      },
      // Comments are always fetched fresh from the backend, so don't persist them at all —
      // otherwise stale/local-only messages would keep reappearing on next launch.
      partialize: (state) => ({ ...state, comments: [] }),
    },
  ),
);
