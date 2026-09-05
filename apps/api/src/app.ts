import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import path from "node:path";
import { env } from "./config/env.js";
import { notFoundHandler, errorHandler } from "./middleware/error-handler.js";

import { authRouter } from "./modules/auth/auth.routes.js";
import { categoriesRouter } from "./modules/catalog/categories.routes.js";
import { brandsRouter } from "./modules/catalog/brands.routes.js";
import { productsRouter } from "./modules/catalog/products.routes.js";
import { reviewsRouter } from "./modules/catalog/reviews.routes.js";
import { cartRouter } from "./modules/cart/cart.routes.js";
import { ordersRouter } from "./modules/orders/orders.routes.js";
import { paymentsRouter } from "./modules/payments/payments.routes.js";
import { inventoryRouter, locationsRouter } from "./modules/inventory/inventory.routes.js";
import { posRouter } from "./modules/pos/pos.routes.js";
import { loyaltyRouter } from "./modules/loyalty/loyalty.routes.js";
import { settingsRouter } from "./modules/settings/settings.routes.js";
import { pagesRouter } from "./modules/cms/pages.routes.js";
import { bannersRouter } from "./modules/cms/banners.routes.js";
import { menusRouter } from "./modules/cms/menus.routes.js";
import { uploadsRouter } from "./modules/uploads/uploads.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { addressesRouter } from "./modules/customers/addresses.routes.js";
import { wishlistRouter } from "./modules/customers/wishlist.routes.js";
import { couponsRouter } from "./modules/coupons/coupons.routes.js";
import { shippingRouter, taxRouter } from "./modules/shipping/shipping.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { reportsRouter } from "./modules/reports/reports.routes.js";
import { redirectsRouter } from "./modules/seo/redirects.routes.js";
import { seoAuditRouter } from "./modules/seo/audit.routes.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );
  app.use(
    cors({
      origin: [env.webUrl, env.adminUrl],
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));

  app.use(
    "/api",
    rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false })
  );

  app.use("/uploads", express.static(path.resolve(env.uploadDir)));

  app.get("/health", (_req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

  app.use("/api/auth", authRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/brands", brandsRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/reviews", reviewsRouter);
  app.use("/api/cart", cartRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/payments", paymentsRouter);
  app.use("/api/inventory", inventoryRouter);
  app.use("/api/locations", locationsRouter);
  app.use("/api/pos", posRouter);
  app.use("/api/loyalty", loyaltyRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/pages", pagesRouter);
  app.use("/api/banners", bannersRouter);
  app.use("/api/menus", menusRouter);
  app.use("/api/uploads", uploadsRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/addresses", addressesRouter);
  app.use("/api/wishlist", wishlistRouter);
  app.use("/api/coupons", couponsRouter);
  app.use("/api/shipping", shippingRouter);
  app.use("/api/tax", taxRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/reports", reportsRouter);
  app.use("/api/redirects", redirectsRouter);
  app.use("/api/seo-audit", seoAuditRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
