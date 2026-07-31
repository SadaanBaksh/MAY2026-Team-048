import {
  fetchComments,
  fetchTicketHistory,
  fetchTickets,
  postComment,
  updateTicket,
  type ApiComment,
  type ApiTicket,
  type ApiTicketHistoryEntry,
} from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useTicketStore } from '@/store/ticketStore';
import type { Resident } from '@/types';

jest.mock('@/api/client', () => ({
  fetchComments: jest.fn(),
  fetchTicketHistory: jest.fn(),
  fetchTickets: jest.fn(),
  postComment: jest.fn(),
  updateTicket: jest.fn(),
}));

jest.mock('@/utils/date', () => {
  const actual = jest.requireActual('@/utils/date');
  return { ...actual, isoNow: () => '2026-07-31T12:00:00.000Z' };
});

const mockFetchComments = fetchComments as jest.MockedFunction<typeof fetchComments>;
const mockFetchTicketHistory = fetchTicketHistory as jest.MockedFunction<typeof fetchTicketHistory>;
const mockFetchTickets = fetchTickets as jest.MockedFunction<typeof fetchTickets>;
const mockPostComment = postComment as jest.MockedFunction<typeof postComment>;
const mockUpdateTicket = updateTicket as jest.MockedFunction<typeof updateTicket>;

const RESIDENT_ID = 'user_res_1';
const RESIDENT_NAME = 'Aditi Sharma';
const NOW = '2026-07-31T12:00:00.000Z';

function buildApiTicket(overrides: Partial<ApiTicket> = {}): ApiTicket {
  return {
    id: 'tkt_api1',
    resident_id: RESIDENT_ID,
    worker_id: null,
    category_id: 'cat_plumbing',
    title: 'Leaky faucet',
    resident_note: 'Drips constantly',
    image_url: null,
    media_type: null,
    voice_note_url: null,
    voice_note_duration_sec: null,
    ai_description: 'Plumbing issue',
    ai_confidence: 0.9,
    priority: 'Medium',
    status: 'Pending',
    cost_responsibility: 'Pending Review',
    date_of_request: NOW,
    date_of_resolution: null,
    resolution_remarks: null,
    resolution_proof_url: null,
    resident_rating: null,
    resident_feedback: null,
    is_overdue: false,
    media: [],
    ...overrides,
  };
}

function buildApiHistoryEntry(
  overrides: Partial<ApiTicketHistoryEntry> = {},
): ApiTicketHistoryEntry {
  return {
    id: 'hist_api1',
    ticket_id: 'tkt_api1',
    old_status: null,
    new_status: 'Pending',
    remarks: 'Complaint submitted by resident.',
    changed_at: NOW,
    actor_id: null,
    ...overrides,
  };
}

function buildApiComment(overrides: Partial<ApiComment> = {}): ApiComment {
  return {
    id: 'cmt_api1',
    ticket_id: 'tkt_api1',
    user_id: RESIDENT_ID,
    message: 'Any update?',
    posted_at: NOW,
    ...overrides,
  };
}

function residentFixture(overrides: Partial<Resident> = {}): Resident {
  return {
    userId: RESIDENT_ID,
    name: RESIDENT_NAME,
    email: 'aditi.sharma@simplifix.dev',
    phone: '123',
    avatarColor: '#000',
    createdAt: NOW,
    accountStatus: 'active',
    role: 'resident',
    apartmentId: 'apt_a101',
    ...overrides,
  };
}

