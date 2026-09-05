import { prisma } from "@ecommerce-x/db";
import { encryptJson, decryptJson } from "../../lib/encryption.js";

export async function getSetting<T = unknown>(group: string, key: string): Promise<T | null> {
  const row = await prisma.setting.findUnique({ where: { group_key: { group, key } } });
  if (!row) return null;
  return row.isSecret ? decryptJson<T>(row.value as unknown as string) : ((row.value as unknown) as T);
}

export async function getSettingsGroup(group: string): Promise<Record<string, unknown>> {
  const rows = await prisma.setting.findMany({ where: { group } });
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    out[row.key] = row.isSecret ? decryptJson(row.value as unknown as string) : row.value;
  }
  return out;
}

export async function getAllSettings(): Promise<Record<string, Record<string, unknown>>> {
  const rows = await prisma.setting.findMany();
  const out: Record<string, Record<string, unknown>> = {};
  for (const row of rows) {
    out[row.group] ??= {};
    out[row.group]![row.key] = row.isSecret ? decryptJson(row.value as unknown as string) : row.value;
  }
  return out;
}

export async function setSetting(group: string, key: string, value: unknown, isSecret = false): Promise<void> {
  const storedValue = isSecret ? (encryptJson(value) as unknown as object) : (value as object);
  await prisma.setting.upsert({
    where: { group_key: { group, key } },
    update: { value: storedValue, isSecret },
    create: { group, key, value: storedValue, isSecret },
  });
}

export async function setSettingsGroup(group: string, entries: Record<string, unknown>, secretKeys: string[] = []): Promise<void> {
  await prisma.$transaction(
    Object.entries(entries).map(([key, value]) =>
      prisma.setting.upsert({
        where: { group_key: { group, key } },
        update: { value: (secretKeys.includes(key) ? encryptJson(value) : value) as object, isSecret: secretKeys.includes(key) },
        create: { group, key, value: (secretKeys.includes(key) ? encryptJson(value) : value) as object, isSecret: secretKeys.includes(key) },
      })
    )
  );
}

// Public settings are safe to expose to the storefront/admin without auth (never includes secrets).
export async function getPublicSettings() {
  const all = await getAllSettings();
  const { payments, ...rest } = all;
  const publicPayments: Record<string, unknown> = {};
  if (payments) {
    for (const [k, v] of Object.entries(payments)) {
      const val = v as Record<string, unknown>;
      publicPayments[k] = { enabled: val?.enabled ?? false, mode: val?.mode ?? "sandbox" };
    }
  }
  return { ...rest, payments: publicPayments };
}
