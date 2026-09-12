import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ecommerce-x/db";
import { COOKIE_NAMES, PHONE_REGEX, PHONE_VALIDATION_MESSAGE } from "@ecommerce-x/shared";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import { hashPassword, verifyPassword, passwordSchema } from "../../lib/password.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/jwt.js";
import { HttpError } from "../../lib/http-error.js";
import { env } from "../../config/env.js";
import { authLimiter } from "../../middleware/rate-limit.js";
import { logAudit } from "../../lib/audit-log.js";
import { createHash } from "node:crypto";

export const authRouter = Router();

const isProd = env.nodeEnv === "production";

function setAuthCookies(res: import("express").Response, accessToken: string, refreshToken: string) {
  res.cookie(COOKIE_NAMES.accessToken, accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 15 * 60 * 1000,
  });
  res.cookie(COOKIE_NAMES.refreshToken, refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/api/auth",
  });
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function issueSession(res: import("express").Response, user: { id: string; role: string; phone: string | null; email: string | null }) {
  const accessToken = signAccessToken({ sub: user.id, role: user.role, phone: user.phone, email: user.email });
  const refreshToken = signRefreshToken({ sub: user.id, role: user.role, phone: user.phone, email: user.email });
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: tokenHash(refreshToken), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  });
  setAuthCookies(res, accessToken, refreshToken);
  return accessToken;
}

// Phone is the primary identifier across the app; email stays a fully
// optional secondary contact field, never required for register/login.
const phoneSchema = z.string().trim().regex(PHONE_REGEX, PHONE_VALIDATION_MESSAGE);

const registerSchema = z.object({
  phone: phoneSchema,
  password: passwordSchema,
  firstName: z.string().min(1),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")),
});

authRouter.post(
  "/register",
  authLimiter,
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (existing) throw HttpError.conflict("An account with this phone number already exists");

    const user = await prisma.user.create({
      data: {
        phone: data.phone,
        email: data.email || undefined,
        passwordHash: await hashPassword(data.password),
        firstName: data.firstName,
        lastName: data.lastName,
        role: "CUSTOMER",
      },
    });

    const accessToken = await issueSession(res, user);
    res.status(201).json({ user: sanitizeUser(user), accessToken });
  })
);

// Accepts either identifier so any legacy email-only account keeps working,
// but phone is what every UI form actually presents.
const loginSchema = z
  .object({ phone: z.string().trim().min(1).optional(), email: z.string().trim().min(1).optional(), password: z.string() })
  .refine((d) => d.phone || d.email, { message: "Phone number is required" });

async function findByIdentifier(identifier: { phone?: string; email?: string }) {
  if (identifier.phone) return prisma.user.findUnique({ where: { phone: identifier.phone } });
  if (identifier.email) return prisma.user.findUnique({ where: { email: identifier.email } });
  return null;
}

// The IP-based authLimiter alone can't stop a distributed attacker (many
// IPs / a botnet) from brute-forcing one specific known phone number
// indefinitely. This adds a per-account counter that locks the account
// itself for a cooldown period, independent of which IP is attempting it.
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const ACCOUNT_LOCKOUT_MS = 15 * 60 * 1000;

