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

// Total string length doesn't say much about a phone number — "+91 98765 4321098765" is 20
// characters but has way more than 10 actual digits. Validate the digit count itself: an
// optional 1-3 digit country code followed by exactly 10 digits for the local number.
const PHONE_DIGITS_PATTERN = /^(?:\d{1,3})?\d{10}$/;

export const phoneSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty('Phone number is required.'),
  v.regex(/^\+?[\d\s()-]+$/, 'Enter a valid phone number.'),
  v.check(
    (value) => PHONE_DIGITS_PATTERN.test(value.replace(/\D/g, '')),
    'Phone number must have exactly 10 digits (plus an optional country code).',
  ),
);

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
