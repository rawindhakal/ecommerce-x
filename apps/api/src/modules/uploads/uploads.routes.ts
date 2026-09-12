import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth, requireRole, ADMIN_ROLES } from "../../middleware/auth.js";
import { HttpError } from "../../lib/http-error.js";
import { env } from "../../config/env.js";
import { generateImageBuffer } from "../../lib/gemini.js";

const uploadDir = path.resolve(env.uploadDir);
fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new HttpError(400, "Unsupported file type"));
      return;
    }
    cb(null, true);
  },
});

export const uploadsRouter = Router();

uploadsRouter.post(
  "/",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, "No file uploaded");
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  })
);

const MIME_EXT: Record<string, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" };

const generateSchema = z.object({ prompt: z.string().min(3).max(2000) });

uploadsRouter.post(
  "/generate",
  requireAuth,
  requireRole(...ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const { prompt } = generateSchema.parse(req.body);
    const { buffer, mimeType } = await generateImageBuffer(prompt);
    const filename = `${crypto.randomUUID()}${MIME_EXT[mimeType] ?? ".png"}`;
    fs.writeFileSync(path.join(uploadDir, filename), buffer);
    res.status(201).json({ url: `/uploads/${filename}` });
  })
);
