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

export async function updateProjectAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get("slug") ?? "");
  const { project } = await requireProject(slug);
  const db = await getDb();
  const env = await getEnv();

  const secret = String(formData.get("sesSecretKey") ?? "").trim();
  const name = String(formData.get("name") ?? project.name).trim();

  await db
    .update(projects)
    .set({
      name,
      fromName: String(formData.get("fromName") ?? "").trim(),
      fromEmail: String(formData.get("fromEmail") ?? "").trim().toLowerCase(),
      replyTo: String(formData.get("replyTo") ?? "").trim() || null,
      sendingDomain:
        String(formData.get("sendingDomain") ?? "").trim().toLowerCase() || null,
      postalAddress: String(formData.get("postalAddress") ?? "").trim() || null,
      sesRegion: String(formData.get("sesRegion") ?? project.sesRegion),
      sesAccessKeyId:
        String(formData.get("sesAccessKeyId") ?? "").trim() || null,
      // An empty field keeps the stored key instead of wiping it.
      ...(secret
        ? { sesSecretKey: await encryptSecret(secret, env.ENCRYPTION_KEY) }
        : {}),
      sesConfigurationSet:
        String(formData.get("sesConfigurationSet") ?? "").trim() || null,
      sendRate: Math.max(1, Number(formData.get("sendRate") ?? 10)),
      trackOpens: formData.get("trackOpens") === "on",
      trackClicks: formData.get("trackClicks") === "on",
    })
    .where(eq(projects.id, project.id));

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
