# EDC Beauty & Fashion — E-Commerce Platform

A full-stack e-commerce platform for a Fashion & Cosmetics store: Next.js storefront, a separate Next.js admin panel (with built-in POS), and an Express/PostgreSQL API. Covers catalog, cart/checkout, three Nepal payment gateways (eSewa, Fonepay, NIC Asia via CyberSource), inventory, customer loyalty points, in-store POS, CMS-driven content, SEO, and Meta Pixel/GTM analytics — all configurable from the admin **Settings** area.

## Stack

- **API**: Express + TypeScript, Prisma/PostgreSQL, JWT auth (access + refresh, httpOnly cookies), zod validation. Runs via `tsx` in both dev and production (`pnpm --filter @ecommerce-x/api start`) rather than a bundled build — this sidesteps a real incompatibility between esbuild-bundling Prisma's generated client (which breaks its internal dynamic `require`) and Node's native TS support (which doesn't implement TypeScript's `.js→.ts` extension resolution). `pnpm build` for the API just typechecks.
- **Storefront** (`apps/web`): Next.js 14 App Router, Tailwind CSS, zustand
- **Admin + POS** (`apps/admin`): Next.js 14 App Router, Tailwind CSS
- **Shared**: `packages/db` (Prisma schema/client), `packages/shared` (types/constants)
- Monorepo managed with pnpm workspaces

## Prerequisites

- Node.js 20+, pnpm (`corepack enable` or `npm i -g pnpm`)
- PostgreSQL running locally (or reachable via `DATABASE_URL`)

## Setup

```bash
pnpm install
cp .env.example .env            # then edit values as needed
cp .env apps/api/.env           # API loads its own .env from its cwd

createdb ecommerce_x_dev        # or update DATABASE_URL to an existing db

pnpm --filter @ecommerce-x/db migrate   # applies Prisma migrations
pnpm --filter @ecommerce-x/db seed      # seeds demo catalog, settings, users
```

Seeded logins:

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@belabeauty.example` | `Admin@12345` |
| POS Cashier | `cashier@belabeauty.example` | `Cashier@12345` |
| Customer | `customer@example.com` | `Customer@12345` |

## Running

Three processes, three ports (chosen to avoid a couple of other local projects already on 3000):

```bash
pnpm dev:api     # http://localhost:4100
pnpm dev:web     # http://localhost:3002  (storefront)
pnpm dev:admin   # http://localhost:3001  (admin panel + POS)
```

Or `pnpm dev` to run all three via pnpm's parallel workspace runner. If your machine's ports differ, update `PORT`/`API_URL`/`WEB_URL`/`ADMIN_URL`/`NEXT_PUBLIC_API_URL` in `.env` (and `apps/api/.env`) together — the API's CORS and payment-gateway redirect URLs are derived from these.

## What's controlled from the Admin Panel (Settings)

Branding (site name, logo, favicon, primary/secondary color), contact & social links, all three payment gateways (enable/disable, sandbox/live, merchant credentials — secrets are AES-256-GCM encrypted at rest), Meta Pixel ID, GTM container ID, SEO defaults, shipping zones/rates, tax rates, and the loyalty points program (earn rate, redemption rate, caps, expiry). Homepage banners, nav menus, and CMS pages (About/Contact/Terms/Privacy, etc.) are also fully admin-managed.

## Payment gateways — sandbox vs. going live

Each gateway (`apps/api/src/payments/{esewa,fonepay,cybersource}.ts`) implements the provider's real signing/verification protocol against sandbox endpoints by default. To go live: paste real merchant credentials into **Admin → Settings → Payment Gateways** and flip each gateway's mode to `live` — no code changes needed.

Because this environment has no live merchant accounts, a dev-only simulator lets you exercise checkout end-to-end right now:

- **eSewa / Card (NIC Asia)**: redirect to the real sandbox provider page (will not complete without real sandbox test credentials from that provider).
- **Fonepay**: shows a QR step; a "Simulate Successful Payment" button appears there in development.
- Any pending payment can also be completed via `POST /api/payments/:paymentId/dev-complete` (disabled automatically when `NODE_ENV=production`).
- **COD** requires no gateway and works immediately.

## Project layout

```
apps/
  api/      Express API (routes under src/modules/*, gateways under src/payments/*)
  web/      Storefront (Next.js App Router)
  admin/    Admin panel + POS (Next.js App Router)
packages/
  db/       Prisma schema (packages/db/prisma/schema.prisma), seed script
  shared/   Shared TS types & constants
```

## Before going to production

- Real credentials for eSewa, Fonepay, and NIC Asia/CyberSource (entered via Settings, not env vars)
- A real domain + HTTPS, and updated `API_URL`/`WEB_URL`/`ADMIN_URL`/`NEXT_PUBLIC_*` env vars
- Object storage (S3/Cloudinary) instead of local disk for `/uploads` in multi-instance deployments
- A transactional email/SMS provider (order confirmations aren't wired to a provider yet — hook into `Order`/`Payment` events)
- Strong, unique `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `SETTINGS_ENCRYPTION_KEY` values
