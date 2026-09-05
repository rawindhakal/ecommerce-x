import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@ecommerce-x/db";
import { COOKIE_NAMES } from "@ecommerce-x/shared";
import { verifyAccessToken } from "../lib/jwt.js";
import { HttpError } from "../lib/http-error.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: UserRole; phone?: string | null; email?: string | null };
    }
  }
}

function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return req.cookies?.[COOKIE_NAMES.accessToken];
}

export function authenticate(required: boolean) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const token = extractToken(req);
    if (!token) {
      if (required) return next(HttpError.unauthorized());
      return next();
    }
    try {
      const payload = verifyAccessToken(token);
      req.user = { id: payload.sub, role: payload.role as UserRole, phone: payload.phone, email: payload.email };
      next();
    } catch {
      if (required) return next(HttpError.unauthorized("Invalid or expired token"));
      next();
    }
  };
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(HttpError.unauthorized());
    if (!roles.includes(req.user.role)) return next(HttpError.forbidden("Insufficient permissions"));
    next();
  };
}

export const requireAuth = authenticate(true);
export const optionalAuth = authenticate(false);
export const STAFF_ROLES: UserRole[] = ["SUPERADMIN", "ADMIN", "STAFF"];
export const POS_ROLES: UserRole[] = ["SUPERADMIN", "ADMIN", "STAFF", "POS_CASHIER"];
export const ADMIN_ROLES: UserRole[] = ["SUPERADMIN", "ADMIN"];
