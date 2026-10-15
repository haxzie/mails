import { and, eq } from "drizzle-orm";
import { contacts, listMembers, suppressions } from "@mails/db/schema";
import { createId, type Database } from "@mails/db";

export interface ContactInput {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  properties?: Record<string, unknown> | null;
  subscribed?: boolean;
  source?: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@,]+\.[^\s@,]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/** Creates or updates a contact by (project, email). */
export async function upsertContact(
  db: Database,
  projectId: string,
  input: ContactInput,
) {
  const email = normalizeEmail(input.email);
  const id = createId("con");
  const values = {
    id,
    projectId,
    email,
    firstName: input.firstName ?? null,
    lastName: input.lastName ?? null,
    properties: input.properties ?? null,
    source: input.source ?? "api",
    ...(input.subscribed === undefined ? {} : { subscribed: input.subscribed }),
  };

  await db
    .insert(contacts)
    .values(values)
    .onConflictDoUpdate({
      target: [contacts.projectId, contacts.email],
      set: {
        // Only overwrite fields that were actually provided.
        ...(input.firstName === undefined ? {} : { firstName: input.firstName }),
        ...(input.lastName === undefined ? {} : { lastName: input.lastName }),
        ...(input.properties === undefined
          ? {}
          : { properties: input.properties }),
        ...(input.subscribed === undefined
          ? {}
          : { subscribed: input.subscribed }),
      },
    });

  const row = await db.query.contacts.findFirst({
    where: and(eq(contacts.projectId, projectId), eq(contacts.email, email)),
  });
  return row!;
}

/**
 * Merges a property patch into what is already stored. A `null` value
 * removes the key, so callers can clear a flag without sending the rest.
 */
export function mergeProperties(
  existing: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (patch === undefined) return existing ?? null;
  if (patch === null) return null;
  const merged: Record<string, unknown> = { ...(existing ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete merged[key];
    else merged[key] = value;
  }
  return Object.keys(merged).length > 0 ? merged : null;
}

export interface ContactPatch {
  firstName?: string | null;
  lastName?: string | null;
  /** Merged into the stored properties; `null` on a key removes it. */
  properties?: Record<string, unknown> | null;
  subscribed?: boolean;
}

/**
 * Partial update of an existing contact. Unlike `upsertContact`, properties
 * are merged rather than replaced, so marking someone as paid does not drop
 * everything else you know about them.
 */
export async function updateContact(
  db: Database,
  projectId: string,
  email: string,
  patch: ContactPatch,
) {
  const current = await db.query.contacts.findFirst({
    where: and(
      eq(contacts.projectId, projectId),
      eq(contacts.email, normalizeEmail(email)),
    ),
  });
  if (!current) return null;

  const values: Partial<typeof contacts.$inferInsert> = {};
  if (patch.firstName !== undefined) values.firstName = patch.firstName;
  if (patch.lastName !== undefined) values.lastName = patch.lastName;
  if (patch.properties !== undefined) {
    values.properties = mergeProperties(current.properties, patch.properties);
  }

  if (Object.keys(values).length > 0) {
    await db.update(contacts).set(values).where(eq(contacts.id, current.id));
  }

  // Consent changes also move the address on and off the suppression list.
  if (patch.subscribed === false && current.subscribed) {
    await unsubscribeContact(db, projectId, current.id);
  } else if (patch.subscribed === true && !current.subscribed) {
    await resubscribeContact(db, projectId, current.id);
  }

  return db.query.contacts.findFirst({ where: eq(contacts.id, current.id) });
}

export async function addToList(
  db: Database,
  listId: string,
  contactId: string,
) {
  await db
    .insert(listMembers)
    .values({ id: createId("lmb"), listId, contactId })
    .onConflictDoNothing();
}

export async function removeFromList(
  db: Database,
  listId: string,
  contactId: string,
) {
  await db
    .delete(listMembers)
    .where(
      and(eq(listMembers.listId, listId), eq(listMembers.contactId, contactId)),
    );
}

export async function suppress(
  db: Database,
  projectId: string,
  email: string,
  reason: "bounce" | "complaint" | "unsubscribe" | "manual",
  detail?: string,
) {
  await db
    .insert(suppressions)
    .values({
      id: createId("sup"),
      projectId,
      email: normalizeEmail(email),
      reason,
      detail,
    })
    .onConflictDoNothing();
}

export async function unsubscribeContact(
  db: Database,
  projectId: string,
  contactId: string,
  reason: "unsubscribe" | "complaint" = "unsubscribe",
) {
  const contact = await db.query.contacts.findFirst({
    where: and(eq(contacts.id, contactId), eq(contacts.projectId, projectId)),
  });
  if (!contact) return null;
  await db
    .update(contacts)
    .set({ subscribed: false, unsubscribedAt: new Date() })
    .where(eq(contacts.id, contactId));
  await suppress(db, projectId, contact.email, reason);
  return contact;
}

export async function resubscribeContact(
  db: Database,
  projectId: string,
  contactId: string,
) {
  const contact = await db.query.contacts.findFirst({
    where: and(eq(contacts.id, contactId), eq(contacts.projectId, projectId)),
  });
  if (!contact) return null;
  await db
    .update(contacts)
    .set({ subscribed: true, unsubscribedAt: null })
    .where(eq(contacts.id, contactId));
  // Only unsubscribes are reversible here; bounces and complaints stay.
  await db
    .delete(suppressions)
    .where(
      and(
        eq(suppressions.projectId, projectId),
        eq(suppressions.email, contact.email),
        eq(suppressions.reason, "unsubscribe"),
      ),
    );
  return contact;
}

/** Parses a CSV import. First row must be a header with an `email` column. */
export function parseContactsCsv(csv: string): {
  contacts: ContactInput[];
  errors: string[];
} {
  const rows = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(splitCsvLine);
  const errors: string[] = [];
  const header = rows.shift();
  if (!header) return { contacts: [], errors: ["The file is empty"] };

  const columns = header.map((name) => name.trim().toLowerCase());
  const emailIndex = columns.findIndex((name) =>
    ["email", "email address", "e-mail"].includes(name),
  );
  if (emailIndex === -1) {
    return { contacts: [], errors: ["No `email` column in the header row"] };
  }

  const parsed: ContactInput[] = [];
  rows.forEach((row, index) => {
    const email = row[emailIndex]?.trim() ?? "";
    if (!isValidEmail(email)) {
      errors.push(`Row ${index + 2}: "${email}" is not a valid address`);
      return;
    }
    const properties: Record<string, unknown> = {};
    let firstName: string | null = null;
    let lastName: string | null = null;
    columns.forEach((column, columnIndex) => {
      if (columnIndex === emailIndex) return;
      const value = row[columnIndex]?.trim();
      if (!value) return;
      if (["firstname", "first name", "first_name"].includes(column)) {
        firstName = value;
      } else if (["lastname", "last name", "last_name"].includes(column)) {
        lastName = value;
      } else {
        properties[column.replace(/[^\w]+/g, "_")] = value;
      }
    });
    parsed.push({
      email,
      firstName,
      lastName,
      properties: Object.keys(properties).length ? properties : null,
      source: "import",
    });
  });

  return { contacts: parsed, errors };
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}
