"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { campaigns } from "@mails/db/schema";
import { createId } from "@mails/db";
import {
  countRecipients,
  isValidEmail,
  sendCampaignTest,
  startCampaign,
  validateCampaign,
} from "@mails/core";
import type { ActionState } from "@/components/client";
import { getDb, getEnv } from "@/lib/cloudflare";
import { requireProject } from "@/lib/projects";

const STARTER_HTML = `<h1 style="font-size:20px;margin:0 0 16px">Hello {{firstName | there}},</h1>
<p>Write your update here.</p>
<p>— The team</p>`;

export async function createCampaignAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get("slug") ?? "");
  const { project } = await requireProject(slug);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the campaign a name" };

  const db = await getDb();
  const id = createId("cmp");
  await db.insert(campaigns).values({
    id,
    projectId: project.id,
    name,
    subject: String(formData.get("subject") ?? "").trim(),
    html: STARTER_HTML,
  });
  redirect(`/p/${slug}/campaigns/${id}`);
}

async function loadCampaign(slug: string, campaignId: string) {
  const { project } = await requireProject(slug);
  const db = await getDb();
  const campaign = await db.query.campaigns.findFirst({
    where: and(
      eq(campaigns.id, campaignId),
      eq(campaigns.projectId, project.id),
    ),
  });
  return { db, project, campaign };
}

export async function saveCampaignAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get("slug") ?? "");
  const id = String(formData.get("id") ?? "");
  const { db, campaign } = await loadCampaign(slug, id);
  if (!campaign) return { error: "Campaign not found" };
  if (campaign.status === "sending" || campaign.status === "sent") {
    return { error: "A campaign that has started sending can no longer be edited" };
  }

  const listId = String(formData.get("listId") ?? "");
  await db
    .update(campaigns)
    .set({
      name: String(formData.get("name") ?? campaign.name).trim(),
      subject: String(formData.get("subject") ?? "").trim(),
      previewText: String(formData.get("previewText") ?? "").trim() || null,
      fromName: String(formData.get("fromName") ?? "").trim() || null,
      fromEmail: String(formData.get("fromEmail") ?? "").trim() || null,
      html: String(formData.get("html") ?? ""),
      text: String(formData.get("text") ?? "").trim() || null,
      listId: listId || null,
    })
    .where(eq(campaigns.id, campaign.id));

  revalidatePath(`/p/${slug}/campaigns/${id}`);
  return { success: "Saved" };
}

export async function sendTestAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get("slug") ?? "");
  const id = String(formData.get("id") ?? "");
  const to = String(formData.get("to") ?? "").trim();
  if (!isValidEmail(to)) return { error: "Enter a valid address" };

  const { campaign, project } = await loadCampaign(slug, id);
  if (!campaign) return { error: "Campaign not found" };
  const problems = validateCampaign(campaign, project);
  if (problems.length) return { error: problems[0] };

  await sendCampaignTest(await getEnv(), campaign.id, to);
  return { success: `Test queued for ${to}` };
}

export async function sendCampaignAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get("slug") ?? "");
  const id = String(formData.get("id") ?? "");
  const { db, campaign, project } = await loadCampaign(slug, id);
  if (!campaign) return { error: "Campaign not found" };
  if (campaign.status !== "draft" && campaign.status !== "scheduled") {
    return { error: `This campaign is already ${campaign.status}` };
  }

  const problems = validateCampaign(campaign, project);
  if (problems.length) return { error: problems.join(". ") };

  const recipients = await countRecipients(db, project.id, campaign.listId);
  if (recipients === 0) {
    return { error: "No subscribed contacts match this audience" };
  }

  const scheduleAt = String(formData.get("scheduledAt") ?? "").trim();
  if (scheduleAt) {
    const when = new Date(scheduleAt);
    if (Number.isNaN(when.getTime())) return { error: "That date is not valid" };
    if (when.getTime() < Date.now() - 60_000) {
      return { error: "Pick a time in the future" };
    }
    await db
      .update(campaigns)
      .set({ status: "scheduled", scheduledAt: when, error: null })
      .where(eq(campaigns.id, campaign.id));
    revalidatePath(`/p/${slug}/campaigns/${id}`);
    return {
      success: `Scheduled for ${when.toLocaleString()} — ${recipients} recipient(s)`,
    };
  }

  await startCampaign(await getEnv(), campaign.id);
  revalidatePath(`/p/${slug}/campaigns/${id}`);
  return { success: `Sending to ${recipients} recipient(s)` };
}

export async function unscheduleCampaignAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const id = String(formData.get("id") ?? "");
  const { db, campaign } = await loadCampaign(slug, id);
  if (!campaign || campaign.status !== "scheduled") return;
  await db
    .update(campaigns)
    .set({ status: "draft", scheduledAt: null })
    .where(eq(campaigns.id, campaign.id));
  revalidatePath(`/p/${slug}/campaigns/${id}`);
}

export async function duplicateCampaignAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const id = String(formData.get("id") ?? "");
  const { db, campaign, project } = await loadCampaign(slug, id);
  if (!campaign) return;
  const newId = createId("cmp");
  await db.insert(campaigns).values({
    id: newId,
    projectId: project.id,
    name: `${campaign.name} (copy)`,
    subject: campaign.subject,
    previewText: campaign.previewText,
    fromName: campaign.fromName,
    fromEmail: campaign.fromEmail,
    html: campaign.html,
    text: campaign.text,
    listId: campaign.listId,
  });
  redirect(`/p/${slug}/campaigns/${newId}`);
}

export async function deleteCampaignAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const id = String(formData.get("id") ?? "");
  const { db, campaign } = await loadCampaign(slug, id);
  if (!campaign) return;
  await db.delete(campaigns).where(eq(campaigns.id, campaign.id));
  redirect(`/p/${slug}/campaigns`);
}
