import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ecommerce-x/db";
import { COOKIE_NAMES } from "@ecommerce-x/shared";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/jwt.js";
import { HttpError } from "../../lib/http-error.js";
import { env } from "../../config/env.js";
import { authLimiter } from "../../middleware/rate-limit.js";
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
const phoneSchema = z.string().trim().min(7, "Enter a valid phone number").max(20);

const registerSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(8),
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

authRouter.post(
  "/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { phone, email, password } = loginSchema.parse(req.body);
    const user = await findByIdentifier({ phone, email });
    if (!user || !user.passwordHash || !user.isActive) throw HttpError.unauthorized("Invalid phone number or password");
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) throw HttpError.unauthorized("Invalid phone number or password");

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
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) throw HttpError.unauthorized("Invalid phone number or password");

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
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
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
