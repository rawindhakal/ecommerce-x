import { Router } from "express";
import { z } from "zod";
import { Prisma, prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth, requireRole, ADMIN_ROLES } from "../../middleware/auth.js";
import { HttpError } from "../../lib/http-error.js";
import { getPagination, paginate } from "../../lib/pagination.js";
import { generateUniqueVariantSku, deriveVariantName } from "../../lib/product-codes.js";
import { generateUniqueSlug } from "../../lib/unique-slug.js";

// Query keys that mean something other than "filter by this variant option
// key/value" on the public listing — anything else in the querystring is
// treated as a variant-attribute facet (e.g. ?shade=Nude+02&size=M).
const RESERVED_LIST_PARAMS = new Set([
  "category", "brand", "search", "featured", "minPrice", "maxPrice",
  "tag", "tags", "sort", "page", "pageSize",
]);

export const productsRouter = Router();

const productInclude = {
  images: { orderBy: { sortOrder: "asc" as const } },
  variants: { where: { isActive: true }, include: { inventory: true } },
  category: true,
  brand: true,
};

// Public storefront listing
productsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = getPagination(req);
    const { category, brand, search, featured, minPrice, maxPrice, tag, tags, sort } = req.query as Record<string, string | undefined>;

    const where: Prisma.ProductWhereInput = { status: "ACTIVE" };
    if (category) where.category = { slug: category };
    if (brand) where.brand = { slug: brand };
    if (featured === "true") where.isFeatured = true;
    const tagList = [...(tag ? [tag] : []), ...(tags ? tags.split(",").filter(Boolean) : [])];
    if (tagList.length) where.tags = { hasSome: tagList };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { tags: { has: search.toLowerCase() } },
      ];
    }
    if (minPrice || maxPrice) {
      where.basePrice = {};
      if (minPrice) where.basePrice.gte = Number(minPrice);
      if (maxPrice) where.basePrice.lte = Number(maxPrice);
    }

    // Any non-reserved query param is a variant-option facet, e.g.
    // ?shade=Nude+02,Red&size=M — matched against ProductVariant.options
    // (a product qualifies if it has a variant satisfying each selected key,
    // OR-ed across that key's selected values, AND-ed across different keys).
    const attrFilters: Prisma.ProductWhereInput[] = [];
    for (const [key, value] of Object.entries(req.query as Record<string, string | undefined>)) {
      if (RESERVED_LIST_PARAMS.has(key) || !value) continue;
      const values = value.split(",").filter(Boolean);
      if (!values.length) continue;
      attrFilters.push({
        variants: {
          some: { OR: values.map((v) => ({ options: { path: [key], equals: v } })) },
        },
      });
    }
    if (attrFilters.length) where.AND = attrFilters;

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      sort === "price_asc" ? { basePrice: "asc" } :
      sort === "price_desc" ? { basePrice: "desc" } :
      sort === "rating" ? { avgRating: "desc" } :
      sort === "newest" ? { publishedAt: "desc" } :
      { createdAt: "desc" };

    const [items, total] = await Promise.all([
      prisma.product.findMany({ where, include: productInclude, orderBy, skip, take }),
      prisma.product.count({ where }),
    ]);

    res.json(paginate(items, total, page, pageSize));
  })
);

// Admin listing (includes drafts/archived)
productsRouter.get(
  "/admin",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = getPagination(req);
    const { search, status } = req.query as Record<string, string | undefined>;
    const where: Prisma.ProductWhereInput = {};
    if (status) where.status = status as any;
    if (search) where.name = { contains: search, mode: "insensitive" };

    const [items, total] = await Promise.all([
      prisma.product.findMany({ where, include: productInclude, orderBy: { updatedAt: "desc" }, skip, take }),
      prisma.product.count({ where }),
    ]);
    res.json(paginate(items, total, page, pageSize));
  })
);

productsRouter.get(
  "/admin/:id",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({ where: { id: req.params.id as string }, include: productInclude });
    if (!product) throw HttpError.notFound("Product not found");
    res.json(product);
  })
);

// Public storefront filter facets: price bounds, all tags in use, and every
// variant-option key/value combination in use (e.g. shade, size) — lets the
// /products sidebar render filter sections without hardcoding attribute names.
productsRouter.get(
  "/facets",
  asyncHandler(async (_req, res) => {
    const [priceAgg, activeProducts, activeVariants] = await Promise.all([
      prisma.product.aggregate({ where: { status: "ACTIVE" }, _min: { basePrice: true }, _max: { basePrice: true } }),
      prisma.product.findMany({ where: { status: "ACTIVE" }, select: { tags: true } }),
      prisma.productVariant.findMany({ where: { isActive: true, product: { status: "ACTIVE" } }, select: { options: true } }),
    ]);

    const tagSet = new Set<string>();
    for (const p of activeProducts) for (const t of p.tags) tagSet.add(t);

    const variantOptions: Record<string, Set<string>> = {};
    for (const v of activeVariants) {
      const options = (v.options ?? {}) as Record<string, string>;
      for (const [key, value] of Object.entries(options)) {
        if (!value) continue;
        (variantOptions[key] ??= new Set()).add(value);
      }
    }

    res.json({
      priceRange: {
        min: priceAgg._min.basePrice ? Number(priceAgg._min.basePrice) : 0,
        max: priceAgg._max.basePrice ? Number(priceAgg._max.basePrice) : 0,
      },
      tags: Array.from(tagSet).sort(),
      variantOptions: Object.fromEntries(Object.entries(variantOptions).map(([k, v]) => [k, Array.from(v).sort()])),
    });
  })
);

