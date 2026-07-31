import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Ticket, TicketStatus } from '@/types';
import { isTicketOverdue } from '@/utils/overdue';

const NOW = new Date('2026-07-31T12:00:00.000Z');

function hoursAgoIso(hours: number): string {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();
}

function buildTicket(overrides: Partial<Ticket> & { status: TicketStatus }): Ticket {
  return {
    ticketId: 'tkt_1',
    residentId: 'usr_1',
    workerId: null,
    categoryId: 'cat_1',
    imageUrl: null,
    mediaType: null,
    residentNote: 'Leaky faucet',
    voiceNoteUrl: null,
    voiceNoteDurationSec: null,
    aiDescription: 'Plumbing issue',
    aiConfidence: 0.9,
    priority: 'Medium',
    costResponsibility: 'Pending Review',
    dateOfRequest: hoursAgoIso(0),
    dateOfResolution: null,
    resolutionRemarks: null,
    resolutionProofUrl: null,
    residentRating: null,
    residentFeedback: null,
    isOverdue: false,
    title: 'Leaky faucet',
    ...overrides,
  };
}

describe('isTicketOverdue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe.each(['Pending', 'Assigned'] as const)('when status is %s', (status) => {
    it('is not overdue exactly at the 24h SLA boundary', () => {
      const ticket = buildTicket({ status, dateOfRequest: hoursAgoIso(24) });
      expect(isTicketOverdue(ticket)).toBe(false);
    });

    it('is overdue just past the 24h SLA boundary', () => {
      const ticket = buildTicket({ status, dateOfRequest: hoursAgoIso(24.01) });
      expect(isTicketOverdue(ticket)).toBe(true);
    });

    it('is not overdue well within the SLA', () => {
      const ticket = buildTicket({ status, dateOfRequest: hoursAgoIso(1) });
      expect(isTicketOverdue(ticket)).toBe(false);
    });
  });

  describe('when status is In_Progress', () => {
    it('is not overdue exactly at the 72h SLA boundary', () => {
      const ticket = buildTicket({ status: 'In_Progress', dateOfRequest: hoursAgoIso(72) });
      expect(isTicketOverdue(ticket)).toBe(false);
    });

    it('is overdue just past the 72h SLA boundary', () => {
      const ticket = buildTicket({ status: 'In_Progress', dateOfRequest: hoursAgoIso(72.01) });
      expect(isTicketOverdue(ticket)).toBe(true);
    });

    it('is not overdue after only 24h (the shorter Pending/Assigned SLA does not apply)', () => {
      const ticket = buildTicket({ status: 'In_Progress', dateOfRequest: hoursAgoIso(25) });
      expect(isTicketOverdue(ticket)).toBe(false);
    });
  });

  describe.each(['Resolved', 'Closed'] as const)('when status is %s', (status) => {
    it('is never overdue, regardless of how old the request is', () => {
      const ticket = buildTicket({ status, dateOfRequest: hoursAgoIso(24 * 30) });
      expect(isTicketOverdue(ticket)).toBe(false);
    });
  });
});
