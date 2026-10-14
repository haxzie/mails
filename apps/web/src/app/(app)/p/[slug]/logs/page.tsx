import { and, desc, eq } from "drizzle-orm";
import { emails } from "@mails/db/schema";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatusBadge,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { getDb } from "@/lib/cloudflare";
import { formatDate, requireProject } from "@/lib/projects";

export const instant = false;

const STATUSES = [
  "all",
  "queued",
  "sent",
  "delivered",
  "bounced",
  "complained",
  "failed",
  "skipped",
] as const;

export default async function LogsPage({
  params,
  searchParams,
}: PageProps<"/p/[slug]/logs">) {
  const { slug } = await params;
  const query = await searchParams;
  const status = typeof query.status === "string" ? query.status : "all";
  const campaignId = typeof query.campaign === "string" ? query.campaign : "";

  const { project } = await requireProject(slug);
  const db = await getDb();

  const rows = await db.query.emails.findMany({
    where: and(
      eq(emails.projectId, project.id),
      status !== "all" && STATUSES.includes(status as (typeof STATUSES)[number])
        ? eq(emails.status, status as "sent")
        : undefined,
      campaignId ? eq(emails.campaignId, campaignId) : undefined,
    ),
    orderBy: desc(emails.createdAt),
    limit: 100,
  });

  return (
    <>
      <PageHeader
        title="Logs"
        description="Every message this project has handed to SES, newest first."
      />

      <Card>
        <CardHeader
          title="Messages"
          action={
            <div className="flex flex-wrap gap-1">
              {STATUSES.map((value) => (
                <a
                  key={value}
                  href={`/p/${slug}/logs?status=${value}${
                    campaignId ? `&campaign=${campaignId}` : ""
                  }`}
                  className={
                    value === status
                      ? "rounded-md bg-canvas px-2 py-1 text-[12px] font-medium"
                      : "rounded-md px-2 py-1 text-[12px] text-ink-muted hover:bg-canvas"
                  }
                >
                  {value}
                </a>
              ))}
            </div>
          }
        />
        {rows.length === 0 ? (
          <EmptyState title="Nothing here" description="No messages match this filter." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Recipient</Th>
                <Th>Subject</Th>
                <Th>Kind</Th>
                <Th>Status</Th>
                <Th>Engagement</Th>
                <Th className="text-right">Created</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((email) => (
                <tr key={email.id}>
                  <Td className="font-medium">{email.to}</Td>
                  <Td className="text-ink-soft">
                    <p className="truncate-id">{email.subject}</p>
                    {email.error ? (
                      <p className="mt-0.5 text-[11.5px] text-negative">
                        {email.error}
                      </p>
                    ) : null}
                  </Td>
                  <Td>
                    <Badge>{email.kind}</Badge>
                  </Td>
                  <Td>
                    <StatusBadge status={email.status} />
                  </Td>
                  <Td className="text-[12px] text-ink-muted tabular-nums">
                    {email.openCount} opens · {email.clickCount} clicks
                  </Td>
                  <Td className="text-right text-[12px] text-ink-muted">
                    {formatDate(email.sentAt ?? email.createdAt)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
