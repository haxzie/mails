"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { transactionals } from "@mails/db/schema";
import { createId } from "@mails/db";
import { isValidEmail, queueEmail } from "@mails/core";
import type { ActionState } from "@/components/client";
import { getDb, getEnv } from "@/lib/cloudflare";
import { requireProject } from "@/lib/projects";

const STARTER_HTML = `<p>Hi {{firstName | there}},</p>
<p>Welcome to {{project.name}} — your account is ready.</p>`;

export async function createTransactionalAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get("slug") ?? "");
  const { project } = await requireProject(slug);
  const name = String(formData.get("name") ?? "").trim();
  const event = String(formData.get("event") ?? "")
    .trim()
    .toLowerCase();
  if (!name) return { error: "Give the email a name" };
  if (!/^[a-z0-9][\w.-]*$/.test(event)) {
    return { error: "Event must look like user.signup" };
  }

  const db = await getDb();
  const existing = await db.query.transactionals.findFirst({
    where: and(
      eq(transactionals.projectId, project.id),
      eq(transactionals.event, event),
    ),
  });
  if (existing) return { error: `“${event}” is already wired to another email` };

  const id = createId("txn");
  await db.insert(transactionals).values({
    id,
    projectId: project.id,
    name,
    event,
    subject: name,
    html: STARTER_HTML,
  });
  redirect(`/p/${slug}/transactional/${id}`);
}

export async function saveTransactionalAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get("slug") ?? "");
  const id = String(formData.get("id") ?? "");
  const { project } = await requireProject(slug);
  const db = await getDb();
  const template = await db.query.transactionals.findFirst({
    where: and(
      eq(transactionals.id, id),
      eq(transactionals.projectId, project.id),
    ),
  });
  if (!template) return { error: "Template not found" };

  const event = String(formData.get("event") ?? template.event)
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9][\w.-]*$/.test(event)) {
    return { error: "Event must look like user.signup" };
  }

  await db
    .update(transactionals)
    .set({
      name: String(formData.get("name") ?? template.name).trim(),
      event,
      subject: String(formData.get("subject") ?? "").trim(),
      html: String(formData.get("html") ?? ""),
      text: String(formData.get("text") ?? "").trim() || null,
      enabled: formData.get("enabled") === "on",
      ignoreUnsubscribes: formData.get("ignoreUnsubscribes") === "on",
    })
    .where(eq(transactionals.id, template.id));

  revalidatePath(`/p/${slug}/transactional/${id}`);
  return { success: "Saved" };
}

export async function testTransactionalAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get("slug") ?? "");
  const id = String(formData.get("id") ?? "");
  const to = String(formData.get("to") ?? "").trim();
  if (!isValidEmail(to)) return { error: "Enter a valid address" };

  const { project } = await requireProject(slug);
  const db = await getDb();
  const template = await db.query.transactionals.findFirst({
    where: and(
      eq(transactionals.id, id),
      eq(transactionals.projectId, project.id),
    ),
  });
  if (!template) return { error: "Template not found" };

  await queueEmail(await getEnv(), {
    projectId: project.id,
    transactionalId: template.id,
    to,
    subject: template.subject,
    kind: "test",
  });
  return { success: `Test queued for ${to}` };
}

export async function deleteTransactionalAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const id = String(formData.get("id") ?? "");
  const { project } = await requireProject(slug);
  const db = await getDb();
  await db
    .delete(transactionals)
    .where(
      and(eq(transactionals.id, id), eq(transactionals.projectId, project.id)),
    );
  redirect(`/p/${slug}/transactional`);
}
