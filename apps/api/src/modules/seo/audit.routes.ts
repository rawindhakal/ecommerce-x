import { Router } from "express";
import { prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth, requireRole, STAFF_ROLES } from "../../middleware/auth.js";

export const seoAuditRouter = Router();
seoAuditRouter.use(requireAuth, requireRole(...STAFF_ROLES));

seoAuditRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [products, categories, pages] = await Promise.all([
      prisma.product.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true, slug: true, seoTitle: true, seoDescription: true, ogImage: true, images: { select: { id: true }, take: 1 } },
      }),
      prisma.category.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true, seoTitle: true, seoDescription: true, imageUrl: true },
      }),
      prisma.page.findMany({
        where: { status: "PUBLISHED" },
        select: { id: true, title: true, slug: true, seoTitle: true, seoDescription: true },
      }),
    ]);

    const slugCounts = new Map<string, number>();
    for (const p of products) slugCounts.set(p.slug, (slugCounts.get(p.slug) ?? 0) + 1);
    const duplicateSlugs = Array.from(slugCounts.entries()).filter(([, n]) => n > 1).map(([slug]) => slug);

    const issues = {
      productsMissingSeoTitle: products.filter((p) => !p.seoTitle?.trim()).map((p) => ({ id: p.id, name: p.name, slug: p.slug, editUrl: `/products/${p.id}` })),
      productsMissingSeoDescription: products.filter((p) => !p.seoDescription?.trim()).map((p) => ({ id: p.id, name: p.name, slug: p.slug, editUrl: `/products/${p.id}` })),
      productsMissingImages: products.filter((p) => p.images.length === 0).map((p) => ({ id: p.id, name: p.name, slug: p.slug, editUrl: `/products/${p.id}` })),
      categoriesMissingSeoTitle: categories.filter((c) => !c.seoTitle?.trim()).map((c) => ({ id: c.id, name: c.name, slug: c.slug, editUrl: `/categories` })),
      categoriesMissingSeoDescription: categories.filter((c) => !c.seoDescription?.trim()).map((c) => ({ id: c.id, name: c.name, slug: c.slug, editUrl: `/categories` })),
      pagesMissingSeoTitle: pages.filter((p) => !p.seoTitle?.trim()).map((p) => ({ id: p.id, name: p.title, slug: p.slug, editUrl: `/cms/pages` })),
      pagesMissingSeoDescription: pages.filter((p) => !p.seoDescription?.trim()).map((p) => ({ id: p.id, name: p.title, slug: p.slug, editUrl: `/cms/pages` })),
      duplicateProductSlugs: duplicateSlugs,
    };

    const totalChecks = products.length * 3 + categories.length * 2 + pages.length * 2;
    const totalIssues = Object.values(issues).reduce((sum, arr) => sum + arr.length, 0);
    const score = totalChecks > 0 ? Math.round(((totalChecks - totalIssues) / totalChecks) * 100) : 100;

    res.json({
      score: Math.max(0, score),
      counts: { products: products.length, categories: categories.length, pages: pages.length },
      issues,
    });
  })
);
