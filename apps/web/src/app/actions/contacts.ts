"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { contacts, listMembers, lists } from "@mails/db/schema";
import { createId } from "@mails/db";
import {
  addToList,
  isValidEmail,
  parseContactsCsv,
  resubscribeContact,
  unsubscribeContact,
  upsertContact,
} from "@mails/core";
import type { ActionState } from "@/components/client";
import { getDb } from "@/lib/cloudflare";
import { requireProject } from "@/lib/projects";

export async function createContactAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get("slug") ?? "");
  const { project } = await requireProject(slug);
  const email = String(formData.get("email") ?? "");
  if (!isValidEmail(email)) return { error: "That is not a valid email address" };

  const db = await getDb();
  const contact = await upsertContact(db, project.id, {
    email,
    firstName: String(formData.get("firstName") ?? "").trim() || null,
    lastName: String(formData.get("lastName") ?? "").trim() || null,
    source: "manual",
  });
  const listId = String(formData.get("listId") ?? "");
  if (listId) {
    const list = await db.query.lists.findFirst({
      where: and(eq(lists.id, listId), eq(lists.projectId, project.id)),
    });
    if (list) await addToList(db, list.id, contact.id);
  }

  revalidatePath(`/p/${slug}/contacts`);
  return { success: `${contact.email} added` };
}

export async function importContactsAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get("slug") ?? "");
  const { project } = await requireProject(slug);

  const file = formData.get("file");
  const csv =
    file instanceof File && file.size > 0
      ? await file.text()
      : String(formData.get("csv") ?? "");
  if (!csv.trim()) return { error: "Paste some CSV or choose a file" };

  const { contacts: parsed, errors } = parseContactsCsv(csv);
  if (parsed.length === 0) {
    return { error: errors[0] ?? "Nothing to import" };
  }

  const db = await getDb();
  const listId = String(formData.get("listId") ?? "");
  const list = listId
    ? await db.query.lists.findFirst({
        where: and(eq(lists.id, listId), eq(lists.projectId, project.id)),
      })
    : null;

  for (const input of parsed) {
    const contact = await upsertContact(db, project.id, input);
    if (list) await addToList(db, list.id, contact.id);
  }

  revalidatePath(`/p/${slug}/contacts`);
  const skipped = errors.length ? `, ${errors.length} row(s) skipped` : "";
  return { success: `Imported ${parsed.length} contact(s)${skipped}` };
}

export async function toggleSubscriptionAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const contactId = String(formData.get("contactId") ?? "");
  const { project } = await requireProject(slug);
  const db = await getDb();
  const contact = await db.query.contacts.findFirst({
    where: and(eq(contacts.id, contactId), eq(contacts.projectId, project.id)),
  });
  if (!contact) return;
  if (contact.subscribed) {
    await unsubscribeContact(db, project.id, contact.id);
  } else {
    await resubscribeContact(db, project.id, contact.id);
  }
  revalidatePath(`/p/${slug}/contacts`);
}

export async function deleteContactAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const contactId = String(formData.get("contactId") ?? "");
  const { project } = await requireProject(slug);
  const db = await getDb();
  await db
    .delete(contacts)
    .where(
      and(eq(contacts.id, contactId), eq(contacts.projectId, project.id)),
    );
  revalidatePath(`/p/${slug}/contacts`);
}

export async function createListAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get("slug") ?? "");
  const { project } = await requireProject(slug);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the list a name" };

  const db = await getDb();
  await db.insert(lists).values({
    id: createId("lst"),
    projectId: project.id,
    name,
    description: String(formData.get("description") ?? "").trim() || null,
  });
  revalidatePath(`/p/${slug}/contacts`);
  return { success: `List “${name}” created` };
}

export async function deleteListAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const listId = String(formData.get("listId") ?? "");
  const { project } = await requireProject(slug);
  const db = await getDb();
  await db
    .delete(lists)
    .where(and(eq(lists.id, listId), eq(lists.projectId, project.id)));
  revalidatePath(`/p/${slug}/contacts`);
}

export async function setListMembershipAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const contactId = String(formData.get("contactId") ?? "");
  const listId = String(formData.get("listId") ?? "");
  const { project } = await requireProject(slug);
  const db = await getDb();
  const list = await db.query.lists.findFirst({
    where: and(eq(lists.id, listId), eq(lists.projectId, project.id)),
  });
  if (!list) return;
  const existing = await db.query.listMembers.findFirst({
    where: and(
      eq(listMembers.listId, list.id),
      eq(listMembers.contactId, contactId),
    ),
  });
  if (existing) {
    await db.delete(listMembers).where(eq(listMembers.id, existing.id));
  } else {
    await addToList(db, list.id, contactId);
  }
  revalidatePath(`/p/${slug}/contacts/${contactId}`);
}
