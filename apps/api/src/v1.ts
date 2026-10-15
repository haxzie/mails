import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  contacts as contactsTable,
  emails as emailsTable,
  lists as listsTable,
  transactionals,
} from "@mails/db/schema";
import { createId } from "@mails/db";
import {
  addToList,
  createDbFromEnv,
  isValidEmail,
  normalizeEmail,
  projectStats,
  queueEmail,
  resolveApiKey,
  resubscribeContact,
  unsubscribeContact,
  updateContact,
  upsertContact,
} from "./deps";
import type { HonoEnv } from "./types";

export const v1 = new Hono<HonoEnv>();

/** Every /v1 route is authenticated with `Authorization: Bearer mls_...`. */
v1.use("*", async (c, next) => {
  const header = c.req.header("authorization") ?? "";
  const key = header.replace(/^Bearer\s+/i, "").trim();
  if (!key) {
    return c.json({ error: "Missing Authorization: Bearer <api key>" }, 401);
  }
  const db = createDbFromEnv(c.env);
  const resolved = await resolveApiKey(db, key);
  if (!resolved) return c.json({ error: "Invalid API key" }, 401);
  c.set("db", db);
  c.set("projectId", resolved.projectId);
  c.set("keyId", resolved.keyId);
  await next();
});

async function body<T extends z.ZodType>(c: { req: { json: () => Promise<unknown> } }, schema: T) {
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return { ok: false as const, issues: z.treeifyError(parsed.error) };
  }
  return { ok: true as const, data: parsed.data as z.output<T> };
}

