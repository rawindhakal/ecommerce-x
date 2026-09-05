import { rateLimit } from "express-rate-limit";

// Auth endpoints get a much tighter, dedicated limit than the general
// /api budget — login/register are the classic brute-force / enumeration
// targets and shouldn't be able to burn through 300 req/min like normal
// browsing traffic can.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please wait a few minutes and try again.", code: "RATE_LIMITED" },
});
