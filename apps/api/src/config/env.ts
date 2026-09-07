import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  apiUrl: required("API_URL", "http://localhost:4000"),
  webUrl: required("WEB_URL", "http://localhost:3000"),
  adminUrl: required("ADMIN_URL", "http://localhost:3001"),

  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
  jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
  jwtRefreshTtl: process.env.JWT_REFRESH_TTL ?? "30d",

  settingsEncryptionKey: required("SETTINGS_ENCRYPTION_KEY"),
  uploadDir: process.env.UPLOAD_DIR ?? "./uploads",
  databaseUrl: required("DATABASE_URL"),

  esewa: {
    merchantCode: process.env.ESEWA_MERCHANT_CODE ?? "EPAYTEST",
    secretKey: process.env.ESEWA_SECRET_KEY ?? "8gBm/:&EnhH.1/q",
    mode: process.env.ESEWA_ENV ?? "sandbox",
  },
  fonepay: {
    merchantCode: process.env.FONEPAY_MERCHANT_CODE ?? "",
    secretKey: process.env.FONEPAY_SECRET_KEY ?? "",
    mode: process.env.FONEPAY_ENV ?? "sandbox",
  },
  cybersource: {
    profileId: process.env.CYBERSOURCE_PROFILE_ID ?? "",
    accessKey: process.env.CYBERSOURCE_ACCESS_KEY ?? "",
    secretKey: process.env.CYBERSOURCE_SECRET_KEY ?? "",
    mode: process.env.CYBERSOURCE_ENV ?? "sandbox",
  },
} as const;

// Placeholder secrets from .env.example that must never reach a production
// deploy — a copy-pasted .env is the single most common way these leak in.
const PLACEHOLDER_SECRETS = [
  "change-me-access-secret-min-32-chars-please",
  "change-me-refresh-secret-min-32-chars-please",
  "change-me-32-byte-base64-key-000000000000",
];

if (env.nodeEnv === "production") {
  const secretsToCheck = [
    { name: "JWT_ACCESS_SECRET", value: env.jwtAccessSecret },
    { name: "JWT_REFRESH_SECRET", value: env.jwtRefreshSecret },
    { name: "SETTINGS_ENCRYPTION_KEY", value: env.settingsEncryptionKey },
  ];
  const offenders = secretsToCheck.filter((s) => PLACEHOLDER_SECRETS.includes(s.value));

  if (offenders.length > 0) {
    throw new Error(
      `Refusing to start in production with example placeholder secret(s) still set: ${offenders
        .map((s) => s.name)
        .join(", ")}. Generate real random values before deploying.`
    );
  }
}
