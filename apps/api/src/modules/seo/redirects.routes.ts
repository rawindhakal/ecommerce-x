import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth, requireRole, ADMIN_ROLES } from "../../middleware/auth.js";

export const redirectsRouter = Router();

// Public, cheap to call often — the storefront fetches this once with a
// short revalidate window rather than hitting the DB on every request.
redirectsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const redirects = await prisma.redirect.findMany({ orderBy: { createdAt: "desc" } });
    res.json(redirects);
  })
);

redirectsRouter.use(requireAuth, requireRole(...ADMIN_ROLES));

const redirectSchema = z.object({
  fromPath: z.string().min(1).startsWith("/", "Path must start with /"),
  toPath: z.string().min(1).startsWith("/").nullish(),
  statusCode: z.union([z.literal(301), z.literal(302), z.literal(410)]).default(301),
  note: z.string().optional(),
});

redirectsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = redirectSchema.parse(req.body);
    const redirect = await prisma.redirect.upsert({
      where: { fromPath: data.fromPath },
      update: data,
      create: data,
    });
    res.status(201).json(redirect);
  })
);

redirectsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.redirect.delete({ where: { id: req.params.id as string } });
    res.json({ success: true });
  })
);
