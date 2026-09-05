import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth, requireRole, ADMIN_ROLES } from "../../middleware/auth.js";
import { getAllSettings, getPublicSettings, setSettingsGroup } from "./settings.service.js";

export const settingsRouter = Router();

// Public: branding, seo defaults, integrations (pixel/gtm ids), enabled payment methods
settingsRouter.get(
  "/public",
  asyncHandler(async (_req, res) => {
    res.json(await getPublicSettings());
  })
);

// Admin: full settings including secrets (decrypted for editing)
settingsRouter.get(
  "/",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (_req, res) => {
    res.json(await getAllSettings());
  })
);

const updateGroupSchema = z.object({
  entries: z.record(z.string(), z.any()),
  secretKeys: z.array(z.string()).optional(),
});

settingsRouter.put(
  "/:group",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const { entries, secretKeys } = updateGroupSchema.parse(req.body);
    await setSettingsGroup(req.params.group as string, entries, secretKeys ?? []);
    res.json({ success: true });
  })
);
