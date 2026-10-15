"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { projects } from "@mails/db/schema";
import { createId } from "@mails/db";
import {
  createSesDomainIdentity,
  encryptSecret,
  getSesAccount,
  getSesIdentity,
  projectSesCredentials,
} from "@mails/core";
import type { ActionState } from "@/components/client";
import { getDb, getEnv } from "@/lib/cloudflare";
import { requireProject, slugify } from "@/lib/projects";
import { requireUser } from "@/lib/session";

export async function createProjectAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the project a name" };

  const db = await getDb();
  const base = slugify(name) || "project";
  let slug = base;
  for (let attempt = 1; attempt < 50; attempt++) {
    const existing = await db.query.projects.findFirst({
      where: eq(projects.slug, slug),
    });
    if (!existing) break;
    slug = `${base}-${attempt}`;
  }

  await db.insert(projects).values({
    id: createId("prj"),
    userId: user.id,
    name,
    slug,
    fromName: name,
    fromEmail: String(formData.get("fromEmail") ?? "").trim(),
    sendingDomain: String(formData.get("sendingDomain") ?? "").trim() || null,
    sesRegion: String(formData.get("sesRegion") ?? "us-east-1"),
  });

  // The sidebar lives in the shared layout, so it needs refreshing too.
  revalidatePath("/", "layout");
  redirect(`/p/${slug}`);
}

/**
 * Patches only the fields the submitted form actually carries, so each
 * settings section can save on its own without clearing the others.
 */
export async function updateProjectAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get("slug") ?? "");
  const { project } = await requireProject(slug);
  const db = await getDb();
  const env = await getEnv();

  const text = (key: string) => String(formData.get(key) ?? "").trim();
  // Unchecked boxes are not submitted, so every toggle ships a hidden "off"
  // alongside it and the last value wins.
  const checked = (key: string) => formData.getAll(key).includes("on");

  const patch: Partial<typeof projects.$inferInsert> = {};
  if (formData.has("name")) patch.name = text("name") || project.name;
  if (formData.has("fromName")) patch.fromName = text("fromName");
  if (formData.has("fromEmail")) patch.fromEmail = text("fromEmail").toLowerCase();
  if (formData.has("replyTo")) patch.replyTo = text("replyTo") || null;
  if (formData.has("sendingDomain")) {
    patch.sendingDomain = text("sendingDomain").toLowerCase() || null;
  }
  if (formData.has("postalAddress")) {
    patch.postalAddress = text("postalAddress") || null;
  }
  if (formData.has("sesRegion")) {
    patch.sesRegion = text("sesRegion") || project.sesRegion;
  }
  if (formData.has("sesAccessKeyId")) {
    patch.sesAccessKeyId = text("sesAccessKeyId") || null;
  }
  // An empty secret field keeps the stored key instead of wiping it.
  if (text("sesSecretKey")) {
    patch.sesSecretKey = await encryptSecret(
      text("sesSecretKey"),
      env.ENCRYPTION_KEY,
    );
  }
  if (formData.has("sesConfigurationSet")) {
    patch.sesConfigurationSet = text("sesConfigurationSet") || null;
  }
  if (formData.has("sendRate")) {
    patch.sendRate = Math.max(1, Number(formData.get("sendRate") ?? 10));
  }
  if (formData.has("trackOpens")) patch.trackOpens = checked("trackOpens");
  if (formData.has("trackClicks")) patch.trackClicks = checked("trackClicks");

  if (Object.keys(patch).length === 0) return { success: "Nothing to save" };

  await db.update(projects).set(patch).where(eq(projects.id, project.id));

  revalidatePath("/", "layout");
  return { success: "Settings saved" };
}

export async function testSesAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get("slug") ?? "");
  const { project } = await requireProject(slug);
  const env = await getEnv();
  try {
    const credentials = await projectSesCredentials(env, project);
    const account = await getSesAccount(credentials);
    return {
      success: `Connected. ${
        account.productionAccess ? "Production access" : "Sandbox mode"
      }, ${account.maxSendRate}/s, ${account.sentLast24Hours}/${
        account.max24HourSend
      } sent in the last 24h.`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function verifyDomainAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get("slug") ?? "");
  const { project } = await requireProject(slug);
  if (!project.sendingDomain) return { error: "Set a sending domain first" };
  const env = await getEnv();

  try {
    const credentials = await projectSesCredentials(env, project);
    try {
      await getSesIdentity(credentials, project.sendingDomain);
    } catch {
      await createSesDomainIdentity(credentials, project.sendingDomain);
    }
    revalidatePath(`/p/${slug}/settings`);
    return {
      success:
        "Domain registered with SES. Publish the DKIM records below, then re-check in a few minutes.",
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function deleteProjectAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const { user, project } = await requireProject(slug);
  const db = await getDb();
  await db
    .delete(projects)
    .where(and(eq(projects.id, project.id), eq(projects.userId, user.id)));
  revalidatePath("/", "layout");
  redirect("/");
}