const contactSchema = z.object({
  email: z.string(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  properties: z.record(z.string(), z.unknown()).nullish(),
  subscribed: z.boolean().optional(),
  lists: z.array(z.string()).optional(),
});

/* ------------------------------------------------------------- contacts */

v1.post("/contacts", async (c) => {
  const parsed = await body(c, contactSchema);
  if (!parsed.ok) return c.json({ error: "Invalid body", issues: parsed.issues }, 400);
  const input = parsed.data;
  if (!isValidEmail(input.email)) {
    return c.json({ error: "Invalid email address" }, 400);
  }

  const db = c.get("db");
  const projectId = c.get("projectId");
  const contact = await upsertContact(db, projectId, {
    ...input,
    source: "api",
  });
  for (const listId of input.lists ?? []) {
    const list = await db.query.lists.findFirst({
      where: and(eq(listsTable.id, listId), eq(listsTable.projectId, projectId)),
    });
    if (list) await addToList(db, list.id, contact.id);
  }
  return c.json({ contact }, 200);
});

v1.get("/contacts", async (c) => {
  const db = c.get("db");
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  const rows = await db.query.contacts.findMany({
    where: eq(contactsTable.projectId, c.get("projectId")),
    orderBy: desc(contactsTable.createdAt),
    limit,
  });
  return c.json({ contacts: rows });
});

v1.get("/contacts/:email", async (c) => {
  const db = c.get("db");
  const contact = await db.query.contacts.findFirst({
    where: and(
      eq(contactsTable.projectId, c.get("projectId")),
      eq(contactsTable.email, normalizeEmail(c.req.param("email"))),
    ),
  });
  if (!contact) return c.json({ error: "Contact not found" }, 404);
  return c.json({ contact });
});

const contactPatchSchema = z.object({
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  /** Merged into the stored properties; a null value removes that key. */
  properties: z.record(z.string(), z.unknown()).nullish(),
  subscribed: z.boolean().optional(),
});

/**
 * Partial update — the endpoint to call when something about a customer
 * changes, e.g. `{"properties":{"plan":"pro"}}` when they start paying.
 */
v1.patch("/contacts/:email", async (c) => {
  const parsed = await body(c, contactPatchSchema);
  if (!parsed.ok) return c.json({ error: "Invalid body", issues: parsed.issues }, 400);

  const contact = await updateContact(
    c.get("db"),
    c.get("projectId"),
    c.req.param("email"),
    parsed.data,
  );
  if (!contact) return c.json({ error: "Contact not found" }, 404);
  return c.json({ contact });
});

v1.delete("/contacts/:email", async (c) => {
  const db = c.get("db");
  const email = normalizeEmail(c.req.param("email"));
  await db
    .delete(contactsTable)
    .where(
      and(
        eq(contactsTable.projectId, c.get("projectId")),
        eq(contactsTable.email, email),
      ),
    );
  return c.json({ deleted: true });
});

v1.post("/contacts/:email/unsubscribe", async (c) => {
  const db = c.get("db");
  const projectId = c.get("projectId");
  const contact = await db.query.contacts.findFirst({
    where: and(
      eq(contactsTable.projectId, projectId),
      eq(contactsTable.email, normalizeEmail(c.req.param("email"))),
    ),
  });
  if (!contact) return c.json({ error: "Contact not found" }, 404);
  await unsubscribeContact(db, projectId, contact.id);
  return c.json({ unsubscribed: true });
});

v1.post("/contacts/:email/resubscribe", async (c) => {
  const db = c.get("db");
  const projectId = c.get("projectId");
  const contact = await db.query.contacts.findFirst({
    where: and(
      eq(contactsTable.projectId, projectId),
      eq(contactsTable.email, normalizeEmail(c.req.param("email"))),
    ),
  });
  if (!contact) return c.json({ error: "Contact not found" }, 404);
  // Only an unsubscribe is reversible; bounces and complaints stay suppressed.
  await resubscribeContact(db, projectId, contact.id);
  return c.json({ subscribed: true });
});

/* --------------------------------------------------------------- events */

const eventSchema = z.object({
  event: z.string().min(1),
  email: z.string(),
  /** Extra merge data available to the template as {{key}}. */
  data: z.record(z.string(), z.unknown()).optional(),
  contact: contactSchema.omit({ email: true }).optional(),
});

/**
 * The hook for your own apps: POST an event (`user.signup`) and the matching
 * transactional template is rendered and sent.
 */
v1.post("/events", async (c) => {
  const parsed = await body(c, eventSchema);
  if (!parsed.ok) return c.json({ error: "Invalid body", issues: parsed.issues }, 400);
  const { event, email, data, contact: contactInput } = parsed.data;
  if (!isValidEmail(email)) return c.json({ error: "Invalid email address" }, 400);

  const db = c.get("db");
  const projectId = c.get("projectId");
  const contact = await upsertContact(db, projectId, {
    email,
    ...contactInput,
    properties: { ...(contactInput?.properties ?? {}), ...(data ?? {}) },
    source: "api",
  });

  const template = await db.query.transactionals.findFirst({
    where: and(
      eq(transactionals.projectId, projectId),
      eq(transactionals.event, event),
    ),
  });
  if (!template) {
    return c.json(
      { contact, sent: false, reason: `No template is wired to "${event}"` },
      202,
    );
  }
  if (!template.enabled) {
    return c.json({ contact, sent: false, reason: "Template is disabled" }, 202);
  }

  const emailId = await queueEmail(c.env, {
    projectId,
    transactionalId: template.id,
    contactId: contact.id,
    to: contact.email,
    subject: template.subject,
    kind: "transactional",
  });
  return c.json({ contact, sent: true, emailId }, 202);
});

/* --------------------------------------------------------------- emails */

const sendSchema = z.object({
  to: z.string(),
  subject: z.string().optional(),
  html: z.string().optional(),
  text: z.string().optional(),
  transactionalId: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

/** One-off transactional send, either inline HTML or a stored template. */
v1.post("/emails", async (c) => {
  const parsed = await body(c, sendSchema);
  if (!parsed.ok) return c.json({ error: "Invalid body", issues: parsed.issues }, 400);
  const input = parsed.data;
  if (!isValidEmail(input.to)) return c.json({ error: "Invalid email address" }, 400);

  const db = c.get("db");
  const projectId = c.get("projectId");

  let transactionalId: string | null = null;
  let subject = input.subject ?? "";
  if (input.transactionalId) {
    const template = await db.query.transactionals.findFirst({
      where: and(
        eq(transactionals.id, input.transactionalId),
        eq(transactionals.projectId, projectId),
      ),
    });
    if (!template) return c.json({ error: "Template not found" }, 404);
    transactionalId = template.id;
    subject = template.subject;
  } else if (!input.html || !input.subject) {
    return c.json(
      { error: "Provide either transactionalId, or both subject and html" },
      400,
    );
  }

  const contact = await upsertContact(db, projectId, {
    email: input.to,
    properties: input.data ?? null,
    source: "api",
  });

  const emailId = await queueEmail(c.env, {
    projectId,
    transactionalId,
    contactId: contact.id,
    to: contact.email,
    subject,
    kind: "transactional",
    html: transactionalId ? null : (input.html ?? null),
    text: transactionalId ? null : (input.text ?? null),
  });
  return c.json({ emailId, status: "queued" }, 202);
});

v1.get("/emails/:id", async (c) => {
  const db = c.get("db");
  const row = await db.query.emails.findFirst({
    where: and(
      eq(emailsTable.id, c.req.param("id")),
      eq(emailsTable.projectId, c.get("projectId")),
    ),
  });
  if (!row) return c.json({ error: "Email not found" }, 404);
  return c.json({
    email: {
      id: row.id,
      to: row.to,
      subject: row.subject,
      status: row.status,
      error: row.error,
      opens: row.openCount,
      clicks: row.clickCount,
      sentAt: row.sentAt,
      deliveredAt: row.deliveredAt,
    },
  });
});

/* ---------------------------------------------------------------- lists */

v1.get("/lists", async (c) => {
  const db = c.get("db");
  const rows = await db.query.lists.findMany({
    where: eq(listsTable.projectId, c.get("projectId")),
  });
  return c.json({ lists: rows });
});

v1.post("/lists", async (c) => {
  const parsed = await body(
    c,
    z.object({ name: z.string().min(1), description: z.string().nullish() }),
  );
  if (!parsed.ok) return c.json({ error: "Invalid body", issues: parsed.issues }, 400);
  const db = c.get("db");
  const id = createId("lst");
  await db.insert(listsTable).values({
    id,
    projectId: c.get("projectId"),
    name: parsed.data.name,
    description: parsed.data.description ?? null,
  });
  return c.json({ list: { id, name: parsed.data.name } }, 201);
});

/* ---------------------------------------------------------------- stats */

v1.get("/stats", async (c) => {
  const days = Math.min(Number(c.req.query("days") ?? 30), 365);
  const stats = await projectStats(c.get("db"), c.get("projectId"), days);
  return c.json({ days, stats });
});
