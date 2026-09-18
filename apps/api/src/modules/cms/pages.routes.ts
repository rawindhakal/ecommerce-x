import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ecommerce-x/db";
import { HOME_PAGE_SLUG } from "@ecommerce-x/shared";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth, requireRole, ADMIN_ROLES } from "../../middleware/auth.js";
import { HttpError } from "../../lib/http-error.js";
import { sanitizeContent } from "../../lib/sanitize-html.js";
import { generateUniqueSlug } from "../../lib/unique-slug.js";

export const pagesRouter = Router();

// Find-or-create the reserved homepage Page row (see HOME_PAGE_SLUG) — the
// admin "Homepage Builder" entry point hits this so it always has a page
// id to open in the builder without needing to know one up front.
pagesRouter.post(
  "/home/ensure",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (_req, res) => {
    const page = await prisma.page.upsert({
      where: { slug: HOME_PAGE_SLUG },
      update: {},
      create: { title: "Homepage", slug: HOME_PAGE_SLUG, status: "DRAFT" },
    });
    res.json(page);
  })
);

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
  // slug is auto-generated from title server-side on create (except the
  // reserved homepage row, created separately by /home/ensure) — not
  // accepted from the client, and never changed on update either, so
  // published URLs can't be broken by an edit.
  // .nullish() (not just .optional()) because the admin edit form spreads
  // the full page record — including already-null DB fields — back into
  // the update payload; a plain .optional() rejects an explicit `null`.
  content: z.string().nullish(),
  layoutJson: z.any().optional(),
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
    const slug = await generateUniqueSlug(data.title, (s) => prisma.page.findUnique({ where: { slug: s }, select: { id: true } }).then(Boolean), "page");
    const page = await prisma.page.create({ data: { ...data, slug } });
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
