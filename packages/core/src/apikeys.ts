import { and, eq, isNull } from "drizzle-orm";
import { apiKeys } from "@mails/db/schema";
import type { Database } from "@mails/db";
import { createId } from "@mails/db";
import { randomToken, sha256 } from "./crypto";

export interface GeneratedApiKey {
  id: string;
  /** Shown exactly once, at creation time. */
  key: string;
  prefix: string;
}

export async function createApiKey(
  db: Database,
  projectId: string,
  name: string,
): Promise<GeneratedApiKey> {
  const key = `mls_${randomToken(24)}`;
  const id = createId("key");
  await db.insert(apiKeys).values({
    id,
    projectId,
    name,
    prefix: key.slice(0, 11),
    keyHash: await sha256(key),
  });
  return { id, key, prefix: key.slice(0, 11) };
}

/** Resolves an `Authorization: Bearer <key>` value to its project. */
export async function resolveApiKey(db: Database, key: string) {
  const hash = await sha256(key.trim());
  const row = await db.query.apiKeys.findFirst({
    where: and(eq(apiKeys.keyHash, hash), isNull(apiKeys.revokedAt)),
  });
  if (!row) return null;
  // Best effort, never blocks the request path.
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id));
  return { keyId: row.id, projectId: row.projectId };
}
