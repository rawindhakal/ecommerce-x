// Digits only — no spaces, dashes, parentheses, or a leading "+". Kept
// intentionally generic (7-15 digits, the ITU E.164 range) rather than
// Nepal-specific, since staff/test accounts use varied lengths. Used both
// server-side (zod `.regex(PHONE_REGEX)`) and client-side (paired with
// `sanitizePhoneInput` so the field can't even contain a non-digit).
export const PHONE_REGEX = /^\d{7,15}$/;

export const PHONE_VALIDATION_MESSAGE = "Enter a valid phone number (7-15 digits, numbers only)";

/** Strips everything but digits — use as the onChange transform for any phone `<input>`. */
export function sanitizePhoneInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 15);
}
