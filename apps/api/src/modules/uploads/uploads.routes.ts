import { Router } from "express";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth, requireRole, ADMIN_ROLES } from "../../middleware/auth.js";
import { HttpError } from "../../lib/http-error.js";
import { env } from "../../config/env.js";

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
    const url = `/uploads/${req.file.filename}`;
    // Every upload — regardless of which form triggered it (product image,
    // banner, brand logo, ...) — becomes a reusable Media Library entry, so
    // it can be picked again elsewhere without re-uploading the same file.
    await prisma.media.create({
      data: {
        url,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedById: req.user!.id,
      },
    });
    res.status(201).json({ url });
  })
);
