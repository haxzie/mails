import { and, eq, sql } from "drizzle-orm";
import {
  campaigns,
  contacts,
  emailEvents,
  emails,
  suppressions,
  transactionals,
  type Contact,
  type Project,
} from "@mails/db/schema";
import { createDb, createId, type Database } from "@mails/db";
import { decryptSecret } from "./crypto";
import type { AppEnv } from "./env";
import { clickUrl, openUrl, unsubscribeUrl } from "./links";
import {
  appendOpenPixel,
  buildHtmlDocument,
  formatAddress,
  htmlToText,
  renderTemplate,
  rewriteLinksForClickTracking,
  type MergeData,
} from "./render";
import { SesError, sendViaSes, type SesCredentials } from "./ses";

export function db(env: AppEnv): Database {
  return createDb(env.DB);
}

export async function projectSesCredentials(
  env: AppEnv,
  project: Project,
): Promise<SesCredentials> {
  if (!project.sesAccessKeyId || !project.sesSecretKey) {
    throw new Error(
      "This project has no Amazon SES credentials yet. Add them in Settings.",
    );
  }
  return {
    region: project.sesRegion,
    accessKeyId: project.sesAccessKeyId,
    secretAccessKey: await decryptSecret(
      project.sesSecretKey,
      env.ENCRYPTION_KEY,
    ),
    configurationSet: project.sesConfigurationSet,
  };
}

export function systemSesCredentials(env: AppEnv): SesCredentials | null {
  if (
    !env.SYSTEM_SES_ACCESS_KEY_ID ||
    !env.SYSTEM_SES_SECRET_ACCESS_KEY ||
    !env.SYSTEM_FROM_EMAIL
  ) {
    return null;
  }
  return {
    region: env.SYSTEM_SES_REGION ?? "us-east-1",
    accessKeyId: env.SYSTEM_SES_ACCESS_KEY_ID,
    secretAccessKey: env.SYSTEM_SES_SECRET_ACCESS_KEY,
  };
}

/**
 * Platform mail (login links). Falls back to logging the message when no
 * system SES identity is configured, which is what local dev uses.
 */
export async function sendSystemEmail(
  env: AppEnv,
  message: { to: string; subject: string; html: string; text?: string },
): Promise<void> {
  const credentials = systemSesCredentials(env);
  if (!credentials) {
    console.log(
      `[mails] no SYSTEM_SES_* configured, email not sent:\n` +
        `to: ${message.to}\nsubject: ${message.subject}\n${
          message.text ?? htmlToText(message.html)
        }`,
    );
    return;
  }
  await sendViaSes(credentials, {
    from: formatAddress(env.SYSTEM_FROM_NAME ?? "Mails", env.SYSTEM_FROM_EMAIL!),
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text ?? htmlToText(message.html),
    headers: { "X-Entity-Ref-ID": createId("sys") },
  });
}

export interface QueuedEmailInput {
  projectId: string;
  to: string;
  subject: string;
  kind: "campaign" | "transactional" | "test" | "system";
  campaignId?: string | null;
  transactionalId?: string | null;
  contactId?: string | null;
  /** Inline body, for API sends that have no stored template. */
  html?: string | null;
  text?: string | null;
}

/** Inserts the email row and hands it to the send queue. */
export async function queueEmail(
  env: AppEnv,
  input: QueuedEmailInput,
): Promise<string> {
  const id = createId("eml");
  await db(env).insert(emails).values({ id, status: "queued", ...input });
  await env.SEND_QUEUE.send({ type: "email.send", emailId: id });
  return id;
}

export function mergeDataFor(
  contact: Pick<Contact, "email" | "firstName" | "lastName" | "properties"> | null,
  project: Project,
  extra: MergeData = {},
): MergeData {
  const name = [contact?.firstName, contact?.lastName].filter(Boolean).join(" ");
  return {
    ...(contact?.properties ?? {}),
    email: contact?.email ?? "",
    firstName: contact?.firstName ?? "",
    lastName: contact?.lastName ?? "",
    name,
    properties: contact?.properties ?? {},
    project: { name: project.name },
    ...extra,
  };
}

