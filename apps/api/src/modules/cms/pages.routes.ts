import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth, requireRole, ADMIN_ROLES } from "../../middleware/auth.js";
import { HttpError } from "../../lib/http-error.js";
import { sanitizeContent } from "../../lib/sanitize-html.js";

export const pagesRouter = Router();

pagesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const includeDrafts = req.query.includeDrafts === "true";
    const pages = await prisma.page.findMany({ where: includeDrafts ? undefined : { status: "PUBLISHED" }, orderBy: { title: "asc" } });
    res.json(pages);
  })
);

pagesRouter.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const page = await prisma.page.findUnique({ where: { slug: req.params.slug as string } });
    if (!page) throw HttpError.notFound("Page not found");
    res.json(page);
  })
);

const pageSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  // .nullish() (not just .optional()) because the admin edit form spreads
  // the full page record — including already-null DB fields — back into
  // the update payload; a plain .optional() rejects an explicit `null`.
  content: z.string().nullish(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  seoTitle: z.string().nullish(),
  seoDescription: z.string().nullish(),
  ogImage: z.string().nullish(),
});

pagesRouter.post(
  "/",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const data = pageSchema.parse(req.body);
    if (data.content) data.content = sanitizeContent(data.content);
    const page = await prisma.page.create({ data });
    res.status(201).json(page);
  })
);

pagesRouter.put(
  "/:id",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const data = pageSchema.partial().parse(req.body);
    if (data.content) data.content = sanitizeContent(data.content);
    const page = await prisma.page.update({ where: { id: req.params.id as string }, data });
    res.json(page);
  })
);

pagesRouter.delete(
  "/:id",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    await prisma.page.delete({ where: { id: req.params.id as string } });
    res.json({ success: true });
  })
);
