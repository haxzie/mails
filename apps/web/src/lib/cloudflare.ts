import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { AppEnv } from "@mails/core";
import { createDb, type Database } from "@mails/db";

/** The Worker bindings from wrangler.jsonc (D1, the send queue, secrets). */
export async function getEnv(): Promise<AppEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env as unknown as AppEnv;
}

export async function getDb(): Promise<Database> {
  return createDb((await getEnv()).DB);
}