async function isSuppressed(
  database: Database,
  projectId: string,
  email: string,
): Promise<boolean> {
  const row = await database.query.suppressions.findFirst({
    where: and(
      eq(suppressions.projectId, projectId),
      eq(suppressions.email, email.toLowerCase()),
    ),
  });
  return Boolean(row);
}

export class NonRetryableSendError extends Error {}

/**
 * Renders and sends one queued email. Throws when the failure is worth a
 * queue retry; marks the row `failed` and returns otherwise.
 */
export async function deliverEmail(env: AppEnv, emailId: string): Promise<void> {
  const database = db(env);
  const row = await database.query.emails.findFirst({
    where: eq(emails.id, emailId),
  });
  if (!row) throw new NonRetryableSendError(`Unknown email ${emailId}`);
  // Already handled: either a duplicate queue delivery or a retry after SES
  // accepted the message.
  if (row.status !== "queued" || row.providerMessageId) return;

  const project = await database.query.projects.findFirst({
    where: (table, { eq: equals }) => equals(table.id, row.projectId),
  });
  if (!project) throw new NonRetryableSendError("Project was deleted");

  const fail = async (error: string) => {
    await database
      .update(emails)
      .set({ status: "failed", error })
      .where(eq(emails.id, row.id));
    await recordEvent(database, row.id, row.projectId, "failure", error);
  };

  const skip = async (reason: string) => {
    await database
      .update(emails)
      .set({ status: "skipped", error: reason })
      .where(eq(emails.id, row.id));
  };

  const contact = row.contactId
    ? ((await database.query.contacts.findFirst({
        where: eq(contacts.id, row.contactId),
      })) ?? null)
    : null;

  const template = await resolveTemplate(database, row);
  if (!template) {
    await fail("The campaign or template this email belongs to is gone");
    return;
  }

  // Consent: transactional mail can opt out of this, nothing else can.
  if (row.kind !== "test" && !template.ignoreUnsubscribes) {
    if (contact && !contact.subscribed) {
      await skip("Contact is unsubscribed");
      return;
    }
    if (await isSuppressed(database, row.projectId, row.to)) {
      await skip("Address is on the suppression list");
      return;
    }
  }

  const fromEmail = template.fromEmail || project.fromEmail;
  if (!fromEmail) {
    await fail("No From address is configured for this project");
    return;
  }

  let credentials: SesCredentials;
  try {
    credentials = await projectSesCredentials(env, project);
  } catch (error) {
    await fail(error instanceof Error ? error.message : String(error));
    return;
  }

  const unsubscribe =
    contact && !template.ignoreUnsubscribes
      ? await unsubscribeUrl(env.API_URL, env.AUTH_SECRET, project.id, contact.id)
      : null;

  const data = mergeDataFor(contact, project, {
    unsubscribe_url: unsubscribe ?? "",
  });

  const subject = renderTemplate(template.subject, data, { escape: false });
  let html = buildHtmlDocument({
    body: renderTemplate(template.html, data),
    previewText: template.previewText,
    unsubscribeUrl: unsubscribe,
    footerAddress: project.postalAddress,
    projectName: project.name,
  });

  const text = template.text
    ? renderTemplate(template.text, data, { escape: false })
    : htmlToText(html);

  if (project.trackClicks) {
    const rewritten: Array<[string, string]> = [];
    for (const match of html.matchAll(
      /<a\b[^>]*\bhref=["'](https?:\/\/[^"']+)["']/gi,
    )) {
      const target = match[1]!;
      if (/\/u\//.test(target)) continue;
      rewritten.push([
        target,
        await clickUrl(env.API_URL, env.AUTH_SECRET, row.id, target),
      ]);
    }
    const map = new Map(rewritten);
    html = rewriteLinksForClickTracking(html, (target) => map.get(target) ?? target);
  }
  if (project.trackOpens) {
    html = appendOpenPixel(
      html,
      await openUrl(env.API_URL, env.AUTH_SECRET, row.id),
    );
  }

  const headers: Record<string, string> = {
    // Gmail and Yahoo require one-click unsubscribe for bulk senders.
    "X-Entity-Ref-ID": row.id,
  };
  if (unsubscribe) {
    const mailto = project.sendingDomain
      ? `, <mailto:unsubscribe@${project.sendingDomain}?subject=unsubscribe>`
      : "";
    headers["List-Unsubscribe"] = `<${unsubscribe}>${mailto}`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  if (row.kind === "campaign") {
    headers["Precedence"] = "bulk";
    if (project.sendingDomain) {
      headers["List-Id"] = `${project.name} <${project.slug}.${project.sendingDomain}>`;
    }
  }

  try {
    const messageId = await sendViaSes(credentials, {
      from: formatAddress(template.fromName || project.fromName, fromEmail),
      to: row.to,
      subject,
      html,
      text,
      replyTo: project.replyTo,
      headers,
      tags: {
        project: project.slug,
        kind: row.kind,
        ...(row.campaignId ? { campaign: row.campaignId } : {}),
      },
    });
    await database
      .update(emails)
      .set({
        status: "sent",
        providerMessageId: messageId,
        sentAt: new Date(),
        subject,
        error: null,
      })
      .where(eq(emails.id, row.id));
    await recordEvent(database, row.id, row.projectId, "send");
  } catch (error) {
    if (error instanceof SesError && !error.retryable) {
      await fail(`SES rejected the message: ${error.message}`);
      return;
    }
    // Throttling or a 5xx — let the queue retry with backoff.
    throw error;
  }
}

interface ResolvedTemplate {
  subject: string;
  html: string;
  text: string | null;
  previewText: string | null;
  fromName: string | null;
  fromEmail: string | null;
  ignoreUnsubscribes: boolean;
}

async function resolveTemplate(
  database: Database,
  row: typeof emails.$inferSelect,
): Promise<ResolvedTemplate | null> {
  // An inline body (API send) wins over the stored template.
  if (row.html) {
    return {
      subject: row.subject,
      html: row.html,
      text: row.bodyText,
      previewText: null,
      fromName: null,
      fromEmail: null,
      ignoreUnsubscribes: row.kind === "transactional",
    };
  }
  if (row.campaignId) {
    const campaign = await database.query.campaigns.findFirst({
      where: eq(campaigns.id, row.campaignId),
    });
    if (!campaign) return null;
    return {
      subject: campaign.subject,
      html: campaign.html,
      text: campaign.text,
      previewText: campaign.previewText,
      fromName: campaign.fromName,
      fromEmail: campaign.fromEmail,
      ignoreUnsubscribes: false,
    };
  }
  if (row.transactionalId) {
    const template = await database.query.transactionals.findFirst({
      where: eq(transactionals.id, row.transactionalId),
    });
    if (!template) return null;
    return {
      subject: template.subject,
      html: template.html,
      text: template.text,
      previewText: null,
      fromName: null,
      fromEmail: null,
      ignoreUnsubscribes: template.ignoreUnsubscribes,
    };
  }
  return null;
}

export async function recordEvent(
  database: Database,
  emailId: string,
  projectId: string,
  type: (typeof emailEvents.$inferInsert)["type"],
  detail?: string,
  url?: string,
): Promise<void> {
  await database.insert(emailEvents).values({
    id: createId("evt"),
    emailId,
    projectId,
    type,
    detail,
    url,
  });
}

/** Marks a campaign sent once every one of its emails has left the queue. */
export async function bumpCampaignStats(
  database: Database,
  campaignId: string,
): Promise<void> {
  const campaign = await database.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
  });
  // Recipients may still be being written, so an empty queue is not enough.
  if (!campaign || campaign.status !== "sending" || !campaign.materialized) {
    return;
  }
  const [row] = await database
    .select({ remaining: sql<number>`count(*)`.as("remaining") })
    .from(emails)
    .where(and(eq(emails.campaignId, campaignId), eq(emails.status, "queued")));
  if ((row?.remaining ?? 0) === 0) {
    await database
      .update(campaigns)
      .set({ status: "sent", sentAt: new Date() })
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.status, "sending")));
  }
}
