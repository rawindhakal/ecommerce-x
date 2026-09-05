import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth, requireRole, ADMIN_ROLES } from "../../middleware/auth.js";
import { getPagination, paginate } from "../../lib/pagination.js";
import { hashPassword } from "../../lib/password.js";
import { HttpError } from "../../lib/http-error.js";

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
  phone: z.string().trim().min(7, "Enter a valid phone number").max(20),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  role: z.enum(["SUPERADMIN", "ADMIN", "STAFF", "POS_CASHIER"]),
});

usersRouter.post(
  "/staff",
  asyncHandler(async (req, res) => {
    const data = createStaffSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (existing) throw HttpError.conflict("A user with this phone number already exists");
    const user = await prisma.user.create({
      data: { ...data, email: data.email || undefined, passwordHash: await hashPassword(data.password), emailVerifiedAt: data.email ? new Date() : undefined },
      select,
    });
    res.status(201).json(user);
  })
);

const updateUserSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(["SUPERADMIN", "ADMIN", "STAFF", "POS_CASHIER", "CUSTOMER"]).optional(),
  isActive: z.boolean().optional(),
});

usersRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = updateUserSchema.parse(req.body);
    const user = await prisma.user.update({ where: { id: req.params.id as string }, data, select });
    res.json(user);
  })
);
