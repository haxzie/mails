import { and, desc, eq } from "drizzle-orm";
import { emails } from "@mails/db/schema";
import {
  Badge,
  EmptyState,
  FilterBar,
  FilterTab,
  StatusBadge,
  Table,
  Td,
  Th,
  TopBar,
} from "@/components/shell";
import { getDb } from "@/lib/cloudflare";
import { formatDate, requireProject } from "@/lib/projects";

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
      <TopBar
        title="Logs"
        description="Every message handed to SES, newest first"
      />

      <FilterBar
        action={
          campaignId ? (
            <FilterTab href={`/p/${slug}/logs?status=${status}`} active>
              Campaign filter · clear
            </FilterTab>
          ) : null
        }
      >
        {STATUSES.map((value) => (
          <FilterTab
            key={value}
            href={`/p/${slug}/logs?status=${value}${
              campaignId ? `&campaign=${campaignId}` : ""
            }`}
            active={value === status}
          >
            {value}
          </FilterTab>
        ))}
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState title="Nothing here" description="No messages match this filter." />
      ) : (
        <Table flush>
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
    </>
  );
}
