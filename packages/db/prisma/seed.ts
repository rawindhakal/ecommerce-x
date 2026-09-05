import { PrismaClient, UserRole, ProductStatus, ProductType, LocationType } from "../generated/index.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function hashPassword(password: string) {
  return bcrypt.hashSync(password, 10);
}

async function main() {
  console.log("Seeding database...");

  // ---- Settings ----
  const settings: Array<{ group: string; key: string; value: any; isSecret?: boolean }> = [
    { group: "branding", key: "siteName", value: "EDC Beauty & Fashion" },
    { group: "branding", key: "tagline", value: "Your destination for beauty & style in Nepal" },
    { group: "branding", key: "logoUrl", value: "/uploads/logo-placeholder.svg" },
    { group: "branding", key: "faviconUrl", value: "/uploads/favicon-placeholder.svg" },
    { group: "branding", key: "primaryColor", value: "#C2185B" },
    { group: "branding", key: "secondaryColor", value: "#1A1A1A" },
    { group: "contact", key: "email", value: "support@belabeauty.example" },
    { group: "contact", key: "phone", value: "+977-1-4000000" },
    { group: "contact", key: "address", value: "Durbar Marg, Kathmandu, Nepal" },
    { group: "social", key: "facebook", value: "https://facebook.com/" },
    { group: "social", key: "instagram", value: "https://instagram.com/" },
    { group: "social", key: "tiktok", value: "" },
    { group: "general", key: "currency", value: "NPR" },
    { group: "general", key: "maintenanceMode", value: false },
    { group: "seo", key: "defaultTitle", value: "EDC Beauty & Fashion | Cosmetics & Fashion Nepal" },
    { group: "seo", key: "defaultDescription", value: "Shop makeup, skincare, and fashion in Nepal with fast delivery and easy returns." },
    { group: "seo", key: "defaultOgImage", value: "" },
    { group: "integrations", key: "metaPixelId", value: "" },
    { group: "integrations", key: "gtmContainerId", value: "" },
    { group: "integrations", key: "ga4MeasurementId", value: "" },
    { group: "integrations", key: "googleSiteVerification", value: "" },
    { group: "integrations", key: "bingSiteVerification", value: "" },
    { group: "payments", key: "esewa", value: { enabled: true, mode: "sandbox", merchantCode: "EPAYTEST" } },
    { group: "payments", key: "fonepay", value: { enabled: true, mode: "sandbox", merchantCode: "" } },
    { group: "payments", key: "cybersource_nicasia", value: { enabled: true, mode: "sandbox", profileId: "" } },
    { group: "payments", key: "cod", value: { enabled: true } },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { group_key: { group: s.group, key: s.key } },
      update: { value: s.value },
      create: { group: s.group, key: s.key, value: s.value, isSecret: s.isSecret ?? false },
    });
  }

  // ---- Loyalty rule ----
  const existingRule = await prisma.loyaltyRule.findFirst();
  if (!existingRule) {
    await prisma.loyaltyRule.create({
      data: {
        earnPointsPerNpr: 0.05, // 1 point per 20 NPR
        redeemPointValue: 1,
        minRedeemPoints: 100,
        maxRedeemPercent: 50,
        pointsExpireDays: 365,
      },
    });
  }

  // ---- Tax rate ----
  const vat = await prisma.taxRate.upsert({
    where: { id: "default-vat" },
    update: {},
    create: { id: "default-vat", name: "VAT", rate: 13, isDefault: true },
  });

  // ---- Locations ----
  const warehouse = await prisma.location.upsert({
    where: { id: "main-warehouse" },
    update: {},
    create: { id: "main-warehouse", name: "Main Warehouse", type: LocationType.WAREHOUSE, isDefault: true },
  });
  const store = await prisma.location.upsert({
    where: { id: "flagship-store" },
    update: {},
    create: { id: "flagship-store", name: "Flagship Store - Durbar Marg", type: LocationType.STORE, address: "Durbar Marg, Kathmandu" },
  });

  // ---- Users ---- (phone is the primary login identifier app-wide; email is
  // kept as an optional secondary contact field, still upserted by email here
  // purely so re-running this seed against an existing dev DB updates the
  // same rows instead of colliding on the now-added unique phone.)
  await prisma.user.upsert({
    where: { email: "admin@belabeauty.example" },
    update: { passwordHash: hashPassword("Admin@12345"), phone: "9801000001" },
    create: {
      phone: "9801000001",
      email: "admin@belabeauty.example",
      passwordHash: hashPassword("Admin@12345"),
      firstName: "Super",
      lastName: "Admin",
      role: UserRole.SUPERADMIN,
      emailVerifiedAt: new Date(),
    },
  });
  await prisma.user.upsert({
    where: { email: "cashier@belabeauty.example" },
    update: { passwordHash: hashPassword("Cashier@12345"), phone: "9801000002" },
    create: {
      phone: "9801000002",
      email: "cashier@belabeauty.example",
      passwordHash: hashPassword("Cashier@12345"),
      firstName: "POS",
      lastName: "Cashier",
      role: UserRole.POS_CASHIER,
      emailVerifiedAt: new Date(),
    },
  });
  await prisma.user.upsert({
    where: { email: "customer@example.com" },
    update: { passwordHash: hashPassword("Customer@12345"), phone: "9801000003" },
    create: {
      phone: "9801000003",
      email: "customer@example.com",
      passwordHash: hashPassword("Customer@12345"),
      firstName: "Test",
      lastName: "Customer",
      role: UserRole.CUSTOMER,
      loyaltyPoints: 250,
      emailVerifiedAt: new Date(),
    },
  });

  // ---- Categories ----
  const cosmetics = await prisma.category.upsert({
    where: { slug: "cosmetics" },
    update: {},
    create: { slug: "cosmetics", name: "Cosmetics", description: "Makeup, skincare & beauty essentials", seoTitle: "Cosmetics", sortOrder: 1 },
  });
  const makeup = await prisma.category.upsert({
    where: { slug: "makeup" },
    update: {},
    create: { slug: "makeup", name: "Makeup", parentId: cosmetics.id, sortOrder: 1 },
  });
  const skincare = await prisma.category.upsert({
    where: { slug: "skincare" },
    update: {},
    create: { slug: "skincare", name: "Skincare", parentId: cosmetics.id, sortOrder: 2 },
  });
  const fashion = await prisma.category.upsert({
    where: { slug: "fashion" },
    update: {},
    create: { slug: "fashion", name: "Fashion", description: "Apparel & accessories", sortOrder: 2 },
  });
  const women = await prisma.category.upsert({
    where: { slug: "women" },
    update: {},
    create: { slug: "women", name: "Women's Clothing", parentId: fashion.id, sortOrder: 1 },
  });
  const men = await prisma.category.upsert({
    where: { slug: "men" },
    update: {},
    create: { slug: "men", name: "Men's Clothing", parentId: fashion.id, sortOrder: 2 },
  });

  // ---- Brands ----
  const brandGlow = await prisma.brand.upsert({ where: { slug: "glowluxe" }, update: {}, create: { slug: "glowluxe", name: "GlowLuxe" } });
  const brandUrban = await prisma.brand.upsert({ where: { slug: "urban-thread" }, update: {}, create: { slug: "urban-thread", name: "Urban Thread" } });

  // ---- Products ----
  type SeedProduct = {
    slug: string; name: string; categoryId: string; brandId: string; price: number; description: string;
    variants: { sku: string; options: Record<string, string>; price: number; stock: number }[];
  };

  const products: SeedProduct[] = [
    {
      slug: "velvet-matte-lipstick",
      name: "Velvet Matte Lipstick",
      categoryId: makeup.id,
      brandId: brandGlow.id,
      price: 890,
      description: "Long-lasting, richly pigmented matte lipstick that glides on smooth and stays put all day.",
      variants: [
        { sku: "LIP-VM-NUDE02", options: { shade: "Nude 02" }, price: 890, stock: 40 },
        { sku: "LIP-VM-RED05", options: { shade: "Ruby Red 05" }, price: 890, stock: 35 },
        { sku: "LIP-VM-PINK03", options: { shade: "Blush Pink 03" }, price: 890, stock: 25 },
      ],
    },
    {
      slug: "hydraglow-vitamin-c-serum",
      name: "HydraGlow Vitamin C Serum",
      categoryId: skincare.id,
      brandId: brandGlow.id,
      price: 1450,
      description: "Brightening vitamin C serum with hyaluronic acid to even skin tone and boost radiance.",
      variants: [{ sku: "SER-VITC-30ML", options: { size: "30ml" }, price: 1450, stock: 60 }],
    },
    {
      slug: "silk-touch-foundation",
      name: "Silk Touch Foundation",
      categoryId: makeup.id,
      brandId: brandGlow.id,
      price: 1290,
      description: "Buildable, lightweight foundation with a natural satin finish for all-day wear.",
      variants: [
        { sku: "FND-ST-IVORY", options: { shade: "Ivory" }, price: 1290, stock: 20 },
        { sku: "FND-ST-BEIGE", options: { shade: "Beige" }, price: 1290, stock: 30 },
        { sku: "FND-ST-SAND", options: { shade: "Sand" }, price: 1290, stock: 18 },
      ],
    },
    {
      slug: "everyday-oversized-tee",
      name: "Everyday Oversized Tee",
      categoryId: women.id,
      brandId: brandUrban.id,
      price: 1100,
      description: "Soft cotton oversized tee for an effortless everyday look.",
      variants: [
        { sku: "TEE-OS-S-BLK", options: { size: "S", color: "Black" }, price: 1100, stock: 15 },
        { sku: "TEE-OS-M-BLK", options: { size: "M", color: "Black" }, price: 1100, stock: 20 },
        { sku: "TEE-OS-L-BLK", options: { size: "L", color: "Black" }, price: 1100, stock: 12 },
        { sku: "TEE-OS-M-WHT", options: { size: "M", color: "White" }, price: 1100, stock: 22 },
      ],
    },
    {
      slug: "classic-denim-jacket",
      name: "Classic Denim Jacket",
      categoryId: men.id,
      brandId: brandUrban.id,
      price: 2890,
      description: "Timeless denim jacket with a modern tailored fit.",
      variants: [
        { sku: "JKT-DNM-M", options: { size: "M" }, price: 2890, stock: 10 },
        { sku: "JKT-DNM-L", options: { size: "L" }, price: 2890, stock: 14 },
        { sku: "JKT-DNM-XL", options: { size: "XL" }, price: 2890, stock: 8 },
      ],
    },
    {
      slug: "rose-glow-highlighter",
      name: "Rose Glow Highlighter",
      categoryId: makeup.id,
      brandId: brandGlow.id,
      price: 990,
      description: "A silky powder highlighter for a luminous, dewy finish.",
      variants: [{ sku: "HLT-ROSE", options: { shade: "Rose Gold" }, price: 990, stock: 45 }],
    },
  ];

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        slug: p.slug,
        name: p.name,
        description: p.description,
        shortDescription: p.description.slice(0, 90),
        type: ProductType.VARIABLE,
        status: ProductStatus.ACTIVE,
        categoryId: p.categoryId,
        brandId: p.brandId,
        basePrice: p.price,
        taxRateId: vat.id,
        isFeatured: true,
        publishedAt: new Date(),
        seoTitle: p.name,
        seoDescription: p.description.slice(0, 150),
        images: { create: [{ url: `/uploads/placeholder-${p.slug}.svg`, altText: p.name, sortOrder: 0 }] },
      },
    });

    for (const v of p.variants) {
      const variant = await prisma.productVariant.upsert({
        where: { sku: v.sku },
        update: {},
        create: {
          productId: product.id,
          sku: v.sku,
          name: Object.values(v.options).join(" / "),
          options: v.options,
          price: v.price,
        },
      });

      await prisma.inventory.upsert({
        where: { variantId_locationId: { variantId: variant.id, locationId: warehouse.id } },
        update: { quantityOnHand: v.stock },
        create: { variantId: variant.id, locationId: warehouse.id, quantityOnHand: v.stock, reorderPoint: 5, reorderQty: 20 },
      });
      await prisma.inventory.upsert({
        where: { variantId_locationId: { variantId: variant.id, locationId: store.id } },
        update: {},
        create: { variantId: variant.id, locationId: store.id, quantityOnHand: Math.floor(v.stock / 4), reorderPoint: 2, reorderQty: 10 },
      });
    }
  }

  // ---- Pages ----
  await prisma.page.upsert({
    where: { slug: "about-us" },
    update: {},
    create: { slug: "about-us", title: "About Us", status: "PUBLISHED", content: "<p>We are EDC Beauty & Fashion, Nepal's home for cosmetics and fashion.</p>" },
  });
  await prisma.page.upsert({
    where: { slug: "privacy-policy" },
    update: {},
    create: { slug: "privacy-policy", title: "Privacy Policy", status: "PUBLISHED", content: "<p>Your privacy matters to us.</p>" },
  });
  await prisma.page.upsert({
    where: { slug: "terms-conditions" },
    update: {},
    create: { slug: "terms-conditions", title: "Terms & Conditions", status: "PUBLISHED", content: "<p>Terms of use for our store.</p>" },
  });
  await prisma.page.upsert({
    where: { slug: "contact-us" },
    update: {},
    create: { slug: "contact-us", title: "Contact Us", status: "PUBLISHED", content: "<p>Reach us at support@belabeauty.example</p>" },
  });

  // ---- Shipping ----
  const valley = await prisma.shippingZone.upsert({
    where: { id: "zone-valley" },
    update: {},
    create: { id: "zone-valley", name: "Kathmandu Valley", districts: ["Kathmandu", "Lalitpur", "Bhaktapur"] },
  });
  await prisma.shippingRate.upsert({
    where: { id: "rate-valley-standard" },
    update: {},
    create: { id: "rate-valley-standard", zoneId: valley.id, name: "Standard Delivery", price: 100, freeAboveSpend: 3000, estimatedDays: "1-2 days" },
  });

  const outside = await prisma.shippingZone.upsert({
    where: { id: "zone-outside" },
    update: {},
    create: { id: "zone-outside", name: "Outside Valley", districts: [] },
  });
  await prisma.shippingRate.upsert({
    where: { id: "rate-outside-standard" },
    update: {},
    create: { id: "rate-outside-standard", zoneId: outside.id, name: "Standard Delivery", price: 200, freeAboveSpend: 5000, estimatedDays: "3-5 days" },
  });

  console.log("Seed complete.");
  console.log("Admin login: 9801000001 / Admin@12345 (email admin@belabeauty.example also works)");
  console.log("POS cashier login: 9801000002 / Cashier@12345");
  console.log("Customer login: 9801000003 / Customer@12345");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
