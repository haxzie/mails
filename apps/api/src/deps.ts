import { createDb } from "@mails/db";
import type { AppEnv } from "@mails/core";

export * from "@mails/core";
export { createDb };

export function createDbFromEnv(env: AppEnv) {
  return createDb(env.DB);
}
