import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { campaigns, emails, lists } from "@mails/db/schema";
import {
  campaignStats,
  campaignWarnings,
  countRecipients,
  rate,
  validateCampaign,
} from "@mails/core";
import {
  deleteCampaignAction,
  duplicateCampaignAction,
  saveCampaignAction,
  sendCampaignAction,
  sendTestAction,
  unscheduleCampaignAction,
} from "@/app/actions/campaigns";
import { FunnelBars, SERIES_COLORS } from "@/components/chart";
import { ActionForm, SubmitButton } from "@/components/client";
import { HtmlEditor } from "@/components/editor";
import {
  Callout,
  Card,
  CardHeader,
  Field,
  Input,
  Select,
  StatTile,
  StatusBadge,
  Table,
  Td,
  Textarea,
  Th,
} from "@/components/ui";
import { getDb } from "@/lib/cloudflare";
import { formatDate, formatNumber, requireProject } from "@/lib/projects";

export const instant = false;

export default async function CampaignPage({
  params,
}: PageProps<"/p/[slug]/campaigns/[id]">) {
  const { slug, id } = await params;
  const { project } = await requireProject(slug);
  const db = await getDb();

  const campaign = await db.query.campaigns.findFirst({
    where: and(eq(campaigns.id, id), eq(campaigns.projectId, project.id)),
  });
  if (!campaign) notFound();

  const [projectLists, recipients, stats, recentEmails] = await Promise.all([
    db.query.lists.findMany({ where: eq(lists.projectId, project.id) }),
    countRecipients(db, project.id, campaign.listId),
    campaignStats(db, campaign.id),
    db.query.emails.findMany({
      where: eq(emails.campaignId, campaign.id),
      orderBy: desc(emails.createdAt),
      limit: 10,
    }),
  ]);

  const problems = validateCampaign(campaign, project);
  const warnings = campaignWarnings(campaign, project);
  const editable = campaign.status === "draft" || campaign.status === "scheduled";
  const started = campaign.status !== "draft" && campaign.status !== "scheduled";

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-semibold tracking-[-0.02em]">
              {campaign.name}
            </h1>
            <StatusBadge status={campaign.status} />
          </div>
          <p className="mt-1 text-[13px] text-ink-soft">
            {campaign.listId
              ? projectLists.find((list) => list.id === campaign.listId)?.name ??
                "Deleted list"
              : "Everyone subscribed"}{" "}
            · {formatNumber(recipients)} recipient(s) right now
          </p>
        </div>
        <div className="flex gap-2">
          <form action={duplicateCampaignAction}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={campaign.id} />
            <SubmitButton variant="secondary">Duplicate</SubmitButton>
          </form>
          <form action={deleteCampaignAction}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={campaign.id} />
            <SubmitButton variant="danger" confirm={`Delete “${campaign.name}”?`}>
              Delete
            </SubmitButton>
          </form>
        </div>
      </header>

      {started ? (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile
            label="Sent"
            value={formatNumber(stats.sent)}
            sub={`${formatNumber(stats.queued)} queued`}
            swatch={SERIES_COLORS.sent}
          />
          <StatTile
            label="Delivered"
            value={`${rate(stats.delivered, stats.sent)}%`}
            sub={formatNumber(stats.delivered)}
          />
          <StatTile
            label="Opened"
            value={`${rate(stats.opened, stats.sent)}%`}
            sub={formatNumber(stats.opened)}
            swatch={SERIES_COLORS.opened}
          />
          <StatTile
            label="Clicked"
            value={`${rate(stats.clicked, stats.sent)}%`}
            sub={formatNumber(stats.clicked)}
            swatch={SERIES_COLORS.clicked}
          />
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader
            title="Content"
            description={
              editable
                ? "Merge tags are filled in per contact when the email is sent."
                : "Sent campaigns are read-only."
            }
          />
          <ActionForm action={saveCampaignAction} className="space-y-4 p-5">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={campaign.id} />

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Campaign name">
                <Input name="name" defaultValue={campaign.name} disabled={!editable} />
              </Field>
              <Field label="Audience">
                <Select
                  name="listId"
                  defaultValue={campaign.listId ?? ""}
                  disabled={!editable}
                >
                  <option value="">Everyone subscribed</option>
                  {projectLists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Subject line">
              <Input
                name="subject"
                defaultValue={campaign.subject}
                placeholder="What shipped in March"
                disabled={!editable}
              />
            </Field>
            <Field
              label="Preview text"
              hint="The grey line inboxes show next to the subject."
            >
              <Input
                name="previewText"
                defaultValue={campaign.previewText ?? ""}
                disabled={!editable}
              />
            </Field>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="From name" hint={`Defaults to “${project.fromName || project.name}”`}>
                <Input
                  name="fromName"
                  defaultValue={campaign.fromName ?? ""}
                  disabled={!editable}
                />
              </Field>
              <Field label="From email" hint={`Defaults to ${project.fromEmail || "unset"}`}>
                <Input
                  name="fromEmail"
                  type="email"
                  defaultValue={campaign.fromEmail ?? ""}
                  disabled={!editable}
                />
              </Field>
            </div>

            <div>
              <span className="mb-1.5 block text-[12.5px] font-medium text-ink-soft">
                HTML body
              </span>
              <HtmlEditor name="html" defaultValue={campaign.html} />
            </div>

            <Field
              label="Plain text version"
              hint="Optional. Generated from the HTML when left empty — always sent alongside it."
            >
              <Textarea
                name="text"
                rows={4}
                className="code"
                defaultValue={campaign.text ?? ""}
                disabled={!editable}
              />
            </Field>

            {editable ? <SubmitButton>Save changes</SubmitButton> : null}
          </ActionForm>
        </Card>

        <div className="space-y-5">
          {problems.length ? (
            <Callout tone="danger" title="Not ready to send">
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </Callout>
          ) : null}
          {warnings.length ? (
            <Callout tone="warning" title="Deliverability checks">
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </Callout>
          ) : null}

          <Card>
            <CardHeader title="Send a test" />
            <ActionForm action={sendTestAction} className="space-y-3 p-5">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="id" value={campaign.id} />
              <Field label="Test recipient">
                <Input name="to" type="email" placeholder="you@example.com" />
              </Field>
              <SubmitButton variant="secondary">Send test</SubmitButton>
            </ActionForm>
          </Card>

          {editable ? (
            <Card>
              <CardHeader
                title="Send"
                description={`${formatNumber(recipients)} subscribed contact(s) will receive this.`}
              />
              <ActionForm action={sendCampaignAction} className="space-y-3 p-5">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="id" value={campaign.id} />
                <Field
                  label="Schedule for later"
                  hint="Leave empty to start sending immediately."
                >
                  <Input
                    name="scheduledAt"
                    type="datetime-local"
                    defaultValue={
                      campaign.scheduledAt
                        ? toLocalInput(campaign.scheduledAt)
                        : ""
                    }
                  />
                </Field>
                <SubmitButton
                  variant="accent"
                  className="w-full"
                  confirm={`Send “${campaign.name}” to ${recipients} contact(s)?`}
                >
                  Send campaign
                </SubmitButton>
              </ActionForm>
              {campaign.status === "scheduled" ? (
                <form action={unscheduleCampaignAction} className="px-5 pb-5">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={campaign.id} />
                  <p className="mb-2 text-[12.5px] text-ink-muted">
                    Scheduled for {formatDate(campaign.scheduledAt)}.
                  </p>
                  <SubmitButton variant="secondary" size="sm">
                    Cancel schedule
                  </SubmitButton>
                </form>
              ) : null}
            </Card>
          ) : (
            <Card className="p-5">
              <FunnelBars
                rows={[
                  {
                    label: "Delivered",
                    value: stats.delivered,
                    total: stats.sent,
                    color: SERIES_COLORS.sent,
                  },
                  {
                    label: "Opened",
                    value: stats.opened,
                    total: stats.sent,
                    color: SERIES_COLORS.opened,
                  },
                  {
                    label: "Clicked",
                    value: stats.clicked,
                    total: stats.sent,
                    color: SERIES_COLORS.clicked,
                  },
                ]}
              />
              <p className="mt-4 text-[12px] text-ink-muted">
                {formatNumber(stats.bounced)} bounced ·{" "}
                {formatNumber(stats.complained)} complained ·{" "}
                {formatNumber(stats.failed)} failed
              </p>
            </Card>
          )}

          {recentEmails.length ? (
            <Card>
              <CardHeader
                title="Recent recipients"
                action={
                  <Link
                    href={`/p/${slug}/logs?campaign=${campaign.id}`}
                    className="text-[12.5px] text-accent hover:underline"
                  >
                    View all
                  </Link>
                }
              />
              <Table>
                <thead>
                  <tr>
                    <Th>To</Th>
                    <Th className="text-right">Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {recentEmails.map((email) => (
                    <tr key={email.id}>
                      <Td className="truncate-id">{email.to}</Td>
                      <Td className="text-right">
                        <StatusBadge status={email.status} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

/** `datetime-local` wants `YYYY-MM-DDTHH:mm` in local time. */
function toLocalInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
