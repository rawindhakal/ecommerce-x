import crypto from "node:crypto";
import { prisma } from "@ecommerce-x/db";

// Excludes visually ambiguous characters (0/O, 1/I) since SKUs get read off
// printed barcodes/receipts and typed into the POS barcode field by hand.
const SKU_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length: number): string {
  return Array.from(crypto.randomBytes(length))
    .map((b) => SKU_ALPHABET[b % SKU_ALPHABET.length])
    .join("");
}

export async function generateUniqueVariantSku(productSlug: string): Promise<string> {
  const prefix = productSlug.slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, "") || "SKU";
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `${prefix}-${randomCode(5)}`;
    // eslint-disable-next-line no-await-in-loop
    const exists = await prisma.productVariant.findUnique({ where: { sku: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  throw new Error("Could not generate a unique variant SKU after 10 attempts");
}

export function deriveVariantName(options: Record<string, string>): string | undefined {
  const values = Object.values(options).filter(Boolean);
  return values.length ? values.join(" / ") : undefined;
}
