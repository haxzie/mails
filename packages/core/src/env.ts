import type { QueueMessage } from "./queue-types";

/** Bindings shared by both Workers (the Next.js app and the Hono API). */
export interface AppEnv {
  DB: D1Database;
  SEND_QUEUE: Queue<QueueMessage>;
  /** Secrets */
  ENCRYPTION_KEY: string;
  AUTH_SECRET: string;
  /** Public URLs, no trailing slash. */
  APP_URL: string;
  API_URL: string;
  /** Comma separated allowlist of addresses that may sign in / sign up. */
  ALLOWED_EMAILS: string;
  /** SES identity used for the platform's own mail (login links). */
  SYSTEM_SES_REGION?: string;
  SYSTEM_SES_ACCESS_KEY_ID?: string;
  SYSTEM_SES_SECRET_ACCESS_KEY?: string;
  SYSTEM_FROM_EMAIL?: string;
  SYSTEM_FROM_NAME?: string;
  /** Shared secret for the SNS subscription endpoint. */
  SNS_WEBHOOK_SECRET?: string;
}

export function requireEnv<K extends keyof AppEnv>(
  env: AppEnv,
  key: K,
): NonNullable<AppEnv[K]> {
  const value = env[key];
  if (!value) throw new Error(`Missing required binding: ${String(key)}`);
  return value as NonNullable<AppEnv[K]>;
}

/**
 * True only when the app is served from a developer machine. Anything that
 * would be unsafe to reveal in a browser — like the sign-in code — is gated
 * on this rather than on whether a mail provider happens to be configured.
 */
export function isLocalDeployment(env: AppEnv): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(
    (env.APP_URL ?? "").trim(),
  );
}

export function isEmailAllowed(env: AppEnv, email: string): boolean {
  const allowed = (env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return false;
  const normalized = email.trim().toLowerCase();
  return allowed.some((entry) =>
    entry.startsWith("@") ? normalized.endsWith(entry) : entry === normalized,
  );
}