productsRouter.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { slug: req.params.slug as string },
      include: {
        ...productInclude,
        reviews: { where: { status: "APPROVED" }, orderBy: { createdAt: "desc" }, take: 20, include: { user: { select: { firstName: true, lastName: true } } } },
        taxRate: true,
      },
    });
    if (!product) throw HttpError.notFound("Product not found");
    res.json(product);
  })
);

const variantSchema = z.object({
  id: z.string().optional(),
  sku: z.string().min(1).optional(), // auto-generated server-side when omitted
  barcode: z.string().optional(),
  name: z.string().optional(),
  options: z.record(z.string(), z.string()),
  price: z.number().nonnegative(),
  compareAtPrice: z.number().nonnegative().optional(),
  costPrice: z.number().nonnegative().optional(),
  imageUrl: z.string().optional(),
  isActive: z.boolean().optional(),
});

const imageSchema = z.object({
  id: z.string().optional(),
  url: z.string().min(1),
  altText: z.string().optional(),
  sortOrder: z.number().optional(),
});

const productSchema = z.object({
  name: z.string().min(1),
  // slug is auto-generated from name server-side (see generateUniqueSlug) —
  // not accepted from the client, so it can't be typed or ever go stale.
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  type: z.enum(["SIMPLE", "VARIABLE"]).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  categoryId: z.string().nullable().optional(),
  brandId: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  barcode: z.string().optional(),
  basePrice: z.number().nonnegative(),
  compareAtPrice: z.number().nonnegative().optional(),
  costPrice: z.number().nonnegative().optional(),
  taxable: z.boolean().optional(),
  taxRateId: z.string().nullable().optional(),
  weightGrams: z.number().optional(),
  attributes: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()).optional(),
  isFeatured: z.boolean().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  seoKeywords: z.string().optional(),
  ogImage: z.string().optional(),
  canonicalUrl: z.string().optional(),
  images: z.array(imageSchema).optional(),
  variants: z.array(variantSchema).optional(),
});

productsRouter.post(
  "/",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const data = productSchema.parse(req.body);
    const { images, variants, ...productData } = data;

    const slug = await generateUniqueSlug(data.name, (s) => prisma.product.findUnique({ where: { slug: s }, select: { id: true } }).then(Boolean), "product");
    const resolvedVariants = variants?.length
      ? await Promise.all(
          variants.map(async (v) => ({
            ...v,
            sku: v.sku ?? (await generateUniqueVariantSku(slug)),
            name: v.name ?? deriveVariantName(v.options),
            options: v.options,
          }))
        )
      : undefined;

    const product = await prisma.product.create({
      data: {
        ...productData,
        slug,
        publishedAt: productData.status === "ACTIVE" ? new Date() : null,
        images: images?.length ? { create: images.map((i, idx) => ({ url: i.url, altText: i.altText, sortOrder: i.sortOrder ?? idx })) } : undefined,
        variants: resolvedVariants?.length ? { create: resolvedVariants } : undefined,
      },
      include: productInclude,
    });
    res.status(201).json(product);
  })
);

productsRouter.put(
  "/:id",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const data = productSchema.partial().parse(req.body);
    const { images, variants, ...productData } = data;
    const id = req.params.id as string;

    const existingProduct = await prisma.product.findUnique({ where: { id }, select: { slug: true } });
    if (!existingProduct) throw HttpError.notFound("Product not found");

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          ...productData,
          publishedAt: productData.status === "ACTIVE" ? new Date() : undefined,
        },
      });

      if (images) {
        await tx.productImage.deleteMany({ where: { productId: id, id: { notIn: images.filter((i) => i.id).map((i) => i.id!) } } });
        for (const [idx, img] of images.entries()) {
          if (img.id) {
            await tx.productImage.update({ where: { id: img.id }, data: { url: img.url, altText: img.altText, sortOrder: img.sortOrder ?? idx } });
          } else {
            await tx.productImage.create({ data: { productId: id, url: img.url, altText: img.altText, sortOrder: img.sortOrder ?? idx } });
          }
        }
      }

      if (variants) {
        const keepIds = variants.filter((v) => v.id).map((v) => v.id!);
        await tx.productVariant.deleteMany({ where: { productId: id, id: { notIn: keepIds } } });
        for (const v of variants) {
          const name = v.name ?? deriveVariantName(v.options);
          if (v.id) {
            await tx.productVariant.update({ where: { id: v.id }, data: { ...v, name, options: v.options } });
          } else {
            const sku = v.sku ?? (await generateUniqueVariantSku(existingProduct.slug));
            await tx.productVariant.create({ data: { ...v, productId: id, sku, name, options: v.options } });
          }
        }
      }
    });

    const product = await prisma.product.findUnique({ where: { id }, include: productInclude });
    res.json(product);
  })
);

productsRouter.delete(
  "/:id",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({ where: { id: req.params.id as string }, select: { slug: true } });
    await prisma.product.delete({ where: { id: req.params.id as string } });
    // Mark the old public URL as permanently gone (410) rather than letting
    // it silently 404 — a stronger, more correct signal for search engines
    // and anyone with the old link bookmarked or indexed.
    if (product) {
      await prisma.redirect.upsert({
        where: { fromPath: `/products/${product.slug}` },
        update: { toPath: null, statusCode: 410 },
        create: { fromPath: `/products/${product.slug}`, toPath: null, statusCode: 410, note: "Auto-created on product delete" },
      });
    }
    res.json({ success: true });
  })
);
