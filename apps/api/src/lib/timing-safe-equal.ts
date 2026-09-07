import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison for HMAC signatures. Plain `===` short-
 * circuits on the first differing byte, which leaks timing information an
 * attacker can use to forge a valid signature byte-by-byte. Payment gateway
 * signature checks must never use `===`/`!==` for this reason.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
