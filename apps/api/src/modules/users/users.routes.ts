import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth, requireRole, ADMIN_ROLES } from "../../middleware/auth.js";
import { getPagination, paginate } from "../../lib/pagination.js";
import { hashPassword, passwordSchema } from "../../lib/password.js";
import { HttpError } from "../../lib/http-error.js";
import { logAudit } from "../../lib/audit-log.js";
import { PHONE_REGEX, PHONE_VALIDATION_MESSAGE } from "@ecommerce-x/shared";

export const usersRouter = Router();
usersRouter.use(requireAuth, requireRole(...ADMIN_ROLES));

const select = { id: true, email: true, phone: true, firstName: true, lastName: true, role: true, isActive: true, loyaltyPoints: true, lastLoginAt: true, createdAt: true };

usersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = getPagination(req);
    const { role, search } = req.query as Record<string, string | undefined>;
    const where: any = {};
    if (role) where.role = role;
    if (search) where.OR = [{ phone: { contains: search } }, { firstName: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }];

    const [items, total] = await Promise.all([
      prisma.user.findMany({ where, select, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.user.count({ where }),
    ]);
    res.json(paginate(items, total, page, pageSize));
  })
);

usersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id as string },
      select: { ...select, addresses: true, orders: { orderBy: { createdAt: "desc" }, take: 20 } },
    });
    if (!user) throw HttpError.notFound("User not found");
    res.json(user);
  })
);

const createStaffSchema = z.object({
  phone: z.string().trim().regex(PHONE_REGEX, PHONE_VALIDATION_MESSAGE),
  email: z.string().email().optional().or(z.literal("")),
  password: passwordSchema,
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  role: z.enum(["SUPERADMIN", "ADMIN", "STAFF", "POS_CASHIER"]),
});

usersRouter.post(
  "/staff",
  asyncHandler(async (req, res) => {
    const data = createStaffSchema.parse(req.body);
    // Only an existing SUPERADMIN may mint another one — otherwise a plain
    // ADMIN could create a brand-new SUPERADMIN account for themselves.
    if (data.role === "SUPERADMIN" && req.user!.role !== "SUPERADMIN") {
      throw HttpError.forbidden("Only a Super Admin can grant the Super Admin role");
    }
    const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (existing) throw HttpError.conflict("A user with this phone number already exists");
    const { password, ...rest } = data;
    const user = await prisma.user.create({
      data: { ...rest, email: data.email || undefined, passwordHash: await hashPassword(password), emailVerifiedAt: data.email ? new Date() : undefined },
      select,
    });
    await logAudit({ userId: req.user!.id, action: "user.staff_created", entityType: "User", entityId: user.id, metadata: { role: user.role, phone: user.phone }, ipAddress: req.ip });
    res.status(201).json(user);
  })
);

const updateUserSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().regex(PHONE_REGEX, PHONE_VALIDATION_MESSAGE).optional(),
  email: z.string().email().optional().or(z.literal("")),
  role: z.enum(["SUPERADMIN", "ADMIN", "STAFF", "POS_CASHIER", "CUSTOMER"]).optional(),
  isActive: z.boolean().optional(),
});

usersRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { email, ...data } = updateUserSchema.parse(req.body);
    const targetId = req.params.id as string;

    // Same escalation risk as staff creation, plus: a plain ADMIN must not
    // be able to change a Super Admin's role/status at all (e.g. demoting
    // the only Super Admin, or deactivating them, to clear the way for
    // themselves) — only another Super Admin may touch a Super Admin account.
    if (req.user!.role !== "SUPERADMIN") {
      if (data.role === "SUPERADMIN") throw HttpError.forbidden("Only a Super Admin can grant the Super Admin role");
      const target = await prisma.user.findUnique({ where: { id: targetId }, select: { role: true } });
      if (target?.role === "SUPERADMIN") throw HttpError.forbidden("Only a Super Admin can modify a Super Admin account");
    }

    if (data.phone) {
      const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
      if (existing && existing.id !== targetId) throw HttpError.conflict("That phone number is already in use by another account");
    }
    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== targetId) throw HttpError.conflict("That email is already in use by another account");
    }

    const before = await prisma.user.findUnique({ where: { id: targetId }, select: { role: true, isActive: true } });
    const user = await prisma.user.update({
      where: { id: targetId },
      data: { ...data, email: email === undefined ? undefined : email || null },
      select,
    });

    if (data.role && data.role !== before?.role) {
      await logAudit({ userId: req.user!.id, action: "user.role_changed", entityType: "User", entityId: user.id, metadata: { from: before?.role, to: data.role }, ipAddress: req.ip });
    }
    if (data.isActive !== undefined && data.isActive !== before?.isActive) {
      await logAudit({ userId: req.user!.id, action: data.isActive ? "user.reactivated" : "user.deactivated", entityType: "User", entityId: user.id, ipAddress: req.ip });
    }

    res.json(user);
  })
);

// Admin-initiated password reset: no current-password check (that's the
// point — this is for when a customer/staff member is locked out), but the
// same Super-Admin-account protection as above still applies.
const resetPasswordSchema = z.object({ password: passwordSchema });

usersRouter.post(
  "/:id/password",
  asyncHandler(async (req, res) => {
    const { password } = resetPasswordSchema.parse(req.body);
    const targetId = req.params.id as string;

    if (req.user!.role !== "SUPERADMIN") {
      const target = await prisma.user.findUnique({ where: { id: targetId }, select: { role: true } });
      if (target?.role === "SUPERADMIN") throw HttpError.forbidden("Only a Super Admin can reset a Super Admin's password");
    }

    await prisma.user.update({ where: { id: targetId }, data: { passwordHash: await hashPassword(password) } });
    // A password reset by someone else should end every existing session on
    // that account, the same as a self-service change does.
    await prisma.refreshToken.updateMany({ where: { userId: targetId, revokedAt: null }, data: { revokedAt: new Date() } });
    await logAudit({ userId: req.user!.id, action: "user.password_reset_by_admin", entityType: "User", entityId: targetId, ipAddress: req.ip });

    res.json({ success: true });
  })
);
