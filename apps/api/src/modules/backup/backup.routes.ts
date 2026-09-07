import { Router } from "express";
import multer from "multer";
import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { prisma } from "@ecommerce-x/db";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { HttpError } from "../../lib/http-error.js";
import { env } from "../../config/env.js";
import { logAudit } from "../../lib/audit-log.js";

// Database backup/restore is the single most powerful capability in this
// system — a downloaded backup contains every customer's full PII and order
// history, and a restore can overwrite the live database entirely. Both are
// restricted to SUPERADMIN only (stricter than the usual ADMIN_ROLES).
export const backupRouter = Router();
backupRouter.use(requireAuth, requireRole("SUPERADMIN"));

// Sibling to the (already-gitignored, non-web-served) uploads directory —
// never put this under a path express.static() serves.
const BACKUP_DIR = path.resolve(env.uploadDir, "..", "backups");
const TMP_DIR = path.join(BACKUP_DIR, "tmp");
fs.mkdirSync(TMP_DIR, { recursive: true });

const MAX_SAFETY_BACKUPS = 5;

// Prisma's DATABASE_URL carries query params (`schema`, `connection_limit`,
// `pgbouncer`, ...) that are its own extensions, not standard libpq — pg_dump
// rejects the URL outright if any are present ("invalid URI query
// parameter"). Strip them and pass the schema on explicitly instead.
function pgToolConnection(): { url: string; schema: string } {
  const parsed = new URL(env.databaseUrl);
  const schema = parsed.searchParams.get("schema") || "public";
  for (const key of ["schema", "connection_limit", "pool_timeout", "socket_timeout", "pgbouncer", "statement_cache_size"]) {
    parsed.searchParams.delete(key);
  }
  return { url: parsed.toString(), schema };
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function friendlyChildProcessError(err: NodeJS.ErrnoException, binary: string): Error {
  if (err.code === "ENOENT") {
    return new Error(`${binary} is not installed on the API server. Install the PostgreSQL client tools to enable backup/restore.`);
  }
  return err;
}

/** Runs pg_dump, resolving with the output file path. Streams straight to disk — never buffers a whole dump in memory. */
function dumpToFile(destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const { url, schema } = pgToolConnection();
    const child = spawn("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--schema", schema, "--file", destPath, url]);
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => reject(friendlyChildProcessError(err, "pg_dump")));
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`pg_dump exited with code ${code}: ${stderr.slice(0, 500)}`))));
  });
}

async function pruneOldSafetyBackups(): Promise<void> {
  const files = (await fsp.readdir(BACKUP_DIR)).filter((f) => f.startsWith("pre-restore-") && f.endsWith(".dump"));
  if (files.length <= MAX_SAFETY_BACKUPS) return;
  const withStats = await Promise.all(files.map(async (f) => ({ f, mtime: (await fsp.stat(path.join(BACKUP_DIR, f))).mtimeMs })));
  withStats.sort((a, b) => b.mtime - a.mtime);
  for (const { f } of withStats.slice(MAX_SAFETY_BACKUPS)) {
    await fsp.unlink(path.join(BACKUP_DIR, f)).catch(() => {});
  }
}

// ---- Download a fresh backup on demand ----
backupRouter.get(
  "/download",
  asyncHandler(async (req, res) => {
    await logAudit({ userId: req.user!.id, action: "backup.downloaded", ipAddress: req.ip });
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="backup-${timestamp()}.dump"`);
    res.setHeader("Cache-Control", "no-store");

    const { url, schema } = pgToolConnection();
    const child = spawn("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--schema", schema, url]);
    child.stdout.pipe(res);
    child.on("error", (err) => {
      const friendly = friendlyChildProcessError(err, "pg_dump");
      if (!res.headersSent) res.status(500).json({ message: friendly.message, code: "BACKUP_FAILED" });
      else res.destroy();
    });
    child.stderr.on("data", (d) => console.error("pg_dump:", d.toString()));
  })
);

// ---- Restore from an uploaded backup file (destructive) ----
const upload = multer({
  dest: TMP_DIR,
  limits: { fileSize: 500 * 1024 * 1024 },
});

backupRouter.post(
  "/restore",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw HttpError.badRequest("No backup file uploaded");

    const fd = await fsp.open(req.file.path, "r");
    const header = Buffer.alloc(5);
    await fd.read(header, 0, 5, 0);
    await fd.close();
    if (header.toString("utf8") !== "PGDMP") {
      await fsp.unlink(req.file.path).catch(() => {});
      throw HttpError.badRequest("This doesn't look like a valid pg_dump custom-format backup file");
    }

    // Safety net: snapshot the current (about-to-be-destroyed) database
    // before running a destructive restore, so a bad upload is recoverable.
    const safetyFilename = `pre-restore-${timestamp()}.dump`;
    await dumpToFile(path.join(BACKUP_DIR, safetyFilename));

    try {
      await new Promise<void>((resolve, reject) => {
        const { url } = pgToolConnection();
        const child = spawn("pg_restore", ["--clean", "--if-exists", "--no-owner", "--no-acl", "-d", url, req.file!.path]);
        let stderr = "";
        child.stderr.on("data", (d) => (stderr += d.toString()));
        child.on("error", (err) => reject(friendlyChildProcessError(err, "pg_restore")));
        // pg_restore commonly exits non-zero on harmless "does not exist, skipping"
        // notices from --if-exists on a fresh/partial DB; only treat it as a real
        // failure if stderr contains something other than those notices.
        child.on("close", (code) => {
          if (code === 0) return resolve();
          const realErrors = stderr.split("\n").filter((line) => line && !line.includes("does not exist, skipping"));
          if (realErrors.length === 0) return resolve();
          reject(new Error(`pg_restore reported errors: ${realErrors.slice(0, 10).join("; ")}`));
        });
      });
    } finally {
      await fsp.unlink(req.file.path).catch(() => {});
    }

    // The running Prisma connection pool may hold stale prepared statements
    // against tables that were just dropped and recreated — force a clean
    // reconnect so the very next request doesn't see stale-plan errors.
    await prisma.$disconnect();
    await pruneOldSafetyBackups();

    await logAudit({ userId: req.user!.id, action: "backup.restored", metadata: { safetyBackup: safetyFilename }, ipAddress: req.ip });
    res.json({ success: true, safetyBackup: safetyFilename });
  })
);

// ---- Safety backups created automatically before each restore ----
backupRouter.get(
  "/safety-backups",
  asyncHandler(async (_req, res) => {
    const files = (await fsp.readdir(BACKUP_DIR).catch(() => [])).filter((f) => f.startsWith("pre-restore-") && f.endsWith(".dump"));
    const withStats = await Promise.all(
      files.map(async (f) => {
        const stat = await fsp.stat(path.join(BACKUP_DIR, f));
        return { filename: f, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
      })
    );
    withStats.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json(withStats);
  })
);

backupRouter.get(
  "/safety-backups/:filename",
  asyncHandler(async (req, res) => {
    // Never join user input directly into a filesystem path — resolve
    // against the real directory listing so `../../etc/passwd`-style
    // traversal can't escape BACKUP_DIR.
    const files: string[] = await fsp.readdir(BACKUP_DIR).catch(() => []);
    const filename = req.params.filename as string;
    if (!files.includes(filename)) throw HttpError.notFound("Backup file not found");

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(BACKUP_DIR, filename));
  })
);
