import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth, requireRole, ADMIN_ROLES } from "../../middleware/auth.js";
import { HttpError } from "../../lib/http-error.js";
import { getPagination, paginate } from "../../lib/pagination.js";

export const mediaRouter = Router();
mediaRouter.use(requireAuth, requireRole(...ADMIN_ROLES));

// List/search the shared library — backs both the dedicated Media Library
// admin page and the "Browse Library" picker embedded in other forms.
mediaRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = getPagination(req);
    const search = String(req.query.search ?? "").trim();
    const where = search
      ? { OR: [{ filename: { contains: search, mode: "insensitive" as const } }, { altText: { contains: search, mode: "insensitive" as const } }] }
      : {};

    const [items, total] = await Promise.all([
      prisma.media.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.media.count({ where }),
    ]);
    res.json(paginate(items, total, page, pageSize));
  })
);

const updateSchema = z.object({ altText: z.string().nullable() });

mediaRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { altText } = updateSchema.parse(req.body);
    const media = await prisma.media.update({ where: { id: req.params.id as string }, data: { altText } });
    res.json(media);
  })
);

// Removes it from the library/picker only — the underlying file on disk is
// left alone, since other records (ProductImage, Banner, ...) reference the
// url directly rather than through a foreign key, and may still be using it.
mediaRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const media = await prisma.media.findUnique({ where: { id: req.params.id as string } });
    if (!media) throw HttpError.notFound("Media not found");
    await prisma.media.delete({ where: { id: media.id } });
    res.json({ success: true });
  })
);
