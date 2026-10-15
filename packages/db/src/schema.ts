import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const id = () => text().primaryKey();
const createdAt = () =>
  integer({ mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

/* ------------------------------------------------------------------ auth */

export const users = sqliteTable("users", {
  id: id(),
  email: text().notNull().unique(),
  name: text(),
  createdAt: createdAt(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: id(), // sha256 of the session token
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer({ mode: "timestamp_ms" }).notNull(),
    userAgent: text(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Magic-link / one time code login attempts. */
export const loginTokens = sqliteTable(
  "login_tokens",
  {
    id: id(),
    email: text().notNull(),
    tokenHash: text().notNull(), // sha256 of the emailed token
    code: text().notNull(), // 6 digit code, usable instead of the link
    expiresAt: integer({ mode: "timestamp_ms" }).notNull(),
    consumedAt: integer({ mode: "timestamp_ms" }),
    attempts: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("login_tokens_email_idx").on(t.email)],
);

/* -------------------------------------------------------------- projects */

export const projects = sqliteTable(
  "projects",
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    slug: text().notNull().unique(),
    /** Sending identity */
    fromName: text().notNull().default(""),
    fromEmail: text().notNull().default(""),
    replyTo: text(),
    sendingDomain: text(),
    /** Physical address, required by CAN-SPAM, rendered in the footer. */
    postalAddress: text(),
    /** Amazon SES */
    sesRegion: text().notNull().default("us-east-1"),
    sesAccessKeyId: text(),
    sesSecretKey: text(), // AES-GCM encrypted with ENCRYPTION_KEY
    sesConfigurationSet: text(),
    /** BIMI: the logo mailbox providers show next to your name. */
    bimiLogoUrl: text(),
    bimiCertificateUrl: text(),
    /** Max messages/second handed to SES (your SES account quota). */
    sendRate: integer().notNull().default(10),
    trackOpens: integer({ mode: "boolean" }).notNull().default(true),
    trackClicks: integer({ mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("projects_user_idx").on(t.userId)],
);

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: id(),
    projectId: text()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text().notNull(),
    prefix: text().notNull(), // first chars, shown in the UI
    keyHash: text().notNull().unique(), // sha256 of the full key
    lastUsedAt: integer({ mode: "timestamp_ms" }),
    revokedAt: integer({ mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("api_keys_project_idx").on(t.projectId)],
);

/* -------------------------------------------------------------- audience */

export const contacts = sqliteTable(
  "contacts",
  {
    id: id(),
    projectId: text()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    email: text().notNull(),
    firstName: text(),
    lastName: text(),
    /** Arbitrary JSON merge data, available as {{properties.key}}. */
    properties: text({ mode: "json" }).$type<Record<string, unknown>>(),
    subscribed: integer({ mode: "boolean" }).notNull().default(true),
    unsubscribedAt: integer({ mode: "timestamp_ms" }),
    source: text().notNull().default("manual"), // manual | api | import
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("contacts_project_email_idx").on(t.projectId, t.email),
    index("contacts_project_idx").on(t.projectId),
  ],
);

export const lists = sqliteTable(
  "lists",
  {
    id: id(),
    projectId: text()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text().notNull(),
    description: text(),
    createdAt: createdAt(),
  },
  (t) => [index("lists_project_idx").on(t.projectId)],
);

export const listMembers = sqliteTable(
  "list_members",
  {
    id: id(),
    listId: text()
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    contactId: text()
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("list_members_unique_idx").on(t.listId, t.contactId),
    index("list_members_contact_idx").on(t.contactId),
  ],
);

/** Bounces, complaints and unsubscribes. Never mailed again. */
export const suppressions = sqliteTable(
  "suppressions",
  {
    id: id(),
    projectId: text()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    email: text().notNull(),
    reason: text({
      enum: ["bounce", "complaint", "unsubscribe", "manual"],
    }).notNull(),
    detail: text(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("suppressions_project_email_idx").on(t.projectId, t.email),
  ],
);

/* ------------------------------------------------------------- campaigns */

export const campaigns = sqliteTable(
  "campaigns",
  {
    id: id(),
    projectId: text()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text().notNull(),
    subject: text().notNull().default(""),
    previewText: text(),
    fromName: text(),
    fromEmail: text(),
    html: text().notNull().default(""),
    /** Optional hand written plain text part; generated from html when empty. */
    text: text(),
    /** null = every subscribed contact */
    listId: text().references(() => lists.id, { onDelete: "set null" }),
    status: text({
      enum: ["draft", "scheduled", "sending", "sent", "failed"],
    })
      .notNull()
      .default("draft"),
    scheduledAt: integer({ mode: "timestamp_ms" }),
    startedAt: integer({ mode: "timestamp_ms" }),
    sentAt: integer({ mode: "timestamp_ms" }),
    recipientCount: integer().notNull().default(0),
    /** True once every recipient has an `emails` row, so the sender knows
     * an empty queue really means the campaign finished. */
    materialized: integer({ mode: "boolean" }).notNull().default(false),
    error: text(),
    createdAt: createdAt(),
  },
  (t) => [
    index("campaigns_project_idx").on(t.projectId),
    index("campaigns_status_idx").on(t.status),
  ],
);

/** Transactional templates triggered over the API by event name. */
export const transactionals = sqliteTable(
  "transactionals",
  {
    id: id(),
    projectId: text()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text().notNull(),
    /** e.g. "user.signup" — the `event` field of POST /v1/events */
    event: text().notNull(),
    subject: text().notNull().default(""),
    html: text().notNull().default(""),
    text: text(),
    enabled: integer({ mode: "boolean" }).notNull().default(true),
    /** Transactional mail ignores unsubscribes (receipts, password resets). */
    ignoreUnsubscribes: integer({ mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("transactionals_project_event_idx").on(t.projectId, t.event),
  ],
);

/* ---------------------------------------------------------------- emails */

export const emails = sqliteTable(
  "emails",
  {
    id: id(),
    projectId: text()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    campaignId: text().references(() => campaigns.id, { onDelete: "cascade" }),
    transactionalId: text().references(() => transactionals.id, {
      onDelete: "set null",
    }),
    contactId: text().references(() => contacts.id, { onDelete: "set null" }),
    to: text().notNull(),
    subject: text().notNull(),
    kind: text({ enum: ["campaign", "transactional", "test", "system"] })
      .notNull()
      .default("campaign"),
    status: text({
      enum: [
        "queued",
        "sent",
        "delivered",
        "bounced",
        "complained",
        "failed",
        "skipped",
      ],
    })
      .notNull()
      .default("queued"),
    providerMessageId: text(),
    error: text(),
    /** Rendered payload, kept so the queue consumer can retry. */
    html: text(),
    bodyText: text(),
    openCount: integer().notNull().default(0),
    clickCount: integer().notNull().default(0),
    sentAt: integer({ mode: "timestamp_ms" }),
    deliveredAt: integer({ mode: "timestamp_ms" }),
    firstOpenedAt: integer({ mode: "timestamp_ms" }),
    firstClickedAt: integer({ mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("emails_project_created_idx").on(t.projectId, t.createdAt),
    index("emails_campaign_idx").on(t.campaignId),
    index("emails_contact_idx").on(t.contactId),
    index("emails_message_idx").on(t.providerMessageId),
  ],
);

export const emailEvents = sqliteTable(
  "email_events",
  {
    id: id(),
    emailId: text()
      .notNull()
      .references(() => emails.id, { onDelete: "cascade" }),
    projectId: text()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: text({
      enum: [
        "send",
        "delivery",
        "bounce",
        "complaint",
        "open",
        "click",
        "reject",
        "unsubscribe",
        "failure",
      ],
    }).notNull(),
    detail: text(),
    url: text(),
    createdAt: createdAt(),
  },
  (t) => [
    index("email_events_email_idx").on(t.emailId),
    index("email_events_project_type_idx").on(t.projectId, t.type),
  ],
);

/* ------------------------------------------------------------- relations */

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  contacts: many(contacts),
  campaigns: many(campaigns),
  lists: many(lists),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  project: one(projects, {
    fields: [campaigns.projectId],
    references: [projects.id],
  }),
  list: one(lists, { fields: [campaigns.listId], references: [lists.id] }),
  emails: many(emails),
}));

export const emailsRelations = relations(emails, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [emails.campaignId],
    references: [campaigns.id],
  }),
  contact: one(contacts, {
    fields: [emails.contactId],
    references: [contacts.id],
  }),
  events: many(emailEvents),
}));

export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type List = typeof lists.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type Transactional = typeof transactionals.$inferSelect;
export type Email = typeof emails.$inferSelect;
export type EmailEvent = typeof emailEvents.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Suppression = typeof suppressions.$inferSelect;
