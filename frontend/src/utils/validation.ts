import * as v from 'valibot';

// 254 is the practical RFC 5321 max for a full email address, and safely under the backend's
// `String(255)` column — capping here avoids ever handing the DB something it'd reject outright.
export const emailSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty('Email is required.'),
  v.email('Enter a valid email address.'),
  v.maxLength(254, 'Email must be 254 characters or fewer.'),
);

// Indian mobile numbers: exactly 10 digits, optionally prefixed with either the 91 country
// code (with or without a leading +) or a single trunk "0" — not both at once — first digit
// of the 10-digit number must be 6-9. Checked against the digits-only string (formatting
// stripped first) so "+91 98765 43210", "+91-98765-43210", and "09876543210" are all handled.
const PHONE_DIGITS_PATTERN = /^(?:91|0)?[6-9]\d{9}$/;

export const phoneSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty('Phone number is required.'),
  v.regex(/^\+?[\d\s()-]+$/, 'Enter a valid phone number.'),
  v.check(
    (value) => PHONE_DIGITS_PATTERN.test(value.replace(/\D/g, '')),
    'Enter a valid 10-digit Indian mobile number (starting 6-9, optional 0 or 91 prefix).',
  ),
);

/**
 * Converts any phoneSchema-valid input into the canonical storage/display format
 * "+91 98765 43210", regardless of which accepted prefix (none, 0, 91, +91) or formatting
 * (spaces, dashes) was typed. Only call this after `phoneSchema` has already validated the
 * value — it assumes a guaranteed 10-13 digit structure and just takes the last 10 digits.
 */
export function toCanonicalPhone(value: string): string {
  const core = value.replace(/\D/g, '').slice(-10);
  return `+91 ${core.slice(0, 5)} ${core.slice(5)}`;
}

// bcrypt (used server-side) hard-caps input at 72 bytes and throws if exceeded — this has
// already crashed registration once (see backend/SETUP.md's troubleshooting table). 72
// characters is a close-enough proxy client-side; the backend enforces the exact byte count.
export const passwordSchema = v.pipe(
  v.string(),
  v.minLength(8, 'Password must be at least 8 characters.'),
  v.maxLength(72, 'Password must be 72 characters or fewer.'),
);

/** Pulls the first error message out of a valibot `safeParse` result, or null if it passed. */
export function firstIssueMessage(result: {
  success: boolean;
  issues?: readonly { message: string }[];
}): string | null {
  if (result.success) return null;
  return result.issues?.[0]?.message ?? 'Invalid input.';
}
