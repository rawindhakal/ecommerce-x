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
cp .env.example .env                    # then edit values as needed
cp .env apps/api/.env                   # API loads its own .env from its cwd
cp .env.example apps/web/.env.local     # Next only inlines NEXT_PUBLIC_* vars from an app's own .env*
cp .env.example apps/admin/.env.local   # (the repo-root .env is not read by Next directly)

createdb ecommerce_x_dev        # or update DATABASE_URL to an existing db

pnpm --filter @ecommerce-x/db migrate   # applies Prisma migrations
pnpm --filter @ecommerce-x/db seed      # seeds demo catalog, settings, users
```

Login is phone-primary (email is optional and still accepted as a fallback identifier). Seeded logins:

| Role | Phone | Password | Email (fallback) |
|---|---|---|---|
| Super Admin | `9801000001` | `Admin@12345` | `admin@belabeauty.example` |
| POS Cashier | `9801000002` | `Cashier@12345` | `cashier@belabeauty.example` |
| Customer | `9801000003` | `Customer@12345` | `customer@example.com` |

## Running

Three processes, three ports (chosen to avoid a couple of other local projects already on 3000):

```bash
pnpm dev:api     # http://localhost:4100
pnpm dev:web     # http://localhost:3002  (storefront)
pnpm dev:admin   # http://localhost:3001  (admin panel + POS)
```

Or `pnpm dev` to run all three via pnpm's parallel workspace runner. If your machine's ports differ, update `PORT`/`API_URL`/`WEB_URL`/`ADMIN_URL` in `.env` and `apps/api/.env`, and `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_SITE_URL` in `apps/web/.env.local` and `apps/admin/.env.local`, together — the API's CORS and payment-gateway redirect URLs are derived from these, and product/logo image URLs and canonical SEO tags will silently break if `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_SITE_URL` aren't set in the frontend apps' own env files.

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
- PostgreSQL client tools (`pg_dump`/`pg_restore`, matching the server's major version) installed on the API host — required for Admin → Backup & Restore. Not needed for normal operation, only for that feature.
- A periodic *off-server* copy of backups: Admin → Backup & Restore is an on-demand manual backup, not a scheduled/offsite one — for real disaster recovery (the server itself being lost), also run `pg_dump`/`pg_restore` from a scheduled job that ships the file somewhere else (S3, another host, etc.)