describe('useTicketStore', () => {
  beforeEach(() => {
    useTicketStore.setState({
      tickets: [],
      media: [],
      history: [],
      comments: [],
      activeEmergencyAlertId: null,
    });
    useAuthStore.setState({ currentUser: null, token: null, users: [], isHydrated: false });
    useNotificationStore.setState({ notifications: [] });
    jest.clearAllMocks();
  });

  describe('submitComplaint', () => {
    const baseInput = {
      residentId: RESIDENT_ID,
      categoryId: 'cat_plumbing',
      title: 'Leaky faucet',
      aiDescription: 'Plumbing issue',
      aiConfidence: 0.9,
      priority: 'Medium' as const,
      mediaUrl: null,
      mediaType: null,
      residentNote: 'Drips constantly',
      voiceNoteUrl: null,
      voiceNoteDurationSec: null,
    };

    it('creates a Pending ticket, prepended to the list, with sensible defaults', () => {
      const ticketId = useTicketStore.getState().submitComplaint(baseInput);

      expect(ticketId).toMatch(/^tkt_/);
      const { tickets } = useTicketStore.getState();
      expect(tickets).toHaveLength(1);
      expect(tickets[0]).toMatchObject({
        ticketId,
        residentId: RESIDENT_ID,
        workerId: null,
        status: 'Pending',
        costResponsibility: 'Pending Review',
        dateOfRequest: NOW,
        dateOfResolution: null,
        isOverdue: false,
      });
    });

    it('records a media entry only when a mediaUrl/mediaType are provided', () => {
      useTicketStore
        .getState()
        .submitComplaint({ ...baseInput, mediaUrl: 'https://cdn/img.jpg', mediaType: 'Image' });
      expect(useTicketStore.getState().media).toHaveLength(1);
      expect(useTicketStore.getState().media[0]).toMatchObject({
        mediaUrl: 'https://cdn/img.jpg',
        mediaType: 'Image',
      });

      useTicketStore.getState().submitComplaint(baseInput);
      expect(useTicketStore.getState().media).toHaveLength(1); // unchanged — no media this time
    });

    it('adds a "Pending" history entry attributing the resident by name', () => {
      useTicketStore.getState().submitComplaint(baseInput);
      const { history } = useTicketStore.getState();
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        oldStatus: null,
        newStatus: 'Pending',
        remarks: 'Complaint submitted by resident.',
        actorName: RESIDENT_NAME,
        changedAt: NOW,
      });
    });

    it('falls back to "Resident" in the history entry when the resident is not in the roster', () => {
      useTicketStore.getState().submitComplaint({ ...baseInput, residentId: 'unknown_user' });
      expect(useTicketStore.getState().history[0].actorName).toBe('Resident');
    });

    it('sets activeEmergencyAlertId only for Emergency-priority complaints', () => {
      useTicketStore.getState().submitComplaint({ ...baseInput, priority: 'Low' });
      expect(useTicketStore.getState().activeEmergencyAlertId).toBeNull();

      const emergencyId = useTicketStore
        .getState()
        .submitComplaint({ ...baseInput, priority: 'Emergency' });
      expect(useTicketStore.getState().activeEmergencyAlertId).toBe(emergencyId);
    });

    it('notifies every facility_employee, with an emergency-specific message for Emergency priority', () => {
      useTicketStore.getState().submitComplaint({ ...baseInput, priority: 'Emergency' });

      const { notifications } = useNotificationStore.getState();
      expect(notifications).toHaveLength(2); // two facility_employee seed users
      expect(notifications.every((n) => n.title === 'Emergency service request')).toBe(true);
      expect(notifications[0].message).toContain(RESIDENT_NAME);
      expect(notifications[0].message).toContain('emergency assistance');
    });

    it('uses a plain "New complaint submitted" notification for non-emergency priorities', () => {
      useTicketStore.getState().submitComplaint({ ...baseInput, priority: 'Low' });
      const { notifications } = useNotificationStore.getState();
      expect(notifications.every((n) => n.title === 'New complaint submitted')).toBe(true);
    });
  });

  describe('addTicketFromApi', () => {
    it('maps the API ticket + its media into local state and records history', () => {
      const apiTicket = buildApiTicket({
        id: 'tkt_srv1',
        media: [
          {
            id: 'med1',
            ticket_id: 'tkt_srv1',
            media_url: 'https://cdn/a.jpg',
            media_type: 'Image',
            uploaded_at: NOW,
          },
        ],
      });

      const ticketId = useTicketStore.getState().addTicketFromApi(apiTicket);

      expect(ticketId).toBe('tkt_srv1');
      const state = useTicketStore.getState();
      expect(state.tickets[0].ticketId).toBe('tkt_srv1');
      expect(state.media).toHaveLength(1);
      expect(state.media[0]).toMatchObject({ ticketId: 'tkt_srv1', mediaUrl: 'https://cdn/a.jpg' });
      expect(state.history[0]).toMatchObject({
        ticketId: 'tkt_srv1',
        newStatus: 'Pending',
        actorName: RESIDENT_NAME,
      });
    });

    it('sets activeEmergencyAlertId when the incoming ticket is an Emergency', () => {
      const apiTicket = buildApiTicket({ id: 'tkt_srv2', priority: 'Emergency' });
      const ticketId = useTicketStore.getState().addTicketFromApi(apiTicket);
      expect(useTicketStore.getState().activeEmergencyAlertId).toBe(ticketId);
    });
  });

  describe('refreshTickets', () => {
    it('replaces tickets that exist on the backend but preserves local-only ones', async () => {
      useTicketStore.setState({
        tickets: [
          {
            ...mapFixtureTicket(buildApiTicket({ id: 'tkt_api1', title: 'Stale title' })),
          },
          { ...mapFixtureTicket(buildApiTicket({ id: 'tkt_local_only', title: 'Emergency draft' })) },
        ],
      });
      mockFetchTickets.mockResolvedValue([buildApiTicket({ id: 'tkt_api1', title: 'Fresh title' })]);

      await useTicketStore.getState().refreshTickets('tok');

      expect(mockFetchTickets).toHaveBeenCalledWith('tok');
      const { tickets } = useTicketStore.getState();
      expect(tickets).toHaveLength(2);
      expect(tickets.find((t) => t.ticketId === 'tkt_api1')?.title).toBe('Fresh title');
      expect(tickets.find((t) => t.ticketId === 'tkt_local_only')).toBeDefined();
    });
  });

  describe('refreshTicketHistory', () => {
    it('resolves actor names via the auth roster and replaces only that ticket’s history', async () => {
      useAuthStore.setState({ users: [residentFixture()] });
      useTicketStore.setState({
        history: [
          {
            historyId: 'h_other',
            ticketId: 'tkt_other',
            oldStatus: null,
            newStatus: 'Pending',
            remarks: 'unrelated',
            changedAt: NOW,
            actorName: 'Someone',
          },
        ],
      });
      mockFetchTicketHistory.mockResolvedValue([
        buildApiHistoryEntry({ id: 'h1', ticket_id: 'tkt_api1', actor_id: RESIDENT_ID }),
        buildApiHistoryEntry({ id: 'h2', ticket_id: 'tkt_api1', actor_id: 'unknown_actor' }),
      ]);

      await useTicketStore.getState().refreshTicketHistory('tok', 'tkt_api1');

      const { history } = useTicketStore.getState();
      expect(history.find((h) => h.historyId === 'h_other')).toBeDefined();
      expect(history.find((h) => h.historyId === 'h1')?.actorName).toBe(RESIDENT_NAME);
      expect(history.find((h) => h.historyId === 'h2')?.actorName).toBe('Unknown');
    });
  });

  describe('ticket lifecycle actions', () => {
    beforeEach(() => {
      useTicketStore.setState({ tickets: [mapFixtureTicket(buildApiTicket())] });
      mockFetchTicketHistory.mockResolvedValue([]);
    });

    it('reviewAndAssign PATCHes the assignment fields, applies the result, and clears a matching emergency alert', async () => {
      useTicketStore.setState({ activeEmergencyAlertId: 'tkt_api1' });
      mockUpdateTicket.mockResolvedValue(
        buildApiTicket({ status: 'Assigned', worker_id: 'w1', priority: 'High' }),
      );

      await useTicketStore.getState().reviewAndAssign(
        'tok',
        'tkt_api1',
        { categoryId: 'cat_plumbing', priority: 'High', workerId: 'w1', costResponsibility: 'Owner' },
        { name: 'Neha', role: 'facility_employee' },
      );

      expect(mockUpdateTicket).toHaveBeenCalledWith('tok', 'tkt_api1', {
        category_id: 'cat_plumbing',
        worker_id: 'w1',
        priority: 'High',
        cost_responsibility: 'Owner',
        status: 'Assigned',
      });
      const state = useTicketStore.getState();
      expect(state.tickets[0].status).toBe('Assigned');
      expect(state.tickets[0].workerId).toBe('w1');
      expect(state.activeEmergencyAlertId).toBeNull();
      expect(mockFetchTicketHistory).toHaveBeenCalledWith('tok', 'tkt_api1');
    });

    it('reviewAndAssign leaves an unrelated active emergency alert untouched', async () => {
      useTicketStore.setState({ activeEmergencyAlertId: 'tkt_other' });
      mockUpdateTicket.mockResolvedValue(buildApiTicket({ status: 'Assigned' }));

      await useTicketStore
        .getState()
        .reviewAndAssign(
          'tok',
          'tkt_api1',
          { categoryId: 'cat_plumbing', priority: 'High', workerId: 'w1', costResponsibility: 'Owner' },
          { name: 'Neha', role: 'facility_employee' },
        );

      expect(useTicketStore.getState().activeEmergencyAlertId).toBe('tkt_other');
    });

    it('updateCostResponsibility PATCHes only cost_responsibility and applies the result', async () => {
      mockUpdateTicket.mockResolvedValue(buildApiTicket({ cost_responsibility: 'Resident' }));

      await useTicketStore.getState().updateCostResponsibility('tok', 'tkt_api1', 'Resident');

      expect(mockUpdateTicket).toHaveBeenCalledWith('tok', 'tkt_api1', {
        cost_responsibility: 'Resident',
      });
      expect(useTicketStore.getState().tickets[0].costResponsibility).toBe('Resident');
    });

    it('startProgress PATCHes status to In_Progress, applies the result, and refreshes history', async () => {
      mockUpdateTicket.mockResolvedValue(buildApiTicket({ status: 'In_Progress' }));

      await useTicketStore
        .getState()
        .startProgress('tok', 'tkt_api1', { name: 'Worker', role: 'maintenance_staff' });

      expect(mockUpdateTicket).toHaveBeenCalledWith('tok', 'tkt_api1', { status: 'In_Progress' });
      expect(useTicketStore.getState().tickets[0].status).toBe('In_Progress');
      expect(mockFetchTicketHistory).toHaveBeenCalledWith('tok', 'tkt_api1');
    });

    it('resolveTicket PATCHes resolution fields and refreshes history', async () => {
      mockUpdateTicket.mockResolvedValue(
        buildApiTicket({
          status: 'Resolved',
          resolution_remarks: 'Fixed the valve',
          resolution_proof_url: 'https://cdn/proof.jpg',
        }),
      );

      await useTicketStore.getState().resolveTicket(
        'tok',
        'tkt_api1',
        { remarks: 'Fixed the valve', proofUrl: 'https://cdn/proof.jpg' },
        { name: 'Worker', role: 'maintenance_staff' },
      );

      expect(mockUpdateTicket).toHaveBeenCalledWith('tok', 'tkt_api1', {
        status: 'Resolved',
        resolution_remarks: 'Fixed the valve',
        resolution_proof_url: 'https://cdn/proof.jpg',
      });
      expect(useTicketStore.getState().tickets[0]).toMatchObject({
        status: 'Resolved',
        resolutionRemarks: 'Fixed the valve',
      });
    });

    it('verifyAndClose PATCHes status/rating/feedback and refreshes history', async () => {
      mockUpdateTicket.mockResolvedValue(
        buildApiTicket({ status: 'Closed', resident_rating: 5, resident_feedback: 'Great job' }),
      );

      await useTicketStore
        .getState()
        .verifyAndClose('tok', 'tkt_api1', { rating: 5, feedback: 'Great job' });

      expect(mockUpdateTicket).toHaveBeenCalledWith('tok', 'tkt_api1', {
        status: 'Closed',
        resident_rating: 5,
        resident_feedback: 'Great job',
      });
      expect(useTicketStore.getState().tickets[0]).toMatchObject({
        status: 'Closed',
        residentRating: 5,
        residentFeedback: 'Great job',
      });
    });
  });

  describe('comments', () => {
    it('refreshComments resolves the author via the auth roster and replaces only that ticket’s comments', async () => {
      useAuthStore.setState({ users: [residentFixture()] });
      useTicketStore.setState({
        comments: [
          {
            commentId: 'c_other',
            ticketId: 'tkt_other',
            userId: RESIDENT_ID,
            authorName: RESIDENT_NAME,
            authorRole: 'resident',
            message: 'unrelated',
            postedAt: NOW,
          },
        ],
      });
      mockFetchComments.mockResolvedValue([
        buildApiComment({ id: 'c1', ticket_id: 'tkt_api1', user_id: RESIDENT_ID }),
        buildApiComment({ id: 'c2', ticket_id: 'tkt_api1', user_id: 'unknown_user' }),
      ]);

      await useTicketStore.getState().refreshComments('tok', 'tkt_api1');

      const { comments } = useTicketStore.getState();
      expect(comments.find((c) => c.commentId === 'c_other')).toBeDefined();
      const c1 = comments.find((c) => c.commentId === 'c1');
      expect(c1).toMatchObject({ authorName: RESIDENT_NAME, authorRole: 'resident' });
      const c2 = comments.find((c) => c.commentId === 'c2');
      expect(c2).toMatchObject({ authorName: 'Unknown user', authorRole: 'resident' });
    });

    it('postCommentAction posts the message and appends the mapped comment', async () => {
      useAuthStore.setState({ users: [residentFixture()] });
      mockPostComment.mockResolvedValue(
        buildApiComment({ id: 'c_new', ticket_id: 'tkt_api1', message: 'On my way' }),
      );

      await useTicketStore.getState().postCommentAction('tok', 'tkt_api1', 'On my way');

      expect(mockPostComment).toHaveBeenCalledWith('tok', 'tkt_api1', 'On my way');
      const { comments } = useTicketStore.getState();
      expect(comments).toHaveLength(1);
      expect(comments[0]).toMatchObject({
        ticketId: 'tkt_api1',
        message: 'On my way',
        authorName: RESIDENT_NAME,
      });
    });
  });
});

function mapFixtureTicket(apiTicket: ApiTicket) {
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
