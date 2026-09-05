import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth, requireRole, ADMIN_ROLES } from "../../middleware/auth.js";
import { HttpError } from "../../lib/http-error.js";

export const categoriesRouter = Router();

categoriesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const tree = req.query.tree === "true";
    const includeInactive = req.query.includeInactive === "true";
    const categories = await prisma.category.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    if (!tree) return res.json(categories);

    const byParent = new Map<string | null, typeof categories>();
    for (const c of categories) {
      const key = c.parentId ?? null;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(c);
    }
    const build = (parentId: string | null): any[] =>
      (byParent.get(parentId) ?? []).map((c) => ({ ...c, children: build(c.id) }));
    res.json(build(null));
  })
);

categoriesRouter.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const category = await prisma.category.findUnique({ where: { slug: req.params.slug as string } });
    if (!category) throw HttpError.notFound("Category not found");
    res.json(category);
  })
);

const categorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  // .nullish() (not just .optional()) because the admin edit form spreads
  // the full category record — including already-null DB fields — back
  // into the update payload; a plain .optional() rejects an explicit `null`.
  description: z.string().nullish(),
  imageUrl: z.string().nullish(),
  parentId: z.string().nullish(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
  showInMenu: z.boolean().optional(),
  seoTitle: z.string().nullish(),
  seoDescription: z.string().nullish(),
  seoKeywords: z.string().nullish(),
  ogImage: z.string().nullish(),
  canonicalUrl: z.string().nullish(),
});

categoriesRouter.post(
  "/",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const data = categorySchema.parse(req.body);
    const category = await prisma.category.create({ data });
    res.status(201).json(category);
  })
);

categoriesRouter.put(
  "/:id",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const data = categorySchema.partial().parse(req.body);
    const category = await prisma.category.update({ where: { id: req.params.id as string }, data });
    res.json(category);
  })
);

categoriesRouter.delete(
  "/:id",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const category = await prisma.category.findUnique({ where: { id: req.params.id as string }, select: { slug: true } });
    await prisma.category.delete({ where: { id: req.params.id as string } });
    // Same 410 tombstone as product delete; if this was actually a merge,
    // an admin can override it to a 301 via the Redirects settings screen.
    if (category) {
      await prisma.redirect.upsert({
        where: { fromPath: `/categories/${category.slug}` },
        update: { toPath: null, statusCode: 410 },
        create: { fromPath: `/categories/${category.slug}`, toPath: null, statusCode: 410, note: "Auto-created on category delete" },
      });
    }
    res.json({ success: true });
  })
);
