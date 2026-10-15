import { and, asc, eq, gt, lte, sql } from "drizzle-orm";
import {
  campaigns,
  contacts,
  emails,
  listMembers,
  suppressions,
  type Campaign,
  type Project,
} from "@mails/db/schema";
import { createId, type Database } from "@mails/db";
import type { AppEnv } from "./env";
import { db, queueEmail } from "./send";

const BATCH = 200;

/** Blocking problems that stop a campaign from being sent. */
export function validateCampaign(
  campaign: Campaign,
  project: Project,
): string[] {
  const problems: string[] = [];
  if (!campaign.subject.trim()) problems.push("The subject line is empty");
  if (!campaign.html.trim()) problems.push("The email body is empty");
  if (!(campaign.fromEmail || project.fromEmail)) {
    problems.push("No From address — set one in project settings");
  }
  if (!project.sesAccessKeyId || !project.sesSecretKey) {
    problems.push("Amazon SES credentials are missing in project settings");
  }
  return problems;
}

/** Non-blocking deliverability warnings. */
export function campaignWarnings(
  campaign: Campaign,
  project: Project,
): string[] {
  const warnings: string[] = [];
  if (!project.postalAddress) {
    warnings.push(
      "No postal address set — CAN-SPAM requires a physical mailing address in bulk email",
    );
  }
  if (!project.sendingDomain) {
    warnings.push(
      "No sending domain set, so DKIM and SPF alignment cannot be checked",
    );
  }
  if (!project.sesConfigurationSet) {
    warnings.push(
      "No SES configuration set, so bounces and complaints will not be tracked",
    );
  }
  if (!campaign.previewText) {
    warnings.push("No preview text — inboxes will show the first body line");
  }
  return warnings;
}

/**
 * Who a campaign goes to.
 *
 * `cutoff` freezes the audience at the moment the campaign started: a
 * campaign materializes its recipients in pages, and without this a contact
 * created while that loop is running — an import, say — gets swept into a
 * send it was never part of.
 */
export function recipientFilter({
  projectId,
  listId,
  cutoff,
  after,
}: {
  projectId: string;
  listId?: string | null;
  cutoff?: Date | null;
  after?: string | null;
}) {
  return and(
    eq(contacts.projectId, projectId),
    eq(contacts.subscribed, true),
    cutoff ? lte(contacts.createdAt, cutoff) : undefined,
    after ? gt(contacts.id, after) : undefined,
    sql`not exists (select 1 from ${suppressions} where ${suppressions.projectId} = ${projectId} and ${suppressions.email} = ${contacts.email})`,
    listId
      ? sql`exists (select 1 from ${listMembers} where ${listMembers.contactId} = ${contacts.id} and ${listMembers.listId} = ${listId})`
      : undefined,
  );
}

/** The live size of an audience, for the editor's "N recipients" line. */
export async function countRecipients(
  database: Database,
  projectId: string,
  listId: string | null,
): Promise<number> {
  const [row] = await database
    .select({ count: sql<number>`count(*)` })
    .from(contacts)
    .where(recipientFilter({ projectId, listId }));
  return row?.count ?? 0;
}

/** Moves a campaign into `sending` and kicks off recipient materialization. */
export async function startCampaign(
  env: AppEnv,
  campaignId: string,
): Promise<void> {
  const database = db(env);
  const campaign = await database.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
  });
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status === "sending" || campaign.status === "sent") return;

  await database
    .update(campaigns)
    .set({
      status: "sending",
      startedAt: new Date(),
      materialized: false,
      recipientCount: 0,
      error: null,
    })
    .where(eq(campaigns.id, campaignId));

  await env.SEND_QUEUE.send({ type: "campaign.start", campaignId });
}

/**
 * Creates `emails` rows for one page of recipients and queues them.
 * Returns the cursor for the next page, or null when done.
 */
export async function materializeRecipients(
  env: AppEnv,
  campaignId: string,
  cursor?: string,
): Promise<string | null> {
  const database = db(env);
  const campaign = await database.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
  });
  // A deleted or stopped campaign must not keep paging through contacts.
  if (!campaign || campaign.status !== "sending") return null;

  const rows = await database
    .select({ id: contacts.id, email: contacts.email })
    .from(contacts)
    .where(
      recipientFilter({
        projectId: campaign.projectId,
        listId: campaign.listId,
        cutoff: campaign.startedAt ?? new Date(),
        after: cursor,
      }),
    )
    .orderBy(asc(contacts.id))
    .limit(BATCH);

  if (rows.length === 0) {
    await database
      .update(campaigns)
      .set({ materialized: true })
      .where(eq(campaigns.id, campaignId));
    return null;
  }

  const values = rows.map((row) => ({
    id: createId("eml"),
    projectId: campaign.projectId,
    campaignId: campaign.id,
    contactId: row.id,
    to: row.email,
    subject: campaign.subject,
    kind: "campaign" as const,
    status: "queued" as const,
  }));

  // D1 allows at most 100 bound parameters per statement, so insert in
  // small chunks inside one batch round trip.
  const chunks: (typeof values)[] = [];
  for (let i = 0; i < values.length; i += 10) chunks.push(values.slice(i, i + 10));
  const statements = chunks.map((chunk) =>
    database.insert(emails).values(chunk).onConflictDoNothing(),
  );
  if (statements.length > 0) {
    await database.batch(
      statements as [(typeof statements)[number], ...typeof statements],
    );
  }

  for (let i = 0; i < values.length; i += 100) {
    await env.SEND_QUEUE.sendBatch(
      values.slice(i, i + 100).map((value) => ({
        body: { type: "email.send" as const, emailId: value.id },
      })),
    );
  }

  await database
    .update(campaigns)
    .set({ recipientCount: campaign.recipientCount + values.length })
    .where(eq(campaigns.id, campaignId));

  const next = rows[rows.length - 1]!.id;
  if (rows.length < BATCH) {
    await database
      .update(campaigns)
      .set({ materialized: true })
      .where(eq(campaigns.id, campaignId));
    return null;
  }
  return next;
}

/** Sends the campaign to a single address, bypassing consent checks. */
export async function sendCampaignTest(
  env: AppEnv,
  campaignId: string,
  to: string,
): Promise<string> {
  const database = db(env);
  const campaign = await database.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
  });
  if (!campaign) throw new Error("Campaign not found");
  return queueEmail(env, {
    projectId: campaign.projectId,
    campaignId: campaign.id,
    to,
    subject: `[test] ${campaign.subject}`,
    kind: "test",
  });
}
