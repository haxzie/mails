import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Plus } from "lucide-react";
import { campaigns } from "@mails/db/schema";
import { createCampaignAction } from "@/app/actions/campaigns";
import { SubmitButton } from "@/components/client";
import { ModalButton, ModalCancel, ModalForm } from "@/components/modal";
import {
  EmptyState,
  Field,
  Input,
  StatusBadge,
  Table,
  Td,
  Th,
  TopBar,
} from "@/components/shell";
import { getDb } from "@/lib/cloudflare";
import { formatDate, formatNumber, requireProject } from "@/lib/projects";

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
      <TopBar
        title="Campaigns"
        description={`${rows.length} broadcast${rows.length === 1 ? "" : "s"}`}
        action={
          <ModalButton
            label="New campaign"
            title="New campaign"
            description="You can change everything later."
            icon={<Plus className="size-3.5" strokeWidth={2} />}
          >
            <ModalForm action={createCampaignAction} className="space-y-3">
              <input type="hidden" name="slug" value={slug} />
              <Field label="Name" hint="Internal only — recipients never see it.">
                <Input name="name" placeholder="March product update" required autoFocus />
              </Field>
              <Field label="Subject line">
                <Input name="subject" placeholder="What shipped in March" />
              </Field>
              <div className="flex gap-2 pt-1">
                <SubmitButton>Create campaign</SubmitButton>
                <ModalCancel />
              </div>
            </ModalForm>
          </ModalButton>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Create one, write the email, send yourself a test, then ship it."
        />
      ) : (
        <Table hover flush>
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
    </>
  );
}
