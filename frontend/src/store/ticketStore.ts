import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { COMMENTS, COMPLAINT_HISTORY, COMPLAINT_MEDIA, TICKETS, USERS } from '@/data/seed';
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
  mediaUrl: string;
  mediaType: MediaType;
  residentNote: string;
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

  submitComplaint: (input: SubmitComplaintInput) => string;
  reviewAndAssign: (
    ticketId: string,
    changes: {
      categoryId: string;
      priority: Priority;
      workerId: string;
      costResponsibility: CostResponsibility;
    },
    actor: Actor,
  ) => void;
  updateCostResponsibility: (ticketId: string, costResponsibility: CostResponsibility) => void;
  startProgress: (ticketId: string, actor: Actor) => void;
  resolveTicket: (
    ticketId: string,
    changes: { remarks: string; proofUrl: string },
    actor: Actor,
  ) => void;
  verifyAndClose: (ticketId: string, changes: { rating: number; feedback: string }) => void;
  addComment: (
    ticketId: string,
    input: { userId: string; authorName: string; authorRole: string; message: string },
  ) => void;
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

export const useTicketStore = create<TicketState>()(
  persist(
    (set, get) => ({
      tickets: TICKETS,
      media: COMPLAINT_MEDIA,
      history: COMPLAINT_HISTORY,
      comments: COMMENTS,

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
          media: [
            ...state.media,
            {
              mediaId: generateId('media'),
              ticketId,
              mediaUrl: input.mediaUrl,
              mediaType: input.mediaType,
              uploadedAt: isoNow(),
            },
          ],
          history: pushHistory(
            state,
            ticketId,
            null,
            'Pending',
            'Complaint submitted by resident.',
            resident?.name ?? 'Resident',
          ),
        }));

        const employees = USERS.filter((u) => u.role === 'facility_employee');
        employees.forEach((emp) => {
          useNotificationStore.getState().addNotification({
            userId: emp.userId,
            ticketId,
            title: 'New complaint submitted',
            message: `${resident?.name ?? 'A resident'} reported: ${input.title}`,
          });
        });

        return ticketId;
      },

      reviewAndAssign: (ticketId, changes, actor) => {
        const worker = USERS.find((u) => u.userId === changes.workerId);
        set((state) => ({
          tickets: state.tickets.map((t) =>
            t.ticketId === ticketId
              ? {
                  ...t,
                  categoryId: changes.categoryId,
                  priority: changes.priority,
                  workerId: changes.workerId,
                  costResponsibility: changes.costResponsibility,
                  status: 'Assigned' as TicketStatus,
                }
              : t,
          ),
          history: pushHistory(
            state,
            ticketId,
            state.tickets.find((t) => t.ticketId === ticketId)?.status ?? 'Pending',
            'Assigned',
            `Assigned to ${worker?.name ?? 'maintenance staff'}.`,
            actor.name,
          ),
        }));

        const ticket = get().tickets.find((t) => t.ticketId === ticketId);
        if (worker) {
          useNotificationStore.getState().addNotification({
            userId: worker.userId,
            ticketId,
            title: 'New assignment',
            message: `You have been assigned: ${ticket?.title ?? 'a complaint'}.`,
          });
        }
        if (ticket) {
          useNotificationStore.getState().addNotification({
            userId: ticket.residentId,
            ticketId,
            title: 'Complaint assigned',
            message: `${worker?.name ?? 'A technician'} has been assigned to your complaint.`,
          });
        }
      },

      updateCostResponsibility: (ticketId, costResponsibility) =>
        set((state) => ({
          tickets: state.tickets.map((t) =>
            t.ticketId === ticketId ? { ...t, costResponsibility } : t,
          ),
        })),

      startProgress: (ticketId, actor) => {
        set((state) => ({
          tickets: state.tickets.map((t) =>
            t.ticketId === ticketId ? { ...t, status: 'In_Progress' as TicketStatus } : t,
          ),
          history: pushHistory(
            state,
            ticketId,
            'Assigned',
            'In_Progress',
            'Work has started on-site.',
            actor.name,
          ),
        }));
        const ticket = get().tickets.find((t) => t.ticketId === ticketId);
        if (ticket) {
          useNotificationStore.getState().addNotification({
            userId: ticket.residentId,
            ticketId,
            title: 'Work started',
            message: `${actor.name} has started work on: ${ticket.title}.`,
          });
        }
      },

      resolveTicket: (ticketId, changes, actor) => {
        set((state) => ({
          tickets: state.tickets.map((t) =>
            t.ticketId === ticketId
              ? {
                  ...t,
                  status: 'Resolved' as TicketStatus,
                  dateOfResolution: isoNow(),
                  resolutionRemarks: changes.remarks,
                  resolutionProofUrl: changes.proofUrl,
                }
              : t,
          ),
          history: pushHistory(
            state,
            ticketId,
            'In_Progress',
            'Resolved',
            changes.remarks,
            actor.name,
          ),
        }));
        const ticket = get().tickets.find((t) => t.ticketId === ticketId);
        if (ticket) {
          useNotificationStore.getState().addNotification({
            userId: ticket.residentId,
            ticketId,
            title: 'Complaint resolved',
            message: `Your complaint "${ticket.title}" has been marked resolved. Please verify and rate.`,
          });
          const employees = USERS.filter((u) => u.role === 'facility_employee');
          employees.forEach((emp) => {
            useNotificationStore.getState().addNotification({
              userId: emp.userId,
              ticketId,
              title: 'Work completed',
              message: `${actor.name} completed: ${ticket.title}.`,
            });
          });
        }
      },

      verifyAndClose: (ticketId, changes) => {
        set((state) => ({
          tickets: state.tickets.map((t) =>
            t.ticketId === ticketId
              ? {
                  ...t,
                  status: 'Closed' as TicketStatus,
                  residentRating: changes.rating,
                  residentFeedback: changes.feedback,
                }
              : t,
          ),
          history: pushHistory(
            state,
            ticketId,
            'Resolved',
            'Closed',
            'Resident verified the resolution and closed the complaint.',
            'Resident',
          ),
        }));
        const ticket = get().tickets.find((t) => t.ticketId === ticketId);
        if (ticket?.workerId) {
          useNotificationStore.getState().addNotification({
            userId: ticket.workerId,
            ticketId,
            title: 'Resident feedback received',
            message: `You were rated ${changes.rating}/5 for: ${ticket.title}.`,
          });
        }
      },

      addComment: (ticketId, input) =>
        set((state) => ({
          comments: [
            ...state.comments,
            {
              commentId: generateId('cmt'),
              ticketId,
              userId: input.userId,
              authorName: input.authorName,
              authorRole: input.authorRole as Comment['authorRole'],
              message: input.message,
              postedAt: isoNow(),
            },
          ],
        })),
    }),
    {
      name: 'simplifix-tickets',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
