import { Router } from "express";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import { prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { optionalAuth } from "../../middleware/auth.js";
import { HttpError } from "../../lib/http-error.js";
import { analyzeSkin, CONCERN_KEYWORDS, SKIN_TYPE_KEYWORDS, type ConcernKey, type SkinType } from "../../lib/skin-analysis.js";

export const beautyRouter = Router();

// Image decoding + pixel analysis runs on this process, not a rate-limited
// external API — still cap it per-visitor so it can't be used to hammer the DB.
beautyRouter.use(rateLimit({ windowMs: 10 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }));

const SKIN_TYPES = ["OILY", "DRY", "COMBINATION", "NORMAL", "SENSITIVE", "UNSURE"] as const;
const CONCERNS = [
  "ACNE",
  "DARK_SPOTS",
  "WRINKLES",
  "DULLNESS",
  "LARGE_PORES",
  "REDNESS",
  "DRYNESS",
  "OILINESS",
  "UNEVEN_TONE",
  "SENSITIVITY",
] as const;
const AGE_RANGES = ["UNDER_18", "18_24", "25_34", "35_44", "45_PLUS"] as const;
const CATEGORY_PREFS = ["SKINCARE", "MAKEUP", "BOTH"] as const;
const BUDGETS = ["ANY", "UNDER_1000", "UNDER_2500", "UNDER_5000"] as const;

const BUDGET_MAX: Record<(typeof BUDGETS)[number], number | null> = {
  ANY: null,
  UNDER_1000: 1000,
  UNDER_2500: 2500,
  UNDER_5000: 5000,
};

const answersSchema = z.object({
  skinType: z.enum(SKIN_TYPES),
  concerns: z.array(z.enum(CONCERNS)).max(6),
  ageRange: z.enum(AGE_RANGES),
  category: z.enum(CATEGORY_PREFS).default("BOTH"),
  budget: z.enum(BUDGETS).default("ANY"),
});

const analyzeSchema = z.object({
  // A data: URL from <canvas>.toDataURL() or a file input, e.g.
  // "data:image/jpeg;base64,/9j/4AAQ...".
  image: z.string().min(100),
  answers: answersSchema,
});

function parseDataUrl(dataUrl: string): Buffer {
  const match = /^data:image\/(?:jpeg|png|webp);base64,(.+)$/.exec(dataUrl);
  if (!match) throw HttpError.badRequest("Photo must be a JPEG, PNG, or WebP image.");
  try {
    return Buffer.from(match[1]!, "base64");
  } catch {
    throw HttpError.badRequest("Photo data is corrupted. Please try capturing it again.");
  }
}

function wantsCategory(categoryName: string | null, pref: (typeof CATEGORY_PREFS)[number]): boolean {
  if (pref === "BOTH" || !categoryName) return true;
  const n = categoryName.toLowerCase();
  return pref === "SKINCARE" ? n.includes("skin") : n.includes("makeup") || n.includes("cosmetic") || n.includes("beauty");
}

/** Deterministic, explainable product ranker — no external AI involved. */
function rankProducts(
  candidates: { id: string; name: string; category: string | null; text: string; rating: number; price: number }[],
  skinType: SkinType,
  concerns: { key: ConcernKey; severity: number }[],
  categoryPref: (typeof CATEGORY_PREFS)[number]
): { id: string; score: number; reason: string }[] {
  const scored = candidates.map((c) => {
    let score = 0;
    const matchedConcernLabels: string[] = [];

    for (const concern of concerns) {
      const keywords = CONCERN_KEYWORDS[concern.key];
      if (keywords.some((kw) => c.text.includes(kw))) {
        score += concern.severity; // higher-severity concerns weigh more
        matchedConcernLabels.push(concern.key);
      }
    }

    const skinTypeMatch = SKIN_TYPE_KEYWORDS[skinType].some((kw) => c.text.includes(kw));
    if (skinTypeMatch) score += 2;

    if (wantsCategory(c.category, categoryPref)) score += 1.5;

    // Rating as a gentle tiebreaker, never enough to outrank a real concern match.
    score += (c.rating / 5) * 1;

    let reason: string;
    if (matchedConcernLabels.length > 0) {
      reason = `Formulated to help with ${matchedConcernLabels
        .slice(0, 2)
        .map((k) => CONCERN_KEYWORDS[k as ConcernKey][0])
        .join(" and ")}.`;
    } else if (skinTypeMatch) {
      reason = `A good fit for ${skinType.toLowerCase()} skin.`;
    } else {
      reason = `A highly-rated pick in your preferred category.`;
    }

    return { id: c.id, score, reason };
  });

  return scored.sort((a, b) => b.score - a.score);
}

beautyRouter.post(
  "/analyze",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { image, answers } = analyzeSchema.parse(req.body);
    const imageBuffer = parseDataUrl(image);

    const budgetMax = BUDGET_MAX[answers.budget];
    const candidates = await prisma.product.findMany({
      where: {
        status: "ACTIVE",
        ...(budgetMax ? { basePrice: { lte: budgetMax } } : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        description: true,
        tags: true,
        basePrice: true,
        compareAtPrice: true,
        avgRating: true,
        reviewCount: true,
        category: { select: { name: true } },
        images: { take: 1, orderBy: { sortOrder: "asc" } },
        variants: { where: { isActive: true }, take: 1, orderBy: { createdAt: "asc" }, select: { id: true, price: true } },
      },
      take: 200,
      orderBy: { avgRating: "desc" },
    });

    if (candidates.length === 0) {
      throw HttpError.badRequest("No products are available to recommend right now.");
    }

    const analysis = await analyzeSkin(imageBuffer, answers);

    const candidateMap = new Map(candidates.map((c) => [c.id, c]));
    const searchable = candidates.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category?.name ?? null,
      text: [c.name, c.shortDescription, c.description, ...c.tags].filter(Boolean).join(" ").toLowerCase(),
      rating: Number(c.avgRating),
      price: Number(c.basePrice),
    }));

    const ranked = rankProducts(
      searchable,
      analysis.skinType,
      analysis.concerns.map((c) => ({ key: c.key, severity: c.severity })),
      answers.category
    );

    const recommendations = ranked
      .filter((r) => r.score > 0)
      .slice(0, 8)
      .map((r) => ({ product: candidateMap.get(r.id)!, reason: r.reason }));

    res.json({
      skinType: analysis.skinType,
      concerns: analysis.concerns.map((c) => ({ name: c.name, severity: c.severity })),
      summary: analysis.summary,
      tips: analysis.tips,
      recommendations: recommendations.map((r) => ({
        reason: r.reason,
        product: {
          id: r.product.id,
          name: r.product.name,
          slug: r.product.slug,
          basePrice: r.product.basePrice,
          compareAtPrice: r.product.compareAtPrice,
          avgRating: r.product.avgRating,
          reviewCount: r.product.reviewCount,
          images: r.product.images,
          variants: r.product.variants,
        },
      })),
    });
  })
);
