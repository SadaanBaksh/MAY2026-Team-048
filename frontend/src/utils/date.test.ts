import { formatFullDate, formatShortDate, hoursSince, isoNow, timeAgo } from '@/utils/date';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

const NOW = new Date('2026-07-31T12:00:00.000Z');

describe('date utils', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('timeAgo', () => {
    it('returns "just now" for timestamps under a minute old', () => {
      const thirtySecondsAgo = new Date(NOW.getTime() - 30 * 1000).toISOString();
      expect(timeAgo(thirtySecondsAgo)).toBe('just now');
    });

    it('returns minutes for timestamps under an hour old', () => {
      const fiveMinutesAgo = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString();
      expect(timeAgo(fiveMinutesAgo)).toBe('5m ago');
    });

    it('returns hours for timestamps under a day old', () => {
      const threeHoursAgo = new Date(NOW.getTime() - 3 * 60 * 60 * 1000).toISOString();
      expect(timeAgo(threeHoursAgo)).toBe('3h ago');
    });

    it('returns days for timestamps under a week old', () => {
      const twoDaysAgo = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
      expect(timeAgo(twoDaysAgo)).toBe('2d ago');
    });

    it('falls back to a short date for timestamps a week or older', () => {
      const tenDaysAgo = new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000);
      expect(timeAgo(tenDaysAgo.toISOString())).toBe(formatShortDate(tenDaysAgo.toISOString()));
    });

    it('treats the minute/hour/day boundaries as exclusive', () => {
      const exactlyOneMinuteAgo = new Date(NOW.getTime() - 60 * 1000).toISOString();
      expect(timeAgo(exactlyOneMinuteAgo)).toBe('1m ago');

      const exactlyOneHourAgo = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
      expect(timeAgo(exactlyOneHourAgo)).toBe('1h ago');

      const exactlyOneDayAgo = new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString();
      expect(timeAgo(exactlyOneDayAgo)).toBe('1d ago');
    });
  });

  describe('formatShortDate', () => {
    it('formats as abbreviated month and day in the local timezone', () => {
      const isoDate = '2026-03-05T18:00:00.000Z';
      const expected = new Date(isoDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      expect(formatShortDate(isoDate)).toBe(expected);
    });
  });

  describe('formatFullDate', () => {
    it('formats with month, day, year, hour and minute in the local timezone', () => {
      const isoDate = '2026-03-05T15:30:00.000Z';
      const expected = new Date(isoDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
      expect(formatFullDate(isoDate)).toBe(expected);
    });
  });

  describe('hoursSince', () => {
    it('computes the elapsed hours as a float', () => {
      const ninetyMinutesAgo = new Date(NOW.getTime() - 90 * 60 * 1000).toISOString();
      expect(hoursSince(ninetyMinutesAgo)).toBeCloseTo(1.5, 5);
    });

    it('returns 0 for the current instant', () => {
      expect(hoursSince(NOW.toISOString())).toBe(0);
    });
  });

  describe('isoNow', () => {
    it('returns the current time as an ISO string', () => {
      expect(isoNow()).toBe(NOW.toISOString());
    });
  });
});
