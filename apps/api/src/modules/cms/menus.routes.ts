import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth, requireRole, ADMIN_ROLES } from "../../middleware/auth.js";

export const menusRouter = Router();

menusRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const location = req.query.location as string | undefined;
    const menus = await prisma.menu.findMany({
      where: { isActive: true, location: location as any },
      orderBy: { sortOrder: "asc" },
    });
    res.json(menus);
  })
);

menusRouter.get(
  "/admin",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (_req, res) => {
    res.json(await prisma.menu.findMany({ orderBy: [{ location: "asc" }, { sortOrder: "asc" }] }));
  })
);

const menuSchema = z.object({
  location: z.enum(["HEADER", "FOOTER", "MOBILE"]),
  label: z.string().min(1),
  url: z.string().min(1),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional(),
});

menusRouter.post(
  "/",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const menu = await prisma.menu.create({ data: menuSchema.parse(req.body) });
    res.status(201).json(menu);
  })
);

menusRouter.put(
  "/:id",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const menu = await prisma.menu.update({ where: { id: req.params.id as string }, data: menuSchema.partial().parse(req.body) });
    res.json(menu);
  })
);

menusRouter.delete(
  "/:id",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    await prisma.menu.delete({ where: { id: req.params.id as string } });
    res.json({ success: true });
  })
);
