import * as v from 'valibot';

export const emailSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty('Email is required.'),
  v.email('Enter a valid email address.'),
);

export const phoneSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty('Phone number is required.'),
  v.regex(/^\+?[\d\s()-]{7,20}$/, 'Enter a valid phone number.'),
);

export const passwordSchema = v.pipe(
  v.string(),
  v.minLength(8, 'Password must be at least 8 characters.'),
);

/** Pulls the first error message out of a valibot `safeParse` result, or null if it passed. */
export function firstIssueMessage(result: {
  success: boolean;
  issues?: readonly { message: string }[];
}): string | null {
  if (result.success) return null;
  return result.issues?.[0]?.message ?? 'Invalid input.';
}
