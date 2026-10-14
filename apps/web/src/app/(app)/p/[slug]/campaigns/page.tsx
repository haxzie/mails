import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { campaigns } from "@mails/db/schema";
import { createCampaignAction } from "@/app/actions/campaigns";
import { ActionForm, SubmitButton } from "@/components/client";
import {
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  StatusBadge,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { getDb } from "@/lib/cloudflare";
import { formatDate, formatNumber, requireProject } from "@/lib/projects";

export const instant = false;

export default async function CampaignsPage({
  params,
}: PageProps<"/p/[slug]/campaigns">) {
  const { slug } = await params;
  const { project } = await requireProject(slug);
  const db = await getDb();
  const rows = await db.query.campaigns.findMany({
    where: eq(campaigns.projectId, project.id),
    orderBy: desc(campaigns.createdAt),
  });

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="One-off broadcasts to a list or to everyone who is subscribed."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader title="All campaigns" />
          {rows.length === 0 ? (
            <EmptyState
              title="No campaigns yet"
              description="Create one on the right, write the email, send a test, then ship it."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Campaign</Th>
                  <Th>Status</Th>
                  <Th>Recipients</Th>
                  <Th className="text-right">Updated</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((campaign) => (
                  <tr key={campaign.id}>
                    <Td>
                      <Link
                        href={`/p/${slug}/campaigns/${campaign.id}`}
                        className="font-medium hover:underline"
                      >
                        {campaign.name}
                      </Link>
                      <p className="text-[12px] text-ink-muted">
                        {campaign.subject || "No subject yet"}
                      </p>
                    </Td>
                    <Td>
                      <StatusBadge status={campaign.status} />
                    </Td>
                    <Td className="tabular-nums">
                      {formatNumber(campaign.recipientCount)}
                    </Td>
                    <Td className="text-right text-[12px] text-ink-muted">
                      {formatDate(
                        campaign.sentAt ?? campaign.scheduledAt ?? campaign.createdAt,
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="New campaign" />
          <ActionForm action={createCampaignAction} className="space-y-3 p-5">
            <input type="hidden" name="slug" value={slug} />
            <Field label="Name" hint="Internal only — recipients never see it.">
              <Input name="name" placeholder="March product update" required />
            </Field>
            <Field label="Subject line">
              <Input name="subject" placeholder="What shipped in March" />
            </Field>
            <SubmitButton>Create campaign</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
