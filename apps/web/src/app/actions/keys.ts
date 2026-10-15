"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { apiKeys } from "@mails/db/schema";
import { createApiKey } from "@mails/core";
import type { ActionState } from "@/components/client";
import { getDb } from "@/lib/cloudflare";
import { requireProject } from "@/lib/projects";

export async function createApiKeyAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get("slug") ?? "");
  const { project } = await requireProject(slug);
  const name = String(formData.get("name") ?? "").trim() || "Default";
  const db = await getDb();
  const key = await createApiKey(db, project.id, name);
  revalidatePath(`/p/${slug}/api`);
  // The plaintext key exists only here; the row stores a hash of it.
  return { success: "API key created", value: key.key };
}

export async function revokeApiKeyAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const keyId = String(formData.get("keyId") ?? "");
  const { project } = await requireProject(slug);
  const db = await getDb();
  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.projectId, project.id)));
  revalidatePath(`/p/${slug}/api`);
}
