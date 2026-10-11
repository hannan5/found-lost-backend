import { z } from "zod";

/**
 * Every variable the app reads. `.env.example` must list each one.
 * Read values through `ConfigService<Env, true>`, never `process.env`.
 *
 * Two files are loaded: `.env` (app settings, written by hand) and
 * `.env.local` (DATABASE_URL and AWS_* storage credentials, written by
 * `neon link` / `neon deploy`). Both are git-ignored.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  /** Public base URL of this API; file URLs are built from it. */
  APP_URL: z.string().min(1).default("http://localhost:4000"),

  // ----- Neon Postgres (from .env.local) -----------------------------------
  DATABASE_URL: z.string().min(1, { error: "DATABASE_URL is required." }),
  DATABASE_URL_TEST: z.string().optional(),

  // ----- Neon Object Storage, S3-compatible (from .env.local) ---------------
  AWS_ACCESS_KEY_ID: z.string().min(1, { error: "AWS_ACCESS_KEY_ID is required." }),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, { error: "AWS_SECRET_ACCESS_KEY is required." }),
  AWS_ENDPOINT_URL_S3: z.url({ error: "AWS_ENDPOINT_URL_S3 must be a URL." }),
  AWS_REGION: z.string().min(1, { error: "AWS_REGION is required." }),
  /** Bucket declared in neon.ts. */
  STORAGE_BUCKET: z.string().min(1).default("files"),

  // ----- Auth ---------------------------------------------------------------
  JWT_SECRET: z.string().min(16, { error: "JWT_SECRET must be at least 16 characters." }),
  JWT_EXPIRES_IN_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 7),

  CORS_ORIGIN: z.string().min(1).default("http://localhost:3000"),

  // ----- Email (optional in dev: without SMTP_HOST mail is logged, not sent) -
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  MAIL_FROM: z.string().min(1).default("LostNFind <no-reply@lostnfind.local>"),
  ADMIN_EMAIL: z.email({ error: "ADMIN_EMAIL must be a valid email address." }),

  // ----- Seed ---------------------------------------------------------------
  SEED_ADMIN_EMAIL: z.email().default("admin@lostnfind.local"),
  SEED_ADMIN_PASSWORD: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/** Passed to `ConfigModule.forRoot({ validate })`. Throws so Nest refuses to boot. */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (result.success) return result.data;

  const lines = result.error.issues.map(
    (issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`,
  );
  throw new Error(
    `Invalid environment configuration. Copy .env.example to .env, run \`neon link\`, and fill in:\n${lines.join("\n")}`,
  );
}
