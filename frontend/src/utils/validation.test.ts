import * as v from 'valibot';

import {
  emailSchema,
  firstIssueMessage,
  passwordSchema,
  phoneSchema,
} from '@/utils/validation';

describe('emailSchema', () => {
  it('accepts a valid email', () => {
    const result = v.safeParse(emailSchema, 'user@example.com');
    expect(result.success).toBe(true);
  });

  it('trims surrounding whitespace before validating', () => {
    const result = v.safeParse(emailSchema, '  user@example.com  ');
    expect(result.success).toBe(true);
    expect(result.success && result.output).toBe('user@example.com');
  });

  it('rejects an empty string', () => {
    const result = v.safeParse(emailSchema, '');
    expect(result.success).toBe(false);
  });

  it('rejects a string missing the @ sign', () => {
    const result = v.safeParse(emailSchema, 'not-an-email');
    expect(result.success).toBe(false);
  });
});

describe('phoneSchema', () => {
  it('accepts a plain 10-digit number starting 6-9', () => {
    expect(v.safeParse(phoneSchema, '9876543210').success).toBe(true);
  });

  it('accepts a number with the 91 country code, spaces and a leading +', () => {
    expect(v.safeParse(phoneSchema, '+91 98765 43210').success).toBe(true);
  });

  it('accepts a number with the 91 country code and no +', () => {
    expect(v.safeParse(phoneSchema, '91 98765 43210').success).toBe(true);
  });

  it('accepts a number with a leading trunk 0', () => {
    expect(v.safeParse(phoneSchema, '09876543211').success).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(v.safeParse(phoneSchema, '').success).toBe(false);
  });

  it('rejects a too-short number', () => {
    expect(v.safeParse(phoneSchema, '123').success).toBe(false);
  });

  it('rejects letters', () => {
    expect(v.safeParse(phoneSchema, 'abcdefghij').success).toBe(false);
  });

  it('rejects a number whose first digit is below 6', () => {
    expect(v.safeParse(phoneSchema, '5876543210').success).toBe(false);
  });

  it('rejects a non-Indian country code like +1', () => {
    expect(v.safeParse(phoneSchema, '+1 (234) 567-8900').success).toBe(false);
  });

  it('rejects both a leading 0 and a 91 prefix at once', () => {
    expect(v.safeParse(phoneSchema, '0919876543210').success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('accepts a password with at least 8 characters', () => {
    expect(v.safeParse(passwordSchema, 'Demo@1234').success).toBe(true);
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(v.safeParse(passwordSchema, 'short1').success).toBe(false);
  });
});

describe('firstIssueMessage', () => {
  it('returns null when the result succeeded', () => {
    const result = v.safeParse(emailSchema, 'user@example.com');
    expect(firstIssueMessage(result)).toBeNull();
  });

  it('returns the first issue message when the result failed', () => {
    const result = v.safeParse(emailSchema, '');
    expect(firstIssueMessage(result)).toBe('Email is required.');
  });

  it('falls back to a generic message when issues are missing', () => {
    expect(firstIssueMessage({ success: false })).toBe('Invalid input.');
  });
});