function assertAccountNotLocked(user: { lockedUntil: Date | null }) {
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    throw HttpError.unauthorized(`Too many failed attempts on this account. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
  }
}

async function recordFailedLogin(userId: string, ip: string | undefined) {
  const updated = await prisma.user.update({ where: { id: userId }, data: { failedLoginCount: { increment: 1 } } });
  if (updated.failedLoginCount >= MAX_FAILED_LOGIN_ATTEMPTS) {
    await prisma.user.update({ where: { id: userId }, data: { lockedUntil: new Date(Date.now() + ACCOUNT_LOCKOUT_MS), failedLoginCount: 0 } });
    await logAudit({ userId, action: "account.locked", entityType: "User", entityId: userId, metadata: { reason: "too many failed login attempts" }, ipAddress: ip });
  }
}

async function clearFailedLogins(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { failedLoginCount: 0, lockedUntil: null } });
}

authRouter.post(
  "/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { phone, email, password } = loginSchema.parse(req.body);
    const user = await findByIdentifier({ phone, email });
    if (!user || !user.passwordHash || !user.isActive) throw HttpError.unauthorized("Invalid phone number or password");
    assertAccountNotLocked(user);
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await recordFailedLogin(user.id, req.ip);
      throw HttpError.unauthorized("Invalid phone number or password");
    }
    await clearFailedLogins(user.id);

    const accessToken = await issueSession(res, user);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    res.json({ user: sanitizeUser(user), accessToken });
  })
);

// Staff/admin login is the same endpoint but this alias makes intent explicit for the admin app.
authRouter.post(
  "/staff-login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { phone, email, password } = loginSchema.parse(req.body);
    const user = await findByIdentifier({ phone, email });
    if (!user || !user.passwordHash || !user.isActive) throw HttpError.unauthorized("Invalid phone number or password");
    if (user.role === "CUSTOMER") throw HttpError.forbidden("This account does not have staff access");
    assertAccountNotLocked(user);
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await recordFailedLogin(user.id, req.ip);
      throw HttpError.unauthorized("Invalid phone number or password");
    }
    await clearFailedLogins(user.id);

    const accessToken = await issueSession(res, user);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    res.json({ user: sanitizeUser(user), accessToken });
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[COOKIE_NAMES.refreshToken] ?? req.body?.refreshToken;
    if (!token) throw HttpError.unauthorized("Missing refresh token");

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw HttpError.unauthorized("Invalid refresh token");
    }

    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: tokenHash(token) } });
    if (!stored) throw HttpError.unauthorized("Refresh token expired or revoked");

    // A refresh token that was already rotated/revoked being presented
    // again means either a duplicate request race, or someone replaying a
    // stolen copy after the legitimate user already moved past it. Since we
    // can't tell those apart, treat it as a compromise signal and revoke
    // every one of this user's sessions rather than just this one token —
    // otherwise a still-valid token the real thief also holds keeps working.
    if (stored.revokedAt) {
      await prisma.refreshToken.updateMany({ where: { userId: stored.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await logAudit({ userId: stored.userId, action: "auth.refresh_token_reuse_detected", metadata: { ip: req.ip }, ipAddress: req.ip });
      throw HttpError.unauthorized("Refresh token expired or revoked");
    }
    if (stored.expiresAt < new Date()) {
      throw HttpError.unauthorized("Refresh token expired or revoked");
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw HttpError.unauthorized();

    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const accessToken = await issueSession(res, user);
    res.json({ accessToken });
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[COOKIE_NAMES.refreshToken];
    if (token) {
      await prisma.refreshToken.updateMany({ where: { tokenHash: tokenHash(token) }, data: { revokedAt: new Date() } });
    }
    res.clearCookie(COOKIE_NAMES.accessToken);
    res.clearCookie(COOKIE_NAMES.refreshToken, { path: "/api/auth" });
    res.json({ success: true });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw HttpError.notFound("User not found");
    res.json({ user: sanitizeUser(user) });
  })
);

const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
});

authRouter.put(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = updateProfileSchema.parse(req.body);
    if (data.email) {
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing && existing.id !== req.user!.id) throw HttpError.conflict("That email is already in use by another account");
    }
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email === undefined ? undefined : data.email || null,
      },
    });
    res.json({ user: sanitizeUser(user) });
  })
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

authRouter.post(
  "/change-password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!user.passwordHash || !(await verifyPassword(currentPassword, user.passwordHash))) {
      throw HttpError.unauthorized("Current password is incorrect");
    }

    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
    // Changing your own password ends every other session — only this
    // device stays signed in (a fresh session is issued right after).
    await prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await logAudit({ userId: user.id, action: "auth.password_changed_self", entityType: "User", entityId: user.id, ipAddress: req.ip });

    const accessToken = await issueSession(res, user);
    res.json({ user: sanitizeUser(user), accessToken });
  })
);

function sanitizeUser(user: {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: string;
  loyaltyPoints: number;
  avatarUrl: string | null;
}) {
  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    loyaltyPoints: user.loyaltyPoints,
    avatarUrl: user.avatarUrl,
  };
}
