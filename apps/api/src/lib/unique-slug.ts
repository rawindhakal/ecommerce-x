import { slugify } from "@ecommerce-x/shared";

/**
 * Derives a URL slug from `name` and appends `-2`, `-3`, ... until `exists`
 * reports no collision. `exists` is caller-supplied so this stays agnostic
 * of which Prisma model it's generating for (Product, Category, Brand,
 * Page, ...).
 */
export async function generateUniqueSlug(name: string, exists: (slug: string) => Promise<boolean>, fallback = "item"): Promise<string> {
  const base = slugify(name) || fallback;
  let candidate = base;
  let suffix = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await exists(candidate)) {
    candidate = `${base}-${suffix++}`;
  }
  return candidate;
}
